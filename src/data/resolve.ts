import { readFileSync } from "node:fs";
import path from "node:path";
import manifest from "@/data/generated/image-manifest.json";
import { projects } from "@/data/projects";
import type {
  DiagramRef,
  ImageRef,
  ImageSource,
  ImageSourceSet,
  Project,
  ResolvedDiagram,
  ResolvedImage,
  ResolvedProject,
  ResolvedScreen,
  ResolvedThumb,
  ResolvedVideo,
  ScreenRef,
  VideoRef,
} from "@/types/project";

/**
 * 저작 데이터(projects.ts) + 빌드 산출물(image-manifest.json) → 컴포넌트가 쓸 형태.
 *
 * 이 모듈은 파일 시스템을 읽으므로 서버에서만 동작한다.
 * output: "export" 라 모든 페이지가 빌드 타임에 프리렌더되고, 결과는 정적 HTML 에
 * 그대로 박히므로 런타임 fs 접근은 발생하지 않는다.
 *
 * 조회 실패는 전부 throw 한다 — 경로 오타를 런타임 404 가 아니라 빌드 에러로 잡는다.
 */

const PUBLIC_DIR = path.join(process.cwd(), "public");

/* ─────────────────────────── 매니페스트 타입 ─────────────────────────── */

interface ManifestSource {
  src: string;
  width: number;
  height: number;
  bytes: number;
}
interface ManifestSourceSet {
  avif?: ManifestSource[];
  webp?: ManifestSource[];
}
interface ManifestImage {
  original: { src: string; width: number; height: number; bytes: number };
  sources: ManifestSourceSet;
  thumb?: {
    aspect: string;
    cropTopRatio: number;
    cropRect: { left: number; top: number; width: number; height: number };
    sources: ManifestSourceSet;
  };
}
interface ManifestVideo {
  src: string;
  width: number;
  height: number;
  durationSec: number;
  bytes: number;
  poster: { src: string; bytes: number };
  fromGif?: { src: string; bytes: number };
}
interface Manifest {
  images: Record<string, ManifestImage>;
  videos: Record<string, ManifestVideo>;
}

const m = manifest as unknown as Manifest;

/* ────────────────────────────── 실패 처리 ────────────────────────────── */

function fail(kind: string, src: string, known: readonly string[]): never {
  throw new Error(
    [
      `[resolve] ${kind} 매니페스트에 "${src}" 가 없습니다.`,
      "",
      "  projects.ts 의 경로가 틀렸거나, 이미지 파이프라인이 아직 안 돌았습니다.",
      "  파일을 새로 추가했다면 `npm run images` 를 실행하세요.",
      "",
      `  매니페스트에 있는 ${kind} 키:`,
      ...known.map((k) => `    ${k}`),
    ].join("\n"),
  );
}

/* ────────────────────────────── 변환 ────────────────────────────── */

function toSourceSet(s: ManifestSourceSet, src: string): ImageSourceSet {
  const avif = s.avif ?? [];
  const webp = s.webp ?? [];
  if (avif.length === 0 && webp.length === 0) {
    throw new Error(`[resolve] "${src}" 의 파생본이 비어 있습니다.`);
  }
  return { avif, webp };
}

function resolveImage(ref: ImageRef): ResolvedImage {
  const entry = m.images[ref.src];
  if (!entry) fail("이미지", ref.src, Object.keys(m.images));

  let thumb: ResolvedThumb | undefined;
  if (entry.thumb) {
    if (entry.thumb.aspect !== "16:9") {
      throw new Error(
        `[resolve] "${ref.src}" 썸네일 비율이 16:9 가 아닙니다: ${entry.thumb.aspect}`,
      );
    }
    thumb = {
      aspect: "16:9",
      cropTopRatio: entry.thumb.cropTopRatio,
      width: entry.thumb.cropRect.width,
      height: entry.thumb.cropRect.height,
      sources: toSourceSet(entry.thumb.sources, `${ref.src} (thumb)`),
    };
  }

  return {
    ...ref,
    width: entry.original.width,
    height: entry.original.height,
    sources: toSourceSet(entry.sources, ref.src),
    ...(thumb ? { thumb } : {}),
  };
}

function resolveVideo(ref: VideoRef): ResolvedVideo {
  const entry = m.videos[ref.src];
  if (!entry) fail("영상", ref.src, Object.keys(m.videos));
  return {
    ...ref,
    width: entry.width,
    height: entry.height,
    durationSec: entry.durationSec,
    poster: entry.poster.src,
  };
}

function resolveScreen(ref: ScreenRef): ResolvedScreen {
  return ref.kind === "image"
    ? { kind: "image", ...resolveImage(ref) }
    : { kind: "video", ...resolveVideo(ref) };
}

/**
 * 다이어그램 SVG 를 빌드 타임에 읽어 마크업째로 들고 온다.
 *
 * <img src> 로는 안 되는 이유: SVG 안의 <style> 이 :root[data-theme="dark"] 를
 * 참조하는데, <img> 로 불러온 SVG 는 별도 문서라 바깥 <html> 의 속성을 볼 수 없다.
 * 인라인해야 같은 문서가 되어 테마 토글이 먹는다.
 */
function resolveDiagram(ref: DiagramRef): ResolvedDiagram {
  if (!ref.src.startsWith("/diagrams/") || !ref.src.endsWith(".svg")) {
    throw new Error(
      `[resolve] 다이어그램 경로는 /diagrams/*.svg 여야 합니다: "${ref.src}"`,
    );
  }
  // 경로 조작 방지: 정규화 결과가 public/ 밖으로 나가면 거부.
  const abs = path.normalize(path.join(PUBLIC_DIR, ref.src));
  if (!abs.startsWith(path.join(PUBLIC_DIR, "diagrams") + path.sep)) {
    throw new Error(`[resolve] 잘못된 다이어그램 경로: "${ref.src}"`);
  }

  let svg: string;
  try {
    svg = readFileSync(abs, "utf8");
  } catch {
    throw new Error(
      `[resolve] 다이어그램 파일을 읽을 수 없습니다: public${ref.src}`,
    );
  }
  if (!svg.trimStart().startsWith("<svg")) {
    throw new Error(`[resolve] SVG 가 <svg> 로 시작하지 않습니다: "${ref.src}"`);
  }
  return { ...ref, svg };
}

/* ────────────────────────────── 공개 API ────────────────────────────── */

export function resolveProject(p: Project): ResolvedProject {
  return {
    ...p,
    cover: resolveImage(p.cover),
    screens: p.screens.map(resolveScreen),
    diagrams: p.diagrams.map(resolveDiagram),
  };
}

/** works 섹션 정렬까지 끝난 최종 데이터. */
export const resolvedProjects: readonly ResolvedProject[] = projects
  .map(resolveProject)
  .sort((a, b) => a.order - b.order);

/* ────────────────────────────── 렌더 헬퍼 ────────────────────────────── */

/** ImageSource 목록 → srcset 문자열. */
export function toSrcSet(list: readonly ImageSource[]): string {
  return list.map((s) => `${s.src} ${s.width}w`).join(", ");
}
