import DataLoader from 'dataloader';

export interface Env {
  // Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
  // MY_KV_NAMESPACE: KVNamespace;
  //
  // Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
  // MY_DURABLE_OBJECT: DurableObjectNamespace;
  //
  // Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
  // MY_BUCKET: R2Bucket;
  //
  // Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
  // MY_SERVICE: Fetcher;
  //
  // Example binding to a Queue. Learn more at https://developers.cloudflare.com/queues/javascript-apis/
  // MY_QUEUE: Queue;

  AUTH0_TOKEN: string;
  AUTH0_CLIENT_ID: string;

  FRIENDS_KV: KVNamespace;
  REQUESTS_IN_KV: KVNamespace;
  REQUESTS_OUT_KV: KVNamespace;
  LOCATION_KV: KVNamespace;
}

export interface GraphQLContext {
  authCtx: { id : string } | null,
  env: Env;
  userDataLoader: DataLoader<string, Auth0User | null>;
  locationDataLoader: DataLoader<string, TimedLocation | null>;
  exectx: ExecutionContext,
}

export type TimedLocation = {
  latitude: number;
  longitude: number;
  altitude: number;
  timestamp: number;
};

export type Auth0User = {
  id: string;
  email: string;
  nickname: string;
};
