import { ObfuscatedEmail } from "@/components/site/obfuscated-email";
import { GITHUB_HREF } from "@/data/site";
import type { ResolvedProject } from "@/types/project";

/**
 * hero — 표지이자 목차.
 *
 * 전개형이라 전체가 2만 px 가까이 된다. 스크롤을 시작하기 전에
 * "무엇이 5개 있는지"를 먼저 보여주면 긴 문서의 부담이 크게 줄고,
 * 상단 네비와도 같은 순서를 반복해 위치 감각이 강화된다.
 *
 * 100vh 를 강제하지 않는다 — 모바일 주소창 때문에 잘리는 문제가 있고,
 * 문서형에서는 어차피 스크롤이 자연스럽다.
 */
export function Hero({ projects }: { projects: readonly ResolvedProject[] }) {
  return (
    <section id="hero" className="pt-20 pb-24 sm:pt-28 sm:pb-32">
      <h1 className="text-ink text-3xl font-semibold tracking-tight sm:text-4xl">
        변세준
      </h1>
      <p className="text-ink-2 mt-2 text-sm sm:text-base">프론트엔드 개발자</p>

      {/*
        쉼표에서 끊는다. 이 문장은 "A 가 아니라 B" 대구라서 두 절이 각각 한 줄을
        차지해야 구조가 보인다. text-balance 에 맡기면 폭에 따라 아무 데서나
        끊겨 대구가 무너지므로 <br /> 로 고정한다.
        text-balance 는 뺀다 — 강제 개행과 같이 쓰면 줄을 다시 재분배해 버린다.
      */}
      <p className="text-ink mt-10 max-w-2xl text-lg leading-relaxed font-medium tracking-tight text-pretty sm:mt-12 sm:text-2xl sm:leading-relaxed">
        화면을 하나 더 만드는 것이 아니라,
        <br />
        다음 화면을 더 싸게 만들 수 있게 정리하는 것
      </p>

      {/* 목차 — 상단 네비와 같은 순서 */}
      <ol className="border-rule mt-14 border-t sm:mt-16">
        {projects.map((p, i) => (
          <li key={p.slug} className="border-rule border-b">
            <a
              href={`#${p.slug}`}
              className="group flex gap-4 py-4 sm:items-baseline sm:gap-6"
            >
              <span className="text-ink-3 mt-0.5 shrink-0 font-mono text-xs tabular-nums sm:mt-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
                <span className="text-ink shrink-0 text-base font-medium tracking-tight group-hover:underline group-hover:underline-offset-4">
                  {p.name}
                </span>
                <span className="text-ink-2 text-sm text-pretty">
                  {p.tagline}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ol>

      <nav aria-label="연락처" className="mt-10 flex flex-wrap gap-x-6 gap-y-2">
        <a
          href={GITHUB_HREF}
          className="text-ink-2 hover:text-ink text-sm underline decoration-current/30 underline-offset-4 transition-colors hover:decoration-current"
        >
          GitHub
        </a>
        <ObfuscatedEmail className="text-ink-2 hover:text-ink text-sm underline decoration-current/30 underline-offset-4 transition-colors hover:decoration-current" />
      </nav>
    </section>
  );
}
