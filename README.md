# BIT 인사 관리 시스템

사내 임직원 관리 및 외부 신원조회 API 연동을 위한 역할 기반 접근제어(RBAC) 포털.

---

## 기술 스택

| 영역 | 기술 | 선택 이유 |
|------|------|-----------|
| 프레임워크 | React 18 + Vite | 빠른 HMR, ESM 기반 번들링 |
| 스타일링 | Tailwind CSS | 유틸리티 클래스로 일관된 디자인 토큰 유지 |
| 서버 상태 | TanStack Query v5 | 캐싱·폴링·재시도를 선언적으로 처리 |
| 백엔드/인증 | Supabase (PostgreSQL + Auth + RLS) | BaaS로 Edge Function, 실시간 Auth, RLS 정책을 하나에서 관리 |
| 유효성 검사 | Zod | 외부 API 응답을 런타임에 스키마 검증, 스펙 변경을 즉시 탐지 |
| 아이콘 | Lucide React | 트리쉐이킹 지원, 일관된 stroke 기반 아이콘 세트 |
| 라우팅 | React Router v6 | 중첩 라우트와 레이아웃 분리 |

---

## 프로젝트 구조

```
src/
├── components/
│   ├── auth/
│   │   └── AuthGuard.tsx       # RBAC 및 퇴사자 즉시 차단 HOC
│   ├── layout/
│   │   └── AppLayout.tsx       # 사이드바 + 헤더 공통 레이아웃
│   └── ui/                     # Badge, ConfirmDialog 등 공통 UI
├── contexts/
│   └── ToastContext.tsx         # 전역 알림 시스템
├── hooks/
│   ├── useAuth.ts
│   ├── useEmployees.ts          # 직원 CRUD + Edge Function 호출
│   ├── useBackgroundCheck.ts    # 신원조회 생성·폴링·결과 업데이트
│   └── useProfile.ts
├── lib/
│   ├── supabase.ts              # Supabase 클라이언트 (anon key)
│   └── queryClient.ts           # TanStack QueryClient 전역 설정
├── pages/
│   ├── LoginPage.tsx
│   ├── admin/
│   │   ├── AdminDashboard.tsx   # 직원 목록, 검색, 퇴사 처리
│   │   └── EmployeeDetailPage.tsx # 프로필 수정, 신원조회 리포트
│   └── portal/
│       └── MyPage.tsx           # 일반 직원 본인 정보 조회
├── services/
│   └── backgroundCheck.ts       # 외부 API fetch 레이어 (에러 처리 핵심)
└── types/
    └── database.ts              # Supabase 스키마 + API 타입 + AppError 클래스
```

---

## 데이터베이스 스키마

### `profiles` 테이블

```sql
id            uuid        PK, references auth.users
employee_id   text        UNIQUE  -- 형식: EMP-YYYY-XXX
full_name     text
role          enum        'admin' | 'user'      DEFAULT 'user'
status        enum        'active' | 'resigned' DEFAULT 'active'
dob           date        -- 신원조회 API 필수값
department    text        nullable
position      text        nullable
avatar_url    text        nullable
created_at    timestamptz
```

### `background_checks` 테이블

```sql
id                  uuid  PK
profile_id          uuid  FK → profiles.id
employee_id         text
check_id            text  -- 외부 API 발급 ID: CHK-...
status              enum  'pending' | 'clear' | 'flagged'
criminal_record     bool  nullable
education_verified  bool  nullable
employment_verified bool  nullable
credit_score        enum  'excellent' | 'good' | 'fair' | 'poor'  nullable
created_at          timestamptz
completed_at        timestamptz nullable
```

---

## 보안 설계

### Row Level Security (RLS)

모든 테이블에 RLS 활성화. 퇴사자(`status = 'resigned'`)는 JWT가 유효하더라도 데이터를 읽을 수 없다.

```sql
-- profiles: 본인만 조회 가능
CREATE POLICY "users_own_profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- background_checks: 관리자만 접근 가능
CREATE POLICY "admins_all_background_checks" ON background_checks
  FOR ALL USING (get_my_role() = 'admin');
```

### 퇴사자 즉시 차단 (`AuthGuard`)

`AuthGuard`는 모든 보호 라우트를 감싸며, 프로필 조회 시 `status === 'resigned'`이면 즉시 `supabase.auth.signOut()` 후 로그인 페이지로 리다이렉트한다. 클라이언트 차단 + RLS 이중 방어.

### 서비스 역할 키 격리

