import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import type { IDataObject, IHttpRequestOptions } from 'n8n-workflow';

import { Rubika } from '../nodes/Rubika/Rubika.node';
import { API_ROOT, TOKEN, UPLOAD_URL, fail, makeExecuteContext, ok } from './fakes';
import type { ExecuteOptions } from './fakes';

async function run(options: ExecuteOptions) {
	const { context, http } = makeExecuteContext(options);
	const output = await new Rubika().execute.call(context);
	return { output, http };
}

function bodyOf(call: IHttpRequestOptions): IDataObject {
	return call.body as IDataObject;
}

const keypad = { rows: [{ buttons: [{ id: '100', type: 'Simple', button_text: 'Add' }] }] };

describe('Rubika node: bot and envelope handling', () => {
	it('calls getMe with a JSON POST and returns the data object', async () => {
		const bot = { bot_id: 'b0abc', bot_title: 'Test Bot', username: 'test_bot' };
		const { output, http } = await run({
			params: { resource: 'bot', operation: 'getMe' },
			responses: [ok({ bot })],
		});
		assert.equal(http.calls[0].url, `${API_ROOT}/getMe`);
		assert.equal(http.calls[0].method, 'POST');
		assert.equal(http.calls[0].json, true);
		assert.deepEqual(http.calls[0].body, {});
		assert.deepEqual(output[0][0].json, { bot });
		assert.deepEqual(output[0][0].pairedItem, { item: 0 });
	});

	it('accepts a token that was pasted as a full API URL and a custom base URL', async () => {
		const { http } = await run({
			params: { resource: 'bot', operation: 'getMe' },
			credentials: {
				accessToken: `https://botapi.rubika.ir/v3/${TOKEN}/getMe`,
				baseUrl: 'https://proxy.example.com/v3/',
			},
			responses: [ok({ bot: {} })],
		});
		assert.equal(http.calls[0].url, `https://proxy.example.com/v3/${TOKEN}/getMe`);
	});

	it('maps the documented error codes to NodeApiError with hints', async () => {
		const cases: Array<[string, RegExp]> = [
			['INVALID_AUTH', /token is invalid/],
			['INVALID_INPUT', /missing or invalid/],
			['TOO_MANY_REQUESTS', /Delay Between Items/],
		];
		for (const [code, hint] of cases) {
			await assert.rejects(
				run({ params: { resource: 'bot', operation: 'getMe' }, responses: [fail(code)] }),
				(error: NodeApiError) => {
					assert.ok(error instanceof NodeApiError);
					assert.equal(error.message, `Rubika API error: ${code}`);
					assert.match(error.description ?? '', hint);
					assert.equal(error.httpCode, '200');
					return true;
				},
			);
		}
	});

	it('parses envelopes that arrive as strings or buffers', async () => {
		const asString = await run({
			params: { resource: 'bot', operation: 'getMe' },
			responses: [{ body: JSON.stringify({ status: 'OK', data: { bot: { bot_id: '1' } } }) }],
		});
		assert.deepEqual(asString.output[0][0].json, { bot: { bot_id: '1' } });
		const asBuffer = await run({
			params: { resource: 'bot', operation: 'getMe' },
			responses: [{ body: Buffer.from(JSON.stringify({ status: 'OK', data: { bot: { bot_id: '2' } } })) }],
		});
		assert.deepEqual(asBuffer.output[0][0].json, { bot: { bot_id: '2' } });
	});

	it('reports non-Rubika responses without leaking the token', async () => {
		await assert.rejects(
			run({
				params: { resource: 'bot', operation: 'getMe' },
				responses: [{ statusCode: 502, body: `<html>Bad gateway for /v3/${TOKEN}/getMe</html>` }],
			}),
			(error: NodeApiError) => {
				assert.equal(error.message, 'Unexpected response from Rubika (HTTP 502)');
				assert.equal(JSON.stringify(error).includes(TOKEN), false);
				return true;
			},
		);
	});

	it('redacts the token from network errors and rejects an empty token', async () => {
		await assert.rejects(
			run({
				params: { resource: 'bot', operation: 'getMe' },
				responses: [{ error: new Error(`getaddrinfo ENOTFOUND while calling /v3/${TOKEN}/getMe`) }],
			}),
			(error: NodeApiError) => {
				assert.match(error.message, /Could not reach the Rubika API/);
				assert.equal(error.message.includes(TOKEN), false);
				return true;
			},
		);
		await assert.rejects(
			run({
				params: { resource: 'bot', operation: 'getMe' },
				credentials: { accessToken: ' ', baseUrl: '' },
				responses: [],
			}),
			(error: Error) => error instanceof NodeOperationError && /token is empty/.test(error.message),
		);
	});

	it('sets the bot commands without the leading slash', async () => {
		const { http, output } = await run({
			params: {
				resource: 'bot',
				operation: 'setCommands',
				commands: { items: [{ command: '/start', description: 'Begin' }, { command: 'help', description: 'Help me' }] },
			},
			responses: [ok({})],
		});
		assert.equal(http.calls[0].url, `${API_ROOT}/setCommands`);
		assert.deepEqual(bodyOf(http.calls[0]), {
			bot_commands: [
				{ command: 'start', description: 'Begin' },
				{ command: 'help', description: 'Help me' },
			],
		});
		assert.deepEqual(output[0][0].json, { success: true });
		await assert.rejects(
			run({ params: { resource: 'bot', operation: 'setCommands', commands: {} }, responses: [] }),
			/at least one command/,
		);
	});
});

