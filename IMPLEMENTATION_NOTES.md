# Implementation Notes - Log!t Cloud Sync

## Overview

This document explains how the cloud sync system integrates with Log!t's existing architecture.

---

## Architecture Layers

```
┌─ Browser & DOM ─────────────────────────────────┐
│ ┌─ UI Components ────────────────────────────┐  │
│ │ - Library Grid (existing)                  │  │
│ │ - Profile Page (new)                       │  │
│ │ - Welcome Screen (new)                     │  │
│ └────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────┤
│ ┌─ Business Logic ────────────────────────────┐ │
│ │ ├─ Auth Module (new)                       │ │
│ │ ├─ Sync Engine (new)                       │ │
│ │ ├─ Offline Queue (new)                     │ │
│ │ ├─ Movies Management (existing, extended)  │ │
│ │ └─ Storage (existing, extended)            │ │
│ └────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│ ┌─ Data Layer ────────────────────────────────┐ │
│ │ ├─ localStorage (local storage)            │ │
│ │ ├─ Sync Queue (localStorage)               │ │
│ │ └─ Supabase (cloud, when enabled)          │ │
│ └────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

---

## File Organization

### New Files

| File | Purpose | Dependencies |
|------|---------|--------------|
| `js/supabase.js` | Supabase client initialization | window.supabase |
| `js/auth.js` | Authentication flows | supabase.js |
| `js/sync.js` | Sync engine | supabase.js, storage.js, offline.js |
| `js/offline.js` | Offline queue management | localStorage |
| `js/profile.js` | Profile page functionality | All of above |
| `css/auth.css` | Auth UI styling | - |
| `welcome.html` | First-time user flow | auth.js |
| `profile.html` | User profile & settings | profile.js |
| `config.html` | Supabase configuration | supabase.js |

### Modified Files

| File | Changes |
|------|---------|
| `index.html` | Added Supabase script, auth init, profile button |
| `css/main.css` | No changes (backward compatible) |
| `js/storage.js` | Added `saveMovie()`, `deleteMovie()` methods |
| `README.md` | Updated to mention cloud features |

---

## Data Flow

### Creating a Movie

```
User fills form
    ↓
movies.js calls Logit.Movies.save()
    ↓
saveMovie() in storage.js:
    ├─ Save to localStorage (immediate)
    ├─ Queue for sync if authenticated
    └─ Return movie object
    ↓
(Async) Sync engine:
    ├─ Get pending from queue
    ├─ POST to Supabase
    ├─ If success: mark synced
    └─ If error: retry on next sync
```

### Updating a Movie

```
User modifies rating/notes
    ↓
modals.js calls updateMovie()
    ↓
Event handler queues change
    ↓
saveMovie(movie, 'update')
    ├─ Update localStorage
    └─ Queue for sync
    ↓
(Same as create) Sync engine processes
```

### Deleting a Movie

```
User clicks delete
    ↓
deleteMovie(movieId)
    ├─ Remove from localStorage
    └─ Queue deletion
    ↓
Sync engine sends DELETE to Supabase
```

---

## Storage Schema

### localStorage Keys

```javascript
// Movies (existing)
movies: JSON string of array

// Auth (new)
logit_offline_mode: 'true' | 'false'
logit_auth_token: JWT token (if using email)
logit_user_id: UUID of authenticated user

// Sync Queue (new)
logit_sync_queue: JSON string of queue items

// Settings (existing + new)
logit_auto_sync: 'true' | 'false'
logit_sync_wifi_only: 'true' | 'false'
logit_last_sync: timestamp
```

### Supabase Schema

See [CLOUD_SETUP.md](CLOUD_SETUP.md#step-4-create-database-schema) for full SQL.

Key tables:
- `users` - User profiles
- `movies` - User movies with cloud metadata
- `settings` - Per-user sync settings
- `sync_queue` - (Optional) For debugging

---

## Integration Points

### With existing Movie Management

The sync system integrates via the Storage layer:

```javascript
// OLD WAY (still works):
const movies = Logit.Storage.loadMovies();
// ... modify ...
Logit.Storage.saveMovies(movies);

