import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError, sleep } from 'n8n-workflow';

import { RubikaValidationError } from './helpers';
import { executeOperation } from './operations';
import { rubikaProperties } from './RubikaDescription';

export class Rubika implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Rubika',
		name: 'rubika',
		icon: { light: 'file:rubika.svg', dark: 'file:rubika.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description: 'Send messages and files and manage chats with the Rubika Bot API',
		defaults: { name: 'Rubika' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'rubikaApi', required: true }],
		properties: rubikaProperties,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;
		const options = this.getNodeParameter('options', 0, {}) as IDataObject;
		const delayMs = Number(options.delayBetweenItems ?? 0);

		for (let i = 0; i < items.length; i++) {
			try {
				if (i > 0 && delayMs > 0) {
					await sleep(delayMs);
				}
				const result = await executeOperation(this, i, resource, operation);
				const item: INodeExecutionData = { json: result.json, pairedItem: { item: i } };
				if (result.binary !== undefined) {
					item.binary = result.binary;
				}
				returnData.push(item);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				if (error instanceof RubikaValidationError) {
					throw new NodeOperationError(this.getNode(), error.message, { itemIndex: i });
				}
				const context = (error as { context?: IDataObject }).context;
				if (context !== undefined) {
					context.itemIndex = i;
					throw error;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
