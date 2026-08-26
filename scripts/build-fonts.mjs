/**
 * Pretendard 서브셋 빌드 (2-pass, 두 조각으로 나눔)
 *
 * ── 왜 서브셋인가
 *   pretendard 의 dynamic subset 은 92개 조각을 unicode-range 로 나눠 두고
 *   브라우저가 필요한 것만 받게 한다. 그런데 이 페이지의 한글은 유니코드 전역에
 *   흩어져 있어 15개 조각(485KB)이 매칭됐다. 조각마다 별도 요청이라 모바일에서
 *   왕복이 15번이었다. 실제로 쓰는 글자만 담으면 파일 하나로 끝난다.
 *
 * ── 왜 2-pass 인가
 *   "쓰는 글자" 를 소스에서 짐작하면 놓친다. JSX 로 조립되는 문자열, 데이터
 *   파일의 캡션, 인라인된 SVG 텍스트가 전부 다른 곳에 있다. 그래서 빌드된
 *   HTML 에서 뽑는다.
 *
 * ── 왜 두 조각으로 나누는가
 *   안전 여유(상용 한글 + 기본 기호)를 한 파일에 같이 넣으면 94KB 가 더 붙는데,
 *   이 페이지의 LCP 요소가 히어로의 한글 문장이라 폰트가 LCP 임계 경로에 있다.
 *   실측으로 LCP 가 약 440ms 늦고 Lighthouse 모바일이 3점 떨어졌다.
 *
 *   그래서 face 를 둘로 나누고 unicode-range 를 서로 겹치지 않게 준다.
 *     page    지금 이 페이지가 실제로 쓰는 글자 → preload, 항상 받는다
 *     reserve 여유분만 → 그 글자가 화면에 나타나야만 받는다
 *   여유분 글자는 지금 페이지에 없으므로 reserve 는 평소에 요청조차 되지 않는다.
 *   나중에 문구를 고쳐 새 음절이 등장하면 그때 받아서 폴백 없이 렌더된다.
 *   즉 안전망은 그대로 두고 비용만 뺀다.
 *
 * ── pass 구성
 *   pass 1 (prebuild)  직전 빌드가 기록해 둔 분할을 그대로 재사용한다.
 *                      기록이 없으면(최초 빌드) 전부 page 로 넣는다.
 *   next build         HTML 생성. CSS 도 이때 해시가 박힌다.
 *   pass 2 (postbuild) 빌드된 HTML 로 진짜 분할을 계산한다.
 *                      기록과 같으면 고정점 — 끝.
 *                      다르면 갱신하고 빌드를 세운다(한 번 더 돌리면 수렴).
 *
 * 산출물 (전부 gitignore — 재생성 가능)
 *   public/fonts/pretendard-page.woff2
 *   public/fonts/pretendard-reserve.woff2
 *   src/styles/pretendard.generated.css     globals.css 가 import
 *   src/data/generated/font-manifest.json   콜로폰이 실측치로 읽는다
 *   src/data/generated/font-charset.json    다음 pass 의 비교 기준 (앱은 안 읽음)
 */

