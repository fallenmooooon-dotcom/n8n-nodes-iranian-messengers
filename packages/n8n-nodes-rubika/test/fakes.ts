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
	IPollFunctions,
	IWebhookFunctions,
} from 'n8n-workflow';

export const FAKE_NODE: INode = {
	id: 'node-1',
	name: 'Rubika',
	typeVersion: 1,
	type: 'n8n-nodes-rubika.rubika',
	position: [0, 0],
	parameters: {},
};

/** A fake token that is only used by the tests. */
export const TOKEN = 'FAKE-RUBIKA-TOKEN-for-tests';
export const API_ROOT = `https://botapi.rubika.ir/v3/${TOKEN}`;
export const UPLOAD_URL = 'https://upload.rubika.example/files/up-1234';

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

/** A successful Rubika answer. */
export const ok = (data: IDataObject = {}): ScriptedResponse => ({ body: { status: 'OK', data } });

/** A Rubika error answer. */
export const fail = (statusDet: string, statusCode = 200): ScriptedResponse => ({
	statusCode,
	body: { status: 'ERROR_GENERIC', status_det: statusDet },
});

export interface BinaryFixture {
	meta: IBinaryData;
	data: Buffer;
}

interface BaseOptions {
	responses: ScriptedResponse[];
	credentials?: IDataObject;
	binaries?: Record<string, BinaryFixture>;
}

const defaultCredentials = (): IDataObject => ({
	accessToken: TOKEN,
	baseUrl: 'https://botapi.rubika.ir/v3',
});

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
		helpers: { httpRequest: http.httpRequest },
	};
	return { context: context as unknown as IWebhookFunctions, http };
}

export interface PollOptions extends BaseOptions {
	params?: Record<string, unknown>;
	mode?: string;
	/** Shared between polls so that the cursor survives like n8n's workflow static data. */
	staticData?: IDataObject;
}

export function makePollContext(options: PollOptions): { context: IPollFunctions; http: HttpRecorder } {
	const http = new HttpRecorder(options.responses);
	const staticData = options.staticData ?? {};
	const context = {
		getMode: () => options.mode ?? 'trigger',
		getNodeParameter: (name: string, fallback?: unknown) => options.params?.[name] ?? fallback,
		getWorkflowStaticData: () => staticData,
		getCredentials: async () => options.credentials ?? defaultCredentials(),
		getNode: () => FAKE_NODE,
		helpers: { httpRequest: http.httpRequest },
	};
	return { context: context as unknown as IPollFunctions, http };
}
