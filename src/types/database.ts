// =============================================
// Domain Types — Supabase 스키마와 1:1 매핑
// =============================================

export type UserRole          = 'admin' | 'user';
export type UserStatus        = 'active' | 'resigned';
export type CheckStatus       = 'pending' | 'clear' | 'flagged';
export type CreditScoreRating = 'excellent' | 'good' | 'fair' | 'poor';
export type Department        = 'Management' | 'IT Development' | 'Sales' | 'Accounting' | 'HR';
export type Position          = 'Intern' | 'Assistant' | 'Manager' | 'Senior Manager' | 'Director';

export const DEPARTMENTS: Department[] = ['Management', 'IT Development', 'Sales', 'Accounting', 'HR'];
export const POSITIONS:   Position[]   = ['Intern', 'Assistant', 'Manager', 'Senior Manager', 'Director'];

export interface Profile {
  id:          string;
  employee_id: string;
  full_name:   string;
  role:        UserRole;
  status:      UserStatus;
  dob:         string;            // ISO date (YYYY-MM-DD)
  department:  Department | null; // 부서 (신규 필드)
  position:    Position   | null; // 직급 (신규 필드)
  created_at:  string;
}

export interface BackgroundCheck {
  id:                  string;
  profile_id:          string;
  employee_id:         string;
  check_id:            string;              // 외부 API ID: CHK-...
  status:              CheckStatus;
  criminal_record:     boolean | null;
  education_verified:  boolean | null;
  employment_verified: boolean | null;
  credit_score:        CreditScoreRating | null;
  created_at:          string;
  completed_at:        string | null;
}

// =============================================
// External API Types — swagger.yaml 기반
// =============================================

export interface BackgroundCheckRequest {
  employeeId:   string;  // EMP-YYYY-XXX
  firstName:    string;
  lastName:     string;
  dateOfBirth:  string;  // YYYY-MM-DD
}

export interface BackgroundCheckCreated {
  checkId:     string;       // CHK-...
  employeeId:  string;
  status:      CheckStatus;  // 즉시 완료되거나 pending 반환
  createdAt:   string;
  message:     string;
}

export interface BackgroundCheckResult {
  checkId:             string;
  employeeId:          string;
  firstName:           string;
  lastName:            string;
  dateOfBirth:         string;
  status:              CheckStatus;
  criminalRecord:      boolean | null;
  educationVerified:   boolean | null;
  employmentVerified:  boolean | null;
  creditScore:         CreditScoreRating | null;
  createdAt:           string;
  completedAt:         string | null;
}

export interface BackgroundCheckListItem {
  checkId:      string;
  status:       CheckStatus;
  createdAt:    string;
  completedAt:  string | null;
}

export interface BackgroundCheckList {
  employeeId:  string;
  checks:      BackgroundCheckListItem[];
  totalCount:  number;
}

// =============================================
// API Error Types
// =============================================

export interface ApiError {
  error:      string;
  message:    string;
  statusCode: number;
}

export interface ServiceUnavailableError extends ApiError {
  retryAfter: number;  // 초(seconds) 단위 — UI에서 카운트다운 표시
}

// fetch 함수에서 throw하는 형태
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
