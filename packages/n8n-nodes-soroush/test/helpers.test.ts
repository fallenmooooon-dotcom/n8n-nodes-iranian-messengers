// eslint-disable-next-line @n8n/community-nodes/no-restricted-imports
import assert from 'node:assert/strict';
// eslint-disable-next-line @n8n/community-nodes/no-restricted-imports
import { describe, it } from 'node:test';

import {
	SoroushValidationError,
	assertValidWebhookUrl,
	buildApiUrl,
	buildFileUrl,
	buildMiniAppInlineButton,
	buildMiniAppReplyButton,
	describeApiError,
	getUpdateKind,
	normalizeBaseUrl,
	normalizeToken,
	parseChatId,
	redactSecret,
} from '../nodes/Soroush/helpers';

describe('token and URL helpers', () => {
	it('normalises token and base URL', () => {
		assert.equal(normalizeToken('  123:ABC  '), '123:ABC');
		assert.equal(normalizeToken('bot123:ABC'), '123:ABC');
		assert.throws(() => normalizeToken('   '), SoroushValidationError);

		assert.equal(normalizeBaseUrl(undefined), 'https://api.splus.ir');
		assert.equal(normalizeBaseUrl('https://api.splus.ir//'), 'https://api.splus.ir');
		assert.equal(buildApiUrl(undefined, '123:ABC', 'getMe'), 'https://api.splus.ir/bot123:ABC/getMe');
		assert.equal(
			buildFileUrl(undefined, '123:ABC', 'photos/file_1.jpg'),
			'https://api.splus.ir/file/bot123:ABC/photos/file_1.jpg',
		);
	});

	it('redacts secrets from texts and logs', () => {
		assert.equal(
			redactSecret('Call failed on https://api.splus.ir/bot123:ABC/getMe', '123:ABC'),
			'Call failed on https://api.splus.ir/bot***/getMe',
		);
	});
});

describe('validation and error helpers', () => {
	it('parses chat ID', () => {
		assert.equal(parseChatId('12345'), 12345);
		assert.equal(parseChatId('-100123'), -100123);
		assert.equal(parseChatId('@mychannel'), '@mychannel');
		assert.throws(() => parseChatId('  '), SoroushValidationError);
	});

	it('describes API error codes', () => {
		const err401 = describeApiError(401, 'Unauthorized');
		assert.match(err401.message, /401/);
		assert.match(err401.hint ?? '', /token/i);

		const err429 = describeApiError(429, 'Too many requests');
		assert.match(err429.hint ?? '', /Delay Between Items/i);
	});

	it('asserts webhook URL is HTTPS', () => {
		assert.doesNotThrow(() => assertValidWebhookUrl('https://example.com/webhook'));
		assert.throws(() => assertValidWebhookUrl('http://example.com/webhook'), SoroushValidationError);
		assert.throws(() => assertValidWebhookUrl(''), SoroushValidationError);
	});
});

describe('Mini App keyboard builders', () => {
	it('builds inline Mini App button structure', () => {
		const markup = buildMiniAppInlineButton('Open App', 'https://app.example.com');
		assert.deepEqual(markup, {
			inline_keyboard: [
				[
					{
						text: 'Open App',
						web_app: { url: 'https://app.example.com' },
					},
				],
			],
		});
	});

	it('builds reply keyboard Mini App button structure', () => {
		const markup = buildMiniAppReplyButton('Launch', 'https://app.example.com');
		assert.deepEqual(markup, {
			keyboard: [
				[
					{
						text: 'Launch',
						web_app: { url: 'https://app.example.com' },
					},
				],
			],
			resize_keyboard: true,
		});
	});
});

describe('update detection', () => {
	it('identifies message, callback_query and web_app_data', () => {
		assert.equal(getUpdateKind({ message: { text: 'hi' } }), 'message');
		assert.equal(getUpdateKind({ callback_query: { id: '1' } }), 'callback_query');
		assert.equal(
			getUpdateKind({
				message: {
					web_app_data: { data: 'order_123', button_text: 'Buy' },
				},
			}),
			'web_app_data',
		);
		assert.equal(getUpdateKind({ unknown: {} }), undefined);
	});
});
