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
      case 'POST': {
        switch (pathSegments[0]) {
          case 'delete': {
            switch (pathSegments[1]) {
              case 'me': {
                return await deleteUser(senderId, env);
              }
              case 'by-id': {
                const id = decodeURI(pathSegments[1]);

                if (!id) {
                  throw new Error('No user id provided');
                }

                /*
                // TODO:  Is this user data public or are only friends
                //        allowed to receive it?
                const friends: string[] = (await env.FRIENDS_KV.get(senderId, 'json')) ?? [];
    
                if (!friends.includes(id)) {
                  return new Response('No access', { status: 401 });
                }
                */

                return new Response('No access', { status: 401 });
              }
            }
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

            /*
            // TODO:  Is this user data public or are only friends
            //        allowed to receive it?
            const friends: string[] = (await env.FRIENDS_KV.get(senderId, 'json')) ?? [];

            if (!friends.includes(id)) {
              return new Response('No access', { status: 401 });
            }
            */

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
  console.log(reason);
  if (reason) {
    return new Response(reason, { status: 400 });
  }

  return Response.json({}, { status: 200 });
};

export default UsersV1;
