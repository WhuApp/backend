import { Env } from './types';
import friendsFetch from './services/friends_v1';
import usersFetch from './services/users_v1';
import locationsFetch from './services/locations_v1';

export default <ExportedHandler<Env>>{
  async fetch(request, env): Promise<Response> {
    try {
      const url = new URL(request.url);

      // TODO: Switch statement & endpoint constants
      if (url.pathname.startsWith('/friends/v1/')) {
        return await friendsFetch(request, env, url.pathname.substring('/friends/v1/'.length));
      }
      if (url.pathname.startsWith('/users/v1/')) {
        return await usersFetch(request, env, url.pathname.substring('/users/v1/'.length));
      }
      if (url.pathname.startsWith('/locations/v1/')) {
        return await locationsFetch(request, env, url.pathname.substring('/locations/v1/'.length));
      }

      throw new Error();
    } catch (error) {
      if (error.message) {
        return new Response(error.message, { status: 500 });
      } else {
        return new Response(JSON.stringify(error), { status: 500 });
      }
    }
  },
};
