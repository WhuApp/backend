import { authenticateUser } from '../auth';
import { Env } from '../worker';

export const fetch = async (request: Request, env: Env, endpoint: string): Promise<Response> => {
	switch (request.method) {
		case 'POST': {
			if (endpoint == 'add') {
				const authCtx = await authenticateUser(request.headers);
				const body: { friendId: string } = await request.json();
				const friendList: string[] = (await env.FRIENDS_KV.get(authCtx.userId, 'json')) ?? [];
				friendList.push(body.friendId);
				await env.FRIENDS_KV.put(authCtx.userId, JSON.stringify(friendList));
				return new Response(undefined, { status: 201 });
			}
		}
		case 'GET': {
			if (endpoint == 'list') {
				const authCtx = await authenticateUser(request.headers);
				const friendList: string[] = (await env.FRIENDS_KV.get(authCtx.userId, 'json')) ?? [];
				return new Response(JSON.stringify(friendList), { status: 200 });
			}
		}
		default:
			throw new Error('Service not implemented');
	}
};
