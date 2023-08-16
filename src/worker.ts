import { Env } from "./types";
import friendV1Fetch from "./services/friend_v1";

export default <ExportedHandler<Env>> {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/friends/v1/")) {
      return friendV1Fetch(
        request,
        env,
        url.pathname.substring("/friends/v1/".length),
      );
    }

    throw new Error();
  },
};
