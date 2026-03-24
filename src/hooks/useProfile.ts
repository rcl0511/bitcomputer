import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Profile } from '../types/database';

interface UpdateProfilePayload {
  full_name?: string;
  dob?: string;
}

/**
 * 현재 로그인한 사용자의 프로필 조회
 * AuthContext의 profile을 initialData로 사용해 초기 로딩 없이 즉시 표시
 */
export function useProfile() {
  const { profile: authProfile } = useAuth();

  return useQuery({
    queryKey: ['profile', authProfile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authProfile!.id)
        .single();

      if (error) throw error;
      return data as Profile;
    },
    enabled: !!authProfile?.id,
    // AuthContext에서 이미 가져온 데이터를 초기값으로 — 깜빡임 없이 즉시 표시
    initialData: authProfile ?? undefined,
    staleTime: 1000 * 30,
  });
}

/**
 * 현재 사용자의 프로필 수정 (full_name, dob만 허용)
 */
export function useUpdateProfile() {
  const qc = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (payload: UpdateProfilePayload) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', profile!.id)
        .select()
        .single();

      if (error) throw error;
      return data as Profile;
    },
    onSuccess: (updated) => {
      qc.setQueryData(['profile', updated.id], updated);
    },
  });
}
