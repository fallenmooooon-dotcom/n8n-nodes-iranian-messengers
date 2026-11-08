import type { IBinaryKeyData, IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { baleApiRequest, downloadFileAsBinary } from './GenericFunctions';
import {
	BaleValidationError,
	MAX_CAPTION_LENGTH,
	MAX_TEXT_LENGTH,
	MEDIA_METHODS,
	maxUploadBytes,
	parseChatId,
	parseJsonObject,
	requireHttpUrl,
	requireNonEmpty,
	requirePositiveInteger,
	requireText,
	validateLength,
} from './helpers';
import type { MediaType, MultipartFile } from './helpers';

/** What an operation returns for one input item. */
export interface OperationResult {
	json: IDataObject;
	binary?: IBinaryKeyData;
}

type Handler = (context: IExecuteFunctions, i: number) => Promise<OperationResult>;

/* -------------------------------------------------------------------------- */
/*  Small helpers                                                             */
/* -------------------------------------------------------------------------- */

/** Normalises the different shapes of a Bale `result` into an item's JSON. */
function toJson(value: unknown): IDataObject {
	if (value === true) {
		return { success: true };
	}
	if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
		return value as IDataObject;
	}
	return { result: value } as IDataObject;
}

function readChatId(context: IExecuteFunctions, i: number): string | number {
	return parseChatId(context.getNodeParameter('chatId', i) as string);
}

function readMessageId(context: IExecuteFunctions, i: number): number {
	return requirePositiveInteger(context.getNodeParameter('messageId', i), 'Message ID');
}

function readUserId(context: IExecuteFunctions, i: number): number {
	return requirePositiveInteger(context.getNodeParameter('userId', i), 'User ID');
}

/** Optional fields shared by several send/edit operations. */
function buildExtras(additional: IDataObject): IDataObject {
	const extras: IDataObject = {};

	const replyTo = Number(additional.replyToMessageId ?? 0);
	if (replyTo > 0) {
		extras.reply_to_message_id = requirePositiveInteger(replyTo, 'Reply To Message ID');
	}

	const markup = additional.replyMarkup;
	if (markup !== undefined && markup !== null && markup !== '') {
		extras.reply_markup = parseJsonObject(markup, 'Reply Markup') as IDataObject;
	}

	const parseMode = typeof additional.parseMode === 'string' ? additional.parseMode.trim() : '';
	if (parseMode !== '') {
		extras.parse_mode = parseMode;
	}

	return extras;
}

function additionalFields(context: IExecuteFunctions, i: number): IDataObject {
	return context.getNodeParameter('additionalFields', i, {}) as IDataObject;
}

/* -------------------------------------------------------------------------- */
/*  Message                                                                   */
/* -------------------------------------------------------------------------- */

async function sendMedia(context: IExecuteFunctions, i: number): Promise<OperationResult> {
	const mediaType = context.getNodeParameter('mediaType', i) as MediaType;
	const source = context.getNodeParameter('mediaSource', i) as 'binary' | 'fileId' | 'url';
	const method = MEDIA_METHODS[mediaType];

	const body: IDataObject = { chat_id: readChatId(context, i) };

	// Bale documents no caption for animations.
	if (mediaType !== 'animation') {
		const caption = context.getNodeParameter('caption', i, '') as string;
		if (caption !== '') {
			validateLength(caption, MAX_CAPTION_LENGTH, 'Caption');
			body.caption = caption;
		}
	}
	Object.assign(body, buildExtras(additionalFields(context, i)));

	if (source === 'binary') {
		const property = requireNonEmpty(
			context.getNodeParameter('binaryPropertyName', i) as string,
			'Binary Property',
		);
		const meta = context.helpers.assertBinaryData(i, property);
		const data = await context.helpers.getBinaryDataBuffer(i, property);

		const limit = maxUploadBytes(mediaType);
		if (data.length > limit) {
			throw new BaleValidationError(
				`The file is ${data.length} bytes; Bale accepts at most ${limit / (1024 * 1024)} MB for this media type`,
			);
		}

		const override = (context.getNodeParameter('fileName', i, '') as string).trim();
		const file: MultipartFile = {
			fieldName: mediaType,
			fileName: override !== '' ? override : (meta.fileName ?? mediaType),
			contentType: meta.mimeType || 'application/octet-stream',
			data,
		};
		return { json: toJson(await baleApiRequest.call(context, method, body, [file])) };
	}

	body[mediaType] =
		source === 'fileId'
			? requireNonEmpty(context.getNodeParameter('mediaFileId', i) as string, 'File ID')
			: requireHttpUrl(context.getNodeParameter('mediaUrl', i) as string, 'URL');
	return { json: toJson(await baleApiRequest.call(context, method, body)) };
}

