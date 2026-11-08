import type {
	IBinaryData,
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestOptions,
	IWebhookFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import {
	BaleValidationError,
	MAX_DOWNLOAD_BYTES,
	buildApiUrl,
	buildFileUrl,
	buildMultipart,
	describeApiError,
	normalizeBaseUrl,
	normalizeToken,
	redactSecret,
} from './helpers';
import type { MultipartFile } from './helpers';

/** Every context from which the Bale API can be called. */
export type BaleContext = IExecuteFunctions | IWebhookFunctions | IHookFunctions;

/** Contexts that can also store binary data. */
export type BaleBinaryContext = IExecuteFunctions | IWebhookFunctions;

interface FullResponse {
	body: unknown;
	statusCode: number;
	headers?: Record<string, unknown>;
}

interface BaleEnvelope {
	ok: boolean;
	result?: unknown;
	error_code?: number;
	description?: string;
}

async function loadCredentials(
	context: BaleContext,
): Promise<{ token: string; baseUrl: string }> {
	const credentials = await context.getCredentials('baleApi');
	try {
		return {
			token: normalizeToken(String(credentials.accessToken ?? '')),
			baseUrl: normalizeBaseUrl(credentials.baseUrl as string | undefined),
		};
	} catch (error) {
		if (error instanceof BaleValidationError) {
			throw new NodeOperationError(context.getNode(), error.message);
		}
		throw error;
	}
}

/** Bodies can arrive as objects, strings or buffers depending on the response headers. */
function parseBody(body: unknown): unknown {
	let raw = body;
	if (Buffer.isBuffer(raw)) {
		raw = raw.toString('utf8');
	}
	if (typeof raw === 'string') {
		try {
			return JSON.parse(raw);
		} catch {
			return raw;
		}
	}
	return raw;
}

function isEnvelope(value: unknown): value is BaleEnvelope {
	return (
		value !== null &&
		typeof value === 'object' &&
		typeof (value as { ok?: unknown }).ok === 'boolean'
	);
}

/** Network failures can mention the request URL, which contains the token, so redact it. */
function toNetworkError(
	context: BaleContext,
	error: unknown,
	token: string,
): NodeApiError | NodeOperationError {
	if (error instanceof NodeApiError || error instanceof NodeOperationError) {
		return error;
	}
	const raw = error instanceof Error ? error.message : String(error);
	const message = redactSecret(raw, token);
	return new NodeApiError(context.getNode(), { message } as JsonObject, {
		message: `Could not reach the Bale API: ${message}`,
		description: 'Check the Base URL, your network connection and any proxy settings.',
	});
}

function unwrapEnvelope(context: BaleContext, response: FullResponse, token: string): unknown {
	const parsed = parseBody(response.body);

	if (isEnvelope(parsed)) {
		if (parsed.ok) {
			return parsed.result;
		}
		const description =
			typeof parsed.description === 'string' ? redactSecret(parsed.description, token) : undefined;
		const { message, hint } = describeApiError(parsed.error_code, description);
		throw new NodeApiError(
			context.getNode(),
			{ ok: false, error_code: parsed.error_code ?? null, description: description ?? null } as JsonObject,
			{ message, description: hint, httpCode: String(parsed.error_code ?? response.statusCode) },
		);
	}

	const excerpt = redactSecret(
		typeof parsed === 'string' ? parsed.slice(0, 200) : JSON.stringify(parsed ?? '').slice(0, 200),
		token,
	);
	throw new NodeApiError(context.getNode(), { message: excerpt } as JsonObject, {
		message: `Unexpected response from Bale (HTTP ${response.statusCode})`,
		description: 'The response was not a Bale API envelope. Check the Base URL and proxy settings.',
		httpCode: String(response.statusCode),
	});
}

/**
 * Calls a Bale Bot API method and returns the `result` field of the response.
 *
 * - Plain calls are sent as JSON.
 * - When `files` is not empty, `body` and the files are sent as multipart/form-data.
 * - The token never appears in error messages.
 */
export async function baleApiRequest(
	this: BaleContext,
	method: string,
	body: IDataObject = {},
	files: MultipartFile[] = [],
): Promise<unknown> {
	const { token, baseUrl } = await loadCredentials(this);

	const options: IHttpRequestOptions = {
		method: 'POST',
		url: buildApiUrl(baseUrl, token, method),
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
	};

	if (files.length > 0) {
		const multipart = buildMultipart(body, files);
		options.body = multipart.body;
		options.headers = { 'Content-Type': multipart.contentType };
	} else {
		options.body = body;
		options.json = true;
	}

	let response: FullResponse;
	try {
		response = (await this.helpers.httpRequest(options)) as FullResponse;
	} catch (error) {
		throw toNetworkError(this, error, token);
	}
	return unwrapEnvelope(this, response, token);
}

function headerValue(headers: Record<string, unknown> | undefined, name: string): string | undefined {
	if (headers === undefined) {
		return undefined;
	}
	const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name);
	const value = key !== undefined ? headers[key] : undefined;
	return typeof value === 'string' ? value : undefined;
}

/**
 * Resolves a file_id with `getFile`, downloads the file (documented limit: 20 MB)
 * and stores it as n8n binary data. The download URL contains the bot token, so it
 * is only used internally and never returned.
 */
export async function downloadFileAsBinary(
	this: BaleBinaryContext,
	fileId: string,
	preferredName?: string,
): Promise<{ file: IDataObject; binary: IBinaryData }> {
	const file = (await baleApiRequest.call(this, 'getFile', { file_id: fileId })) as IDataObject;
	const filePath = typeof file.file_path === 'string' ? file.file_path : '';
	if (filePath === '') {
		throw new NodeOperationError(this.getNode(), 'Bale did not return a file_path for this file');
	}
	if (typeof file.file_size === 'number' && file.file_size > MAX_DOWNLOAD_BYTES) {
		throw new NodeOperationError(
			this.getNode(),
			`The file is larger than the ${MAX_DOWNLOAD_BYTES / (1024 * 1024)} MB download limit of the Bale API`,
		);
	}

	const { token, baseUrl } = await loadCredentials(this);
	let response: FullResponse;
	try {
		response = (await this.helpers.httpRequest({
			method: 'GET',
			url: buildFileUrl(baseUrl, token, filePath),
			encoding: 'arraybuffer',
			returnFullResponse: true,
			ignoreHttpStatusErrors: true,
		})) as FullResponse;
	} catch (error) {
		throw toNetworkError(this, error, token);
	}

	if (response.statusCode !== 200) {
		throw new NodeApiError(
			this.getNode(),
			{ message: `HTTP ${response.statusCode}` } as JsonObject,
			{
				message: `Could not download the file from Bale (HTTP ${response.statusCode})`,
				description: 'The download link is valid for one hour. Call Get File again for a fresh link.',
				httpCode: String(response.statusCode),
			},
		);
	}

	const raw = response.body;
	const data = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
	if (data.length > MAX_DOWNLOAD_BYTES) {
		throw new NodeOperationError(
			this.getNode(),
			`The downloaded file is larger than the ${MAX_DOWNLOAD_BYTES / (1024 * 1024)} MB limit`,
		);
	}

	const contentType = headerValue(response.headers, 'content-type');
	const mimeType = contentType !== undefined ? contentType.split(';')[0].trim() : undefined;
	const fileName = preferredName ?? filePath.split('/').pop() ?? 'file';
	const binary = await this.helpers.prepareBinaryData(data, fileName, mimeType);
	return { file, binary };
}
