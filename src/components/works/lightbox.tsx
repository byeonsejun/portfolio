"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * 원본 확대 뷰어.
 *
 * 네이티브 <dialog>.showModal() 을 쓴다. 직접 구현하는 것보다 정확하다 —
 * 포커스 트랩 · Esc 닫기 · 배경 inert · top-layer 렌더(z-index 무관)를
 * 브라우저가 보장한다. 여기서 더하는 건 ←/→ 이동, 포커스 복원,
 * 그리고 원본 로딩 표시뿐이다.
 *
 * 원본은 최대 2880×1800 이라 즉시 뜨지 않는다. 그래서 두 장을 겹친다:
 * 이미 페이지에서 받아 캐시된 파생본을 깔아 두고, 원본이 도착하면 위로 덮는다.
 * 빈 화면을 보는 구간이 없다.
 */

export interface LightboxItem {
  /** 원본 경로 (public/projects/…) */
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
  readonly caption?: string;
  /** 페이지에서 이미 받은 파생본. 원본이 오기 전까지 자리를 채운다. */
  readonly preview: string;
}

const LightboxContext = createContext<
  ((index: number, trigger: HTMLElement | null) => void) | null
>(null);

/** 확대 트리거. 이미지를 감싸는 버튼. */
export function ZoomButton({
  index,
  label,
  children,
}: {
  index: number;
  label: string;
  children: React.ReactNode;
}) {
  const open = useContext(LightboxContext);
  const ref = useRef<HTMLButtonElement>(null);
  if (!open) return <>{children}</>;
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => open(index, ref.current)}
      aria-label={`${label} 원본 크기로 보기`}
      className="focus-visible:outline-ink block w-full cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {children}
    </button>
  );
}

export function LightboxGroup({
  items,
  children,
}: {
  items: readonly LightboxItem[];
  children: React.ReactNode;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const open = useCallback((i: number, trigger: HTMLElement | null) => {
    /*
     * 복원 대상은 트리거 엘리먼트를 직접 받는다.
     * document.activeElement 를 쓰면 안 된다 — Safari·Firefox(macOS)는
     * 버튼을 클릭해도 포커스를 옮기지 않아서 <body> 가 잡히고,
     * 닫을 때 포커스가 문서 맨 위로 날아간다.
     */
    restoreRef.current = trigger;
    setLoaded(false);
    setIndex(i);
  }, []);

  const close = useCallback(() => {
    setIndex(null);
    // 스크롤 위치가 튀지 않게 — dialog 는 top-layer 였으므로 페이지는 그대로다.
    restoreRef.current?.focus({ preventScroll: true });
  }, []);

  const step = useCallback(
    (delta: number) => {
      setIndex((cur) => {
        if (cur === null || items.length === 0) return cur;
        setLoaded(false);
        return (cur + delta + items.length) % items.length;
      });
    },
    [items.length],
  );

  /* index 상태를 실제 dialog 열림 상태에 반영 */
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (index !== null && !d.open) d.showModal();
    else if (index === null && d.open) d.close();
  }, [index]);

  if (items.length === 0) return <>{children}</>;

  const item = index === null ? null : items[index];

  return (
    <LightboxContext.Provider value={open}>
      {children}

      <dialog
        ref={dialogRef}
        onClose={close}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            step(1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            step(-1);
          }
        }}
        onClick={(e) => {
          // 배경(다이얼로그 자신)을 눌렀을 때만 닫는다.
          if (e.target === dialogRef.current) close();
        }}
        aria-label="원본 이미지"
        /* 뷰포트를 꽉 채우는 불투명 배경.
           ::backdrop 만 쓰면 뒤 페이지가 15% 로 비쳐 원본을 판단하기 어렵다. */
        className="lightbox m-0 h-full max-h-none w-full max-w-none bg-[#0b0b0c] p-0 backdrop:bg-black"
      >
        {item ? (
          <div className="flex h-full w-full flex-col">
            {/* 상단 바 */}
            <div className="flex shrink-0 items-center justify-between gap-4 px-4 py-3 text-white/70">
              <span className="font-mono text-[11px] tabular-nums">
                {(index ?? 0) + 1} / {items.length}
                <span className="ml-3 text-white/60">
                  {item.width} × {item.height}
                </span>
                {!loaded ? (
                  <span className="ml-3 text-white/60">원본 불러오는 중…</span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={close}
                aria-label="닫기"
                className="rounded px-2 py-1 text-xs text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                닫기 (Esc)
              </button>
            </div>

            {/* 이미지 */}
            <div className="relative flex min-h-0 flex-1 items-center justify-center px-4">
              {/* 캐시된 파생본 — 즉시 표시 */}
              {/* eslint-disable-next-line @next/next/no-img-element -- 원본 확대가 목적. next/image 는 정적 export 에서 최적화를 하지 않고 이 경로에 도움이 안 된다. */}
              <img
                src={item.preview}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 m-auto max-h-full max-w-full object-contain"
              />
              {/* 원본 — 도착하면 덮는다 */}
              {/* eslint-disable-next-line @next/next/no-img-element -- 위와 동일. 원본을 그대로 띄우는 것이 이 컴포넌트의 목적이다. */}
              <img
                key={item.src}
                src={item.src}
                alt={item.alt}
                width={item.width}
                height={item.height}
                onLoad={() => setLoaded(true)}
                className={[
                  "lightbox-full relative max-h-full max-w-full object-contain",
                  loaded ? "opacity-100" : "opacity-0",
                ].join(" ")}
              />
              {!loaded ? (
                <div
                  aria-hidden="true"
                  className="lightbox-spinner absolute bottom-4 left-1/2 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-white/25 border-t-white/80"
                />
              ) : null}
            </div>

            {/* 하단 바 */}
            <div className="flex shrink-0 items-center justify-between gap-4 px-4 py-3">
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="이전 이미지"
                className="rounded px-2 py-1 text-xs text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                ← 이전
              </button>
              <p className="min-w-0 flex-1 truncate text-center text-xs text-white/70">
                {item.caption ?? item.alt}
              </p>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="다음 이미지"
                className="rounded px-2 py-1 text-xs text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                다음 →
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </LightboxContext.Provider>
  );
}
