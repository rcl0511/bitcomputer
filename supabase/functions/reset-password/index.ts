/**
 * Supabase Edge Function: reset-password
 *
 * 관리자가 특정 직원의 비밀번호를 임시 비밀번호로 초기화한다.
 * SERVICE_ROLE_KEY는 서버 환경변수에서만 사용되며 프론트에 노출되지 않는다.
 *
 * 처리 순서:
 *   1. JWT 검증 → admin 역할 확인
 *   2. 대상 userId로 auth.admin.updateUserById() 호출
 *   3. 성공 응답 반환
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Step 0: JWT 디코딩 & admin 역할 확인 ──────────────────────────
    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      return new Response(
        JSON.stringify({ error: '인증 토큰이 없습니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let callerId: string;
    try {
      const token   = authorization.replace('Bearer ', '');
      const raw     = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded  = raw + '='.repeat((4 - raw.length % 4) % 4);
      const payload = JSON.parse(atob(padded));
      if (!payload.sub) throw new Error('sub 없음');
      callerId = payload.sub;
    } catch {
      return new Response(
        JSON.stringify({ error: '유효하지 않은 토큰입니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', callerId)
      .single();

    if (callerProfile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: '관리자 권한이 필요합니다.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Step 1: 요청 바디 파싱 ────────────────────────────────────────
    const { userId, password } = await req.json() as { userId: string; password: string };

    if (!userId || !password) {
      return new Response(
        JSON.stringify({ error: '필수 필드가 누락되었습니다 (userId, password).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: '비밀번호는 8자 이상이어야 합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Step 2: 비밀번호 변경 ─────────────────────────────────────────
    const { error } = await adminClient.auth.admin.updateUserById(userId, { password });

    if (error) {
      return new Response(
        JSON.stringify({ error: `비밀번호 변경 실패: ${error.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('[reset-password] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: '서버 내부 오류가 발생했습니다.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
