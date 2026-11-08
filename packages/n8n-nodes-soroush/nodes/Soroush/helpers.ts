/**
 * Pure helper functions for the Soroush Plus nodes.
 *
 * Nothing in this file needs the n8n runtime or restricted Node built-in
 * modules, which keeps every helper unit-testable and compliant with n8n
 * verified community node lint rules.
 */
import type { IDataObject } from 'n8n-workflow';

/** Default Soroush Plus Bot API host. */
export const DEFAULT_BASE_URL = 'https://api.splus.ir';

/** Documented limits of the Soroush Plus Bot API. */
export const MAX_TEXT_LENGTH = 4096;
export const MAX_CAPTION_LENGTH = 1024;
/** Upload limit for photos (10 MB). */
export const MAX_UPLOAD_PHOTO_BYTES = 10 * 1024 * 1024;
/** Upload limit for other media types (50 MB). */
export const MAX_UPLOAD_FILE_BYTES = 50 * 1024 * 1024;
/** Download limit of `getFile` (20 MB). */
export const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;
/** Soroush Plus delivers webhooks only to these HTTPS ports. */
export const WEBHOOK_PORTS = [443, 80, 88, 8443];

/** Thrown for invalid user input; the nodes turn it into a NodeOperationError. */
export class SoroushValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SoroushValidationError';
	}
}

/* -------------------------------------------------------------------------- */
/*  Credentials and URLs                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Trims the token and removes an accidental leading `bot` prefix, so both
 * `123:ABC` and `bot123:ABC` work.
 */
export function normalizeToken(raw: string): string {
	const token = (raw ?? '').trim().replace(/^bot/i, '');
	if (token === '') {
		throw new SoroushValidationError('The Soroush Plus access token is empty');
	}
	return token;
}

/** Removes trailing slashes; falls back to the default host when empty. */
export function normalizeBaseUrl(raw?: string): string {
	const baseUrl = (raw ?? '').trim().replace(/\/+$/, '');
	return baseUrl === '' ? DEFAULT_BASE_URL : baseUrl;
}

/** Builds `<base>/bot<token>/<method>`. */
export function buildApiUrl(baseUrl: string | undefined, token: string, method: string): string {
	return `${normalizeBaseUrl(baseUrl)}/bot${normalizeToken(token)}/${method}`;
}

/** Builds the download URL `<base>/file/bot<token>/<file_path>` returned by getFile. */
export function buildFileUrl(
	baseUrl: string | undefined,
	token: string,
	filePath: string,
): string {
	const encodedPath = filePath
		.replace(/^\/+/, '')
		.split('/')
		.map((segment) => encodeURIComponent(segment))
		.join('/');
	return `${normalizeBaseUrl(baseUrl)}/file/bot${normalizeToken(token)}/${encodedPath}`;
}

/** Replaces every occurrence of a secret in a text so it never reaches logs or UI. */
export function redactSecret(text: string, secret: string): string {
	if (secret === '') {
		return text;
	}
	return text.split(secret).join('***');
}

/* -------------------------------------------------------------------------- */
/*  Errors                                                                    */
/* -------------------------------------------------------------------------- */

const ERROR_HINTS: Record<number, string> = {
	400: 'Bad Request: check the parameters, for example the chat ID, message ID, or keyboard structure.',
	401: 'Unauthorized: the bot token is invalid or was revoked. Check the Soroush Plus credential.',
	403: 'Forbidden: the bot lacks permission in this chat, or the user blocked the bot.',
	404: 'Not Found: the method, chat, or message does not exist.',
	429: 'Too Many Requests: request limit exceeded. Use the "Delay Between Items" option or enable "Retry On Fail".',
};

/** Builds a readable message plus an optional hint for a failed Soroush response. */
export function describeApiError(
	errorCode: number | undefined,
	description: string | undefined,
	retryAfter?: number,
): { message: string; hint?: string } {
	const detail = description !== undefined && description !== '' ? description : 'Unknown error';
	const prefix =
		errorCode !== undefined ? `Soroush Plus API error ${errorCode}` : 'Soroush Plus API error';
	let hint = errorCode !== undefined ? ERROR_HINTS[errorCode] : undefined;
	if (typeof retryAfter === 'number' && retryAfter > 0) {
		const retryNote = `Retry after ${retryAfter} seconds.`;
		hint = hint !== undefined ? `${hint} ${retryNote}` : retryNote;
	}
	return {
		message: `${prefix}: ${detail}`,
		hint,
	};
}

