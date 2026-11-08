import type { Icon, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

export class RubikaApi implements ICredentialType {
	name = 'rubikaApi';

	displayName = 'Rubika API';

	icon: Icon = { light: 'file:rubika.svg', dark: 'file:rubika.dark.svg' };

	documentationUrl = 'https://rubika.ir/botapi';

	properties: INodeProperties[] = [
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description: 'The bot token issued by @BotFather in Rubika',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://botapi.rubika.ir/v3',
			description:
				'Address of the Rubika Bot API including the version without a trailing slash (change only if you use a proxy)',
		},
	];

	// The token is part of the URL path, so there is no header to authenticate.
	// The credential test calls getMe, which also validates the token. Rubika answers
	// rejected calls with the status ERROR_GENERIC or INVALID_ACCESS, which the rules below turn into a failure.
	test: ICredentialTestRequest = {
		request: {
			baseURL:
				'={{ ($credentials.baseUrl || "https://botapi.rubika.ir/v3").trim().replace(/\\/+$/, "") }}/{{ ($credentials.accessToken || "").trim().replace(/^\\/+|\\/+$/g, "") }}',
			url: '/getMe',
			method: 'POST',
			body: {},
		},
		rules: [
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'status',
					value: 'ERROR_GENERIC',
					message: 'Rubika rejected the request. Check the access token.',
				},
			},
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'status',
					value: 'INVALID_ACCESS',
					message: 'Rubika rejected the request (INVALID_ACCESS). Check the access token.',
				},
			},
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'status',
					value: 'INVALID_AUTH',
					message: 'Rubika rejected the request (INVALID_AUTH). Check the access token.',
				},
			},
		],
	};
}
