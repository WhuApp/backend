import { Env, GraphQLContext } from './types';
import { authenticateUser } from './auth';
import { userDataloader, usersSchemaConfig } from './services/users';
import { locationDataLoader, locationsSchemaConfig } from './services/locations';
import { createYoga } from 'graphql-yoga';
import { useDeferStream } from '@graphql-yoga/plugin-defer-stream';
import { stitchSchemas } from '@graphql-tools/stitch';
import { friendsSchemaConfig } from './services/friends';
import { delegateToSchema } from '@graphql-tools/delegate';
import { OperationTypeNode } from 'graphql/language';

const yoga = createYoga<GraphQLContext>({
  cors: {
    origin: '*',
    credentials: true,
    allowedHeaders: undefined,
    methods: ['POST'],
  },
  batching: true,
  plugins: [useDeferStream()],
  graphqlEndpoint: '/query',
  landingPage: false,
  schema: stitchSchemas<GraphQLContext>({
    subschemas: [usersSchemaConfig, locationsSchemaConfig, friendsSchemaConfig],
    typeDefs: `
      extend type User {
        location: Location
      }
    `,
    resolvers: {
      User: {
        location: {
          selectionSet: `{ id }`,
          resolve: ({ id }, _args, context, info) => {
            return delegateToSchema({
              schema: locationsSchemaConfig.schema,
              operation: OperationTypeNode.QUERY,
              fieldName: 'getLocationById',
              args: { id: id },
              context,
              info,
            });
          },
        },
      },
    },
  }),
});

export default <ExportedHandler<Env>>{
  async fetch(request, env, ctx): Promise<Response> {
    let authContext;

    // Verify auth
    try {
      authContext = await authenticateUser(request.headers);
    } catch (error: any) {
      return new Response(error, { status: 500 });
    }

    return yoga.fetch(request, {
      env: env,
      id: authContext.id,
      userDataLoader: userDataloader(env),
      locationDataLoader: locationDataLoader(env),
    });
  },
};
