import type { MetadataRoute } from "next";
import { SITE_URL } from "@/data/site";

/* robots.ts 와 같은 이유 — output: "export" 에선 빌드 타임 1회 실행임을 명시해야 한다. */
export const dynamic = "force-static";

/**
 * sitemap.xml.
 *
 * 단일 페이지라 URL 은 홈 하나다. 그래도 두는 이유는 robots.txt 에서 가리켜
 * 크롤러에게 "정본 주소는 이것" 이라고 한 번 더 말해 주기 위해서다. pages.dev
 * 주소가 한동안 같이 색인됐던 적이 있어서, 정본 URL 목록을 파일로 남겨 둔다.
 *
 * lastModified 는 빌드 시각이다. 내용이 바뀌면 곧 재빌드·재배포이므로
 * "마지막으로 배포된 때" 가 곧 "마지막으로 바뀐 때" 와 같다.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE_URL}/`, lastModified: new Date() }];
}
