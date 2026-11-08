import type { IDataObject, IExecuteFunctions, IHttpRequestOptions, JsonObject } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import {
	EitaaValidationError,
	buildApiUrl,
	buildMultipart,
	describeApiError,
	normalizeBaseUrl,
	normalizeToken,
	parseEnvelope,
	redactSecret,
} from './helpers';
import type { MultipartFile } from './helpers';

interface FullResponse {
	body: unknown;
	statusCode: number;
}

async function loadCredentials(
	context: IExecuteFunctions,
): Promise<{ token: string; baseUrl: string }> {
	const credentials = await context.getCredentials('eitaaYarApi');
	try {
		return {
			token: normalizeToken(String(credentials.accessToken ?? '')),
			baseUrl: normalizeBaseUrl(credentials.baseUrl as string | undefined),
		};
	} catch (error) {
		if (error instanceof EitaaValidationError) {
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

/**
 * Calls an EitaaYar method and returns the `result` object of the response.
 *
 * - Plain calls are sent as JSON.
 * - When `files` is not empty, `body` and the files are sent as multipart/form-data.
 * - The token never appears in error messages.
 */
export async function eitaaApiRequest(
	this: IExecuteFunctions,
	method: string,
	body: IDataObject = {},
	files: MultipartFile[] = [],
): Promise<IDataObject> {
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
		if (error instanceof NodeApiError || error instanceof NodeOperationError) {
			throw error;
		}
		// Network failures can mention the request URL, which contains the token.
		const raw = error instanceof Error ? error.message : String(error);
		const message = redactSecret(raw, token);
		throw new NodeApiError(this.getNode(), { message } as JsonObject, {
			message: `Could not reach the EitaaYar API: ${message}`,
			description: 'Check the Base URL, your network connection and any proxy settings.',
		});
	}

	const parsed = parseBody(response.body);
	const envelope = parseEnvelope(parsed);

	if (envelope.kind === 'ok') {
		return envelope.data;
	}
	if (envelope.kind === 'error') {
		const description =
			envelope.description !== undefined ? redactSecret(envelope.description, token) : undefined;
		const statusCode = envelope.errorCode ?? response.statusCode;
		const { message, hint } = describeApiError(description, statusCode);
		throw new NodeApiError(
			this.getNode(),
			{
				ok: false,
				...(envelope.errorCode !== undefined ? { error_code: envelope.errorCode } : {}),
				description: description ?? null,
			} as JsonObject,
			{
				message,
				description: hint,
				httpCode: String(statusCode),
			},
		);
	}

	const excerpt = redactSecret(
		(typeof parsed === 'string' ? parsed : JSON.stringify(parsed ?? '')).slice(0, 200),
		token,
	);
	throw new NodeApiError(this.getNode(), { message: excerpt } as JsonObject, {
		message: `Unexpected response from EitaaYar (HTTP ${response.statusCode})`,
		description: 'The response was not an EitaaYar API envelope. Check the Base URL and proxy settings.',
		httpCode: String(response.statusCode),
	});
}
