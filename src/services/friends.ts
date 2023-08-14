import { authenticateUser } from '../auth';
import { userExists } from '../utils';
import { Env } from '../worker';

type FriendRequest = {
	friendId: string;
};
export default async (request: Request, env: Env, subpath: string): Promise<Response> => {
	switch (request.method) {
		case 'POST': {
			const authContext = await authenticateUser(request.headers);
			const body: FriendRequest = await request.json();
			switch (subpath) {
				case 'request/send':
					return await requestSend(authContext.userId, body.friendId, env);
				case 'request/accept':
					return await requestAccept(authContext.userId, body.friendId, env);
				case 'request/ignore':
					return await requestIgnore(authContext.userId, body.friendId, env);
			}
		}
		case 'GET': {
			switch (subpath) {
				case 'list': {
					const authContext = await authenticateUser(request.headers);
					return await list(authContext.userId, env);
				}
				case 'requests/in/list': {
					const authContext = await authenticateUser(request.headers);
					return await requestInList(authContext.userId, env);
				}
				case 'requests/out/list': {
					const authContext = await authenticateUser(request.headers);
					return await requestOutList(authContext.userId, env);
				}
			}
		}
		default:
			throw new Error('Service not implemented');
	}
};

const requestSend = async (userId: string, friendId: string, env: Env): Promise<Response> => {
	if (friendId === userId) {
		return new Response('You cannot request yourself', { status: 400 });
	}
	if (!(await userExists(friendId, env))) {
		return new Response('Invalid Friend ID', { status: 400 });
	}

	const friendInRequests: string[] = (await env.REQUESTS_IN_KV.get(friendId, 'json')) ?? [];
	if (!friendInRequests.includes(userId)) {
		friendInRequests.push(userId);
	}
	const ownOutRequests: string[] = (await env.REQUESTS_OUT_KV.get(userId, 'json')) ?? [];
	if (!ownOutRequests.includes(friendId)) {
		ownOutRequests.push(friendId);
	}

	await env.REQUESTS_IN_KV.put(friendId, JSON.stringify(friendInRequests));
	await env.REQUESTS_OUT_KV.put(userId, JSON.stringify(ownOutRequests));

	const friendOutRequest: string[] = (await env.REQUESTS_OUT_KV.get(friendId, 'json')) ?? [];
	if (friendOutRequest.includes(userId)) {
		return requestAccept(userId, friendId, env, friendInRequests, ownOutRequests);
	}

	return new Response(undefined, { status: 201 });
};

const requestAccept = async (
	userId: string,
	friendId: string,
	env: Env,
	friendInRequests?: string[],
	ownOutRequests?: string[]
): Promise<Response> => {
	if (!(await userExists(friendId, env))) {
		return new Response('Invalid Friend ID', { status: 400 });
	}
	const friendOutRequests: string[] = (await env.REQUESTS_OUT_KV.get(friendId, 'json')) ?? [];
	if (!friendOutRequests.includes(userId)) {
		return new Response(`No pending request`, { status: 400 });
	}
	const ownInRequests: string[] = (await env.REQUESTS_IN_KV.get(userId, 'json')) ?? [];
	if (!ownInRequests.includes(friendId)) {
		return new Response(`Request expired`, { status: 400 });
	}

	const ownFriends: string[] = (await env.FRIENDS_KV.get(userId, 'json')) ?? [];
	if (!ownFriends.includes(friendId)) {
		ownFriends.push(friendId);
	}
	const friendFriends: string[] = (await env.FRIENDS_KV.get(friendId, 'json')) ?? [];
	if (!friendFriends.includes(userId)) {
		friendFriends.push(userId);
	}

	await env.FRIENDS_KV.put(userId, JSON.stringify(ownFriends));
	await env.FRIENDS_KV.put(friendId, JSON.stringify(friendFriends));

	friendInRequests ??= (await env.REQUESTS_IN_KV.get(friendId, 'json')) ?? [];
	ownOutRequests ??= (await env.REQUESTS_OUT_KV.get(userId, 'json')) ?? [];

	const friendInRequestsUpdated = friendInRequests!.filter((x) => x != userId);
	const friendOutRequestsUpdated = friendOutRequests.filter((x) => x != userId);
	const ownInRequestsUpdated = ownInRequests.filter((x) => x != friendId);
	const ownOutRequestsUpdated = ownOutRequests!.filter((x) => x != friendId);

	await env.REQUESTS_IN_KV.put(friendId, JSON.stringify(friendInRequestsUpdated));
	await env.REQUESTS_IN_KV.put(userId, JSON.stringify(ownInRequestsUpdated));
	await env.REQUESTS_OUT_KV.put(friendId, JSON.stringify(friendOutRequestsUpdated));
	await env.REQUESTS_OUT_KV.put(userId, JSON.stringify(ownOutRequestsUpdated));

	return new Response(undefined, { status: 201 });
};

const requestIgnore = async (userId: string, friendId: string, env: Env): Promise<Response> => {
	if (!(await userExists(friendId, env))) {
		return new Response('Invalid Friend ID', { status: 400 });
	}
	const friendOutRequests: string[] = (await env.REQUESTS_OUT_KV.get(friendId, 'json')) ?? [];
	if (!friendOutRequests.includes(userId)) {
		return new Response(`No pending request`, { status: 400 });
	}
	const ownInRequests: string[] = (await env.REQUESTS_IN_KV.get(userId, 'json')) ?? [];
	if (!ownInRequests.includes(friendId)) {
		return new Response(`Request expired`, { status: 400 });
	}

	const ownInRequestsUpdated = ownInRequests.filter((x) => x != friendId);

	await env.REQUESTS_IN_KV.put(userId, JSON.stringify(ownInRequestsUpdated));

	return new Response(undefined, { status: 201 });
};

const list = async (userId: string, env: Env): Promise<Response> => {
	const friendList: string[] = (await env.FRIENDS_KV.get(userId, 'json')) ?? [];
	return new Response(JSON.stringify(friendList), { status: 200 });
};

const requestInList = async (userId: string, env: Env): Promise<Response> => {
	const ownInRequestss: string[] = (await env.REQUESTS_IN_KV.get(userId, 'json')) ?? [];
	return new Response(JSON.stringify(ownInRequestss), { status: 200 });
};

const requestOutList = async (userId: string, env: Env): Promise<Response> => {
	const ownOutRequest: string[] = (await env.REQUESTS_OUT_KV.get(userId, 'json')) ?? [];
	return new Response(JSON.stringify(ownOutRequest), { status: 200 });
};
