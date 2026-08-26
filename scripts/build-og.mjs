/**
 * OG 카드 생성 (로컬 전용 · `npm run og`)
 *
 * 산출물 public/og.png 는 저장소에 커밋한다. 빌드는 그걸 그대로 쓴다.
 * ffmpeg 산출물과 같은 이유다 — 결과가 입력에만 의존하고 입력이 거의 안 바뀌는데,
 * 그걸 매 빌드마다 다시 만들려고 배포 CI 에 브라우저를 요구하면 없는 순간 멈춘다.
 *
 * 왜 사이트 스크린샷이 아닌가
 *   이 사이트는 여백이 넓고 본문이 작은 문서형이다. 1200x630 으로 줄이면
 *   흰 바탕에 깨알 글씨만 남아 카드에서 읽히지 않는다. 그래서 같은 디자인 언어
 *   (무채색 · 가는 선 · Pretendard)로 카드를 따로 짜고, 히어로의 대표 문장을
 *   그대로 얹는다. 카드 한 장이 "무엇을 하는 사람인지" 를 한 줄로 전달한다.
 *
 * 문구를 고쳤으면 이 스크립트를 다시 돌리고 public/og.png 를 함께 커밋할 것.
 */

import { writeFile, readFile, access } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "public/og.png");
const FONT = path.join(ROOT, "node_modules/pretendard/dist/public/variable/PretendardVariable.ttf");
const ICO = path.join(ROOT, "public/favicon.ico");

/**
 * favicon.ico 안에 들어 있는 가장 큰 PNG 프레임을 꺼낸다.
 * 로고 파일을 따로 두지 않는 이유: 원본이 둘이 되면 언젠가 어긋난다.
 * ICO 하나만 두고 필요한 크기는 거기서 뽑아 쓴다.
 */
async function logoDataUri() {
  const d = await readFile(ICO);
  if (d.readUInt32LE(0) !== 0x00010000) throw new Error("favicon.ico 가 ICO 형식이 아니다");
  const count = d.readUInt16LE(4);
  let best = null;
  for (let i = 0; i < count; i++) {
    const e = 6 + i * 16;
    const size = d.readUInt32LE(e + 8);
    const offset = d.readUInt32LE(e + 12);
    const isPng = d.subarray(offset, offset + 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (isPng && (!best || size > best.size)) best = { size, offset };
  }
  if (!best) throw new Error("favicon.ico 안에 PNG 프레임이 없다 — 로고를 못 꺼낸다");
  return "data:image/png;base64," + d.subarray(best.offset, best.offset + best.size).toString("base64");
}

/** 카드에 들어가는 내용. 사이트 문구가 바뀌면 여기도 맞춘다. */
const NAME = "변세준";
const ROLE = "프론트엔드 개발자";
const STATEMENT = ["화면을 하나 더 만드는 것이 아니라,", "다음 화면을 더 싸게 만들 수 있게 정리하는 것"];
const PROJECTS = ["Nextour", "Junsgram", "Seoul Date", "SEFLIX", "SHOPPY"];
const SITE = "sejunb.com";
/** 대표 문장이 몇 줄로 떨어져야 하는지. 아래 검사의 기준. */
const STATEMENT_LEN = STATEMENT.length;

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
].filter(Boolean);

async function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    try {
      await access(p);
      return p;
    } catch {}
  }
  throw new Error(`Chrome 을 못 찾았다. CHROME_PATH 로 지정할 것.`);
}

function html(LOGO) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:P;src:url("file://${FONT}") format("truetype");font-weight:45 920}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#fff;color:#17171a;font-family:P,sans-serif;
  word-break:keep-all;padding:76px 84px;display:flex;flex-direction:column;justify-content:space-between}
.top{display:flex;align-items:baseline;gap:16px}
.name{font-size:34px;font-weight:600;letter-spacing:-.02em}
.role{font-size:20px;color:#6b6b73}
.stmt{font-size:52px;font-weight:600;line-height:1.36;letter-spacing:-.03em}
.rule{height:1px;background:#e4e4e7;margin-bottom:26px}
.bot{display:flex;justify-content:space-between;align-items:flex-end}
.projects{font-size:20px;color:#52525b;letter-spacing:-.01em}
.dot{color:#c9c9cf;margin:0 9px}
.site{font-size:20px;color:#6b6b73;margin-top:10px}
.logo{width:56px;height:56px}
</style></head><body>
<div class="top"><div class="name">${NAME}</div><div class="role">${ROLE}</div></div>
<div class="stmt">${STATEMENT.join("<br>")}</div>
<div><div class="rule"></div><div class="bot"><div>
<div class="projects">${PROJECTS.join('<span class="dot">·</span>')}</div>
<div class="site">${SITE}</div>
</div><img class="logo" src="${LOGO}"></div></div>
</body></html>`;
}

const browser = await puppeteer.launch({
  executablePath: await findChrome(),
  headless: true,
  args: ["--no-sandbox", "--allow-file-access-from-files"],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await page.setContent(html(await logoDataUri()), { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);

  /* 대표 문장이 의도한 줄 수로 떨어졌는지 확인한다. 폰트나 문구가 바뀌면
     조용히 세 줄이 되면서 마지막 글자가 홀로 떨어지는데, 그걸 눈으로만
     잡으려면 놓친다. */
  const lines = await page.evaluate(() => {
    /* getClientRects() 는 블록 요소에서 항상 1 을 준다(박스가 하나라서).
       실제 줄 수는 글자마다 좌표를 재서 서로 다른 top 이 몇 개인지로 센다. */
    const el = document.querySelector(".stmt");
    const range = document.createRange();
    const tops = new Set();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      for (let i = 0; i < n.length; i++) {
        range.setStart(n, i);
        range.setEnd(n, i + 1);
        tops.add(Math.round(range.getBoundingClientRect().top));
      }
    }
    return tops.size;
  });
  if (lines !== STATEMENT_LEN) {
    throw new Error(`대표 문장이 ${lines}줄이다 (기대 ${STATEMENT_LEN}줄). font-size 를 조정할 것.`);
  }

  const buf = await page.screenshot({ type: "png" });
  await writeFile(OUT, buf);
  console.log(`[og] ${path.relative(ROOT, OUT)} · ${(buf.length / 1024).toFixed(1)}KB · 1200x630 · 문장 ${lines}줄`);
} finally {
  await browser.close();
}
