import type { Metadata } from "next";

import { Contact } from "@/components/site/contact";
import { Hero } from "@/components/site/hero";
import { SiteHeader } from "@/components/site/site-header";
import { ProjectCard } from "@/components/works/project-card";
import { resolvedProjects } from "@/data/resolve";

/**
 * 정본 URL.
 *
 * 같은 HTML 한 벌을 sejunb.com 과 sejunb-portfolio.pages.dev 가 나눠 쓴다.
 * 정적 export 라 호스트별로 다른 HTML 을 낼 수 없으니, 양쪽 다 이 태그를
 * 내보내며 sejunb.com 을 가리킨다 — 크로스도메인 중복을 한 벌로 합치는
 * 표준 방법이고, pages.dev 로 걸린 링크의 신호도 버리지 않고 넘어온다.
 *
 * layout 이 아니라 여기 두는 이유: 루트 레이아웃에 두면 404 까지 canonical 을
 * 상속받아 404 본문이 홈으로 귀속된다.
 *
 * metadataBase(= SITE_URL) 덕분에 "/" 가 절대 URL 로 렌더된다.
 */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/**
 * 단일 페이지. hero → works(5개 전개형 카드) → contact.
 *
 * (1) 셸 · (2) hero · (3) works 카드 · (4) contact + 콜로폰 — 완료.
 * 라이트박스는 별도 단계.
 */
export default function Home() {
  const navItems = resolvedProjects.map((p) => ({
    slug: p.slug,
    name: p.name,
  }));

  return (
    <>
      <SiteHeader items={navItems} />

      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <Hero projects={resolvedProjects} />

        <section id="works" className="py-16">
          <h2 className="text-ink text-sm font-semibold tracking-tight">
            Works
          </h2>

          <div className="mt-12 flex flex-col gap-32 sm:gap-40">
            {resolvedProjects.map((p, i) => (
              <ProjectCard
                key={p.slug}
                project={p}
                index={i}
                priority={i === 0}
              />
            ))}
          </div>
        </section>

        <Contact />
      </main>
    </>
  );
}
