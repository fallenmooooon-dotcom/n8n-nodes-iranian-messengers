import type { INodeProperties } from 'n8n-workflow';

const DELETE_AFTER_VIEWS_FIELD: INodeProperties = {
	displayName: 'Delete After Views',
	name: 'viewCountForDelete',
	type: 'number',
	typeOptions: { minValue: 0 },
	default: 0,
	description:
		'Delete the message automatically once it has this many views (leave at 0 to keep the message)',
};

const DISABLE_NOTIFICATION_FIELD: INodeProperties = {
	displayName: 'Disable Notification',
	name: 'disableNotification',
	type: 'boolean',
	default: false,
	description: 'Whether to send the message silently',
};

const PIN_FIELD: INodeProperties = {
	displayName: 'Pin',
	name: 'pin',
	type: 'boolean',
	default: false,
	description: 'Whether to pin the message in the channel',
};

const REPLY_TO_FIELD: INodeProperties = {
	displayName: 'Reply To Message ID',
	name: 'replyToMessageId',
	type: 'number',
	typeOptions: { minValue: 0 },
	default: 0,
	description: 'ID of the message to reply to (leave at 0 to send a normal message)',
};

const SCHEDULE_DATE_FIELD: INodeProperties = {
	displayName: 'Schedule Date',
	name: 'scheduleDate',
	type: 'dateTime',
	default: '',
	description: 'Date and time when the message is sent (leave empty to send it immediately)',
};

const TITLE_FIELD: INodeProperties = {
	displayName: 'Title',
	name: 'title',
	type: 'string',
	default: '',
	description: 'Title shown only inside the EitaaYar panel, for your own tracking',
};

export const eitaaYarProperties: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Bot', value: 'bot' },
			{ name: 'Message', value: 'message' },
		],
		default: 'message',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['bot'] } },
		options: [
			{
				name: 'Get Me',
				value: 'getMe',
				action: 'Get information about the account',
				description: 'Get basic information about the EitaaYar account behind the token',
			},
		],
		default: 'getMe',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['message'] } },
		options: [
			{
				name: 'Send File',
				value: 'sendFile',
				action: 'Send a file',
				description: 'Send a file to a channel or group',
			},
			{
				name: 'Send Text',
				value: 'sendText',
				action: 'Send a text message',
				description: 'Send a text message to a channel or group',
			},
		],
		default: 'sendText',
	},
	{
		displayName: 'Chat ID',
		name: 'chatId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['message'] } },
		description:
			'Channel or group identifier from your EitaaYar panel, or the channel username with or without @',
	},
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		typeOptions: { rows: 4 },
		required: true,
		default: '',
		displayOptions: { show: { resource: ['message'], operation: ['sendText'] } },
		description: 'Text of the message',
	},
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		displayOptions: { show: { resource: ['message'], operation: ['sendFile'] } },
		description: 'Name of the binary property that holds the file to send',
	},
	{
		displayName: 'File Name',
		name: 'fileName',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: ['message'], operation: ['sendFile'] } },
		description:
			'Optional file name to send (EitaaYar picks the kind of media from the extension, so a GIF needs .gif and a sticker needs .webp)',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['message'], operation: ['sendText'] } },
		options: [
			DELETE_AFTER_VIEWS_FIELD,
			DISABLE_NOTIFICATION_FIELD,
			PIN_FIELD,
			REPLY_TO_FIELD,
			SCHEDULE_DATE_FIELD,
			TITLE_FIELD,
		],
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['message'], operation: ['sendFile'] } },
		options: [
			{
				displayName: 'Caption',
				name: 'caption',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				description: 'Text sent together with the file',
			},
			DELETE_AFTER_VIEWS_FIELD,
			DISABLE_NOTIFICATION_FIELD,
			PIN_FIELD,
			REPLY_TO_FIELD,
			SCHEDULE_DATE_FIELD,
			TITLE_FIELD,
		],
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		options: [
			{
				displayName: 'Delay Between Items (Ms)',
				name: 'delayBetweenItems',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 0,
				description:
					'Milliseconds to wait between two input items (useful when sending many messages in a row)',
			},
		],
	},
];
