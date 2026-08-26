// 측정용 정적 서버 — Cloudflare Pages 처럼 텍스트 자산에 brotli 를 적용한다.
// python -m http.server 는 무압축이라 Lighthouse 점수가 실제보다 나쁘게 나온다.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { brotliCompressSync, constants } from "node:zlib";
import path from "node:path";

const ROOT = process.argv[2];
const PORT = Number(process.argv[3] ?? 8766);
const TYPES = {".html":"text/html; charset=utf-8",".js":"text/javascript",".css":"text/css",
  ".json":"application/json",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",
  ".avif":"image/avif",".webp":"image/webp",".mp4":"video/mp4",".woff2":"font/woff2",".txt":"text/plain",".ico":"image/x-icon",
  // application/pdf 여야 브라우저 뷰어로 열린다. octet-stream 이면 다운로드로 떨어진다.
  ".pdf":"application/pdf"};
const COMPRESSIBLE = new Set([".html",".js",".css",".json",".svg",".txt"]);
const cache = new Map();

createServer(async (req,res)=>{
  let p = decodeURIComponent(new URL(req.url,"http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    const st = await stat(file);
    if (!st.isFile()) throw new Error("dir");
    const ext = path.extname(file);
    const type = TYPES[ext] ?? "application/octet-stream";
    const acceptsBr = (req.headers["accept-encoding"]||"").includes("br");
    let body, enc;
    if (COMPRESSIBLE.has(ext) && acceptsBr) {
      if (!cache.has(file)) cache.set(file, brotliCompressSync(await readFile(file),
        {params:{[constants.BROTLI_PARAM_QUALITY]:9}}));
      body = cache.get(file); enc = "br";
    } else body = await readFile(file);
    const h = {"Content-Type":type,"Content-Length":body.length,
      "Cache-Control": p==="/index.html" ? "public,max-age=0,must-revalidate" : "public,max-age=31536000,immutable"};
    if (enc) h["Content-Encoding"] = enc;
    res.writeHead(200,h).end(body);
  } catch { res.writeHead(404).end("not found"); }
}).listen(PORT, ()=>console.log("serving",ROOT,"on",PORT));
