import type { ResolvedDiagram } from "@/types/project";

/**
 * 다이어그램 SVG 를 문서에 인라인으로 박는 서버 컴포넌트.
 *
 * 왜 <img src> 가 아닌가
 *   SVG 안의 <style> 이 :root[data-theme="dark"] 를 참조한다.
 *   <img> 로 불러오면 SVG 는 별도 문서로 격리되어 바깥 <html> 의 속성을 볼 수 없고,
 *   테마 토글이 전혀 먹지 않는다. 같은 문서 안에 있어야 셀렉터가 매칭된다.
 *
 * 왜 dangerouslySetInnerHTML 이 안전한가
 *   소스는 레포에 커밋된 1st-party 파일뿐이고(resolve.ts 가 /diagrams/*.svg 로 경로를
 *   제한한다), 사용자 입력이 끼어들 여지가 없다. 빌드 타임에 한 번 읽어 정적 HTML 로
 *   찍히므로 런타임 파싱도 없다.
 */
export function InlineDiagram({
  diagram,
  className,
}: {
  diagram: ResolvedDiagram;
  className?: string;
}) {
  return (
    <figure className={`flex flex-col gap-4 ${className ?? ""}`}>
      <div
        className="diagram"
        // 1st-party 빌드 타임 자산만 들어온다 — 위 주석 참고.
        dangerouslySetInnerHTML={{ __html: diagram.svg }}
      />
      <figcaption className="flex max-w-3xl flex-col gap-1.5">
        <span className="text-ink-2 text-sm font-medium tracking-tight">
          {diagram.title}
        </span>
        {diagram.description ? (
          <span className="text-ink-3 text-xs leading-relaxed text-pretty">
            {diagram.description}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}
