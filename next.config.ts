import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages: 서버 런타임 없이 정적 HTML로만 배포한다.
  output: "export",

  // output: "export" 에서는 next/image 의 기본 최적화 서버가 없다.
  // 리사이즈/포맷 변환은 빌드 전 sharp 스크립트가 담당하고, next/image 는
  // 레이아웃 예약(width/height)과 lazy loading 역할만 맡는다.
  images: { unoptimized: true },

  // 정적 호스트에서 /works 같은 경로가 /works/index.html 로 확실히 매핑되도록.
  trailingSlash: true,

  typedRoutes: true,
};

export default nextConfig;
