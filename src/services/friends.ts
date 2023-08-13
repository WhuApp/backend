import { authenticateUser } from '../auth';
import { userExists } from '../utils';
import { Env } from '../worker';

export default async (request: Request, env: Env, subpath: string): Promise<Response> => {
	switch (request.method) {
		case 'POST': {
			switch (subpath) {
				// request send
				case 'request/send': {
					const authCtx = await authenticateUser(request.headers);
					const body: { friendId: string } = await request.json();

					if (body.friendId === authCtx.userId) return new Response('You cannot send yourself a friendrequest', { status: 400 });
					if (!(await userExists(body.friendId, env))) return new Response('Other user not found', { status: 400 });

					await requestSend(authCtx.userId, body.friendId, env);
					return new Response(undefined, { status: 201 });
				}
				//2 reads + requestAccept
				case 'request/accept': {
					const authCtx = await authenticateUser(request.headers);
					const body: { friendId: string } = await request.json();

					if (!(await userExists(body.friendId, env))) return new Response('Other user not found', { status: 400 });

					const friendOutRequests: string[] = (await env.REQUESTS_OUT_KV.get(body.friendId, 'json')) ?? [];
					if (!friendOutRequests.includes(authCtx.userId)) return new Response(`No pending request`, { status: 400 });
					const ownInRequests: string[] = (await env.REQUESTS_IN_KV.get(authCtx.userId, 'json')) ?? [];
					if (!ownInRequests.includes(body.friendId)) return new Response(`Request expired`, { status: 400 });

					await requestAccept(authCtx.userId, body.friendId, env);
					return new Response(undefined, { status: 201 });
				}
				//2 reads + requestIgnore
				case 'request/ignore': {
					const authCtx = await authenticateUser(request.headers);
					const body: { friendId: string } = await request.json();

					if (!(await userExists(body.friendId, env))) return new Response('Other user not found', { status: 400 });

					const friendOutRequests: string[] = (await env.REQUESTS_OUT_KV.get(body.friendId, 'json')) ?? [];
					if (!friendOutRequests.includes(authCtx.userId)) return new Response(`No pending request`, { status: 400 });
					const ownInRequests: string[] = (await env.REQUESTS_IN_KV.get(authCtx.userId, 'json')) ?? [];
					if (!ownInRequests.includes(body.friendId)) return new Response(`Request already expired`, { status: 400 });

					await requestIgnore(authCtx.userId, body.friendId, env, ownInRequests);
					return new Response(undefined, { status: 201 });
				}
			}
		}
		case 'GET': {
			switch (subpath) {
				case 'list': {
					const authCtx = await authenticateUser(request.headers);
					const friendList: string[] = (await env.FRIENDS_KV.get(authCtx.userId, 'json')) ?? [];
					return new Response(JSON.stringify(friendList), { status: 200 });
				}
				case 'requests/in/list': {
					const authCtx = await authenticateUser(request.headers);
					const ownInRequestss: string[] = (await env.REQUESTS_IN_KV.get(authCtx.userId, 'json')) ?? [];
					return new Response(JSON.stringify(ownInRequestss), { status: 200 });
				}
				case 'requests/out/list': {
					const authCtx = await authenticateUser(request.headers);
					const ownOutRequest: string[] = (await env.REQUESTS_OUT_KV.get(authCtx.userId, 'json')) ?? [];
					return new Response(JSON.stringify(ownOutRequest), { status: 200 });
				}
			}
		}
		default:
			throw new Error('Service not implemented');
	}
};

//2 writes + 3 reads (+ requestAccept)
const requestSend = async (userId: string, friendId: string, env: Env) => {
	const friendInRequests: string[] = (await env.REQUESTS_IN_KV.get(friendId, 'json')) ?? [];
	const ownOutRequests: string[] = (await env.REQUESTS_OUT_KV.get(userId, 'json')) ?? [];
	if (!friendInRequests.includes(userId)) friendInRequests.push(userId);
	if (!ownOutRequests.includes(friendId)) ownOutRequests.push(friendId);
	console.log(ownOutRequests);
	await env.REQUESTS_IN_KV.put(friendId, JSON.stringify(friendInRequests));
	await env.REQUESTS_OUT_KV.put(userId, JSON.stringify(ownOutRequests));

	const friendOutRequest: string[] = (await env.REQUESTS_OUT_KV.get(friendId, 'json')) ?? [];
	if (friendOutRequest.includes(userId)) requestAccept(userId, friendId, env);
};

//6 writes + 4 reads
const requestAccept = async (
	userId: string,
	friendId: string,
	env: Env,
	friendInRequests?: string[],
	ownOutRequests?: string[],
	friendOutRequests?: string[],
	ownInRequests?: string[]
) => {
	const ownFriends: string[] = (await env.FRIENDS_KV.get(userId, 'json')) ?? [];
	const friendFriends: string[] = (await env.FRIENDS_KV.get(friendId, 'json')) ?? [];
	if (!ownFriends.includes(friendId)) ownFriends.push(friendId);
	if (!friendFriends.includes(userId)) friendFriends.push(userId);
	await env.FRIENDS_KV.put(userId, JSON.stringify(ownFriends));
	await env.FRIENDS_KV.put(friendId, JSON.stringify(friendFriends));

	friendInRequests ??= (await env.REQUESTS_IN_KV.get(friendId, 'json')) ?? [];
	ownOutRequests ??= (await env.REQUESTS_OUT_KV.get(userId, 'json')) ?? [];
	friendOutRequests ??= (await env.REQUESTS_OUT_KV.get(friendId, 'json')) ?? [];
	ownInRequests ??= (await env.REQUESTS_IN_KV.get(userId, 'json')) ?? [];

	friendInRequests = friendInRequests.filter((x) => x != userId);
	friendOutRequests = friendOutRequests.filter((x) => x != friendId);
	ownInRequests = ownInRequests.filter((x) => x != friendId);
	ownOutRequests = ownOutRequests.filter((x) => x != userId);

	await env.REQUESTS_IN_KV.put(friendId, JSON.stringify(friendInRequests));
	await env.REQUESTS_IN_KV.put(userId, JSON.stringify(ownInRequests));
	await env.REQUESTS_OUT_KV.put(friendId, JSON.stringify(friendOutRequests));
	await env.REQUESTS_OUT_KV.put(userId, JSON.stringify(ownOutRequests));
};
//1 write
const requestIgnore = async (userId: string, friendId: string, env: Env, ownInRequests: string[]) => {
	ownInRequests.filter((x) => x != friendId);
	await env.REQUESTS_IN_KV.put(userId, JSON.stringify(ownInRequests));
};
