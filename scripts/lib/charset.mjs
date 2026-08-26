/**
 * 서브셋에 넣을 글자 집합을 모은다.
 *
 * 원칙: 렌더될 가능성이 있으면 넣는다. 한 글자가 빠지면 그 글자만 폴백 폰트로
 * 떨어져 폭이 튀는데, 한 글자를 더 넣는 비용은 약 0.15KB 다. 비대칭이 크므로
 * 과하게 모으는 쪽으로 판단한다.
 *
 * 출처 (pass 1 = 소스, pass 2 = 소스 + 빌드 산출물):
 *   1. src 전체            — 아직 렌더되지 않는 분기·주석의 어휘까지 포함
 *   2. public/diagrams/*.svg — 인라인되므로 HTML 에도 들어가지만 독립 확인
 *   3. JS 로 조립되는 이메일 — HTML 에 평문이 없어 추출로는 절대 안 잡힌다
 *   4. 기본 라틴 · 숫자 · 문장부호 · 타이포그래피 기호
 *   5. 상용 한글 음절 (안전 여유)
 *   6. out/**.html, out/**.txt — 빌드된 결과의 모든 글자 (pass 2 전용)
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

/**
 * 항상 넣는 기본 범위. 문구를 고쳐도 라틴·숫자·기호에서는 절대 안 깨지게.
 *
 * 괘선 문자(─│┌┐└┘├┤┬┴┼)와 ⇄⇅⇆ ∈∘⋅ 는 일부러 뺐다 — Pretendard 에 글리프가
 * 없어서 요청해봐야 서브셋에 안 들어간다. 소스 주석의 구분선 아트에나 쓰이지
 * 화면 타이포그래피가 아니다. 혹시 빠뜨린 게 더 있어도 아래 파이프라인이
 * 원본 cmap 과 대조해 자동으로 걸러내므로 이 목록은 "의도" 만 적으면 된다.
 */
const BASELINE = [
  // ASCII 인쇄 가능 문자 전체 (U+0020–U+007E)
  range(0x20, 0x7e),
  // Latin-1 Supplement 중 문자·기호 (© ° × ÷ é 등)
  range(0xa0, 0xff),
  // 타이포그래피: 대시 · 인용부호 · 말줄임 · 가운뎃점 · 각주 기호
  "‐‑‒–—―‖‘’‚‛“”„†‡•‥…‰′″‹›※‼⁄",
  // 화살표 — 다이어그램과 본문 양쪽에서 쓴다
  "←↑→↓↔↕⇒⇔↗↘↙↖",
  // 수학·측정 기호 — 지표 배지에서 쓸 수 있는 것들
  "±×÷≈≠≤≥∞√∑∆·‱%‰",
  // 통화 · 단위
  "₩$€£¥¢°㎏㎜㎝㎞㎡㎥㎳㎲㎈",
  // 괄호류 (다이어그램 캡션)
  "「」『』〈〉《》【】〔〕―",
  // 한글 호환 자모 — "ㅇㅇ", "ㄱ" 같은 단독 자모 표기
  range(0x3131, 0x3163),
].join("");

function range(from, to) {
  let s = "";
  for (let c = from; c <= to; c++) s += String.fromCodePoint(c);
  return s;
}

/** 텍스트 파일로 취급할 확장자. 바이너리를 읽어 쓰레기 코드포인트를 넣지 않는다. */
const TEXT_EXT = new Set([".ts", ".tsx", ".css", ".json", ".mjs", ".js", ".md"]);

async function walk(dir, keep, acc = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      await walk(p, keep, acc);
    } else if (keep(e.name)) {
      acc.push(p);
    }
  }
  return acc;
}

async function readAll(files) {
  return (await Promise.all(files.map((f) => readFile(f, "utf8")))).join("\n");
}

/**
 * HTML/JS 안에서 이스케이프된 채로 들어있는 글자를 되살린다.
 *
 * 빌드된 HTML 에는 RSC 페이로드가 통째로 박혀 있는데, 거기의 한글은 상황에 따라
 * 그대로일 수도, `가` 이나 `&#44032;` 형태일 수도 있다. 이스케이프된 형태만
 * 있고 원문이 없는 글자를 놓치면 그 글자가 서브셋에서 빠진다.
 */
