import type { ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

export class EitaaYarApi implements ICredentialType {
	name = 'eitaaYarApi';

	displayName = 'EitaaYar API';

	documentationUrl = 'https://eitaayar.ir/';

	properties: INodeProperties[] = [
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'The API token from your EitaaYar dashboard. The "bot" prefix that the dashboard shows is optional and removed automatically',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://eitaayar.ir/api',
			description:
				'Address of the EitaaYar API, without a trailing slash. Change it only if you use a proxy',
		},
	];

	// The token is part of the URL path, so there is no header to authenticate.
	// The credential test calls getMe, which also validates the token.
	test: ICredentialTestRequest = {
		request: {
			baseURL:
				'={{ $credentials.baseUrl.trim().replace(/\\/+$/, "").replace(/\\/api$/i, "") }}/api/bot{{ $credentials.accessToken.trim().replace(/^bot/i, "") }}',
			url: '/getMe',
			method: 'GET',
		},
	};
}
