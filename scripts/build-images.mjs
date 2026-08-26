/**
 * 이미지 파생본 생성 파이프라인 (prebuild / predev 훅)
 *
 * output: "export" 라 next/image 의 런타임 최적화 서버가 없다.
 * 그래서 빌드 전에 여기서 미리 만들어 둔다.
 *
 *   public/projects/**   배포되는 원본 (git 커밋, 라이트박스 확대 대상)
 *   media-src/**         배포되지 않는 빌드 입력 전용 (mp4 로 대체될 GIF 등)
 *   public/derived/**    파생본 (gitignore, 빌드 때 재생성)
 *
 * 하는 일
 *   1. PNG  → 640 / 1280 / 1920 폭의 AVIF + WebP (원본보다 큰 폭은 건너뜀 = 업스케일 금지)
 *   2. 세로로 긴 풀페이지 캡처 → 16:9 상단 크롭 썸네일 세트 추가 생성
 *   3. GIF  → mp4 (h264) + poster
 *   4. mp4  → poster
 *   5. 결과를 src/data/generated/image-manifest.json 에 기록
 *
 * 이미 만들어진 파일은 원본보다 새로우면 건너뛴다 (재빌드 가속).
 * --force 로 전체 재생성.
 */

import { execFile } from "node:child_process";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { readMp4Meta } from "./lib/mp4-meta.mjs";

const execFileAsync = promisify(execFile);

/*
 * ffmpeg 산출물(mp4 · poster)은 저장소에 커밋돼 있고 빌드는 그걸 그대로 쓴다.
 *
 * 왜: 결과가 원본에만 의존하는데 원본은 거의 안 바뀐다. 그걸 매 빌드마다
 * 다시 만들려고 배포 CI 에 ffmpeg 를 요구하면, 없는 순간 빌드가 통째로 멈춘다
 * (Cloudflare Pages 빌더에 ffmpeg 가 없어서 실제로 그렇게 됐다).
 *
 * --media 를 주면 강제로 다시 만든다. 원본 GIF·mp4 를 갈아끼웠을 때
 * 로컬에서 `npm run media` 로 돌리고 결과를 커밋하는 용도다.
 *
 * mtime 이 아니라 "파일이 있는지" 로 판단하는 이유: git 은 mtime 을 보존하지
 * 않는다. clone 하면 원본과 산출물이 같은 시각을 받아 신선도 비교가 무의미해진다.
 */
const FORCE_MEDIA = process.argv.includes("--media");

/** ffmpeg 존재 여부. 실제로 필요해지는 순간에만 한 번 확인한다. */
let ffmpegAvailable = null;
async function requireFfmpeg(missingFile) {
  if (ffmpegAvailable === null) {
    try {
      await execFileAsync("ffmpeg", ["-version"]);
      ffmpegAvailable = true;
    } catch {
      ffmpegAvailable = false;
    }
  }
  if (!ffmpegAvailable) {
    throw new Error(
      `ffmpeg 가 없는데 ${path.relative(ROOT, missingFile)} 도 없다.\n` +
        `  이 파일은 저장소에 커밋돼 있어야 한다. 원본을 바꿨다면 ffmpeg 가 있는 곳에서\n` +
        `  \`npm run media\` 를 돌리고 만들어진 mp4 · poster 를 함께 커밋할 것.`,
    );
  }
}

async function exists(f) {
  try {
    await stat(f);
    return true;
  } catch {
    return false;
  }
}

const ROOT = process.cwd();
const SRC_ROOT = path.join(ROOT, "public", "projects");
/**
 * 배포되지 않는 빌드 입력. public/ 아래 파일은 전부 out/ 으로 복사되므로,
 * mp4 로 완전히 대체되어 다시 참조되지 않는 GIF 원본은 여기 둔다.
 * (그대로 public/ 에 두면 3.8MB 가 아무도 안 쓰는 채로 배포된다.)
 */
const MEDIA_SRC = path.join(ROOT, "media-src");
const OUT_ROOT = path.join(ROOT, "public", "derived");
const MANIFEST = path.join(ROOT, "src", "data", "generated", "image-manifest.json");

const WIDTHS = [640, 1280, 1920];
const AVIF = { quality: 50, effort: 4 };
const WEBP = { quality: 78, effort: 5 };
const FORCE = process.argv.includes("--force");
/** poster 최대 폭. 표시 폭(≤490px)의 약 1.6배. */
const POSTER_WIDTH = 800;
const CONCURRENCY = 4;

