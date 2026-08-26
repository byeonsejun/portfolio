/**
 * 포트폴리오 프로젝트 메타데이터 스키마 — 2계층 구조.
 *
 *   저작 레이어(*Ref)   사람이 src/data/projects.ts 에 손으로 쓴다.
 *                       "어떤 파일인지 + 편집자만 아는 정보(alt·caption)"만 담는다.
 *   해석 레이어(Resolved*) 빌드 타임에 이미지 매니페스트를 병합한 결과.
 *                       width·height·파생본·poster 처럼 파일에서 파생되는 값은
 *                       전부 여기서 채워진다. 컴포넌트는 이쪽만 받는다.
 *
 * width/height 를 저작 레이어에서 뺀 것이 핵심이다. 손으로 적으면 이미지를
 * 교체했을 때 조용히 어긋나지만, 매니페스트에서 오면 구조적으로 불가능하다.
 */

/* ══════════════════════════ 저작 레이어 ══════════════════════════ */

/** projects.ts 에 쓰는 이미지 참조. src 는 매니페스트 조회 키를 겸한다. */
export interface ImageRef {
  /** public/ 기준 절대 경로. 예: "/projects/netflix/01-home.png" */
  readonly src: string;
  /** 접근성용 대체 텍스트. 장식 이미지가 아니므로 필수. */
  readonly alt: string;
  /** 이미지 밑에 붙는 설명. README 캡션이 여기로 온다. */
  readonly caption?: string;
  /**
   * 라이트박스 확대 허용 여부. 기본 true.
   * 원본 해상도가 낮아 확대해도 얻을 게 없는 자산은 false 로 막는다.
   */
  readonly zoomable?: boolean;
}

/** projects.ts 에 쓰는 영상 참조. poster·해상도·길이는 매니페스트가 채운다. */
export interface VideoRef {
  readonly src: string;
  readonly caption?: string;
}

/** 썸네일 그리드 한 칸. 이미지이거나 영상이다. */
export type ScreenRef =
  | ({ readonly kind: "image" } & ImageRef)
  | ({ readonly kind: "video" } & VideoRef);

/**
 * 아키텍처 다이어그램 참조.
 *
 * 모든 다이어그램은 public/diagrams/ 의 SVG 파일이고, 빌드 타임에 파일을 읽어
 * 인라인으로 박는다. SVG 안에 <html data-theme="dark"> 를 참조하는 <style>
 * 블록이 들어 있어서 <img src> 로는 다크모드가 동작하지 않기 때문이다.
 */
export interface DiagramRef {
  /** 캡션으로 쓰는 제목. */
  readonly title: string;
  /** public/ 기준 절대 경로. 예: "/diagrams/nextour-fsd.svg" */
  readonly src: string;
  /** 다이어그램 아래 해설. */
  readonly description?: string;
}

/* ─────────────────────────── 지표 배지 ─────────────────────────── */

/**
 * "Lighthouse 93", "9,935 bytes" 같은 한 줄 성과 배지.
 * value 와 label 을 분리해야 배지 안에서 값만 크게 조판할 수 있다.
 */
export interface Metric {
  /** 배지 왼쪽 라벨. 예: "Performance", "API 응답" */
  readonly label: string;
  /** 강조되는 값. 예: "93", "9,935 bytes" */
  readonly value: string;
  /** 개선 전 수치. 있으면 "before → after" 로 렌더. */
  readonly baseline?: string;
  /**
   * 측정값인지 구조 서술인지.
   *
   *   measured    실제로 잰 수치. "Lighthouse 93", "1,324건", "9,935 bytes"
   *   structural  설계·구조를 서술하는 값. "3-phase saga", "FSD 5-레이어"
   *
   * 둘 다 배지로 나가지만 시각적 무게가 같으면 안 된다 —
   * 레이아웃에서 이 필드로 조판을 갈라 쓴다.
   * 생략하면 "measured" 로 취급한다.
   */
  readonly kind?: "measured" | "structural";
  /**
   * 값이 좋은 방향인지 — 배지 색상 결정용. 생략하면 중립.
   *
   * 판단 기준은 "개선 델타가 증명되는가" 하나다. baseline 이 있어
   * before → after 를 보여줄 수 있는 배지에만 positive 를 준다.
   * 절대값이 좋다는 이유로 붙이기 시작하면(Lighthouse 100 은? 93 은?)
   * 기준선이 임의가 되고 신호가 죽는다.
   */
  readonly tone?: "positive" | "neutral";
  /** 측정 조건. 예: "Lighthouse 13.2.0 · Emulated Desktop · 2026.06.17" */
  readonly note?: string;
}

