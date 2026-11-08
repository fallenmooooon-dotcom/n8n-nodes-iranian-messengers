import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import type { IDataObject, IHttpRequestOptions } from 'n8n-workflow';

import { Bale } from '../nodes/Bale/Bale.node';
import { API_ROOT, CLEAN_TOKEN, makeExecuteContext, ok } from './fakes';
import type { ExecuteOptions } from './fakes';

async function run(options: ExecuteOptions) {
	const { context, http } = makeExecuteContext(options);
	const output = await new Bale().execute.call(context);
	return { output, http };
}

function bodyOf(call: IHttpRequestOptions): IDataObject {
	return call.body as IDataObject;
}

describe('Bale node: message operations', () => {
	it('sends a text message as JSON and normalises the token', async () => {
		const { output, http } = await run({
			params: { resource: 'message', operation: 'sendText', chatId: '12345', text: 'Hello' },
			responses: [ok({ message_id: 7, text: 'Hello' })],
		});

		assert.equal(http.calls.length, 1);
		assert.equal(http.calls[0].url, `${API_ROOT}/sendMessage`);
		assert.equal(http.calls[0].method, 'POST');
		assert.equal(http.calls[0].json, true);
		assert.deepEqual(bodyOf(http.calls[0]), { chat_id: 12345, text: 'Hello' });
		assert.deepEqual(output[0][0].json, { message_id: 7, text: 'Hello' });
		assert.deepEqual(output[0][0].pairedItem, { item: 0 });
	});

	it('keeps channel usernames, parses reply markup and only sends parse_mode when set', async () => {
		const { http } = await run({
			params: {
				resource: 'message',
				operation: 'sendText',
				chatId: '@news',
				text: 'Hi',
				additionalFields: {
					replyToMessageId: 9,
					replyMarkup: '{"inline_keyboard":[[{"text":"Open","url":"https://example.com"}]]}',
					parseMode: '',
				},
			},
			responses: [ok({ message_id: 8 })],
		});
		assert.deepEqual(bodyOf(http.calls[0]), {
			chat_id: '@news',
			text: 'Hi',
			reply_to_message_id: 9,
			reply_markup: { inline_keyboard: [[{ text: 'Open', url: 'https://example.com' }]] },
		});
	});

	it('sends parse_mode when the user sets it', async () => {
		const { http } = await run({
			params: {
				resource: 'message',
				operation: 'sendText',
				chatId: '1',
				text: 'Hi',
				additionalFields: { parseMode: 'Markdown' },
			},
			responses: [ok({})],
		});
		assert.equal(bodyOf(http.calls[0]).parse_mode, 'Markdown');
	});

	it('uses a custom base URL without a trailing slash', async () => {
		const { http } = await run({
			params: { resource: 'bot', operation: 'getMe' },
			credentials: { accessToken: CLEAN_TOKEN, baseUrl: 'https://proxy.example.com/' },
			responses: [ok({ id: 1, is_bot: true })],
		});
		assert.equal(http.calls[0].url, `https://proxy.example.com/bot${CLEAN_TOKEN}/getMe`);
	});

	it('edits, deletes, forwards and copies messages', async () => {
		const edit = await run({
			params: { resource: 'message', operation: 'editText', chatId: '1', messageId: 5, text: 'New' },
			responses: [ok({ message_id: 5 })],
		});
		assert.equal(edit.http.calls[0].url, `${API_ROOT}/editMessageText`);
		assert.deepEqual(bodyOf(edit.http.calls[0]), { chat_id: 1, message_id: 5, text: 'New' });

		const del = await run({
			params: { resource: 'message', operation: 'delete', chatId: '1', messageId: 5 },
			responses: [ok(true)],
		});
		assert.equal(del.http.calls[0].url, `${API_ROOT}/deleteMessage`);
		assert.deepEqual(del.output[0][0].json, { success: true });

		const forward = await run({
			params: { resource: 'message', operation: 'forward', chatId: '2', fromChatId: '1', messageId: 5 },
			responses: [ok({ message_id: 6 })],
		});
		assert.equal(forward.http.calls[0].url, `${API_ROOT}/forwardMessage`);
		assert.deepEqual(bodyOf(forward.http.calls[0]), { chat_id: 2, from_chat_id: 1, message_id: 5 });

		const copy = await run({
			params: { resource: 'message', operation: 'copy', chatId: '2', fromChatId: '1', messageId: 5 },
			responses: [ok({ message_id: 9 })],
		});
		assert.equal(copy.http.calls[0].url, `${API_ROOT}/copyMessage`);
		assert.deepEqual(copy.output[0][0].json, { message_id: 9 });
	});

	it('sends a location and a contact', async () => {
		const location = await run({
			params: {
				resource: 'message',
				operation: 'sendLocation',
				chatId: '1',
				latitude: 35.6892,
				longitude: 51.389,
				additionalFields: { horizontalAccuracy: 50 },
			},
			responses: [ok({ message_id: 1 })],
		});
		assert.deepEqual(bodyOf(location.http.calls[0]), {
			chat_id: 1,
			latitude: 35.6892,
			longitude: 51.389,
			horizontal_accuracy: 50,
		});

		const contact = await run({
			params: {
				resource: 'message',
				operation: 'sendContact',
				chatId: '1',
				phoneNumber: '+989120000000',
				firstName: 'Ali',
				additionalFields: { lastName: 'Rezaei' },
			},
			responses: [ok({ message_id: 2 })],
		});
		assert.deepEqual(bodyOf(contact.http.calls[0]), {
			chat_id: 1,
			phone_number: '+989120000000',
			first_name: 'Ali',
			last_name: 'Rezaei',
		});
	});

	it('rejects invalid input before calling the API', async () => {
		const base = { resource: 'message', operation: 'sendText', chatId: '1' };
		await assert.rejects(
			run({ params: { ...base, text: '   ' }, responses: [] }),
			(error: Error) => error instanceof NodeOperationError && /must not be empty/.test(error.message),
		);
		await assert.rejects(
			run({ params: { ...base, text: 'a'.repeat(4097) }, responses: [] }),
			(error: Error) => error instanceof NodeOperationError && /maximum is 4096/.test(error.message),
		);
		await assert.rejects(
			run({
				params: { resource: 'message', operation: 'sendLocation', chatId: '1', latitude: 95, longitude: 0 },
				responses: [],
			}),
			(error: Error) => /Latitude/.test(error.message),
		);
		await assert.rejects(
			run({
				params: { ...base, text: 'x', additionalFields: { replyMarkup: '{broken' } },
				responses: [],
			}),
			(error: Error) => /not valid JSON/.test(error.message),
		);
	});
});

