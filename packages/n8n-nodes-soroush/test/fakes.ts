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
	name: 'Soroush Plus',
	typeVersion: 1,
	type: 'n8n-nodes-soroush.soroush',
	position: [0, 0],
	parameters: {},
};

export const TOKEN = '123456:FAKE-SOROUSH-TOKEN-for-tests';
export const CLEAN_TOKEN = '123456:FAKE-SOROUSH-TOKEN-for-tests';
export const API_ROOT = `https://api.splus.ir/bot${CLEAN_TOKEN}`;

export interface ScriptedResponse {
	body?: unknown;
	statusCode?: number;
	headers?: Record<string, unknown>;
	error?: Error;
}

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

export const ok = (result: unknown = true): ScriptedResponse => ({
	body: { ok: true, result },
});

export const fail = (description: string, errorCode = 400, statusCode = 200): ScriptedResponse => ({
	statusCode,
	body: { ok: false, error_code: errorCode, description },
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
	baseUrl: 'https://api.splus.ir',
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
			mimeType: mimeType ?? 'application/octet-stream',
			fileName,
		}),
	};
}

export interface ExecuteOptions extends BaseOptions {
	params: IDataObject;
	items?: INodeExecutionData[];
	continueOnFail?: boolean;
}

export function makeExecuteContext(options: ExecuteOptions): {
	context: IExecuteFunctions;
	http: HttpRecorder;
} {
	const http = new HttpRecorder(options.responses);
	const binaries = options.binaries ?? {};
	const items = options.items ?? [{ json: {} }];
	const credentials = { ...defaultCredentials(), ...(options.credentials ?? {}) };

	const context = {
		getNode: () => FAKE_NODE,
		getInputData: () => items,
		getNodeParameter: (name: string, _itemIndex: number, fallback?: unknown) =>
			options.params[name] ?? fallback,
		getCredentials: async () => credentials,
		continueOnFail: () => options.continueOnFail ?? false,
		helpers: {
			httpRequest: http.httpRequest,
			...binaryHelpers(binaries),
		},
	} as unknown as IExecuteFunctions;

	return { context, http };
}

export interface HookOptions extends BaseOptions {
	webhookUrl?: string;
}

export function makeHookContext(options: HookOptions): {
	context: IHookFunctions;
	http: HttpRecorder;
} {
	const http = new HttpRecorder(options.responses);
	const credentials = { ...defaultCredentials(), ...(options.credentials ?? {}) };
	const webhookUrl = options.webhookUrl ?? 'https://n8n.example.com/webhook/test';

	const context = {
		getNode: () => FAKE_NODE,
		getNodeWebhookUrl: () => webhookUrl,
		getNodeParameter: (_name: string, fallback?: unknown) => fallback,
		getCredentials: async () => credentials,
		helpers: { httpRequest: http.httpRequest },
	} as unknown as IHookFunctions;

	return { context, http };
}

export interface WebhookContextOptions extends BaseOptions {
	body: IDataObject;
	params?: IDataObject;
}

export function makeWebhookContext(options: WebhookContextOptions): {
	context: IWebhookFunctions;
	http: HttpRecorder;
} {
	const http = new HttpRecorder(options.responses);
	const credentials = { ...defaultCredentials(), ...(options.credentials ?? {}) };
	const params = options.params ?? {};
	const binaries = options.binaries ?? {};

	const context = {
		getNode: () => FAKE_NODE,
		getBodyData: () => options.body,
		getNodeParameter: (name: string, fallback?: unknown) => params[name] ?? fallback,
		getCredentials: async () => credentials,
		helpers: {
			httpRequest: http.httpRequest,
			...binaryHelpers(binaries),
		},
	} as unknown as IWebhookFunctions;

	return { context, http };
}

export interface PollContextOptions extends BaseOptions {
	params?: IDataObject;
	staticData?: IDataObject;
	mode?: string;
}

export function makePollContext(options: PollContextOptions): {
	context: IPollFunctions;
	http: HttpRecorder;
	staticData: IDataObject;
} {
	const http = new HttpRecorder(options.responses);
	const credentials = { ...defaultCredentials(), ...(options.credentials ?? {}) };
	const params = options.params ?? {};
	const staticData = options.staticData ?? {};

	const context = {
		getNode: () => FAKE_NODE,
		getNodeParameter: (name: string, fallback?: unknown) => params[name] ?? fallback,
		getWorkflowStaticData: () => staticData,
		getMode: () => options.mode ?? 'trigger',
		getCredentials: async () => credentials,
		helpers: { httpRequest: http.httpRequest },
	} as unknown as IPollFunctions;

	return { context, http, staticData };
}
