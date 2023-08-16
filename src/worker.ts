import { Env } from './types';

export default <ExportedHandler<Env>>{
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    throw new Error();
  },
};