describe('Bale node: media', () => {
	const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff]);
	const binaries = {
		data: { meta: { data: '', mimeType: 'image/png', fileName: 'pic.png' }, data: png },
	};

	it('uploads binary data as multipart/form-data', async () => {
		const { http } = await run({
			params: {
				resource: 'message',
				operation: 'sendMedia',
				chatId: '1',
				mediaType: 'photo',
				mediaSource: 'binary',
				binaryPropertyName: 'data',
				fileName: '',
				caption: 'A picture',
			},
			binaries,
			responses: [ok({ message_id: 3 })],
		});

		const call = http.calls[0];
		assert.equal(call.url, `${API_ROOT}/sendPhoto`);
		assert.equal(call.json, undefined);
		const contentType = (call.headers as IDataObject)['Content-Type'] as string;
		assert.match(contentType, /^multipart\/form-data; boundary=----n8nBaleBoundary/);
		const body = call.body as Buffer;
		assert.ok(Buffer.isBuffer(body));
		const text = body.toString('latin1');
		assert.match(text, /name="chat_id"\r\n\r\n1\r\n/);
		assert.match(text, /name="caption"\r\n\r\nA picture\r\n/);
		assert.match(text, /name="photo"; filename="pic.png"\r\nContent-Type: image\/png\r\n\r\n/);
		assert.equal(body.includes(png), true);
	});

	it('sends a file ID or URL as JSON, with the right method per media type', async () => {
		const byId = await run({
			params: {
				resource: 'message',
				operation: 'sendMedia',
				chatId: '1',
				mediaType: 'document',
				mediaSource: 'fileId',
				mediaFileId: 'FILE-123',
				caption: 'Report',
			},
			responses: [ok({ message_id: 4 })],
		});
		assert.equal(byId.http.calls[0].url, `${API_ROOT}/sendDocument`);
		assert.deepEqual(bodyOf(byId.http.calls[0]), { chat_id: 1, caption: 'Report', document: 'FILE-123' });

		const byUrl = await run({
			params: {
				resource: 'message',
				operation: 'sendMedia',
				chatId: '1',
				mediaType: 'video',
				mediaSource: 'url',
				mediaUrl: 'https://example.com/clip.mp4',
				caption: '',
			},
			responses: [ok({ message_id: 5 })],
		});
		assert.equal(byUrl.http.calls[0].url, `${API_ROOT}/sendVideo`);
		assert.deepEqual(bodyOf(byUrl.http.calls[0]), { chat_id: 1, video: 'https://example.com/clip.mp4' });
	});

	it('does not send a caption for animations', async () => {
		const { http } = await run({
			params: {
				resource: 'message',
				operation: 'sendMedia',
				chatId: '1',
				mediaType: 'animation',
				mediaSource: 'fileId',
				mediaFileId: 'GIF-1',
				caption: 'ignored',
			},
			responses: [ok({ message_id: 6 })],
		});
		assert.equal(http.calls[0].url, `${API_ROOT}/sendAnimation`);
		assert.deepEqual(bodyOf(http.calls[0]), { chat_id: 1, animation: 'GIF-1' });
	});

	it('enforces the documented upload limits and URL format', async () => {
		const huge = Buffer.alloc(10 * 1024 * 1024 + 1);
		await assert.rejects(
			run({
				params: {
					resource: 'message',
					operation: 'sendMedia',
					chatId: '1',
					mediaType: 'photo',
					mediaSource: 'binary',
					binaryPropertyName: 'data',
					fileName: '',
					caption: '',
				},
				binaries: { data: { meta: { data: '', mimeType: 'image/jpeg', fileName: 'big.jpg' }, data: huge } },
				responses: [],
			}),
			(error: Error) => error instanceof NodeOperationError && /at most 10 MB/.test(error.message),
		);
		await assert.rejects(
			run({
				params: {
					resource: 'message',
					operation: 'sendMedia',
					chatId: '1',
					mediaType: 'photo',
					mediaSource: 'url',
					mediaUrl: 'not-a-url',
					caption: '',
				},
				responses: [],
			}),
			(error: Error) => /absolute http\(s\) URL/.test(error.message),
		);
	});
});

