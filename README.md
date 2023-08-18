# Whu Backend

Base URL: `https://api.whu.app/`

## Services

### Friends

- GET `/friends/v1/list`
- GET `/friends/v1/requests/out/list`
- GET `/friends/v1/requests/in/list`
- POST `/friends/v1/request/send`
  - Payload: FriendRequestPayload
- POST `/friends/v1/request/accept`
  - Payload: FriendRequestPayload
- POST `/friends/v1/request/ignore`
  - Payload: FriendRequestPayload

```ts
type FriendRequestPayload = {
  friendId: string;
};
```

### Users

- GET `/users/v1/me`
- GET `users/v1/by-id/{id}`
- GET `users/v1/search/by-name/{nickname}`