// NEW WAY (recommended with cloud):
const movie = { id, title, rating, ... };
Logit.Storage.saveMovie(movie, 'create');  // Auto-queues for sync
```

### With existing Modals

Movie meta modal (`modals.js`) needs minor updates:

```javascript
// OLD:
Logit.Storage.saveMovies(movies);

// NEW (one-liner replacement):
// For each modified movie: Logit.Storage.saveMovie(movie, 'update');
```

### With existing Library Page

Library page initialization needs to check auth:

```javascript
// In LibraryPage.init():
await Logit.Auth.checkExistingSession();  // Load auth state
Logit.Sync.init();  // Start auto-sync if authenticated
```

---

## Sync Algorithm

### Upload (Client → Server)

```
For each pending change in queue:
  1. Validate movie data
  2. Add user_id and timestamp
  3. POST/PUT/DELETE to Supabase
  4. If success:
     - Mark queue item as synced
     - Save confirmation timestamp
  5. If error:
     - Store error message
     - Retry on next sync cycle
     - Max 3 retries per item
```

### Download (Server → Client)

```
Fetch all movies modified since last sync:
  1. Query Supabase: WHERE updated_at > lastSync
  2. For each remote movie:
     - Find local version by ID
     - If not exists: add to local
     - If exists:
        - If remote is newer:
          - Resolve conflicts (see below)
          - Update local
        - If local is newer:
          - Keep local (don't overwrite)
  3. Save merged list to localStorage
  4. Update last sync timestamp
```

### Conflict Resolution

When remote is newer but local has user changes:

```
merged = {
  ...remote,
  // Preserve local user preferences
  rating: local.rating,
  notes: local.notes,
  favorite: local.favorite,
  rewatch: local.rewatch,
  // Use remote for movie metadata
  title: remote.title,
  year: remote.year,
  director: remote.director,
  etc...
}
```

---

## State Management

### Auth State

```javascript
Logit.Auth._currentUser: {
  id: UUID,
  email: string,
  user_metadata?: { full_name?, ... }
}

Logit.Auth._offlineMode: boolean
```

### Sync State

```javascript
Logit.Sync._syncInProgress: boolean
Logit.Sync._lastSyncTime: timestamp | null
Logit.Sync._autoSyncInterval: setInterval ID
Logit.Sync._syncStatusCallbacks: array of listeners
```

### Queue State

```javascript
Logit.Offline._QUEUE_KEY: 'logit_sync_queue'

Queue item = {
  id: unique ID,
  action: 'create' | 'update' | 'delete',
  entity: 'movie' | 'settings',
  entityId: ID of changed entity,
  data: full entity data,
  timestamp: ISO string,
  synced: boolean,
  error: string | null
}
```

---

## Error Handling

### Network Errors

```javascript
// Supabase client catches network errors
// Queue item gets error message
// Retried on next sync cycle
// UI shows "Sync Failed" status
```

### Validation Errors

```javascript
// Invalid email format → alert user
// Missing required fields → alert user
// Malformed JSON → console.error + skip
// Username already taken → queries 'users' table first to verify uniqueness and alerts user
```

### Auth Errors

```javascript
// Invalid credentials → OAuth provider handles
// Expired token → Auto-refresh (Supabase handles)
// CORS issues → Check OAuth redirect URIs
// Duplicate email signup → detects "already" in error message and overrides with "Email already registered" message
```

### Database Errors

```javascript
// Row Level Security violation → sync fails
// Constraint violation → error stored in queue
// Table doesn't exist → error message shown
```

---

## Performance Considerations

### localStorage Limits

- Typical storage: ~5-10MB per domain
- 1000 movies ≈ 1-2MB (JSON)
- Queue items: ~1KB each
- Safe limit: 1000+ movies

### Sync Frequency

- Auto-sync: every 5 minutes (configurable)
- Can be disabled: `localStorage.setItem('logit_auto_sync', 'false')`
- Manual sync always available

### Network Optimization

- Batch deltas in one request
- No full resync on conflicts
- Only download changes since last sync
- Gzip compression (browser/Supabase handle)

---

## Browser Compatibility

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Requirements:
- localStorage API
- Fetch API
- Promise support
- ES6 features (arrow functions, async/await)

---

## Migration from v2.0 to v3.0

### Backward Compatibility

✅ Existing users can continue offline
✅ Data format unchanged (same localStorage keys)
✅ UI additions don't affect existing features
✅ No breaking changes

### Data Migration

```javascript
// Existing movies in localStorage remain unchanged
// On first cloud login: auto-upload to Supabase
// New movies: saved locally + queued for sync
// Old movies: bulk upserted with cloud
```

---

## Testing Strategy

### Unit Tests (Manual)

```javascript
// Test queue operations
Logit.Offline.enqueue('create', 'movie', id, data);
const queue = Logit.Offline.getPending();
assert(queue.length === 1);

// Test offline mode
localStorage.setItem('logit_offline_mode', 'true');
assert(Logit.Auth.isOfflineMode() === true);

// Test auth state
Logit.Auth._currentUser = { id: 'test', email: 'test@example.com' };
assert(Logit.Auth.isAuthenticated() === true);
```

### Integration Tests

1. **Offline → Online Flow**
   - Create movie offline
   - Go online
   - Verify sync to cloud

2. **Multi-Device Sync**
   - Edit on device A
   - Verify appears on device B

3. **Conflict Resolution**
   - Edit movie on A (rating)
   - Edit same on B (notes)
   - Merge on sync

### Manual QA Checklist

- [ ] First-time user flow (welcome screen)
- [ ] OAuth sign-in (Google, GitHub)
- [ ] Email + password sign-in
- [ ] Offline mode
- [ ] Sync progress indication
- [ ] Profile page displays correctly
- [ ] Settings toggles work
- [ ] Export/import functions
- [ ] Delete account
- [ ] Network disconnect/reconnect
- [ ] Storage limits handled gracefully

---

## Debugging Tools

### Console Commands

```javascript
// View queue
console.table(Logit.Offline.getPending());

// View sync stats
console.log(Logit.Offline.getStats());

// View auth state
console.log(Logit.Auth._currentUser);

// View storage size
console.log(Logit.Storage.getStorageSize());

// Manual sync
await Logit.Sync.sync();

// Toggle offline mode
localStorage.setItem('logit_offline_mode', 'true');
```

### Network Inspection

- DevTools → Network tab → Filter by XHR
- Watch for Supabase API calls
- Check response codes (2xx = success)
- Look for CORS errors

### localStorage Inspection

- DevTools → Application → Storage → localStorage
- Search for keys starting with `logit_`
- Watch `logit_sync_queue` for pending changes

---

## Future Enhancements

### Realtime Sync

```javascript
// Use Supabase Realtime subscriptions
Logit.Sync.subscribeToChanges();
// Instead of polling, get push notifications
```

### Collections Support

```javascript
// Add to schema:
CREATE TABLE collections (
  id UUID PRIMARY KEY,
  user_id UUID,
  name TEXT,
  ...
);

// Extend sync:
Logit.Offline.enqueue('create', 'collection', ...);
```

### Advanced Conflict Resolution

```javascript
// Currently: "last write wins"
// Future: Three-way merge with CRDT
// Or: Custom merge strategies per field
```

### Offline-First Database

```javascript
// Replace localStorage with IndexedDB
// Better performance, more storage
// Same API interface (abstraction)
```

---

## Support & Maintenance

### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Not configured" | No Supabase creds | Run /config.html |
| Sync stuck | Network error | Check connection, manual sync |
| Duplicates | Queue not cleared | Clear cache, resync |
| Movies not loading | RLS policy | Check Supabase settings |

### Monitoring

- Check browser console for errors
- Monitor Supabase dashboard for API errors
- Track sync success rate
- Alert on repeated failures

---

**Last Updated**: 2026-07-11