describe('Rubika node: messages', () => {
	it('sends text with reply, silent mode, keypads and formatting', async () => {
		const { http, output } = await run({
			params: {
				resource: 'message',
				operation: 'sendText',
				chatId: 'b0chat',
				text: 'Hello user',
				additionalFields: {
					replyToMessageId: '123',
					disableNotification: true,
					chatKeypad: JSON.stringify(keypad),
					inlineKeypad: keypad,
					formatting: { parts: [{ type: 'Bold', fromIndex: 0, length: 5 }] },
				},
			},
			responses: [ok({ message_id: '777' })],
		});
		assert.equal(http.calls[0].url, `${API_ROOT}/sendMessage`);
		assert.deepEqual(bodyOf(http.calls[0]), {
			chat_id: 'b0chat',
			text: 'Hello user',
			reply_to_message_id: '123',
			disable_notification: true,
			chat_keypad: keypad,
			chat_keypad_type: 'New',
			inline_keypad: keypad,
			metadata: { meta_data_parts: [{ type: 'Bold', from_index: 0, length: 5 }] },
		});
		assert.deepEqual(output[0][0].json, { message_id: '777' });
	});

	it('keeps IDs as strings and sends a plain text body by default', async () => {
		const { http } = await run({
			params: { resource: 'message', operation: 'sendText', chatId: ' 12345 ', text: 'Hi' },
			responses: [ok({ message_id: '1' })],
		});
		assert.deepEqual(bodyOf(http.calls[0]), { chat_id: '12345', text: 'Hi' });
	});

	it('can remove the chat keypad while sending', async () => {
		const { http } = await run({
			params: {
				resource: 'message',
				operation: 'sendText',
				chatId: 'c',
				text: 'Bye',
				additionalFields: { removeChatKeypad: true },
			},
			responses: [ok({ message_id: '2' })],
		});
		assert.deepEqual(bodyOf(http.calls[0]), { chat_id: 'c', text: 'Bye', chat_keypad_type: 'Remove' });
	});

	it('rejects invalid input before calling the API', async () => {
		const base = { resource: 'message', operation: 'sendText', chatId: 'c', text: 'x' };
		const cases: Array<[Record<string, unknown>, RegExp]> = [
			[{ ...base, text: '  ' }, /must not be empty/],
			[{ ...base, chatId: ' ' }, /Chat ID must not be empty/],
			[{ ...base, additionalFields: { chatKeypad: '{oops' } }, /not valid JSON/],
			[{ ...base, additionalFields: { inlineKeypad: { rows: [] } } }, /non-empty "rows"/],
			[
				{ ...base, additionalFields: { chatKeypad: keypad, removeChatKeypad: true } },
				/either Chat Keypad \(JSON\) or Remove Chat Keypad/,
			],
			[
				{ ...base, additionalFields: { formatting: { parts: [{ type: 'Bold', fromIndex: 0, length: 9 }] } } },
				/UTF-16 units/,
			],
		];
		for (const [params, message] of cases) {
			await assert.rejects(
				run({ params, responses: [] }),
				(error: Error) => error instanceof NodeOperationError && message.test(error.message),
				String(message),
			);
		}
	});

	it('sends polls, locations and contacts', async () => {
		const poll = await run({
			params: {
				resource: 'message',
				operation: 'sendPoll',
				chatId: 'c',
				question: 'Yes or no?',
				pollOptions: { items: [{ text: 'Yes' }, { text: ' No ' }, { text: '' }] },
			},
			responses: [ok({ message_id: '3' })],
		});
		assert.equal(poll.http.calls[0].url, `${API_ROOT}/sendPoll`);
		assert.deepEqual(bodyOf(poll.http.calls[0]), { chat_id: 'c', question: 'Yes or no?', options: ['Yes', 'No'] });
		await assert.rejects(
			run({
				params: { resource: 'message', operation: 'sendPoll', chatId: 'c', question: 'Q', pollOptions: { items: [{ text: 'Only' }] } },
				responses: [],
			}),
			/at least two options/,
		);

		const location = await run({
			params: { resource: 'message', operation: 'sendLocation', chatId: 'c', latitude: 35.6892, longitude: 51.389 },
			responses: [ok({ message_id: '4' })],
		});
		assert.deepEqual(bodyOf(location.http.calls[0]), { chat_id: 'c', latitude: '35.6892', longitude: '51.389' });

		const contact = await run({
			params: {
				resource: 'message',
				operation: 'sendContact',
				chatId: 'c',
				firstName: 'Ali',
				lastName: 'Rezaei',
				phoneNumber: '+989120000000',
				additionalFields: { disableNotification: true },
			},
			responses: [ok({ message_id: '5' })],
		});
		assert.deepEqual(bodyOf(contact.http.calls[0]), {
			chat_id: 'c',
			first_name: 'Ali',
			phone_number: '+989120000000',
			disable_notification: true,
			last_name: 'Rezaei',
		});
	});

	it('forwards, edits and deletes messages', async () => {
		const forward = await run({
			params: {
				resource: 'message',
				operation: 'forward',
				fromChatId: 'a',
				toChatId: 'b',
				messageId: '9',
				additionalFields: { disableNotification: true },
			},
			responses: [ok({ new_message_id: '10' })],
		});
		assert.equal(forward.http.calls[0].url, `${API_ROOT}/forwardMessage`);
		assert.deepEqual(bodyOf(forward.http.calls[0]), {
			from_chat_id: 'a',
			message_id: '9',
			to_chat_id: 'b',
			disable_notification: true,
		});
		assert.deepEqual(forward.output[0][0].json, { new_message_id: '10' });

		const edit = await run({
			params: { resource: 'message', operation: 'editText', chatId: 'c', messageId: '9', text: 'New' },
			responses: [ok({})],
		});
		assert.equal(edit.http.calls[0].url, `${API_ROOT}/editMessageText`);
		assert.deepEqual(bodyOf(edit.http.calls[0]), { chat_id: 'c', message_id: '9', text: 'New' });
		assert.deepEqual(edit.output[0][0].json, { success: true });

		const keypadEdit = await run({
			params: { resource: 'message', operation: 'editInlineKeypad', chatId: 'c', messageId: '9', inlineKeypad: JSON.stringify(keypad) },
			responses: [ok({})],
		});
		assert.equal(keypadEdit.http.calls[0].url, `${API_ROOT}/editMessageKeypad`);
		assert.deepEqual(bodyOf(keypadEdit.http.calls[0]), { chat_id: 'c', message_id: '9', inline_keypad: keypad });

		const del = await run({
			params: { resource: 'message', operation: 'delete', chatId: 'c', messageId: '9' },
			responses: [ok({})],
		});
		assert.equal(del.http.calls[0].url, `${API_ROOT}/deleteMessage`);
		assert.deepEqual(del.output[0][0].json, { success: true });
	});
});

