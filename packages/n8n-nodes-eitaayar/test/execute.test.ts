// eslint-disable-next-line @n8n/community-nodes/no-restricted-imports
import assert from 'node:assert/strict';
// eslint-disable-next-line @n8n/community-nodes/no-restricted-imports
import { describe, it } from 'node:test';

import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import type { IDataObject } from 'n8n-workflow';

import { EitaaYar } from '../nodes/EitaaYar/EitaaYar.node';
import { API_ROOT, CLEAN_TOKEN, fail, makeExecuteContext, ok } from './fakes';
import type { ExecuteOptions } from './fakes';

async function run(options: ExecuteOptions) {
	const { context, http } = makeExecuteContext(options);
	const output = await new EitaaYar().execute.call(context);
	return { output, http };
}

const sendText = { resource: 'message', operation: 'sendText', chatId: '@news', text: 'Hello' };

describe('EitaaYar node: requests', () => {
	it('calls getMe with exactly one bot prefix in the URL', async () => {
		const me = { id: 112233, is_bot: true, first_name: 'Sender', username: 'sender_bot' };
		const { output, http } = await run({ params: { resource: 'bot', operation: 'getMe' }, responses: [ok(me)] });
		assert.equal(http.calls[0].url, `${API_ROOT}/getMe`);
		assert.equal(http.calls[0].method, 'POST');
		assert.equal(http.calls[0].json, true);
		assert.deepEqual(output[0][0].json, me);
		assert.deepEqual(output[0][0].pairedItem, { item: 0 });
	});

	it('accepts the token without the prefix, a pasted URL and a custom base URL', async () => {
		for (const accessToken of [CLEAN_TOKEN, `https://eitaayar.ir/api/bot${CLEAN_TOKEN}/getMe`]) {
			const { http } = await run({
				params: { resource: 'bot', operation: 'getMe' },
				credentials: { accessToken, baseUrl: 'https://proxy.example.com/api/' },
				responses: [ok({ id: 1 })],
			});
			assert.equal(http.calls[0].url, `https://proxy.example.com/api/bot${CLEAN_TOKEN}/getMe`);
		}
	});

	it('sends text as JSON with the optional fields', async () => {
		const { http, output } = await run({
			params: {
				...sendText,
				additionalFields: {
					title: 'Promo',
					pin: true,
					disableNotification: true,
					replyToMessageId: 3,
					scheduleDate: '1790000000',
					viewCountForDelete: 100,
				},
			},
			responses: [ok({ message_id: 42 })],
		});
		assert.equal(http.calls[0].url, `${API_ROOT}/sendMessage`);
		assert.equal(http.calls[0].json, true);
		assert.deepEqual(http.calls[0].body, {
			chat_id: '@news',
			text: 'Hello',
			title: 'Promo',
			pin: 1,
			disable_notification: 1,
			reply_to_message_id: 3,
			date: 1790000000,
			viewCountForDelete: 100,
		});
		assert.deepEqual(output[0][0].json, { message_id: 42 });
	});

	it('sends a plain message without optional fields and reports an empty result as success', async () => {
		const { http, output } = await run({ params: { ...sendText, additionalFields: {} }, responses: [ok()] });
		assert.deepEqual(http.calls[0].body, { chat_id: '@news', text: 'Hello' });
		assert.deepEqual(output[0][0].json, { success: true });
	});

	it('uploads files as multipart/form-data', async () => {
		const gif = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0xff]);
		const { http } = await run({
			params: {
				resource: 'message',
				operation: 'sendFile',
				chatId: '123456',
				binaryPropertyName: 'data',
				fileName: 'party.gif',
				additionalFields: { caption: 'Party', pin: true, title: 'Gif post' },
			},
			binaries: { data: { meta: { data: '', mimeType: 'image/gif', fileName: 'original.gif' }, data: gif } },
			responses: [ok({ message_id: 43 })],
		});
		const call = http.calls[0];
		assert.equal(call.url, `${API_ROOT}/sendFile`);
		assert.equal(call.json, undefined);
		assert.match((call.headers as IDataObject)['Content-Type'] as string, /^multipart\/form-data; boundary=----n8nEitaaYarBoundary/);
		const body = call.body as Buffer;
		assert.ok(Buffer.isBuffer(body));
		const text = body.toString('latin1');
		assert.match(text, /name="chat_id"\r\n\r\n123456\r\n/);
		assert.match(text, /name="pin"\r\n\r\n1\r\n/);
		assert.match(text, /name="title"\r\n\r\nGif post\r\n/);
		assert.match(text, /name="caption"\r\n\r\nParty\r\n/);
		assert.match(text, /name="file"; filename="party.gif"\r\nContent-Type: image\/gif\r\n\r\n/);
		assert.equal(body.includes(gif), true);
	});

	it('uses the file name of the binary data by default', async () => {
		const { http } = await run({
			params: { resource: 'message', operation: 'sendFile', chatId: '1', binaryPropertyName: 'data', fileName: '', additionalFields: {} },
			binaries: { data: { meta: { data: '', mimeType: 'application/pdf', fileName: 'report.pdf' }, data: Buffer.from('%PDF') } },
			responses: [ok({ message_id: 1 })],
		});
		assert.match((http.calls[0].body as Buffer).toString('latin1'), /filename="report.pdf"/);
	});
});

