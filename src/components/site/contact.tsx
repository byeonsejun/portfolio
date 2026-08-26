import { ObfuscatedEmail } from "@/components/site/obfuscated-email";
import fontManifest from "@/data/generated/font-manifest.json";
import { GITHUB_HREF } from "@/data/site";

const linkClass =
  "text-ink-2 hover:text-ink text-sm underline decoration-current/30 underline-offset-4 transition-colors hover:decoration-current";

export function Contact() {
  return (
    <section id="contact" className="border-rule border-t py-20 sm:py-24">
      <h2 className="text-ink-3 font-mono text-[11px] tracking-wide">
        Contact
      </h2>

      {/* hero 의 "다음 화면을 더 싸게 만들 수 있게 정리하는 것" 을 받는 문장. */}
      <p className="text-ink mt-6 max-w-2xl text-lg leading-relaxed font-medium tracking-tight text-balance sm:text-xl sm:leading-relaxed">
        지금은 그 정리를 사람이 아니라 파이프라인이 하게 만드는 일을 하고
        있습니다.
      </p>

      <dl className="mt-10 flex flex-col gap-3">
        <Row label="Email">
          <ObfuscatedEmail className={linkClass} />
        </Row>
        <Row label="GitHub">
          <a href={GITHUB_HREF} className={linkClass}>
            github.com/byeonsejun
          </a>
        </Row>
        {/*
          이력서는 파일로 걸지 않는다. 휴대폰 번호와 주소가 평문으로 들어 있어
          공개 URL 에 두면 크롤러가 그대로 가져간다. 행 자체는 남긴다 —
          찾던 사람에게 빈칸을 주는 것보다 "여기 없고 이렇게 하면 된다" 가 낫다.
        */}
        <Row label="이력서">
          <span className="text-ink-2 text-sm">
            요청하시면 이메일로 보내드립니다.
          </span>
        </Row>
      </dl>

      <Colophon />
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[5rem_1fr] sm:gap-6">
      <dt className="text-ink-3 font-mono text-[11px] tracking-wide sm:pt-1">
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * 콜로폰 — 이 사이트 자체가 작업물이라는 신호.
 * 전부 실제로 이 저장소에서 하고 있는 것들만 적는다.
 */
function Colophon() {
  /* 콜로폰의 숫자는 전부 빌드 산출물에서 읽는다. 손으로 적으면 다음 빌드에
     거짓말이 된다. font-manifest.json 은 scripts/build-fonts.mjs 의 실측치다. */
  const kb = (n: number) => Math.round(n / 1024);
  const fontMb = (fontManifest.sourceBytes / 1e6).toFixed(1);
  const { page, reserve } = fontManifest;

  const items = [
    "Next.js 16 App Router · TypeScript strict · 정적 export (서버 런타임 없음) · Cloudflare Pages",
    "스크린샷 15장은 빌드 전 sharp 스크립트가 640/1280/1920 폭의 AVIF·WebP로 파생합니다. 페이지는 파생본만 쓰고, 16MB짜리 원본은 확대할 때만 받아갑니다.",
    "화면 녹화 5편은 poster만 깔고 재생 전까지 아무것도 내려받지 않습니다. 그중 2편은 원래 GIF였고 mp4로 바꾸면서 3.3MB가 443KB가 됐습니다.",
    "아키텍처 다이어그램 6개는 인라인 SVG입니다. 이미지로 넣으면 바깥 문서의 테마를 볼 수 없어, 라이트/다크 토글에 함께 반응하도록 마크업째 박았습니다.",
    `Pretendard는 이 페이지가 실제로 쓰는 글자만 남겨 자기호스팅합니다. ${fontMb}MB 원본에서 ${page.glyphs.toLocaleString("ko-KR")}자(한글 ${page.hangul.toLocaleString("ko-KR")}자)를 추린 ${kb(page.bytes)}KB입니다. 조각난 dynamic subset을 15번 요청하던 것이 preload 한 번으로 바뀌었습니다.`,
    `글자 목록은 손으로 적지 않고 빌드된 HTML과 번들 JS에서 뽑습니다. 런타임에 조립되는 문자열은 HTML에 없기 때문입니다. 서브셋한 폰트의 cmap을 되읽어 필요한 글자가 하나라도 빠져 있으면 빌드가 멈춥니다.`,
    `렌더러에게 "이 글자를 실제로 어떤 폰트로 그렸냐"고 묻는 헤드리스 브라우저 검사는 따로 두었습니다. 배포 CI에는 브라우저가 없고, 폰트는 문구가 바뀔 때만 영향을 받아 매 배포마다 돌 이유가 없습니다. 이 검사가 mono 라벨의 한글이 통째로 시스템 폰트로 떨어지고 있던 것을 잡아냈습니다.`,
    `나중에 문구를 고쳐도 깨지지 않도록 자주 쓰는 한글 ${reserve.hangul.toLocaleString("ko-KR")}자를 따로 ${kb(reserve.bytes)}KB 조각에 담아 두었습니다. unicode-range가 그 글자들로만 좁혀져 있어서, 화면에 실제로 나타나기 전까지는 요청되지 않습니다. 같이 넣었다면 ${kb(page.bytes + reserve.bytes)}KB를 매번 받아야 했고 LCP가 그만큼 늦었습니다.`,
  ];

  return (
    <div className="border-rule text-ink-3 mt-16 border-t pt-6">
      <h3 className="font-mono text-[11px] tracking-wide">이 사이트에 대하여</h3>
      <ul className="mt-4 flex max-w-3xl flex-col gap-2">
        {items.map((t) => (
          <li key={t} className="text-xs leading-relaxed text-pretty">
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
