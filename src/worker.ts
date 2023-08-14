import { Env } from './env';
import { default as friendFetch } from './services/friends';

export default <ExportedHandler<Env>>{
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname.startsWith('/friends/v1/')) {
			return friendFetch(request, env, url.pathname.substring('/friends/v1/'.length));
		}
		throw new Error('Service not found. Path: ' + url.pathname);
	},
};
