(Final Cleanup: Removing Client-side Admin Dependency)
1. Current Situation
Success: The Supabase Edge Function create-employee has been successfully deployed and environment variables (SUPABASE_SERVICE_ROLE_KEY, BACKGROUND_CHECK_API_URL) are set in the Supabase Dashboard.

Security Action: As planned, VITE_SUPABASE_SERVICE_ROLE_KEY has been removed from Netlify environment variables to prevent leakage.

The Problem: The frontend application is crashing with the error: Uncaught Error: supabaseKey is required.

2. Root Cause Analysis
The frontend code (specifically in src/lib/supabase.ts or adminClient.ts) is still attempting to initialize a Supabase client using the now-deleted VITE_SUPABASE_SERVICE_ROLE_KEY.
Since createClient(url, undefined) is called during the application load, it throws an uncaught exception, preventing the entire React app from rendering.

3. Required Fixes
A. Refactor adminClient Initialization
Modify the adminClient creation logic to be defensive. It should not throw an error if the key is missing.

Instead, it should return null or be entirely removed if all administrative tasks have been migrated to Edge Functions.

B. Final Migration of useEmployees.ts
Ensure all calls previously using adminClient (e.g., adminClient.auth.admin.createUser) are fully replaced with supabase.functions.invoke('create-employee', { body: ... }).

Remove any imports of adminClient from the hooks to prevent the initialization error from triggering.

C. Clean up PortalPage.tsx
Ensure the "Admin-only" fields (Department, Position) are now being updated via a secure method (either a dedicated Edge Function or a secure RLS policy) rather than the client-side adminClient.

4. Requested Action for Claude
Please provide the corrected code for src/lib/supabase.ts to prevent the initialization crash.

Double-check src/hooks/useEmployees.ts to ensure no adminClient references remain.

Confirm that the application can now boot with only the VITE_SUPABASE_ANON_KEY.