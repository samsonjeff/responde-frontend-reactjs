-- ==============================================================================
-- Migration: Allow officer triage writes to public.incident_reports
-- Purpose: The Command Dashboard persists Verify / Resolve / Reject / Save /
--   Incomplete actions through PATCH /api/auth/data/incident-reports/:id.
--   Reads work (a permissive SELECT policy already exists), but if the API
--   writes with a per-user JWT (the `authenticated` role) there is currently
--   no INSERT or UPDATE policy, so every save fails row-level security and
--   the UI rolls the change back — it looks like "Save" does nothing.
--   This adds the missing authenticated write policies, gated on an active
--   row in public.system_users, so only active staff accounts can write.
--   NOTE: if the API writes with the service_role key, RLS is bypassed and
--   this migration changes nothing. In that case the failure is in the API
--   handler itself (check the worker logs and the PATCH response body in
--   the browser devtools Network tab), not in the database — do not apply
--   this file blindly; confirm the PATCH error first (see notes below).
--   How to confirm before applying:
--     1. Open the app, press F12 -> Network tab, click "Save Changes".
--     2. Find PATCH .../api/auth/data/incident-reports/:id and read it:
--        - 401                 -> session expired, sign in again (no DB fix).
--        - 400 "column X does not exist"
--                             -> API forwards raw camelCase keys; fix the API
--                                mapping, not the DB.
--        - 403 / 500 mentioning row-level security, policy, or permission
--          with a user JWT   -> apply THIS file.
--        - request never resolves / backend unreachable
--                             -> API worker is down; no DB fix applies.
-- Date: 2026-11-03
-- Safe to re-run (idempotent).
-- ==============================================================================

DO $$
BEGIN
    -- INSERT: officers creating a triage row for a report id.
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'incident_reports'
          AND policyname = 'incident_reports_insert_officers'
    ) THEN
        CREATE POLICY incident_reports_insert_officers
            ON public.incident_reports
            FOR INSERT
            TO authenticated
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.system_users su
                    WHERE su.auth_user_id = auth.uid()
                      AND su.is_active = true
                )
            );
    END IF;

    -- UPDATE: officers changing triage fields (type, barangay, urgency,
    -- status, action, coordinates, rejection reason, ...).
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'incident_reports'
          AND policyname = 'incident_reports_update_officers'
    ) THEN
        CREATE POLICY incident_reports_update_officers
            ON public.incident_reports
            FOR UPDATE
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.system_users su
                    WHERE su.auth_user_id = auth.uid()
                      AND su.is_active = true
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.system_users su
                    WHERE su.auth_user_id = auth.uid()
                      AND su.is_active = true
                )
            );
    END IF;
END $$;
