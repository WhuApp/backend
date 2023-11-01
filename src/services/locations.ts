import { Env, GraphQLContext, TimedLocation } from '../types';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { SubschemaConfig } from '@graphql-tools/delegate/typings';
import DataLoader from 'dataloader';

const schema = makeExecutableSchema<GraphQLContext>({
  typeDefs: `
    type Query {
      getLocationById(id: String!): Location
    }

    type Mutation {
      setLocation(location: LocationParam!): Boolean!
    }

    type Location {
      latitude: Float!
      longitude: Float!
      altitude: Float!
      timestamp: Float!
    }

    input LocationParam {
      latitude: Float!
      longitude: Float!
      altitude: Float!
      timestamp: Float!
    }
  `,
  resolvers: {
    Query: {
      getLocationById: (_source, { id }, context) => {
        return context.locationDataLoader.load(id);
      },
    },
    Mutation: {
      setLocation: (_source, { location }, context) => {
        return updateLocation(location, context.id, context.env);
      },
    },
  },
});

export const locationsSchemaConfig: SubschemaConfig<any, any, any, GraphQLContext> = { schema };

export const locationDataLoader = (env: Env) => {
  return new DataLoader(
    async (keys: readonly string[]) =>
      (await Promise.all(
        keys.map((key) => env.LOCATION_KV.get(key, 'json'))
      )) as (TimedLocation | null)[]
  );
};

const updateLocation = async (location: TimedLocation, id: string, env: Env) => {
  if (!location.latitude || !location.longitude || !location.altitude || !location.timestamp) {
    throw new Response('Data wrong format', { status: 400 });
  }

  // Validate timestamp
  const currentSeconds = Math.floor(Date.now() / 1000);
  const requestSeconds = Math.floor(location.timestamp / 1000);

  if (requestSeconds > currentSeconds) {
    return new Response('Timestamp can not be in the future', { status: 400 });
  }

  // Cut incoming data
  const kvData: TimedLocation = {
    latitude: location.latitude,
    longitude: location.longitude,
    altitude: location.altitude,
    timestamp: location.timestamp,
  };

  await env.LOCATION_KV.put(id, JSON.stringify(kvData));

  return true;
};
