// eslint-disable-next-line @n8n/community-nodes/no-restricted-imports
import assert from 'node:assert/strict';
// eslint-disable-next-line @n8n/community-nodes/no-restricted-imports
import { describe, it } from 'node:test';

import { NodeOperationError } from 'n8n-workflow';
import type { IDataObject } from 'n8n-workflow';

import { RubikaPollTrigger } from '../nodes/Rubika/RubikaPollTrigger.node';
import { RubikaTrigger } from '../nodes/Rubika/RubikaTrigger.node';
import {
	API_ROOT,
	fail,
	makeHookContext,
	makePollContext,
	makeWebhookContext,
	ok,
} from './fakes';

const trigger = new RubikaTrigger();
const poller = new RubikaPollTrigger();
const HOOK_URL = 'https://n8n.example.com/webhook/6f1c/webhook';

const newMessage = (id: string, text: string): IDataObject => ({
	type: 'NewMessage',
	chat_id: 'b0chat',
	new_message: { message_id: id, text, time: `17000000${id}`, sender_type: 'User', sender_id: 'u0abc' },
});

describe('Rubika Trigger: endpoint registration', () => {
	it('registers ReceiveUpdate for message events', async () => {
		const { context, http } = makeHookContext({
			webhookUrl: HOOK_URL,
			params: { events: ['NewMessage', 'StartedBot'] },
			responses: [ok({})],
		});
		assert.equal(await trigger.webhookMethods.default.create.call(context), true);
		assert.equal(http.calls.length, 1);
		assert.equal(http.calls[0].url, `${API_ROOT}/updateBotEndpoints`);
		assert.deepEqual(http.calls[0].body, { url: HOOK_URL, type: 'ReceiveUpdate' });
	});

	it('registers ReceiveInlineMessage only for inline button events', async () => {
		const { context, http } = makeHookContext({
			webhookUrl: HOOK_URL,
			params: { events: ['InlineMessage'] },
			responses: [ok({})],
		});
		await trigger.webhookMethods.default.create.call(context);
		assert.deepEqual(http.calls.map((call) => call.body), [{ url: HOOK_URL, type: 'ReceiveInlineMessage' }]);
	});

	it('registers both endpoints when both kinds are selected', async () => {
		const { context, http } = makeHookContext({
			webhookUrl: HOOK_URL,
			params: { events: ['NewMessage', 'InlineMessage'] },
			responses: [ok({}), ok({})],
		});
		await trigger.webhookMethods.default.create.call(context);
		assert.deepEqual(http.calls.map((call) => (call.body as IDataObject).type), [
			'ReceiveUpdate',
			'ReceiveInlineMessage',
		]);
	});

	it('refuses non-HTTPS addresses and surfaces API errors', async () => {
		const insecure = makeHookContext({ webhookUrl: 'http://n8n.example.com/x', params: { events: ['NewMessage'] }, responses: [] });
		await assert.rejects(
			trigger.webhookMethods.default.create.call(insecure.context),
			(error: Error) => error instanceof NodeOperationError && /HTTPS/.test(error.message),
		);
		assert.equal(insecure.http.calls.length, 0);

		const rejected = makeHookContext({ webhookUrl: HOOK_URL, params: { events: ['NewMessage'] }, responses: [fail('INVALID_INPUT')] });
		await assert.rejects(trigger.webhookMethods.default.create.call(rejected.context), /INVALID_INPUT/);
	});

	it('always registers on activation and does not call the API on delete', async () => {
		const { context, http } = makeHookContext({ webhookUrl: HOOK_URL, responses: [] });
		assert.equal(await trigger.webhookMethods.default.checkExists.call(context), false);
		assert.equal(await trigger.webhookMethods.default.delete.call(context), true);
		assert.equal(http.calls.length, 0);
	});
});

