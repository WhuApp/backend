import { Auth0User, Env } from './types';
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

type Auth0UserResponse = {
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
      audience: `${AUTH0_DOMAIN}/api/v2/`,
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

// https://auth0.com/docs/api/management/v2/users/get-users-by-id
export const fetchUser = async (id: string, env: Env): Promise<Auth0User | null> => {
  const token = await getOrFetchManagementApiToken(env);
  const response = await fetch(`${AUTH0_DOMAIN}/api/v2/users/${id}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    redirect: 'follow',
  });

  // User not found
  if (response.status === 404) {
    return null;
  }

  // User successfully retrieved
  if (response.status === 200) {
    const user: Auth0UserResponse = await response.json();

    return {
      id: user.user_id,
      email: user.email,
      nickname: user.nickname,
    };
  }

  // Something went wrong
  throw new Error(`Auth0Error: ${response.status} ${await response.text()}`);
};

export const fetchUserSearch = async (name: string, env: Env): Promise<string[]> => {
  const token = await getOrFetchManagementApiToken(env);
  const response = await fetch(
    `${AUTH0_DOMAIN}/api/v2/users?search_engine=v3&q=${encodeURIComponent(`nickname:"${name}"`)}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      redirect: 'follow',
    }
  );

  if (response.status === 200) {
    const result: Auth0UserResponse[] = await response.json();
    return result.map((user) => user.user_id);
  }

  throw new Error(`Auth0Error: ${response.status} ${await response.text()}`);
};

export const deleteAuthUser = async (id: string, env: Env): Promise<boolean> => {
  const token = await getOrFetchManagementApiToken(env);
  const response = await fetch(`${AUTH0_DOMAIN}/api/v2/users/${id}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    redirect: 'follow',
  });

  if (response.status === 204) {
    return true;
  }

  throw new Error(`Auth0Error: ${response.status} ${await response.text()}`);
};
