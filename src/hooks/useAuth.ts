// useAuth는 AuthContext의 thin wrapper다.
// 실제 로직(Realtime 구독, signOut 등)은 모두 AuthContext.tsx에 있다.
//
// 사용처에서 import 경로를 단순화하기 위해 별도 파일로 분리:
//   import { useAuth } from '../hooks/useAuth';
export { useAuth } from '../contexts/AuthContext';
