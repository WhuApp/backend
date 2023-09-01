import { Env, Service } from './types';
import * as services from './services';

export default <ExportedHandler<Env>>{
  async fetch(request, env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const servicePath = `/${url.pathname.split('/').slice(1, 3).join('/')}/`;

      const found = Object.values(services).filter(
        (service: Service) => service.path === servicePath
      )[0];

      if (found) {
        return await found.fetch(request, env, url.pathname.substring(servicePath.length));
      } else {
        throw new Error('Service not found');
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        return new Response(error.message, { status: 500 });
      } else {
        return new Response(JSON.stringify(error), { status: 500 });
      }
    }
  },
};