describe('Bale node: other resources', () => {
	it('answers a callback query', async () => {
		const { http, output } = await run({
			params: {
				resource: 'callbackQuery',
				operation: 'answer',
				callbackQueryId: 'cb-1',
				additionalFields: { text: 'Done', showAlert: true },
			},
			responses: [ok(true)],
		});
		assert.equal(http.calls[0].url, `${API_ROOT}/answerCallbackQuery`);
		assert.deepEqual(bodyOf(http.calls[0]), { callback_query_id: 'cb-1', text: 'Done', show_alert: true });
		assert.deepEqual(output[0][0].json, { success: true });
	});

	it('maps chat and chat member operations to the documented methods', async () => {
		const cases: Array<[Record<string, unknown>, string, IDataObject]> = [
			[{ resource: 'chat', operation: 'get', chatId: '5' }, 'getChat', { chat_id: 5 }],
			[{ resource: 'chat', operation: 'getMemberCount', chatId: '5' }, 'getChatMembersCount', { chat_id: 5 }],
			[{ resource: 'chat', operation: 'leave', chatId: '5' }, 'leaveChat', { chat_id: 5 }],
			[
				{ resource: 'chat', operation: 'pinMessage', chatId: '5', messageId: 3 },
				'pinChatMessage',
				{ chat_id: 5, message_id: 3 },
			],
			[
				{ resource: 'chat', operation: 'unpinMessage', chatId: '5', messageId: 3 },
				'unPinChatMessage',
				{ chat_id: 5, message_id: 3 },
			],
			[{ resource: 'chat', operation: 'unpinAllMessages', chatId: '5' }, 'unpinAllChatMessages', { chat_id: 5 }],
			[
				{ resource: 'chatMember', operation: 'ban', chatId: '5', userId: 8 },
				'banChatMember',
				{ chat_id: 5, user_id: 8 },
			],
			[
				{ resource: 'chatMember', operation: 'unban', chatId: '5', userId: 8, additionalFields: { onlyIfBanned: true } },
				'unbanChatMember',
				{ chat_id: 5, user_id: 8, only_if_banned: true },
			],
		];
		for (const [params, method, expectedBody] of cases) {
			const { http } = await run({ params, responses: [ok(true)] });
			assert.equal(http.calls[0].url, `${API_ROOT}/${method}`, method);
			assert.deepEqual(bodyOf(http.calls[0]), expectedBody, method);
		}
	});

	it('returns the member count as a number', async () => {
		const { output } = await run({
			params: { resource: 'chat', operation: 'getMemberCount', chatId: '5' },
			responses: [ok(42)],
		});
		assert.deepEqual(output[0][0].json, { count: 42 });
	});

	it('gets file info without downloading', async () => {
		const { http, output } = await run({
			params: { resource: 'file', operation: 'get', fileId: 'F1', download: false },
			responses: [ok({ file_id: 'F1', file_path: 'documents/a.pdf' })],
		});
		assert.equal(http.calls.length, 1);
		assert.equal(http.calls[0].url, `${API_ROOT}/getFile`);
		assert.deepEqual(output[0][0].json, { file_id: 'F1', file_path: 'documents/a.pdf' });
	});

	it('downloads a file as binary data and never returns the token-bearing URL', async () => {
		const content = Buffer.from('%PDF-1.4 fake');
		const { http, output } = await run({
			params: { resource: 'file', operation: 'get', fileId: 'F1', download: true, binaryPropertyName: 'attachment' },
			responses: [
				ok({ file_id: 'F1', file_path: 'documents/a.pdf', file_size: content.length }),
				{ body: content, headers: { 'Content-Type': 'application/pdf; charset=binary' } },
			],
		});

		assert.equal(http.calls[1].method, 'GET');
		assert.equal(http.calls[1].url, `https://tapi.bale.ai/file/bot${CLEAN_TOKEN}/documents/a.pdf`);
		assert.equal(http.calls[1].encoding, 'arraybuffer');
		const item = output[0][0];
		assert.equal(item.binary?.attachment.mimeType, 'application/pdf');
		assert.equal(item.binary?.attachment.fileName, 'a.pdf');
		assert.equal(Buffer.from(item.binary?.attachment.data ?? '', 'base64').toString(), '%PDF-1.4 fake');
		assert.equal(JSON.stringify(item.json).includes(CLEAN_TOKEN), false);
	});

	it('refuses files above the 20 MB download limit', async () => {
		await assert.rejects(
			run({
				params: { resource: 'file', operation: 'get', fileId: 'F1', download: true, binaryPropertyName: 'data' },
				responses: [ok({ file_id: 'F1', file_path: 'x.bin', file_size: 21 * 1024 * 1024 })],
			}),
			(error: Error) => error instanceof NodeOperationError && /20 MB/.test(error.message),
		);
	});
});

