/**
 * 서브셋 폰트 검증 — 실제 브라우저에서 폴백으로 떨어진 글자가 있는지 본다.
 *
 * 왜 정적 검사만으로 부족한가
 *   build-fonts.mjs 는 "빌드된 HTML 에서 뽑은 글자" 가 서브셋에 들어갔는지 본다.
 *   그런데 화면에 뜨는 글자가 전부 HTML 에 있는 건 아니다 — 이메일은 JS 가
 *   조립하고, ::before/::after 는 CSS 가 만들고, 하이드레이션 뒤에 바뀌는
 *   문구도 있다. 그래서 진짜로 렌더된 뒤의 DOM 을 기준으로 다시 확인한다.
 *
 * 세 가지를 본다
 *   (A) 렌더된 DOM 의 모든 글자 vs 서브셋 cmap
 *       — 추출 단계가 놓친 글자를 잡는다. 판정 기준은 폰트 파일의 실제 cmap.
 *   (B) CDP CSS.getPlatformFontsForNode
 *       — "이 노드를 그리는 데 실제로 쓰인 폰트" 를 브라우저에게 직접 묻는다.
 *         추측이 아니라 렌더러의 답이라 이게 가장 확실한 신호다.
 *   (C) document.fonts.check
 *       — 위 둘의 교차 확인.
 *
 * 실패하면 종료 코드 1 → 빌드 중단.
 */

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { collectCodepoints } from "./lib/cmap.mjs";

const ROOT = process.cwd();
const PORT = Number(process.env.VERIFY_PORT ?? 8799);
const URL = `http://127.0.0.1:${PORT}/`;
/* 폰트 파일명엔 내용 해시가 붙으므로 경로를 매니페스트에서 읽는다. */
const manifest = JSON.parse(
  await readFile(path.join(ROOT, "src/data/generated/font-manifest.json"), "utf8"),
);
const PAGE_WOFF2 = path.join(ROOT, "out", manifest.page.path);
const RESERVE_WOFF2 = manifest.reserve.path
  ? path.join(ROOT, "out", manifest.reserve.path)
  : null;
const FAMILY = "Pretendard";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

const log = (...a) => console.log("[verify-fonts]", ...a);

async function findChrome() {
  const { access } = await import("node:fs/promises");
  for (const p of CHROME_CANDIDATES) {
    try {
      await access(p);
      return p;
    } catch {}
  }
  throw new Error(
    `Chrome 을 못 찾았다. CHROME_PATH 로 지정할 것. 시도: ${CHROME_CANDIDATES.join(", ")}`,
  );
}

function startServer() {
  const child = spawn(
    process.execPath,
    [path.join(ROOT, "scripts/serve-static.mjs"), path.join(ROOT, "out"), String(PORT)],
    { stdio: ["ignore", "pipe", "inherit"] },
  );
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("정적 서버가 안 떴다")), 10000);
    child.stdout.on("data", (d) => {
      if (d.toString().includes("serving")) {
        clearTimeout(t);
        resolve(child);
      }
    });
    child.on("exit", (c) => reject(new Error(`정적 서버 종료 (code ${c})`)));
  });
}

/**
 * 브라우저 안에서 실행 — 렌더된 DOM 의 글자를 전부 긁는다.
 * Node 스코프를 닫아 잡을 수 없으므로 패밀리명은 인자로 받는다.
 */
