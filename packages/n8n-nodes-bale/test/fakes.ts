/**
 * Minimal fakes of the n8n execution contexts, used by the unit tests.
 * They record every HTTP request and replay scripted responses, so the tests
 * never touch the network and never need a real token.
 */
import type {
	IBinaryData,
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestOptions,
	INode,
	INodeExecutionData,
	IWebhookFunctions,
} from 'n8n-workflow';

export const FAKE_NODE: INode = {
	id: 'node-1',
	name: 'Bale',
	typeVersion: 1,
	type: 'n8n-nodes-bale-ir.bale',
	position: [0, 0],
	parameters: {},
};

/** A fake token. The leading "bot" checks that the prefix is normalised away. */
export const RAW_TOKEN = 'bot123456:FAKE-TOKEN-for-tests';
export const CLEAN_TOKEN = '123456:FAKE-TOKEN-for-tests';
export const API_ROOT = `https://tapi.bale.ai/bot${CLEAN_TOKEN}`;

export interface ScriptedResponse {
	body?: unknown;
	statusCode?: number;
	headers?: Record<string, unknown>;
	error?: Error;
}

/** Replays scripted responses in order and records the requests. */
export class HttpRecorder {
	readonly calls: IHttpRequestOptions[] = [];

	constructor(private readonly responses: ScriptedResponse[]) {}

	readonly httpRequest = async (options: IHttpRequestOptions): Promise<unknown> => {
		this.calls.push(options);
		const next = this.responses.shift();
		if (next === undefined) {
			throw new Error('No scripted response left for ' + options.url);
		}
		if (next.error !== undefined) {
			throw next.error;
		}
		return { body: next.body, statusCode: next.statusCode ?? 200, headers: next.headers ?? {} };
	};
}

export const ok = (result: unknown): ScriptedResponse => ({ body: { ok: true, result } });

export interface BinaryFixture {
	meta: IBinaryData;
	data: Buffer;
}

interface BaseOptions {
	responses: ScriptedResponse[];
	credentials?: IDataObject;
	binaries?: Record<string, BinaryFixture>;
}

const defaultCredentials = (): IDataObject => ({ accessToken: RAW_TOKEN, baseUrl: 'https://tapi.bale.ai' });

function binaryHelpers(binaries: Record<string, BinaryFixture>) {
	return {
		assertBinaryData: (_i: number, property: string): IBinaryData => {
			const fixture = binaries[property];
			if (fixture === undefined) {
				throw new Error(`No binary property "${property}"`);
			}
			return fixture.meta;
		},
		getBinaryDataBuffer: async (_i: number, property: string): Promise<Buffer> => {
			const fixture = binaries[property];
			if (fixture === undefined) {
				throw new Error(`No binary property "${property}"`);
			}
			return fixture.data;
		},
		prepareBinaryData: async (
			data: Buffer,
			fileName?: string,
			mimeType?: string,
		): Promise<IBinaryData> => ({
			data: data.toString('base64'),
			fileName,
			mimeType: mimeType ?? 'application/octet-stream',
		}),
	};
}

export interface ExecuteOptions extends BaseOptions {
	/** One parameter bag for all items, or one per item. */
	params: Record<string, unknown> | Array<Record<string, unknown>>;
	items?: INodeExecutionData[];
	continueOnFail?: boolean;
}

export function makeExecuteContext(options: ExecuteOptions): {
	context: IExecuteFunctions;
	http: HttpRecorder;
} {
	const http = new HttpRecorder(options.responses);
	const items = options.items ?? [{ json: {} }];
	const context = {
		getInputData: () => items,
		getNodeParameter: (name: string, i: number, fallback?: unknown) => {
			const bag = Array.isArray(options.params) ? options.params[i] : options.params;
			if (bag !== undefined && name in bag) {
				return bag[name];
			}
			if (fallback !== undefined) {
				return fallback;
			}
			throw new Error(`Missing parameter "${name}"`);
		},
		getCredentials: async () => options.credentials ?? defaultCredentials(),
		getNode: () => FAKE_NODE,
		continueOnFail: () => options.continueOnFail ?? false,
		helpers: { httpRequest: http.httpRequest, ...binaryHelpers(options.binaries ?? {}) },
	};
	return { context: context as unknown as IExecuteFunctions, http };
}

export interface HookOptions extends BaseOptions {
	webhookUrl?: string;
	params?: Record<string, unknown>;
}

export function makeHookContext(options: HookOptions): { context: IHookFunctions; http: HttpRecorder } {
	const http = new HttpRecorder(options.responses);
	const context = {
		getNodeWebhookUrl: () => options.webhookUrl,
		getNodeParameter: (name: string, fallback?: unknown) => options.params?.[name] ?? fallback,
		getCredentials: async () => options.credentials ?? defaultCredentials(),
		getNode: () => FAKE_NODE,
		helpers: { httpRequest: http.httpRequest },
	};
	return { context: context as unknown as IHookFunctions, http };
}

export interface WebhookOptions extends BaseOptions {
	body: IDataObject;
	params?: Record<string, unknown>;
}

export function makeWebhookContext(options: WebhookOptions): {
	context: IWebhookFunctions;
	http: HttpRecorder;
} {
	const http = new HttpRecorder(options.responses);
	const context = {
		getBodyData: () => options.body,
		getNodeParameter: (name: string, fallback?: unknown) => options.params?.[name] ?? fallback,
		getCredentials: async () => options.credentials ?? defaultCredentials(),
		getNode: () => FAKE_NODE,
		helpers: { httpRequest: http.httpRequest, ...binaryHelpers(options.binaries ?? {}) },
	};
	return { context: context as unknown as IWebhookFunctions, http };
}
