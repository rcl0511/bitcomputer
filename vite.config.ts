import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    proxy: {
      // /api/* → https://54capvm12g.execute-api.ap-northeast-2.amazonaws.com/*
      // 브라우저는 동일 출처(localhost)에 요청하고,
      // Vite dev server가 실제 API 서버로 포워딩한다 → CORS 우회
      '/api': {
        target:       'https://54capvm12g.execute-api.ap-northeast-2.amazonaws.com',
        changeOrigin: true,   // Host 헤더를 타겟 도메인으로 교체
        secure:       true,   // TLS 인증서 검증 유지
        rewrite:      (path) => path.replace(/^\/api/, ''),
        // AWS API Gateway 응답 대기 시간 여유 (Lambda cold start 고려)
        proxyTimeout: 15_000,
        timeout:      15_000,
        configure: (proxy) => {
          proxy.on('error', (err, req) => {
            console.error(`[Proxy] 연결 실패 — ${req.method} ${req.url}:`, err.message);
          });
          proxy.on('proxyRes', (proxyRes, req) => {
            if (proxyRes.statusCode && proxyRes.statusCode >= 400) {
              console.warn(
                `[Proxy] ${proxyRes.statusCode} ← ${req.method} ${req.url}`,
                'Retry-After:', proxyRes.headers['retry-after'] ?? '없음',
              );
            }
          });
        },
      },
    },
  },
});
