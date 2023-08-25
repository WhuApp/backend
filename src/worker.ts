import { Env, Service } from './types';
import * as services from './services';

export default <ExportedHandler<Env>>{
  async fetch(request, env): Promise<Response> {
    try {
      const url = new URL(request.url);

      const path: string[] = url.pathname.split('/').slice(1);
      const pathService: string = `/${path[0]}/${path[1]}/`;

      const activeService = Object.values(services).filter(
        (service: Service) => service.path === pathService
      )[0];

      if (activeService) {
        return await activeService.fetch(request, env, url.pathname.substring(pathService.length));
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
