/**
 * Pure helper functions for the Bale nodes.
 *
 * Nothing in this file needs the n8n runtime (type imports are erased at build
 * time), which keeps every helper trivially unit-testable.
 */
import type { IDataObject } from 'n8n-workflow';

/** Default Bale Bot API host. */
export const DEFAULT_BASE_URL = 'https://tapi.bale.ai';

/** Documented limits of the Bale Bot API. */
export const MAX_TEXT_LENGTH = 4096;
export const MAX_CAPTION_LENGTH = 1024;
/** Multipart upload limit for photos (documented as 10 MB). */
export const MAX_UPLOAD_PHOTO_BYTES = 10 * 1024 * 1024;
/** Multipart upload limit for every other media type (documented as 50 MB). */
export const MAX_UPLOAD_FILE_BYTES = 50 * 1024 * 1024;
/** Download limit of `getFile` (documented as 20 MB). */
export const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;
/** Bale only delivers webhooks to these HTTPS ports. */
export const WEBHOOK_PORTS = [443, 88];

/** Thrown for invalid user input; the nodes turn it into a NodeOperationError. */
export class BaleValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'BaleValidationError';
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
		throw new BaleValidationError('The Bale access token is empty');
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
	400: 'Bad Request: check the parameters, for example the chat ID, message ID or text length.',
	401: 'Unauthorized: the access token is invalid or was revoked. Check the Bale API credential.',
	403: 'Forbidden: the bot lacks permission in this chat, or the user blocked the bot.',
	404: 'Not Found: the method, chat or message does not exist.',
	429: 'Too Many Requests: slow down. Bale allows about 1 message per second to the same chat. Use the "Delay Between Items" option or enable "Retry On Fail".',
};

/** Builds a readable message plus an optional hint for a failed Bale response. */
export function describeApiError(
	errorCode: number | undefined,
	description: string | undefined,
): { message: string; hint?: string } {
	const detail = description !== undefined && description !== '' ? description : 'Unknown error';
	const prefix = errorCode !== undefined ? `Bale API error ${errorCode}` : 'Bale API error';
	return {
		message: `${prefix}: ${detail}`,
		hint: errorCode !== undefined ? ERROR_HINTS[errorCode] : undefined,
	};
}

/* -------------------------------------------------------------------------- */
/*  Input validation                                                          */
/* -------------------------------------------------------------------------- */

/** Bale accepts numeric chat IDs and `@channelusername`; numeric strings become numbers. */
export function parseChatId(value: string): string | number {
	const trimmed = (value ?? '').trim();
	if (trimmed === '') {
		throw new BaleValidationError('Chat ID must not be empty');
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
		throw new BaleValidationError(`${label} must not be empty`);
	}
	return trimmed;
}

/** Checks that a text is not blank and not longer than `max` characters. */
export function requireText(value: string, label: string, max: number): string {
	const text = value ?? '';
	if (text.trim() === '') {
		throw new BaleValidationError(`${label} must not be empty`);
	}
	validateLength(text, max, label);
	return text;
}

/** Throws when `value` has more than `max` characters (counted as code points). */
export function validateLength(value: string, max: number, label: string): void {
	const length = Array.from(value).length;
	if (length > max) {
		throw new BaleValidationError(`${label} is ${length} characters long; the maximum is ${max}`);
	}
}

/** Validates a positive integer ID such as a message ID or user ID. */
export function requirePositiveInteger(value: unknown, label: string): number {
	const numeric = typeof value === 'number' ? value : Number(value);
	if (!Number.isInteger(numeric) || numeric <= 0) {
		throw new BaleValidationError(`${label} must be a positive whole number`);
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
			throw new BaleValidationError(`${label} is not valid JSON`);
		}
	}
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new BaleValidationError(`${label} must be a JSON object`);
	}
	return parsed as Record<string, unknown>;
}

/** Validates that a media URL is an absolute http(s) URL. */
export function requireHttpUrl(value: string, label: string): string {
	const url = requireNonEmpty(value, label);
	if (!/^https?:\/\/\S+$/i.test(url)) {
		throw new BaleValidationError(`${label} must be an absolute http(s) URL`);
	}
	return url;
}

export interface LabeledPrice {
	label: string;
	amount: number;
}

