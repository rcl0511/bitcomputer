# Project: Internal Employee Portal (IEP) - Enterprise Strategy

## 1. Core Mission
Build a secure, role-based employee management system that integrates external background check APIs and enforces strict access control for resigned employees.

## 2. Tech Stack (Strict Adherence)
- **Frontend:** React (Vite), Tailwind CSS, Lucide React (Icons)
- **State & Data Fetching:** TanStack Query (v5) for API synchronization & caching.
- **Backend/Auth:** Supabase (PostgreSQL + Auth + RLS).
- **Validation:** Zod (for API request/response schema validation).
- **Styling:** Headless UI or Radix UI (for accessible Admin/User toggles).

## 3. Data Architecture (Supabase/Postgres)
### Table: `profiles`
- `id`: uuid (references auth.users) - Primary Key
- `employee_id`: text (Unique, Format: EMP-YYYY-XXX)
- `full_name`: text
- `role`: enum ('admin', 'user') - Default: 'user'
- `status`: enum ('active', 'resigned') - Default: 'active'
- `dob`: date (Required for Background Check API)
- `created_at`: timestamp with time zone

## 4. Business Logic & Constraints (Critical)
1. **The "Instant Block" Logic:**
   - Implement a high-order component (HOC) or `ProtectedRoute` that checks `profile.status`.
   - If `status === 'resigned'`, immediately sign out the user and redirect to `/login` with a "Access Denied" message.
   - Use Supabase Row Level Security (RLS) to ensure 'resigned' users cannot fetch any data even if they have a valid JWT.

2. **Background Check API Strategy:**
   - **Base URL:** `https://54capvm12g.execute-api.ap-northeast-2.amazonaws.com`
   - **Polling Mechanism:** When a check is `pending`, implement a `useQuery` with `refetchInterval` (e.g., every 5s) until status is `clear` or `flagged`.
   - **Error Handling:** - 400: Show field-specific validation errors.
     - 503: Parse `retryAfter` header/body and show a countdown timer on the UI.

3. **Admin Dashboard Requirements:**
   - Search/Filter employees by status or ID.
   - "Terminate" button: A one-click action to set status to 'resigned'.
   - Background check trigger & history view per employee.

## 5. Implementation Roadmap for Claude Code
### Phase 1: Infrastructure (The Foundation)
- Setup Vite, Tailwind, and Supabase client.
- Create `types/database.ts` based on the schema above.
- Configure `QueryClient` with global error handling for 5xx errors.

### Phase 2: Auth & Security Guard
- Implement Supabase Auth (Email/Password).
- Create `components/auth/AuthGuard.tsx` to handle RBAC and 'resigned' status checks.

### Phase 3: Portal Development
- User Side: `/portal/me` (View/Edit personal info).
- Admin Side: `/admin/dashboard` (User list, Create User).
- Admin Side: `/admin/background-check/[id]` (API Integration).

### Phase 4: Error Resilience & UX
- Global Toast system for API feedback.
- Skeleton screens for background check polling states.