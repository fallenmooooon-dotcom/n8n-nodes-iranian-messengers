import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	RubikaValidationError,
	assertFileSize,
	assertHttpsUrl,
	buildApiUrl,
	buildMetadata,
	buildMultipart,
	describeApiError,
	fileNameFromUrl,
	needsReceiveUpdate,
	normalizeBaseUrl,
	normalizeToken,
	normalizeWebhookBody,
	parseCoordinate,
	parseEnvelope,
	redactSecret,
	rememberKeys,
	updateKey,
	validateKeypad,
} from '../nodes/Rubika/helpers';

describe('token and URL helpers', () => {
	it('trims the token and extracts it from a pasted API URL', () => {
		assert.equal(normalizeToken('  ABC123  '), 'ABC123');
		assert.equal(normalizeToken('https://botapi.rubika.ir/v3/ABC123/getMe'), 'ABC123');
		assert.equal(normalizeToken('/ABC123/'), 'ABC123');
	});

	it('rejects an empty token', () => {
		assert.throws(() => normalizeToken('  '), RubikaValidationError);
		assert.throws(() => normalizeToken('//'), RubikaValidationError);
	});

	it('normalises the base URL and builds API URLs', () => {
		assert.equal(normalizeBaseUrl(undefined), 'https://botapi.rubika.ir/v3');
		assert.equal(normalizeBaseUrl('https://proxy.example.com/v3//'), 'https://proxy.example.com/v3');
		assert.equal(buildApiUrl(undefined, 'TOK', 'getMe'), 'https://botapi.rubika.ir/v3/TOK/getMe');
	});

	it('redacts secrets', () => {
		assert.equal(redactSecret('POST /v3/TOK/getMe failed (TOK)', 'TOK'), 'POST /v3/***/getMe failed (***)');
		assert.equal(redactSecret('nothing', ''), 'nothing');
	});
});

describe('response envelope', () => {
	it('recognises success, errors and unknown bodies', () => {
		assert.deepEqual(parseEnvelope({ status: 'OK', data: { message_id: '1' } }), {
			kind: 'ok',
			data: { message_id: '1' },
		});
		assert.deepEqual(parseEnvelope({ status: 'OK' }), { kind: 'ok', data: {} });
		assert.deepEqual(parseEnvelope({ status: 'ERROR_GENERIC', status_det: 'INVALID_AUTH' }), {
			kind: 'error',
			status: 'ERROR_GENERIC',
			statusDet: 'INVALID_AUTH',
		});
		assert.deepEqual(parseEnvelope({ ok: true, result: {} }), { kind: 'unknown' });
		assert.deepEqual(parseEnvelope('<html>'), { kind: 'unknown' });
		assert.deepEqual(parseEnvelope(null), { kind: 'unknown' });
	});

	it('describes the documented error codes', () => {
		assert.match(describeApiError('ERROR_GENERIC', 'INVALID_AUTH').hint ?? '', /token/);
		assert.match(describeApiError('INVALID_ACCESS', undefined).hint ?? '', /token/);
		assert.match(describeApiError('ERROR_GENERIC', 'INVALID_INPUT').hint ?? '', /parameter/);
		assert.match(describeApiError('ERROR_GENERIC', 'TOO_MANY_REQUESTS').hint ?? '', /Delay Between Items/);
		assert.match(describeApiError('TOO_REQUESTS', undefined).hint ?? '', /Delay Between Items/);
		assert.deepEqual(describeApiError('ERROR_GENERIC', 'SOMETHING_NEW'), {
			message: 'Rubika API error: SOMETHING_NEW',
			hint: undefined,
		});
		assert.equal(describeApiError('FAILED', undefined).message, 'Rubika API error: FAILED');
	});
});

describe('validation', () => {
	it('formats coordinates as strings and checks the range', () => {
		assert.equal(parseCoordinate(35.6892, 'Latitude', 90), '35.6892');
		assert.equal(parseCoordinate('51.389', 'Longitude', 180), '51.389');
		assert.throws(() => parseCoordinate(91, 'Latitude', 90), /between -90 and 90/);
		assert.throws(() => parseCoordinate('abc', 'Longitude', 180), RubikaValidationError);
	});

	it('requires https webhook addresses', () => {
		assert.doesNotThrow(() => assertHttpsUrl('https://n8n.example.com/webhook/x/webhook'));
		assert.doesNotThrow(() => assertHttpsUrl('https://n8n.example.com:8443/webhook/x'));
		assert.throws(() => assertHttpsUrl('http://n8n.example.com/webhook/x'), /HTTPS/);
		assert.throws(() => assertHttpsUrl(undefined), /HTTPS/);
	});

	it('checks the documented upload limits per file type', () => {
		assert.doesNotThrow(() => assertFileSize('Image', 10 * 1024 * 1024));
		assert.throws(() => assertFileSize('Image', 10 * 1024 * 1024 + 1), /at most 10 MB/);
		assert.throws(() => assertFileSize('File', 50 * 1024 * 1024 + 1), /at most 50 MB/);
		assert.throws(() => assertFileSize('Video', 50 * 1024 * 1024 + 1), /at most 50 MB/);
		assert.doesNotThrow(() => assertFileSize('Music', 500 * 1024 * 1024));
	});

	it('takes file names from download URLs', () => {
		assert.equal(fileNameFromUrl('https://cdn.example.com/a/b/photo%201.jpg?sig=1', 'x'), 'photo 1.jpg');
		assert.equal(fileNameFromUrl('https://cdn.example.com/', 'fallback'), 'fallback');
	});
});

