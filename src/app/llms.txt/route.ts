import { projectUrl } from "@/data/structured-data";
import { resolvedProjects } from "@/data/resolve";
import { GITHUB_HREF, SITE_URL } from "@/data/site";

/* output: "export" 에서 라우트 핸들러는 빌드 때 한 번 실행돼 out/llms.txt 로 굳는다. */
export const dynamic = "force-static";

/**
 * llms.txt — AI 검색·에이전트가 읽으라고 만든 사이트 요약 (llmstxt.org 형식).
 *
 * 프로젝트 이름·소개·역할·링크는 카드 데이터에서 만든다. 손으로 적은 요약은
 * 카드를 고친 뒤 제일 먼저 낡는다. 수치는 새로 만들지 않고 카드에 있는 값만 쓴다.
 *
 * 한 줄 요약은 Hero 의 문장과 같은 사실만 말한다 (hero.tsx). 사이트 안에서
 * 말이 갈리면 AI 가 어느 쪽을 믿을지 알 수 없다.
 *
 * 이메일은 넣지 않는다. 사이트가 ObfuscatedEmail 로 가려 둔 값이라 평문 파일에
 * 적으면 가린 의미가 없다.
 */
function buildLlmsTxt(): string {
  const lines = [
    "# 변세준 — 프론트엔드 개발자 포트폴리오",
    "",
    "> 프론트엔드 개발자 변세준의 포트폴리오. 화면을 하나 더 만드는 것이 아니라, 다음 화면을 더 싸게 만들 수 있게 정리하는 것을 다룬다.",
    "",
    `- [포트폴리오](${SITE_URL}/)`,
    `- [GitHub](${GITHUB_HREF})`,
  ];

  for (const p of resolvedProjects) {
    const url = projectUrl(p);
    lines.push("", `## ${p.name}`, "", p.tagline);
    if (p.role) lines.push("", `역할: ${p.role}`);
    if (url) lines.push("", `- [${p.name}](${url})`);
    /* 저장소가 데모와 따로 있으면 함께 적는다. 같은 주소를 두 번 쓰지 않는다. */
    if (p.links.repo && p.links.repo !== url) {
      lines.push(`- [${p.name} 저장소](${p.links.repo})`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export function GET(): Response {
  return new Response(buildLlmsTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
