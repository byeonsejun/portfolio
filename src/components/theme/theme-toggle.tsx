"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const LABEL = { light: "라이트", dark: "다크" } as const;

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
 * 라이트 ↔ 다크 2단계 토글.
 *
 * "시스템" 단계를 노출하지 않는다. 3단계 순환은 누를 때마다 다음이 무엇인지
 * 예측하기 어렵고, 화면에 이미 결과가 보이는 상황에서 "시스템" 이라는
 * 상태명은 사용자에게 추가 정보를 주지 않는다.
 *
 * 그렇다고 시스템 설정을 무시하지는 않는다.
 *   첫 방문   theme = "system" → 운영체제 설정을 따라 라이트/다크가 결정된다.
 *   첫 클릭   지금 보이는 것(resolvedTheme)의 반대를 명시적으로 저장한다.
 *   이후      저장된 값만 오간다.
 * 판단 기준을 theme 가 아니라 resolvedTheme 로 두면 "system" 상태에서도
 * 눈에 보이는 것의 반대가 눌리므로 첫 클릭이 어긋나지 않는다.
 *
 * 서버에서는 사용자의 선택값을 알 수 없으므로(정적 export + localStorage),
 * 하이드레이션 전에는 자리만 차지하는 placeholder 를 그린다.
 * FOUC 와는 별개 문제다 — 배경·텍스트 색은 next-themes 의 blocking 스크립트가
 * 첫 페인트 전에 적용하므로 화면이 깜빡이지는 않고, 여기서는 라벨만 나중에 확정된다.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useHydrated();

  // 라벨 폭이 바뀌어도 버튼이 움직이지 않게 폭을 고정한다.
  const shape = "border-rule h-7 w-14 rounded-full border";

  if (!hydrated) {
    return <button type="button" aria-label="테마 전환" className={shape} />;
  }

  const current = resolvedTheme === "dark" ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      /*
       * 보이는 글자("라이트")를 접근성 이름에 그대로 포함시킨다.
       * 동작만 적으면(예: "다크로 전환") 음성 입력 사용자가 화면에 보이는
       * 이름으로 버튼을 부를 수 없다 (WCAG 2.5.3 Label in Name).
       */
      aria-label={`${LABEL[current]} 모드 — 눌러서 ${LABEL[next]}로 전환`}
      title={`눌러서 ${LABEL[next]}로 전환`}
      className={`${shape} text-ink-2 hover:text-ink text-[11px] transition-colors`}
    >
      {LABEL[current]}
    </button>
  );
}
