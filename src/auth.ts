type AuthObject = { userId: string };

// "RSA256" refers to RSASSA-PKCS1-v1_5 w/ SHA256
type JWK = {
  kty: "RSA";
  use: "sig";
  n: string;
  e: string;
  kid: string;
  x5t: string;
  x5c: string[];
  alg: "RS256";
};

function base64DecodeURL(b64urlstring: string) {
  return new Uint8Array(
    atob(b64urlstring.replace(/-/g, "+").replace(/_/g, "/"))
      .split("")
      .map((val) => {
        return val.charCodeAt(0);
      }),
  );
}

async function verifyToken(token: string): Promise<unknown> {
  const [meta, data, rsa] = token.split(".");
  const toHash = meta + "." + data;

  const jwks: JWK[] = (
    (await (
      await fetch(
        new Request("https://whuapp.eu.auth0.com/.well-known/jwks.json"),
        {
          cf: { cacheEverything: true },
        },
      )
    ).json()) as any
  ).keys;

  for (const jwk of jwks) {
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: { name: "sha-256" } },
      false,
      ["verify"],
    );
    const rsaBuffer = base64DecodeURL(rsa);
    const toHashBuffer = new TextEncoder().encode(toHash);
    const res = await crypto.subtle.verify(
      { name: "RSASSA-PKCS1-v1_5" },
      key,
      rsaBuffer,
      toHashBuffer,
    );

    if (res) {
      return JSON.parse(new TextDecoder().decode(base64DecodeURL(data)));
    }
  }

  throw new Error("Invalid JWT");
}

export async function authenticateUser(headers: Headers): Promise<AuthObject> {
  const auth = headers.get("Authorization");

  if (!auth) {
    throw new Error("Missing authorization header");
  }

  const [scheme, token] = auth.split(" ");

  if (scheme !== "Bearer") {
    throw new Error("Unknown Scheme: " + scheme);
  }

  const tokenObject = await verifyToken(token);

  return { userId: (tokenObject as any).sub };
}
