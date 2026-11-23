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

/**
 * out/ 의 HTML 에서 application/ld+json 한 덩어리를 꺼내 파싱한다.
 * 없거나 깨졌으면 { error } — 검사마다 같은 분기를 반복하지 않으려고 모았다.
 */
async function readJsonLd(rel) {
  const html = await read(rel);
  if (html === null) return { error: `out/${rel} 가 없다` };
  const match = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return { error: `out/${rel} 에 application/ld+json 이 없다` };
  try {
    return { raw: match[1], data: JSON.parse(match[1]) };
  } catch (e) {
    return { error: `JSON-LD 가 JSON 으로 파싱되지 않는다: ${e.message}` };
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
  {
    name: "robots.txt 에 pages.dev 주소가 섞이지 않는다",
    async run() {
      const robots = await read("robots.txt");
      if (robots === null) return "out/robots.txt 가 없다";
      return robots.includes("pages.dev") ? "robots.txt 에 pages.dev 주소가 섞였다" : null;
    },
  },
  {
    name: "홈 JSON-LD 가 ProfilePage > Person 과 프로젝트 6개 목록을 담는다",
    async run() {
      const found = await readJsonLd("index.html");
      if (found.error) return found.error;
      const { raw, data } = found;

      if (data["@context"] !== "https://schema.org") return `@context 가 ${data["@context"]}`;
      if (data["@type"] !== "ProfilePage") return `@type 이 ${data["@type"]}`;

      const person = data.mainEntity;
      if (person?.["@type"] !== "Person") return "mainEntity 가 Person 이 아니다";
      const expected = {
        name: "변세준",
        alternateName: "BYUN SEJUN",
        jobTitle: "프론트엔드 개발자",
        url: `${SITE_URL}/`,
      };
      for (const [key, value] of Object.entries(expected)) {
        if (person[key] !== value) {
          return `Person.${key} 가 ${JSON.stringify(person[key])} (기대 ${JSON.stringify(value)})`;
        }
      }
      if (!person.sameAs?.includes("https://github.com/byeonsejun")) return "Person.sameAs 에 GitHub 주소가 없다";
      if (!Array.isArray(person.knowsAbout) || person.knowsAbout.length === 0) return "Person.knowsAbout 이 비었다";

      const list = data.hasPart;
      if (list?.["@type"] !== "ItemList") return "hasPart 가 ItemList 가 아니다";
      const items = list.itemListElement ?? [];
      if (items.length !== 6) return `프로젝트 항목이 ${items.length}개 (6개여야 함)`;
      for (const [i, entry] of items.entries()) {
        if (entry["@type"] !== "ListItem" || entry.position !== i + 1) {
          return `${i + 1}번째 항목의 ListItem/position 이 틀렸다`;
        }
        const item = entry.item;
        if (item?.["@type"] !== "CreativeWork") return `${i + 1}번째 item 이 CreativeWork 가 아니다`;
        if (!item.name) return `${i + 1}번째 item.name 이 비었다`;
        if ("url" in item && !item.url) return `${item.name} 의 url 키가 있는데 값이 비었다`;
      }

      /* 이메일은 사이트에서 일부러 가려 둔 값이다. 구조화 데이터로 새면 가린 의미가 없다. */
      if (/[^\s"@]+@[^\s"@]+\.[^\s"@]+/.test(raw)) return "JSON-LD 에 이메일 주소로 보이는 문자열이 있다";
      if (raw.includes("pages.dev")) return "JSON-LD 에 pages.dev 주소가 섞였다";
      if (raw.includes("<")) return "JSON-LD 에 이스케이프 안 된 < 가 있다 (</script> 로 깨질 수 있음)";
      return null;
    },
  },
  {
    name: "knowsAbout 이 이력서 스킬 10개를 정해진 순서대로 담는다",
    async run() {
      const found = await readJsonLd("index.html");
      if (found.error) return found.error;
      const actual = found.data.mainEntity?.knowsAbout;
      /* 이력서 스킬 태그 기준의 고정 목록(src/data/site.ts KNOWS_ABOUT). 카드에서 뽑으면 백엔드 항목이 앞을 차지한다. */
      const expected = [
        "React",
        "TypeScript",
        "Next.js",
        "JavaScript",
        "Zustand",
        "TanStack Query",
        "Tailwind CSS",
        "three.js",
        "Vitest",
        "Playwright",
      ];
      if (!Array.isArray(actual)) return "Person.knowsAbout 이 배열이 아니다";
      if (!actual.includes("React")) return "knowsAbout 에 React 가 없다";
      return JSON.stringify(actual) === JSON.stringify(expected)
        ? null
        : `knowsAbout 이 ${JSON.stringify(actual)} (기대 ${JSON.stringify(expected)})`;
    },
  },
  {
    name: "llms.txt 가 제목 · 요약 · 링크 · 프로젝트 6개를 담고 이메일은 없다",
    async run() {
      const txt = await read("llms.txt");
      if (txt === null) return "out/llms.txt 가 없다";
      const lines = txt.split("\n");

      if (lines[0] !== "# 변세준 — 프론트엔드 개발자 포트폴리오") return `첫 줄이 ${JSON.stringify(lines[0])}`;
      if (!lines.some((l) => l.startsWith("> ") && l.length > 2)) return "'> ' 한 줄 요약이 없다";
      for (const url of [SITE_URL, "https://github.com/byeonsejun"]) {
        if (!txt.includes(url)) return `${url} 가 없다`;
      }

      /* 프로젝트 이름·주소는 홈 JSON-LD 에서 가져온다. 같은 카드 데이터에서 나온 값이라 정답으로 쓴다. */
      const found = await readJsonLd("index.html");
      if (found.error) return found.error;
      const items = (found.data.hasPart?.itemListElement ?? []).map((e) => e.item);
      if (items.length !== 6) return `기준이 될 프로젝트가 ${items.length}개 (6개여야 함)`;

      /* "## 이름" 으로 시작해 다음 "## " 전까지가 한 프로젝트의 구역이다. */
      const sections = txt.split(/^## /m).slice(1);
      for (const item of items) {
        const section = sections.find((s) => s.split("\n")[0].trim() === item.name);
        if (!section) return `"## ${item.name}" 제목이 없다`;
        if (item.url && !section.includes(item.url)) return `${item.name} 아래에 ${item.url} 가 없다`;
      }
      if (sections.length !== items.length) return `## 제목이 ${sections.length}개 (${items.length}개여야 함)`;

      if (/[^\s"@]+@[^\s"@]+\.[^\s"@]+/.test(txt)) return "llms.txt 에 이메일 주소로 보이는 문자열이 있다";
      if (txt.includes("pages.dev")) return "llms.txt 에 pages.dev 주소가 섞였다";
      return null;
    },
  },
  {
    name: "404 에는 JSON-LD 가 없다",
    async run() {
      const html = await read("404.html");
      if (html === null) return "out/404.html 이 없다";
      return html.includes("application/ld+json") ? "404.html 이 홈의 JSON-LD 를 상속했다" : null;
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
