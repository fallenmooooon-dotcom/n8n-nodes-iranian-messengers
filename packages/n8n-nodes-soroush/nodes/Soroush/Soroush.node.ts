import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError, sleep } from 'n8n-workflow';

import { SoroushValidationError } from './helpers';
import { executeOperation } from './operations';
import { soroushProperties } from './SoroushDescription';

export class Soroush implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Soroush Plus',
		name: 'soroush',
		icon: { light: 'file:soroush.svg', dark: 'file:soroush.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description: 'Send messages, media, and Mini Apps with the Soroush Plus Bot API',
		defaults: { name: 'Soroush Plus' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'soroushApi', required: true }],
		properties: soroushProperties,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		if (items.length === 0) {
			return [[]];
		}
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
				if (error instanceof SoroushValidationError) {
					throw new NodeOperationError(this.getNode(), error.message, { itemIndex: i });
				}
				if (error instanceof NodeApiError) {
					error.context.itemIndex = i;
					throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex: i });
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
