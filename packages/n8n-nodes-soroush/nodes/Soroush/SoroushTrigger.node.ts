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

import { soroushApiRequest, downloadFileAsBinary } from './GenericFunctions';
import {
	SoroushValidationError,
	assertValidWebhookUrl,
	getUpdateKind,
	pickMedia,
} from './helpers';

export class SoroushTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Soroush Plus Trigger',
		name: 'soroushTrigger',
		icon: { light: 'file:soroush.svg', dark: 'file:soroush.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{ ($parameter["updates"] || []).join(", ") }}',
		description: 'Starts the workflow when Soroush Plus sends an update or Mini App event to your bot',
		defaults: { name: 'Soroush Plus Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'soroushApi', required: true }],
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
				default: ['message', 'web_app_data'],
				options: [
					{
						name: 'Callback Query',
						value: 'callback_query',
						description: 'Trigger when a user presses an inline keyboard button',
					},
					{
						name: 'Channel Post',
						value: 'channel_post',
						description: 'Trigger when a post is published in a channel',
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
						name: 'Mini App Data',
						value: 'web_app_data',
						description: 'Trigger when a user submits data from inside a Mini App',
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
							'Whether to download photo, audio, document, video, voice or animation of a message as binary data (up to 20 MB)',
					},
				],
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				try {
					const info = (await soroushApiRequest.call(this, 'getWebhookInfo')) as
						| IDataObject
						| undefined;
					return typeof info?.url === 'string' && info.url !== '' && info.url === webhookUrl;
				} catch (error) {
					this.logger?.error('Failed to check webhook existence', { error });
					return false;
				}
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				try {
					assertValidWebhookUrl(webhookUrl);
				} catch (error) {
					if (error instanceof SoroushValidationError) {
						throw new NodeOperationError(this.getNode(), error.message);
					}
					throw new NodeOperationError(this.getNode(), error as Error);
				}
				await soroushApiRequest.call(this, 'setWebhook', { url: webhookUrl });
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				try {
					await soroushApiRequest.call(this, 'deleteWebhook');
				} catch (deleteError) {
					try {
						await soroushApiRequest.call(this, 'setWebhook', { url: '' });
					} catch (fallbackError) {
						this.logger?.error('Failed to delete webhook', { deleteError, fallbackError });
						return false;
					}
				}
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const update = this.getBodyData();
		const kind = getUpdateKind(update);
		const selected = this.getNodeParameter('updates', []) as string[];

		if (kind === undefined || !selected.includes(kind)) {
			return {};
		}

		const item: INodeExecutionData = { json: update };
		const options = this.getNodeParameter('options', {}) as IDataObject;

		if (
			options.downloadMedia === true &&
			kind !== 'callback_query' &&
			kind !== 'web_app_data'
		) {
			const mediaSource = (update[kind] ?? update.message) as IDataObject | undefined;
			if (mediaSource !== undefined) {
				const media = pickMedia(mediaSource);
				if (media !== undefined) {
					const property = String(options.binaryPropertyName ?? 'data') || 'data';
					try {
						const { binary } = await downloadFileAsBinary.call(this, media.fileId, media.fileName);
						item.binary = { [property]: binary };
					} catch (error) {
						item.json = { ...update, mediaDownloadError: (error as Error).message };
					}
				}
			}
		}

		return { workflowData: [[item]] };
	}
}
