import type { INodeProperties } from 'n8n-workflow';

const KEYPAD_NOTE =
	'JSON object in the Rubika Keypad format: {"rows": [{"buttons": [{"id": "1", "type": "Simple", "button_text": "Text"}]}]}';

const CHAT_KEYPAD_FIELD: INodeProperties = {
	displayName: 'Chat Keypad (JSON)',
	name: 'chatKeypad',
	type: 'string',
	typeOptions: { rows: 4 },
	default: '',
	description: `Keypad shown at the bottom of the chat. ${KEYPAD_NOTE}. Button taps arrive as new messages`,
};

const DISABLE_NOTIFICATION_FIELD: INodeProperties = {
	displayName: 'Disable Notification',
	name: 'disableNotification',
	type: 'boolean',
	default: false,
	description: 'Whether to send the message without a notification sound',
};

const INLINE_KEYPAD_FIELD: INodeProperties = {
	displayName: 'Inline Keypad (JSON)',
	name: 'inlineKeypad',
	type: 'string',
	typeOptions: { rows: 4 },
	default: '',
	description: `Buttons shown under the message. ${KEYPAD_NOTE}. Button taps arrive as inline messages`,
};

const REMOVE_CHAT_KEYPAD_FIELD: INodeProperties = {
	displayName: 'Remove Chat Keypad',
	name: 'removeChatKeypad',
	type: 'boolean',
	default: false,
	description: 'Whether to remove the chat keypad that is currently shown in the chat',
};

const REPLY_TO_FIELD: INodeProperties = {
	displayName: 'Reply To Message ID',
	name: 'replyToMessageId',
	type: 'string',
	default: '',
	description: 'ID of the message to reply to. Leave empty to send a normal message',
};

const FORMATTING_FIELD: INodeProperties = {
	displayName: 'Formatting',
	name: 'formatting',
	type: 'fixedCollection',
	typeOptions: { multipleValues: true },
	placeholder: 'Add Formatting Part',
	default: {},
	description:
		'Styles, links and mentions applied to parts of the text (up to 30). One invalid part makes Rubika reject the whole message',
	options: [
		{
			displayName: 'Parts',
			name: 'parts',
			values: [
				{
					displayName: 'Type',
					name: 'type',
					type: 'options',
					default: 'Bold',
					options: [
						{ name: 'Bold', value: 'Bold' },
						{ name: 'Code Block', value: 'Pre' },
						{ name: 'Italic', value: 'Italic' },
						{ name: 'Link', value: 'Link' },
						{ name: 'Mention (Groups Only)', value: 'MentionText' },
						{ name: 'Monospace', value: 'Mono' },
						{ name: 'Quote', value: 'Quote' },
						{ name: 'Spoiler', value: 'Spoiler' },
						{ name: 'Strikethrough', value: 'Strike' },
						{ name: 'Underline', value: 'Underline' },
					],
					description: 'Kind of formatting to apply',
				},
				{
					displayName: 'From Index',
					name: 'fromIndex',
					type: 'number',
					default: 0,
					description:
						'Position where the formatted part starts (0 is the first character). Counted in UTF-16 units, so an emoji counts as 2',
				},
				{
					displayName: 'Length',
					name: 'length',
					type: 'number',
					default: 1,
					description: 'Length of the formatted part in UTF-16 units. Must be greater than 0',
				},
				{
					displayName: 'Link URL',
					name: 'linkUrl',
					type: 'string',
					default: '',
					description: 'Target of the link. Only used by the type Link',
				},
				{
					displayName: 'Mention User ID',
					name: 'mentionUserId',
					type: 'string',
					default: '',
					description: 'ID of the mentioned user. Only used by the type Mention',
				},
			],
		},
	],
};

