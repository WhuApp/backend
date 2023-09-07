import { Env, Service } from '../types';
import { authenticateUser } from '../auth';
import { deleteAuthUser, fetchUser, fetchUserSearch } from '../auth0';

const UsersV1: Service = {
  path: '/users/v1/',

  fetch: async (request: Request, env: Env, subpath: string): Promise<Response> => {
    const authContext = await authenticateUser(request.headers);
    const senderId = authContext.userId;
    const pathSegments: string[] = subpath.split('/');

    switch (request.method) {
      case 'DELETE': {
        switch (pathSegments[0]) {
          case 'me': {
            return await deleteUser(senderId, env);
          }
          case 'by-id': {
            const id = decodeURI(pathSegments[1]);

            if (!id) {
              throw new Error('No user id provided');
            }

            return new Response('Not implemented', { status: 501 });
          }
        }
        break;
      }
      case 'GET': {
        switch (pathSegments[0]) {
          case 'me': {
            return await dataById(senderId, env);
          }
          case 'by-id': {
            const id = decodeURI(pathSegments[1]);

            if (!id) {
              throw new Error('No user id provided');
            }

            // TODO:  Is this user data public or are only friends

            return await dataById(id, env);
          }
          case 'search': {
            if (pathSegments[1] === 'by-nickname') {
              const name = decodeURI(pathSegments[2]);

              return await searchByName(name, env);
            }
          }
        }
        break;
      }
    }
    throw new Error('Service not implemented');
  },
};

const searchByName = async (name: string, env: Env): Promise<Response> => {
  return Response.json(await fetchUserSearch(name, env), { status: 200 });
};

const dataById = async (id: string, env: Env): Promise<Response> => {
  const user = await fetchUser(id, env);
  if (user.success) {
    const response = user as any;
    delete response.success;

    return Response.json(response, { status: 200 });
  }

  if (user.statusCode === 404) {
    return new Response('User not found', { status: 400 });
  }

  throw new Error(`Auth0Error: ${user.statusCode} ${user.message}`);
};

const deleteUser = async (id: string, env: Env): Promise<Response> => {
  const reason = await deleteAuthUser(id, env);

  if (reason) {
    return new Response(reason, { status: 400 });
  }

  // TODO: Delete data

  return new Response(undefined, { status: 204 });
};

export default UsersV1;
