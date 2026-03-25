import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// StrictMode 제거:
// Supabase GoTrue JS가 onAuthStateChange 등록 시 내부 Web Lock을 사용하는데,
// StrictMode의 이중 마운트가 락 충돌을 일으켜 SIGNED_OUT이 강제 발생함.
// 결과적으로 세션이 정상임에도 로그아웃되는 버그가 생긴다.
createRoot(document.getElementById('root')!).render(<App />);
