import { Env, Service } from '../types';
import { authenticateUser } from '../auth';
import { deleteAuthUser, fetchUser, fetchUserSearch } from '../auth0';

const UsersV1: Service = {
  path: '/users/v1/',

  fetch: async (request: Request, subPath: string, env: Env): Promise<Response> => {
    const authContext = await authenticateUser(request.headers);
    const senderId = authContext.userId;
    const pathSegments: string[] = subPath.split('/');

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

            // TODO: Is this user data public or only for friends?
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

  if (user) {
    return Response.json(user, { status: 200 });
  }

  return new Response('User not found', { status: 400 });
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
