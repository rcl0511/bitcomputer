1. Project Context
Stack: React, Vite, Supabase, TypeScript.

Goal: Registering a new employee, which involves:

Creating an Auth User (Supabase Auth).

Generating a Unique Employee ID (e.g., EMP-2026-004).

Inserting a Profile record into the profiles table.

Requesting a Background Check via an external API and saving the result to the background_checks table.

2. Current Status & Issue
While the first three steps (Auth, ID generation, Profile insertion) are succeeding, the final integration with the Background Check API is failing, resulting in an empty background_checks table.

Console Errors Observed:
API Failure: GET /api/background-checks/... → 503 Service Unavailable and 500 Internal Server Error.

Realtime Error: [AuthProvider] Realtime channel error — status watch unavailable.

Resource Issue: Failed to load resource for the background check endpoint.

3. Technical Requirements
The external API documentation specifies the following:

Base URL: https://54capvm12g.execute-api.ap-northeast-2.amazonaws.com

Flow:

POST /background-checks to initiate.

GET /background-checks/{checkId} to poll results.

GET /background-checks?employeeId={id} to list history.

4. Points of Failure to Address
Vite Proxy Configuration: Local requests to :5173/api/... are not correctly reaching the AWS Lambda/API Gateway endpoint or are losing headers, causing the 503/500 errors.

Logic in useEmployees.ts: The createBackgroundCheck function needs robust error handling to manage cases where the external service is down.

Supabase RLS Policies: Ensure the service_role or authenticated user has proper INSERT permissions for the background_checks table.

Realtime WebSocket: Resolve the wss:// connection failure that prevents the AuthContext from tracking profile status changes (e.g., resigned).

5. Requested Action for Claude
Please review useEmployees.ts and vite.config.ts.

Fix the API calling logic to handle 503/500 errors gracefully.

Provide the correct Vite proxy setup to bridge the local frontend with the production API.

Provide a SQL snippet to ensure background_checks table permissions are correctly set.