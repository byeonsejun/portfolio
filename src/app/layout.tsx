import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import ReactDOM from "react-dom";
import fontManifest from "@/data/generated/font-manifest.json";
import { SITE_URL } from "@/data/site";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "변세준 — Frontend Portfolio",
  description: "프론트엔드 개발자 변세준의 포트폴리오",
  /*
   * 파비콘은 app/ 파일 컨벤션(app/icon.*) 대신 public/ + metadata 로 연결한다.
   *
   * 두 가지가 이유다.
   *   1. 컨벤션과 public/favicon.ico 는 둘 다 /favicon.ico 를 만들어 충돌한다.
   *      하나만 써야 하는데, 브라우저·크롤러는 링크 태그가 없어도 /favicon.ico 를
   *      무조건 찔러보므로 그 경로에 실물이 있는 편이 안전하다.
   *   2. 컨벤션은 <link> 에 media 를 붙일 수 없다. 다크 모드용 아이콘을 나중에
   *      넣으려면 media="(prefers-color-scheme: dark)" 가 필요한데 그 길이 막힌다.
   *
   * ICO 하나에 16·32·48·64·128·256 이 전부 들어 있어 브라우저가 알아서 고른다.
   * apple-touch-icon 은 일부러 넣지 않는다 — 원본이 저해상도라 180x180 을 만들면
   * 확대본이 된다. 자세한 판단은 커밋 메시지에.
   */
  icons: {
    icon: [
      { url: "/favicon.ico" },
      /*
       * 다크 모드용. 로고가 거의 검은 얇은 선에 배경이 투명이라
       * 다크 탭바(#202124)에서 16px 는 사실상 보이지 않는다.
       * 형태는 그대로 두고 잉크 색만 사이트의 다크 모드 본문색으로 바꾼 변형이다.
       * media 를 붙이려면 app/icon 컨벤션이 아니라 metadata 여야 한다.
       */
      {
        url: "/favicon-dark.png",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
  },
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: SITE_URL,
    siteName: "변세준 — Frontend Portfolio",
    title: "변세준 — Frontend Portfolio",
    description: "프론트엔드 개발자 변세준의 포트폴리오",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "변세준 — 화면을 하나 더 만드는 것이 아니라, 다음 화면을 더 싸게 만들 수 있게 정리하는 것",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "변세준 — Frontend Portfolio",
    description: "프론트엔드 개발자 변세준의 포트폴리오",
    images: ["/og.png"],
  },
};

/*
 * 모바일 브라우저의 주소창·상태바 색.
 * 이 사이트는 라이트/다크를 모두 지원하므로 한 값으로 고정하면 한쪽에서
 * 주소창만 다른 색으로 떠 문서가 잘려 보인다. globals.css 의 --background 와
 * 같은 값을 스킴별로 준다.
 *
 * Next 16 에서 themeColor 는 metadata 가 아니라 viewport export 다.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  /*
   * LCP 요소가 히어로의 한글 문장이라 폰트가 LCP 임계 경로에 있다.
   * preload 로 CSS 로딩 → @font-face 발견 → 폰트 요청 순서에서 한 단계를 뺀다.
   * dynamic subset 시절엔 어느 조각이 필요한지 CSS 를 파싱해야 알 수 있어
   * 미리 받을 대상을 특정할 수 없었다.
   *
   * page 조각만 preload 한다. reserve 는 지금 페이지에 없는 글자만 담고 있어서
   * 애초에 요청되지 않는다 — 그걸 미리 받으면 분할한 의미가 없다.
   *
   * 경로를 하드코딩하지 않고 매니페스트에서 읽는다. 파일명에 내용 해시가 붙어
   * 있어서(immutable 캐시용) 콘텐츠가 바뀌면 이름도 바뀐다.
   *
   * <link> 엘리먼트를 직접 렌더하지 않는 이유: React 19 가 그걸 <head> 로
   * 끌어올리면서 원본도 함께 남겨 preload 가 두 번 찍힌다. preload() 는
   * href 기준으로 중복을 제거해 정확히 하나만 내보낸다.
   *
   * crossOrigin 은 필수다. 없으면 preload 한 것을 재사용하지 못하고 폰트를
   * 두 번 받는다 (폰트 요청은 항상 CORS 모드라서).
   */
  ReactDOM.preload(fontManifest.page.path, {
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  });

  return (
    // suppressHydrationWarning: next-themes 의 blocking 스크립트가 하이드레이션
    // 전에 <html> 에 data-theme / style 을 직접 써넣기 때문에, 서버 HTML 과
    // 클라이언트의 첫 렌더가 이 엘리먼트에서만 의도적으로 어긋난다.
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
