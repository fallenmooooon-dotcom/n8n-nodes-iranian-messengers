import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { NodeOperationError } from 'n8n-workflow';
import type { IDataObject } from 'n8n-workflow';

import { BaleTrigger } from '../nodes/Bale/BaleTrigger.node';
import { API_ROOT, CLEAN_TOKEN, makeHookContext, makeWebhookContext, ok } from './fakes';

const trigger = new BaleTrigger();
const HOOK_URL = 'https://n8n.example.com/webhook/6f1c/webhook';

describe('Bale Trigger: webhook registration', () => {
	it('registers the n8n webhook URL with setWebhook', async () => {
		const { context, http } = makeHookContext({ webhookUrl: HOOK_URL, responses: [ok(true)] });
		assert.equal(await trigger.webhookMethods.default.create.call(context), true);
		assert.equal(http.calls[0].url, `${API_ROOT}/setWebhook`);
		assert.deepEqual(http.calls[0].body, { url: HOOK_URL });
	});

	it('refuses URLs Bale cannot deliver to', async () => {
		for (const url of ['http://n8n.example.com/webhook/x', 'https://n8n.example.com:5678/webhook/x']) {
			const { context, http } = makeHookContext({ webhookUrl: url, responses: [] });
			await assert.rejects(
				trigger.webhookMethods.default.create.call(context),
				(error: Error) => error instanceof NodeOperationError && /HTTPS|ports 443 and 88/.test(error.message),
			);
			assert.equal(http.calls.length, 0);
		}
	});

	it('detects an existing registration', async () => {
		const same = makeHookContext({ webhookUrl: HOOK_URL, responses: [ok({ url: HOOK_URL })] });
		assert.equal(await trigger.webhookMethods.default.checkExists.call(same.context), true);
		assert.equal(same.http.calls[0].url, `${API_ROOT}/getWebhookInfo`);

		const other = makeHookContext({ webhookUrl: HOOK_URL, responses: [ok({ url: 'https://other.example.com/x' })] });
		assert.equal(await trigger.webhookMethods.default.checkExists.call(other.context), false);

		const none = makeHookContext({ webhookUrl: HOOK_URL, responses: [ok({ url: '' })] });
		assert.equal(await trigger.webhookMethods.default.checkExists.call(none.context), false);
	});

	it('removes the webhook with an empty URL and reports failures', async () => {
		const good = makeHookContext({ webhookUrl: HOOK_URL, responses: [ok(true)] });
		assert.equal(await trigger.webhookMethods.default.delete.call(good.context), true);
		assert.deepEqual(good.http.calls[0].body, { url: '' });

		const bad = makeHookContext({
			webhookUrl: HOOK_URL,
			responses: [{ statusCode: 401, body: { ok: false, error_code: 401, description: 'Unauthorized' } }],
		});
		assert.equal(await trigger.webhookMethods.default.delete.call(bad.context), false);
	});
});

describe('Bale Trigger: incoming updates', () => {
	const message: IDataObject = { update_id: 1, message: { message_id: 10, text: 'hello', chat: { id: 55 } } };
	const callback: IDataObject = { update_id: 2, callback_query: { id: 'cb', data: 'yes' } };
	const edited: IDataObject = { update_id: 3, edited_message: { message_id: 10, text: 'hello!' } };

	it('emits selected update kinds unchanged', async () => {
		const { context } = makeWebhookContext({ body: message, params: { updates: ['message'] }, responses: [] });
		const result = await trigger.webhook.call(context);
		assert.deepEqual(result.workflowData, [[{ json: message }]]);
	});

	it('ignores update kinds that are not selected and unknown payloads', async () => {
		for (const body of [callback, edited, { update_id: 9 }]) {
			const { context } = makeWebhookContext({ body, params: { updates: ['message'] }, responses: [] });
			assert.deepEqual(await trigger.webhook.call(context), {});
		}
		const both = makeWebhookContext({ body: callback, params: { updates: ['message', 'callback_query'] }, responses: [] });
		assert.deepEqual((await trigger.webhook.call(both.context)).workflowData, [[{ json: callback }]]);
	});

	it('downloads the largest photo when Download Media is on', async () => {
		const photoUpdate: IDataObject = {
			update_id: 4,
			message: {
				message_id: 11,
				photo: [
					{ file_id: 'small', width: 90, height: 90, file_size: 900 },
					{ file_id: 'big', width: 900, height: 900, file_size: 90000 },
				],
			},
		};
		const { context, http } = makeWebhookContext({
			body: photoUpdate,
			params: { updates: ['message'], options: { downloadMedia: true, binaryPropertyName: 'photo' } },
			responses: [
				ok({ file_id: 'big', file_path: 'photos/p.jpg', file_size: 4 }),
				{ body: Buffer.from('JPEG'), headers: { 'content-type': 'image/jpeg' } },
			],
		});
		const result = await trigger.webhook.call(context);

		assert.deepEqual(http.calls[0].body, { file_id: 'big' });
		assert.equal(http.calls[1].url, `https://tapi.bale.ai/file/bot${CLEAN_TOKEN}/photos/p.jpg`);
		const item = result.workflowData?.[0][0];
		assert.deepEqual(item?.json, photoUpdate);
		assert.equal(item?.binary?.photo.mimeType, 'image/jpeg');
		assert.equal(Buffer.from(item?.binary?.photo.data ?? '', 'base64').toString(), 'JPEG');
	});

	it('still emits the message when the media download fails', async () => {
		const docUpdate: IDataObject = {
			update_id: 5,
			message: { message_id: 12, document: { file_id: 'doc', file_name: 'a.pdf' } },
		};
		const { context } = makeWebhookContext({
			body: docUpdate,
			params: { updates: ['message'], options: { downloadMedia: true } },
			responses: [{ statusCode: 400, body: { ok: false, error_code: 400, description: 'file is too big' } }],
		});
		const item = (await trigger.webhook.call(context)).workflowData?.[0][0];
		assert.equal(item?.binary, undefined);
		assert.equal(item?.json.update_id, 5);
		assert.equal(item?.json.mediaDownloadError, 'Bale API error 400: file is too big');
	});

	it('does not try to download media for callback queries or plain text', async () => {
		const textOnly = makeWebhookContext({
			body: message,
			params: { updates: ['message'], options: { downloadMedia: true } },
			responses: [],
		});
		assert.deepEqual((await trigger.webhook.call(textOnly.context)).workflowData, [[{ json: message }]]);
		assert.equal(textOnly.http.calls.length, 0);
	});
});
