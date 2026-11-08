import type {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { rubikaApiRequest } from './GenericFunctions';
import { normalizeUpdate, rememberKeys, updateKey } from './helpers';

/** How many update keys are remembered to guard against repeated deliveries. */
const REMEMBERED_KEYS = 500;

export class RubikaPollTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Rubika Poll Trigger',
		name: 'rubikaPollTrigger',
		icon: { light: 'file:rubika.svg', dark: 'file:rubika.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{ ($parameter["events"] || []).join(", ") }}',
		description: 'Starts the workflow for new Rubika events by asking the API regularly (no public URL needed)',
		defaults: { name: 'Rubika Poll Trigger' },
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'rubikaApi', required: true }],
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
		const events = this.getNodeParameter('events', []) as string[];
		const limit = Number(this.getNodeParameter('limit', 50));
		const staticData = this.getWorkflowStaticData('node');
		// "Fetch Test Event" must neither move the cursor nor mark events as seen.
		const manual = this.getMode() === 'manual';

		const body: IDataObject = { limit };
		const cursor = typeof staticData.offsetId === 'string' ? staticData.offsetId : '';
		if (!manual && cursor !== '') {
			body.offset_id = cursor;
		}

		const data = await rubikaApiRequest.call(this, 'getUpdates', body);
		const updates = Array.isArray(data.updates) ? (data.updates as IDataObject[]) : [];
		const nextOffsetId = typeof data.next_offset_id === 'string' ? data.next_offset_id : '';

		const seen = Array.isArray(staticData.seenKeys) ? (staticData.seenKeys as string[]) : [];
		const newKeys: string[] = [];
		const items: INodeExecutionData[] = [];

		for (const raw of updates) {
			const update = normalizeUpdate(raw);
			if (update === undefined) {
				continue;
			}
			const key = updateKey(update);
			if (!manual && seen.includes(key)) {
				continue;
			}
			newKeys.push(key);
			if (events.includes(String(update.type))) {
				items.push({ json: update });
			}
		}

		if (!manual) {
			if (nextOffsetId !== '') {
				staticData.offsetId = nextOffsetId;
			}
			staticData.seenKeys = rememberKeys(seen, newKeys, REMEMBERED_KEYS);
		}

		return items.length > 0 ? [items] : null;
	}
}
