import { Env, GraphQLContext } from '../types';
import { deleteAuthUser, fetchUser, fetchUserSearch } from '../auth0';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { SubschemaConfig } from '@graphql-tools/delegate';
import DataLoader from 'dataloader';

const schema = makeExecutableSchema<GraphQLContext>({
  typeDefs: `
    type Query {
      me: User!
      getUserById(id: String!): User
      searchUsersByName(name: String!): [User!]!
    }

    type Mutation {
      deleteMe: Boolean!
    }

    type User {
      id: String!
      email: String!
      nickname: String!
    }
  `,
  resolvers: {
    Query: {
      me: (_source, _args, context) => {
        if (!context.authCtx) throw new Error("You have to be logged in to query this");
        return context.userDataLoader.load(context.authCtx.id);
      },
      getUserById: (_source, { id }, context) => {
        if (!context.authCtx) throw new Error("You have to be logged in to query this");
        return context.userDataLoader.load(id);
      },
      searchUsersByName: async (_source, { name }, context) => {
        if (!context.authCtx) throw new Error("You have to be logged in to query this");
        return await context.userDataLoader.loadMany(await fetchUserSearch(name, context.env));
      },
    },
    Mutation: {
      deleteMe: (_source, _args, context) => {
        if (!context.authCtx) throw new Error("You have to be logged in to query this");
        return deleteAuthUser(context.authCtx.id, context.env);
      },
    },
  },
});

export const usersSchemaConfig: SubschemaConfig<any, any, any, GraphQLContext> = {
  schema,
  batch: true,
};

export const userDataloader = (env: Env) => {
  return new DataLoader(
    async (keys: readonly string[]) => await Promise.all(keys.map((key) => fetchUser(key, env)))
  );
};