export const rubikaProperties: INodeProperties[] = [
	/* ---------------------------------------------------------------------- */
	/*  Resource and operations                                               */
	/* ---------------------------------------------------------------------- */
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Bot', value: 'bot' },
			{ name: 'Chat', value: 'chat' },
			{ name: 'Chat Member', value: 'chatMember' },
			{ name: 'File', value: 'file' },
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
				action: 'Get information about the bot',
				description: 'Get basic information about the bot',
			},
			{
				name: 'Set Commands',
				value: 'setCommands',
				action: 'Set the bot commands',
				description: 'Define the commands shown when users type a slash',
			},
		],
		default: 'getMe',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['chat'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get a chat',
				description: 'Get information about a chat',
			},
			{
				name: 'Remove Keypad',
				value: 'removeKeypad',
				action: 'Remove the chat keypad',
				description: 'Remove the keypad shown at the bottom of a chat',
			},
			{
				name: 'Set Keypad',
				value: 'setKeypad',
				action: 'Set the chat keypad',
				description: 'Show a new keypad at the bottom of a chat',
			},
		],
		default: 'get',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['chatMember'] } },
		options: [
			{
				name: 'Ban',
				value: 'ban',
				action: 'Ban a chat member',
				description: 'Remove a user from a group or channel and block re-entry by invite link',
			},
			{
				name: 'Unban',
				value: 'unban',
				action: 'Unban a chat member',
				description: 'Allow a banned user to join the chat again',
			},
		],
		default: 'ban',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['file'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get a file',
				description: 'Get the download address of a file and optionally download it',
			},
			{
				name: 'Send',
				value: 'send',
				action: 'Send a file',
				description: 'Upload a file or reuse an uploaded one and send it to a chat',
			},
		],
		default: 'send',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['message'] } },
		options: [
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a message',
				description: 'Delete a message',
			},
			{
				name: 'Edit Inline Keypad',
				value: 'editInlineKeypad',
				action: 'Edit the inline keypad of a message',
				description: 'Replace the buttons under a message',
			},
			{
				name: 'Edit Text',
				value: 'editText',
				action: 'Edit the text of a message',
				description: 'Edit the text of a message sent by the bot',
			},
			{
				name: 'Forward',
				value: 'forward',
				action: 'Forward a message',
				description: 'Forward a message to another chat',
			},
			{
				name: 'Send Contact',
				value: 'sendContact',
				action: 'Send a contact',
				description: 'Send a phone contact',
			},
			{
				name: 'Send Location',
				value: 'sendLocation',
				action: 'Send a location',
				description: 'Send a point on the map',
			},
			{
				name: 'Send Poll',
				value: 'sendPoll',
				action: 'Send a poll',
				description: 'Send a poll with several options',
			},
			{
				name: 'Send Text',
				value: 'sendText',
				action: 'Send a text message',
				description: 'Send a text message',
			},
		],
		default: 'sendText',
	},

	/* ---------------------------------------------------------------------- */
	/*  Shared identifiers                                                    */
	/* ---------------------------------------------------------------------- */
	{
		displayName: 'Chat ID',
		name: 'chatId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['chat', 'chatMember', 'message'],
				operation: [
					'ban',
					'delete',
					'editInlineKeypad',
					'editText',
					'get',
					'removeKeypad',
					'sendContact',
					'sendLocation',
					'sendPoll',
					'sendText',
					'setKeypad',
					'unban',
				],
			},
		},
		description: 'Unique identifier of the chat',
	},
	{
		displayName: 'Chat ID',
		name: 'chatId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['file'], operation: ['send'] } },
		description: 'Unique identifier of the chat that receives the file',
	},
	{
		displayName: 'Message ID',
		name: 'messageId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['message'],
				operation: ['delete', 'editInlineKeypad', 'editText', 'forward'],
			},
		},
		description: 'Identifier of the message to act on',
	},
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['chatMember'] } },
		description: 'Unique identifier of the target user',
	},

	/* ---------------------------------------------------------------------- */
	/*  Message: text and edits                                               */
	/* ---------------------------------------------------------------------- */
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		typeOptions: { rows: 4 },
		required: true,
		default: '',
		displayOptions: { show: { resource: ['message'], operation: ['editText', 'sendText'] } },
		description: 'Text of the message',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['message'], operation: ['sendText'] } },
		options: [
			CHAT_KEYPAD_FIELD,
			DISABLE_NOTIFICATION_FIELD,
			FORMATTING_FIELD,
			INLINE_KEYPAD_FIELD,
			REMOVE_CHAT_KEYPAD_FIELD,
			REPLY_TO_FIELD,
		],
	},
	{
		displayName: 'Inline Keypad (JSON)',
		name: 'inlineKeypad',
		type: 'string',
		typeOptions: { rows: 4 },
		required: true,
		default: '',
		displayOptions: { show: { resource: ['message'], operation: ['editInlineKeypad'] } },
		description: `New buttons for the message. ${KEYPAD_NOTE}`,
	},

	/* ---------------------------------------------------------------------- */
	/*  Message: forward                                                      */
	/* ---------------------------------------------------------------------- */
	{
		displayName: 'From Chat ID',
		name: 'fromChatId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['message'], operation: ['forward'] } },
		description: 'Unique identifier of the chat that holds the original message',
	},
	{
		displayName: 'To Chat ID',
		name: 'toChatId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['message'], operation: ['forward'] } },
		description: 'Unique identifier of the chat that receives the forwarded message',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['message'], operation: ['forward'] } },
		options: [DISABLE_NOTIFICATION_FIELD],
	},

	/* ---------------------------------------------------------------------- */
	/*  Message: poll, location, contact                                      */
	/* ---------------------------------------------------------------------- */
	{
		displayName: 'Question',
		name: 'question',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['message'], operation: ['sendPoll'] } },
		description: 'Question of the poll',
	},
	{
		displayName: 'Options',
		name: 'pollOptions',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		placeholder: 'Add Option',
		required: true,
		default: {},
		displayOptions: { show: { resource: ['message'], operation: ['sendPoll'] } },
		description: 'Answers users can choose from. At least two are needed',
		options: [
			{
				displayName: 'Items',
				name: 'items',
				values: [
					{
						displayName: 'Text',
						name: 'text',
						type: 'string',
						default: '',
						description: 'Text of the answer',
					},
				],
			},
		],
	},
	{
		displayName: 'Latitude',
		name: 'latitude',
		type: 'number',
		typeOptions: { numberPrecision: 8 },
		required: true,
		default: 0,
		displayOptions: { show: { resource: ['message'], operation: ['sendLocation'] } },
		description: 'Latitude of the location (-90 to 90)',
	},
	{
		displayName: 'Longitude',
		name: 'longitude',
		type: 'number',
		typeOptions: { numberPrecision: 8 },
		required: true,
		default: 0,
		displayOptions: { show: { resource: ['message'], operation: ['sendLocation'] } },
		description: 'Longitude of the location (-180 to 180)',
	},
	{
		displayName: 'First Name',
		name: 'firstName',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['message'], operation: ['sendContact'] } },
		description: 'First name of the contact',
	},
	{
		displayName: 'Last Name',
		name: 'lastName',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: ['message'], operation: ['sendContact'] } },
		description: 'Last name of the contact',
	},
	{
		displayName: 'Phone Number',
		name: 'phoneNumber',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['message'], operation: ['sendContact'] } },
		description: 'Phone number of the contact',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['message'], operation: ['sendContact', 'sendLocation'] } },
		options: [
			CHAT_KEYPAD_FIELD,
			DISABLE_NOTIFICATION_FIELD,
			INLINE_KEYPAD_FIELD,
			REMOVE_CHAT_KEYPAD_FIELD,
			REPLY_TO_FIELD,
		],
	},

	/* ---------------------------------------------------------------------- */
	/*  File                                                                  */
	/* ---------------------------------------------------------------------- */
	{
		displayName: 'File Type',
		name: 'fileType',
		type: 'options',
		default: 'File',
		displayOptions: { show: { resource: ['file'], operation: ['send'] } },
		options: [
			{ name: 'File', value: 'File', description: 'Any file up to 50 MB' },
			{ name: 'Gif', value: 'Gif', description: 'Animated image as an MP4 without sound' },
			{ name: 'Image', value: 'Image', description: 'JPG, GIF, PNG or WebP up to 10 MB' },
			{ name: 'Music', value: 'Music', description: 'Song as an MP3' },
			{ name: 'Video', value: 'Video', description: 'MP4 video up to 50 MB' },
			{ name: 'Voice', value: 'Voice', description: 'Short voice message as an MP3' },
		],
		description: 'Kind of file to send. Rubika checks the format against this type',
	},
	{
		displayName: 'File Source',
		name: 'fileSource',
		type: 'options',
		default: 'binary',
		displayOptions: { show: { resource: ['file'], operation: ['send'] } },
		options: [
			{
				name: 'Binary Data',
				value: 'binary',
				description: 'Upload binary data from a previous node (three requests are made)',
			},
			{
				name: 'File ID',
				value: 'fileId',
				description: 'Send a file that was already uploaded to Rubika',
			},
		],
		description: 'Where the file comes from',
	},
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		displayOptions: {
			show: { resource: ['file'], operation: ['send'], fileSource: ['binary'] },
		},
		description: 'Name of the binary property that holds the file to upload',
	},
	{
		displayName: 'File Name',
		name: 'fileName',
		type: 'string',
		default: '',
		displayOptions: {
			show: { resource: ['file'], operation: ['send'], fileSource: ['binary'] },
		},
		description: 'Optional file name to send. Defaults to the file name of the binary data',
	},
	{
		displayName: 'File ID',
		name: 'sendFileId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: { resource: ['file'], operation: ['send'], fileSource: ['fileId'] },
		},
		description: 'ID of a file that was uploaded to Rubika before',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['file'], operation: ['send'] } },
		options: [
			{
				displayName: 'Caption',
				name: 'caption',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				description: 'Text sent together with the file',
			},
			CHAT_KEYPAD_FIELD,
			DISABLE_NOTIFICATION_FIELD,
			INLINE_KEYPAD_FIELD,
			REMOVE_CHAT_KEYPAD_FIELD,
			REPLY_TO_FIELD,
		],
	},
	{
		displayName: 'File ID',
		name: 'fileId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['file'], operation: ['get'] } },
		description: 'Identifier of the file, for example from a received message',
	},
	{
		displayName: 'Download',
		name: 'download',
		type: 'boolean',
		default: false,
		displayOptions: { show: { resource: ['file'], operation: ['get'] } },
		description: 'Whether to download the file and return it as binary data',
	},
	{
		displayName: 'Put Output File in Field',
		name: 'downloadBinaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		displayOptions: { show: { resource: ['file'], operation: ['get'], download: [true] } },
		description: 'Name of the binary property that will hold the downloaded file',
	},

	/* ---------------------------------------------------------------------- */
	/*  Bot and chat keypad                                                   */
	/* ---------------------------------------------------------------------- */
	{
		displayName: 'Commands',
		name: 'commands',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		placeholder: 'Add Command',
		required: true,
		default: {},
		displayOptions: { show: { resource: ['bot'], operation: ['setCommands'] } },
		description: 'Commands users see when they type a slash. This replaces the existing list',
		options: [
			{
				displayName: 'Items',
				name: 'items',
				values: [
					{
						displayName: 'Command',
						name: 'command',
						type: 'string',
						default: '',
						description: 'Name of the command without the leading slash, for example start',
					},
					{
						displayName: 'Description',
						name: 'description',
						type: 'string',
						default: '',
						description: 'Short explanation of what the command does',
					},
				],
			},
		],
	},
	{
		displayName: 'Chat Keypad (JSON)',
		name: 'chatKeypad',
		type: 'string',
		typeOptions: { rows: 4 },
		required: true,
		default: '',
		displayOptions: { show: { resource: ['chat'], operation: ['setKeypad'] } },
		description: `Keypad for the bottom of the chat. ${KEYPAD_NOTE}`,
	},

	/* ---------------------------------------------------------------------- */
	/*  Node options                                                          */
	/* ---------------------------------------------------------------------- */
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
					'Milliseconds to wait between two input items. Use it when Rubika answers with TOO_MANY_REQUESTS',
			},
		],
	},
];
