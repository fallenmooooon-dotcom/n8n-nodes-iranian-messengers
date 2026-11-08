import type {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { soroushApiRequest } from './GenericFunctions';
import { getUpdateKind } from './helpers';

export class SoroushPollTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Soroush Plus Poll Trigger',
		name: 'soroushPollTrigger',
		icon: { light: 'file:soroush.svg', dark: 'file:soroush.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{ ($parameter["updates"] || []).join(", ") }}',
		description:
			'Starts the workflow for new Soroush Plus events by polling the API (no public HTTPS URL required)',
		defaults: { name: 'Soroush Plus Poll Trigger' },
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'soroushApi', required: true }],
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
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 100 },
				default: 50,
				description: 'Max number of results to return',
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const selected = this.getNodeParameter('updates', []) as string[];
		const limit = Number(this.getNodeParameter('limit', 50));
		const staticData = this.getWorkflowStaticData('node');
		const manual = this.getMode() === 'manual';

		const body: IDataObject = { limit, timeout: 0 };
		const lastOffset = typeof staticData.lastOffset === 'number' ? staticData.lastOffset : undefined;
		if (!manual && lastOffset !== undefined) {
			body.offset = lastOffset + 1;
		}

		const result = (await soroushApiRequest.call(this, 'getUpdates', body)) as unknown;
		const updates = Array.isArray(result) ? (result as IDataObject[]) : [];

		const items: INodeExecutionData[] = [];
		let maxUpdateId = lastOffset ?? -1;

		for (const update of updates) {
			const updateId = typeof update.update_id === 'number' ? update.update_id : -1;
			if (updateId > maxUpdateId) {
				maxUpdateId = updateId;
			}
			const kind = getUpdateKind(update);
			if (kind !== undefined && selected.includes(kind)) {
				items.push({ json: update });
			}
		}

		if (!manual && maxUpdateId > (lastOffset ?? -1)) {
			staticData.lastOffset = maxUpdateId;
		}

		return items.length > 0 ? [items] : null;
	}
}
