/**
 * 코드포인트 집합 → CSS unicode-range 문자열.
 *
 * 연속 구간을 합쳐 U+ac00-ac03 형태로 접는다. 한글 음절은 유니코드 전역에
 * 흩어져 있어 접지 않으면 선언이 수천 개가 된다.
 */
export function toUnicodeRange(codepoints) {
  const sorted = [...codepoints].sort((a, b) => a - b);
  if (sorted.length === 0) return "";

  const parts = [];
  let start = sorted[0];
  let prev = sorted[0];

  const flush = () => {
    const s = start.toString(16);
    parts.push(start === prev ? `U+${s}` : `U+${s}-${prev.toString(16)}`);
  };

  for (let i = 1; i < sorted.length; i++) {
    const cp = sorted[i];
    if (cp === prev + 1) {
      prev = cp;
      continue;
    }
    flush();
    start = cp;
    prev = cp;
  }
  flush();
  return parts.join(", ");
}
