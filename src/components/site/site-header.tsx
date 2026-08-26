"use client";

import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export interface NavItem {
  readonly slug: string;
  readonly name: string;
}

/**
 * 고정 헤더 — 현재 위치(네비) + 남은 분량(진행선).
 *
 * 전개형이라 카드 하나가 3,000~5,000px, 전체 20,000px 안팎이다.
 * 네비는 "어디에 있고 어디로 갈 수 있나", 진행선은 "얼마나 남았나" —
 * 서로 다른 질문에 답하므로 중복이 아니다.
 */
export function SiteHeader({ items }: { items: readonly NavItem[] }) {
  const [active, setActive] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  /* 진행선 — 스크롤마다 리렌더하면 낭비라 DOM 에 직접 쓴다. */
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${ratio})`;
      }
    };
    const onScroll = () => {
      if (raf === 0) raf = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (raf !== 0) window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  /*
   * 활성 섹션 판정.
   * 섹션이 뷰포트보다 훨씬 길어서 일반 threshold 로는 잡히지 않는다.
   * rootMargin 으로 화면 중앙에 1px 짜리 감지선을 만들고,
   * 거기에 걸친 섹션을 현재 위치로 본다.
   */
  useEffect(() => {
    const targets = items
      .map((i) => document.getElementById(i.slug))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: "-45% 0px -55% 0px", threshold: 0 },
    );
    for (const t of targets) observer.observe(t);
    return () => observer.disconnect();
  }, [items]);

  /* 모바일에서 활성 칩이 화면 밖이면 장치의 의미가 없다 — 가운데로 끌어온다. */
  useEffect(() => {
    if (!active || !listRef.current) return;
    const chip = listRef.current.querySelector(`[data-slug="${active}"]`);
    chip?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [active]);

  return (
    <header className="bg-background/85 border-rule sticky top-0 z-50 border-b backdrop-blur-sm">
      <div className="mx-auto flex h-(--header-h) w-full max-w-5xl items-center gap-4 px-4 sm:px-6">
        <a
          href="#hero"
          className="text-ink shrink-0 text-sm font-semibold tracking-tight"
        >
          변세준
        </a>

        <nav aria-label="프로젝트" className="min-w-0 flex-1">
          <ul
            ref={listRef}
            className="scrollbar-none flex items-center gap-1 overflow-x-auto"
          >
            {items.map((item) => {
              const isActive = active === item.slug;
              return (
                <li key={item.slug} className="shrink-0">
                  <a
                    href={`#${item.slug}`}
                    data-slug={item.slug}
                    aria-current={isActive ? "true" : undefined}
                    className={[
                      "block rounded-full px-2.5 py-1 text-xs whitespace-nowrap transition-colors sm:text-[13px]",
                      isActive
                        ? "text-ink bg-surface font-medium"
                        : "text-ink-3 hover:text-ink-2",
                    ].join(" ")}
                  >
                    {item.name}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="shrink-0">
          <ThemeToggle />
        </div>
      </div>

      {/* 진행선 — 헤더 아래 모서리에 얹는다 */}
      <div
        aria-hidden="true"
        className="bg-rule/60 absolute inset-x-0 bottom-0 h-0.5"
      >
        <div
          ref={barRef}
          className="bg-ink-2 h-full origin-left"
          style={{ transform: "scaleX(0)" }}
        />
      </div>
    </header>
  );
}