function unescapeAll(text) {
  let out = text;
  out += text.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
    String.fromCharCode(parseInt(h, 16)),
  );
  out += text.replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (_, h) =>
    String.fromCodePoint(parseInt(h, 16)),
  );
  out += text.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
  out += text.replace(/&#x([0-9a-fA-F]+);/gi, (_, h) =>
    String.fromCodePoint(parseInt(h, 16)),
  );
  return out;
}

/**
 * 번들된 JS 에서 문자열 리터럴만 뽑는다.
 *
 * 파일 전체를 글자 단위로 훑으면 안 된다. 압축된 번들에는 정규식 문자 클래스가
 * 잔뜩 들어 있고(`/[\u0370-\u037D]/` 같은 식별자 검증용), 거기 적힌 경계값까지
 * "화면에 나올 글자" 로 세면 page 조각이 헛되이 커지고 "원본에 글리프 없음"
 * 경고가 쓰레기로 뒤덮여 진짜 신호가 묻힌다.
 *
 * 실제로 렌더될 수 있는 건 문자열 리터럴 안의 글자다. 정규식 리터럴은 따옴표로
 * 감싸이지 않으므로 이 방식에서 자연히 빠진다.
 */
function stringLiterals(js) {
  const out = [];
  const re = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g;
  for (const m of js.matchAll(re)) out.push(unescapeAll(m[0]));

  /* 리터럴만 골라도 노이즈가 남는다. 유니코드 블록 경계값을 문자열로 적어 두고
     런타임에 정규식을 만드는 코드가 프레임워크 안에 있어서, `"\u0870-\u088E"`
     같은 문자열의 양 끝 글자가 딸려 온다.

     JS 를 뒤지는 목적은 "런타임에 조립되는 한글 UI 문자열"(테마 토글 title 등)을
     잡는 것 하나다. 라틴·숫자·문장부호는 baseline 이 이미 전부 덮고 있으므로
     한글만 남겨도 잃는 것이 없고, 대신 경계값 쓰레기가 사라진다. */
  const isHangul = (cp) =>
    (cp >= 0xac00 && cp <= 0xd7a3) || // 음절
    (cp >= 0x1100 && cp <= 0x11ff) || // 자모
    (cp >= 0x3130 && cp <= 0x318f); // 호환 자모

  return [...out.join("")].filter((c) => isHangul(c.codePointAt(0))).join("");
}

/**
 * JS 로 조립되는 이메일 주소를 소스에서 직접 복원한다.
 *
 * 이 문자열은 정적 HTML 어디에도 평문으로 없다(그게 목적이다). 즉 빌드 산출물
 * 추출로는 원리적으로 안 잡히므로 여기서만 확보할 수 있다. 소스의 모양이
 * 바뀌면 조용히 건너뛰지 말고 빌드를 세운다 — 조용한 실패가 정확히 이 파이프라인의
 * 위험이기 때문이다.
 */
