"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * 앱 전역 테마 공급자.
 *
 * attribute="data-theme" → <html data-theme="light"> / <html data-theme="dark">
 * theme 가 "system" 이어도 DOM 에는 항상 resolve 된 "light" | "dark" 만 찍힌다.
 * 따라서 CSS·SVG 는 data-theme 두 값만 신경 쓰면 된다.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      // 테마 전환 순간 모든 요소의 transition 을 잠깐 죽여서
      // 색이 서서히 번지는 대신 즉시 바뀌게 한다.
      disableTransitionOnChange
      storageKey="portfolio-theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
