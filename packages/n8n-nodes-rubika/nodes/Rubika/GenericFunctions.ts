import type {
	IBinaryData,
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IPollFunctions,
	IWebhookFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import {
	RubikaValidationError,
	buildApiUrl,
	buildMultipart,
	describeApiError,
	fileNameFromUrl,
	normalizeBaseUrl,
	normalizeToken,
	parseEnvelope,
	redactSecret,
} from './helpers';
import type { MultipartFile } from './helpers';

/** Every context from which the Rubika API can be called. */
export type RubikaContext =
	| IExecuteFunctions
	| IWebhookFunctions
	| IHookFunctions
	| IPollFunctions;

interface FullResponse {
	body: unknown;
	statusCode: number;
	headers?: Record<string, unknown>;
}

async function loadCredentials(
	context: RubikaContext,
): Promise<{ token: string; baseUrl: string }> {
	const credentials = await context.getCredentials('rubikaApi');
	try {
		return {
			token: normalizeToken(String(credentials.accessToken ?? '')),
			baseUrl: normalizeBaseUrl(credentials.baseUrl as string | undefined),
		};
	} catch (error) {
		if (error instanceof RubikaValidationError) {
			throw new NodeOperationError(context.getNode(), error.message);
		}
		throw new NodeOperationError(context.getNode(), error as Error);
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

/** Network failures can mention the request URL, which contains the token, so redact it. */
function toNetworkError(
	context: RubikaContext,
	error: unknown,
	secrets: string[],
): NodeApiError | NodeOperationError {
	if (error instanceof NodeApiError || error instanceof NodeOperationError) {
		return error;
	}
	let message = error instanceof Error ? error.message : String(error);
	for (const secret of secrets) {
		message = redactSecret(message, secret);
	}
	const fullMessage = `Could not reach the Rubika API: ${message}`;
	const apiError = new NodeApiError(context.getNode(), { message } as JsonObject, {
		message: fullMessage,
		description: 'Check the Base URL, your network connection and any proxy settings.',
	});
	apiError.message = fullMessage;
	return apiError;
}

function unexpectedResponse(
	context: RubikaContext,
	response: FullResponse,
	parsed: unknown,
	secrets: string[],
): NodeApiError {
	let excerpt = typeof parsed === 'string' ? parsed : JSON.stringify(parsed ?? '');
	excerpt = excerpt.slice(0, 200);
	for (const secret of secrets) {
		excerpt = redactSecret(excerpt, secret);
	}
	return new NodeApiError(context.getNode(), { message: excerpt } as JsonObject, {
		message: `Unexpected response from Rubika (HTTP ${response.statusCode})`,
		description: 'The response was not a Rubika API envelope. Check the Base URL and proxy settings.',
		httpCode: String(response.statusCode),
	});
}

/**
 * Calls a Rubika Bot API method and returns the `data` object of the response.
 * Every Rubika call is a JSON POST; the token never appears in error messages.
 */
export async function rubikaApiRequest(
	this: RubikaContext,
	method: string,
	body: IDataObject = {},
): Promise<IDataObject> {
	const { token, baseUrl } = await loadCredentials(this);

	let response: FullResponse;
	try {
		response = (await this.helpers.httpRequest({
			method: 'POST',
			url: buildApiUrl(baseUrl, token, method),
			body,
			json: true,
			returnFullResponse: true,
			ignoreHttpStatusErrors: true,
		})) as FullResponse;
	} catch (error) {
		throw toNetworkError(this, error, [token]);
	}

	const parsed = parseBody(response.body);
	const envelope = parseEnvelope(parsed);

	if (envelope.kind === 'ok') {
		return envelope.data;
	}
	if (envelope.kind === 'error') {
		const { message, hint } = describeApiError(envelope.status, envelope.statusDet);
		throw new NodeApiError(
			this.getNode(),
			{ status: envelope.status, status_det: envelope.statusDet ?? null } as JsonObject,
			{ message, description: hint, httpCode: String(response.statusCode) },
		);
	}
	throw unexpectedResponse(this, response, parsed, [token]);
}

/**
 * Step 2 of a Rubika file upload: sends the file as multipart/form-data (field `file`) to the
 * `upload_url` returned by `requestSendFile` and returns the new `file_id`.
 */
export async function rubikaUploadFile(
	this: IExecuteFunctions,
	uploadUrl: string,
	file: MultipartFile,
): Promise<string> {
	const { token } = await loadCredentials(this);
	const secrets = [token, uploadUrl];
	const multipart = buildMultipart({}, [file]);

	let response: FullResponse;
	try {
		response = (await this.helpers.httpRequest({
			method: 'POST',
			url: uploadUrl,
			body: multipart.body,
			headers: { 'Content-Type': multipart.contentType },
			returnFullResponse: true,
			ignoreHttpStatusErrors: true,
		})) as FullResponse;
	} catch (error) {
		throw toNetworkError(this, error, secrets);
	}

	const parsed = parseBody(response.body);
	const envelope = parseEnvelope(parsed);
	if (envelope.kind === 'error') {
		const { message, hint } = describeApiError(envelope.status, envelope.statusDet);
		throw new NodeApiError(
			this.getNode(),
			{ status: envelope.status, status_det: envelope.statusDet ?? null } as JsonObject,
			{ message: `File upload failed. ${message}`, description: hint, httpCode: String(response.statusCode) },
		);
	}

	// The upload answers with `{ data: { file_id } }`; a flat `{ file_id }` is accepted too.
	const root = (parsed !== null && typeof parsed === 'object' ? parsed : {}) as IDataObject;
	const data = (root.data !== null && typeof root.data === 'object' ? root.data : {}) as IDataObject;
	const fileId = data.file_id ?? root.file_id;
	if (response.statusCode >= 200 && response.statusCode < 300 && typeof fileId === 'string' && fileId !== '') {
		return fileId;
	}
	throw new NodeApiError(this.getNode(), { message: 'No file_id' } as JsonObject, {
		message: `File upload failed (HTTP ${response.statusCode}): Rubika did not return a file_id`,
		description: 'Request a new upload URL and try again.',
		httpCode: String(response.statusCode),
	});
}

/** Downloads a file from the `download_url` returned by `getFile` and stores it as binary data. */
export async function rubikaDownloadFile(
	this: IExecuteFunctions,
	downloadUrl: string,
	fallbackName: string,
): Promise<IBinaryData> {
	const { token } = await loadCredentials(this);
	const secrets = [token, downloadUrl];

	let response: FullResponse;
	try {
		response = (await this.helpers.httpRequest({
			method: 'GET',
			url: downloadUrl,
			encoding: 'arraybuffer',
			returnFullResponse: true,
			ignoreHttpStatusErrors: true,
		})) as FullResponse;
	} catch (error) {
		throw toNetworkError(this, error, secrets);
	}

	if (response.statusCode !== 200) {
		throw new NodeApiError(this.getNode(), { message: `HTTP ${response.statusCode}` } as JsonObject, {
			message: `Could not download the file from Rubika (HTTP ${response.statusCode})`,
			description: 'Call Get File again to receive a fresh download link.',
			httpCode: String(response.statusCode),
		});
	}

	const raw = response.body;
	const data = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
	const headers = response.headers ?? {};
	const typeKey = Object.keys(headers).find((key) => key.toLowerCase() === 'content-type');
	const contentType = typeKey !== undefined ? headers[typeKey] : undefined;
	const mimeType = typeof contentType === 'string' ? contentType.split(';')[0].trim() : undefined;
	return this.helpers.prepareBinaryData(data, fileNameFromUrl(downloadUrl, fallbackName), mimeType);
}