신규 직원 생성·비밀번호 초기화는 `SERVICE_ROLE_KEY`가 필요하다. 프론트엔드에 키를 노출하지 않기 위해 Supabase **Edge Function** (`create-employee`, `reset-password`)에서만 사용하며, 프론트엔드는 사용자의 `access_token`을 Bearer로 전달해 Edge Function을 호출한다.

---

## API 에러 대응 전략

외부 신원조회 API(`https://54capvm12g.execute-api.ap-northeast-2.amazonaws.com`)는 불안정할 수 있어 단계별 방어 전략을 적용했다.

### AppError 클래스

모든 API 에러를 `AppError`로 표준화해 상태 코드와 재시도 대기 시간을 타입 안전하게 전달한다.

```ts
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public retryAfter?: number, // 503 전용
  ) { ... }
}
```

### 상태 코드별 처리

| 상태 코드 | 원인 | 처리 방식 |
|-----------|------|-----------|
| **400** | 요청 필드 오류 | `AppError(message, 400)` throw → UI에 필드 에러 표시, 재시도 없음 |
| **500** | 서버 일시 오류 | `apiFetch` 내부에서 최대 **2회** 지수 백오프 재시도 (1s → 2s) |
| **503** | 서버 과부하 | `Retry-After` 헤더 → 바디 `retryAfter` → 기본값 30s 순으로 파싱 후 `AppError(message, 503, retryAfter)` throw |

### 503 retryAfter 파싱 우선순위

```
1. Retry-After 헤더 (RFC 7231 — 정수 초 또는 HTTP-date)
2. 응답 바디 retryAfter 필드
3. 기본값 30초
```

### 폴링 전략 (TanStack Query)

신원조회는 처리에 최대 2분이 소요된다. `pending` 상태인 동안 30초 간격으로 자동 폴링하며, 503 발생 시 폴링 간격을 `retryAfter` 값으로 자동 조정한다.

```ts
refetchInterval: (query) => {
  if (query.state.data?.status !== 'pending') return false; // 완료 시 중단

  const err = query.state.error;
  if (err instanceof AppError && err.statusCode === 503) {
    return (err.retryAfter ?? 30) * 1_000; // 503 시 대기 후 재시도
  }

  return 30_000; // 정상 폴링 30초
},
```

> **주의:** 503 재시도는 TanStack Query `refetchInterval`이 단독으로 담당한다. UI의 `RetryCountdown` 컴포넌트는 최초 신원조회 생성 요청(`POST`) 실패 시에만 표시되며, 폴링 중 503에는 반응하지 않는다. 두 메커니즘이 동시에 동작하면 이중 요청이 발생하므로 명확히 분리했다.

### QueryClient 전역 재시도 정책

```ts
retry: (failureCount, error) => {
  // 4xx 클라이언트 오류는 재시도 불필요
  if (error instanceof AppError && error.statusCode >= 400 && error.statusCode < 500) {
    return false;
  }
  return failureCount < 2; // 5xx는 최대 2회
},
```

---

## 성능 최적화

### 검색 디바운스

직원 목록 검색은 300ms 디바운스를 적용해 타이핑 중 불필요한 API 호출을 방지한다.

```ts
useEffect(() => {
  const t = setTimeout(() => setDebounced(search), 300);
  return () => clearTimeout(t);
}, [search]);
```

### 캐시 전략 (staleTime)

| 데이터 | staleTime | 이유 |
|--------|-----------|------|
| 직원 목록 (`useEmployees`) | 30초 | 자주 바뀌지 않으나 퇴사 처리 후 즉시 무효화 필요 |
| 직원 단건 (`useEmployee`) | 30초 | 상세 페이지 재진입 시 불필요한 재요청 방지 |
| 신원조회 이력 (`useBackgroundCheckList`) | 30초 | 목록은 변경 빈도 낮음 |
| QueryClient 기본값 | 60초 | 나머지 모든 쿼리의 기본 캐시 |

뮤테이션(`terminate`, `updateEmployee`) 성공 후 관련 쿼리 키를 `invalidateQueries`로 즉시 무효화해 화면과 서버 상태를 동기화한다.

---

## 로컬 개발 환경 설정

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env.local
# VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 입력

# 개발 서버 실행 (Vite 프록시로 /api → 외부 API 포워딩)
npm run dev
```

### Vite 프록시 설정

개발 환경에서 CORS를 우회하기 위해 `/api/*` 경로를 외부 API로 프록시한다.

```ts
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'https://54capvm12g.execute-api.ap-northeast-2.amazonaws.com',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
  },
},
```
