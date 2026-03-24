/**
 * Supabase Edge Function: create-employee
 *
 * 보안 아키텍처:
 *   - SUPABASE_SERVICE_ROLE_KEY는 이 함수의 서버 환경변수에서만 사용
 *   - 프론트엔드는 supabase.functions.invoke()로 호출 (JWT만 전달)
 *   - 함수 진입 시 호출자의 JWT를 검증하고 admin 역할인지 확인
 *
 * 처리 순서:
 *   1. JWT 검증 → admin 역할 확인
 *   2. Auth 유저 생성 (adminClient)
 *   3. 사번(EMP-YYYY-XXX) 자동 생성
 *   4. profiles 레코드 INSERT
 *   5. 결과 반환
 *
 * 에러 발생 시 이미 생성된 Auth 유저를 롤백하여 고아 계정을 방지한다.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY          = Deno.env.get('SUPABASE_ANON_KEY')!;

// =============================================
// 사번(employee_id) 자동 생성
// Format: EMP-YYYY-XXX (해당 연도 순번, 3자리 zero-pad)
// =============================================
async function generateEmployeeId(
  adminClient: ReturnType<typeof createClient>,
): Promise<string> {
  const year   = new Date().getFullYear();
  const prefix = `EMP-${year}-`;

  const { data, error } = await adminClient
    .from('profiles')
    .select('employee_id')
    .like('employee_id', `${prefix}%`)
    .order('employee_id', { ascending: false })
    .limit(1);

  if (error) throw new Error(`사번 생성 실패: ${error.message}`);
  if (!data?.length) return `${prefix}001`;

  const lastNum = parseInt(data[0].employee_id.slice(-3), 10);
  if (isNaN(lastNum)) throw new Error(`사번 파싱 실패: ${data[0].employee_id}`);

  return `${prefix}${String(lastNum + 1).padStart(3, '0')}`;
}

// =============================================
// Edge Function Entry Point
// =============================================
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Step 0: JWT 검증 & admin 역할 확인 ───────────────────────────
    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      return new Response(
        JSON.stringify({ error: '인증 토큰이 없습니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 호출자의 세션을 anon 키 + Authorization 헤더로 검증
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user: caller }, error: sessionError } = await callerClient.auth.getUser();
    if (sessionError || !caller) {
      return new Response(
        JSON.stringify({ error: '유효하지 않은 세션입니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // service role로 호출자의 프로필(역할) 확인
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();

    if (callerProfile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: '관리자 권한이 필요합니다.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Step 1: 요청 바디 파싱 ──────────────────────────────────────
    const { email, password, full_name, dob, role } = await req.json() as {
      email:     string;
      password:  string;
      full_name: string;
      dob:       string;
      role:      'admin' | 'user';
    };

    if (!email || !password || !full_name || !dob || !role) {
      return new Response(
        JSON.stringify({ error: '필수 필드가 누락되었습니다 (email, password, full_name, dob, role).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Step 2: Auth 유저 생성 ──────────────────────────────────────
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      const isAlreadyRegistered =
        authError.message.includes('already been registered') ||
        authError.message.includes('already registered');

      return new Response(
        JSON.stringify({
          error: isAlreadyRegistered
            ? `이미 등록된 이메일입니다: ${email}`
            : `계정 생성 실패: ${authError.message}`,
        }),
        {
          status: isAlreadyRegistered ? 409 : 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const userId = authData.user.id;

    // ── Step 3: 사번 자동 생성 ──────────────────────────────────────
    let employeeId: string;
    try {
      employeeId = await generateEmployeeId(adminClient);
    } catch (genErr) {
      // 사번 생성 실패 → Auth 유저 롤백
      await adminClient.auth.admin.deleteUser(userId).catch(console.error);
      return new Response(
        JSON.stringify({ error: (genErr as Error).message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Step 4: profiles INSERT ─────────────────────────────────────
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .insert({
        id:          userId,
        employee_id: employeeId,
        full_name,
        dob,
        role,
        status:      'active',
      })
      .select()
      .single();

    if (profileError) {
      // INSERT 실패 → Auth 유저 롤백
      await adminClient.auth.admin.deleteUser(userId).catch(console.error);

      const isDuplicateId =
        profileError.code === '23505' && profileError.message.includes('employee_id');

      return new Response(
        JSON.stringify({
          error: isDuplicateId
            ? `사번 중복(${employeeId}) — 다시 시도해주세요.`
            : `프로필 등록 실패: ${profileError.message}`,
        }),
        {
          status: isDuplicateId ? 409 : 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // ── 성공 ────────────────────────────────────────────────────────
    return new Response(
      JSON.stringify(profile),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('[create-employee] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: '서버 내부 오류가 발생했습니다.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