/* -------------------------------------------------------------------------- */
/*  Input validation                                                          */
/* -------------------------------------------------------------------------- */

/** Accepts numeric chat IDs and `@channelusername`; numeric strings become numbers. */
export function parseChatId(value: string): string | number {
	const trimmed = (value ?? '').trim();
	if (trimmed === '') {
		throw new SoroushValidationError('Chat ID must not be empty');
	}
	if (/^-?\d+$/.test(trimmed)) {
		const numeric = Number(trimmed);
		if (Number.isSafeInteger(numeric)) {
			return numeric;
		}
	}
	return trimmed;
}

/** Returns the trimmed value or throws when it is empty. */
export function requireNonEmpty(value: string, label: string): string {
	const trimmed = (value ?? '').trim();
	if (trimmed === '') {
		throw new SoroushValidationError(`${label} must not be empty`);
	}
	return trimmed;
}

/** Checks that a text is not blank and not longer than `max` characters. */
export function requireText(value: string, label: string, max: number): string {
	const text = value ?? '';
	if (text.trim() === '') {
		throw new SoroushValidationError(`${label} must not be empty`);
	}
	validateLength(text, max, label);
	return text;
}

/** Throws when `value` has more than `max` characters. */
export function validateLength(value: string, max: number, label: string): void {
	const length = Array.from(value).length;
	if (length > max) {
		throw new SoroushValidationError(`${label} is ${length} characters long; the maximum is ${max}`);
	}
}

/** Validates a positive integer ID such as a message ID or user ID. */
export function requirePositiveInteger(value: unknown, label: string): number {
	const numeric = typeof value === 'number' ? value : Number(value);
	if (!Number.isInteger(numeric) || numeric <= 0) {
		throw new SoroushValidationError(`${label} must be a positive whole number`);
	}
	return numeric;
}

/** Accepts a JSON string or an object and returns a plain object. */
export function parseJsonObject(value: unknown, label: string): Record<string, unknown> {
	let parsed: unknown = value;
	if (typeof value === 'string') {
		let parseFailed = false;
		try {
			parsed = JSON.parse(value);
		} catch {
			parseFailed = true;
		}
		if (parseFailed) {
			throw new SoroushValidationError(`${label} is not valid JSON`);
		}
	}
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new SoroushValidationError(`${label} must be a JSON object`);
	}
	return parsed as Record<string, unknown>;
}

/** Validates that a media URL is an absolute http(s) URL. */
export function requireHttpUrl(value: string, label: string): string {
	const url = requireNonEmpty(value, label);
	if (!/^https?:\/\/\S+$/i.test(url)) {
		throw new SoroushValidationError(`${label} must be an absolute http(s) URL`);
	}
	return url;
}

/**
 * Soroush Plus requires an HTTPS URL on ports 443, 80, 88, or 8443 for webhooks.
 */
