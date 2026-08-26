import type { ImageSource, ResolvedImage } from "@/types/project";

/**
 * 파생본 기반 반응형 이미지.
 *
 * next/image 를 쓰지 않는 이유: output: "export" + unoptimized 라
 * next/image 는 레이아웃 예약과 lazy 말고는 해주는 게 없는데,
 * 정작 필요한 AVIF/WebP 이중 포맷 <source> 를 만들어 주지 못한다.
 * 파생본은 이미 빌드 타임에 다 만들어 뒀으므로 <picture> 를 직접 쓴다.
 *
 * width/height 는 매니페스트에서 오므로 CLS 가 발생하지 않는다.
 */
export function ResponsiveImage({
  image,
  sizes,
  preferThumb = false,
  priority = false,
  className,
}: {
  image: ResolvedImage;
  /** 뷰포트 대비 이 이미지가 차지할 폭. srcset 선택의 근거가 된다. */
  sizes: string;
  /** 16:9 크롭본이 있으면 그것을 쓴다 (세로로 긴 풀페이지 캡처용). */
  preferThumb?: boolean;
  /** 첫 화면에 보이는 이미지만 true. lazy 를 끄고 우선순위를 올린다. */
  priority?: boolean;
  className?: string;
}) {
  const useThumb = preferThumb && image.thumb !== undefined;
  const set = useThumb ? image.thumb!.sources : image.sources;
  const width = useThumb ? image.thumb!.width : image.width;
  const height = useThumb ? image.thumb!.height : image.height;

  // <source> 가 하나도 안 맞을 때의 폴백. 원본 PNG 는 무거우므로 가장 큰 WebP.
  const fallback = last(set.webp) ?? last(set.avif);

  return (
    <picture>
      {set.avif.length > 0 ? (
        <source type="image/avif" srcSet={toSrcSet(set.avif)} sizes={sizes} />
      ) : null}
      {set.webp.length > 0 ? (
        <source type="image/webp" srcSet={toSrcSet(set.webp)} sizes={sizes} />
      ) : null}
      <img
        src={fallback?.src ?? image.src}
        alt={image.alt}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
        className={className}
      />
    </picture>
  );
}

function toSrcSet(list: readonly ImageSource[]): string {
  return list.map((s) => `${s.src} ${s.width}w`).join(", ");
}

function last<T>(list: readonly T[]): T | undefined {
  return list.length > 0 ? list[list.length - 1] : undefined;
}
