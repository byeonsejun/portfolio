import { InlineDiagram } from "@/components/diagram/inline-diagram";
import {
  LightboxGroup,
  ZoomButton,
  type LightboxItem,
} from "@/components/works/lightbox";
import { MetricBadges } from "@/components/works/metric-badges";
import { ResponsiveImage } from "@/components/works/responsive-image";
import { ScreenGrid } from "@/components/works/screen-grid";
import type {
  ProjectLinks,
  ResolvedImage,
  ResolvedProject,
  TechItem,
  Troubleshooting,
} from "@/types/project";

const COVER_SIZES = "(min-width: 64rem) 64rem, 100vw";

/**
 * 전개형 프로젝트 카드 — 접히는 곳 없이 전부 노출한다.
 *
 * 순서: 이름 + 한 줄 정의 → 대표 스크린샷 → 지표 → 화면 → 다이어그램
 *      → 트러블슈팅 → 기술 스택 → 링크
 */
export function ProjectCard({
  project,
  index,
  priority = false,
}: {
  project: ResolvedProject;
  index: number;
  /** 첫 카드의 대표 스크린샷만 우선 로드한다. */
  priority?: boolean;
}) {
  const p = project;

  /*
   * 라이트박스 대상 = 이 카드의 이미지 중 zoomable 이 false 가 아닌 것.
   * 대표 스크린샷이 0번이고, 그다음이 화면 썸네일 순서다.
   * 영상은 대상이 아니다 — 확대할 원본이라는 개념이 없다.
   */
  const zoomable: ResolvedImage[] = [
    p.cover,
    ...p.screens.filter((s) => s.kind === "image"),
  ].filter((img) => img.zoomable !== false);

  const items: LightboxItem[] = zoomable.map(toLightboxItem);
  const indexBySrc = new Map(zoomable.map((img, i) => [img.src, i]));
  const zoomIndexOf = (src: string) => indexBySrc.get(src);

  return (
    <LightboxGroup items={items}>
      <article id={p.slug} className="flex flex-col gap-10">
        {/* 이름 + 한 줄 정의 */}
        <header className="flex flex-col gap-2">
          <div className="text-ink-3 font-mono text-[11px] tabular-nums">
            {String(index + 1).padStart(2, "0")}
          </div>
          <h3 className="text-ink text-2xl font-semibold tracking-tight sm:text-3xl">
            {p.name}
          </h3>
          <p className="text-ink-2 max-w-2xl text-sm leading-relaxed text-pretty sm:text-base">
            {p.tagline}
          </p>
        </header>

        {/* 대표 스크린샷 */}
        <div className="border-rule bg-surface overflow-hidden rounded-lg border">
          {zoomIndexOf(p.cover.src) !== undefined ? (
            <ZoomButton index={zoomIndexOf(p.cover.src)!} label={p.cover.alt}>
              <ResponsiveImage
                image={p.cover}
                sizes={COVER_SIZES}
                preferThumb
                priority={priority}
                className="block h-auto w-full"
              />
            </ZoomButton>
          ) : (
            <ResponsiveImage
              image={p.cover}
              sizes={COVER_SIZES}
              preferThumb
              priority={priority}
              className="block h-auto w-full"
            />
          )}
        </div>

        <MetricBadges metrics={p.metrics} />

        {p.screens.length > 0 ? (
          <Block title="화면">
            <ScreenGrid screens={p.screens} zoomIndexOf={zoomIndexOf} />
          </Block>
        ) : null}

        {p.diagrams.length > 0 ? (
          <Block title="아키텍처">
            <div className="flex flex-col gap-10">
              {p.diagrams.map((d) => (
                <InlineDiagram key={d.src} diagram={d} />
              ))}
            </div>
          </Block>
        ) : null}

        {p.troubleshooting ? (
          <Block title="트러블슈팅">
            <TroubleshootingBlock item={p.troubleshooting} />
          </Block>
        ) : null}

        <Block title="기술 스택">
          <TechStack items={p.techStack} />
        </Block>

        <LinkRow links={p.links} name={p.name} />
      </article>
    </LightboxGroup>
  );
}

/**
 * 라이트박스 항목으로 변환.
 * preview 는 페이지에서 이미 받아 캐시된 가장 큰 파생본을 쓴다 —
 * 원본이 도착할 때까지 자리를 채워 빈 화면을 없앤다.
 */
function toLightboxItem(img: ResolvedImage): LightboxItem {
  const avif = img.sources.avif;
  const webp = img.sources.webp;
  const preview =
    avif.length > 0
      ? avif[avif.length - 1]!.src
      : webp.length > 0
        ? webp[webp.length - 1]!.src
        : img.src;
  return {
    src: img.src,
    width: img.width,
    height: img.height,
    alt: img.alt,
    ...(img.caption ? { caption: img.caption } : {}),
    preview,
  };
}

/** 카드 안의 소제목 블록. 가는 선 + 작은 라벨로만 구분한다. */
function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-rule flex flex-col gap-5 border-t pt-6">
      <h4 className="text-ink-3 font-mono text-[11px] tracking-wide">
        {title}
      </h4>
      {children}
    </section>
  );
}

function TroubleshootingBlock({ item }: { item: Troubleshooting }) {
  const steps = [
    { label: "Situation", body: item.situation },
    { label: "Cause", body: item.cause },
    { label: "Solution", body: item.solution },
    ...(item.outcome ? [{ label: "Outcome", body: item.outcome }] : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <p className="text-ink text-base font-medium tracking-tight text-pretty">
        {item.title}
      </p>
      <dl className="flex max-w-3xl flex-col gap-5">
        {steps.map((s) => (
          <div
            key={s.label}
            className="grid gap-1 sm:grid-cols-[6rem_1fr] sm:gap-6"
          >
            <dt className="text-ink-3 pt-0.5 font-mono text-[11px] tracking-wide">
              {s.label}
            </dt>
            <dd className="text-ink-2 text-sm leading-relaxed text-pretty">
              {s.body}
            </dd>
          </div>
        ))}
      </dl>
      {item.references && item.references.length > 0 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {item.references.map((r) => (
            <li key={r.href}>
              <a href={r.href} className={linkClass}>
                {r.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function TechStack({ items }: { items: readonly TechItem[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-2">
      {items.map((t) => (
        <li
          key={t.name}
          className="text-ink-2 border-rule rounded border px-2 py-1 text-xs"
          title={t.rationale}
        >
          {t.name}
        </li>
      ))}
    </ul>
  );
}

const linkClass =
  "text-ink-2 hover:text-ink text-sm underline decoration-current/30 underline-offset-4 transition-colors hover:decoration-current";

function LinkRow({ links, name }: { links: ProjectLinks; name: string }) {
  return (
    <nav
      aria-label={`${name} 링크`}
      className="border-rule flex flex-wrap gap-x-6 gap-y-2 border-t pt-6"
    >
      {/* demoHiddenReason 이 있으면 URL 이 있어도 렌더하지 않는다. 사유는 projects.ts 에. */}
      {links.demo && !links.demoHiddenReason ? (
        <a
          href={links.demo}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          Live Demo
        </a>
      ) : null}
      <a
        href={links.repo}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        Repository
      </a>
      {links.writeup ? (
        <a href={links.writeup} className={linkClass}>
          Writeup
        </a>
      ) : null}
    </nav>
  );
}
