# Log!t Database Migration & Hardening Guide

This guide provides authoritative instructions for applying PostgreSQL schema migrations and Row Level Security (RLS) policies to a Supabase project hosting Log!t.

---

## 1. Migration Overview & Execution Order

All database scripts in the `supabase/` directory are written to be **100% idempotent**. They can be safely executed repeatedly on a new database or an existing production database without data loss, duplicate constraint errors, or syntax errors.

### Execution Order:

| Step | Script File | Description | Target Environment |
|---|---|---|---|
| **Step 1** | [`supabase/schema.sql`](file:///C:/Users/User/logit/supabase/schema.sql) | Complete schema, tables, constraints, indexes, RLS, & RPCs | **Fresh Installs** |
| **Step 1 (Alternative)** | [`supabase/migrations.sql`](file:///C:/Users/User/logit/supabase/migrations.sql) | Idempotent table constraints, missing columns, & indexes | **Existing Upgrades** |
| **Step 2** | [`supabase/rls-setup.sql`](file:///C:/Users/User/logit/supabase/rls-setup.sql) | Row Level Security policies & secure authentication RPCs | **All Upgrades** |

---

## 2. Step-by-Step Deployment Instructions

### Method A: Fresh Supabase Project (New Deployment)

1. Log into your [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project and navigate to the **SQL Editor** in the left sidebar.
3. Open [`supabase/schema.sql`](file:///C:/Users/User/logit/supabase/schema.sql) in your code editor, copy the entire contents, paste it into the Supabase SQL Editor, and click **Run**.
4. Confirm all statements completed successfully. All 4 tables (`users`, `movies`, `settings`, `pending_movies`), RLS policies, performance indexes, and helper functions are now active.

---

### Method B: Existing Database Upgrade (Production Hardening)

If you already have a running Log!t database with existing user movies:

#### 1. Apply Constraints & Performance Indexes
Open [`supabase/migrations.sql`](file:///C:/Users/User/logit/supabase/migrations.sql), paste into Supabase SQL Editor, and click **Run**.
- **What this does:**
  - Adds performance indexes for `user_id`, `updated_at`, `tmdb_id`, and `username`.
  - Safely enforces `id NOT NULL`, `user_id NOT NULL`, and `t NOT NULL` on `movies`.
  - Idempotently adds PostgreSQL CHECK constraints (`chk_rating_range`, `chk_runtime_positive`, `chk_year_range`) using catalog verification (`IF NOT EXISTS (SELECT 1 FROM pg_constraint ...)`).
  - Creates the `pending_movies` table if it was not already present.

#### 2. Apply Hardened Row Level Security & RPCs
Open [`supabase/rls-setup.sql`](file:///C:/Users/User/logit/supabase/rls-setup.sql), paste into Supabase SQL Editor, and click **Run**.
- **What this does:**
  - Drops the insecure `USING (true)` profile SELECT policy.
  - Enforces `auth.uid() = id` on `users` table so users can **only** read and edit their own account row.
  - Enforces strict tenant isolation on `movies`, `settings`, and `pending_movies`.
  - Installs `get_email_for_username(lookup_username text)` and `check_username_available(check_username text)` with `SECURITY DEFINER` and search_path isolation.

---

## 3. Detailed Idempotency Architecture

PostgreSQL does not natively support `ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS`. To guarantee safe, repeatable migrations without errors:

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_rating_range') THEN
    ALTER TABLE movies
      ADD CONSTRAINT chk_rating_range
      CHECK (r IS NULL OR (r ~ '^[0-9]+(\.[0-9]+)?$' AND CAST(r AS numeric) >= 0.5 AND CAST(r AS numeric) <= 5.0));
  END IF;
END $$;
```

Similarly, all policies drop any legacy identically named policies before recreating them:
```sql
DROP POLICY IF EXISTS "Users can view own movies" ON movies;
CREATE POLICY "Users can view own movies"
  ON movies FOR SELECT
  USING (auth.uid() = user_id);
```

---

## 4. Verification Queries

After executing the scripts, paste and run these verification queries in the Supabase SQL Editor:

```sql
-- 1. Verify RLS is enabled on all tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('movies', 'settings', 'users', 'pending_movies');
-- Result: All 4 tables must show rowsecurity = true

-- 2. Verify check constraints exist
SELECT conname, contype 
FROM pg_constraint 
WHERE conname IN ('chk_rating_range', 'chk_runtime_positive', 'chk_year_range', 'chk_pending_status');
-- Result: 4 check constraints returned

-- 3. Verify RPC helper functions exist and are executable
SELECT proname, prosecdef 
FROM pg_proc 
WHERE proname IN ('get_email_for_username', 'check_username_available');
-- Result: Both functions returned with prosecdef = true (SECURITY DEFINER)
```

---

## 5. Rollback Procedures

If an emergency rollback of RLS policies is required:

```sql
-- Revert users table to open profile select (legacy state)
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view profiles" ON users FOR SELECT USING (true);
```
*(Note: Reverting will re-expose user emails to client-side enumeration and should only be done temporarily for diagnostic purposes).*
