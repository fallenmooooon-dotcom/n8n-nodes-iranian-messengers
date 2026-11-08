/**
 * Pure helper functions for the EitaaYar node.
 *
 * Nothing in this file needs the n8n runtime (type imports are erased at build
 * time), which keeps every helper trivially unit-testable.
 */
import type { IDataObject } from 'n8n-workflow';

/** Default EitaaYar API host. */
export const DEFAULT_BASE_URL = 'https://eitaayar.ir/api';

/** Thrown for invalid user input; the node turns it into a NodeOperationError. */
export class EitaaValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'EitaaValidationError';
	}
}

/* -------------------------------------------------------------------------- */
/*  Credentials and URLs                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Returns the bare token (`<digits>:<uuid>`): trims it, extracts it from a pasted API URL and
 * removes the `bot` prefix that the EitaaYar dashboard shows in front of it.
 */
export function normalizeToken(raw: string): string {
	let token = (raw ?? '').trim();
	const fromUrl = /\/api\/([^/?#\s]+)/i.exec(token);
	if (fromUrl !== null) {
		token = fromUrl[1];
	}
	token = token.replace(/^\/+|\/+$/g, '').replace(/^bot/i, '');
	if (token === '') {
		throw new EitaaValidationError('The EitaaYar access token is empty');
	}
	return token;
}

/**
 * Removes trailing slashes; falls back to the default host when empty.
 * Also adds `/api` if a bare origin like `https://eitaayar.ir` was entered.
 */
export function normalizeBaseUrl(raw?: string): string {
	const baseUrl = (raw ?? '').trim().replace(/\/+$/, '');
	if (baseUrl === '') {
		return DEFAULT_BASE_URL;
	}
	if (/^https?:\/\/[^/]+$/i.test(baseUrl)) {
		return `${baseUrl}/api`;
	}
	return baseUrl;
}

/** Builds `<base>/bot<token>/<method>`. */
export function buildApiUrl(baseUrl: string | undefined, token: string, method: string): string {
	return `${normalizeBaseUrl(baseUrl)}/bot${normalizeToken(token)}/${method}`;
}

/** Replaces every occurrence of a secret in a text so it never reaches logs or UI. */
export function redactSecret(text: string, secret: string): string {
	if (secret === '') {
		return text;
	}
	return text.split(secret).join('***');
}

/* -------------------------------------------------------------------------- */
/*  Response envelope and errors                                              */
/* -------------------------------------------------------------------------- */

export type ParsedEnvelope =
	| { kind: 'ok'; data: IDataObject }
	| { kind: 'error'; description?: string; errorCode?: number }
	| { kind: 'unknown' };

/**
 * EitaaYar answers with `{ ok: true, result? }` on success and `{ ok: false, ... }` on failure.
 * The `result` object is returned when present; otherwise everything except `ok`.
 */
export function parseEnvelope(body: unknown): ParsedEnvelope {
	if (body === null || typeof body !== 'object' || Array.isArray(body)) {
		return { kind: 'unknown' };
	}
	const envelope = body as IDataObject;
	if (typeof envelope.ok !== 'boolean') {
		return { kind: 'unknown' };
	}
	if (envelope.ok) {
		const result = envelope.result;
		if (result !== null && typeof result === 'object' && !Array.isArray(result)) {
			return { kind: 'ok', data: result as IDataObject };
		}
		if (result !== undefined && result !== null && result !== true) {
			return { kind: 'ok', data: { result } as IDataObject };
		}
		const rest: IDataObject = { ...envelope };
		delete rest.ok;
		delete rest.result;
		return { kind: 'ok', data: rest };
	}
	const text = [envelope.description, envelope.message, envelope.error].find(
		(candidate) => typeof candidate === 'string' && candidate !== '',
	);
	const errorCode =
		typeof envelope.error_code === 'number' && Number.isFinite(envelope.error_code)
			? envelope.error_code
			: undefined;
	return {
		kind: 'error',
		description: typeof text === 'string' ? text : undefined,
		...(errorCode !== undefined ? { errorCode } : {}),
	};
}

/** Builds a readable message and hint for a failed EitaaYar response. */
export function describeApiError(
	description: string | undefined,
	httpStatus: number,
): { message: string; hint: string } {
	const detail = description ?? `HTTP ${httpStatus}`;
	return {
		message: `EitaaYar API error: ${detail}`,
		hint: 'Check the access token, the chat ID and that the EitaaYar sender is set up for the target channel or group.',
	};
}

/* -------------------------------------------------------------------------- */
/*  Input validation                                                          */
/* -------------------------------------------------------------------------- */

/** Returns the trimmed value or throws when it is empty. */
export function requireNonEmpty(value: string, label: string): string {
	const trimmed = (value ?? '').trim();
	if (trimmed === '') {
		throw new EitaaValidationError(`${label} must not be empty`);
	}
	return trimmed;
}

/**
 * Validates Chat ID and removes a leading `@` if present, matching the EitaaYar specification
 * where channel usernames are passed without `@` (or numeric chat IDs are passed as-is).
 */
export function normalizeChatId(value: string): string {
	const trimmed = requireNonEmpty(value, 'Chat ID');
	const stripped = trimmed.replace(/^@+/, '');
	if (stripped === '') {
		throw new EitaaValidationError('Chat ID must not be empty');
	}
	return stripped;
}

/** Message text must not be blank. EitaaYar documents no maximum length. */
export function requireText(value: string, label: string): string {
	const text = value ?? '';
	if (text.trim() === '') {
		throw new EitaaValidationError(`${label} must not be empty`);
	}
	return text;
}

/** Validates a positive whole number. */
export function requirePositiveInteger(value: unknown, label: string): number {
	const numeric = typeof value === 'number' ? value : Number(value);
	if (!Number.isInteger(numeric) || numeric <= 0) {
		throw new EitaaValidationError(`${label} must be a positive whole number`);
	}
	return numeric;
}

/**
 * Converts a date (ISO text from the n8n date picker or a Unix timestamp in seconds) into the
 * Unix timestamp in seconds that EitaaYar expects for scheduled messages.
 */
export function toUnixSeconds(value: string | number): number {
	const text = String(value).trim();
	if (/^\d{9,11}$/.test(text)) {
		return Number(text);
	}
	const milliseconds = Date.parse(text);
	if (Number.isNaN(milliseconds)) {
		throw new EitaaValidationError(`Schedule Date "${text}" is not a valid date`);
	}
	return Math.floor(milliseconds / 1000);
}

export interface SendOptions {
	title?: string;
	pin?: boolean;
	disableNotification?: boolean;
	replyToMessageId?: number;
	scheduleDate?: string;
	viewCountForDelete?: number;
}

/** Builds the optional fields that sendMessage and sendFile share. Flags are sent as 1. */
export function buildSendFields(options: SendOptions): IDataObject {
	const fields: IDataObject = {};
	if (options.title !== undefined && options.title.trim() !== '') {
		fields.title = options.title.trim();
	}
	if (options.pin === true) {
		fields.pin = 1;
	}
	if (options.disableNotification === true) {
		fields.disable_notification = 1;
	}
	if (options.replyToMessageId !== undefined && options.replyToMessageId > 0) {
		fields.reply_to_message_id = requirePositiveInteger(options.replyToMessageId, 'Reply To Message ID');
	}
	if (options.scheduleDate !== undefined && options.scheduleDate.trim() !== '') {
		fields.date = toUnixSeconds(options.scheduleDate);
	}
	if (options.viewCountForDelete !== undefined && options.viewCountForDelete > 0) {
		fields.viewCountForDelete = requirePositiveInteger(options.viewCountForDelete, 'Delete After Views');
	}
	return fields;
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
	return `----n8nEitaaYarBoundary${suffix.slice(0, 24)}`;
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

/** Builds a multipart/form-data body without any external dependency. */
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
