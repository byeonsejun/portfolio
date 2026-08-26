/**
 * MP4 컨테이너에서 표시 크기와 재생 길이를 읽는다.
 *
 * 왜 ffprobe 를 안 쓰는가: 이 값들은 <video> 에 width/height 를 박아 레이아웃을
 * 예약하는 데만 쓰인다. 그것 때문에 빌드 전체가 시스템에 설치된 ffmpeg 에
 * 매이면, 그게 없는 CI(Cloudflare Pages)에서 빌드가 통째로 멈춘다.
 * 필요한 건 moov 안의 상자 두 개뿐이라 직접 읽는 편이 의존성보다 싸다.
 *
 *   mvhd  timescale · duration  → 재생 길이
 *   tkhd  width · height        → 표시 크기 (16.16 고정소수점)
 *
 * 회전(matrix)이 걸린 영상은 tkhd 의 폭·높이가 이미 표시 기준이라 그대로 쓴다.
 */

import { readFile } from "node:fs/promises";

export async function readMp4Meta(file) {
  const buf = await readFile(file);
  const moov = findBox(buf, 0, buf.length, "moov");
  if (!moov) throw new Error(`moov 상자를 못 찾았다: ${file}`);

  const mvhd = findBox(buf, moov.start, moov.end, "mvhd");
  let durationSec = 0;
  if (mvhd) {
    const v = buf.readUInt8(mvhd.start);
    // version(1) + flags(3) 다음부터. v1 은 시각 필드가 64비트다.
    const p = mvhd.start + 4 + (v === 1 ? 16 : 8);
    const timescale = buf.readUInt32BE(p);
    const duration = v === 1 ? Number(buf.readBigUInt64BE(p + 4)) : buf.readUInt32BE(p + 4);
    if (timescale > 0) durationSec = duration / timescale;
  }

  /* 트랙이 여럿이면(영상 + 음성) 크기가 0 이 아닌 것이 영상 트랙이다.
     음성 트랙의 tkhd 는 width/height 가 0 으로 들어온다. */
  let width = 0;
  let height = 0;
  for (const trak of findBoxes(buf, moov.start, moov.end, "trak")) {
    const tkhd = findBox(buf, trak.start, trak.end, "tkhd");
    if (!tkhd) continue;
    const v = buf.readUInt8(tkhd.start);
    // version/flags(4) + 시각·트랙ID·예약·duration + 예약(8) + layer/alt/volume/예약(8) + matrix(36)
    const p = tkhd.start + 4 + (v === 1 ? 32 : 20) + 8 + 8 + 36;
    if (p + 8 > tkhd.end) continue;
    const w = buf.readUInt32BE(p) / 65536;
    const h = buf.readUInt32BE(p + 4) / 65536;
    if (w > 0 && h > 0) {
      width = Math.round(w);
      height = Math.round(h);
      break;
    }
  }
  if (!width || !height) throw new Error(`영상 트랙 크기를 못 읽었다: ${file}`);

  return { width, height, durationSec };
}

/** [from, to) 구간의 최상위 상자들을 순회한다. 하위 상자는 재귀로 찾는다. */
function* walkBoxes(buf, from, to) {
  let off = from;
  while (off + 8 <= to) {
    let size = buf.readUInt32BE(off);
    const type = buf.toString("latin1", off + 4, off + 8);
    let header = 8;
    if (size === 1) {
      // 64비트 크기 확장
      if (off + 16 > to) return;
      size = Number(buf.readBigUInt64BE(off + 8));
      header = 16;
    } else if (size === 0) {
      // 파일 끝까지
      size = to - off;
    }
    if (size < header || off + size > to) return;
    yield { type, start: off + header, end: off + size };
    off += size;
  }
}

/** 컨테이너 상자 안쪽까지 재귀로 훑어 첫 일치를 돌려준다. */
function findBox(buf, from, to, type) {
  for (const box of walkBoxes(buf, from, to)) {
    if (box.type === type) return box;
    if (CONTAINERS.has(box.type)) {
      const hit = findBox(buf, box.start, box.end, type);
      if (hit) return hit;
    }
  }
  return null;
}

function findBoxes(buf, from, to, type) {
  const out = [];
  for (const box of walkBoxes(buf, from, to)) if (box.type === type) out.push(box);
  return out;
}

/** 안을 다시 들여다봐야 하는 상자들. */
const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl", "edts"]);
