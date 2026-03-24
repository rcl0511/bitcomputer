(Refactoring to Edge Functions)
1. Objective
Refactor the current client-side employee creation and background check logic into a Supabase Edge Function to eliminate the security risk of exposing the SERVICE_ROLE_KEY in the frontend.

2. Current Architecture (Problematic)
Frontend: Directly creates Auth users and inserts profile data using adminClient with VITE_SUPABASE_SERVICE_ROLE_KEY.

Issue: The service_role key is exposed to the browser, which is a critical security vulnerability.

Failure: Direct API calls to the background check service from the browser often hit 404, 500, or 503 errors due to proxy/CORS issues.

3. Proposed Architecture (Secure)
Frontend: Sends a single POST request to a Supabase Edge Function (e.g., create-employee) with the employee details.

Edge Function (Server-side):

Verifies the requester's admin role.

Uses the internal service_role key to create the Auth user.

Generates the Employee ID and inserts the Profile.

Calls the external Background Check API securely.

Returns the final result to the frontend.

4. Specific Tasks for Claude
Create Edge Function: Write the Deno-based TypeScript code for a Supabase Edge Function named create-employee.

It must handle: Auth user creation, Profile insertion, and the external POST /background-checks API call.

Refactor useEmployees.ts: Update the frontend hook to call supabase.functions.invoke('create-employee', { body: ... }) instead of using adminClient.

Environment Variables: Use Deno.env.get() inside the function to access SUPABASE_SERVICE_ROLE_KEY and the external API keys safely.

Error Handling: Implement robust server-side error handling for API timeouts and 5xx errors from the external service.

5. Security Note
Remove the usage of VITE_SUPABASE_SERVICE_ROLE_KEY from vite.config.ts and Netlify settings once the Edge Function is deployed.

6.UI/UX & Data Model Enhancements
A. Admin-Specific Profile Editing
Current Issue: Even when an Admin is logged in, the profile edit page shows a "Security Notice" (restricting edits to Department, Role, and Join Date) and hides the edit fields.

Requirement:

If profile.role === 'admin', the UI should allow full editing of all fields (Department, Position, Role, Status, Join Date).

The "Security Notice" should only be visible to regular users.

Admins should see a "Full Access: Administrative Privileges Enabled" badge instead of the restricted notice.

B. New Data Fields: Department & Position
Current Issue: The profile only shows basic info. We need to display the specific Department (e.g., Management, IT, Sales) and Position (e.g., Manager, Assistant Manager).

Requirement:

Update the profiles table schema and the UI to include department and position fields.

Ensure these fields are fetched and displayed in the InfoField components on the Portal Page.

6. Detailed Edge Function Logic (Addressing 404 & Network Issues)
A. Background Check Proxying (Fixing 404)
Problem: Netlify returns a 404 for /api/background-checks because Vite proxies don't work in production.

Solution: Move the logic to the Edge Function. The frontend will call supabase.functions.invoke('create-employee'), and the Edge Function will call the AWS Lambda URL (https://54capvm12g...) directly from the server-side. This bypasses Netlify's routing issues.

B. Handling Realtime/WebSocket Instability
Problem: wss:// connections are failing due to network restrictions or regional latency (Sydney region).

Requirement:

Implement a robust Exponential Backoff Reconnection logic in AuthContext.tsx.

If the WebSocket fails, provide a "Manual Refresh" button or a subtle "Offline Mode" indicator so the user knows why the data might be stale.