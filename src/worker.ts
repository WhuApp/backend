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
          return new Response('Service not found', { status: 404 });
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          return new Response(error.message, { status: 500 });
        } else if (error instanceof Response) {
          return error;
        } else {
          return new Response('In code error: ' + error, { status: 500 });
        }
      }
    }

    const allowedOrigins: string[] = [
      'https://whu.app',
      'https://development.whu-homepage-astro.pages.dev',
    ];

    const allowedMethods: string = 'GET,HEAD,POST,OPTIONS,DELETE';
    const allowedMethodsAr: string[] = allowedMethods.split(',');

    function handleOptions(request: Request) {
      const respHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': allowedMethods,
        'Access-Control-Max-Age': '86400',
        'Access-Control-Allow-Headers':
          request.headers.get('Access-Control-Request-Headers') ?? '',
      };

      return new Response(null, {
        headers: respHeaders,
      });
    }

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
      return handleOptions(request);
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
