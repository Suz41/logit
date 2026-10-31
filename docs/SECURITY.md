# Log!t Security & Access Architecture

This document outlines the security controls, Row Level Security (RLS) policies, authentication flows, OAuth permission scopes, session timeout mechanics, and account deletion procedures implemented in Log!t.

---

## 1. Authentication & Profile Protection

### Row Level Security (RLS) Isolation
Log!t uses Supabase Auth with PostgreSQL Row Level Security. Every table containing user data (`movies`, `settings`, `pending_movies`, `users`) has RLS enforced:

```sql
ALTER TABLE movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_movies ENABLE ROW LEVEL SECURITY;
```

### Profile & Email Privacy (Remediation of F-02)
- **Previous Vulnerability**: The `users` table previously had a policy `ON users FOR SELECT USING (true)` to allow username login lookups. This allowed anyone to query all users and view registered email addresses, user IDs, and creation dates.
- **Hardened Architecture**:
  - The `users` table SELECT policy is now restricted strictly to `auth.uid() = id`.
  - To support sign-in via username without exposing the user table, a narrowly scoped `SECURITY DEFINER` function was created:
    ```sql
    CREATE OR REPLACE FUNCTION get_email_for_username(lookup_username text)
    RETURNS text
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    ...
    ```
  - This function takes a single username, validates input length (1–60 chars), queries for an exact match where `deleted_at IS NULL`, and returns only that user's email address for authentication. Bulk enumeration or dumping is impossible.
  - Similarly, `check_username_available(check_username text)` safely returns a boolean without returning any profile rows.

---

## 2. Inactivity Timeout (Remediation of F-14)

### Mechanics
- **Timeout Threshold**: 60 minutes (`Logit.Auth._SESSION_TIMEOUT = 3600000`).
- **Activity Tracking**:
  - `Logit.Auth.initActivityTracker()` listens to passive user interactions: `mousedown`, `keydown`, `touchstart`, and `scroll`.
  - Updates `localStorage.getItem('logit_session_timeout')` debounced to at most once every 15 seconds.
  - Heartbeat checks run every 60 seconds.
- **Expiration Behavior**:
  - When the timeout threshold is exceeded without interaction, the client calls `Logit.Auth.signOut('timeout')`.
  - Clears auth session, user ID, session timeout timestamp, and Google Drive access tokens.
  - Navigates user to `welcome.html?reason=timeout` with a clear user notice.

---

## 3. Google OAuth & Drive Security (Remediation of F-12)

### Least-Privilege Scope
- **Previous Configuration**: Full `https://www.googleapis.com/auth/drive` scope, which requested unrestricted access to all files in the user's entire Google Drive.
- **Hardened Configuration**:
  ```javascript
  _SCOPE: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile'
  ```
  `drive.file` only grants Log!t permission to view and manage files that Log!t itself created or that the user specifically opened with Log!t. Log!t cannot view or alter other personal files or documents in the user's Drive.

### Token Management & Disconnect
- Tokens are held in memory during the session and mirrored to `sessionStorage` (with fallback to `localStorage` for auto-backup persistence).
- When a user signs out of Log!t or disconnects Drive:
  - `Logit.Drive.signOut()` invokes `google.accounts.oauth2.revoke(token)` to invalidate the grant on Google's servers.
  - Purges all cached tokens, folder IDs, and user profile information from local and session storage.
  - Prevents cross-account token reuse when multiple users share a device.

---

## 4. Account Deletion Workflow (Remediation of F-06)

### Frontend Workflow
1. User clicks **Delete Account** in [`js/profile.js`](file:///C:/Users/User/logit/js/profile.js).
2. The user is prompted to re-enter their current password for re-authentication.
3. Upon successful password verification, the user must explicitly type `"DELETE"` to confirm the permanent action.
4. The client executes data purge across all tables:
   - Deletes all movies (`client.from('movies').delete().eq('user_id', userId)`)
   - Deletes all pending captures (`client.from('pending_movies').delete().eq('user_id', userId)`)
   - Deletes all user settings (`client.from('settings').delete().eq('user_id', userId)`)
   - Deletes the profile record from `users`
5. Revokes Google Drive access and clears all local storage.
6. Signs out and redirects to the welcome screen.

### Supabase Edge Function Architecture (Server-Side Auth Account Purge)
Because client-side JavaScript cannot delete records from Supabase's private `auth.users` table without exposing the master `SUPABASE_SERVICE_ROLE_KEY` (which is strictly forbidden in frontend code), production deployments should deploy a server-side Supabase Edge Function to complete the Auth user deletion:

```typescript
// Supabase Edge Function: delete-user-account
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), { status: 401 });
  }

  // 1. Verify caller using standard Anon key & JWT
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  // 2. Admin client with service-role key to delete auth user
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const { error: deleteErr } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteErr) {
    return new Response(JSON.stringify({ error: deleteErr.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true, message: "User account deleted." }), {
    headers: { "Content-Type": "application/json" }
  });
});
```

---

## 5. Development Server Security (Remediation of F-16)

[`scripts/serve.js`](file:///C:/Users/User/logit/scripts/serve.js) contains protections against local environment vulnerabilities:
- **Localhost Loopback Binding**: The HTTP server binds exclusively to `127.0.0.1` (`HOST = process.env.HOST || '127.0.0.1'`) to prevent exposure to external devices on the local area network.
- **Strict Boundary Resolution**: `resolveSafePath()` checks every file request:
  - Validates and rejects URL-encoded traversal (`%2e%2e`), `../` sequences, and null bytes (`\0`).
  - Uses `path.resolve` and `path.relative` to ensure files cannot be served from outside the project directory (including sibling directories like `../logit-secret`).

---

## 6. Service Worker & PWA Caching Security (Remediation of F-17)

The Service Worker in [`sw.js`](file:///C:/Users/User/logit/sw.js) adheres to safe caching rules:
- Caches **only** static assets (HTML shell, CSS, vanilla JS, images, webmanifest).
- Explicitly **excludes** all requests matching:
  - `/api/*` endpoints
  - `*.supabase.co` (Supabase database and Auth API)
  - `*.googleapis.com` and `accounts.google.com` (OAuth tokens and user data)
- Sensitive movie logs, user emails, or tokens are never stored in the unencrypted Cache API.
