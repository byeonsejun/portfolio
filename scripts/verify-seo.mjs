/**
 * SEO 산출물 검증 — 빌드된 out/ 을 읽어 검색 노출에 필요한 파일이 맞게 나왔는지 본다.
 *
 * 왜 따로 두는가
 *   robots · sitemap · JSON-LD · llms.txt 는 틀려도 빌드가 멈추지 않는다.
 *   잘못된 채로 배포되면 크롤러만 조용히 등을 돌린다 — 예를 들어 robots 가
 *   index.txt 를 열어 버리면 같은 본문이 두 URL 로 색인된다. 눈으로 확인할 수
 *   없는 종류의 실수라서, 배포 전에 산출물 자체를 검사한다.
 *
 * 항목 추가 방법
 *   아래 checks 배열에 { name, run } 한 개를 더하면 끝이다.
 *   run() 은 실패하면 메시지 문자열을, 통과하면 null 을 돌려준다.
 *   (읽을 파일이 없을 땐 read() 가 null 을 주니 직접 분기해서 메시지를 낸다.)
 *
 * 실패가 하나라도 있으면 종료 코드 1.
 * 사용: npm run build && npm run verify:seo
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "out");

/*
 * 사이트 주소는 src/data/site.ts 한 곳에서만 정한다. 여기서 문자열로 다시
 * 적으면 도메인이 바뀔 때 검사가 옛 값을 정답이라고 우긴다. TS 파일이라
 * 직접 import 할 수 없어서 상수 선언 줄만 읽어 온다.
 */
const siteSource = await readFile(path.join(ROOT, "src/data/site.ts"), "utf8");
const SITE_URL = siteSource.match(/export const SITE_URL\s*=\s*"([^"]+)"/)?.[1];
if (!SITE_URL) {
  console.error("[verify-seo] src/data/site.ts 에서 SITE_URL 을 못 읽었다.");
  process.exit(1);
}

/** out/ 아래 파일을 문자열로 읽는다. 없으면 null — 존재 여부도 검사 대상이라 던지지 않는다. */
async function read(rel) {
  try {
    return await readFile(path.join(OUT, rel), "utf8");
  } catch {
    return null;
  }
}

/** robots.txt 에서 `Allow:` 값만 뽑는다. */
const allowRules = (robots) =>
  robots
    .split("\n")
    .map((l) => l.match(/^\s*allow:\s*(\S+)/i)?.[1])
    .filter(Boolean);

export const checks = [
  {
    name: "robots.txt 에 llms.txt 허용 · .txt 차단 · sitemap 선언이 모두 있다",
    async run() {
      const robots = await read("robots.txt");
      if (robots === null) return "out/robots.txt 가 없다";
      const missing = [
        "Allow: /llms.txt",
        "Disallow: /*.txt$",
        `Sitemap: ${SITE_URL}/sitemap.xml`,
      ].filter((line) => !robots.includes(line));
      return missing.length ? `robots.txt 에 빠진 줄: ${missing.join(" | ")}` : null;
    },
  },
  {
    name: "llms.txt 허용이 index.txt 같은 RSC 페이로드까지 열지 않는다",
    async run() {
      const robots = await read("robots.txt");
      if (robots === null) return "out/robots.txt 가 없다";
      /* "/" 와 정확히 "/llms.txt" 말고는 .txt 를 건드리는 Allow 가 없어야 한다. */
      const leaking = allowRules(robots).filter(
        (rule) => rule !== "/llms.txt" && (rule.includes(".txt") || rule.includes("*")),
      );
      return leaking.length ? `.txt 를 넓게 여는 Allow: ${leaking.join(", ")}` : null;
    },
  },
  {
    name: "sitemap.xml 이 있고 정본 홈 URL 하나만 담는다",
    async run() {
      const xml = await read("sitemap.xml");
      if (xml === null) return "out/sitemap.xml 이 없다";
      const home = `<loc>${SITE_URL}/</loc>`;
      const count = xml.split(home).length - 1;
      if (count !== 1) return `${home} 가 ${count}개 (정확히 1개여야 함)`;
      if (xml.includes("pages.dev")) return "sitemap.xml 에 pages.dev 주소가 섞였다";
      return null;
    },
  },
];

async function main() {
  let failed = 0;
  for (const { name, run } of checks) {
    const message = await run();
    if (message === null) {
      console.log(`[verify-seo] PASS  ${name}`);
    } else {
      failed += 1;
      console.log(`[verify-seo] FAIL  ${name}\n             -> ${message}`);
    }
  }
  if (failed > 0) {
    console.error(`[verify-seo] ${failed}/${checks.length} 항목 실패`);
    process.exit(1);
  }
  console.log(`[verify-seo] ${checks.length}/${checks.length} 항목 통과`);
}

/* 다른 스크립트가 checks 만 가져다 쓸 수도 있으니, 직접 실행했을 때만 돌린다. */
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