export function assertValidWebhookUrl(url: string | undefined): void {
	const match = /^(https?):\/\/([^/?#:]+)(?::(\d+))?(?:[/?#]|$)/i.exec(url ?? '');
	if (match === null || match[1].toLowerCase() !== 'https') {
		throw new SoroushValidationError(
			'Soroush Plus only delivers webhooks to HTTPS URLs. Ensure n8n is reachable over HTTPS and set the WEBHOOK_URL environment variable accordingly.',
		);
	}
	const port = match[3] !== undefined ? Number(match[3]) : 443;
	if (!WEBHOOK_PORTS.includes(port)) {
		throw new SoroushValidationError(
			`Soroush Plus only delivers webhooks to ports ${WEBHOOK_PORTS.join(', ')}, but the n8n webhook URL uses port ${port}. Expose n8n on one of these ports (for example behind a reverse proxy) and set WEBHOOK_URL accordingly.`,
		);
	}
}

/* -------------------------------------------------------------------------- */
/*  Media                                                                     */
/* -------------------------------------------------------------------------- */

export type MediaType = 'animation' | 'audio' | 'document' | 'photo' | 'video' | 'voice';

export const MEDIA_METHODS: Record<MediaType, string> = {
	animation: 'sendAnimation',
	audio: 'sendAudio',
	document: 'sendDocument',
	photo: 'sendPhoto',
	video: 'sendVideo',
	voice: 'sendVoice',
};

export function maxUploadBytes(mediaType: MediaType): number {
	return mediaType === 'photo' ? MAX_UPLOAD_PHOTO_BYTES : MAX_UPLOAD_FILE_BYTES;
}

export interface MediaRef {
	kind: MediaType;
	fileId: string;
	fileName?: string;
	fileSize?: number;
}

function toMediaRef(kind: MediaType, value: unknown): MediaRef | undefined {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		return undefined;
	}
	const media = value as IDataObject;
	if (typeof media.file_id !== 'string' || media.file_id === '') {
		return undefined;
	}
	return {
		kind,
		fileId: media.file_id,
		fileName: typeof media.file_name === 'string' ? media.file_name : undefined,
		fileSize: typeof media.file_size === 'number' ? media.file_size : undefined,
	};
}

function pickLargestPhoto(photos: unknown[]): MediaRef | undefined {
	let best: MediaRef | undefined;
	let bestScore = -1;
	for (const photo of photos) {
		const ref = toMediaRef('photo', photo);
		if (ref === undefined) {
			continue;
		}
		const size = photo as IDataObject;
		const score =
			typeof size.file_size === 'number'
				? size.file_size
				: Number(size.width ?? 0) * Number(size.height ?? 0);
		if (score >= bestScore) {
			best = ref;
			bestScore = score;
		}
	}
	return best;
}

export function pickMedia(message: IDataObject): MediaRef | undefined {
	const kinds: MediaType[] = ['animation', 'photo', 'video', 'audio', 'voice', 'document'];
	for (const kind of kinds) {
		const value = message[kind];
		const ref =
			kind === 'photo'
				? pickLargestPhoto(Array.isArray(value) ? value : [])
				: toMediaRef(kind, value);
		if (ref !== undefined) {
			return ref;
		}
	}
	return undefined;
}

/* -------------------------------------------------------------------------- */
/*  Multipart uploads                                                         */
/* -------------------------------------------------------------------------- */

export interface MultipartFile {
	fieldName: string;
	fileName: string;
	contentType: string;
	data: Buffer;
}

function headerSafe(value: string): string {
	return value.replace(/[\r\n]+/g, ' ').replace(/"/g, '%22');
}

function randomBoundary(): string {
	let suffix = '';
	while (suffix.length < 24) {
		suffix += Math.random().toString(16).slice(2);
	}
	return `----n8nSoroushBoundary${suffix.slice(0, 24)}`;
}

function pickBoundary(files: MultipartFile[]): string {
	let boundary = randomBoundary();
	for (let attempt = 0; attempt < 10; attempt++) {
		if (!files.some((file) => file.data.includes(boundary))) {
			break;
		}
		boundary = randomBoundary();
	}
	return boundary;
}

export function buildMultipart(
	fields: IDataObject,
	files: MultipartFile[],
): { body: Buffer; contentType: string } {
	const boundary = pickBoundary(files);
	const crlf = '\r\n';
	const chunks: Buffer[] = [];

	for (const [name, value] of Object.entries(fields)) {
		if (value === undefined || value === null) {
			continue;
		}
		const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
		chunks.push(
			Buffer.from(
				`--${boundary}${crlf}Content-Disposition: form-data; name="${headerSafe(name)}"${crlf}${crlf}`,
				'utf8',
			),
			Buffer.from(text, 'utf8'),
			Buffer.from(crlf, 'utf8'),
		);
	}

	for (const file of files) {
		const contentType = file.contentType.replace(/[\r\n]+/g, '') || 'application/octet-stream';
		chunks.push(
			Buffer.from(
				`--${boundary}${crlf}Content-Disposition: form-data; name="${headerSafe(file.fieldName)}"; filename="${headerSafe(file.fileName)}"${crlf}Content-Type: ${contentType}${crlf}${crlf}`,
				'utf8',
			),
			file.data,
			Buffer.from(crlf, 'utf8'),
		);
	}

	chunks.push(Buffer.from(`--${boundary}--${crlf}`, 'utf8'));
	return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

/* -------------------------------------------------------------------------- */
/*  Mini App / Web App helpers & Pure SHA-256 / HMAC-SHA256                   */
/* -------------------------------------------------------------------------- */

const SHA256_K = [
	0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
	0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
	0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
	0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
	0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
	0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
	0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
	0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotr(n: number, x: number): number {
	return (x >>> n) | (x << (32 - n));
}

function sha256(message: Buffer): Buffer {
	let h0 = 0x6a09e667;
	let h1 = 0xbb67ae85;
	let h2 = 0x3c6ef372;
	let h3 = 0xa54ff53a;
	let h4 = 0x510e527f;
	let h5 = 0x9b05688c;
	let h6 = 0x1f83d9ab;
	let h7 = 0x5be0cd19;

	const bitLen = message.length * 8;
	const padLen = (message.length + 9 + 63) & ~63;
	const padded = Buffer.alloc(padLen, 0);
	message.copy(padded, 0);
	padded[message.length] = 0x80;
	padded.writeUInt32BE(Math.floor(bitLen / 0x100000000), padLen - 8);
	padded.writeUInt32BE(bitLen >>> 0, padLen - 4);

	const w = new Array<number>(64).fill(0);
	for (let offset = 0; offset < padLen; offset += 64) {
		for (let i = 0; i < 16; i++) {
			w[i] = padded.readInt32BE(offset + i * 4);
		}
		for (let i = 16; i < 64; i++) {
			const s0 = rotr(7, w[i - 15]) ^ rotr(18, w[i - 15]) ^ (w[i - 15] >>> 3);
			const s1 = rotr(17, w[i - 2]) ^ rotr(19, w[i - 2]) ^ (w[i - 2] >>> 10);
			w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
		}

		let a = h0;
		let b = h1;
		let c = h2;
		let d = h3;
		let e = h4;
		let f = h5;
		let g = h6;
		let h = h7;

		for (let i = 0; i < 64; i++) {
			const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
			const ch = (e & f) ^ (~e & g);
			const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) | 0;
			const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
			const maj = (a & b) ^ (a & c) ^ (b & c);
			const temp2 = (S0 + maj) | 0;

			h = g;
			g = f;
			f = e;
			e = (d + temp1) | 0;
			d = c;
			c = b;
			b = a;
			a = (temp1 + temp2) | 0;
		}

		h0 = (h0 + a) | 0;
		h1 = (h1 + b) | 0;
		h2 = (h2 + c) | 0;
		h3 = (h3 + d) | 0;
		h4 = (h4 + e) | 0;
		h5 = (h5 + f) | 0;
		h6 = (h6 + g) | 0;
		h7 = (h7 + h) | 0;
	}

	const out = Buffer.alloc(32);
	out.writeInt32BE(h0, 0);
	out.writeInt32BE(h1, 4);
	out.writeInt32BE(h2, 8);
	out.writeInt32BE(h3, 12);
	out.writeInt32BE(h4, 16);
	out.writeInt32BE(h5, 20);
	out.writeInt32BE(h6, 24);
	out.writeInt32BE(h7, 28);
	return out;
}

/** Pure RFC 2104 HMAC-SHA-256 without external or restricted Node imports. */
export function hmacSha256(key: Buffer | string, data: Buffer | string): Buffer {
	const keyBuf = typeof key === 'string' ? Buffer.from(key, 'utf8') : key;
	const dataBuf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
	const blockKey = Buffer.alloc(64, 0);
	if (keyBuf.length > 64) {
		sha256(keyBuf).copy(blockKey, 0);
	} else {
		keyBuf.copy(blockKey, 0);
	}

	const ipad = Buffer.alloc(64);
	const opad = Buffer.alloc(64);
	for (let i = 0; i < 64; i++) {
		ipad[i] = blockKey[i] ^ 0x36;
		opad[i] = blockKey[i] ^ 0x5c;
	}

	const inner = sha256(Buffer.concat([ipad, dataBuf]));
	return sha256(Buffer.concat([opad, inner]));
}

function constantTimeHexEqual(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}

export function buildMiniAppInlineButton(buttonText: string, webAppUrl: string): IDataObject {
	return {
		inline_keyboard: [
			[
				{
					text: requireNonEmpty(buttonText, 'Button Text'),
					web_app: { url: requireHttpUrl(webAppUrl, 'Mini App URL') },
				},
			],
		],
	};
}

export function buildMiniAppReplyButton(buttonText: string, webAppUrl: string): IDataObject {
	return {
		keyboard: [
			[
				{
					text: requireNonEmpty(buttonText, 'Button Text'),
					web_app: { url: requireHttpUrl(webAppUrl, 'Mini App URL') },
				},
			],
		],
		resize_keyboard: true,
	};
}

export interface MiniAppVerifyResult {
	valid: boolean;
	reason?: string;
	authDate?: number;
	queryId?: string;
	user?: IDataObject;
	startParam?: string;
	params: IDataObject;
}

/**
 * Validates `Soroush.WebApp.initData` according to the official Soroush Plus Mini App specification:
 * - `secret_key = HMAC_SHA256(key = "WebAppData", data = botToken)`
 * - `data_check_string` = alphabetically sorted `key=value` pairs (excluding `hash`) joined by `\n`
 * - `expected_hash = hex(HMAC_SHA256(key = secret_key, data = data_check_string))`
 */
export function verifyMiniAppInitData(
	initData: string,
	botToken: string,
	maxAgeSeconds = 0,
): MiniAppVerifyResult {
	const raw = requireNonEmpty(initData, 'Init Data');
	const cleanToken = normalizeToken(botToken);
	const searchParams = new URLSearchParams(raw);

	const receivedHash = searchParams.get('hash') ?? '';
	if (!/^[0-9a-f]{64}$/i.test(receivedHash)) {
		return { valid: false, reason: 'Missing or malformed hash parameter', params: {} };
	}

	const pairs: Array<[string, string]> = [];
	const parsedParams: IDataObject = {};

	for (const [key, value] of searchParams.entries()) {
		if (key === 'hash') {
			continue;
		}
		pairs.push([key, value]);
		if (
			(value.startsWith('{') && value.endsWith('}')) ||
			(value.startsWith('[') && value.endsWith(']'))
		) {
			try {
				parsedParams[key] = JSON.parse(value) as IDataObject;
				continue;
			} catch {
				// Keep raw string when not valid JSON
			}
		}
		parsedParams[key] = value;
	}

	pairs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
	const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join('\n');

	const secretKey = hmacSha256('WebAppData', cleanToken);
	const expectedHash = hmacSha256(secretKey, dataCheckString).toString('hex');

	if (!constantTimeHexEqual(receivedHash.toLowerCase(), expectedHash.toLowerCase())) {
		return { valid: false, reason: 'Signature mismatch', params: parsedParams };
	}

	const authDateRaw = searchParams.get('auth_date');
	const authDate = authDateRaw !== null ? Number(authDateRaw) : undefined;
	if (maxAgeSeconds > 0) {
		if (authDate === undefined || !Number.isFinite(authDate) || authDate <= 0) {
			return { valid: false, reason: 'Missing or invalid auth_date', params: parsedParams };
		}
		const nowSeconds = Math.floor(Date.now() / 1000);
		if (nowSeconds - authDate > maxAgeSeconds) {
			return {
				valid: false,
				reason: `initData expired (age ${nowSeconds - authDate}s > max ${maxAgeSeconds}s)`,
				authDate,
				params: parsedParams,
			};
		}
	}

	return {
		valid: true,
		...(authDate !== undefined && Number.isFinite(authDate) ? { authDate } : {}),
		...(typeof parsedParams.query_id === 'string' ? { queryId: parsedParams.query_id } : {}),
		...(parsedParams.user !== null && typeof parsedParams.user === 'object'
			? { user: parsedParams.user as IDataObject }
			: {}),
		...(typeof parsedParams.start_param === 'string'
			? { startParam: parsedParams.start_param }
			: {}),
		params: parsedParams,
	};
}

/* -------------------------------------------------------------------------- */
/*  Updates                                                                   */
/* -------------------------------------------------------------------------- */

export const UPDATE_KINDS = [
	'callback_query',
	'channel_post',
	'edited_channel_post',
	'edited_message',
	'message',
	'web_app_data',
] as const;

export type UpdateKind = (typeof UPDATE_KINDS)[number];

/** Returns the update kind, with dedicated detection for Mini App `web_app_data` events. */
export function getUpdateKind(update: IDataObject): UpdateKind | undefined {
	if (
		update.message !== null &&
		typeof update.message === 'object' &&
		(update.message as IDataObject).web_app_data !== undefined
	) {
		return 'web_app_data';
	}
	for (const kind of UPDATE_KINDS) {
		if (kind === 'web_app_data') {
			continue;
		}
		const value = update[kind];
		if (value !== null && typeof value === 'object') {
			return kind;
		}
	}
	return undefined;
}
