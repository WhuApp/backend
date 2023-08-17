import { Env } from './types';
import friendsFetch from './services/friend_v1';
import usersFetch from './services/users_v1';

export default <ExportedHandler<Env>>{
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    // TODO: Switch statement & endpoint constants
    if (url.pathname.startsWith('/friends/v1/')) {
      return friendsFetch(request, env, url.pathname.substring('/friends/v1/'.length));
    }
    if (url.pathname.startsWith('/users/v1/')) {
      return usersFetch(request, env, url.pathname.substring('/users/v1/'.length));
    }

    throw new Error();
  },
};
