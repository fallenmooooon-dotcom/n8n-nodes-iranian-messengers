import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError, sleep } from 'n8n-workflow';

import { eitaaYarProperties } from './EitaaYarDescription';
import { EitaaValidationError } from './helpers';
import { executeOperation } from './operations';

export class EitaaYar implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Eitaa (EitaaYar)',
		name: 'eitaaYar',
		icon: { light: 'file:eitaayar.svg', dark: 'file:eitaayar.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description: 'Send messages and files to Eitaa channels and groups through the EitaaYar API',
		defaults: { name: 'Eitaa (EitaaYar)' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'eitaaYarApi', required: true }],
		properties: eitaaYarProperties,
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
				returnData.push({ json: result.json, pairedItem: { item: i } });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				if (error instanceof EitaaValidationError) {
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