describe('Rubika node: chats and members', () => {
	it('maps chat and member operations to the documented methods', async () => {
		const cases: Array<[Record<string, unknown>, string, IDataObject]> = [
			[{ resource: 'chat', operation: 'get', chatId: 'c' }, 'getChat', { chat_id: 'c' }],
			[
				{ resource: 'chat', operation: 'setKeypad', chatId: 'c', chatKeypad: JSON.stringify(keypad) },
				'editChatKeypad',
				{ chat_id: 'c', chat_keypad_type: 'New', chat_keypad: keypad },
			],
			[
				{ resource: 'chat', operation: 'removeKeypad', chatId: 'c' },
				'editChatKeypad',
				{ chat_id: 'c', chat_keypad_type: 'Remove' },
			],
			[{ resource: 'chatMember', operation: 'ban', chatId: 'c', userId: 'u0x' }, 'banChatMember', { chat_id: 'c', user_id: 'u0x' }],
			[{ resource: 'chatMember', operation: 'unban', chatId: 'c', userId: 'u0x' }, 'unbanChatMember', { chat_id: 'c', user_id: 'u0x' }],
		];
		for (const [params, method, expected] of cases) {
			const { http } = await run({ params, responses: [ok({})] });
			assert.equal(http.calls[0].url, `${API_ROOT}/${method}`, method);
			assert.deepEqual(bodyOf(http.calls[0]), expected, method);
		}
	});

	it('returns the chat object', async () => {
		const chat = { chat_id: 'c', chat_type: 'Group', title: 'Team' };
		const { output } = await run({
			params: { resource: 'chat', operation: 'get', chatId: 'c' },
			responses: [ok({ chat })],
		});
		assert.deepEqual(output[0][0].json, { chat });
	});
});

