import { authenticateUser } from '../auth';
import { userExists } from '../auth0';
import { Env, Service } from '../types';

type FriendRequestPayload = {
  friendId: string;
};

type FriendRequest = {
  from: string;
  to: string;
};

const FriendsV1: Service = {
  path: '/friends/v1/',
  fetch: async (request: Request, env: Env, subpath: string): Promise<Response> => {
    const authContext = await authenticateUser(request.headers);
    const senderId = authContext.userId;

    switch (request.method) {
      case 'POST': {
        const body: FriendRequestPayload = await request.json();
        const exists = await userExists(body.friendId, env);
        const friendRequest: FriendRequest = {
          from: senderId,
          to: body.friendId,
        };

        if (!exists) {
          return new Response('Invalid Friend ID', { status: 400 });
        }

        switch (subpath) {
          case 'requests/send':
            return await sendRequest(friendRequest, env);
          case 'requests/accept':
            return await acceptRequest(friendRequest, env);
          case 'requests/ignore':
            return await ignoreRequest(friendRequest, env);
          case 'requests/cancel':
            return await cancelRequest(friendRequest, env);
          case 'remove':
            return await removeFriend(friendRequest, env);
        }
      }

      case 'GET': {
        switch (subpath) {
          case 'list':
            return await listFriends(senderId, env);
          case 'requests/in/list':
            return await listIncoming(senderId, env);
          case 'requests/out/list':
            return await listOutgoing(senderId, env);
        }
      }
    }

    throw new Error('Service not implemented');
  },
};

const sendRequest = async (request: FriendRequest, env: Env): Promise<Response> => {
  const { from, to } = request;

  if (from === to) {
    return new Response('You cannot request yourself', { status: 400 });
  }

  const selfFriends: string[] = (await env.FRIENDS_KV.get(from, 'json')) ?? [];
  if (selfFriends.includes(to)) {
    return new Response('You are already friends', { status: 400 });
  }

  const selfOutgoing: string[] = (await env.REQUESTS_OUT_KV.get(from, 'json')) ?? [];
  if (selfOutgoing.includes(to)) {
    return new Response('Request already exists', { status: 400 });
  }

  const otherOutgoing: string[] = (await env.REQUESTS_OUT_KV.get(to, 'json')) ?? [];
  if (otherOutgoing.includes(from)) {
    await deleteRequests(request, env, { selfOutgoing, otherOutgoing });
    await addFriendship(request, env, { selfOutgoing, otherOutgoing });
  } else {
    await addRequests(request, env, { selfOutgoing, otherOutgoing });
  }

  return new Response(undefined, { status: 201 });
};

const acceptRequest = async (request: FriendRequest, env: Env): Promise<Response> => {
  const { from, to } = request;

  const otherOutgoing: string[] = (await env.REQUESTS_OUT_KV.get(to, 'json')) ?? [];
  if (!otherOutgoing.includes(from)) {
    return new Response('No pending request', { status: 400 });
  }

  const selfIncoming: string[] = (await env.REQUESTS_IN_KV.get(from, 'json')) ?? [];
  if (!selfIncoming.includes(to)) {
    return new Response('Request invalid', { status: 400 });
  }

  await addFriendship(request, env, { selfIncoming, otherOutgoing });
  await deleteRequests(request, env, { selfIncoming, otherOutgoing });

  return new Response(undefined, { status: 201 });
};

const ignoreRequest = async (request: FriendRequest, env: Env): Promise<Response> => {
  const { from, to } = request;

  const otherOutgoing: string[] = (await env.REQUESTS_OUT_KV.get(to, 'json')) ?? [];
  if (!otherOutgoing.includes(from)) {
    return new Response('No pending request', { status: 400 });
  }

  const selfIncoming: string[] = (await env.REQUESTS_IN_KV.get(from, 'json')) ?? [];
  if (!selfIncoming.includes(to)) {
    return new Response('Request expired', { status: 400 });
  }

  await env.REQUESTS_IN_KV.put(from, JSON.stringify(selfIncoming.filter((x) => x !== to)));

  return new Response(undefined, { status: 200 });
};

const cancelRequest = async (request: FriendRequest, env: Env): Promise<Response> => {
  const { from, to } = request;

  const selfOutgoing: string[] = (await env.REQUESTS_OUT_KV.get(from, 'json')) ?? [];
  if (!selfOutgoing.includes(to)) {
    return new Response('No outgoing request', { status: 400 });
  }

  await deleteRequests(request, env, { selfOutgoing });

  return new Response(undefined, { status: 200 });
};

const removeFriend = async (request: FriendRequest, env: Env): Promise<Response> => {
  const { from, to } = request;

  const selfFriends: string[] = (await env.FRIENDS_KV.get(from, 'json')) ?? [];
  if (!selfFriends.includes(to)) {
    return new Response('You are not friends', { status: 400 });
  }

  await deleteFrienship(request, env, { selfFriends });

  return new Response(undefined, { status: 201 });
};

const listFriends = async (userId: string, env: Env): Promise<Response> => {
  const friends: string[] = (await env.FRIENDS_KV.get(userId, 'json')) ?? [];

  return Response.json(friends, { status: 200 });
};

