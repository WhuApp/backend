import { Env } from '../types';
import { authenticateUser } from '../auth';
import { fetchUser } from '../auth0';

export default async (request: Request, env: Env, subpath: string): Promise<Response> => {
  const authContext = await authenticateUser(request.headers);
  const senderId = authContext.userId;

  switch (request.method) {
    case 'POST': {
      switch (subpath) {
        case 'me':
          return await dataById(senderId, env);
      }
    }
    case 'GET': {
      if (subpath === 'me') {
        return await dataById(authContext.userId, env);
      }

      if (subpath.startsWith('by-id/')) {
        const id = subpath.split('/').slice(-1)[0];

        if (!id) {
          throw new Error('No user id provided');
        }

        const friends: string[] = (await env.FRIENDS_KV.get(id, 'json')) ?? [];

        if (!friends.includes(id)) {
          throw new Response('No access');
        }

        return await dataById(id, env);
      }
    }
  }
  throw new Error('Service not implemented');
};

const dataById = async (id: string, env: Env): Promise<Response> => {
  // TODO: fetch location

  return new Response('Location not found', { status: 400 });
};
