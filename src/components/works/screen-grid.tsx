import { ZoomButton } from "@/components/works/lightbox";
import { ResponsiveImage } from "@/components/works/responsive-image";
import type { ResolvedScreen } from "@/types/project";

const SIZES = "(min-width: 640px) 30rem, 100vw";

/**
 * 화면 썸네일 그리드.
 *
 * 영상은 자동재생하지 않는다. GIF 를 mp4 로 바꾸면서 자동재생을 잃긴 했지만,
 * 한 페이지에서 5개가 동시에 돌면 산만하고 모바일 데이터도 축낸다.
 *
 * preload="none" 인 이유: "metadata" 로 두면 5개가 초기에 887KB 를 당겨온다.
 * 길이(durationSec)는 이미 매니페스트에 있어 캡션에 직접 쓰므로
 * 브라우저가 메타데이터를 미리 받을 이유가 없다. poster 만 깔고 기다린다.
 */
export function ScreenGrid({
  screens,
  /** 라이트박스에서 이 화면이 몇 번째인지. 확대 불가면 undefined. */
  zoomIndexOf,
}: {
  screens: readonly ResolvedScreen[];
  zoomIndexOf: (src: string) => number | undefined;
}) {
  if (screens.length === 0) return null;

  return (
    <ul className="grid gap-x-6 gap-y-8 sm:grid-cols-2">
      {screens.map((s) => (
        <li key={s.src} className="flex flex-col gap-2">
          <figure className="flex flex-col gap-2">
            <div className="border-rule bg-surface overflow-hidden rounded-lg border">
              {s.kind === "image" ? (
                <MaybeZoom index={zoomIndexOf(s.src)} label={s.alt}>
                  <ResponsiveImage
                    image={s}
                    sizes={SIZES}
                    preferThumb
                    className="block h-auto w-full"
                  />
                </MaybeZoom>
              ) : (
                <video
                  src={s.src}
                  poster={s.poster}
                  width={s.width}
                  height={s.height}
                  controls
                  muted
                  loop
                  playsInline
                  preload="none"
                  className="block h-auto w-full"
                />
              )}
            </div>
            {s.caption ? (
              <figcaption className="text-ink-3 text-xs leading-snug">
                {s.caption}
                {/* 여기서 불투명도를 더 낮추면 대비가 3.37:1 로 떨어진다 (WCAG AA 미달). */}
                {s.kind === "video" ? (
                  <span> · 영상 {s.durationSec.toFixed(1)}초</span>
                ) : null}
              </figcaption>
            ) : null}
          </figure>
        </li>
      ))}
    </ul>
  );
}

/** zoomable: false 면 버튼으로 감싸지 않는다 — 열 수 없어야 하므로. */
function MaybeZoom({
  index,
  label,
  children,
}: {
  index: number | undefined;
  label: string;
  children: React.ReactNode;
}) {
  if (index === undefined) return <>{children}</>;
  return (
    <ZoomButton index={index} label={label}>
      {children}
    </ZoomButton>
  );
}
