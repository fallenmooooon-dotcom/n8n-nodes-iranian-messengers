/**
 * Pure helper functions for the Rubika nodes.
 *
 * Nothing in this file needs the n8n runtime (type imports are erased at build
 * time), which keeps every helper trivially unit-testable.
 */
import type { IDataObject } from 'n8n-workflow';

/** Default Rubika Bot API host including the API version. */
export const DEFAULT_BASE_URL = 'https://botapi.rubika.ir/v3';

/** Documented multipart limits per Rubika file type (bytes). Other types have no documented limit. */
export const FILE_TYPE_LIMITS: Record<string, number | undefined> = {
	File: 50 * 1024 * 1024,
	Image: 10 * 1024 * 1024,
	Video: 50 * 1024 * 1024,
};

/** Maximum number of metadata (formatting) parts in one message. */
export const MAX_METADATA_PARTS = 30;

/** Thrown for invalid user input; the nodes turn it into a NodeOperationError. */
export class RubikaValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'RubikaValidationError';
	}
}

/* -------------------------------------------------------------------------- */
/*  Credentials and URLs                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Trims the token. If a whole API URL was pasted, the token segment after `/v3/` is extracted.
 */
export function normalizeToken(raw: string): string {
	let token = (raw ?? '').trim();
	const fromUrl = /^https?:\/\/[^/]+\/v\d+\/([^/?#\s]+)/i.exec(token);
	if (fromUrl !== null) {
		token = fromUrl[1];
	}
	token = token.replace(/^\/+|\/+$/g, '');
	if (token === '') {
		throw new RubikaValidationError('The Rubika access token is empty');
	}
	return token;
}

/** Removes trailing slashes; falls back to the default host when empty. */
export function normalizeBaseUrl(raw?: string): string {
	const baseUrl = (raw ?? '').trim().replace(/\/+$/, '');
	return baseUrl === '' ? DEFAULT_BASE_URL : baseUrl;
}

/** Builds `<base>/<token>/<method>`. */
export function buildApiUrl(baseUrl: string | undefined, token: string, method: string): string {
	return `${normalizeBaseUrl(baseUrl)}/${normalizeToken(token)}/${method}`;
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
	| { kind: 'error'; status: string; statusDet?: string }
	| { kind: 'unknown' };

/** Rubika wraps every answer as `{ status, status_det?, data? }`; `status` is "OK" on success. */
export function parseEnvelope(body: unknown): ParsedEnvelope {
	if (body === null || typeof body !== 'object' || Array.isArray(body)) {
		return { kind: 'unknown' };
	}
	const envelope = body as IDataObject;
	if (typeof envelope.status !== 'string') {
		return { kind: 'unknown' };
	}
	if (envelope.status === 'OK') {
		const data = envelope.data;
		const isObject = data !== null && typeof data === 'object' && !Array.isArray(data);
		return { kind: 'ok', data: isObject ? (data as IDataObject) : {} };
	}
	const detail =
		typeof envelope.status_det === 'string' && envelope.status_det !== ''
			? envelope.status_det
			: typeof envelope.dev_message === 'string' && envelope.dev_message !== ''
				? envelope.dev_message
				: undefined;
	return {
		kind: 'error',
		status: envelope.status,
		statusDet: detail,
	};
}

const ERROR_HINTS: Record<string, string> = {
	INVALID_ACCESS: 'The access token is invalid or lacks permission. Check the Rubika API credential.',
	INVALID_AUTH: 'The access token is invalid or was revoked. Check the Rubika API credential.',
	INVALID_INPUT:
		'A required parameter is missing or invalid, for example the chat ID, message ID or a keypad.',
	TOO_MANY_REQUESTS:
		'Too many requests. Slow down: use the "Delay Between Items" option or enable "Retry On Fail".',
	TOO_REQUESTS:
		'Too many requests. Slow down: use the "Delay Between Items" option or enable "Retry On Fail".',
};

/** Builds a readable message plus an optional hint for a failed Rubika response. */
export function describeApiError(
	status: string,
	statusDet: string | undefined,
): { message: string; hint?: string } {
	const code = statusDet !== undefined && statusDet !== '' ? statusDet : status;
	return {
		message: `Rubika API error: ${code}`,
		hint: ERROR_HINTS[code] ?? ERROR_HINTS[status],
	};
}

/* -------------------------------------------------------------------------- */
/*  Input validation                                                          */
/* -------------------------------------------------------------------------- */

/** Returns the trimmed value or throws when it is empty. */
export function requireNonEmpty(value: string, label: string): string {
	const trimmed = (value ?? '').trim();
	if (trimmed === '') {
		throw new RubikaValidationError(`${label} must not be empty`);
	}
	return trimmed;
}

/** Message text must not be blank. Rubika documents no maximum length. */
export function requireText(value: string, label: string): string {
	const text = value ?? '';
	if (text.trim() === '') {
		throw new RubikaValidationError(`${label} must not be empty`);
	}
	return text;
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
			throw new RubikaValidationError(`${label} is not valid JSON`);
		}
	}
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new RubikaValidationError(`${label} must be a JSON object`);
	}
	return parsed as Record<string, unknown>;
}

