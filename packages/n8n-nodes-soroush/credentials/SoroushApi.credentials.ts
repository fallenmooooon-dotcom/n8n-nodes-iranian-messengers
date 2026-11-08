import type { Icon, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

export class SoroushApi implements ICredentialType {
	name = 'soroushApi';

	displayName = 'Soroush Plus API';

	icon: Icon = { light: 'file:soroush.svg', dark: 'file:soroush.dark.svg' };

	documentationUrl = 'https://soroushplus.com/p/documents';

	properties: INodeProperties[] = [
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'The bot token issued by @botfather in Soroush Plus (a leading "bot" prefix is removed automatically)',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.splus.ir',
			description:
				'Host of the Soroush Plus Bot API without a trailing slash (change only if you use a proxy or private gateway)',
		},
	];

	// The token is part of the URL path (/bot<token>/...), so there is no header to authenticate.
	// The credential test calls getMe, which validates the token.
	test: ICredentialTestRequest = {
		request: {
			baseURL:
				'={{ ($credentials.baseUrl || "https://api.splus.ir").trim().replace(/\\/+$/, "") }}/bot{{ ($credentials.accessToken || "").trim().replace(/^bot/i, "") }}',
			url: '/getMe',
			method: 'GET',
		},
	};
}
