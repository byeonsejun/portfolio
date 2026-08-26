/**
 * 서브셋 폰트가 "실제로" 어떤 코드포인트를 담고 있는지 되읽는다.
 *
 * 서브셋 스크립트에 넘긴 글자 목록을 그대로 믿으면 검증이 아니라 동어반복이 된다.
 * (harfbuzz 가 조용히 떨어뜨렸을 수도, woff2 인코딩이 깨졌을 수도 있다.)
 * 그래서 생성된 woff2 를 다시 ttf 로 되돌리고 cmap 테이블을 직접 파싱한다.
 *
 * 파서를 직접 쓰는 이유: harfbuzzjs 의 hb-subset.wasm 은 set 순회 심볼을 내보내지
 * 않고, 전체 hb.wasm 은 emscripten import 를 요구한다. cmap 은 format 4/6/12 만
 * 다루면 충분하고 그건 100줄이 안 된다 — 빌드 게이트에 wasm 런타임을 하나 더
 * 끌어들이는 것보다 이쪽이 감사하기 쉽다.
 */

import fontverter from "fontverter";

/** @returns {Promise<Set<number>>} 글리프가 실제로 매핑된 코드포인트 집합 */
export async function collectCodepoints(fontBuffer) {
  const ttf = Buffer.from(await fontverter.convert(fontBuffer, "truetype"));
  const table = findTable(ttf, "cmap");
  if (!table) throw new Error("cmap 테이블이 없다 — 폰트가 깨졌다");
  return parseCmap(ttf, table.offset);
}

function findTable(buf, tag) {
  const numTables = buf.readUInt16BE(4);
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (buf.toString("latin1", rec, rec + 4) === tag) {
      return { offset: buf.readUInt32BE(rec + 8), length: buf.readUInt32BE(rec + 12) };
    }
  }
  return null;
}

function parseCmap(buf, base) {
  const numSubtables = buf.readUInt16BE(base + 2);

  /* 유니코드 서브테이블만 후보로 둔다. (3,10)=UCS-4 > (3,1)=BMP > (0,*)=Unicode.
     BMP 밖(이모지 등)을 놓치지 않으려면 UCS-4 를 먼저 봐야 한다. */
  const candidates = [];
  for (let i = 0; i < numSubtables; i++) {
    const rec = base + 4 + i * 8;
    const platformId = buf.readUInt16BE(rec);
    const encodingId = buf.readUInt16BE(rec + 2);
    const offset = base + buf.readUInt32BE(rec + 4);
    let rank = -1;
    if (platformId === 3 && encodingId === 10) rank = 0;
    else if (platformId === 3 && encodingId === 1) rank = 1;
    else if (platformId === 0) rank = 2;
    if (rank >= 0) candidates.push({ rank, offset });
  }
  if (candidates.length === 0) throw new Error("유니코드 cmap 서브테이블이 없다");
  candidates.sort((a, b) => a.rank - b.rank);

  /* 후보를 전부 합집합한다. 폰트에 따라 BMP 표와 UCS-4 표의 내용이 미묘하게
     다를 수 있는데, 검증에서 놓치는 쪽보다 넉넉히 세는 쪽이 위험하다 —
     그러나 여기서는 "덜 세는" 것이 위험하다(있는데 없다고 판정). 합집합이 맞다. */
  const out = new Set();
  for (const { offset } of candidates) parseSubtable(buf, offset, out);
  return out;
}

function parseSubtable(buf, off, out) {
  const format = buf.readUInt16BE(off);
  if (format === 4) return parseFormat4(buf, off, out);
  if (format === 6) return parseFormat6(buf, off, out);
  if (format === 12) return parseFormat12(buf, off, out);
  throw new Error(`지원하지 않는 cmap format ${format}`);
}

function parseFormat4(buf, off, out) {
  const segCount = buf.readUInt16BE(off + 6) / 2;
  const endBase = off + 14;
  const startBase = endBase + segCount * 2 + 2; // +2 = reservedPad
  const deltaBase = startBase + segCount * 2;
  const rangeBase = deltaBase + segCount * 2;

  for (let s = 0; s < segCount; s++) {
    const end = buf.readUInt16BE(endBase + s * 2);
    const start = buf.readUInt16BE(startBase + s * 2);
    if (start === 0xffff) continue; // 관례상 마지막 세그먼트는 종료 표식
    const delta = buf.readInt16BE(deltaBase + s * 2);
    const rangeOffset = buf.readUInt16BE(rangeBase + s * 2);

    for (let cp = start; cp <= end && cp !== 0x10000; cp++) {
      let gid;
      if (rangeOffset === 0) {
        gid = (cp + delta) & 0xffff;
      } else {
        // 스펙상 idRangeOffset 은 "자기 위치 기준" 오프셋이다.
        const gidAddr = rangeBase + s * 2 + rangeOffset + (cp - start) * 2;
        if (gidAddr + 2 > buf.length) continue;
        gid = buf.readUInt16BE(gidAddr);
        if (gid !== 0) gid = (gid + delta) & 0xffff;
      }
      if (gid !== 0) out.add(cp);
    }
  }
}

function parseFormat6(buf, off, out) {
  const first = buf.readUInt16BE(off + 6);
  const count = buf.readUInt16BE(off + 8);
  for (let i = 0; i < count; i++) {
    if (buf.readUInt16BE(off + 10 + i * 2) !== 0) out.add(first + i);
  }
}

function parseFormat12(buf, off, out) {
  const nGroups = buf.readUInt32BE(off + 12);
  for (let g = 0; g < nGroups; g++) {
    const rec = off + 16 + g * 12;
    const start = buf.readUInt32BE(rec);
    const end = buf.readUInt32BE(rec + 4);
    const startGid = buf.readUInt32BE(rec + 8);
    if (startGid === 0) continue;
    for (let cp = start; cp <= end; cp++) out.add(cp);
  }
}
