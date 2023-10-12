import { Env, Service } from './types';
import * as services from './services';

export default <ExportedHandler<Env>>{
  async fetch(request, env): Promise<Response> {
    async function api(request: Request) {
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
    }

    const allowedOrigins: string[] = [
      'https://whu.app',
      'https://development.whu-homepage-astro.pages.dev',
    ];

    const allowedMethods: string = 'GET,HEAD,POST,OPTIONS,DELETE';
    const allowedMethodsAr: string[] = allowedMethods.split(',');

    async function handleRequest(request: Request) {
      let response = await api(request);
      response = new Response(response.body, response);

      const origin = request.headers.get('Origin');
      if (origin !== null && allowedOrigins.includes(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin);
      }

      response.headers.append('Vary', 'Origin');

      return response;
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 203, headers: { 'Access-Control-Allow-Origin': '*' } })
    } else if (allowedMethodsAr.includes(request.method)) {
      return handleRequest(request);
    } else {
      return new Response(null, {
        status: 405,
        statusText: 'Method Not Allowed',
      });
    }
  },
};