import { mkdir, readFile, writeFile, rm, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import subsetFont from "subset-font";
import { collectCharset } from "./lib/charset.mjs";
import { collectCodepoints } from "./lib/cmap.mjs";
import { toUnicodeRange } from "./lib/unicode-range.mjs";

const ROOT = process.cwd();
const SRC_TTF = path.join(
  ROOT,
  "node_modules/pretendard/dist/public/variable/PretendardVariable.ttf",
);
const FONT_DIR = path.join(ROOT, "public/fonts");
const OUT_CSS = path.join(ROOT, "src/styles/pretendard.generated.css");
const OUT_MANIFEST = path.join(ROOT, "src/data/generated/font-manifest.json");
/*
 * 분할 기록 = 락파일. 커밋한다.
 *
 * 이게 없으면 pass 1 이 page/reserve 분할을 알 수 없어 전부 page 에 넣고,
 * pass 2 가 진짜 분할을 계산해 빌드를 세운다 — 즉 clone 직후 첫 빌드는 반드시
 * 두 번 돌아야 한다. CI 에서 그건 그냥 실패다.
 * 락파일을 커밋해 두면 pass 1 이 직전 결과에서 출발하므로 한 번에 수렴한다.
 *
 * package-lock.json 과 같은 성격이다: 생성물이지만 빌드 입력이고, 재현성을
 * 위해 저장소에 남긴다. 콘텐츠를 고쳤으면 로컬에서 빌드해 갱신본을 같이 커밋한다.
 * gitignore 되는 src/data/generated/ 밖에 두는 이유도 그래서다.
 */
const OUT_CHARSET = path.join(ROOT, "font-charset.lock.json");

/** SVG 가 font-family 로 하드코딩한 이름. 바뀌면 다이어그램만 폴백으로 떨어진다. */
const FAMILY = "Pretendard";
const WEIGHT_RANGE = "45 920";
/*
 * 파일명에 내용 해시를 넣는다.
 *
 * 이름이 고정이면 immutable 캐시를 걸 수 없다 — 문구를 고쳐 폰트가 바뀌어도
 * 이미 받아간 브라우저는 1년치 캐시를 들고 옛 폰트를 계속 쓴다. 그렇다고
 * 캐시를 짧게 주면 재방문마다 220KB 를 재검증하게 된다.
 * 해시를 넣으면 내용이 바뀔 때 URL 이 바뀌므로 둘 다 해결된다.
 * 고정점 빌드라 같은 콘텐츠에서는 해시도 그대로다.
 */
const hashOf = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 8);
const fontPath = (name, buf) => `/fonts/pretendard-${name}.${hashOf(buf)}.woff2`;

const FROM_BUILD = process.argv.includes("--from-build");
const PASS = FROM_BUILD ? "pass 2" : "pass 1";
const log = (...a) => console.log(`[fonts:${PASS}]`, ...a);
const kb = (n) => (n / 1024).toFixed(1) + "KB";

