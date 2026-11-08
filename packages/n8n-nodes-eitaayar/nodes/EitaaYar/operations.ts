import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { eitaaApiRequest } from './GenericFunctions';
import { buildSendFields, requireNonEmpty, requireText } from './helpers';
import type { SendOptions } from './helpers';

/** What an operation returns for one input item. */
export interface OperationResult {
	json: IDataObject;
}

type Handler = (context: IExecuteFunctions, i: number) => Promise<OperationResult>;

/** Some calls answer without a result object; report those as a success. */
function toJson(data: IDataObject): IDataObject {
	return Object.keys(data).length === 0 ? { success: true } : data;
}

function readSendOptions(additional: IDataObject): SendOptions {
	return {
		title: typeof additional.title === 'string' ? additional.title : undefined,
		pin: additional.pin === true,
		disableNotification: additional.disableNotification === true,
		replyToMessageId: Number(additional.replyToMessageId ?? 0),
		scheduleDate: typeof additional.scheduleDate === 'string' ? additional.scheduleDate : undefined,
		viewCountForDelete: Number(additional.viewCountForDelete ?? 0),
	};
}

const handlers: Record<string, Handler> = {
	'bot.getMe': async (context) => ({ json: toJson(await eitaaApiRequest.call(context, 'getMe')) }),

	'message.sendText': async (context, i) => {
		const additional = context.getNodeParameter('additionalFields', i, {}) as IDataObject;
		const body: IDataObject = {
			chat_id: requireNonEmpty(context.getNodeParameter('chatId', i) as string, 'Chat ID'),
			text: requireText(context.getNodeParameter('text', i) as string, 'Text'),
			...buildSendFields(readSendOptions(additional)),
		};
		return { json: toJson(await eitaaApiRequest.call(context, 'sendMessage', body)) };
	},

	'message.sendFile': async (context, i) => {
		const additional = context.getNodeParameter('additionalFields', i, {}) as IDataObject;
		const property = requireNonEmpty(
			context.getNodeParameter('binaryPropertyName', i) as string,
			'Input Binary Field',
		);
		const meta = context.helpers.assertBinaryData(i, property);
		const data = await context.helpers.getBinaryDataBuffer(i, property);

		const override = (context.getNodeParameter('fileName', i, '') as string).trim();
		const body: IDataObject = {
			chat_id: requireNonEmpty(context.getNodeParameter('chatId', i) as string, 'Chat ID'),
			...buildSendFields(readSendOptions(additional)),
		};
		if (typeof additional.caption === 'string' && additional.caption !== '') {
			body.caption = additional.caption;
		}
		return {
			json: toJson(
				await eitaaApiRequest.call(context, 'sendFile', body, [
					{
						fieldName: 'file',
						fileName: override !== '' ? override : (meta.fileName ?? 'file'),
						contentType: meta.mimeType || 'application/octet-stream',
						data,
					},
				]),
			),
		};
	},
};

/** Runs one operation for one input item. */
export async function executeOperation(
	context: IExecuteFunctions,
	i: number,
	resource: string,
	operation: string,
): Promise<OperationResult> {
	const handler = handlers[`${resource}.${operation}`];
	if (handler === undefined) {
		throw new NodeOperationError(
			context.getNode(),
			`The operation "${operation}" is not supported for the resource "${resource}"`,
			{ itemIndex: i },
		);
	}
	return handler(context, i);
}