/** Validates that a URL is an absolute https URL (Rubika only calls secure endpoints). */
export function assertHttpsUrl(url: string | undefined): void {
	if (!/^https:\/\/[^/?#\s]+/i.test(url ?? '')) {
		throw new RubikaValidationError(
			'Rubika only delivers webhooks to HTTPS addresses. Make n8n reachable over HTTPS and set the WEBHOOK_URL environment variable to that public address.',
		);
	}
}

/** Latitude and longitude are sent as strings, as the Rubika reference documents. */
export function parseCoordinate(value: unknown, label: string, limit: number): string {
	const numeric = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(numeric) || numeric < -limit || numeric > limit) {
		throw new RubikaValidationError(`${label} must be a number between -${limit} and ${limit}`);
	}
	return String(numeric);
}

/* -------------------------------------------------------------------------- */
/*  Keypads                                                                   */
/* -------------------------------------------------------------------------- */

export const BUTTON_TYPES = [
	'Simple',
	'Selection',
	'Calendar',
	'NumberPicker',
	'StringPicker',
	'Location',
	'CameraImage',
	'CameraVideo',
	'GalleryImage',
	'GalleryVideo',
	'File',
	'Audio',
	'RecordAudio',
	'Textbox',
	'Link',
	'AskMyPhoneNumber',
	'AskMyLocation',
	'Barcode',
];

/**
 * Checks the structure that the Rubika reference documents for a Keypad:
 * `rows[].buttons[]` with a string `id` and a known button `type`.
 */
export function validateKeypad(value: unknown, label: string): IDataObject {
	const keypad = parseJsonObject(value, label) as IDataObject;
	const rows = keypad.rows;
	if (!Array.isArray(rows) || rows.length === 0) {
		throw new RubikaValidationError(`${label} needs a non-empty "rows" array`);
	}
	rows.forEach((row, rowIndex) => {
		const buttons = (row as IDataObject | null)?.buttons;
		if (!Array.isArray(buttons) || buttons.length === 0) {
			throw new RubikaValidationError(
				`${label}: row ${rowIndex + 1} needs a non-empty "buttons" array`,
			);
		}
		buttons.forEach((button, buttonIndex) => {
			const where = `${label}: button ${buttonIndex + 1} in row ${rowIndex + 1}`;
			const item = button as IDataObject | null;
			if (item === null || typeof item !== 'object') {
				throw new RubikaValidationError(`${where} must be an object`);
			}
			if (typeof item.id !== 'string' || item.id === '') {
				throw new RubikaValidationError(`${where} needs a string "id"`);
			}
			if (typeof item.type !== 'string' || !BUTTON_TYPES.includes(item.type)) {
				throw new RubikaValidationError(
					`${where} has an unknown "type". Allowed: ${BUTTON_TYPES.join(', ')}`,
				);
			}
		});
	});
	return keypad;
}

/* -------------------------------------------------------------------------- */
/*  Text formatting (metadata)                                                */
/* -------------------------------------------------------------------------- */

export const METADATA_TYPES = [
	'Bold',
	'Italic',
	'Mono',
	'Underline',
	'Strike',
	'Spoiler',
	'Link',
	'MentionText',
	'Pre',
	'Quote',
];

export interface MetadataPartInput {
	type: string;
	fromIndex: number;
	length: number;
	linkUrl?: string;
	mentionUserId?: string;
}

/**
 * Builds the `metadata` object. Indices count UTF-16 units, which is exactly what JavaScript's
 * `string.length` counts. One invalid part makes Rubika reject the whole message, so everything
 * is checked up front.
 */
