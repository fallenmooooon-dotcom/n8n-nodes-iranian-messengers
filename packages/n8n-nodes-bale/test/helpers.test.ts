// eslint-disable-next-line @n8n/community-nodes/no-restricted-imports
import assert from 'node:assert/strict';
// eslint-disable-next-line @n8n/community-nodes/no-restricted-imports
import { describe, it } from 'node:test';

import {
	BaleValidationError,
	assertValidWebhookUrl,
	buildApiUrl,
	buildFileUrl,
	buildMultipart,
	describeApiError,
	getUpdateKind,
	normalizeBaseUrl,
	normalizeToken,
	parseChatId,
	parseJsonObject,
	pickMedia,
	redactSecret,
	requireHttpUrl,
	requirePositiveInteger,
	requireText,
} from '../nodes/Bale/helpers';

describe('token and URL helpers', () => {
	it('strips a leading "bot" prefix and whitespace', () => {
		assert.equal(normalizeToken('bot123:ABC'), '123:ABC');
		assert.equal(normalizeToken('  BOT123:ABC \n'), '123:ABC');
		assert.equal(normalizeToken('123:ABC'), '123:ABC');
	});

	it('rejects an empty token', () => {
		assert.throws(() => normalizeToken('   '), BaleValidationError);
		assert.throws(() => normalizeToken('bot'), BaleValidationError);
	});

	it('normalises the base URL', () => {
		assert.equal(normalizeBaseUrl(undefined), 'https://tapi.bale.ai');
		assert.equal(normalizeBaseUrl(''), 'https://tapi.bale.ai');
		assert.equal(normalizeBaseUrl('https://proxy.example.com///'), 'https://proxy.example.com');
	});

	it('builds API and file URLs', () => {
		assert.equal(buildApiUrl(undefined, 'bot1:A', 'getMe'), 'https://tapi.bale.ai/bot1:A/getMe');
		assert.equal(
			buildFileUrl(undefined, '1:A', '/documents/my file.pdf'),
			'https://tapi.bale.ai/file/bot1:A/documents/my%20file.pdf',
		);
	});

	it('redacts secrets', () => {
		assert.equal(redactSecret('GET /bot1:A/getMe failed for 1:A', '1:A'), 'GET /bot***/getMe failed for ***');
		assert.equal(redactSecret('nothing to hide', ''), 'nothing to hide');
	});
});

describe('error descriptions', () => {
	it('adds a hint for documented status codes', () => {
		const described = describeApiError(429, 'Too Many Requests');
		assert.equal(described.message, 'Bale API error 429: Too Many Requests');
		assert.match(described.hint ?? '', /Delay Between Items/);
	});

	it('copes with missing details', () => {
		assert.deepEqual(describeApiError(undefined, undefined), {
			message: 'Bale API error: Unknown error',
			hint: undefined,
		});
	});
});

describe('input validation', () => {
	it('turns numeric chat IDs into numbers and keeps usernames', () => {
		assert.equal(parseChatId(' 12345 '), 12345);
		assert.equal(parseChatId('-100200'), -100200);
		assert.equal(parseChatId('@my_channel'), '@my_channel');
		assert.equal(parseChatId('99999999999999999999'), '99999999999999999999');
		assert.throws(() => parseChatId(' '), BaleValidationError);
	});

	it('validates text length by characters', () => {
		assert.equal(requireText('hi', 'Text', 4096), 'hi');
		assert.throws(() => requireText('   ', 'Text', 4096), /must not be empty/);
		assert.throws(() => requireText('a'.repeat(4097), 'Text', 4096), /maximum is 4096/);
		// 4096 emoji are 4096 characters even though they use 2 UTF-16 units each.
		assert.equal(requireText('😀'.repeat(4096), 'Text', 4096).length, 8192);
	});

	it('validates positive integers', () => {
		assert.equal(requirePositiveInteger(5, 'ID'), 5);
		assert.equal(requirePositiveInteger('7', 'ID'), 7);
		assert.throws(() => requirePositiveInteger(0, 'ID'), BaleValidationError);
		assert.throws(() => requirePositiveInteger(1.5, 'ID'), BaleValidationError);
	});

	it('parses JSON objects only', () => {
		assert.deepEqual(parseJsonObject('{"a":1}', 'Markup'), { a: 1 });
		assert.deepEqual(parseJsonObject({ a: 1 }, 'Markup'), { a: 1 });
		assert.throws(() => parseJsonObject('{oops', 'Markup'), /not valid JSON/);
		assert.throws(() => parseJsonObject('[1]', 'Markup'), /must be a JSON object/);
	});

	it('accepts only absolute http(s) URLs', () => {
		assert.equal(requireHttpUrl('https://example.com/a.png', 'URL'), 'https://example.com/a.png');
		assert.throws(() => requireHttpUrl('ftp://example.com/a.png', 'URL'), BaleValidationError);
		assert.throws(() => requireHttpUrl('example.com/a.png', 'URL'), BaleValidationError);
	});
});