/**
 * 세로로 긴 풀페이지 캡처 → 16:9 상단 크롭.
 * 값은 원본을 눈으로 보고 정한 세로 오프셋(원본 높이 대비 %).
 * 어느 UI 요소도 어중간하게 잘리지 않는 지점을 골랐다.
 */
const THUMB_CROPS = {
  // 4%: 지역 선택 드롭다운 경계에서 시작. 잘리는 건 날씨 카드 하단뿐 —
  //     "페이지가 아래로 계속된다"로 읽혀서 자연스럽다. 0% 는 "21°" 를 반토막 낸다.
  "date/mobile-iphone12-home.png": 0.04,
  // 0%: 핑크 브랜드 헤더 + 날씨 카드가 거의 통째로 들어간다.
  //     2% 만 내려도 헤더가 얇은 띠로 남아 실수처럼 보인다.
  "date/mobile-ipadmini-home.png": 0.0,
  // 9%: "QUIET ESSENTIALS" 헤드라인 + 서브텍스트 + SHOP NOW 버튼이 온전히 들어간다.
  //     0% 는 헤드라인을, 6% 는 CTA 버튼을 자른다.
  "shoppy/preview-home.png": 0.09,
};

/** GIF → mp4 로 바꿀 대상. 확대는 막을 것이므로 파생 정지 이미지는 만들지 않는다. */
const GIF_TO_MP4 = new Set([
  "netflix/02-hover-preview.gif",
  "netflix/03-movies-filter.gif",
]);

/* ────────────────────────────── 유틸 ────────────────────────────── */

const log = (...a) => console.log("[images]", ...a);
let created = 0;
let skipped = 0;

async function fileSize(p) {
  try {
    return (await stat(p)).size;
  } catch {
    return 0;
  }
}

/** 출력이 존재하고 원본보다 새로우면 true. */
async function isFresh(out, srcMtimeMs) {
  if (FORCE) return false;
  try {
    const s = await stat(out);
    return s.size > 0 && s.mtimeMs >= srcMtimeMs;
  } catch {
    return false;
  }
}

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

async function pool(items, worker) {
  const queue = [...items];
  const runners = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (item !== undefined) await worker(item);
    }
  });
  await Promise.all(runners);
}

/** 원본 폭을 넘는 타깃은 버린다(업스케일 방지). 하나도 안 남으면 원본 폭 하나만. */
function widthsFor(srcWidth) {
  const ws = WIDTHS.filter((w) => w <= srcWidth);
  return ws.length ? ws : [srcWidth];
}

/* ─────────────────────────── 래스터 파생본 ─────────────────────────── */

/**
 * @param {import("sharp").Sharp} pipelineFactory 매 출력마다 새로 만드는 sharp 인스턴스 팩토리
 * @returns {Promise<Array<{format:string,src:string,width:number,height:number,bytes:number}>>}
 */
async function emitRaster(pipelineFactory, srcWidth, outDir, baseName, srcMtimeMs) {
  const results = [];
  for (const w of widthsFor(srcWidth)) {
    for (const [ext, opts] of [
      ["avif", AVIF],
      ["webp", WEBP],
    ]) {
      const out = path.join(outDir, `${baseName}-${w}.${ext}`);
      const rel = "/" + path.relative(path.join(ROOT, "public"), out).split(path.sep).join("/");
      if (await isFresh(out, srcMtimeMs)) {
        skipped++;
        const meta = await sharp(out).metadata();
        results.push({
          format: ext,
          src: rel,
          width: meta.width ?? w,
          height: meta.height ?? 0,
          bytes: await fileSize(out),
        });
        continue;
      }
      const img = pipelineFactory().resize({ width: w, withoutEnlargement: true });
      const info = await (ext === "avif" ? img.avif(opts) : img.webp(opts)).toFile(out);
      created++;
      results.push({
        format: ext,
        src: rel,
        width: info.width,
        height: info.height,
        bytes: info.size,
      });
    }
  }
  return results;
}

/** manifest 에 넣기 좋은 형태로 정리: 포맷별 오름차순 폭 배열. */
function groupSources(entries) {
  /** @type {Record<string, Array<{src:string,width:number,height:number,bytes:number}>>} */
  const byFormat = {};
  for (const e of entries) {
    (byFormat[e.format] ??= []).push({
      src: e.src,
      width: e.width,
      height: e.height,
      bytes: e.bytes,
    });
  }
  for (const list of Object.values(byFormat)) list.sort((a, b) => a.width - b.width);
  return byFormat;
}

/* ────────────────────────────── 영상 ────────────────────────────── */

