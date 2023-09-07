import { Env, Service } from '../types';
import { authenticateUser } from '../auth';

type LocationRequestPayload = TimedLocation;

type LocationRequest = {
  timedLocation: TimedLocation;
  from: string;
};

type TimedLocation = {
  latitude: number;
  longitude: number;
  altitude: number;
  timestamp: number;
};

const LocationV1: Service = {
  path: '/locations/v1/',
  fetch: async (request: Request, env: Env, subpath: string): Promise<Response> => {
    const authContext = await authenticateUser(request.headers);
    const senderId = authContext.userId;
    const pathSegments: string[] = subpath.split('/');

    switch (request.method) {
      case 'POST': {
        const body: LocationRequestPayload = await request.json();
        const locationRequest: LocationRequest = {
          from: senderId,
          timedLocation: body,
        };
        switch (pathSegments[0]) {
          case 'me':
            return await storeData(locationRequest, env);
        }
        break;
      }
      case 'GET': {
        switch (pathSegments[0]) {
          case 'me': {
            return await dataById(senderId, env);
          }
          case 'by-id': {
            const id = decodeURI(pathSegments[1]);

            if (!id) {
              throw new Error('No user id provided');
            }

            const friends: string[] = (await env.FRIENDS_KV.get(senderId, 'json')) ?? [];

            if (!friends.includes(id)) {
              return new Response('No access', { status: 401 });
            }

            return await dataById(id, env);
          }
        }
        break;
      }
    }
    throw new Error('Service not implemented');
  },
};

const storeData = async (request: LocationRequest, env: Env): Promise<Response> => {
  const id = request.from;
  const location = request.timedLocation;

  if (!location.latitude || !location.longitude || !location.altitude || !location.timestamp) {
    throw new Response('Data wrong format', { status: 400 });
  }

  if (location.timestamp > Date.now()) {
    throw new Response('Invalid data', { status: 400 });
  }

  //cut incomming data
  const kvData: TimedLocation = {
    latitude: location.latitude,
    longitude: location.longitude,
    altitude: location.altitude,
    timestamp: location.timestamp,
  };

  await env.LOCATION_KV.put(id, JSON.stringify(kvData));

  return new Response(undefined, { status: 201 });
};

const dataById = async (id: string, env: Env): Promise<Response> => {
  return Response.json(await env.LOCATION_KV.get(id, 'json'), { status: 200 });
};

export default LocationV1;
