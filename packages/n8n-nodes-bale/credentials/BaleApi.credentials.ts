import type { ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

export class BaleApi implements ICredentialType {
	name = 'baleApi';

	displayName = 'Bale API';

	documentationUrl = 'https://docs.bale.ai/';

	properties: INodeProperties[] = [
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'The bot token issued by @botfather in Bale. A leading "bot" prefix is removed automatically',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://tapi.bale.ai',
			description:
				'Host of the Bale Bot API, without a trailing slash. Change it only if you use a proxy or a test environment',
		},
	];

	// The token is part of the URL path, so there is no header to authenticate.
	// The credential test calls getMe, which also validates the token.
	test: ICredentialTestRequest = {
		request: {
			baseURL:
				'={{ $credentials.baseUrl.trim().replace(/\\/+$/, "") }}/bot{{ $credentials.accessToken.trim().replace(/^bot/i, "") }}',
			url: '/getMe',
			method: 'GET',
		},
	};
}
