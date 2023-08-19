import { Env } from '../types';
import { authenticateUser } from '../auth';
import { fetchUser, fetchUserSearch } from '../auth0';

export default async (request: Request, env: Env, subpath: string): Promise<Response> => {
  const authContext = await authenticateUser(request.headers);

  switch (request.method) {
    case 'GET': {
      if (subpath === 'me') {
        return await dataById(authContext.userId, env);
      }

      // TODO:  Is this user data public or are only friends
      //        allowed to receive it?
      if (subpath.startsWith('by-id/')) {
        const id = decodeURI(subpath.split('/').slice(-1)[0]);

        if (!id) {
          throw new Error('No user id provided');
        }

        return await dataById(id, env);
      }

      if (subpath.startsWith('search/by-nickname/')) {
        const name = subpath.split('/').slice(-1)[0];

        return await searchByName(name, env);
      }
    }
  }

  throw new Error('Service not implemented');
};

const searchByName = async (name: string, env: Env): Promise<Response> => {
  return new Response(JSON.stringify(await fetchUserSearch(name, env)), { status: 200 });
};

const dataById = async (id: string, env: Env): Promise<Response> => {
  const user = await fetchUser(id, env);

  if (user.success) {
    const response = user as any;
    delete response.success;

    return new Response(JSON.stringify(response), { status: 200 });
  }

  if (user.statusCode === 404) {
    return new Response('User not found', { status: 400 });
  }

  throw new Error(`Auth0Error: ${user.statusCode} ${user.message}`);
};
