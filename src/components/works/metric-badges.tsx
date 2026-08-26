import type { Metric } from "@/types/project";

/**
 * 지표 배지.
 *
 * 구분 축이 둘이고, 서로 다른 수단을 쓴다.
 *   kind → 형태 (무채색)  measured = 맨 타이포 / structural = 외곽선 컨테이너
 *   tone → 색            positive = 앰버 / 그 외 = 무채색
 *
 * 전체 25개 중 앰버는 4개뿐이라 희소성이 유지된다.
 * 앰버는 다이어그램에서와 같은 뜻(= 핵심 성과)으로만 쓴다.
 *
 * "측정 / 구조" 라벨을 굳이 노출하는 이유: FSD 5-레이어 같은 구조 서술을
 * Lighthouse 93 과 같은 무게로 슬쩍 끼워 넣으면 감점이지만,
 * 스스로 분류해 두면 오히려 판단력의 증거가 된다.
 */
export function MetricBadges({ metrics }: { metrics: readonly Metric[] }) {
  if (metrics.length === 0) return null;

  const measured = metrics.filter((m) => (m.kind ?? "measured") === "measured");
  const structural = metrics.filter((m) => m.kind === "structural");

  return (
    <div className="flex flex-col gap-8">
      {measured.length > 0 ? (
        <Row label="측정">
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {measured.map((m) => (
              <MeasuredBadge key={m.label} metric={m} />
            ))}
          </div>
        </Row>
      ) : null}

      {structural.length > 0 ? (
        <Row label="구조">
          <div className="flex flex-wrap gap-2">
            {structural.map((m) => (
              <StructuralBadge key={m.label} metric={m} />
            ))}
          </div>
        </Row>
      ) : null}
    </div>
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
    <div className="grid gap-2 sm:grid-cols-[3.5rem_1fr] sm:gap-6">
      <div className="text-ink-3 pt-0.5 font-mono text-[11px] tracking-wide">
        {label}
      </div>
      {children}
    </div>
  );
}

function MeasuredBadge({ metric }: { metric: Metric }) {
  const isPositive = metric.tone === "positive";
  return (
    <div>
      <div className="text-ink-3 text-[11px]">{metric.label}</div>
      <div className="mt-1 flex flex-wrap items-baseline gap-1.5">
        {metric.baseline ? (
          <>
            <span className="text-ink-3 text-sm line-through decoration-current/40">
              {metric.baseline}
            </span>
            <span className="text-ink-3 text-xs" aria-hidden="true">
              →
            </span>
          </>
        ) : null}
        <span
          className={[
            "text-lg font-semibold tracking-tight tabular-nums",
            isPositive ? "text-accent" : "text-ink",
          ].join(" ")}
        >
          {metric.value}
        </span>
      </div>
      {metric.note ? (
        <div className="text-ink-3 mt-1 text-[11px] leading-snug">
          {metric.note}
        </div>
      ) : null}
    </div>
  );
}

function StructuralBadge({ metric }: { metric: Metric }) {
  return (
    <div className="border-rule rounded-md border px-3 py-2">
      <div className="text-ink-3 text-[11px]">{metric.label}</div>
      <div className="text-ink-2 mt-0.5 text-sm font-medium tracking-tight">
        {metric.value}
      </div>
      {metric.note ? (
        <div className="text-ink-3 mt-1 max-w-[22rem] text-[11px] leading-snug">
          {metric.note}
        </div>
      ) : null}
    </div>
  );
}
