import { Env } from './types';

type Auth0TokenResponse = {
  token_type: string;
  access_token: string;
};

type Auth0UserResponse = {
  user_id: string;
  username: string;
  name: string;
  nickname: string;
  given_name: string;
  family_name: string;
};

class Auth0Error extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}

const fetchToken = async (env: Env): Promise<Auth0TokenResponse> => {
  const response = await fetch('https://whuapp.eu.auth0.com/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.AUTH0_CLIENT_ID,
      client_secret: env.AUTH0_TOKEN,
      audience: 'https://whuapp.eu.auth0.com/api/v2/',
    }),
  });

  return await response.json();
};

export const fetchUser = async (id: string, env: Env): Promise<Auth0UserResponse> => {
  const token = await fetchToken(env);
  const headers = new Headers();
  const requestOptions = {
    method: 'GET',
    headers: headers,
    redirect: 'follow',
  };

  headers.append('Accept', 'application/json');
  headers.append('Authorization', `${token.token_type} ${token.access_token}`);

  const response = await fetch(`https://whuapp.eu.auth0.com/api/v2/users/${id}`, requestOptions);

  if (response.status === 200) {
    // TODO: Add necessary data to user object
    const data: Auth0UserResponse = await response.json();
    return data;
  } else {
    throw new Auth0Error(response.status, await response.text());
  }
};

export const userExists = async (id: string, env: Env): Promise<boolean> => {
  try {
    await fetchUser(id, env);
    return true;
  } catch (reason: unknown) {
    if (reason instanceof Auth0Error && reason.code === 404) {
      return false;
    }

    throw reason;
  }
};
