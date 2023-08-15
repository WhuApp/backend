import { authenticateUser } from '../auth';
import { userExists } from '../utils';
import { Env } from '../env';

type FriendRequestPayload = {
  friendId: string;
};

type FriendRequest = {
  from: string;
  to: string;
};

export default async (request: Request, env: Env, subpath: string): Promise<Response> => {
  const authContext = await authenticateUser(request.headers);
  const senderId = authContext.userId;

  switch (request.method) {
    case 'POST': {
      const body: FriendRequestPayload = await request.json();
      const exists = await userExists(body.friendId, env);
      const friendRequest: FriendRequest = { from: senderId, to: body.friendId };

      if (!exists) {
        return new Response('Invalid Friend ID', { status: 400 });
      }

      switch (subpath) {
        case 'request/send':
          return await sendRequest(friendRequest, env);
        case 'request/accept':
          return await acceptRequest(friendRequest, env);
        case 'request/ignore':
          return await ignoreRequest(friendRequest, env);
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
};

const sendRequest = async (request: FriendRequest, env: Env): Promise<Response> => {
  const { from, to } = request;

  if (from === to) {
    return new Response('You cannot request yourself', { status: 400 });
  }

  const selfOutgoing: string[] = (await env.REQUESTS_OUT_KV.get(from, 'json')) ?? [];
  const otherOutgoing: string[] = (await env.REQUESTS_OUT_KV.get(to, 'json')) ?? [];
  const otherIncoming: string[] = (await env.REQUESTS_IN_KV.get(to, 'json')) ?? [];

  if (!selfOutgoing.includes(to)) {
    selfOutgoing.push(to);
  }
  if (!otherOutgoing.includes(from)) {
    otherOutgoing.push(from);
  }

  await env.REQUESTS_IN_KV.put(to, JSON.stringify(otherIncoming));
  await env.REQUESTS_OUT_KV.put(from, JSON.stringify(selfOutgoing));

  // Accept request if it already exists
  if (otherOutgoing.includes(from)) {
    return acceptRequest(request, env, otherIncoming, otherOutgoing, selfOutgoing);
  }

  return new Response(undefined, { status: 201 });
};

const acceptRequest = async (
  request: FriendRequest,
  env: Env,
  otherIncoming?: string[],
  otherOutgoing?: string[],
  selfOutgoing?: string[]
): Promise<Response> => {
  const { from, to } = request;
  const selfIncoming: string[] = (await env.REQUESTS_IN_KV.get(from, 'json')) ?? [];
  const selfFriends: string[] = (await env.FRIENDS_KV.get(from, 'json')) ?? [];
  const otherFriends: string[] = (await env.FRIENDS_KV.get(to, 'json')) ?? [];

  if (!otherOutgoing) {
    otherOutgoing = (await env.REQUESTS_OUT_KV.get(to, 'json')) ?? [];
  }

  if (!otherOutgoing.includes(from)) {
    return new Response('No pending request', { status: 400 });
  }
  if (!selfIncoming.includes(to)) {
    return new Response('Request invalid', { status: 400 });
  }

  if (!selfFriends.includes(to)) {
    selfFriends.push(to);
  }
  await env.FRIENDS_KV.put(from, JSON.stringify(selfFriends));

  if (!otherFriends.includes(from)) {
    otherFriends.push(from);
  }
  await env.FRIENDS_KV.put(to, JSON.stringify(otherFriends));

  if (!selfOutgoing) {
    selfOutgoing = (await env.REQUESTS_OUT_KV.get(from, 'json')) ?? [];
  }
  if (!otherIncoming) {
    otherIncoming = (await env.REQUESTS_IN_KV.get(to, 'json')) ?? [];
  }

  // Remove request from friend
  await env.REQUESTS_IN_KV.put(to, JSON.stringify(otherIncoming.filter((x) => x != from)));
  await env.REQUESTS_OUT_KV.put(to, JSON.stringify(otherOutgoing.filter((x) => x != from)));
  // Remove request from user
  await env.REQUESTS_IN_KV.put(from, JSON.stringify(selfIncoming.filter((x) => x != to)));
  await env.REQUESTS_OUT_KV.put(from, JSON.stringify(selfOutgoing.filter((x) => x != to)));

  return new Response(undefined, { status: 201 });
};

const ignoreRequest = async (request: FriendRequest, env: Env): Promise<Response> => {
  const { from, to } = request;
  const selfIncoming: string[] = (await env.REQUESTS_IN_KV.get(from, 'json')) ?? [];
  const otherOutgoing: string[] = (await env.REQUESTS_OUT_KV.get(to, 'json')) ?? [];

  if (!otherOutgoing.includes(from)) {
    return new Response('No pending request', { status: 400 });
  }

  if (!selfIncoming.includes(to)) {
    return new Response('Request expired', { status: 400 });
  }

  // Remove request
  await env.REQUESTS_IN_KV.put(from, JSON.stringify(selfIncoming.filter((x) => x !== to)));

  return new Response(undefined, { status: 201 });
};

const listFriends = async (userId: string, env: Env): Promise<Response> => {
  const friends: string[] = (await env.FRIENDS_KV.get(userId, 'json')) ?? [];

  return new Response(JSON.stringify(friends), { status: 200 });
};

const listIncoming = async (userId: string, env: Env): Promise<Response> => {
  const incoming: string[] = (await env.REQUESTS_IN_KV.get(userId, 'json')) ?? [];

  return new Response(JSON.stringify(incoming), { status: 200 });
};

const listOutgoing = async (userId: string, env: Env): Promise<Response> => {
  const outgoing: string[] = (await env.REQUESTS_OUT_KV.get(userId, 'json')) ?? [];

  return new Response(JSON.stringify(outgoing), { status: 200 });
};