async function gifToMp4(srcAbs, outAbs) {
  if (!FORCE_MEDIA && (await exists(outAbs))) {
    skipped++;
    return false;
  }
  await requireFfmpeg(outAbs);
  await execFileAsync("ffmpeg", [
    "-y",
    "-i", srcAbs,
    // 홀수 픽셀이면 yuv420p 인코딩이 실패하므로 짝수로 맞춘다.
    "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos",
    "-c:v", "libx264",
    "-crf", "23",
    "-preset", "slow",
    "-pix_fmt", "yuv420p",
    // 웹에서 메타데이터를 먼저 받아 즉시 재생 시작할 수 있게.
    "-movflags", "+faststart",
    "-an",
    outAbs,
  ]);
  created++;
  return true;
}

/**
 * poster 프레임 추출.
 *
 * <video poster> 는 URL 을 하나만 받는다 — srcset·<picture> 를 못 쓰므로
 * AVIF/WebP 대신 어디서나 확실히 뜨는 JPEG 로 고정한다.
 * 다만 ffmpeg 내장 mjpeg 인코더는 압축이 나빠서(1280폭 q3 에 220KB) 프레임만
 * PNG 로 뽑고, 실제 인코딩은 sharp 의 mozjpeg 에 맡긴다.
 */
async function extractPoster(srcAbs, outAbs) {
  if (!FORCE_MEDIA && (await exists(outAbs))) {
    skipped++;
    return false;
  }
  await requireFfmpeg(outAbs);
  // 첫 프레임. 재생 전 화면과 poster 가 일치하는 게 가장 자연스럽다.
  const { stdout } = await execFileAsync(
    "ffmpeg",
    ["-y", "-i", srcAbs, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"],
    { encoding: "buffer", maxBuffer: 128 * 1024 * 1024 },
  );
  // poster 는 <video> 가 preload="none" 이어도 즉시 받아간다 — 초기 로드에 그대로 얹힌다.
  // 실제 표시 폭은 최대 ~490px 이므로 원본 폭(1280)으로 만들 이유가 없다.
  await sharp(stdout)
    .resize({ width: POSTER_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 62, mozjpeg: true })
    .toFile(outAbs);
  created++;
  return true;
}

/**
 * 영상 메타데이터. ffprobe 대신 MP4 헤더를 직접 읽는다.
 * 이 값은 <video> 에 크기를 박아 레이아웃을 예약하는 데만 쓰이는데,
 * 그것 때문에 빌드가 시스템 ffmpeg 에 매일 이유가 없다.
 */
async function probe(file) {
  return readMp4Meta(file);
}

/* ────────────────────────────── 메인 ────────────────────────────── */

async function main() {
  const started = Date.now();
  const all = (await walk(SRC_ROOT)).filter((f) => !path.basename(f).startsWith("."));

  // videos 에는 date 의 실촬영 mp4 와 GIF 를 대체한 mp4 가 함께 들어간다.
  // 리졸버가 한 곳만 보면 되도록 종류를 나누지 않는다.
  const manifest = { images: {}, videos: {} };
  let originalBytes = 0;
  let derivedBytes = 0;

  const pngs = all.filter((f) => /\.png$/i.test(f));
  const mp4s = all.filter((f) => /\.mp4$/i.test(f));
  // GIF 는 배포되지 않는 media-src/ 에서 읽는다.
  const gifs = (await walk(MEDIA_SRC).catch(() => [])).filter((f) =>
    /\.gif$/i.test(f),
  );

  /* 1 · PNG 파생본 + 2 · 16:9 크롭 썸네일 */
  await pool(pngs, async (srcAbs) => {
    const relKey = path.relative(SRC_ROOT, srcAbs).split(path.sep).join("/");
    const publicSrc = "/projects/" + relKey;
    const outDir = path.join(OUT_ROOT, path.dirname(relKey));
    await mkdir(outDir, { recursive: true });

    const st = await stat(srcAbs);
    originalBytes += st.size;
    const meta = await sharp(srcAbs).metadata();
    const srcW = meta.width ?? 0;
    const srcH = meta.height ?? 0;
    const base = path.basename(relKey, path.extname(relKey));

    const full = await emitRaster(() => sharp(srcAbs), srcW, outDir, base, st.mtimeMs);

    /** @type {Record<string, unknown> | undefined} */
    let thumb;
    const cropOffset = THUMB_CROPS[relKey];
    if (cropOffset !== undefined) {
      const cw = srcW;
      const ch = Math.round(srcW * 9 / 16);
      const top = Math.min(Math.round(srcH * cropOffset), Math.max(0, srcH - ch));
      const entries = await emitRaster(
        () => sharp(srcAbs).extract({ left: 0, top, width: cw, height: ch }),
        cw,
        outDir,
        `${base}-thumb`,
        st.mtimeMs,
      );
      thumb = {
        aspect: "16:9",
        cropTopRatio: cropOffset,
        cropRect: { left: 0, top, width: cw, height: ch },
        sources: groupSources(entries),
      };
      for (const e of entries) derivedBytes += e.bytes;
    }

    for (const e of full) derivedBytes += e.bytes;

    manifest.images[publicSrc] = {
      original: { src: publicSrc, width: srcW, height: srcH, bytes: st.size },
      sources: groupSources(full),
      ...(thumb ? { thumb } : {}),
    };
    log("png", relKey, `${srcW}x${srcH}`, thumb ? "(+16:9 thumb)" : "");
  });

  /* 3 · GIF → mp4 + poster */
  for (const srcAbs of gifs) {
    const relKey = path.relative(MEDIA_SRC, srcAbs).split(path.sep).join("/");
    if (!GIF_TO_MP4.has(relKey)) {
      log("gif  건너뜀 (변환 목록에 없음):", relKey);
      continue;
    }
    const outDir = path.join(OUT_ROOT, path.dirname(relKey));
    await mkdir(outDir, { recursive: true });
    const base = path.basename(relKey, path.extname(relKey));
    const st = await stat(srcAbs);
    originalBytes += st.size;

    const mp4Abs = path.join(outDir, `${base}.mp4`);
    const posterAbs = path.join(outDir, `${base}-poster.jpg`);
    await gifToMp4(srcAbs, mp4Abs);
    await extractPoster(mp4Abs, posterAbs);

    const info = await probe(mp4Abs);
    const mp4Bytes = await fileSize(mp4Abs);
    const posterBytes = await fileSize(posterAbs);
    derivedBytes += mp4Bytes + posterBytes;

    const relOut = (p) =>
      "/" + path.relative(path.join(ROOT, "public"), p).split(path.sep).join("/");

    // 키는 실제로 배포되는 mp4 의 public 경로. 저작 데이터(projects.ts)가
    // 이 경로를 그대로 참조하므로 videos 한 곳만 조회하면 된다.
    manifest.videos[relOut(mp4Abs)] = {
      src: relOut(mp4Abs),
      ...info,
      bytes: mp4Bytes,
      poster: { src: relOut(posterAbs), bytes: posterBytes },
      // 원본 GIF 는 mp4 로 완전히 대체됐고 배포되지 않는다(media-src/).
      fromGif: { src: "media-src/" + relKey, bytes: st.size },
    };
    log("gif→mp4", relKey, `${st.size} → ${mp4Bytes} bytes`);
  }

  /* 4 · mp4 poster */
  for (const srcAbs of mp4s) {
    const relKey = path.relative(SRC_ROOT, srcAbs).split(path.sep).join("/");
    const outDir = path.join(OUT_ROOT, path.dirname(relKey));
    await mkdir(outDir, { recursive: true });
    const base = path.basename(relKey, path.extname(relKey));
    const st = await stat(srcAbs);
    originalBytes += st.size;

    const posterAbs = path.join(outDir, `${base}-poster.jpg`);
    await extractPoster(srcAbs, posterAbs);
    const posterBytes = await fileSize(posterAbs);
    derivedBytes += posterBytes;

    const info = await probe(srcAbs);
    manifest.videos["/projects/" + relKey] = {
      src: "/projects/" + relKey,
      ...info,
      bytes: st.size,
      poster: {
        src: "/" + path.relative(path.join(ROOT, "public"), posterAbs).split(path.sep).join("/"),
        bytes: posterBytes,
      },
    };
    log("mp4 poster", relKey);
  }

  /* 5 · manifest */
  await mkdir(path.dirname(MANIFEST), { recursive: true });
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

  log("─".repeat(52));
  log(`생성 ${created} · 건너뜀 ${skipped} · ${((Date.now() - started) / 1000).toFixed(1)}s`);
  log(`원본  ${(originalBytes / 1e6).toFixed(2)} MB`);
  log(`파생본 ${(derivedBytes / 1e6).toFixed(2)} MB`);
  log(`manifest → ${path.relative(ROOT, MANIFEST)}`);
}

main().catch((err) => {
  console.error("[images] 실패:", err);
  process.exit(1);
});
