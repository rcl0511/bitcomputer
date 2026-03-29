import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// @supabase/supabase-js@2.38.0 이후 StrictMode Web Lock 버그가 수정됨.
// 현재 버전(2.45.0)은 해당 버그가 없으므로 StrictMode를 복구한다.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
