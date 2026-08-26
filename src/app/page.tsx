import { Contact } from "@/components/site/contact";
import { Hero } from "@/components/site/hero";
import { SiteHeader } from "@/components/site/site-header";
import { ProjectCard } from "@/components/works/project-card";
import { resolvedProjects } from "@/data/resolve";

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