describe('EitaaYar node: errors', () => {
	it('turns ok:false answers into NodeApiError', async () => {
		await assert.rejects(
			run({ params: { ...sendText, additionalFields: {} }, responses: [fail('chat not found', 400)] }),
			(error: NodeApiError) => {
				assert.ok(error instanceof NodeApiError);
				assert.equal(error.message, 'EitaaYar API error: chat not found');
				assert.equal(error.httpCode, '400');
				assert.match(error.description ?? '', /access token/);
				return true;
			},
		);
		await assert.rejects(
			run({ params: { resource: 'bot', operation: 'getMe' }, responses: [{ statusCode: 403, body: { ok: false } }] }),
			(error: NodeApiError) => error.message === 'EitaaYar API error: HTTP 403',
		);
	});

	it('parses envelopes that arrive as strings or buffers', async () => {
		const asString = await run({
			params: { resource: 'bot', operation: 'getMe' },
			responses: [{ body: JSON.stringify({ ok: true, result: { id: 1 } }) }],
		});
		assert.deepEqual(asString.output[0][0].json, { id: 1 });
		const asBuffer = await run({
			params: { resource: 'bot', operation: 'getMe' },
			responses: [{ body: Buffer.from(JSON.stringify({ ok: true, result: { id: 2 } })) }],
		});
		assert.deepEqual(asBuffer.output[0][0].json, { id: 2 });
	});

	it('reports other responses without leaking the token', async () => {
		await assert.rejects(
			run({
				params: { resource: 'bot', operation: 'getMe' },
				responses: [{ statusCode: 502, body: `<html>Bad gateway /bot${CLEAN_TOKEN}/getMe</html>` }],
			}),
			(error: NodeApiError) => {
				assert.equal(error.message, 'Unexpected response from EitaaYar (HTTP 502)');
				assert.equal(JSON.stringify(error).includes(CLEAN_TOKEN), false);
				return true;
			},
		);
	});

	it('redacts the token from network errors', async () => {
		await assert.rejects(
			run({
				params: { resource: 'bot', operation: 'getMe' },
				responses: [{ error: new Error(`ECONNRESET while calling /bot${CLEAN_TOKEN}/getMe`) }],
			}),
			(error: NodeApiError) => {
				assert.match(error.message, /Could not reach the EitaaYar API/);
				assert.equal(error.message.includes(CLEAN_TOKEN), false);
				return true;
			},
		);
	});

	it('rejects invalid input before calling the API', async () => {
		const cases: Array<[Record<string, unknown>, RegExp]> = [
			[{ ...sendText, text: '   ', additionalFields: {} }, /Text must not be empty/],
			[{ ...sendText, chatId: ' ', additionalFields: {} }, /Chat ID must not be empty/],
			[{ ...sendText, additionalFields: { scheduleDate: 'soon' } }, /not a valid date/],
			[{ ...sendText, additionalFields: { viewCountForDelete: 1.5 } }, /Delete After Views/],
		];
		for (const [params, message] of cases) {
			await assert.rejects(
				run({ params, responses: [] }),
				(error: Error) => error instanceof NodeOperationError && message.test(error.message),
				String(message),
			);
		}
		await assert.rejects(
			run({
				params: { resource: 'bot', operation: 'getMe' },
				credentials: { accessToken: ' ', baseUrl: '' },
				responses: [],
			}),
			(error: Error) => error instanceof NodeOperationError && /token is empty/.test(error.message),
		);
	});
});

describe('EitaaYar node: batching', () => {
	it('continues on fail and keeps item pairing', async () => {
		const { output } = await run({
			params: [
				{ ...sendText, text: 'one', additionalFields: {} },
				{ ...sendText, text: 'two', additionalFields: {} },
			],
			items: [{ json: {} }, { json: {} }],
			continueOnFail: true,
			responses: [fail('chat not found'), ok({ message_id: 2 })],
		});
		assert.deepEqual(output[0][0], { json: { error: 'EitaaYar API error: chat not found' }, pairedItem: { item: 0 } });
		assert.deepEqual(output[0][1], { json: { message_id: 2 }, pairedItem: { item: 1 } });
	});

	it('records the failing item index', async () => {
		await assert.rejects(
			run({
				params: [
					{ ...sendText, additionalFields: {} },
					{ ...sendText, additionalFields: {} },
				],
				items: [{ json: {} }, { json: {} }],
				responses: [ok({ message_id: 1 }), fail('flood', 429)],
			}),
			(error: NodeApiError) => {
				assert.equal(error.context.itemIndex, 1);
				return true;
			},
		);
	});

	it('waits between items when a delay is configured and rejects unsupported operations', async () => {
		const started = Date.now();
		await run({
			params: [
				{ resource: 'bot', operation: 'getMe', options: { delayBetweenItems: 60 } },
				{ resource: 'bot', operation: 'getMe', options: { delayBetweenItems: 60 } },
			],
			items: [{ json: {} }, { json: {} }],
			responses: [ok({ id: 1 }), ok({ id: 1 })],
		});
		assert.ok(Date.now() - started >= 55);
		await assert.rejects(
			run({ params: { resource: 'message', operation: 'explode' }, responses: [] }),
			(error: Error) => error instanceof NodeOperationError && /not supported/.test(error.message),
		);
	});
});
