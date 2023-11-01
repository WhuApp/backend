import { Env, GraphQLContext } from '../types';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { SubschemaConfig } from '@graphql-tools/delegate/typings';

type FriendRequest = {
  from: string;
  to: string;
};

type KVEntries = {
  selfIncoming?: string[];
  selfOutgoing?: string[];
  selfFriends?: string[];
  otherIncoming?: string[];
  otherOutgoing?: string[];
  otherFriends?: string[];
};

const schema = makeExecutableSchema<GraphQLContext>({
  typeDefs: `
    type Query {
      friends: [User!]!
      incomingFriendRequests: [User!]!
      outgoingFriendRequests: [User!]!
    }

    type Mutation {
      sendFriendRequest(to: String!): Boolean!
      acceptFriendRequest(to: String!): Boolean!
      ignoreFriendRequest(to: String!): Boolean!
      cancelFriendRequest(to: String!): Boolean!
      removeFriend(to: String!): Boolean!
    }

    type User {
      id: String!
      email: String!
      nickname: String!
    }
  `,
  resolvers: {
    Query: {
      friends: async (_source, _args, context) => {
        return await context.userDataLoader.loadMany(
          (await context.env.FRIENDS_KV.get(context.id, 'json')) ?? []
        );
      },
      incomingFriendRequests: async (_source, _args, context) => {
        return await context.userDataLoader.loadMany(
          (await context.env.REQUESTS_IN_KV.get(context.id, 'json')) ?? []
        );
      },
      outgoingFriendRequests: async (_source, _args, context) => {
        return await context.userDataLoader.loadMany(
          (await context.env.REQUESTS_OUT_KV.get(context.id, 'json')) ?? []
        );
      },
    },
    Mutation: {
      sendFriendRequest: ({ to }, _args, context) => {
        return sendRequest({ to: to, from: context.id }, context.env);
      },
      acceptFriendRequest: ({ to }, _args, context) => {
        return acceptRequest({ to: to, from: context.id }, context.env);
      },
      ignoreFriendRequest: ({ to }, _args, context) => {
        return ignoreRequest({ to: to, from: context.id }, context.env);
      },
      cancelFriendRequest: ({ to }, _args, context) => {
        return cancelRequest({ to: to, from: context.id }, context.env);
      },
      removeFriend: ({ to }, _args, context) => {
        return removeFriend({ to: to, from: context.id }, context.env);
      },
    },
  },
});

export const friendsSchemaConfig: SubschemaConfig<any, any, any, GraphQLContext> = { schema };

const sendRequest = async (request: FriendRequest, env: Env) => {
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

  return true;
};

const acceptRequest = async (request: FriendRequest, env: Env) => {
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

  return true;
};

const ignoreRequest = async (request: FriendRequest, env: Env) => {
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

  return true;
};

const cancelRequest = async (request: FriendRequest, env: Env) => {
  const { from, to } = request;

  const selfOutgoing: string[] = (await env.REQUESTS_OUT_KV.get(from, 'json')) ?? [];
  if (!selfOutgoing.includes(to)) {
    return new Response('No outgoing request', { status: 400 });
  }

  await deleteRequests(request, env, { selfOutgoing });

  return true;
};

const removeFriend = async (request: FriendRequest, env: Env) => {
  const { from, to } = request;

  const selfFriends: string[] = (await env.FRIENDS_KV.get(from, 'json')) ?? [];
  if (!selfFriends.includes(to)) {
    return new Response('You are not friends', { status: 400 });
  }

  await deleteFriendship(request, env, { selfFriends });

  return true;
};

/**
 * Guarantees that request is in the REQUEST_IN/OUT_KV
 * @returns if some KV entries changed
 */
const addRequests = async (
  request: FriendRequest,
  env: Env,
  knownEntries: KVEntries
): Promise<boolean> => {
  const { from, to } = request;
  let changed = false;

  const selfOutgoing: string[] =
    knownEntries.selfOutgoing ?? (await env.REQUESTS_OUT_KV.get(from, 'json')) ?? [];

  const otherIncoming: string[] =
    knownEntries.otherIncoming ?? (await env.REQUESTS_IN_KV.get(to, 'json')) ?? [];

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
 * @returns if some KV entries changed
 */
const deleteRequests = async (
  request: FriendRequest,
  env: Env,
  knownEntries: KVEntries
): Promise<boolean> => {
  const { from, to } = request;
  let changed = false;

  const selfIncoming: string[] =
    knownEntries.selfIncoming ?? (await env.REQUESTS_IN_KV.get(from, 'json')) ?? [];
  const selfOutgoing: string[] =
    knownEntries.selfOutgoing ?? (await env.REQUESTS_OUT_KV.get(from, 'json')) ?? [];
  const otherIncoming: string[] =
    knownEntries.otherIncoming ?? (await env.REQUESTS_IN_KV.get(to, 'json')) ?? [];
  const otherOutgoing: string[] =
    knownEntries.otherOutgoing ?? (await env.REQUESTS_OUT_KV.get(to, 'json')) ?? [];

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
 * @returns if some KV entries changed
 */
const addFriendship = async (
  request: FriendRequest,
  env: Env,
  knownEntries: KVEntries
): Promise<boolean> => {
  const { from, to } = request;
  let changed = false;

  const selfFriends: string[] =
    knownEntries.selfFriends ?? (await env.FRIENDS_KV.get(from, 'json')) ?? [];
  const otherFriends: string[] =
    knownEntries.otherFriends ?? (await env.FRIENDS_KV.get(to, 'json')) ?? [];

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

const deleteFriendship = async (
  request: FriendRequest,
  env: Env,
  knownEntries: KVEntries
): Promise<boolean> => {
  const { from, to } = request;
  let changed = false;

  const selfFriends: string[] =
    knownEntries.selfFriends ?? (await env.FRIENDS_KV.get(from, 'json')) ?? [];
  const otherFriends: string[] =
    knownEntries.otherFriends ?? (await env.FRIENDS_KV.get(to, 'json')) ?? [];

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