const listIncoming = async (userId: string, env: Env): Promise<Response> => {
  const incoming: string[] = (await env.REQUESTS_IN_KV.get(userId, 'json')) ?? [];

  return Response.json(incoming, { status: 200 });
};

const listOutgoing = async (userId: string, env: Env): Promise<Response> => {
  const outgoing: string[] = (await env.REQUESTS_OUT_KV.get(userId, 'json')) ?? [];

  return Response.json(outgoing, { status: 200 });
};

type KVEntrys = {
  selfIncoming?: string[];
  selfOutgoing?: string[];
  selfFriends?: string[];
  otherIncoming?: string[];
  otherOutgoing?: string[];
  otherFriends?: string[];
};

/**
 * Guarantees that request is in the REQUEST_IN/OUT_KV
 * @returns if some KV entrys changed
 */
const addRequests = async (
  request: FriendRequest,
  env: Env,
  knownEntrys: KVEntrys
): Promise<boolean> => {
  const { from, to } = request;
  let changed = false;

  const selfOutgoing: string[] =
    knownEntrys.selfOutgoing ?? (await env.REQUESTS_OUT_KV.get(from, 'json')) ?? [];

  const otherIncoming: string[] =
    knownEntrys.otherIncoming ?? (await env.REQUESTS_IN_KV.get(to, 'json')) ?? [];

  if (!selfOutgoing.includes(to)) {
    selfOutgoing.push(to);
    await env.REQUESTS_OUT_KV.put(from, JSON.stringify(selfOutgoing));
    changed = true;
  }
  if (!otherIncoming.includes(from)) {
    otherIncoming.push(from);
    await env.REQUESTS_IN_KV.put(to, JSON.stringify(otherIncoming));
    changed = true;
  }
  return changed;
};

/**
 * Guarantees that request is not in the REQUEST_IN/OUT_KV
 * @returns if some KV entrys changed
 */
const deleteRequests = async (
  request: FriendRequest,
  env: Env,
  knownEntrys: KVEntrys
): Promise<boolean> => {
  const { from, to } = request;
  let changed = false;

  const selfIncoming: string[] =
    knownEntrys.selfIncoming ?? (await env.REQUESTS_IN_KV.get(from, 'json')) ?? [];
  const selfOutgoing: string[] =
    knownEntrys.selfOutgoing ?? (await env.REQUESTS_OUT_KV.get(from, 'json')) ?? [];
  const otherIncoming: string[] =
    knownEntrys.otherIncoming ?? (await env.REQUESTS_IN_KV.get(to, 'json')) ?? [];
  const otherOutgoing: string[] =
    knownEntrys.otherOutgoing ?? (await env.REQUESTS_OUT_KV.get(to, 'json')) ?? [];

  if (selfIncoming.includes(to)) {
    await env.REQUESTS_IN_KV.put(from, JSON.stringify(selfIncoming.filter((x) => x != to)));
    changed = true;
  }
  if (selfOutgoing.includes(to)) {
    await env.REQUESTS_OUT_KV.put(from, JSON.stringify(selfOutgoing.filter((x) => x != to)));
    changed = true;
  }
  if (otherIncoming.includes(from)) {
    await env.REQUESTS_IN_KV.put(to, JSON.stringify(otherIncoming.filter((x) => x != from)));
    changed = true;
  }
  if (otherOutgoing.includes(from)) {
    await env.REQUESTS_OUT_KV.put(to, JSON.stringify(otherOutgoing.filter((x) => x != from)));
    changed = true;
  }
  return changed;
};

/**
 * Guarantees that request is in the FRIENDS_KV
 * @returns if some KV entrys changed
 */
const addFriendship = async (
  request: FriendRequest,
  env: Env,
  knownEntrys: KVEntrys
): Promise<boolean> => {
  const { from, to } = request;
  let changed = false;

  const selfFriends: string[] =
    knownEntrys.selfFriends ?? (await env.FRIENDS_KV.get(from, 'json')) ?? [];
  const otherFriends: string[] =
    knownEntrys.otherFriends ?? (await env.FRIENDS_KV.get(to, 'json')) ?? [];

  if (!selfFriends.includes(to)) {
    selfFriends.push(to);
    await env.FRIENDS_KV.put(from, JSON.stringify(selfFriends));
    changed = true;
  }

  if (!otherFriends.includes(from)) {
    otherFriends.push(from);
    await env.FRIENDS_KV.put(to, JSON.stringify(otherFriends));
    changed = true;
  }

  return changed;
};

const deleteFrienship = async (
  request: FriendRequest,
  env: Env,
  knownEntrys: KVEntrys
): Promise<boolean> => {
  const { from, to } = request;
  let changed = false;

  const selfFriends: string[] =
    knownEntrys.selfFriends ?? (await env.FRIENDS_KV.get(from, 'json')) ?? [];
  const otherFriends: string[] =
    knownEntrys.otherFriends ?? (await env.FRIENDS_KV.get(to, 'json')) ?? [];

  if (selfFriends.includes(to)) {
    await env.FRIENDS_KV.put(from, JSON.stringify(selfFriends.filter((x) => x != to)));
    changed = true;
  }

  if (otherFriends.includes(from)) {
    await env.FRIENDS_KV.put(to, JSON.stringify(otherFriends.filter((x) => x != from)));
    changed = true;
  }

  return changed;
};

export default FriendsV1;
