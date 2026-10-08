// 견적서 PDF → 사진(PNG). jin 10/5: 업체마다 PDF·캡처 사진을 달라고 해서 둘 다 버튼으로.
// PDF 그리기는 PDFium(WASM). 구글 PDF에 한글 글꼴이 들어 있어 글씨가 깨지지 않는다(시스템 글꼴 안 씀).
// PNG 압축은 Deno 기본 CompressionStream 으로 직접 만든다(추가 패키지 없음).

let lib: any = null;
async function pdfium() {
  if (lib) return lib;
  // 필요할 때만 불러온다 — 여기서 문제가 나도 견적 작성·PDF 버튼은 그대로 동작
  const { PDFiumLibrary } = await import("npm:@hyzyla/pdfium@2");
  try { lib = await PDFiumLibrary.init(); return lib; } catch (e) { console.error("pdfium 기본 로드 실패", (e as Error).message); }
  // 번들에 wasm 이 안 들어간 경우: CDN 에서 받아 넣는다
  const url = "https://cdn.jsdelivr.net/npm/@hyzyla/pdfium@2/dist/vendor/pdfium.wasm";
  const r = await fetch(url);
  if (!r.ok) throw new Error(`pdfium.wasm ${r.status}`);
  const wasmBinary = await r.arrayBuffer();
  lib = await PDFiumLibrary.init({ wasmBinary, wasmUrl: url } as any);
  return lib;
}

// 첫 쪽을 RGBA 로 그린 뒤, 아래쪽 빈 여백을 잘라 PNG 로
export async function pdfToPng(pdf: Uint8Array, scale: number) {
  const l = await pdfium();
  const doc = await l.loadDocument(pdf);
  try {
    const page = doc.getPage(0);
    const img = await page.render({ scale, render: "bitmap" });
    const { width, height } = img;
    const data = new Uint8Array(img.data);
    const h = contentHeight(data, width, height, Math.round(12 * scale));
    return await encodePng(data, width, h);
  } finally { doc.destroy(); }
}

// 맨 아래부터 흰색이 아닌 줄을 찾아 그 아래 pad 만큼만 남김
export function contentHeight(rgba: Uint8Array, w: number, h: number, pad: number) {
  for (let y = h - 1; y >= 0; y--) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      const i = row + x * 4;
      if (rgba[i + 3] > 0 && (rgba[i] < 245 || rgba[i + 1] < 245 || rgba[i + 2] < 245)) return Math.min(h, y + 1 + pad);
    }
  }
  return h;
}

// ───────── PNG ─────────
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(parts: Uint8Array[]) { let c = 0xffffffff; for (const p of parts) for (let i = 0; i < p.length; i++) c = CRC[(c ^ p[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type: string, body: Uint8Array) {
  const t = new TextEncoder().encode(type);
  const out = new Uint8Array(12 + body.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, body.length); out.set(t, 4); out.set(body, 8); dv.setUint32(8 + body.length, crc32([t, body]));
  return out;
}
async function deflate(raw: Uint8Array) {
  const s = new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate")); // zlib 형식 = PNG IDAT 형식
  return new Uint8Array(await new Response(s).arrayBuffer());
}
export async function encodePng(rgba: Uint8Array, w: number, h: number) {
  const raw = new Uint8Array((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1); }
  const ihdr = new Uint8Array(13); const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w); dv.setUint32(4, h); ihdr[8] = 8; ihdr[9] = 6; // 8bit RGBA
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", await deflate(raw)), chunk("IEND", new Uint8Array())];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