/* ─────────────────────────── 트러블슈팅 ─────────────────────────── */

/** 카드당 1건. Situation → Cause → Solution 3단 구성. */
export interface Troubleshooting {
  readonly title: string;
  /** Situation — 무엇이 관측됐나 */
  readonly situation: string;
  /** Cause — 왜 그랬나 */
  readonly cause: string;
  /** Solution — 어떻게 고쳤나 */
  readonly solution: string;
  /** 고친 뒤 확인된 결과. */
  readonly outcome?: string;
  /** 근거 링크 (PR, 커밋, ADR 문서 등) */
  readonly references?: readonly LinkRef[];
}

export interface LinkRef {
  readonly label: string;
  readonly href: string;
}

/* ─────────────────────────── 기술 스택 ─────────────────────────── */

export type TechCategory =
  | "language"
  | "framework"
  | "state"
  | "styling"
  | "data"
  | "auth"
  | "testing"
  | "infra"
  | "tooling";

export interface TechItem {
  readonly name: string;
  readonly category: TechCategory;
  /** 왜 이걸 골랐는지 한 줄. 툴팁이나 확장 영역에 쓴다. */
  readonly rationale?: string;
}

/* ─────────────────────────── 링크 3종 ─────────────────────────── */

export interface ProjectLinks {
  readonly demo?: string;
  readonly repo: string;
  /** 상세 회고·기술 문서 (README, 블로그, Notion 등) */
  readonly writeup?: string;
}

/* ─────────────────────────── 프로젝트 ─────────────────────────── */

export interface Project {
  /** URL·앵커·React key 로 쓰는 안정 식별자. kebab-case. */
  readonly slug: string;
  readonly name: string;
  /** 한 줄 정의. 카드 제목 바로 밑. */
  readonly tagline: string;
  /** 카드 상단 대표 스크린샷 */
  readonly cover: ImageRef;
  readonly metrics: readonly Metric[];
  /** 화면 썸네일 여러 장 (cover 는 보통 제외) */
  readonly screens: readonly ScreenRef[];
  readonly diagrams: readonly DiagramRef[];
  readonly troubleshooting?: Troubleshooting;
  readonly techStack: readonly TechItem[];
  readonly links: ProjectLinks;
  /** works 섹션 정렬 순서 (작을수록 위) */
  readonly order: number;
}

/* ══════════════════════════ 해석 레이어 ══════════════════════════ */

/** 파생본 하나 — srcset 항목 하나에 대응. */
export interface ImageSource {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
}

/** 포맷별 파생본 묶음. <picture> 의 <source> 하나에 대응. 폭 오름차순. */
export interface ImageSourceSet {
  readonly avif: readonly ImageSource[];
  readonly webp: readonly ImageSource[];
}

/** 세로로 긴 풀페이지 캡처의 16:9 상단 크롭본. */
export interface ResolvedThumb {
  readonly aspect: "16:9";
  /** 원본 높이 대비 크롭 시작 위치 (0~1) */
  readonly cropTopRatio: number;
  readonly width: number;
  readonly height: number;
  readonly sources: ImageSourceSet;
}

/**
 * 매니페스트 병합이 끝난 이미지. sources 가 required 라
 * 컴포넌트에 "파생본이 없을 수도 있다" 분기가 생기지 않는다.
 */
export interface ResolvedImage extends ImageRef {
  /** 원본 픽셀 크기 — 매니페스트 출처라 실제 파일과 어긋날 수 없다. */
  readonly width: number;
  readonly height: number;
  readonly sources: ImageSourceSet;
  /** 카드 썸네일용 16:9 크롭본. 세로로 긴 캡처에만 있다. */
  readonly thumb?: ResolvedThumb;
}

export interface ResolvedVideo extends VideoRef {
  readonly width: number;
  readonly height: number;
  readonly durationSec: number;
  /** 재생 전 표시할 포스터 프레임 (JPEG). */
  readonly poster: string;
}

export type ResolvedScreen =
  | ({ readonly kind: "image" } & ResolvedImage)
  | ({ readonly kind: "video" } & ResolvedVideo);

/** 파일에서 읽어들인 SVG 마크업까지 붙은 다이어그램. */
export interface ResolvedDiagram extends DiagramRef {
  /** <svg …>…</svg> 원문. 인라인으로 문서에 박는다. */
  readonly svg: string;
}

export interface ResolvedProject
  extends Omit<Project, "cover" | "screens" | "diagrams"> {
  readonly cover: ResolvedImage;
  readonly screens: readonly ResolvedScreen[];
  readonly diagrams: readonly ResolvedDiagram[];
}
