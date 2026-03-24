(Post-Deployment Fixes)
1. Executive Summary
Accomplishments:

Supabase Edge Function (create-employee) is successfully deployed.

Environment variables (SUPABASE_SERVICE_ROLE_KEY, BACKGROUND_CHECK_API_URL) are correctly set in Supabase Secrets.

Netlify deployment is live at https://bitcomputer.netlify.app/.

Current Blockers:

404 Not Found: The frontend is still trying to call /api/background-checks directly, which fails in the production environment.

Realtime Failure: WebSocket connections (wss://) are repeatedly closing/failing.

UI Dependency: The app still tries to initialize adminClient on the client side, causing crashes if the key is missing.

2. Technical Issues & Root Causes
A. API 404 Error (Routing Issue)
Symptom: GET/POST /api/background-checks ... 404 (Not Found)

Cause: The Vite proxy configured in vite.config.ts only works in the local development server. Netlify does not recognize the /api prefix and treats it as a non-existent directory.

Required Action:

Completely remove client-side calls to /api/background-checks.

Ensure useEmployees.ts only triggers the background check via the Edge Function (supabase.functions.invoke('create-employee')).

The Edge Function must handle the external AWS Lambda call and return the consolidated result.

B. Realtime/WebSocket Instability
Symptom: WebSocket connection failed: WebSocket is closed before the connection is established.

Cause: Likely due to network restrictions or regional latency (Sydney instance).

Required Action:

Implement a more resilient AuthContext.tsx with a longer exponential backoff for Realtime reconnections.

Add a fallback mechanism (e.g., manual "Refresh" button) for when the WebSocket is unavailable.

C. Residual adminClient Crash
Symptom: Uncaught Error: supabaseKey is required.

Cause: The frontend still attempts to initialize adminClient in src/lib/supabase.ts using a non-existent VITE_SUPABASE_SERVICE_ROLE_KEY.

Required Action:

Refactor src/lib/supabase.ts to make adminClient optional or null-safe.

Purge all adminClient references from the frontend hooks.

3. Final Task for Claude
Refactor useEmployees.ts: Update the createEmployee mutation to rely solely on the Edge Function for both Auth creation AND Background Check initiation.

Fix src/lib/supabase.ts: Prevent the app from crashing when VITE_SUPABASE_SERVICE_ROLE_KEY is undefined.

Update AuthContext.tsx: Add robust error handling for the failing WebSocket connection to prevent the "Realtime Error" loop from affecting user experience.