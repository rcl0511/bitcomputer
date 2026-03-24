1. Objective
Enable full profile editing capabilities for users with the admin role. Currently, the UI restricts editing for sensitive fields (Department, Position, Role, Join Date) even for administrators. We need to lift these restrictions and add new data fields.

2. Requirements
A. Admin-Specific UI Logic
Access Control: Check if profile.role === 'admin'.

UI Behavior for Admins:

Enable all input fields that are currently disabled (Department, Position, Role, Join Date, Status).

Replace the "Security Notice" (which says "Edits require HR approval...") with an "Admin Mode: Full Access" badge or a message saying "You are editing with Administrative Privileges."

UI Behavior for Regular Users: Keep the current restrictions and the security notice.

B. New Data Fields & Schema Update
New Fields: Add department and position to the profiles table.

Selection Options (Select Box):

Department: [Management, IT Development, Sales, Accounting, HR]

Position: [Intern, Assistant, Manager, Senior Manager, Director]

Display: Update the PortalPage and ProfileEdit components to display and edit these new fields.

C. Implementation Tasks
Database: Provide the SQL to add department and position columns to the profiles table.

Frontend (UI): Modify PortalPage.tsx (or the relevant Edit Modal) to conditionally enable fields based on the user's role.

Frontend (Logic): Update useEmployees.ts or the update handler to include department and position in the supabase.from('profiles').update() call.

3. Reference Context
Ensure that when an Admin saves the profile, the changes are reflected immediately in the UI.

Use a <select> or a UI library's Select component for the Department and Position fields to ensure data consistency.