describe('Rubika node: files', () => {
	const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff]);
	const binaries = { data: { meta: { data: '', mimeType: 'image/png', fileName: 'pic.png' }, data: png } };
	const sendParams = {
		resource: 'file',
		operation: 'send',
		chatId: 'c',
		fileType: 'Image',
		fileSource: 'binary',
		binaryPropertyName: 'data',
		fileName: '',
	};

	it('uploads binary data in three steps and sends the file', async () => {
		const { http, output } = await run({
			params: { ...sendParams, additionalFields: { caption: 'A picture', disableNotification: true } },
			binaries,
			responses: [
				ok({ upload_url: UPLOAD_URL }),
				{ body: { status: 'OK', data: { file_id: 'FILE-1' } } },
				ok({ message_id: '55' }),
			],
		});

		assert.equal(http.calls.length, 3);
		// step 1
		assert.equal(http.calls[0].url, `${API_ROOT}/requestSendFile`);
		assert.deepEqual(bodyOf(http.calls[0]), { type: 'Image' });
		// step 2
		assert.equal(http.calls[1].url, UPLOAD_URL);
		assert.equal(http.calls[1].method, 'POST');
		const contentType = (http.calls[1].headers as IDataObject)['Content-Type'] as string;
		assert.match(contentType, /^multipart\/form-data; boundary=----n8nRubikaBoundary/);
		const upload = http.calls[1].body as Buffer;
		assert.ok(Buffer.isBuffer(upload));
		assert.match(upload.toString('latin1'), /name="file"; filename="pic.png"\r\nContent-Type: image\/png\r\n\r\n/);
		assert.equal(upload.includes(png), true);
		// step 3
		assert.equal(http.calls[2].url, `${API_ROOT}/sendFile`);
		assert.deepEqual(bodyOf(http.calls[2]), {
			chat_id: 'c',
			file_id: 'FILE-1',
			disable_notification: true,
			text: 'A picture',
		});
		assert.deepEqual(output[0][0].json, { message_id: '55', file_id: 'FILE-1' });
	});

	it('accepts an upload answer without the envelope', async () => {
		const { output } = await run({
			params: { ...sendParams, additionalFields: {} },
			binaries,
			responses: [ok({ upload_url: UPLOAD_URL }), { body: { file_id: 'FLAT-1' } }, ok({ message_id: '56' })],
		});
		assert.deepEqual(output[0][0].json, { message_id: '56', file_id: 'FLAT-1' });
	});

	it('sends an already uploaded file with a single request', async () => {
		const { http } = await run({
			params: { resource: 'file', operation: 'send', chatId: 'c', fileType: 'File', fileSource: 'fileId', sendFileId: 'OLD-1', additionalFields: {} },
			responses: [ok({ message_id: '57' })],
		});
		assert.equal(http.calls.length, 1);
		assert.deepEqual(bodyOf(http.calls[0]), { chat_id: 'c', file_id: 'OLD-1' });
	});

	it('checks the size limit before any request is made', async () => {
		const huge = Buffer.alloc(10 * 1024 * 1024 + 1);
		await assert.rejects(
			run({
				params: { ...sendParams, additionalFields: {} },
				binaries: { data: { meta: { data: '', mimeType: 'image/jpeg', fileName: 'big.jpg' }, data: huge } },
				responses: [],
			}),
			(error: Error) => error instanceof NodeOperationError && /at most 10 MB/.test(error.message),
		);
	});

	it('explains upload failures and keeps the upload address out of messages', async () => {
		await assert.rejects(
			run({
				params: { ...sendParams, additionalFields: {} },
				binaries,
				responses: [ok({ upload_url: UPLOAD_URL }), { statusCode: 500, body: 'oops' }],
			}),
			(error: NodeApiError) => /File upload failed \(HTTP 500\)/.test(error.message),
		);
		await assert.rejects(
			run({
				params: { ...sendParams, additionalFields: {} },
				binaries,
				responses: [ok({ upload_url: UPLOAD_URL }), { error: new Error(`socket hang up for ${UPLOAD_URL}`) }],
			}),
			(error: NodeApiError) => {
				assert.match(error.message, /Could not reach the Rubika API/);
				assert.equal(error.message.includes(UPLOAD_URL), false);
				return true;
			},
		);
		await assert.rejects(
			run({ params: { ...sendParams, additionalFields: {} }, binaries, responses: [ok({})] }),
			(error: Error) => /did not return an upload_url/.test(error.message),
		);
		await assert.rejects(
			run({
				params: { ...sendParams, additionalFields: {} },
				binaries,
				responses: [ok({ upload_url: UPLOAD_URL }), fail('INVALID_INPUT')],
			}),
			(error: NodeApiError) => /File upload failed\. Rubika API error: INVALID_INPUT/.test(error.message),
		);
	});

	it('gets the download address and can download the file', async () => {
		const info = await run({
			params: { resource: 'file', operation: 'get', fileId: 'F1', download: false },
			responses: [ok({ download_url: 'https://cdn.rubika.example/f/report.pdf?sig=abc' })],
		});
		assert.equal(info.http.calls[0].url, `${API_ROOT}/getFile`);
		assert.deepEqual(info.output[0][0].json, {
			file_id: 'F1',
			download_url: 'https://cdn.rubika.example/f/report.pdf?sig=abc',
		});

		const content = Buffer.from('%PDF-1.4 fake');
		const downloaded = await run({
			params: { resource: 'file', operation: 'get', fileId: 'F1', download: true, downloadBinaryPropertyName: 'attachment' },
			responses: [
				ok({ download_url: 'https://cdn.rubika.example/f/report.pdf?sig=abc' }),
				{ body: content, headers: { 'Content-Type': 'application/pdf' } },
			],
		});
		assert.equal(downloaded.http.calls[1].method, 'GET');
		assert.equal(downloaded.http.calls[1].encoding, 'arraybuffer');
		const item = downloaded.output[0][0];
		assert.deepEqual(item.json, { file_id: 'F1' });
		assert.equal(item.binary?.attachment.fileName, 'report.pdf');
		assert.equal(item.binary?.attachment.mimeType, 'application/pdf');
		assert.equal(Buffer.from(item.binary?.attachment.data ?? '', 'base64').toString(), '%PDF-1.4 fake');

		await assert.rejects(
			run({
				params: { resource: 'file', operation: 'get', fileId: 'F1', download: true, downloadBinaryPropertyName: 'data' },
				responses: [ok({})],
			}),
			/did not return a download_url/,
		);
		await assert.rejects(
			run({
				params: { resource: 'file', operation: 'get', fileId: 'F1', download: true, downloadBinaryPropertyName: 'data' },
				responses: [ok({ download_url: 'https://cdn.rubika.example/x' }), { statusCode: 404, body: 'nope' }],
			}),
			/Could not download the file from Rubika \(HTTP 404\)/,
		);
	});
});