describe('Bale node: errors and batching', () => {
	it('turns a Bale error envelope into a NodeApiError with a hint', async () => {
		await assert.rejects(
			run({
				params: { resource: 'message', operation: 'sendText', chatId: '1', text: 'Hi' },
				responses: [{ statusCode: 403, body: { ok: false, error_code: 403, description: 'Forbidden: bot was blocked' } }],
			}),
			(error: NodeApiError) => {
				assert.ok(error instanceof NodeApiError);
				assert.equal(error.message, 'Bale API error 403: Forbidden: bot was blocked');
				assert.match(error.description ?? '', /lacks permission/);
				assert.equal(error.httpCode, '403');
				return true;
			},
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

	it('reports a non-Bale response without leaking the token', async () => {
		await assert.rejects(
			run({
				params: { resource: 'bot', operation: 'getMe' },
				responses: [{ statusCode: 502, body: `<html>Bad gateway for /bot${CLEAN_TOKEN}/getMe</html>` }],
			}),
			(error: NodeApiError) => {
				assert.equal(error.message, 'Unexpected response from Bale (HTTP 502)');
				assert.equal(JSON.stringify(error).includes(CLEAN_TOKEN), false);
				return true;
			},
		);
	});

	it('redacts the token from network errors', async () => {
		await assert.rejects(
			run({
				params: { resource: 'bot', operation: 'getMe' },
				responses: [{ error: new Error(`connect ECONNREFUSED while calling /bot${CLEAN_TOKEN}/getMe`) }],
			}),
			(error: NodeApiError) => {
				assert.ok(error instanceof NodeApiError);
				assert.match(error.message, /Could not reach the Bale API/);
				assert.equal(error.message.includes(CLEAN_TOKEN), false);
				return true;
			},
		);
	});

	it('rejects an empty token', async () => {
		await assert.rejects(
			run({
				params: { resource: 'bot', operation: 'getMe' },
				credentials: { accessToken: '  ', baseUrl: '' },
				responses: [],
			}),
			(error: Error) => error instanceof NodeOperationError && /token is empty/.test(error.message),
		);
	});

	it('continues on fail and keeps item pairing', async () => {
		const { output } = await run({
			params: [
				{ resource: 'message', operation: 'sendText', chatId: '1', text: 'one' },
				{ resource: 'message', operation: 'sendText', chatId: '1', text: 'two' },
			],
			items: [{ json: {} }, { json: {} }],
			continueOnFail: true,
			responses: [
				{ statusCode: 400, body: { ok: false, error_code: 400, description: 'Bad Request' } },
				ok({ message_id: 2 }),
			],
		});
		assert.equal(output[0].length, 2);
		assert.deepEqual(output[0][0], {
			json: { error: 'Bale API error 400: Bad Request' },
			pairedItem: { item: 0 },
		});
		assert.deepEqual(output[0][1], { json: { message_id: 2 }, pairedItem: { item: 1 } });
	});

	it('records the failing item index on errors', async () => {
		await assert.rejects(
			run({
				params: [
					{ resource: 'message', operation: 'sendText', chatId: '1', text: 'one' },
					{ resource: 'message', operation: 'sendText', chatId: '1', text: 'two' },
				],
				items: [{ json: {} }, { json: {} }],
				responses: [ok({ message_id: 1 }), { statusCode: 429, body: { ok: false, error_code: 429, description: 'Too Many Requests' } }],
			}),
			(error: NodeApiError) => {
				assert.equal(error.context.itemIndex, 1);
				assert.match(error.description ?? '', /1 message per second/);
				return true;
			},
		);
	});

	it('waits between items when a delay is configured', async () => {
		const started = Date.now();
		await run({
			params: [
				{ resource: 'bot', operation: 'getMe', options: { delayBetweenItems: 60 } },
				{ resource: 'bot', operation: 'getMe', options: { delayBetweenItems: 60 } },
			],
			items: [{ json: {} }, { json: {} }],
			responses: [ok({ id: 1 }), ok({ id: 1 })],
		});
		assert.ok(Date.now() - started >= 55, 'a pause happened between the two requests');
	});

	it('rejects unsupported operations', async () => {
		await assert.rejects(
			run({ params: { resource: 'chat', operation: 'explode' }, responses: [] }),
			(error: Error) => error instanceof NodeOperationError && /not supported/.test(error.message),
		);
	});
});