describe('Rubika Trigger: incoming events', () => {
	it('emits the Update object for selected events', async () => {
		const update = newMessage('1', 'hello');
		const { context } = makeWebhookContext({ body: { update }, params: { events: ['NewMessage'] }, responses: [] });
		assert.deepEqual((await trigger.webhook.call(context)).workflowData, [[{ json: update }]]);
	});

	it('wraps inline button presses', async () => {
		const inline = { chat_id: 'b0chat', message_id: '9', sender_id: 'u0abc', aux_data: { button_id: '100' } };
		const { context } = makeWebhookContext({ body: { inline_message: inline }, params: { events: ['InlineMessage'] }, responses: [] });
		assert.deepEqual((await trigger.webhook.call(context)).workflowData, [
			[{ json: { type: 'InlineMessage', chat_id: 'b0chat', inline_message: inline } }],
		]);
	});

	it('ignores events that are not selected and unknown payloads', async () => {
		const bodies: IDataObject[] = [
			{ update: { type: 'RemovedMessage', chat_id: 'c', removed_message_id: '3' } },
			{ inline_message: { chat_id: 'c' } },
			{ unknown: true },
		];
		for (const body of bodies) {
			const { context } = makeWebhookContext({ body, params: { events: ['NewMessage'] }, responses: [] });
			assert.deepEqual(await trigger.webhook.call(context), {});
		}
	});
});

describe('Rubika Poll Trigger', () => {
	const params = { events: ['NewMessage'], limit: 20 };

	it('polls without a cursor first, then continues from next_offset_id', async () => {
		const staticData: IDataObject = {};
		const first = makePollContext({
			params,
			staticData,
			responses: [ok({ updates: [newMessage('1', 'a'), newMessage('2', 'b')], next_offset_id: 'CURSOR-2' })],
		});
		const firstResult = await poller.poll.call(first.context);
		assert.deepEqual(first.http.calls[0].body, { limit: 20 });
		assert.equal(first.http.calls[0].url, `${API_ROOT}/getUpdates`);
		assert.equal(firstResult?.[0].length, 2);
		assert.deepEqual(firstResult?.[0][0].json, newMessage('1', 'a'));
		assert.equal(staticData.offsetId, 'CURSOR-2');

		const second = makePollContext({
			params,
			staticData,
			responses: [ok({ updates: [newMessage('3', 'c')], next_offset_id: 'CURSOR-3' })],
		});
		const secondResult = await poller.poll.call(second.context);
		assert.deepEqual(second.http.calls[0].body, { limit: 20, offset_id: 'CURSOR-2' });
		assert.equal(secondResult?.[0].length, 1);
		assert.equal(staticData.offsetId, 'CURSOR-3');
	});

	it('returns null when nothing new arrived and skips repeated deliveries', async () => {
		const staticData: IDataObject = {};
		const first = makePollContext({ params, staticData, responses: [ok({ updates: [newMessage('1', 'a')], next_offset_id: 'C1' })] });
		assert.equal((await poller.poll.call(first.context))?.[0].length, 1);

		// The same update again, for example because the cursor was ignored.
		const repeated = makePollContext({ params, staticData, responses: [ok({ updates: [newMessage('1', 'a')], next_offset_id: 'C1' })] });
		assert.equal(await poller.poll.call(repeated.context), null);

		const empty = makePollContext({ params, staticData, responses: [ok({ updates: [] })] });
		assert.equal(await poller.poll.call(empty.context), null);
		assert.equal(staticData.offsetId, 'C1');
	});

	it('filters by event type but still advances the cursor', async () => {
		const staticData: IDataObject = {};
		const removed = { type: 'RemovedMessage', chat_id: 'c', removed_message_id: '5' };
		const { context } = makePollContext({
			params,
			staticData,
			responses: [ok({ updates: [removed, { no: 'type' }], next_offset_id: 'C9' })],
		});
		assert.equal(await poller.poll.call(context), null);
		assert.equal(staticData.offsetId, 'C9');
	});

	it('does not move the cursor in manual mode', async () => {
		const staticData: IDataObject = { offsetId: 'KEEP' };
		const { context, http } = makePollContext({
			params,
			staticData,
			mode: 'manual',
			responses: [ok({ updates: [newMessage('1', 'a')], next_offset_id: 'NEW' })],
		});
		const result = await poller.poll.call(context);
		assert.equal(result?.[0].length, 1);
		assert.deepEqual(http.calls[0].body, { limit: 20 });
		assert.equal(staticData.offsetId, 'KEEP');
		assert.equal(staticData.seenKeys, undefined);
	});

	it('surfaces API errors', async () => {
		const { context } = makePollContext({ params, responses: [fail('INVALID_AUTH')] });
		await assert.rejects(poller.poll.call(context), /INVALID_AUTH/);
	});
});