const messageHandlers: Record<string, Handler> = {
	'message.sendText': async (context, i) => {
		const text = requireText(context.getNodeParameter('text', i) as string, 'Text', MAX_TEXT_LENGTH);
		const body: IDataObject = {
			chat_id: readChatId(context, i),
			text,
			...buildExtras(additionalFields(context, i)),
		};
		return { json: toJson(await baleApiRequest.call(context, 'sendMessage', body)) };
	},

	'message.sendMedia': sendMedia,

	'message.sendLocation': async (context, i) => {
		const latitude = Number(context.getNodeParameter('latitude', i));
		const longitude = Number(context.getNodeParameter('longitude', i));
		if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
			throw new BaleValidationError('Latitude must be a number between -90 and 90');
		}
		if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
			throw new BaleValidationError('Longitude must be a number between -180 and 180');
		}
		const additional = additionalFields(context, i);
		const body: IDataObject = {
			chat_id: readChatId(context, i),
			latitude,
			longitude,
			...buildExtras(additional),
		};
		const accuracy = Number(additional.horizontalAccuracy ?? 0);
		if (accuracy > 0) {
			if (accuracy > 1500) {
				throw new BaleValidationError('Horizontal Accuracy must be between 0 and 1500 meters');
			}
			body.horizontal_accuracy = accuracy;
		}
		return { json: toJson(await baleApiRequest.call(context, 'sendLocation', body)) };
	},

	'message.sendContact': async (context, i) => {
		const additional = additionalFields(context, i);
		const body: IDataObject = {
			chat_id: readChatId(context, i),
			phone_number: requireNonEmpty(context.getNodeParameter('phoneNumber', i) as string, 'Phone Number'),
			first_name: requireNonEmpty(context.getNodeParameter('firstName', i) as string, 'First Name'),
			...buildExtras(additional),
		};
		const lastName = typeof additional.lastName === 'string' ? additional.lastName.trim() : '';
		if (lastName !== '') {
			body.last_name = lastName;
		}
		return { json: toJson(await baleApiRequest.call(context, 'sendContact', body)) };
	},

	'message.forward': async (context, i) => {
		const body: IDataObject = {
			chat_id: readChatId(context, i),
			from_chat_id: parseChatId(context.getNodeParameter('fromChatId', i) as string),
			message_id: readMessageId(context, i),
		};
		return { json: toJson(await baleApiRequest.call(context, 'forwardMessage', body)) };
	},

	'message.copy': async (context, i) => {
		const body: IDataObject = {
			chat_id: readChatId(context, i),
			from_chat_id: parseChatId(context.getNodeParameter('fromChatId', i) as string),
			message_id: readMessageId(context, i),
		};
		return { json: toJson(await baleApiRequest.call(context, 'copyMessage', body)) };
	},

	'message.editText': async (context, i) => {
		const text = requireText(context.getNodeParameter('text', i) as string, 'Text', MAX_TEXT_LENGTH);
		const body: IDataObject = {
			chat_id: readChatId(context, i),
			message_id: readMessageId(context, i),
			text,
			...buildExtras(additionalFields(context, i)),
		};
		return { json: toJson(await baleApiRequest.call(context, 'editMessageText', body)) };
	},

	'message.delete': async (context, i) => {
		const body: IDataObject = { chat_id: readChatId(context, i), message_id: readMessageId(context, i) };
		return { json: toJson(await baleApiRequest.call(context, 'deleteMessage', body)) };
	},
};

/* -------------------------------------------------------------------------- */
/*  Other resources                                                           */
/* -------------------------------------------------------------------------- */

const otherHandlers: Record<string, Handler> = {
	'bot.getMe': async (context) => ({ json: toJson(await baleApiRequest.call(context, 'getMe')) }),

	'callbackQuery.answer': async (context, i) => {
		const additional = additionalFields(context, i);
		const body: IDataObject = {
			callback_query_id: requireNonEmpty(
				context.getNodeParameter('callbackQueryId', i) as string,
				'Callback Query ID',
			),
		};
		if (typeof additional.text === 'string' && additional.text !== '') {
			body.text = additional.text;
		}
		if (additional.showAlert === true) {
			body.show_alert = true;
		}
		return { json: toJson(await baleApiRequest.call(context, 'answerCallbackQuery', body)) };
	},

	'file.get': async (context, i) => {
		const fileId = requireNonEmpty(context.getNodeParameter('fileId', i) as string, 'File ID');
		if (context.getNodeParameter('download', i, false) as boolean) {
			const property = requireNonEmpty(
				context.getNodeParameter('binaryPropertyName', i) as string,
				'Binary Property',
			);
			const { file, binary } = await downloadFileAsBinary.call(context, fileId);
			return { json: file, binary: { [property]: binary } };
		}
		return { json: toJson(await baleApiRequest.call(context, 'getFile', { file_id: fileId })) };
	},

	'chat.get': async (context, i) => ({
		json: toJson(await baleApiRequest.call(context, 'getChat', { chat_id: readChatId(context, i) })),
	}),

	'chat.getMemberCount': async (context, i) => {
		const count = await baleApiRequest.call(context, 'getChatMembersCount', {
			chat_id: readChatId(context, i),
		});
		return { json: { count } as IDataObject };
	},

	'chat.leave': async (context, i) => ({
		json: toJson(await baleApiRequest.call(context, 'leaveChat', { chat_id: readChatId(context, i) })),
	}),

	'chat.pinMessage': async (context, i) => ({
		json: toJson(
			await baleApiRequest.call(context, 'pinChatMessage', {
				chat_id: readChatId(context, i),
				message_id: readMessageId(context, i),
			}),
		),
	}),

	'chat.unpinMessage': async (context, i) => ({
		json: toJson(
			await baleApiRequest.call(context, 'unPinChatMessage', {
				chat_id: readChatId(context, i),
				message_id: readMessageId(context, i),
			}),
		),
	}),

	'chat.unpinAllMessages': async (context, i) => ({
		json: toJson(
			await baleApiRequest.call(context, 'unpinAllChatMessages', { chat_id: readChatId(context, i) }),
		),
	}),

	'chatMember.ban': async (context, i) => ({
		json: toJson(
			await baleApiRequest.call(context, 'banChatMember', {
				chat_id: readChatId(context, i),
				user_id: readUserId(context, i),
			}),
		),
	}),

	'chatMember.unban': async (context, i) => {
		const body: IDataObject = { chat_id: readChatId(context, i), user_id: readUserId(context, i) };
		if (additionalFields(context, i).onlyIfBanned === true) {
			body.only_if_banned = true;
		}
		return { json: toJson(await baleApiRequest.call(context, 'unbanChatMember', body)) };
	},
};

const handlers: Record<string, Handler> = { ...messageHandlers, ...otherHandlers };

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