describe('Rubika node: batching and failures', () => {
	it('continues on fail and keeps item pairing', async () => {
		const { output } = await run({
			params: [
				{ resource: 'message', operation: 'sendText', chatId: 'c', text: 'one' },
				{ resource: 'message', operation: 'sendText', chatId: 'c', text: 'two' },
			],
			items: [{ json: {} }, { json: {} }],
			continueOnFail: true,
			responses: [fail('INVALID_INPUT'), ok({ message_id: '2' })],
		});
		assert.deepEqual(output[0][0], { json: { error: 'Rubika API error: INVALID_INPUT' }, pairedItem: { item: 0 } });
		assert.deepEqual(output[0][1], { json: { message_id: '2' }, pairedItem: { item: 1 } });
	});

	it('records the failing item index', async () => {
		await assert.rejects(
			run({
				params: [
					{ resource: 'message', operation: 'sendText', chatId: 'c', text: 'one' },
					{ resource: 'message', operation: 'sendText', chatId: 'c', text: 'two' },
				],
				items: [{ json: {} }, { json: {} }],
				responses: [ok({ message_id: '1' }), fail('TOO_MANY_REQUESTS')],
			}),
			(error: NodeApiError) => {
				assert.equal(error.context.itemIndex, 1);
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
			responses: [ok({ bot: {} }), ok({ bot: {} })],
		});
		assert.ok(Date.now() - started >= 55);
	});

	it('rejects unsupported operations', async () => {
		await assert.rejects(
			run({ params: { resource: 'chat', operation: 'explode' }, responses: [] }),
			(error: Error) => error instanceof NodeOperationError && /not supported/.test(error.message),
		);
	});
});