export function buildMetadata(text: string, parts: MetadataPartInput[]): IDataObject {
	if (parts.length > MAX_METADATA_PARTS) {
		throw new RubikaValidationError(`Rubika allows at most ${MAX_METADATA_PARTS} formatting parts`);
	}
	const apiParts = parts.map((part, index) => {
		const where = `Formatting part ${index + 1}`;
		if (!METADATA_TYPES.includes(part.type)) {
			throw new RubikaValidationError(`${where} has an unknown type "${part.type}"`);
		}
		if (!Number.isInteger(part.fromIndex) || part.fromIndex < 0) {
			throw new RubikaValidationError(`${where}: From Index must be a whole number of 0 or more`);
		}
		if (!Number.isInteger(part.length) || part.length <= 0) {
			throw new RubikaValidationError(`${where}: Length must be a whole number greater than 0`);
		}
		if (part.fromIndex + part.length > text.length) {
			throw new RubikaValidationError(
				`${where} reaches position ${part.fromIndex + part.length}, but the text has only ${text.length} UTF-16 units (an emoji counts as 2)`,
			);
		}
		const apiPart: IDataObject = {
			type: part.type,
			from_index: part.fromIndex,
			length: part.length,
		};
		if (part.type === 'Link') {
			if (part.linkUrl === undefined || part.linkUrl.trim() === '') {
				throw new RubikaValidationError(`${where}: a Link needs a Link URL`);
			}
			apiPart.link_url = part.linkUrl.trim();
		}
		if (part.type === 'MentionText') {
			if (part.mentionUserId === undefined || part.mentionUserId.trim() === '') {
				throw new RubikaValidationError(`${where}: a MentionText needs a Mention User ID`);
			}
			apiPart.mention_text_user_id = part.mentionUserId.trim();
		}
		return apiPart;
	});
	return { meta_data_parts: apiParts };
}

/* -------------------------------------------------------------------------- */
/*  Files                                                                     */
/* -------------------------------------------------------------------------- */

export const FILE_TYPES = ['File', 'Gif', 'Image', 'Music', 'Video', 'Voice'];

/** Throws when a file is larger than the documented limit of its Rubika file type. */
export function assertFileSize(fileType: string, size: number): void {
	const limit = FILE_TYPE_LIMITS[fileType];
	if (limit !== undefined && size > limit) {
		throw new RubikaValidationError(
			`The file is ${size} bytes; Rubika accepts at most ${limit / (1024 * 1024)} MB for the type "${fileType}"`,
		);
	}
}

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
	return `----n8nRubikaBoundary${suffix.slice(0, 24)}`;
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

/** Takes the last path segment of a URL, without query string or fragment. */
export function fileNameFromUrl(url: string, fallback: string): string {
	const path = url.split(/[?#]/)[0];
	const name = path.split('/').pop() ?? '';
	if (name === '') {
		return fallback;
	}
	try {
		return decodeURIComponent(name);
	} catch {
		return name;
	}
}

/* -------------------------------------------------------------------------- */
/*  Updates                                                                   */
/* -------------------------------------------------------------------------- */

export const EVENT_TYPES = [
	'InlineMessage',
	'NewMessage',
	'RemovedMessage',
	'StartedBot',
	'StoppedBot',
	'UpdatedMessage',
	'EventData',
];

function isPlainObject(value: unknown): value is IDataObject {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Turns an Update object into the item the triggers emit. Inline button presses arrive as a
 * separate `inline_message` payload, so they are wrapped as `{ type: 'InlineMessage', ... }`.
 */
export function normalizeUpdate(update: IDataObject): IDataObject | undefined {
	if (typeof update.type === 'string') {
		return update;
	}
	return undefined;
}

/**
 * Normalises a webhook body (`{ update }` or `{ inline_message }`) into an event item.
 * Returns undefined for payloads the triggers do not understand.
 */
export function normalizeWebhookBody(body: IDataObject): IDataObject | undefined {
	if (isPlainObject(body.update)) {
		return normalizeUpdate(body.update);
	}
	if (isPlainObject(body.inline_message)) {
		const inline = body.inline_message;
		return {
			type: 'InlineMessage',
			chat_id: typeof inline.chat_id === 'string' ? inline.chat_id : undefined,
			inline_message: inline,
		};
	}
	return undefined;
}

/** Event types that arrive on the `ReceiveUpdate` endpoint. */
export function needsReceiveUpdate(events: string[]): boolean {
	return events.some((event) => event !== 'InlineMessage');
}

/** A stable key for de-duplicating polled updates. */
export function updateKey(update: IDataObject): string {
	const message = (update.new_message ?? update.updated_message) as IDataObject | undefined;
	return [
		String(update.type ?? ''),
		String(update.chat_id ?? ''),
		String(update.removed_message_id ?? message?.message_id ?? ''),
		String(message?.time ?? ''),
		String((message?.aux_data as IDataObject | undefined)?.button_id ?? ''),
		message === undefined ? JSON.stringify(update.event_data ?? '') : '',
	].join('|');
}

/** Keeps the newest `max` keys. */
export function rememberKeys(existing: string[], added: string[], max: number): string[] {
	return [...existing, ...added].slice(-max);
}
