import Link from "next/link";

/**
 * 404.
 *
 * 지금까지 Next.js 기본 페이지("404: This page could not be found.")가 그대로
 * 나갔다. lang="ko" 문서에 영문 기본 화면이 뜨는 상태였다.
 *
 * 단일 페이지 사이트라 404 에 닿는 경로는 오타나 옛 링크뿐이다. 그러면 안내는
 * "없다" 보다 "여긴 한 페이지고, 돌아갈 곳은 여기다" 가 쓸모 있다.
 * 나머지는 본문과 같은 문서형 규칙 — 무채색, 가는 선, 여백.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-32 sm:px-6">
      <p className="text-ink-3 font-mono text-[11px] tracking-wide">404</p>

      <h1 className="text-ink mt-6 max-w-2xl text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        찾으시는 페이지가 없습니다.
      </h1>

      <p className="text-ink-2 mt-4 max-w-xl text-sm leading-relaxed text-pretty">
        이 포트폴리오는 한 페이지로 되어 있습니다. 주소를 잘못 입력하셨거나 예전
        링크로 들어오셨을 수 있습니다.
      </p>

      <div className="border-rule mt-10 border-t pt-6">
        <Link
          href="/"
          className="text-ink-2 hover:text-ink text-sm underline decoration-current/30 underline-offset-4 transition-colors hover:decoration-current"
        >
          처음으로 돌아가기
        </Link>
      </div>
    </main>
  );
}
