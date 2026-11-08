// eslint-disable-next-line @n8n/community-nodes/no-restricted-imports
import assert from 'node:assert/strict';
// eslint-disable-next-line @n8n/community-nodes/no-restricted-imports
import { describe, it } from 'node:test';

import { SoroushTrigger } from '../nodes/Soroush/SoroushTrigger.node';
import { SoroushPollTrigger } from '../nodes/Soroush/SoroushPollTrigger.node';
import {
	API_ROOT,
	makeHookContext,
	makePollContext,
	makeWebhookContext,
	ok,
} from './fakes';

describe('Soroush Plus Trigger (Webhook)', () => {
	it('registers webhook via setWebhook', async () => {
		const { context, http } = makeHookContext({
			webhookUrl: 'https://n8n.example.com/webhook/soroush',
			responses: [ok(true)],
		});

		const node = new SoroushTrigger();
		const created = await node.webhookMethods.default.create.call(context);

		assert.equal(created, true);
		assert.equal(http.calls.length, 1);
		assert.equal(http.calls[0].url, `${API_ROOT}/setWebhook`);
		assert.deepEqual(http.calls[0].body, { url: 'https://n8n.example.com/webhook/soroush' });
	});

	it('triggers on Mini App web_app_data event', async () => {
		const update = {
			update_id: 501,
			message: {
				message_id: 12,
				from: { id: 777, first_name: 'Sara' },
				web_app_data: { data: 'order_completed', button_text: 'Submit' },
			},
		};

		const { context } = makeWebhookContext({
			body: update,
			params: { updates: ['web_app_data'] },
			responses: [],
		});

		const node = new SoroushTrigger();
		const response = await node.webhook.call(context);

		assert.ok(response.workflowData);
		assert.deepEqual(response.workflowData[0][0].json, update);
	});

	it('ignores unselected updates', async () => {
		const update = {
			update_id: 502,
			callback_query: { id: 'cq_1' },
		};

		const { context } = makeWebhookContext({
			body: update,
			params: { updates: ['message'] },
			responses: [],
		});

		const node = new SoroushTrigger();
		const response = await node.webhook.call(context);
		assert.deepEqual(response, {});
	});
});

describe('Soroush Plus Poll Trigger', () => {
	it('polls getUpdates and tracks offset', async () => {
		const updates = [
			{ update_id: 10, message: { text: 'first' } },
			{ update_id: 11, message: { text: 'second' } },
		];

		const { context, http, staticData } = makePollContext({
			params: { updates: ['message'], limit: 10 },
			responses: [ok(updates)],
		});

		const node = new SoroushPollTrigger();
		const result = await node.poll.call(context);

		assert.equal(http.calls.length, 1);
		assert.equal(http.calls[0].url, `${API_ROOT}/getUpdates`);
		assert.ok(result);
		assert.equal(result[0].length, 2);
		assert.equal(staticData.lastOffset, 11);
	});
});