describe('keypads', () => {
	const valid = {
		rows: [
			{ buttons: [{ id: '100', type: 'Simple', button_text: 'Add' }] },
			{ buttons: [{ id: '101', type: 'Link', button_text: 'Open' }] },
		],
		resize_keyboard: true,
	};

	it('accepts a documented keypad as object or JSON', () => {
		assert.deepEqual(validateKeypad(valid, 'Keypad'), valid);
		assert.deepEqual(validateKeypad(JSON.stringify(valid), 'Keypad'), valid);
	});

	it('explains what is wrong', () => {
		assert.throws(() => validateKeypad('{oops', 'Keypad'), /not valid JSON/);
		assert.throws(() => validateKeypad({}, 'Keypad'), /"rows"/);
		assert.throws(() => validateKeypad({ rows: [{}] }, 'Keypad'), /row 1 needs a non-empty "buttons"/);
		assert.throws(
			() => validateKeypad({ rows: [{ buttons: [{ type: 'Simple' }] }] }, 'Keypad'),
			/button 1 in row 1 needs a string "id"/,
		);
		assert.throws(
			() => validateKeypad({ rows: [{ buttons: [{ id: '1', type: 'Fancy' }] }] }, 'Keypad'),
			/unknown "type"/,
		);
	});
});

describe('formatting metadata', () => {
	it('builds API parts with UTF-16 indices', () => {
		const text = 'سلام کاربر عزیز!';
		assert.deepEqual(
			buildMetadata(text, [
				{ type: 'Bold', fromIndex: 0, length: text.length },
				{ type: 'MentionText', fromIndex: 5, length: 5, mentionUserId: 'u0abc' },
				{ type: 'Link', fromIndex: 11, length: 4, linkUrl: ' https://example.com ' },
			]),
			{
				meta_data_parts: [
					{ type: 'Bold', from_index: 0, length: text.length },
					{ type: 'MentionText', from_index: 5, length: 5, mention_text_user_id: 'u0abc' },
					{ type: 'Link', from_index: 11, length: 4, link_url: 'https://example.com' },
				],
			},
		);
	});

	it('counts emoji as two units and rejects ranges outside the text', () => {
		assert.doesNotThrow(() => buildMetadata('😀', [{ type: 'Bold', fromIndex: 0, length: 2 }]));
		assert.throws(() => buildMetadata('😀', [{ type: 'Bold', fromIndex: 0, length: 3 }]), /UTF-16 units/);
		assert.throws(() => buildMetadata('abc', [{ type: 'Bold', fromIndex: 2, length: 2 }]), /reaches position 4/);
	});

	it('rejects invalid parts before Rubika does', () => {
		const bold = { type: 'Bold', fromIndex: 0, length: 1 };
		assert.throws(() => buildMetadata('abc', [{ ...bold, type: 'Rainbow' }]), /unknown type/);
		assert.throws(() => buildMetadata('abc', [{ ...bold, fromIndex: -1 }]), /From Index/);
		assert.throws(() => buildMetadata('abc', [{ ...bold, length: 0 }]), /Length/);
		assert.throws(() => buildMetadata('abc', [{ ...bold, type: 'Link' }]), /Link URL/);
		assert.throws(() => buildMetadata('abc', [{ ...bold, type: 'MentionText' }]), /Mention User ID/);
		assert.throws(() => buildMetadata('a'.repeat(40), Array(31).fill(bold)), /at most 30/);
	});
});

describe('multipart builder', () => {
	it('encodes the file field with a boundary that does not occur in the data', () => {
		const file = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x0d, 0x0a]);
		const { body, contentType } = buildMultipart({}, [
			{ fieldName: 'file', fileName: 'a"b.png', contentType: 'image/png', data: file },
		]);
		const boundary = /boundary=(.+)$/.exec(contentType)?.[1];
		assert.ok(boundary);
		assert.equal(file.includes(boundary), false);
		const text = body.toString('latin1');
		assert.match(text, /name="file"; filename="a%22b.png"\r\nContent-Type: image\/png\r\n\r\n/);
		assert.equal(body.includes(file), true);
		assert.ok(text.endsWith(`--${boundary}--\r\n`));
	});
});

describe('update helpers', () => {
	it('normalises webhook bodies', () => {
		const update = { type: 'NewMessage', chat_id: 'b0x', new_message: { message_id: '1', text: 'hi' } };
		assert.deepEqual(normalizeWebhookBody({ update }), update);
		assert.deepEqual(
			normalizeWebhookBody({
				inline_message: { chat_id: 'b0x', message_id: '2', sender_id: 'u0y', aux_data: { button_id: '100' } },
			}),
			{
				type: 'InlineMessage',
				chat_id: 'b0x',
				inline_message: { chat_id: 'b0x', message_id: '2', sender_id: 'u0y', aux_data: { button_id: '100' } },
			},
		);
		assert.equal(normalizeWebhookBody({ something: 'else' }), undefined);
		assert.equal(normalizeWebhookBody({ update: { no: 'type' } }), undefined);
	});

	it('decides which endpoints are needed', () => {
		assert.equal(needsReceiveUpdate(['NewMessage']), true);
		assert.equal(needsReceiveUpdate(['InlineMessage']), false);
		assert.equal(needsReceiveUpdate(['InlineMessage', 'StartedBot']), true);
	});

	it('builds stable keys and keeps only the newest ones', () => {
		const a = { type: 'NewMessage', chat_id: 'c1', new_message: { message_id: '5', time: '100' } };
		const b = { type: 'NewMessage', chat_id: 'c1', new_message: { message_id: '6', time: '100' } };
		assert.equal(updateKey(a), updateKey({ ...a }));
		assert.notEqual(updateKey(a), updateKey(b));
		assert.deepEqual(rememberKeys(['1', '2', '3'], ['4', '5'], 3), ['3', '4', '5']);
	});
});
