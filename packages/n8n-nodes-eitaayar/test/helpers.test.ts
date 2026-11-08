// eslint-disable-next-line @n8n/community-nodes/no-restricted-imports
import assert from 'node:assert/strict';
// eslint-disable-next-line @n8n/community-nodes/no-restricted-imports
import { describe, it } from 'node:test';

import {
	EitaaValidationError,
	buildApiUrl,
	buildMultipart,
	buildSendFields,
	describeApiError,
	normalizeBaseUrl,
	normalizeToken,
	parseEnvelope,
	redactSecret,
	requirePositiveInteger,
	toUnixSeconds,
} from '../nodes/EitaaYar/helpers';

const TOKEN = '123:aaaa-bbbb';

describe('token and URL helpers', () => {
	it('accepts the token with or without the dashboard prefix, and pasted URLs', () => {
		assert.equal(normalizeToken(TOKEN), TOKEN);
		assert.equal(normalizeToken(`bot${TOKEN}`), TOKEN);
		assert.equal(normalizeToken(`  BOT${TOKEN} \n`), TOKEN);
		assert.equal(normalizeToken(`https://eitaayar.ir/api/bot${TOKEN}/sendMessage`), TOKEN);
	});

	it('rejects an empty token', () => {
		assert.throws(() => normalizeToken('  '), EitaaValidationError);
		assert.throws(() => normalizeToken('bot'), EitaaValidationError);
	});

	it('builds API URLs with exactly one bot prefix', () => {
		assert.equal(normalizeBaseUrl(undefined), 'https://eitaayar.ir/api');
		assert.equal(normalizeBaseUrl('https://eitaayar.ir/'), 'https://eitaayar.ir/api');
		assert.equal(normalizeBaseUrl('https://proxy.example.com/api//'), 'https://proxy.example.com/api');
		assert.equal(buildApiUrl(undefined, `bot${TOKEN}`, 'getMe'), `https://eitaayar.ir/api/bot${TOKEN}/getMe`);
		assert.equal(buildApiUrl(undefined, TOKEN, 'sendFile'), `https://eitaayar.ir/api/bot${TOKEN}/sendFile`);
	});

	it('redacts secrets', () => {
		assert.equal(redactSecret(`failed for /bot${TOKEN}/getMe`, TOKEN), 'failed for /bot***/getMe');
		assert.equal(redactSecret('nothing', ''), 'nothing');
	});
});

describe('response envelope', () => {
	it('returns the result object, or the other fields when there is none', () => {
		assert.deepEqual(parseEnvelope({ ok: true, result: { message_id: 5 } }), {
			kind: 'ok',
			data: { message_id: 5 },
		});
		assert.deepEqual(parseEnvelope({ ok: true }), { kind: 'ok', data: {} });
		assert.deepEqual(parseEnvelope({ ok: true, result: true }), { kind: 'ok', data: {} });
		assert.deepEqual(parseEnvelope({ ok: true, message: 'sent', id: 7 }), {
			kind: 'ok',
			data: { message: 'sent', id: 7 },
		});
		assert.deepEqual(parseEnvelope({ ok: true, result: 'queued' }), { kind: 'ok', data: { result: 'queued' } });
	});

	it('finds the error text in the usual fields', () => {
		assert.deepEqual(parseEnvelope({ ok: false, description: 'bad chat' }), { kind: 'error', description: 'bad chat' });
		assert.deepEqual(parseEnvelope({ ok: false, message: 'denied' }), { kind: 'error', description: 'denied' });
		assert.deepEqual(parseEnvelope({ ok: false, error: 'oops' }), { kind: 'error', description: 'oops' });
		assert.deepEqual(parseEnvelope({ ok: false }), { kind: 'error', description: undefined });
	});

	it('does not recognise other bodies', () => {
		assert.deepEqual(parseEnvelope('<html>'), { kind: 'unknown' });
		assert.deepEqual(parseEnvelope({ status: 'OK' }), { kind: 'unknown' });
		assert.deepEqual(parseEnvelope(null), { kind: 'unknown' });
	});

	it('describes failures', () => {
		assert.equal(describeApiError('bad chat', 400).message, 'EitaaYar API error: bad chat');
		assert.equal(describeApiError(undefined, 403).message, 'EitaaYar API error: HTTP 403');
	});
});

describe('send options', () => {
	it('converts dates to Unix seconds', () => {
		const expected = Math.floor(Date.UTC(2026, 11, 1, 10, 0, 0) / 1000);
		assert.equal(toUnixSeconds('2026-12-01T10:00:00Z'), expected);
		assert.equal(toUnixSeconds(String(expected)), expected);
		assert.equal(toUnixSeconds(expected), expected);
		assert.throws(() => toUnixSeconds('next tuesday'), /not a valid date/);
	});

	it('sends flags as 1 and skips unset fields', () => {
		assert.deepEqual(buildSendFields({}), {});
		assert.deepEqual(
			buildSendFields({
				title: '  Promo  ',
				pin: true,
				disableNotification: true,
				replyToMessageId: 12,
				scheduleDate: '1790000000',
				viewCountForDelete: 500,
			}),
			{
				title: 'Promo',
				pin: 1,
				disable_notification: 1,
				reply_to_message_id: 12,
				date: 1790000000,
				viewCountForDelete: 500,
			},
		);
		assert.deepEqual(
			buildSendFields({ title: ' ', pin: false, disableNotification: false, replyToMessageId: 0, scheduleDate: '', viewCountForDelete: 0 }),
			{},
		);
	});

	it('validates whole numbers', () => {
		assert.equal(requirePositiveInteger('7', 'ID'), 7);
		assert.throws(() => requirePositiveInteger(1.5, 'ID'), EitaaValidationError);
		assert.throws(() => buildSendFields({ viewCountForDelete: 2.5 }), /Delete After Views/);
	});
});

describe('multipart builder', () => {
	it('encodes fields and the file with a boundary that does not occur in the data', () => {
		const file = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x00, 0xff, 0x0d, 0x0a]);
		const { body, contentType } = buildMultipart({ chat_id: '@news', caption: 'سلام', pin: 1, skipped: undefined }, [
			{ fieldName: 'file', fileName: 'anim.gif', contentType: 'image/gif', data: file },
		]);
		const boundary = /boundary=(.+)$/.exec(contentType)?.[1];
		assert.ok(boundary);
		assert.equal(file.includes(boundary), false);
		const text = body.toString('latin1');
		assert.match(text, /name="chat_id"\r\n\r\n@news\r\n/);
		assert.match(text, /name="pin"\r\n\r\n1\r\n/);
		assert.match(text, /name="file"; filename="anim.gif"\r\nContent-Type: image\/gif\r\n\r\n/);
		assert.equal(text.includes('skipped'), false);
		assert.equal(body.includes(Buffer.from('سلام', 'utf8')), true);
		assert.ok(text.endsWith(`--${boundary}--\r\n`));
	});
});