function collectRenderedChars(family) {
  const chars = new Map(); // char -> 처음 발견된 문맥

  const note = (text, context) => {
    if (!text) return;
    for (const ch of String(text)) {
      const cp = ch.codePointAt(0);
      if (cp < 0x20 || (cp >= 0x7f && cp <= 0x9f)) continue;
      if (!chars.has(ch)) chars.set(ch, context);
    }
  };

  // 1. 텍스트 노드 — script/style 안은 렌더되지 않으므로 제외
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const tag = node.parentElement?.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEMPLATE") {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    note(n.nodeValue, `<${el?.tagName.toLowerCase()}> ${(n.nodeValue ?? "").trim().slice(0, 40)}`);
  }

  // 2. 화면에 안 보여도 보조기술이 읽거나 툴팁으로 뜨는 속성값
  const ATTRS = ["alt", "aria-label", "title", "placeholder", "aria-description", "aria-roledescription"];
  for (const el of document.querySelectorAll("*")) {
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v) note(v, `<${el.tagName.toLowerCase()} ${a}="${v.slice(0, 40)}">`);
    }
  }

  // 3. CSS 가 만들어내는 글자 (::before / ::after content)
  for (const el of document.querySelectorAll("*")) {
    for (const pseudo of ["::before", "::after"]) {
      const c = getComputedStyle(el, pseudo).content;
      if (c && c !== "none" && c !== "normal") {
        note(c.replace(/^["']|["']$/g, ""), `${el.tagName.toLowerCase()}${pseudo}`);
      }
    }
  }

  // 4. document.fonts.check 교차 확인
  const uncheckable = [];
  for (const ch of chars.keys()) {
    if (!document.fonts.check(`16px "${family}"`, ch)) uncheckable.push(ch);
  }

  return {
    chars: [...chars.entries()].map(([ch, ctx]) => [ch, ctx]),
    fontsCheckFailed: uncheckable,
    fontFaces: [...document.fonts].map((f) => ({
      family: f.family,
      status: f.status,
      weight: f.weight,
    })),
  };
}

async function main() {
  const pageFont = await readFile(PAGE_WOFF2).catch(() => {
    throw new Error(`${path.relative(ROOT, PAGE_WOFF2)} 가 없다 — 빌드 순서를 확인할 것`);
  });
  const reserveFont = RESERVE_WOFF2 ? await readFile(RESERVE_WOFF2).catch(() => null) : null;
  const pageCov = await collectCodepoints(pageFont);
  const reserveCov = reserveFont ? await collectCodepoints(reserveFont) : new Set();
  /* 렌더된 글자는 page 조각으로 전부 커버돼야 한다. reserve 로 커버된다는 건
     "지금 페이지에 없어야 할 글자" 가 화면에 있다는 뜻이라 분할이 틀린 것이다. */
  const covered = pageCov;
  log(
    `page cmap ${pageCov.size}자 · ${(pageFont.length / 1024).toFixed(1)}KB | ` +
      `reserve ${reserveCov.size}자 · ${((reserveFont?.length ?? 0) / 1024).toFixed(1)}KB`,
  );

  const server = await startServer();
  let browser;
  const failures = [];

  try {
    browser = await puppeteer.launch({
      executablePath: await findChrome(),
      headless: true,
      args: ["--no-sandbox", "--disable-gpu", "--font-render-hinting=none"],
    });
    const page = await browser.newPage();
    const requested = [];
    page.on("request", (r) => requested.push(r.url()));
    // 모바일 폭에서도 확인 — 반응형으로 다른 문구가 뜰 수 있다.
    await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2 });

    const client = await page.createCDPSession();
    await client.send("DOM.enable");
    await client.send("CSS.enable");

    await page.goto(URL, { waitUntil: "networkidle0", timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    // 하이드레이션 뒤에 바뀌는 것(이메일 조립)까지 반영되도록 한 틱 더 준다.
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );

    /* ── (A) 렌더된 글자 vs 서브셋 cmap ─────────────────────── */
    const result = await page.evaluate(collectRenderedChars, FAMILY);
    log(`렌더된 고유 글자 ${result.chars.length}개 · @font-face ${result.fontFaces.length}개`);

    const missing = result.chars.filter(([ch]) => !covered.has(ch.codePointAt(0)));
    if (missing.length > 0) {
      failures.push(
        `(A) 렌더되는데 서브셋에 없는 글자 ${missing.length}개:\n` +
          missing.map(([ch, ctx]) => `      ${JSON.stringify(ch)}  ${ctx}`).join("\n"),
      );
    } else {
      log("(A) 렌더된 모든 글자가 서브셋 cmap 안에 있다 ✓");
    }

    /* ── (B) 렌더러가 실제로 쓴 폰트 ─────────────────────────── */
    /*
     * CSS.getPlatformFontsForNode 는 "그 노드의 직계 텍스트 자식" 을 그린 폰트만
     * 돌려준다. <body> 에 걸면 직계 텍스트가 공백뿐이라 빈 배열이 오고, 그걸
     * "폴백 없음" 으로 읽으면 검증이 통과한 척만 한다. 그래서 텍스트를 직접
     * 가진 엘리먼트를 전부 훑어 합산한다.
     */
    const { root } = await client.send("DOM.getDocument", { depth: -1 });
    const { nodeIds } = await client.send("DOM.querySelectorAll", {
      nodeId: root.nodeId,
      selector: "body, body *",
    });

    const byFamily = new Map();
    const offenders = [];
    for (const nodeId of nodeIds) {
      let fonts;
      try {
        ({ fonts } = await client.send("CSS.getPlatformFontsForNode", { nodeId }));
      } catch {
        continue; // 레이아웃에서 빠진 노드 등
      }
      for (const f of fonts) {
        if (f.glyphCount <= 0) continue;
        const prev = byFamily.get(f.familyName) ?? { glyphCount: 0, isCustomFont: f.isCustomFont };
        prev.glyphCount += f.glyphCount;
        byFamily.set(f.familyName, prev);
      }
      const bad = fonts.filter((f) => f.glyphCount > 0 && !isExpectedFamily(f.familyName));
      if (bad.length > 0 && offenders.length < 12) {
        offenders.push({ nodeId, bad });
      }
    }

    const total = [...byFamily.values()].reduce((a, f) => a + f.glyphCount, 0);

    /* 측정 자체가 실패했으면 "이상 없음" 이 아니라 "확인 못 함" 이다.
       빈 결과를 통과로 처리하면 이 검증은 아무것도 지켜주지 않는다. */
    if (total === 0) {
      failures.push(
        "(B) CDP 가 렌더에 쓰인 폰트를 하나도 보고하지 않았다 — 검증이 성립하지 않는다.\n" +
          "      (페이지가 안 떴거나 CDP 사용법이 잘못됐다. 통과로 처리하지 않는다.)",
      );
    } else {
      log(`(B) 실제 렌더에 쓰인 폰트 (총 ${total.toLocaleString("ko-KR")} 글리프):`);
      for (const [name, f] of [...byFamily].sort((a, b) => b[1].glyphCount - a[1].glyphCount)) {
        const pct = ((f.glyphCount / total) * 100).toFixed(1);
        log(
          `      ${name.padEnd(30)} ${String(f.glyphCount).padStart(6)} 글리프 (${pct.padStart(5)}%) ` +
            `${f.isCustomFont ? "웹폰트" : "시스템"}`,
        );
      }
      const unexpected = [...byFamily].filter(([name]) => !isExpectedFamily(name));
      if (unexpected.length > 0) {
        const detail = [];
        for (const { nodeId, bad } of offenders) {
          let desc = `nodeId ${nodeId}`;
          try {
            const { outerHTML } = await client.send("DOM.getOuterHTML", { nodeId });
            desc = outerHTML.replace(/\s+/g, " ").slice(0, 110);
          } catch {}
          detail.push(`${desc}  ← ${bad.map((f) => `${f.familyName}(${f.glyphCount})`).join(", ")}`);
        }
        failures.push(
          `(B) 폴백 폰트로 렌더된 글리프가 있다:\n` +
            unexpected
              .map(([name, f]) => `      ${name} — ${f.glyphCount} 글리프`)
              .join("\n") +
            (detail.length ? `\n    해당 노드:\n${detail.map((d) => `      ${d}`).join("\n")}` : ""),
        );
      } else {
        log("(B) 폴백 폰트로 떨어진 글리프 없음 ✓");
      }
    }

    /* ── (D) reserve 조각이 요청되지 않았는지 ────────────────────
       이 분할의 전제는 "여유분 글자는 지금 페이지에 없다" 이다.
       reserve 가 요청됐다면 전제가 깨진 것이고, 그만큼 초기 로드가 늘었다. */
    const reserveHits = requested.filter((u) => u.includes("pretendard-reserve"));
    const pageHits = requested.filter((u) => u.includes(path.basename(manifest.page.path)));
    if (pageHits.length === 0) {
      failures.push("(D) page 조각이 요청되지 않았다 — preload/CSS 경로를 확인할 것");
    } else if (reserveHits.length > 0) {
      failures.push(
        `(D) reserve 조각이 ${reserveHits.length}번 요청됐다. 여유분 글자가 화면에 ` +
          `나타났다는 뜻이다 — 다음 빌드에서 page 로 옮겨가야 한다.`,
      );
    } else {
      log(`(D) page 조각만 요청됨 · reserve 는 요청 없음 ✓`);
    }

    /* ── (C) document.fonts.check 교차 확인 ──────────────────── */
    if (result.fontsCheckFailed.length > 0) {
      failures.push(
        `(C) document.fonts.check 가 Pretendard 로 못 그린다고 답한 글자 ` +
          `${result.fontsCheckFailed.length}개: ${JSON.stringify(result.fontsCheckFailed.join(""))}`,
      );
    } else {
      log("(C) document.fonts.check 전부 통과 ✓");
    }
  } finally {
    if (browser) await browser.close();
    server.kill();
  }

  if (failures.length > 0) {
    console.error("\n[verify-fonts] 실패\n");
    for (const f of failures) console.error("  " + f + "\n");
    console.error(
      "  글자가 빠졌다면 scripts/lib/charset.mjs 의 수집 범위를 넓히고 다시 빌드할 것.\n",
    );
    process.exit(1);
  }
  log("모두 통과 — 배포 가능");
}

/**
 * 이 페이지에서 나와도 되는 폰트인지.
 * Pretendard(본문)와 Geist Mono(라벨)는 의도한 것이다. 그 밖의 이름이 나오면
 * 어떤 글자가 폴백으로 떨어졌다는 뜻이다.
 */
function isExpectedFamily(name) {
  return /^Pretendard/i.test(name) || /Geist\s*Mono/i.test(name) || /^__Geist_Mono/.test(name);
}

main().catch((err) => {
  console.error("[verify-fonts] 오류:", err.message ?? err);
  process.exit(1);
});