async function decodeObfuscatedEmail(root) {
  const file = path.join(root, "src/components/site/obfuscated-email.tsx");
  const src = await readFile(file, "utf8");
  const offset = src.match(/const OFFSET = (\d+);/);
  const codes = src.match(/const CODES = \[([\s\S]*?)\];/);
  if (!offset || !codes) {
    throw new Error(
      `이메일 난독화 코드의 모양이 바뀌었다 (${path.relative(root, file)}). ` +
        `OFFSET / CODES 를 못 찾음 — scripts/lib/charset.mjs 를 같이 고칠 것.`,
    );
  }
  const nums = codes[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
  if (nums.some(Number.isNaN)) throw new Error("CODES 파싱 실패");
  const decoded = nums
    .map((n) => String.fromCharCode(n - Number(offset[1])))
    .join("");
  if (!decoded.includes("@")) {
    throw new Error(`이메일 복원 결과가 주소 같지 않다: ${JSON.stringify(decoded)}`);
  }
  return decoded;
}

/**
 * @param {object} opts
 * @param {string} opts.root 프로젝트 루트
 * @param {boolean} opts.includeBuild out/ 을 포함할지 (pass 2 여부)
 * @returns {Promise<{chars: string, bySource: Record<string, number>, email: string}>}
 */
export async function collectCharset({ root, includeBuild }) {
  const { COMMON_HANGUL } = await import("./hangul-common.mjs");

  /* font-manifest.json 은 이 스크립트의 산출물이고 이전 회차의 글자 집합을
     통째로 들고 있다. 그걸 다시 입력으로 읽으면 자기 출력을 먹는 되먹임이 되어,
     한 번 들어온 글자가 문구를 지워도 영원히 안 빠진다. 반드시 제외한다. */
  const srcFiles = (
    await walk(path.join(root, "src"), (n) => TEXT_EXT.has(path.extname(n)))
  ).filter((f) => !/^font-(manifest|charset)\.json$/.test(path.basename(f)));
  const svgFiles = await walk(path.join(root, "public/diagrams"), (n) =>
    n.endsWith(".svg"),
  );

  const email = await decodeObfuscatedEmail(root);

  /* 순서가 보고서를 좌우한다. "실제로 렌더되는 것" 을 먼저 세고 그 다음에
     안전 여유를 세야, 여유가 얼마를 더 얹고 있는지가 증분으로 드러난다. */
  const required = [];

  if (includeBuild) {
    const htmlFiles = await walk(
      path.join(root, "out"),
      (n) => n.endsWith(".html") || n.endsWith(".txt"),
    );
    if (htmlFiles.length === 0) {
      throw new Error("out/ 에 HTML 이 없다 — `next build` 를 먼저 돌려야 한다");
    }
    required.push(["build-html", unescapeAll(await readAll(htmlFiles))]);

    /* 번들된 JS 도 읽는다.
       화면에 뜨는 글자가 전부 HTML 에 있는 건 아니다. 테마 토글의
       title="시스템 설정 따름 (현재 다크)" 처럼 런타임에 조립되는 문자열은
       정적 HTML 어디에도 없다가 하이드레이션 후에 나타난다. 그런 글자를
       놓치면 그것만 폴백 폰트로 떨어진다.
       프로덕션 번들은 압축돼 있어 주석이 없고, 한글은 문자열 리터럴에만
       남으므로 여기서 걷어내는 것이 실제로 렌더될 수 있는 글자와 거의 일치한다. */
    const jsFiles = await walk(path.join(root, "out/_next"), (n) => n.endsWith(".js"));
    required.push(["build-js", stringLiterals(await readAll(jsFiles))]);
  }
  required.push(["diagrams", await readAll(svgFiles)]);
  required.push(["email", email]);

  /* src 는 "여유" 로 분류한다. 여기엔 렌더되는 문자열도 있지만 주석도 통째로
     들어있고(괘선 아트 ── 같은 것), 그건 화면에 안 나온다. 렌더되는 쪽은 어차피
     build-html 이 잡으므로, src 를 필수로 올리면 주석의 장식 문자 때문에
     빌드가 서는 잘못된 게이트가 된다. 대신 어휘 여유분으로는 그대로 쓴다. */
  const padding = [
    ["src", await readAll(srcFiles)],
    ["baseline", BASELINE],
    ["common-hangul", COMMON_HANGUL],
  ];
  const parts = [...required, ...padding];
  const requiredNames = new Set(required.map(([n]) => n));

  /* 출처별 "새로 추가한 글자 수" 를 센다. 총합이 아니라 증분이라
     각 출처가 실제로 기여하는 바를 볼 수 있다. */
  const seen = new Set();
  const requiredChars = new Set();
  const fromBuild = new Set();
  const bySource = {};
  for (const [name, text] of parts) {
    let added = 0;
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      // 제어문자·서로게이트·BOM 은 글리프가 아니다.
      if (cp < 0x20 || (cp >= 0x7f && cp <= 0x9f) || cp === 0xfeff) continue;
      if (requiredNames.has(name)) requiredChars.add(ch);
      if (name === "build-html") fromBuild.add(ch);
      if (!seen.has(ch)) {
        seen.add(ch);
        added++;
      }
    }
    bySource[name] = added;
  }

  return {
    chars: [...seen].join(""),
    // 빠지면 지금 당장 페이지가 깨지는 글자. 검증의 실패 기준은 이쪽이다.
    required: requiredChars,
    /* 빌드된 HTML 에 실제로 들어 있는 글자. required 의 부분집합이지만
       따로 들고 있어야 "원본 폰트에 없는 글자가 화면 본문에 쓰이는지" 를
       다이어그램·이메일과 구분해 보고할 수 있다. */
    fromBuild,
    bySource,
    email,
  };
}

export { BASELINE };
