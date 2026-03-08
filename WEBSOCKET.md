# WebSocket Notes

Current behavior for `backend-notification` WebSocket gateway:

- JWT authentication is required during socket handshake.
- Supported token sources:
  - `auth.token` in Socket.IO connection options
  - `Authorization: Bearer <token>` header
- Required claims in JWT payload: `sub` and `orgId`.
- Unauthorized clients are disconnected on connect.
- `joinOrg` only allows joining the same `orgId` as in JWT claims.

Event names and Kafka routing details are documented in `README.md` under `Kafka & WebSockets`.
