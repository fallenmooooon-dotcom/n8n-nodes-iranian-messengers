import type {
	IDataObject,
	IHookFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { baleApiRequest, downloadFileAsBinary } from './GenericFunctions';
import { BaleValidationError, assertValidWebhookUrl, getUpdateKind, pickMedia } from './helpers';

export class BaleTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Bale Trigger',
		name: 'baleTrigger',
		icon: { light: 'file:bale.svg', dark: 'file:bale.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{ ($parameter["updates"] || []).join(", ") }}',
		description: 'Starts the workflow when Bale sends an update to your bot',
		defaults: { name: 'Bale Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'baleApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Trigger On',
				name: 'updates',
				type: 'multiOptions',
				required: true,
				default: ['message'],
				options: [
					{
						name: 'Callback Query',
						value: 'callback_query',
						description: 'Trigger when a user presses an inline keyboard button',
					},
					{
						name: 'Channel Post',
						value: 'channel_post',
						description: 'Trigger when a new post is published in a channel where the bot is an administrator',
					},
					{
						name: 'Edited Channel Post',
						value: 'edited_channel_post',
						description: 'Trigger when a channel post is edited',
					},
					{
						name: 'Edited Message',
						value: 'edited_message',
						description: 'Trigger when a user edits a message',
					},
					{
						name: 'Message',
						value: 'message',
						description: 'Trigger when a user sends a new message to the bot',
					},
					{
						name: 'Pre-Checkout Query',
						value: 'pre_checkout_query',
						description: 'Trigger when a user submits a payment pre-checkout query',
					},
				],
				description: 'The kinds of updates that start the workflow',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Binary Property',
						name: 'binaryPropertyName',
						type: 'string',
						default: 'data',
						description: 'Name of the binary property that receives the downloaded media',
					},
					{
						displayName: 'Download Media',
						name: 'downloadMedia',
						type: 'boolean',
						default: false,
						description:
							'Whether to download the photo, audio, document, video, voice or animation of a message as binary data (up to 20 MB)',
					},
				],
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const info = (await baleApiRequest.call(this, 'getWebhookInfo')) as IDataObject | undefined;
				return typeof info?.url === 'string' && info.url !== '' && info.url === webhookUrl;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				try {
					assertValidWebhookUrl(webhookUrl);
				} catch (error) {
					if (error instanceof BaleValidationError) {
						throw new NodeOperationError(this.getNode(), error.message);
					}
					throw error;
				}
				await baleApiRequest.call(this, 'setWebhook', { url: webhookUrl });
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				try {
					// An empty URL removes the webhook.
					await baleApiRequest.call(this, 'setWebhook', { url: '' });
				} catch {
					return false;
				}
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const update = this.getBodyData();
		const kind = getUpdateKind(update);
		const selected = this.getNodeParameter('updates', []) as string[];

		// Unknown payloads and update kinds the user did not select are acknowledged but ignored.
		if (kind === undefined || !selected.includes(kind)) {
			return {};
		}

		const item: INodeExecutionData = { json: update };
		const options = this.getNodeParameter('options', {}) as IDataObject;

		if (
			options.downloadMedia === true &&
			kind !== 'callback_query' &&
			kind !== 'pre_checkout_query'
		) {
			const media = pickMedia(update[kind] as IDataObject);
			if (media !== undefined) {
				const property = String(options.binaryPropertyName ?? 'data') || 'data';
				try {
					const { binary } = await downloadFileAsBinary.call(this, media.fileId, media.fileName);
					item.binary = { [property]: binary };
				} catch (error) {
					// A failed download must not drop the incoming message.
					item.json = { ...update, mediaDownloadError: (error as Error).message };
				}
			}
		}

		return { workflowData: [[item]] };
	}
}