async function main() {
  const started = Date.now();

  const { chars, required, fromBuild, bySource, email } = await collectCharset({
    root: ROOT,
    includeBuild: FROM_BUILD,
  });

  const ttf = await readFile(SRC_TTF);
  const original = await collectCodepoints(ttf);
  const has = (c) => original.has(c.codePointAt(0));

  /* ── 글자를 세 부류로 나눈다 ──────────────────────────────────
       (1) required    페이지가 실제로 필요한 글자. 빠지면 빌드 실패.
       (2) padding     안전 여유. 없어도 통과. 나중을 위한 보험.
       (3) unavailable 원본 Pretendard 에 애초에 글리프가 없는 글자.
                       서브셋이 잘 돼도 만들 수 없으니 요구 대상에서 뺀다.
                       (3) 이 (1) 과 겹치면 서브셋 문제가 아니라 별개 문제다 —
                       실패로 잡지 않고 목록으로 보고한다. */
  const unavailableRequired = [...required].filter((c) => !has(c));
  const unavailablePadding = [...chars].filter((c) => !has(c) && !required.has(c));

  /* ── page / reserve 분할 ───────────────────────────────────── */
  const record = await readJson(OUT_CHARSET);
  let pageChars;
  if (FROM_BUILD) {
    // 빌드된 HTML 이 있으니 진짜 분할을 계산할 수 있다.
    pageChars = new Set([...required].filter(has));
  } else if (record?.page) {
    // 직전 빌드가 알아낸 분할을 재사용한다. CSS 가 pass 간에 흔들리지 않아야
    // next build 가 박은 CSS 해시와 out/ 의 내용이 어긋나지 않는다.
    pageChars = new Set([...record.page].filter(has));
  } else {
    // 최초 빌드 — 아는 게 없으니 전부 page 로. pass 2 가 바로잡는다.
    pageChars = new Set([...chars].filter(has));
  }
  const reserveChars = new Set([...chars].filter((c) => has(c) && !pageChars.has(c)));

  /* ── 서브셋 생성 ───────────────────────────────────────────── */
  const pageFont = await subsetFont(ttf, [...pageChars].join(""), { targetFormat: "woff2" });
  const reserveFont = reserveChars.size
    ? await subsetFont(ttf, [...reserveChars].join(""), { targetFormat: "woff2" })
    : null;

  /* ── 되읽기 검증 ───────────────────────────────────────────────
     넘긴 글자 목록이 아니라 "생성된 폰트가 실제로 담고 있는" 코드포인트로
     확인한다. 그러지 않으면 검증이 동어반복이 된다. */
  const pageCov = await collectCodepoints(pageFont);
  const reserveCov = reserveFont ? await collectCodepoints(reserveFont) : new Set();

  const dropped = [...required].filter(
    (c) => has(c) && !pageCov.has(c.codePointAt(0)) && !reserveCov.has(c.codePointAt(0)),
  );
  if (dropped.length > 0) {
    throw new Error(
      `원본에는 있는데 어느 조각에도 안 들어간 글자 ${dropped.length}개: ` +
        `${JSON.stringify(dropped.join(""))}\nharfbuzz 서브셋 단계의 버그다.`,
    );
  }

  /* unicode-range 가 겹치면 나중 선언이 이겨서 앞 face 가 통째로 무시된다.
     두 조각이 서로 배타적이어야 이 설계가 성립한다. */
  const overlap = [...pageCov].filter((cp) => reserveCov.has(cp));
  if (overlap.length > 0) {
    throw new Error(
      `page 와 reserve 의 unicode-range 가 ${overlap.length}자 겹친다: ` +
        JSON.stringify(overlap.slice(0, 20).map((c) => String.fromCodePoint(c)).join("")),
    );
  }

  await assertVariable(pageFont, "page");
  if (reserveFont) await assertVariable(reserveFont, "reserve");

  /* ── 고정점 판정 ───────────────────────────────────────────── */
  const pageStr = [...pageChars].sort().join("");
  const reserveStr = [...reserveChars].sort().join("");
  let staleBuild = false;
  if (FROM_BUILD && record) {
    const same =
      [...(record.page ?? "")].sort().join("") === pageStr &&
      [...(record.reserve ?? "")].sort().join("") === reserveStr;
    if (!same) {
      staleBuild = true;
      const known = new Set([...(record.page ?? "")]);
      const novel = [...pageChars].filter((c) => !known.has(c));
      log(
        novel.length
          ? `pass 1 의 page 집합이 놓친 글자 ${novel.length}개: ${JSON.stringify(novel.join(""))}`
          : "page/reserve 분할이 직전 기록과 다르다",
      );
    }
  }

  /* ── 쓰기 ──────────────────────────────────────────────────── */
  const PAGE_PATH = fontPath("page", pageFont);
  const RESERVE_PATH = reserveFont ? fontPath("reserve", reserveFont) : null;

  await mkdir(FONT_DIR, { recursive: true });
  await mkdir(path.dirname(OUT_CSS), { recursive: true });
  await mkdir(path.dirname(OUT_MANIFEST), { recursive: true });
  await rm(path.join(FONT_DIR, "pretendard"), { recursive: true, force: true });

  await writeFile(path.join(FONT_DIR, path.basename(PAGE_PATH)), pageFont);
  if (reserveFont) {
    await writeFile(path.join(FONT_DIR, path.basename(RESERVE_PATH)), reserveFont);
  }
  // 해시가 바뀌면 옛 파일이 남는다. 지워야 public/ 이 무한히 자라지 않는다.
  await pruneFonts(FONT_DIR, [PAGE_PATH, RESERVE_PATH]);
  await writeFile(OUT_CSS, css(pageCov, reserveCov, PAGE_PATH, RESERVE_PATH));

  const hangulIn = (set) =>
    [...set].filter((c) => {
      const cp = typeof c === "number" ? c : c.codePointAt(0);
      return cp >= 0xac00 && cp <= 0xd7a3;
    }).length;

  const manifest = {
    _generated: "scripts/build-fonts.mjs — 직접 수정하지 말 것",
    pass: FROM_BUILD ? 2 : 1,
    family: FAMILY,
    sourceBytes: ttf.length,
    page: {
      path: PAGE_PATH,
      bytes: pageFont.length,
      glyphs: pageCov.size,
      hangul: hangulIn(pageCov),
    },
    reserve: {
      path: RESERVE_PATH ?? null,
      bytes: reserveFont?.length ?? 0,
      glyphs: reserveCov.size,
      hangul: hangulIn(reserveCov),
    },
    /* Pretendard 에 아예 없어 폴백으로 갈 글자. 0 이 아니면 화면에서 그 글자만
       다른 폰트로 보인다는 뜻이니 눈에 띄게 남겨 둔다. */
    unavailableRequired: unavailableRequired.join(""),
    unavailableInBody: unavailableRequired.filter((c) => fromBuild.has(c)).join(""),
    bySource,
  };
  await writeFile(OUT_MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  await writeFile(
    OUT_CHARSET,
    JSON.stringify({ _generated: "scripts/build-fonts.mjs", page: pageStr, reserve: reserveStr }, null, 2) + "\n",
  );

  /* ── 보고 ──────────────────────────────────────────────────── */
  log(
    `page ${kb(pageFont.length)} · 글리프 ${pageCov.size} (한글 ${hangulIn(pageCov)}) — preload 대상`,
  );
  log(
    reserveFont
      ? `reserve ${kb(reserveFont.length)} · 글리프 ${reserveCov.size} (한글 ${hangulIn(reserveCov)}) — 그 글자가 나타나야만 요청됨`
      : "reserve 없음",
  );
  log(`출처별 증분 ${JSON.stringify(bySource)}`);
  log(`이메일 복원 확인: ${email}`);
  if (unavailablePadding.length > 0) {
    log(
      `여유분 중 Pretendard 에 글리프가 없어 제외 ${unavailablePadding.length}개 (무해): ` +
        JSON.stringify(unavailablePadding.join("")),
    );
  }
  if (unavailableRequired.length > 0) {
    const inBody = unavailableRequired.filter((c) => fromBuild.has(c));
    const elsewhere = unavailableRequired.filter((c) => !fromBuild.has(c));
    log(`⚠ Pretendard 에 글리프가 없는 글자 ${unavailableRequired.length}개 — 서브셋으로 해결 불가`);
    if (inBody.length) log(`  · 페이지 본문에 실제로 쓰임 (폴백 렌더 중): ${JSON.stringify(inBody.join(""))}`);
    if (elsewhere.length) log(`  · HTML 밖(다이어그램/번들 JS/이메일): ${JSON.stringify(elsewhere.join(""))}`);
  }
  log(`${Date.now() - started}ms`);

  /* pass 2 는 next build 뒤에 돈다. next build 가 이미 public/ 을 out/ 으로
     복사했으므로, 폰트가 바뀌었다면 out/ 의 것은 옛 파일이다.
     "고정점이면 어차피 같다" 고 가정하지 말고 바이트로 확인한다. */
  if (FROM_BUILD) {
    for (const [rel, buf] of [
      [PAGE_PATH.slice(1), pageFont],
      ...(reserveFont ? [[RESERVE_PATH.slice(1), reserveFont]] : []),
    ]) {
      const dest = path.join(ROOT, "out", rel);
      const existing = await readFile(dest).catch(() => null);
      if (!existing) {
        await mkdir(path.dirname(dest), { recursive: true });
        await writeFile(dest, buf);
        log(`out/${rel} 없어서 새로 넣었다`);
        staleBuild = true;
      } else if (!existing.equals(buf)) {
        await writeFile(dest, buf);
        log(`out/${rel} 갱신 (${kb(existing.length)} → ${kb(buf.length)})`);
        staleBuild = true;
      } else {
        log(`out/${rel} 바이트 동일 — 고정점 ✓`);
      }
    }
    await pruneFonts(path.join(ROOT, "out/fonts"), [PAGE_PATH, RESERVE_PATH]);
  }

  if (staleBuild) {
    throw new Error(
      "폰트 분할이 font-charset.lock.json 과 다르다 — 락파일을 갱신했다.\n" +
        "  이미 만들어진 HTML 은 옛 분할 기준의 콜로폰 실측치와 CSS 해시를 담고 있어\n" +
        "  그대로 배포하면 숫자가 거짓이 된다. `npm run build` 를 한 번 더 돌리면\n" +
        "  고정점에 든다. 갱신된 font-charset.lock.json 을 함께 커밋할 것.",
    );
  }
}

/**
 * 서브셋 후에도 variable 인지 확인한다.
 * fvar 가 날아가면 font-weight: 45 920 선언이 남아 있어도 전부 한 굵기로
 * 렌더된다 — 화면상 "폰트가 좀 이상한데" 로만 보이고 에러는 안 난다.
 */
async function assertVariable(woff2, label) {
  const fontverter = (await import("fontverter")).default;
  const ttf = Buffer.from(await fontverter.convert(woff2, "truetype"));
  const numTables = ttf.readUInt16BE(4);
  const tags = [];
  for (let i = 0; i < numTables; i++) tags.push(ttf.toString("latin1", 12 + i * 16, 16 + i * 16));
  if (!tags.includes("fvar")) {
    throw new Error(`${label} 조각에 fvar 축이 없다 — variable 이 아니게 됐다.`);
  }
}

/** 현재 해시에 해당하지 않는 옛 폰트 파일을 지운다. */
async function pruneFonts(dir, keepPaths) {
  const keep = new Set(keepPaths.filter(Boolean).map((p) => path.basename(p)));
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (!/^pretendard.*\.woff2$/.test(name)) continue;
    if (keep.has(name)) continue;
    await rm(path.join(dir, name), { force: true });
  }
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

function css(pageCov, reserveCov, PAGE_PATH, RESERVE_PATH) {
  const face = (pathname, range, note) => `
/* ${note} */
@font-face {
	font-family: '${FAMILY}';
	font-style: normal;
	font-display: swap;
	font-weight: ${WEIGHT_RANGE};
	src: url(${pathname}) format('woff2');
	unicode-range: ${range};
}
`;

  return `/* 생성 파일 — scripts/build-fonts.mjs. 직접 수정하지 말 것. */
/*
Copyright (c) 2021 Kil Hyung-jin, with Reserved Font Name Pretendard.
https://github.com/orioncactus/pretendard
SIL Open Font License 1.1 — http://scripts.sil.org/OFL
원본을 이 사이트가 쓰는 글자만 남기고 서브셋한 것이다.

두 조각의 unicode-range 는 서로 겹치지 않는다. 겹치면 나중 선언이 이겨서
앞 face 가 통째로 무시되므로, build-fonts.mjs 가 매 빌드마다 배타성을 검사한다.

어느 쪽에도 없는 글자는 브라우저가 글자 단위로 시스템 폰트로 떨어뜨린다
(두부가 아니라 모양이 조금 다른 글자). 즉 서브셋이 놓쳐도 페이지는 읽힌다.
대신 그 상태로 배포되지 않도록 scripts/verify-fonts.mjs 가 빌드를 세운다.
*/
${face(PAGE_PATH, toUnicodeRange(pageCov), "이 페이지가 실제로 쓰는 글자. preload 로 미리 받는다.")}${
    reserveCov.size
      ? face(
          RESERVE_PATH,
          toUnicodeRange(reserveCov),
          "안전 여유분. 이 범위의 글자가 화면에 나타날 때만 요청된다 —\n   지금은 아무 글자도 해당하지 않으므로 받지 않는다.",
        )
      : ""
  }`;
}

main().catch((err) => {
  console.error(`[fonts:${PASS}] 실패:`, err.message ?? err);
  process.exit(1);
});
