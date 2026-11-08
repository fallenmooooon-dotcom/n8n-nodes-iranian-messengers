import type { IBinaryKeyData, IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { rubikaApiRequest, rubikaDownloadFile, rubikaUploadFile } from './GenericFunctions';
import {
	FILE_TYPES,
	RubikaValidationError,
	assertFileSize,
	buildMetadata,
	parseCoordinate,
	requireNonEmpty,
	requireText,
	validateKeypad,
} from './helpers';
import type { MetadataPartInput } from './helpers';

/** What an operation returns for one input item. */
export interface OperationResult {
	json: IDataObject;
	binary?: IBinaryKeyData;
}

type Handler = (context: IExecuteFunctions, i: number) => Promise<OperationResult>;

/* -------------------------------------------------------------------------- */
/*  Small helpers                                                             */
/* -------------------------------------------------------------------------- */

/** Rubika answers some calls with an empty `data` object; report those as a success. */
function toJson(data: IDataObject): IDataObject {
	return Object.keys(data).length === 0 ? { success: true } : data;
}

function readText(context: IExecuteFunctions, i: number, name: string, label: string): string {
	return requireNonEmpty(context.getNodeParameter(name, i) as string, label);
}

function readChatId(context: IExecuteFunctions, i: number): string {
	return readText(context, i, 'chatId', 'Chat ID');
}

function readMessageId(context: IExecuteFunctions, i: number): string {
	return readText(context, i, 'messageId', 'Message ID');
}

function additionalFields(context: IExecuteFunctions, i: number): IDataObject {
	return context.getNodeParameter('additionalFields', i, {}) as IDataObject;
}

function readFormattingParts(additional: IDataObject): MetadataPartInput[] {
	const formatting = additional.formatting as IDataObject | undefined;
	const parts = (formatting?.parts ?? []) as IDataObject[];
	return parts.map((part) => ({
		type: String(part.type ?? ''),
		fromIndex: Number(part.fromIndex ?? 0),
		length: Number(part.length ?? 0),
		linkUrl: typeof part.linkUrl === 'string' ? part.linkUrl : undefined,
		mentionUserId: typeof part.mentionUserId === 'string' ? part.mentionUserId : undefined,
	}));
}

/**
 * Optional fields shared by the send operations: reply, silent mode, keypads and (for text
 * messages) formatting.
 */
function buildExtras(additional: IDataObject, text?: string): IDataObject {
	const extras: IDataObject = {};

	if (typeof additional.replyToMessageId === 'string' && additional.replyToMessageId.trim() !== '') {
		extras.reply_to_message_id = additional.replyToMessageId.trim();
	}
	if (additional.disableNotification === true) {
		extras.disable_notification = true;
	}

	const chatKeypad = additional.chatKeypad;
	const hasChatKeypad = chatKeypad !== undefined && chatKeypad !== null && chatKeypad !== '';
	if (hasChatKeypad && additional.removeChatKeypad === true) {
		throw new RubikaValidationError('Use either Chat Keypad (JSON) or Remove Chat Keypad, not both');
	}
	if (hasChatKeypad) {
		extras.chat_keypad = validateKeypad(chatKeypad, 'Chat Keypad');
		extras.chat_keypad_type = 'New';
	} else if (additional.removeChatKeypad === true) {
		extras.chat_keypad_type = 'Remove';
	}

	const inlineKeypad = additional.inlineKeypad;
	if (inlineKeypad !== undefined && inlineKeypad !== null && inlineKeypad !== '') {
		extras.inline_keypad = validateKeypad(inlineKeypad, 'Inline Keypad');
	}

	if (text !== undefined) {
		const parts = readFormattingParts(additional);
		if (parts.length > 0) {
			extras.metadata = buildMetadata(text, parts);
		}
	}
	return extras;
}

/* -------------------------------------------------------------------------- */
/*  Message                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The Rubika reference names this method `editMessageKeypad`, but its curl example calls the URL
 * `editInlineKeypad`. The documented method name is used; change it here if your bot answers
 * with INVALID_INPUT for the other spelling.
 */
const EDIT_KEYPAD_METHOD = 'editMessageKeypad';

const messageHandlers: Record<string, Handler> = {
	'message.sendText': async (context, i) => {
		const text = requireText(context.getNodeParameter('text', i) as string, 'Text');
		const body: IDataObject = {
			chat_id: readChatId(context, i),
			text,
			...buildExtras(additionalFields(context, i), text),
		};
		return { json: toJson(await rubikaApiRequest.call(context, 'sendMessage', body)) };
	},

	'message.sendPoll': async (context, i) => {
		const question = readText(context, i, 'question', 'Question');
		const raw = context.getNodeParameter('pollOptions', i, {}) as IDataObject;
		const items = (raw.items ?? []) as IDataObject[];
		const options = items.map((item) => String(item.text ?? '').trim()).filter((text) => text !== '');
		if (options.length < 2) {
			throw new RubikaValidationError('A poll needs at least two options');
		}
		const body: IDataObject = { chat_id: readChatId(context, i), question, options };
		return { json: toJson(await rubikaApiRequest.call(context, 'sendPoll', body)) };
	},

	'message.sendLocation': async (context, i) => {
		const body: IDataObject = {
			chat_id: readChatId(context, i),
			latitude: parseCoordinate(context.getNodeParameter('latitude', i), 'Latitude', 90),
			longitude: parseCoordinate(context.getNodeParameter('longitude', i), 'Longitude', 180),
			...buildExtras(additionalFields(context, i)),
		};
		return { json: toJson(await rubikaApiRequest.call(context, 'sendLocation', body)) };
	},

	'message.sendContact': async (context, i) => {
		const body: IDataObject = {
			chat_id: readChatId(context, i),
			first_name: readText(context, i, 'firstName', 'First Name'),
			phone_number: readText(context, i, 'phoneNumber', 'Phone Number'),
			...buildExtras(additionalFields(context, i)),
		};
		const lastName = (context.getNodeParameter('lastName', i, '') as string).trim();
		if (lastName !== '') {
			body.last_name = lastName;
		}
		return { json: toJson(await rubikaApiRequest.call(context, 'sendContact', body)) };
	},

	'message.forward': async (context, i) => {
		const body: IDataObject = {
			from_chat_id: readText(context, i, 'fromChatId', 'From Chat ID'),
			message_id: readMessageId(context, i),
			to_chat_id: readText(context, i, 'toChatId', 'To Chat ID'),
		};
		if (additionalFields(context, i).disableNotification === true) {
			body.disable_notification = true;
		}
		return { json: toJson(await rubikaApiRequest.call(context, 'forwardMessage', body)) };
	},

	'message.editText': async (context, i) => {
		const body: IDataObject = {
			chat_id: readChatId(context, i),
			message_id: readMessageId(context, i),
			text: requireText(context.getNodeParameter('text', i) as string, 'Text'),
		};
		return { json: toJson(await rubikaApiRequest.call(context, 'editMessageText', body)) };
	},

	'message.editInlineKeypad': async (context, i) => {
		const body: IDataObject = {
			chat_id: readChatId(context, i),
			message_id: readMessageId(context, i),
			inline_keypad: validateKeypad(context.getNodeParameter('inlineKeypad', i), 'Inline Keypad'),
		};
		try {
			return { json: toJson(await rubikaApiRequest.call(context, EDIT_KEYPAD_METHOD, body)) };
		} catch (error) {
			const httpCode = (error as { httpCode?: string }).httpCode;
			if (httpCode === '404') {
				return { json: toJson(await rubikaApiRequest.call(context, 'editInlineKeypad', body)) };
			}
			throw error;
		}
	},

	'message.delete': async (context, i) => {
		const body: IDataObject = { chat_id: readChatId(context, i), message_id: readMessageId(context, i) };
		return { json: toJson(await rubikaApiRequest.call(context, 'deleteMessage', body)) };
	},
};

/* -------------------------------------------------------------------------- */
/*  File                                                                      */
/* -------------------------------------------------------------------------- */

const fileHandlers: Record<string, Handler> = {
	'file.send': async (context, i) => {
		const fileType = context.getNodeParameter('fileType', i) as string;
		if (!FILE_TYPES.includes(fileType)) {
			throw new RubikaValidationError(`File Type must be one of ${FILE_TYPES.join(', ')}`);
		}
		const source = context.getNodeParameter('fileSource', i) as 'binary' | 'fileId';
		const chatId = readChatId(context, i);
		const additional = additionalFields(context, i);

		let fileId: string;
		if (source === 'fileId') {
			fileId = readText(context, i, 'sendFileId', 'File ID');
		} else {
			const property = readText(context, i, 'binaryPropertyName', 'Input Binary Field');
			const meta = context.helpers.assertBinaryData(i, property);
			const data = await context.helpers.getBinaryDataBuffer(i, property);
			assertFileSize(fileType, data.length);

			// Step 1: ask Rubika for an upload address.
			const request = await rubikaApiRequest.call(context, 'requestSendFile', { type: fileType });
			const uploadUrl = typeof request.upload_url === 'string' ? request.upload_url : '';
			if (uploadUrl === '') {
				throw new NodeOperationError(context.getNode(), 'Rubika did not return an upload_url', {
					itemIndex: i,
				});
			}

			// Step 2: upload the bytes.
			const override = (context.getNodeParameter('fileName', i, '') as string).trim();
			fileId = await rubikaUploadFile.call(context, uploadUrl, {
				fieldName: 'file',
				fileName: override !== '' ? override : (meta.fileName ?? 'file'),
				contentType: meta.mimeType || 'application/octet-stream',
				data,
			});
		}

		// Step 3: send the uploaded file.
		const body: IDataObject = { chat_id: chatId, file_id: fileId, ...buildExtras(additional) };
		if (typeof additional.caption === 'string' && additional.caption !== '') {
			body.text = additional.caption;
		}
		const sent = await rubikaApiRequest.call(context, 'sendFile', body);
		return { json: { ...sent, file_id: fileId } };
	},

	'file.get': async (context, i) => {
		const fileId = readText(context, i, 'fileId', 'File ID');
		const info = await rubikaApiRequest.call(context, 'getFile', { file_id: fileId });
		if (context.getNodeParameter('download', i, false) as boolean) {
			const downloadUrl = typeof info.download_url === 'string' ? info.download_url : '';
			if (downloadUrl === '') {
				throw new NodeOperationError(context.getNode(), 'Rubika did not return a download_url', {
					itemIndex: i,
				});
			}
			const property = readText(context, i, 'downloadBinaryPropertyName', 'Put Output File in Field');
			const binary = await rubikaDownloadFile.call(context, downloadUrl, fileId);
			return { json: { file_id: fileId }, binary: { [property]: binary } };
		}
		return { json: toJson({ file_id: fileId, ...info }) };
	},
};

/* -------------------------------------------------------------------------- */
/*  Other resources                                                           */
/* -------------------------------------------------------------------------- */

const otherHandlers: Record<string, Handler> = {
	'bot.getMe': async (context) => ({ json: toJson(await rubikaApiRequest.call(context, 'getMe')) }),

	'bot.setCommands': async (context, i) => {
		const raw = context.getNodeParameter('commands', i, {}) as IDataObject;
		const items = (raw.items ?? []) as IDataObject[];
		if (items.length === 0) {
			throw new RubikaValidationError('Add at least one command');
		}
		const botCommands = items.map((item, index) => ({
			command: requireNonEmpty(String(item.command ?? '').replace(/^\/+/, ''), `Command ${index + 1}`),
			description: requireNonEmpty(String(item.description ?? ''), `Description of command ${index + 1}`),
		}));
		const body = { bot_commands: botCommands } as unknown as IDataObject;
		return { json: toJson(await rubikaApiRequest.call(context, 'setCommands', body)) };
	},

	'chat.get': async (context, i) => ({
		json: toJson(await rubikaApiRequest.call(context, 'getChat', { chat_id: readChatId(context, i) })),
	}),

	'chat.setKeypad': async (context, i) => {
		const body: IDataObject = {
			chat_id: readChatId(context, i),
			chat_keypad_type: 'New',
			chat_keypad: validateKeypad(context.getNodeParameter('chatKeypad', i), 'Chat Keypad'),
		};
		return { json: toJson(await rubikaApiRequest.call(context, 'editChatKeypad', body)) };
	},

	'chat.removeKeypad': async (context, i) => ({
		json: toJson(
			await rubikaApiRequest.call(context, 'editChatKeypad', {
				chat_id: readChatId(context, i),
				chat_keypad_type: 'Remove',
			}),
		),
	}),

	'chatMember.ban': async (context, i) => ({
		json: toJson(
			await rubikaApiRequest.call(context, 'banChatMember', {
				chat_id: readChatId(context, i),
				user_id: readText(context, i, 'userId', 'User ID'),
			}),
		),
	}),

	'chatMember.unban': async (context, i) => ({
		json: toJson(
			await rubikaApiRequest.call(context, 'unbanChatMember', {
				chat_id: readChatId(context, i),
				user_id: readText(context, i, 'userId', 'User ID'),
			}),
		),
	}),
};

const handlers: Record<string, Handler> = {
	...messageHandlers,
	...fileHandlers,
	...otherHandlers,
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
