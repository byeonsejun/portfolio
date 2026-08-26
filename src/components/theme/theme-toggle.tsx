"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const ORDER = ["light", "dark", "system"] as const;
type ThemeChoice = (typeof ORDER)[number];

const LABEL: Record<ThemeChoice, string> = {
  light: "라이트",
  dark: "다크",
  system: "시스템",
};

/** 구독 대상이 없는 스토어 — 스냅샷만 서버/클라이언트가 다르다. */
const noopSubscribe = () => () => {};

/**
 * 하이드레이션 완료 여부.
 * useEffect + setState 대신 useSyncExternalStore 를 쓰면 cascading render 없이
 * 서버 스냅샷(false) → 클라이언트 스냅샷(true) 전환이 한 번에 끝난다.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * light → dark → system → light 로 순환하는 3단계 토글.
 *
 * 서버에서는 사용자의 선택값을 알 수 없으므로(정적 export + localStorage),
 * 하이드레이션 전에는 자리만 차지하는 placeholder 를 그린다.
 * 이건 FOUC 와는 별개 문제다 — 배경/텍스트 색은 next-themes 의 blocking
 * 스크립트가 첫 페인트 전에 이미 적용해 두므로 화면이 깜빡이지는 않고,
 * 여기서는 "지금 어떤 모드인지" 라벨만 하이드레이션 이후에 확정된다.
 */
export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const hydrated = useHydrated();

  const current = (theme ?? "system") as ThemeChoice;

  function cycle() {
    const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
    if (next) setTheme(next);
  }

  if (!hydrated) {
    return (
      <button
        type="button"
        aria-label="테마 전환"
        className="border-rule h-7 w-[3.75rem] rounded-full border"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`테마 전환 (현재: ${LABEL[current]})`}
      title={
        current === "system"
          ? `시스템 설정 따름 (현재 ${resolvedTheme === "dark" ? "다크" : "라이트"})`
          : LABEL[current]
      }
      className="border-rule text-ink-2 hover:text-ink h-7 w-[3.75rem] rounded-full border text-[11px] transition-colors"
    >
      {LABEL[current]}
    </button>
  );
}
