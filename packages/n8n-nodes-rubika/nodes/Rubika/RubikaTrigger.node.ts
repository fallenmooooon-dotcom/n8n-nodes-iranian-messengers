import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { rubikaApiRequest } from './GenericFunctions';
import {
	RubikaValidationError,
	assertHttpsUrl,
	needsReceiveUpdate,
	normalizeWebhookBody,
} from './helpers';

export class RubikaTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Rubika Trigger',
		name: 'rubikaTrigger',
		icon: { light: 'file:rubika.svg', dark: 'file:rubika.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{ ($parameter["events"] || []).join(", ") }}',
		description: 'Starts the workflow when Rubika sends an event to your bot (webhook)',
		defaults: { name: 'Rubika Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'rubikaApi', required: true }],
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
				name: 'events',
				type: 'multiOptions',
				required: true,
				default: ['NewMessage'],
				options: [
					{
						name: 'Bot Started',
						value: 'StartedBot',
						description: 'Trigger when a user starts the bot',
					},
					{
						name: 'Bot Stopped',
						value: 'StoppedBot',
						description: 'Trigger when a user stops the bot',
					},
					{
						name: 'Chat Event',
						value: 'EventData',
						description: 'Trigger when the bot is added to or removed from a chat or its permissions change',
					},
					{
						name: 'Inline Button Pressed',
						value: 'InlineMessage',
						description: 'Trigger when a user presses a button of an inline keypad',
					},
					{
						name: 'Message Edited',
						value: 'UpdatedMessage',
						description: 'Trigger when a user edits a message',
					},
					{
						name: 'Message Removed',
						value: 'RemovedMessage',
						description: 'Trigger when a user deletes a message',
					},
					{
						name: 'New Message',
						value: 'NewMessage',
						description: 'Trigger on a new message or a tap on a chat keypad button',
					},
				],
				description: 'The kinds of events that start the workflow',
			},
		],
	};

	webhookMethods = {
		default: {
			// Rubika has no call that reports the registered address, so the endpoints are
			// registered again every time the workflow is activated.
			async checkExists(this: IHookFunctions): Promise<boolean> {
				return false;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				try {
					assertHttpsUrl(webhookUrl);
				} catch (error) {
					if (error instanceof RubikaValidationError) {
						throw new NodeOperationError(this.getNode(), error.message);
					}
					throw new NodeOperationError(this.getNode(), error as Error);
				}

				const events = this.getNodeParameter('events', []) as string[];
				if (needsReceiveUpdate(events)) {
					await rubikaApiRequest.call(this, 'updateBotEndpoints', {
						url: webhookUrl,
						type: 'ReceiveUpdate',
					});
				}
				if (events.includes('InlineMessage')) {
					await rubikaApiRequest.call(this, 'updateBotEndpoints', {
						url: webhookUrl,
						type: 'ReceiveInlineMessage',
					});
				}
				return true;
			},

			// The Rubika reference describes no way to remove an endpoint, so nothing is called.
			async delete(this: IHookFunctions): Promise<boolean> {
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const item = normalizeWebhookBody(this.getBodyData());
		const events = this.getNodeParameter('events', []) as string[];

		// Unknown payloads and event types the user did not select are acknowledged but ignored.
		if (item === undefined || !events.includes(String(item.type))) {
			return {};
		}
		return { workflowData: [[{ json: item as IDataObject }]] };
	}
}
