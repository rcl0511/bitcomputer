/**
 * Background Check API Service Layer
 *
 * 실제 엔드포인트: https://54capvm12g.execute-api.ap-northeast-2.amazonaws.com
 * 개발환경 요청 경로: /api/* → Vite 프록시 → 위 주소
 *
 * Error handling:
 *  - 400: field validation error    → AppError(message, 400)
 *  - 500: server error (retriable)  → 최대 2회 재시도 (지수 백오프)
 *  - 503: service unavailable       → AppError(message, 503, retryAfter)
 *         retryAfter 우선순위: Retry-After 헤더 → body.retryAfter → 기본값 30s
 */
import { z } from 'zod';
import { AppError } from '../types/database';
import type {
  BackgroundCheckCreated,
  BackgroundCheckList,
  BackgroundCheckRequest,
  BackgroundCheckResult,
} from '../types/database';

const API_PREFIX = '/api';

// =============================================
// Zod 검증 스키마 — 외부 API 응답 런타임 검증
//
// API camelCase 필드 ↔ TS 타입(database.ts) 1:1 매핑 확인:
//   checkId            → BackgroundCheckResult.checkId
//   status             → 'pending' | 'clear' | 'flagged'
//   criminalRecord     → false = 이상없음 (UI: ResultItem "범죄 이력")
//   educationVerified  → true  = 인증완료 (UI: "학력 인증")
//   employmentVerified → true  = 인증완료 (UI: "경력 인증")
//   creditScore        → 'excellent'|'good'|'fair'|'poor' (UI: CREDIT_MAP)
//   completedAt        → null(pending 중) | ISO string(완료 시)
// =============================================
const CheckStatusSchema = z.enum(['pending', 'clear', 'flagged']);

const BackgroundCheckResultSchema = z.object({
  checkId:            z.string(),
  employeeId:         z.string(),
  firstName:          z.string(),
  lastName:           z.string(),
  dateOfBirth:        z.string(),
  status:             CheckStatusSchema,
  criminalRecord:     z.boolean().nullable(),
  educationVerified:  z.boolean().nullable(),
  employmentVerified: z.boolean().nullable(),
  creditScore:        z.enum(['excellent', 'good', 'fair', 'poor']).nullable(),
  createdAt:          z.string(),
  completedAt:        z.string().nullable(),
});

const BackgroundCheckCreatedSchema = z.object({
  checkId:    z.string(),
  employeeId: z.string(),
  status:     CheckStatusSchema,
  createdAt:  z.string(),
  message:    z.string(),
});

// =============================================
// 503 retryAfter 파싱
//
// 우선순위:
//   1. Retry-After 헤더 (RFC 7231 — 초 단위 정수 또는 HTTP-date)
//   2. 응답 바디 retryAfter 필드
//   3. 기본값 30초
// =============================================
function parseRetryAfter(headers: Headers, bodyRetryAfter: unknown): number {
  const headerVal = headers.get('Retry-After');
  if (headerVal) {
    const asInt = parseInt(headerVal, 10);
    if (!isNaN(asInt) && asInt > 0) return asInt;

    // HTTP-date 형식("Tue, 24 Mar 2026 12:30:00 GMT")
    const retryDate = new Date(headerVal).getTime();
    if (!isNaN(retryDate)) {
      const remaining = Math.ceil((retryDate - Date.now()) / 1000);
      if (remaining > 0) return remaining;
    }
  }
  if (typeof bodyRetryAfter === 'number' && bodyRetryAfter > 0) return bodyRetryAfter;
  return 30;
}

// =============================================
// HTTP Utility — 공통 에러 파싱 + 500 재시도
// =============================================
async function apiFetch<T>(
  url: string,
  options?: RequestInit,
  _retryCount = 0,
): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (response.ok) {
    return response.json() as Promise<T>;
  }

  let body: Record<string, unknown> = {};
  try { body = await response.json(); } catch { /* statusText 폴백 */ }

  const message = (body.message as string) ?? response.statusText;

  // 503: retryAfter를 헤더+바디 양쪽에서 파싱 → AppError에 포함
  if (response.status === 503) {
    const retryAfter = parseRetryAfter(response.headers, body.retryAfter);
    throw new AppError(message, 503, retryAfter);
  }

  // 500: 최대 2회 재시도 (지수 백오프 — 1s, 2s)
  if (response.status === 500 && _retryCount < 2) {
    console.warn(`[bgCheck] 500 에러 — ${_retryCount + 1}회 재시도 중... (url=${url})`);
    await new Promise((r) => setTimeout(r, 1_000 * (_retryCount + 1)));
    return apiFetch<T>(url, options, _retryCount + 1);
  }

  throw new AppError(message, response.status);
}

// =============================================
// API Functions
// =============================================

/** POST /background-checks — 배경 조회 요청 생성 */
export async function createBackgroundCheck(
  request: BackgroundCheckRequest,
): Promise<BackgroundCheckCreated> {
  const raw = await apiFetch<BackgroundCheckCreated>(
    `${API_PREFIX}/background-checks`,
    { method: 'POST', body: JSON.stringify(request) },
  );
  return BackgroundCheckCreatedSchema.parse(raw);
}

/** GET /background-checks/{checkId} — 단건 결과 조회 */
export async function getBackgroundCheck(checkId: string): Promise<BackgroundCheckResult> {
  const raw = await apiFetch<BackgroundCheckResult>(
    `${API_PREFIX}/background-checks/${encodeURIComponent(checkId)}`,
  );
  return BackgroundCheckResultSchema.parse(raw);
}

/** GET /background-checks?employeeId=... — 직원별 이력 목록 */
export async function listBackgroundChecks(employeeId: string): Promise<BackgroundCheckList> {
  return apiFetch<BackgroundCheckList>(
    `${API_PREFIX}/background-checks?employeeId=${encodeURIComponent(employeeId)}`,
  );
}