/** Validates and parses the prices array for an invoice. */
export function validatePrices(raw: unknown): LabeledPrice[] {
	let items: unknown = raw;
	if (typeof raw === 'string') {
		let parseFailed = false;
		try {
			items = JSON.parse(raw);
		} catch {
			parseFailed = true;
		}
		if (parseFailed) {
			throw new BaleValidationError('Prices is not valid JSON');
		}
	}
	if (items !== null && typeof items === 'object' && !Array.isArray(items)) {
		const obj = items as Record<string, unknown>;
		if (Array.isArray(obj.priceItems)) {
			items = obj.priceItems;
		} else if (Array.isArray(obj.prices)) {
			items = obj.prices;
		}
	}
	if (!Array.isArray(items) || items.length === 0) {
		throw new BaleValidationError('Prices must contain at least one item');
	}
	return items.map((item, idx) => {
		if (item === null || typeof item !== 'object') {
			throw new BaleValidationError(`Price item #${idx + 1} must be an object`);
		}
		const row = item as Record<string, unknown>;
		const label = requireNonEmpty(String(row.label ?? ''), `Price item #${idx + 1} label`);
		const amount = requirePositiveInteger(row.amount, `Price item #${idx + 1} amount`);
		return { label, amount };
	});
}

/**
 * Bale only delivers webhooks to HTTPS URLs on port 443 or 88. Throws a
 * descriptive error when the URL n8n would register cannot work.
 */
export function assertValidWebhookUrl(url: string | undefined): void {
	const match = /^(https?):\/\/([^/?#:]+)(?::(\d+))?(?:[/?#]|$)/i.exec(url ?? '');
	if (match === null || match[1].toLowerCase() !== 'https') {
		throw new BaleValidationError(
			'Bale only delivers webhooks to HTTPS URLs. Make n8n reachable over HTTPS and set the WEBHOOK_URL environment variable to that public address.',
		);
	}
	const port = match[3] !== undefined ? Number(match[3]) : 443;
	if (!WEBHOOK_PORTS.includes(port)) {
		throw new BaleValidationError(
			`Bale only delivers webhooks to ports ${WEBHOOK_PORTS.join(' and ')}, but the n8n webhook URL uses port ${port}. Expose n8n on one of these ports (for example behind a reverse proxy) and set WEBHOOK_URL accordingly.`,
		);
	}
}

/* -------------------------------------------------------------------------- */
/*  Media                                                                     */
/* -------------------------------------------------------------------------- */

export type MediaType = 'animation' | 'audio' | 'document' | 'photo' | 'video' | 'voice';

/** Bale method used to send each media type. The multipart field has the same name as the type. */
export const MEDIA_METHODS: Record<MediaType, string> = {
	animation: 'sendAnimation',
	audio: 'sendAudio',
	document: 'sendDocument',
	photo: 'sendPhoto',
	video: 'sendVideo',
	voice: 'sendVoice',
};

/** Largest multipart upload Bale documents for the given media type. */
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

/** Finds the downloadable media of a message (largest size for photos). */
export function pickMedia(message: IDataObject): MediaRef | undefined {
	const kinds: MediaType[] = ['animation', 'photo', 'video', 'audio', 'voice', 'document'];
	for (const kind of kinds) {
		const value = message[kind];
		const ref = kind === 'photo' ? pickLargestPhoto(Array.isArray(value) ? value : []) : toMediaRef(kind, value);
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
	return `----n8nBaleBoundary${suffix.slice(0, 24)}`;
}

/** Picks a boundary that does not occur inside any of the uploaded files. */
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

/**
 * Builds a multipart/form-data body without any external dependency.
 * Object values are JSON-encoded, which is what Bale expects for fields such as `reply_markup`.
 */
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
/*  Updates                                                                   */
/* -------------------------------------------------------------------------- */

export const UPDATE_KINDS = [
	'callback_query',
	'channel_post',
	'edited_channel_post',
	'edited_message',
	'message',
	'pre_checkout_query',
] as const;
export type UpdateKind = (typeof UPDATE_KINDS)[number];

/** Returns which field of an Update is set, or undefined for unknown payloads. */
export function getUpdateKind(update: IDataObject): UpdateKind | undefined {
	for (const kind of UPDATE_KINDS) {
		const value = update[kind];
		if (value !== null && typeof value === 'object') {
			return kind;
		}
	}
	return undefined;
}
