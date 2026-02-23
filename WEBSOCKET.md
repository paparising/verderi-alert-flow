# WebSocket Live Alerts

WebSocket integration has been added to the Vederi Alert Flow application for real-time alert notifications.

## Backend WebSocket Gateway

### Features

- Real-time alert notifications via Socket.IO
- Organization-based room subscriptions
- Three event types:
  - `newAlert` - Emitted when a new alert is created
  - `alertStatusUpdate` - Emitted when alert status changes
  - `alertEvent` - Emitted when audit events are created

### Events

**Client → Server:**

- `joinOrg` - Subscribe to organization alerts (payload: orgId string)
- `leaveOrg` - Unsubscribe from organization alerts (payload: orgId string)

**Server → Client:**

- `newAlert` - New alert created (payload: Alert object)
- `alertStatusUpdate` - Alert status updated (payload: Alert object)
- `alertEvent` - Audit event created (payload: AlertEvent object)

## Frontend Integration

### AlertsList Component

Located at `packages/frontend/src/components/AlertsList.tsx`

Displays live alerts with:

- Real-time connection status indicator
- Animated alert list (new alerts slide in from top)
- Color-coded status badges (New: red, Acknowledged: orange, Resolved: green)
- Automatic updates when alert status changes

### useAlertSocket Hook

Located at `packages/frontend/src/hooks/useAlertSocket.ts`

React hook for managing WebSocket connections:

```typescript
const { isConnected } = useAlertSocket({
  orgId: "your-org-id",
  onNewAlert: (alert) => console.log("New alert:", alert),
  onAlertStatusUpdate: (alert) => console.log("Updated:", alert),
  onAlertEvent: (event) => console.log("Event:", event),
});
```

## Testing WebSocket

### 1. Start the application

```bash
docker compose --env-file .env.dev up --build
```

### 2. Access the frontend

Open http://localhost in your browser and navigate to the "Live Alerts" tab.

### 3. Create a new alert via API

```bash
curl -X POST http://localhost:3001/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": "replace-with-actual-org-id",
    "alertContext": "System CPU usage exceeded 90%",
    "status": "New",
    "createdBy": "user-uuid"
  }'
```

The alert should appear instantly in the frontend without refreshing!

### 4. Update alert status

```bash
curl -X PATCH http://localhost:3001/alerts/{alert-id}/status \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": "replace-with-actual-org-id",
    "status": "Acknowledged",
    "updatedBy": "user-uuid"
  }'
```

The alert status should update in real-time in the frontend!

## Configuration

The WebSocket server runs on the same port as the HTTP server (3001 in dev).

Frontend connects to WebSocket using the `REACT_APP_API_URL` environment variable.

### CORS

WebSocket gateway is configured to accept connections from all origins in development:

```typescript
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
```

For production, update this to restrict to your frontend domain.

## Architecture

```
┌─────────────┐         WebSocket          ┌─────────────┐
│   Frontend  │ ◄──────────────────────► │   Backend   │
│  (React)    │    Socket.IO Client       │  (NestJS)   │
└─────────────┘                            └─────────────┘
      │                                           │
      │ HTTP REST API                             │
      └───────────────────────────────────────────┘
           (POST /alerts, PATCH /alerts/:id/status)

Flow:
1. Frontend connects to WebSocket and joins org room
2. User creates/updates alert via REST API
3. Backend service emits WebSocket event
4. All clients in the org room receive instant update
5. Frontend updates UI without polling
```

## Troubleshooting

**WebSocket not connecting:**

- Check that backend is running on port 3001
- Verify REACT_APP_API_URL is set correctly
- Check browser console for connection errors

**Not receiving alerts:**

- Ensure you're using the correct orgId (update `currentOrgId` in App.tsx)
- Check backend logs for "Client joined org" messages
- Verify alerts are being created with matching orgId

**Connection drops:**

- Socket.IO automatically reconnects on disconnect
- Check network tab in browser DevTools
- Review backend logs for connection/disconnection messages
