import { Env } from './types';
import { AUTH0_DOMAIN } from './constants';

// Used to cache short-lived access tokens
// https://auth0.com/docs/secure/tokens/access-tokens/get-management-api-access-tokens-for-production
let managementApiToken: Auth0Token;

type Auth0TokenResponse = {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

type Auth0Token = {
  token: string;
  expiresAt: number;
};

type Auth0UserResponse =
  | ({
      success: true;
    } & Auth0User)
  | {
      success: false;
      message: string;
      statusCode: number;
    };

type Auth0User = {
  user_id: string;
  email: string;
  nickname: string;
};

const getOrFetchManagementApiToken = async (env: Env): Promise<string> => {
  if (managementApiToken && managementApiToken.expiresAt < Date.now()) {
    return managementApiToken.token;
  }

  const response = await fetch(`${AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.AUTH0_CLIENT_ID,
      client_secret: env.AUTH0_TOKEN,
      audience: `${AUTH0_DOMAIN}}/api/v2/`,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Auth0 management API token: ${response.status} ${response.statusText}`
    );
  }

  const json: Auth0TokenResponse = await response.json();

  managementApiToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };

  return managementApiToken.token;
};

export const fetchUserSearch = async (name: string, env: Env): Promise<string[]> => {
  const token = await getOrFetchManagementApiToken(env);
  const headers = new Headers();
  const requestOptions = {
    method: 'GET',
    headers: headers,
    redirect: 'follow',
  };

  headers.append('Accept', 'application/json');
  headers.append('Authorization', `Bearer ${token}`);

  const response = await fetch(
    `${AUTH0_DOMAIN}/api/v2/users?search_engine=v3&q=${encodeURIComponent(`nickname:"${name}"`)}`,
    requestOptions
  );

  if (response.status === 200) {
    const result: any[] = await response.json();

    return result.map((user) => user.user_id);
  }

  throw new Error(`Auth0Error: ${response.status} ${await response.text()}`);
};

export const fetchUser = async (id: string, env: Env): Promise<Auth0UserResponse> => {
  const token = await getOrFetchManagementApiToken(env);
  const headers = new Headers();
  const requestOptions = {
    method: 'GET',
    headers: headers,
    redirect: 'follow',
  };

  headers.append('Accept', 'application/json');
  headers.append('Authorization', `Bearer ${token}`);

  const response = await fetch(`${AUTH0_DOMAIN}/api/v2/users/${id}`, requestOptions);

  if (response.status === 200) {
    const data: Auth0User = await response.json();
    return {
      success: true,
      user_id: data.user_id,
      email: data.email,
      nickname: data.nickname,
    };
  } else {
    return {
      success: false,
      statusCode: response.status,
      message: await response.text(),
    };
  }
};

export const userExists = async (id: string, env: Env): Promise<boolean> => {
  const user = await fetchUser(id, env);

  if (user.success) return true;
  if (user.statusCode === 404) return false;

  throw new Error(`Auth0Error: ${user.statusCode} ${user.message}`);
};

export const deleteAuthUser = async (id: string, env: Env): Promise<string | undefined> => {
  const token = await getOrFetchManagementApiToken(env);
  const headers = new Headers();
  const requestOptions = {
    method: 'DELETE',
    headers: headers,
    redirect: 'follow',
  };

  headers.append('Accept', 'application/json');
  headers.append('Authorization', `Bearer ${token}`);

  const response = await fetch(`${AUTH0_DOMAIN}/api/v2/users/${id}`, requestOptions);

  if (response.status !== 204) return `Auth0Error: ${response.status} ${await response.text()}`;
};
