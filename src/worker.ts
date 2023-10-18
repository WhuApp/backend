import { Env, Service } from './types';

// Imports all exported services as an array
import * as services from './services';

const ALLOWED_ORIGINS = ['https://whu.app', 'https://development.whu-homepage-astro.pages.dev'];
const ALLOWED_METHODS = ['GET', 'HEAD', 'POST', 'OPTIONS', 'DELETE'];

export default <ExportedHandler<Env>>{
  async fetch(request, env): Promise<Response> {
    // TODO: Wrapping everything inside a try block so the sender knows what went wrong - there might be things he should not know
    try {
      // Handle OPTIONS requests
      if (request.method === 'OPTIONS') {
        return handleOptions(request);
      }

      // Handle allowed method requests
      if (ALLOWED_METHODS.includes(request.method)) {
        return await handleRequest(request, env);
      }

      // Method not allowed
      return new Response(null, { status: 405 });
    } catch (error: unknown) {
      if (error instanceof Error) {
        return new Response(error.message, { status: 500 });
      }

      // in case someone throws a response ^^
      if (error instanceof Response) {
        return error;
      }

      return new Response(JSON.stringify(error), { status: 500 });
    }
  },
};

async function processRequest(request: Request, env: Env) {
  const url = new URL(request.url);
  const servicePath = `/${url.pathname.split('/').slice(1, 3).join('/')}/`;
  const subPath = url.pathname.substring(servicePath.length);

  const foundService = Object.values(services).filter(
    (service: Service) => service.path === servicePath
  )[0];

  if (foundService) {
    return await foundService.fetch(request, subPath, env);
  }

  return new Response('Service not found', { status: 404 });
}

async function handleRequest(request: Request, env: Env) {
  const origin = request.headers.get('Origin');
  let response = await processRequest(request, env);

  response = new Response(response.body, response);

  if (origin !== null && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }

  response.headers.append('Vary', 'Origin');

  return response;
}

function handleOptions(request: Request) {
  const headers = request.headers;

  if (
    headers.get('Origin') !== null &&
    headers.get('Access-Control-Request-Method') !== null &&
    headers.get('Access-Control-Request-Headers') !== null
  ) {
    if (!ALLOWED_ORIGINS.includes(headers.get('Origin')!)) {
      return new Response('CORS origin not accepted', { status: 403 });
    }

    const respHeaders = {
      'Access-Control-Allow-Origin': headers.get('Origin')!,
      'Access-Control-Allow-Methods': ALLOWED_METHODS.join(','),
      'Access-Control-Max-Age': '86400',
      'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') ?? '',
    };

    return new Response(null, { headers: respHeaders });
  }

  return new Response(null, { headers: { Allow: ALLOWED_METHODS.join(',') } });
}
