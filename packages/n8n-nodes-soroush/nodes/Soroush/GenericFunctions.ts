import type {
	IBinaryData,
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestOptions,
	IPollFunctions,
	IWebhookFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import {
	MAX_DOWNLOAD_BYTES,
	SoroushValidationError,
	buildApiUrl,
	buildFileUrl,
	buildMultipart,
	describeApiError,
	normalizeBaseUrl,
	normalizeToken,
	redactSecret,
} from './helpers';
import type { MultipartFile } from './helpers';

/** Execution contexts that can call Soroush Plus API. */
export type SoroushContext =
	| IExecuteFunctions
	| IWebhookFunctions
	| IHookFunctions
	| IPollFunctions;

/** Contexts that can also store binary data. */
export type SoroushBinaryContext = IExecuteFunctions | IWebhookFunctions;

interface FullResponse {
	body: unknown;
	statusCode: number;
	headers?: Record<string, unknown>;
}

interface SoroushEnvelope {
	ok: boolean;
	result?: unknown;
	error_code?: number;
	description?: string;
	parameters?: {
		retry_after?: number;
	};
}

async function loadCredentials(
	context: SoroushContext,
): Promise<{ token: string; baseUrl: string }> {
	const credentials = await context.getCredentials('soroushApi');
	try {
		return {
			token: normalizeToken(String(credentials.accessToken ?? '')),
			baseUrl: normalizeBaseUrl(credentials.baseUrl as string | undefined),
		};
	} catch (error) {
		if (error instanceof SoroushValidationError) {
			throw new NodeOperationError(context.getNode(), error.message);
		}
		throw new NodeOperationError(context.getNode(), error as Error);
	}
}

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

function isEnvelope(value: unknown): value is SoroushEnvelope {
	return (
		value !== null &&
		typeof value === 'object' &&
		typeof (value as { ok?: unknown }).ok === 'boolean'
	);
}

function toNetworkError(
	context: SoroushContext,
	error: unknown,
	token: string,
): NodeApiError | NodeOperationError {
	if (error instanceof NodeApiError || error instanceof NodeOperationError) {
		return error;
	}
	const raw = error instanceof Error ? error.message : String(error);
	const message = redactSecret(raw, token);
	const fullMessage = `Could not reach the Soroush Plus API: ${message}`;
	const apiError = new NodeApiError(context.getNode(), { message } as JsonObject, {
		message: fullMessage,
		description: 'Check the Base URL, your network connection and any proxy or DNS settings.',
	});
	apiError.message = fullMessage;
	return apiError;
}

function unwrapEnvelope(context: SoroushContext, response: FullResponse, token: string): unknown {
	const parsed = parseBody(response.body);

	if (isEnvelope(parsed)) {
		if (parsed.ok) {
			return parsed.result;
		}
		const description =
			typeof parsed.description === 'string' ? redactSecret(parsed.description, token) : undefined;
		const retryAfter =
			typeof parsed.parameters?.retry_after === 'number'
				? parsed.parameters.retry_after
				: undefined;
		const { message, hint } = describeApiError(parsed.error_code, description, retryAfter);
		throw new NodeApiError(
			context.getNode(),
			{
				ok: false,
				error_code: parsed.error_code ?? null,
				description: description ?? null,
				...(retryAfter !== undefined ? { retry_after: retryAfter } : {}),
			} as JsonObject,
			{
				message,
				description: hint,
				httpCode: String(parsed.error_code ?? response.statusCode),
			},
		);
	}

	const excerpt = redactSecret(
		typeof parsed === 'string' ? parsed.slice(0, 200) : JSON.stringify(parsed ?? '').slice(0, 200),
		token,
	);
	throw new NodeApiError(context.getNode(), { message: excerpt } as JsonObject, {
		message: `Unexpected response from Soroush Plus (HTTP ${response.statusCode})`,
		description:
			'The response was not a standard Soroush Plus API envelope. Check the Base URL and proxy settings.',
		httpCode: String(response.statusCode),
	});
}

/** Calls a Soroush Plus API method and returns the result data. */
export async function soroushApiRequest(
	this: SoroushContext,
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

function headerValue(
	headers: Record<string, unknown> | undefined,
	name: string,
): string | undefined {
	if (headers === undefined) {
		return undefined;
	}
	const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name);
	const value = key !== undefined ? headers[key] : undefined;
	return typeof value === 'string' ? value : undefined;
}

/** Resolves file_id with `getFile` and downloads the content into an n8n binary object. */
export async function downloadFileAsBinary(
	this: SoroushBinaryContext,
	fileId: string,
	preferredName?: string,
): Promise<{ file: IDataObject; binary: IBinaryData }> {
	const file = (await soroushApiRequest.call(this, 'getFile', { file_id: fileId })) as IDataObject;
	const filePath = typeof file.file_path === 'string' ? file.file_path : '';
	if (filePath === '') {
		throw new NodeOperationError(
			this.getNode(),
			'Soroush Plus did not return a file_path for this file',
		);
	}
	if (typeof file.file_size === 'number' && file.file_size > MAX_DOWNLOAD_BYTES) {
		throw new NodeOperationError(
			this.getNode(),
			`The file exceeds the ${MAX_DOWNLOAD_BYTES / (1024 * 1024)} MB download limit of the Soroush Plus API`,
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
				message: `Could not download the file from Soroush Plus (HTTP ${response.statusCode})`,
				description: 'The download link may have expired. Call Get File again for a fresh link.',
				httpCode: String(response.statusCode),
			},
		);
	}

	const raw = response.body;
	const data = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
	if (data.length > MAX_DOWNLOAD_BYTES) {
		throw new NodeOperationError(
			this.getNode(),
			`The downloaded file exceeds the ${MAX_DOWNLOAD_BYTES / (1024 * 1024)} MB limit`,
		);
	}

	const contentType = headerValue(response.headers, 'content-type');
	const mimeType = contentType !== undefined ? contentType.split(';')[0].trim() : undefined;
	const fileName = preferredName ?? filePath.split('/').pop() ?? 'file';
	const binary = await this.helpers.prepareBinaryData(data, fileName, mimeType);
	return { file, binary };
}
