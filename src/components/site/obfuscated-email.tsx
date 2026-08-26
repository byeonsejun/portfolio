"use client";

import { useSyncExternalStore } from "react";

/**
 * 이메일 주소 — 정적 HTML 에 평문을 남기지 않는다.
 *
 * 왜 이 방식인가 (정적 export 라 서버 프록시·폼 백엔드가 없다는 전제)
 *
 *   평문 + mailto      방어 0. 즉시 수집된다.
 *   HTML 엔티티        HTML 파서를 거치면 그대로 복원. 사실상 방어 0.
 *   이미지             방어는 강하지만 복사·스크린리더·테마 대응을 전부 잃는다.
 *   CSS 시각 트릭      DOM 에는 평문이 그대로 남고 스크린리더·복사가 깨진다.
 *   → JS 조립          정적 HTML·JS 번들 어디에도 "@" 가 없다.
 *
 * 현실적인 위협은 HTML 을 받아 /[\w.]+@[\w.]+/ 로 긁는 대량 수집기다.
 * JS 조립은 그걸 전부 막으면서 접근성 손실이 0 이다 —
 * 하이드레이션 후에는 스크린리더도 복사도 정상 동작한다.
 *
 * 한계는 분명히 해 둔다: 헤드리스 브라우저로 JS 를 실행하는 표적 스크래퍼는
 * 뚫는다. 클라이언트 사이드 기법으로 그걸 막을 방법은 없다.
 */

/** 문자 코드에 고정 오프셋을 더해 보관한다. base64 처럼 눈에 띄는 패턴이 없다. */
const OFFSET = 23;
const CODES = [
  136, 140, 138, 139, 135, 142, 133, 138, 80, 74, 87, 126, 132, 120, 128, 131,
  69, 122, 134, 132,
];

function decode(): string {
  return CODES.map((n) => String.fromCharCode(n - OFFSET)).join("");
}

const noopSubscribe = () => () => {};

function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function ObfuscatedEmail({ className }: { className?: string }) {
  const hydrated = useHydrated();

  // 서버 렌더 · JS 미실행 시: 사람은 읽을 수 있고 정규식에는 안 걸리는 형태.
  if (!hydrated) {
    return (
      <span className={className} translate="no">
        qustpwns93 [at] gmail [dot] com
      </span>
    );
  }

  const address = decode();
  return (
    <a href={`mailto:${address}`} className={className} translate="no">
      {address}
    </a>
  );
}