describe('webhook URL validation', () => {
	it('accepts https on the default port and on 443 or 88', () => {
		assert.doesNotThrow(() => assertValidWebhookUrl('https://n8n.example.com/webhook/abc/webhook'));
		assert.doesNotThrow(() => assertValidWebhookUrl('https://n8n.example.com:443/webhook/abc'));
		assert.doesNotThrow(() => assertValidWebhookUrl('https://n8n.example.com:88/webhook/abc'));
	});

	it('rejects http, missing URLs and other ports', () => {
		assert.throws(() => assertValidWebhookUrl('http://n8n.example.com/webhook'), /HTTPS/);
		assert.throws(() => assertValidWebhookUrl(undefined), /HTTPS/);
		assert.throws(() => assertValidWebhookUrl('https://n8n.example.com:5678/webhook'), /port 5678/);
	});
});

describe('multipart builder', () => {
	it('encodes fields and files with a boundary that does not occur in the data', () => {
		const file = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x0d, 0x0a]);
		const { body, contentType } = buildMultipart(
			{ chat_id: 42, caption: 'سلام "quoted"', reply_markup: { inline_keyboard: [] }, skipped: undefined },
			[{ fieldName: 'photo', fileName: 'a"b.png', contentType: 'image/png', data: file }],
		);

		const boundary = /boundary=(.+)$/.exec(contentType)?.[1];
		assert.ok(boundary, 'content type carries a boundary');
		assert.equal(body.includes(boundary), true);
		assert.equal(file.includes(boundary), false);

		const text = body.toString('latin1');
		assert.match(text, /name="chat_id"\r\n\r\n42\r\n/);
		assert.match(text, /name="reply_markup"\r\n\r\n\{"inline_keyboard":\[\]\}\r\n/);
		assert.match(text, /name="photo"; filename="a%22b.png"\r\nContent-Type: image\/png\r\n\r\n/);
		assert.equal(text.includes('skipped'), false);
		assert.equal(body.includes(file), true);
		assert.ok(text.endsWith(`--${boundary}--\r\n`));
		// Non-ASCII field values are sent as UTF-8.
		assert.equal(body.includes(Buffer.from('سلام "quoted"', 'utf8')), true);
	});
});

describe('update helpers', () => {
	it('detects the update kind', () => {
		assert.equal(getUpdateKind({ update_id: 1, message: {} }), 'message');
		assert.equal(getUpdateKind({ update_id: 1, edited_message: {} }), 'edited_message');
		assert.equal(getUpdateKind({ update_id: 1, channel_post: {} }), 'channel_post');
		assert.equal(getUpdateKind({ update_id: 1, edited_channel_post: {} }), 'edited_channel_post');
		assert.equal(getUpdateKind({ update_id: 1, callback_query: {} }), 'callback_query');
		assert.equal(getUpdateKind({ update_id: 1, pre_checkout_query: {} }), 'pre_checkout_query');
		assert.equal(getUpdateKind({ update_id: 1 }), undefined);
	});

	it('picks the largest photo and other media kinds', () => {
		assert.deepEqual(
			pickMedia({
				photo: [
					{ file_id: 'small', width: 90, height: 90, file_size: 1000 },
					{ file_id: 'large', width: 800, height: 800, file_size: 90000 },
					{ file_id: 'medium', width: 320, height: 320, file_size: 20000 },
				],
			}),
			{ kind: 'photo', fileId: 'large', fileName: undefined, fileSize: 90000 },
		);
		assert.deepEqual(pickMedia({ document: { file_id: 'doc1', file_name: 'a.pdf', file_size: 12 } }), {
			kind: 'document',
			fileId: 'doc1',
			fileName: 'a.pdf',
			fileSize: 12,
		});
		assert.equal(pickMedia({ text: 'just text' }), undefined);
		assert.equal(pickMedia({ photo: [] }), undefined);
	});
});
