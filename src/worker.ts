import { Env } from './types';
import friendsFetch from './services/friends_v1';
import usersFetch from './services/users_v1';
import locationsFetch from './services/locations_v1';

export default <ExportedHandler<Env>>{
  async fetch(request, env): Promise<Response> {
    try {
      const url = new URL(request.url);

      const path: string[] = url.pathname.split('/').slice(1);
      const service = path[0];
      const version = path[1];
      const subPath = url.pathname.substring(`/${service}/${version}/`.length);

      switch (`/${service}/${version}/`) {
        case '/friends/v1/': {
          return await friendsFetch(request, env, subPath);
        }
        case '/friends/v1/': {
          return await usersFetch(request, env, subPath);
        }
        case 'locations/v1/': {
          return await locationsFetch(request, env, subPath);
        }
      }

      throw new Error();
    } catch (error: any) {
      if (error.message) {
        return new Response(error.message, { status: 500 });
      } else {
        return new Response(JSON.stringify(error), { status: 500 });
      }
    }
  },
};
