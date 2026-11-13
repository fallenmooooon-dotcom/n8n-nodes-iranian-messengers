import type { INodeProperties } from 'n8n-workflow';

/** Message operations that address a single chat (the target chat for forward and copy). */
const CHAT_RESOURCES = ['chat', 'chatMember', 'message', 'payment'];

const REPLY_MARKUP_FIELD: INodeProperties = {
	displayName: 'Reply Markup (JSON)',
	name: 'replyMarkup',
	type: 'string',
	typeOptions: { rows: 4 },
	default: '',
	description:
		'JSON object with an inline keyboard, reply keyboard or keyboard removal, using the structures defined in the Bale Bot API reference',
};

const REPLY_TO_FIELD: INodeProperties = {
	displayName: 'Reply To Message ID',
	name: 'replyToMessageId',
	type: 'number',
	default: 0,
	description: 'ID of the message to reply to (leave at 0 to send a normal message)',
};

const PARSE_MODE_FIELD: INodeProperties = {
	displayName: 'Parse Mode',
	name: 'parseMode',
	type: 'string',
	default: '',
	description:
		'Optional formatting mode sent only when set (leave empty unless you know Bale accepts the value)',
};

export const baleProperties: INodeProperties[] = [
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
			{ name: 'Callback Query', value: 'callbackQuery' },
			{ name: 'Chat', value: 'chat' },
			{ name: 'Chat Member', value: 'chatMember' },
			{ name: 'File', value: 'file' },
			{ name: 'Message', value: 'message' },
			{ name: 'Payment', value: 'payment' },
		],
		default: 'message',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['payment'] } },
		options: [
			{
				name: 'Answer Pre-Checkout Query',
				value: 'answerPreCheckoutQuery',
				action: 'Answer a pre checkout query',
				description: 'Respond to an incoming pre-checkout query to approve or reject a payment',
			},
			{
				name: 'Send Invoice',
				value: 'sendInvoice',
				action: 'Send an invoice',
				description: 'Send a payment request (invoice) to a user or chat using the Bale Wallet',
			},
		],
		default: 'sendInvoice',
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
		],
		default: 'getMe',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['callbackQuery'] } },
		options: [
			{
				name: 'Answer',
				value: 'answer',
				action: 'Answer a callback query',
				description: 'Send a response to an inline keyboard button press',
			},
		],
		default: 'answer',
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
				description: 'Get up-to-date information about a chat',
			},
			{
				name: 'Get Member Count',
				value: 'getMemberCount',
				action: 'Get the member count of a chat',
				description: 'Get the number of members in a chat',
			},
			{
				name: 'Leave',
				value: 'leave',
				action: 'Leave a chat',
				description: 'Make the bot leave a group or channel',
			},
			{
				name: 'Pin Message',
				value: 'pinMessage',
				action: 'Pin a message',
				description: 'Pin a message in a chat',
			},
			{
				name: 'Unpin All Messages',
				value: 'unpinAllMessages',
				action: 'Unpin all messages',
				description: 'Unpin all pinned messages in a chat',
			},
			{
				name: 'Unpin Message',
				value: 'unpinMessage',
				action: 'Unpin a message',
				description: 'Unpin a message in a chat',
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
				description: 'Ban a user from a group or channel',
			},
			{
				name: 'Unban',
				value: 'unban',
				action: 'Unban a chat member',
				description: 'Lift the ban of a user in a group or channel',
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
				description: 'Get file information and optionally download the file',
			},
		],
		default: 'get',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['message'] } },
		options: [
			{
				name: 'Copy',
				value: 'copy',
				action: 'Copy a message',
				description: 'Copy a message without a link to the original',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a message',
				description: 'Delete a message (allowed within 48 hours of sending)',
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
				name: 'Send Media',
				value: 'sendMedia',
				action: 'Send media',
				description: 'Send a photo, audio, document, video, voice message or animation',
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
			show: { resource: CHAT_RESOURCES },
			hide: { resource: ['payment'], operation: ['answerPreCheckoutQuery'] },
		},
		description:
			'Unique identifier of the chat, or the channel username in the format @channelusername (target chat for Forward and Copy)',
	},
	{
		displayName: 'From Chat ID',
		name: 'fromChatId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['message'], operation: ['copy', 'forward'] } },
		description: 'Unique identifier of the chat where the original message was sent',
	},
	{
		displayName: 'Message ID',
		name: 'messageId',
		type: 'number',
		required: true,
		default: 0,
		displayOptions: {
			show: {
				resource: ['chat', 'message'],
				operation: ['copy', 'delete', 'editText', 'forward', 'pinMessage', 'unpinMessage'],
			},
		},
		description: 'Identifier of the message to act on',
	},
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'number',
		required: true,
		default: 0,
		displayOptions: { show: { resource: ['chatMember'] } },
		description: 'Unique identifier of the target user',
	},

	/* ---------------------------------------------------------------------- */
	/*  Message: text                                                         */
	/* ---------------------------------------------------------------------- */
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		typeOptions: { rows: 4 },
		required: true,
		default: '',
		displayOptions: { show: { resource: ['message'], operation: ['editText', 'sendText'] } },
		description: 'Text of the message (1 to 4096 characters)',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['message'], operation: ['sendText'] } },
		options: [PARSE_MODE_FIELD, REPLY_MARKUP_FIELD, REPLY_TO_FIELD],
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['message'], operation: ['editText'] } },
		options: [PARSE_MODE_FIELD, REPLY_MARKUP_FIELD],
	},

	/* ---------------------------------------------------------------------- */
	/*  Message: media                                                        */
	/* ---------------------------------------------------------------------- */
	{
		displayName: 'Media Type',
		name: 'mediaType',
		type: 'options',
		default: 'photo',
		displayOptions: { show: { resource: ['message'], operation: ['sendMedia'] } },
		options: [
			{ name: 'Animation', value: 'animation' },
			{ name: 'Audio', value: 'audio' },
			{ name: 'Document', value: 'document' },
			{ name: 'Photo', value: 'photo' },
			{ name: 'Video', value: 'video' },
			{ name: 'Voice', value: 'voice' },
		],
		description: 'Kind of media to send',
	},
	{
		displayName: 'Media Source',
		name: 'mediaSource',
		type: 'options',
		default: 'binary',
		displayOptions: { show: { resource: ['message'], operation: ['sendMedia'] } },
		options: [
			{
				name: 'Binary Data',
				value: 'binary',
				description: 'Upload binary data from a previous node (photos up to 10 MB, other types up to 50 MB)',
			},
			{
				name: 'File ID',
				value: 'fileId',
				description: 'Resend a file that is already stored on Bale servers',
			},
			{
				name: 'URL',
				value: 'url',
				description: 'Let Bale download the file from a public URL',
			},
		],
		description: 'Where the media comes from',
	},
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		displayOptions: {
			show: { resource: ['message'], operation: ['sendMedia'], mediaSource: ['binary'] },
		},
		description: 'Name of the binary property that holds the file to upload',
	},
	{
		displayName: 'File Name',
		name: 'fileName',
		type: 'string',
		default: '',
		displayOptions: {
			show: { resource: ['message'], operation: ['sendMedia'], mediaSource: ['binary'] },
		},
		description: 'Optional file name to send (defaults to the file name of the binary data)',
	},
	{
		displayName: 'File ID',
		name: 'mediaFileId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: { resource: ['message'], operation: ['sendMedia'], mediaSource: ['fileId'] },
		},
		description: 'File ID of a file that already exists on Bale servers',
	},
	{
		displayName: 'URL',
		name: 'mediaUrl',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: { resource: ['message'], operation: ['sendMedia'], mediaSource: ['url'] },
		},
		description:
			'Public HTTP or HTTPS URL of the file (Bale limits URL downloads to 5 MB for photos and 20 MB for other types)',
	},
	{
		displayName: 'Caption',
		name: 'caption',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		displayOptions: {
			show: { resource: ['message'], operation: ['sendMedia'] },
			hide: { mediaType: ['animation'] },
		},
		description: 'Caption of the media (up to 1024 characters)',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['message'], operation: ['sendMedia'] } },
		options: [REPLY_MARKUP_FIELD, REPLY_TO_FIELD],
	},

	/* ---------------------------------------------------------------------- */
	/*  Message: location and contact                                         */
	/* ---------------------------------------------------------------------- */
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
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['message'], operation: ['sendLocation'] } },
		options: [
			{
				displayName: 'Horizontal Accuracy',
				name: 'horizontalAccuracy',
				type: 'number',
				default: 0,
				description: 'Radius of uncertainty in meters from 0 to 1500 (leave at 0 to omit)',
			},
			REPLY_MARKUP_FIELD,
			REPLY_TO_FIELD,
		],
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
		displayName: 'First Name',
		name: 'firstName',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['message'], operation: ['sendContact'] } },
		description: 'First name of the contact',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['message'], operation: ['sendContact'] } },
		options: [
			{
				displayName: 'Last Name',
				name: 'lastName',
				type: 'string',
				default: '',
				description: 'Last name of the contact',
			},
			REPLY_MARKUP_FIELD,
			REPLY_TO_FIELD,
		],
	},

	/* ---------------------------------------------------------------------- */
	/*  Callback query                                                        */
	/* ---------------------------------------------------------------------- */
	{
		displayName: 'Callback Query ID',
		name: 'callbackQueryId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['callbackQuery'], operation: ['answer'] } },
		description: 'ID of the callback query to answer, taken from the Bale Trigger output',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['callbackQuery'], operation: ['answer'] } },
		options: [
			{
				displayName: 'Show Alert',
				name: 'showAlert',
				type: 'boolean',
				default: false,
				description: 'Whether to show the text as an alert instead of a notification',
			},
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				default: '',
				description: 'Text of the notification shown to the user',
			},
		],
	},

	/* ---------------------------------------------------------------------- */
	/*  File                                                                  */
	/* ---------------------------------------------------------------------- */
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
		description: 'Whether to download the file and return it as binary data (up to 20 MB)',
	},
	{
		displayName: 'Put Output File in Field',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		displayOptions: { show: { resource: ['file'], operation: ['get'], download: [true] } },
		description: 'Name of the binary property that will hold the downloaded file',
	},

	/* ---------------------------------------------------------------------- */
	/*  Chat member                                                           */
	/* ---------------------------------------------------------------------- */
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['chatMember'], operation: ['unban'] } },
		options: [
			{
				displayName: 'Only If Banned',
				name: 'onlyIfBanned',
				type: 'boolean',
				default: false,
				description: 'Whether to do nothing if the user is not banned',
			},
		],
	},

	/* ---------------------------------------------------------------------- */
	/*  Payment: Send Invoice                                                 */
	/* ---------------------------------------------------------------------- */
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['payment'], operation: ['sendInvoice'] } },
		description: 'Product or service name (1-32 characters)',
	},
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['payment'], operation: ['sendInvoice'] } },
		description: 'Product or service description (1-255 characters)',
	},
	{
		displayName: 'Payload',
		name: 'payload',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['payment'], operation: ['sendInvoice'] } },
		description: 'Bot-defined invoice payload (1-128 bytes) returned in the SuccessfulPayment update',
	},
	{
		displayName: 'Provider Token',
		name: 'providerToken',
		type: 'string',
		typeOptions: { password: true },
		required: true,
		default: 'WALLET-TEST-1111111111111111',
		displayOptions: { show: { resource: ['payment'], operation: ['sendInvoice'] } },
		description:
			'Payment provider token issued by @BotFather, or WALLET-TEST-1111111111111111 for testing without real money transfer',
	},
	{
		displayName: 'Currency',
		name: 'currency',
		type: 'string',
		default: 'IRR',
		displayOptions: { show: { resource: ['payment'], operation: ['sendInvoice'] } },
		description: 'Three-letter ISO 4217 currency code (e.g. IRR)',
	},
	{
		displayName: 'Prices',
		name: 'prices',
		placeholder: 'Add Price Item',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		default: {},
		displayOptions: { show: { resource: ['payment'], operation: ['sendInvoice'] } },
		description: 'Breakdown of components that make up the total price',
		options: [
			{
				name: 'priceItems',
				displayName: 'Price Items',
				values: [
					{
						displayName: 'Amount',
						name: 'amount',
						type: 'number',
						default: 10000,
						description: 'Portion price in the smallest currency unit (Rials for IRR)',
					},
					{
						displayName: 'Label',
						name: 'label',
						type: 'string',
						default: '',
						description: 'Portion label (e.g. "Product Price" or "Delivery")',
					},
				],
			},
		],
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['payment'], operation: ['sendInvoice'] } },
		options: [
			{
				displayName: 'Is Flexible',
				name: 'isFlexible',
				type: 'boolean',
				default: false,
				description: 'Whether the final price depends on the shipping method',
			},
			{
				displayName: 'Need Email',
				name: 'needEmail',
				type: 'boolean',
				default: false,
				description: 'Whether you require the user\'s email address to complete the order',
			},
			{
				displayName: 'Need Name',
				name: 'needName',
				type: 'boolean',
				default: false,
				description: 'Whether you require the user\'s full name to complete the order',
			},
			{
				displayName: 'Need Phone Number',
				name: 'needPhoneNumber',
				type: 'boolean',
				default: false,
				description: 'Whether you require the user\'s phone number to complete the order',
			},
			{
				displayName: 'Need Shipping Address',
				name: 'needShippingAddress',
				type: 'boolean',
				default: false,
				description: 'Whether you require the user\'s shipping address to complete the order',
			},
			{
				displayName: 'Photo Height',
				name: 'photoHeight',
				type: 'number',
				default: 0,
				description: 'Photo height in pixels',
			},
			{
				displayName: 'Photo Size',
				name: 'photoSize',
				type: 'number',
				default: 0,
				description: 'Photo size in bytes',
			},
			{
				displayName: 'Photo URL',
				name: 'photoUrl',
				type: 'string',
				default: '',
				description: 'URL of the product photo for the invoice',
			},
			{
				displayName: 'Photo Width',
				name: 'photoWidth',
				type: 'number',
				default: 0,
				description: 'Photo width in pixels',
			},
			REPLY_MARKUP_FIELD,
			REPLY_TO_FIELD,
			{
				displayName: 'Send Email to Provider',
				name: 'sendEmailToProvider',
				type: 'boolean',
				default: false,
				description: 'Whether the user\'s email address should be sent to the provider',
			},
			{
				displayName: 'Send Phone Number to Provider',
				name: 'sendPhoneNumberToProvider',
				type: 'boolean',
				default: false,
				description: 'Whether the user\'s phone number should be sent to the provider',
			},
		],
	},

	/* ---------------------------------------------------------------------- */
	/*  Payment: Answer Pre-Checkout Query                                    */
	/* ---------------------------------------------------------------------- */
	{
		displayName: 'Pre-Checkout Query ID',
		name: 'preCheckoutQueryId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['payment'], operation: ['answerPreCheckoutQuery'] } },
		description: 'Unique identifier for the query to be answered (from pre_checkout_query update)',
	},
	{
		displayName: 'OK',
		name: 'ok',
		type: 'boolean',
		required: true,
		default: true,
		displayOptions: { show: { resource: ['payment'], operation: ['answerPreCheckoutQuery'] } },
		description:
			'Whether everything is alright and the bot is ready to proceed with the order. Set to false if there are problems.',
	},
	{
		displayName: 'Error Message',
		name: 'errorMessage',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['payment'],
				operation: ['answerPreCheckoutQuery'],
				ok: [false],
			},
		},
		description: 'Error message explaining to the user why the payment cannot proceed (required when OK is false)',
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
					'Milliseconds to wait between two input items (use 1000 to stay within about one message per second to the same chat)',
			},
		],
	},
];
