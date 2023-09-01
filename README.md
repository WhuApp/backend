# Whu Backend

Base URL: `https://api.whu.app/`

## Services

### Friends

- GET `/friends/v1/list`
  - Response: `string[]`
- GET `/friends/v1/requests/out/list`
  - Response: `string[]`
- GET `/friends/v1/requests/in/list`
  - Response: `string[]`
- POST `/friends/v1/requests/send`
  - Payload: `FriendRequestPayload`
- POST `/friends/v1/requests/accept`
  - Payload: `FriendRequestPayload`
- POST `/friends/v1/requests/ignore`
  - Payload: `FriendRequestPayload`
- POST `/friends/v1/requests/cancel`
  - Payload: `FriendRequestPayload`
- POST `/friends/v1/remove`
  - Payload: `FriendRequestPayload`

```ts
type FriendRequestPayload = {
  friendId: string;
};
```

### Users

- GET `/users/v1/me`
  - Response: `User`
- GET `/users/v1/by-id/{id}`
  - Response: `User`
- GET `/users/v1/search/by-name/{nickname}`
  - Response: `string[]`

```ts
type User = {
  user_id: string;
  email: string;
  nickname: string;
};
```

### Locations

- POST `/locations/v1/me`
  - Payload: `TimedLocation`
- GET `/locations/v1/me`
  - Response: `TimedLocation`
- GET `/locations/v1/by-id/{id}`
  - Response: `TimedLocation`

```ts
type TimedLocation = {
  latitude: number;
  longitude: number;
  altitude: number;
  timestamp: number;
};
```
