import { Env } from './types';

type Auth0TokenResponse = {
  token_type: string;
  access_token: string;
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

export const fetchUserSearch = async (name: string, env: Env): Promise<string[]> => {
  const token = await fetchToken(env);
  const headers = new Headers();
  const requestOptions = {
    method: 'GET',
    headers: headers,
    redirect: 'follow',
  };

  headers.append('Accept', 'application/json');
  headers.append('Authorization', `${token.token_type} ${token.access_token}`);

  const response = await fetch(
    `https://whuapp.eu.auth0.com/api/v2/users?search_engine=v3&q=${encodeURIComponent(
      `nickname:"${name}"`
    )}`,
    requestOptions
  );

  if (response.status === 200) {
    const result: any[] = await response.json();

    return result.map((user) => user.user_id);
  }

  throw new Error(`Auth0Error: ${response.status} ${await response.text()}`);
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
