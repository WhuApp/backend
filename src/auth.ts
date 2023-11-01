// "RSA256" refers to RSASSA-PKCS1-v1_5 w/ SHA256
import { AUTH0_DOMAIN } from './constants';

type JWK = {
  kty: 'RSA';
  use: 'sig';
  n: string;
  e: string;
  kid: string;
  x5t: string;
  x5c: string[];
  alg: 'RS256';
};

function base64DecodeURL(b64urlstring: string) {
  if (!b64urlstring) throw new Error('Undefined Base64');
  return new Uint8Array(
    atob(b64urlstring.replace(/-/g, '+').replace(/_/g, '/'))
      .split('')
      .map((val) => {
        return val.charCodeAt(0);
      })
  );
}

async function verifyToken(token: string): Promise<unknown> {
  const [meta, data, rsa] = token.split('.');
  if (!meta || !data || !rsa) throw new Error('Invalid JWT');
  const toHash = meta + '.' + data;

  const jwks: JWK[] = (
    (await (
      await fetch(new Request(`${AUTH0_DOMAIN}/.well-known/jwks.json`), {
        cf: { cacheEverything: true },
      })
    ).json()) as any
  ).keys;

  for (const jwk of jwks) {
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'sha-256' } },
      false,
      ['verify']
    );
    const rsaBuffer = base64DecodeURL(rsa);
    const toHashBuffer = new TextEncoder().encode(toHash);
    const res = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      key,
      rsaBuffer,
      toHashBuffer
    );

    if (res) {
      const content = JSON.parse(new TextDecoder().decode(base64DecodeURL(data)));

      if (content.exp < Date.now() / 1000) {
        throw new Error('Expired JWT');
      }

      return content;
    }
  }

  throw new Error('Invalid JWT');
}

export async function authenticateUser(headers: Headers) {
  const auth = headers.get('Authorization');

  if (!auth) {
    throw new Error('Missing authorization header');
  }

  const [scheme, token] = auth.split(' ');

  if (scheme !== 'Bearer') {
    throw new Error('Unknown Scheme: ' + scheme);
  }

  const tokenObject = await verifyToken(token);

  return { id: (tokenObject as any).sub };
}
