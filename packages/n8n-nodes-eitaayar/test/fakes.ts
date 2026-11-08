/**
 * Minimal fake of the n8n execute context, used by the unit tests. It records every HTTP
 * request and replays scripted responses, so the tests never touch the network and never need
 * a real token.
 */
import type {
	IBinaryData,
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	INode,
	INodeExecutionData,
} from 'n8n-workflow';

export const FAKE_NODE: INode = {
	id: 'node-1',
	name: 'Eitaa (EitaaYar)',
	typeVersion: 1,
	type: 'n8n-nodes-eitaayar.eitaaYar',
	position: [0, 0],
	parameters: {},
};

/** A fake token. The leading "bot" is what the EitaaYar dashboard shows and must be normalised. */
export const CLEAN_TOKEN = '123456:00000000-0000-4000-8000-000000000000';
export const RAW_TOKEN = `bot${CLEAN_TOKEN}`;
export const API_ROOT = `https://eitaayar.ir/api/bot${CLEAN_TOKEN}`;

export interface ScriptedResponse {
	body?: unknown;
	statusCode?: number;
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
		return { body: next.body, statusCode: next.statusCode ?? 200, headers: {} };
	};
}

/** A successful EitaaYar answer. */
export const ok = (result?: unknown): ScriptedResponse => ({
	body: result === undefined ? { ok: true } : { ok: true, result },
});

/** A failed EitaaYar answer. */
export const fail = (description: string, statusCode = 400): ScriptedResponse => ({
	statusCode,
	body: { ok: false, description },
});

export interface BinaryFixture {
	meta: IBinaryData;
	data: Buffer;
}

export interface ExecuteOptions {
	/** One parameter bag for all items, or one per item. */
	params: Record<string, unknown> | Array<Record<string, unknown>>;
	responses: ScriptedResponse[];
	items?: INodeExecutionData[];
	credentials?: IDataObject;
	binaries?: Record<string, BinaryFixture>;
	continueOnFail?: boolean;
}

export function makeExecuteContext(options: ExecuteOptions): {
	context: IExecuteFunctions;
	http: HttpRecorder;
} {
	const http = new HttpRecorder(options.responses);
	const items = options.items ?? [{ json: {} }];
	const binaries = options.binaries ?? {};
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
		getCredentials: async () =>
			options.credentials ?? { accessToken: RAW_TOKEN, baseUrl: 'https://eitaayar.ir/api' },
		getNode: () => FAKE_NODE,
		continueOnFail: () => options.continueOnFail ?? false,
		helpers: {
			httpRequest: http.httpRequest,
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
		},
	};
	return { context: context as unknown as IExecuteFunctions, http };
}
