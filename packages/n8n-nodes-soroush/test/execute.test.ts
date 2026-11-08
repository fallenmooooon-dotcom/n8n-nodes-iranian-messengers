// eslint-disable-next-line @n8n/community-nodes/no-restricted-imports
import assert from 'node:assert/strict';
// eslint-disable-next-line @n8n/community-nodes/no-restricted-imports
import { describe, it } from 'node:test';

import type { IDataObject, IHttpRequestOptions } from 'n8n-workflow';

import { hmacSha256 } from '../nodes/Soroush/helpers';
import { Soroush } from '../nodes/Soroush/Soroush.node';
import { API_ROOT, CLEAN_TOKEN, makeExecuteContext, ok, fail } from './fakes';
import type { ExecuteOptions } from './fakes';

async function run(options: ExecuteOptions) {
	const { context, http } = makeExecuteContext(options);
	const output = await new Soroush().execute.call(context);
	return { output, http };
}

function bodyOf(call: IHttpRequestOptions): IDataObject {
	return call.body as IDataObject;
}

describe('Soroush Plus node: execute operations', () => {
	it('sends text message via sendMessage', async () => {
		const { output, http } = await run({
			params: {
				resource: 'message',
				operation: 'sendText',
				chatId: '123456',
				text: 'Hello from Soroush node',
			},
			responses: [ok({ message_id: 101, text: 'Hello from Soroush node' })],
		});

		assert.equal(http.calls.length, 1);
		assert.equal(http.calls[0].url, `${API_ROOT}/sendMessage`);
		assert.deepEqual(bodyOf(http.calls[0]), {
			chat_id: 123456,
			text: 'Hello from Soroush node',
		});
		assert.deepEqual(output[0][0].json, {
			message_id: 101,
			text: 'Hello from Soroush node',
		});
	});

	it('sends animation with caption via sendAnimation', async () => {
		const { http } = await run({
			params: {
				resource: 'message',
				operation: 'sendMedia',
				chatId: '123456',
				mediaType: 'animation',
				mediaSource: 'fileId',
				mediaFileId: 'ANIM_1',
				caption: 'Animated GIF caption',
				additionalFields: { parseMode: 'MarkdownV2' },
			},
			responses: [ok({ message_id: 105 })],
		});

		assert.equal(http.calls[0].url, `${API_ROOT}/sendAnimation`);
		assert.deepEqual(bodyOf(http.calls[0]), {
			chat_id: 123456,
			animation: 'ANIM_1',
			caption: 'Animated GIF caption',
			parse_mode: 'MarkdownV2',
		});
	});

	it('sends location with horizontal_accuracy', async () => {
		const { http } = await run({
			params: {
				resource: 'message',
				operation: 'sendLocation',
				chatId: '123456',
				latitude: 35.6892,
				longitude: 51.389,
				additionalFields: { horizontalAccuracy: 45 },
			},
			responses: [ok({ message_id: 106 })],
		});

		assert.equal(http.calls[0].url, `${API_ROOT}/sendLocation`);
		assert.deepEqual(bodyOf(http.calls[0]), {
			chat_id: 123456,
			latitude: 35.6892,
			longitude: 51.389,
			horizontal_accuracy: 45,
		});
	});

	it('sends Mini App launch button message', async () => {
		const { output, http } = await run({
			params: {
				resource: 'miniApp',
				operation: 'sendMiniAppButton',
				chatId: '98765',
				text: 'Click below to open our store:',
				buttonText: 'Open Store',
				webAppUrl: 'https://store.example.com',
				buttonType: 'inline',
			},
			responses: [ok({ message_id: 202 })],
		});

		assert.equal(http.calls.length, 1);
		assert.equal(http.calls[0].url, `${API_ROOT}/sendMessage`);
		assert.deepEqual(bodyOf(http.calls[0]), {
			chat_id: 98765,
			text: 'Click below to open our store:',
			reply_markup: {
				inline_keyboard: [
					[
						{
							text: 'Open Store',
							web_app: { url: 'https://store.example.com' },
						},
					],
				],
			},
		});
		assert.deepEqual(output[0][0].json, { message_id: 202 });
	});

	it('verifies Mini App initData signature via miniApp.verifyInitData', async () => {
		const authDate = Math.floor(Date.now() / 1000);
		const userJson = JSON.stringify({ id: 42, first_name: 'Mehran' });
		const dataCheckString = `auth_date=${authDate}\nuser=${userJson}`;
		const secretKey = hmacSha256('WebAppData', CLEAN_TOKEN);
		const hash = hmacSha256(secretKey, dataCheckString).toString('hex');
		const initData = new URLSearchParams({
			auth_date: String(authDate),
			user: userJson,
			hash,
		}).toString();

		const { output, http } = await run({
			params: {
				resource: 'miniApp',
				operation: 'verifyInitData',
				initData,
				maxAgeSeconds: 3600,
				rejectOnInvalid: true,
			},
			responses: [],
		});

		assert.equal(http.calls.length, 0);
		assert.equal(output[0][0].json.valid, true);
		assert.deepEqual(output[0][0].json.user, { id: 42, first_name: 'Mehran' });
	});

	it('answers callback query', async () => {
		const { output, http } = await run({
			params: {
				resource: 'callbackQuery',
				operation: 'answer',
				callbackQueryId: 'cb_999',
				additionalFields: { text: 'Done!', showAlert: true },
			},
			responses: [ok(true)],
		});

		assert.equal(http.calls.length, 1);
		assert.equal(http.calls[0].url, `${API_ROOT}/answerCallbackQuery`);
		assert.deepEqual(bodyOf(http.calls[0]), {
			callback_query_id: 'cb_999',
			text: 'Done!',
			show_alert: true,
		});
		assert.deepEqual(output[0][0].json, { success: true });
	});

	it('returns error when continueOnFail is true', async () => {
		const { output } = await run({
			params: {
				resource: 'message',
				operation: 'sendText',
				chatId: '123',
				text: 'Hi',
			},
			responses: [fail('Chat not found', 400)],
			continueOnFail: true,
		});

		assert.ok(typeof output[0][0].json.error === 'string');
	});
});
