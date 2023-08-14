import { Env } from './worker';

export const userExists = async (userId: string, env: Env): Promise<boolean> => {
	const response = await fetch('https://whuapp.eu.auth0.com/oauth/token', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'client_credentials',
			client_id: env.AUTH0_CLIENT_ID,
			client_secret: env.AUTH0_TOKEN,
			audience: 'https://whuapp.eu.auth0.com/api/v2/',
		}),
	});

	const body: { token_type: string; access_token: string } = await response.json();

	const headers = new Headers();
	headers.append('Accept', 'application/json');
	headers.append('Authorization', body.token_type + ' ' + body.access_token);

	const requestOptions = {
		method: 'GET',
		headers: headers,
		redirect: 'follow',
	};

	const auth0Response = await fetch(`https://whuapp.eu.auth0.com/api/v2/users/${userId}`, requestOptions);
	switch (auth0Response.status) {
		case 200:
			return true;
		case 404:
			return false;
		case 429:
			throw new Error('Auth0 Ratelimit');
		default:
			throw new Error('Something went wrong. Auth0 statuscode: ' + (await auth0Response.text()));
	}
};
