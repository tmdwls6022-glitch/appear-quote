// 견적 시트에 직접 쓰기 (Google Sheets API + 서비스 계정). Apps Script를 쓰지 않는다.
// 하는 일은 견적자동작성.gs 의 copyTemplate_ + fillSheet_ 와 같다.
// 비밀값: GOOGLE_SA_JSON (서비스 계정 키 JSON 전체). 견적 시트를 그 계정 이메일에 편집자로 공유해야 한다.

import { CFG, priceTotals_, periodLabel_, scheduleLine_, pensionText_ } from "./core.js";

const API = "https://sheets.googleapis.com/v4/spreadsheets";

// ───────── 인증 ─────────
let tokenCache: { token: string; exp: number } | null = null;
function b64url(buf: ArrayBuffer | Uint8Array | string) {
  const bytes = typeof buf === "string" ? new TextEncoder().encode(buf) : new Uint8Array(buf as ArrayBuffer);
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function googleToken(saJson: string) {
  if (tokenCache && tokenCache.exp > Date.now() + 60e3) return tokenCache.token;
  const sa = JSON.parse(saJson);
  const pem = String(sa.private_key).replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." + b64url(JSON.stringify({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${unsigned}.${b64url(sig)}`,
  });
  if (!r.ok) throw new Error(`구글 로그인 ${r.status}: ${(await r.text()).slice(0, 150)}`);
  const j = await r.json();
  tokenCache = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return j.access_token as string;
}

async function gapi(token: string, method: string, url: string, body?: unknown) {
  const r = await fetch(url, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    if (r.status === 403 || r.status === 404) throw new Error(`시트 접근 안 됨(${r.status}) — 견적 시트를 서비스 계정 이메일에 편집자로 공유했는지 확인`);
    throw new Error(`시트 ${r.status}: ${t.slice(0, 150)}`);
  }
  return r.json();
}

// ───────── 칸 읽기 ─────────
type Grid = { vals: string[][]; formula: boolean[][]; merges: any[] };
const q1 = (t: string) => `'${t.replace(/'/g, "''")}'`;
function colA1(c: number) { let s = ""; c += 1; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; }

async function readGrid(token: string, id: string, title: string): Promise<Grid> {
  const range = encodeURIComponent(`${q1(title)}!A1:N150`);
  const j = await gapi(token, "GET", `${API}/${id}?ranges=${range}&fields=sheets(merges,data.rowData.values(formattedValue,userEnteredValue))`);
  const sh = j.sheets[0];
  const rows = sh.data?.[0]?.rowData ?? [];
  const vals: string[][] = [], formula: boolean[][] = [];
  rows.forEach((rd: any, r: number) => {
    vals[r] = []; formula[r] = [];
    (rd.values ?? []).forEach((v: any, c: number) => {
      vals[r][c] = String(v.formattedValue ?? "").trim();
      formula[r][c] = !!v.userEnteredValue?.formulaValue;
    });
  });
  return { vals, formula, merges: sh.merges ?? [] };
}

function findCell(g: Grid, re: RegExp, startRow = 0) {
  for (let r = startRow; r < g.vals.length; r++)
    for (let c = 0; c < Math.min((g.vals[r] ?? []).length, 11); c++)
      if (re.test(g.vals[r][c] ?? "")) return { row: r, col: c };
  return null;
}
function rightOf(g: Grid, cell: { row: number; col: number }) {
  const m = g.merges.find((m: any) => cell.row >= (m.startRowIndex ?? 0) && cell.row < m.endRowIndex &&
    cell.col >= (m.startColumnIndex ?? 0) && cell.col < m.endColumnIndex);
  return { row: cell.row, col: m ? m.endColumnIndex : cell.col + 1 };
}

// ───────── 본체 ─────────
export async function writeQuote(q: any, reqText: string, sheetId: string, saJson: string) {
  const token = await googleToken(saJson);

  // 1. 양식 탭 복사 → 단체명 이름으로 맨 앞에
  const meta = await gapi(token, "GET", `${API}/${sheetId}?fields=sheets.properties(sheetId,title)`);
  const tabs: { sheetId: number; title: string }[] = meta.sheets.map((s: any) => s.properties);
  const names: string[] = q.tplKey === "TEMPLATES.당일" ? CFG.TEMPLATES["당일"] : CFG.TEMPLATES[q.tplKey];
  const tpl = names.map((n) => tabs.find((t) => t.title === n)).find(Boolean);
  if (!tpl) throw new Error(`양식 탭을 못 찾음: ${names.join(", ")}`);
  let title = q.org, n = 2;
  while (tabs.some((t) => t.title === title)) title = `${q.org} (${n++})`;
  const copied = await gapi(token, "POST", `${API}/${sheetId}/sheets/${tpl.sheetId}:copyTo`, { destinationSpreadsheetId: sheetId });
  const gid: number = copied.sheetId;
  await gapi(token, "POST", `${API}/${sheetId}:batchUpdate`, { requests: [
    { updateSheetProperties: { properties: { sheetId: gid, title, index: 0 }, fields: "title,index" } },
  ] });

  // 2. 줄 끼워 넣기 (추가 강당·객실, 아동 할인)
  let g = await readGrid(token, sheetId, title);
  const head = findCell(g, /^서비스종류$/);
  if (!head) throw new Error("표 머리(서비스종류)를 못 찾음");
  const hv = g.vals[head.row] ?? [];
  const col: Record<string, number> = {};
  ["서비스종류", "내용", "수량", "단가", "세액", "합계", "비고"].forEach((k) => { const i = hv.indexOf(k); if (i >= 0 && i < 11) col[k] = i; });
  const kindCol = col["서비스종류"] ?? 1;
  const sel = findCell(g, /선택사항/, head.row);
  const endRow = sel ? sel.row - 1 : head.row + 15;
  const isHall = (k: string) => /강당$|강당 OR|강당 or/.test(k) && !/음향/.test(k);
  let pkgRow = -1, hallRow = -1;
  for (let r = head.row + 1; r <= endRow; r++) {
    const k = g.vals[r]?.[kindCol] ?? "";
    if (pkgRow < 0 && /패키지$/.test(k)) pkgRow = r;
    if (hallRow < 0 && isHall(k)) hallRow = r;
  }
  const extras: any[] = q.extraHalls ?? [];
  const reqs: any[] = [];
  const copyFmt = (from: number, to: number, count: number) => ({ copyPaste: {
    source: { sheetId: gid, startRowIndex: from, endRowIndex: from + 1, startColumnIndex: 0, endColumnIndex: 11 },
    destination: { sheetId: gid, startRowIndex: to, endRowIndex: to + count, startColumnIndex: 0, endColumnIndex: 11 },
    pasteType: "PASTE_FORMAT" } });
  if (extras.length && hallRow >= 0) {
    reqs.push({ insertDimension: { range: { sheetId: gid, dimension: "ROWS", startIndex: hallRow + 1, endIndex: hallRow + 1 + extras.length }, inheritFromBefore: true } });
    reqs.push(copyFmt(hallRow, hallRow + 1, extras.length));
  }
  const kidRow = q.kids && pkgRow >= 0 && hallRow >= 0 ? pkgRow + 1 : -1;
  if (kidRow >= 0) {
    reqs.push({ insertDimension: { range: { sheetId: gid, dimension: "ROWS", startIndex: kidRow, endIndex: kidRow + 1 }, inheritFromBefore: true } });
    reqs.push(copyFmt(pkgRow, kidRow, 1));
  }
  if (reqs.length) {
    await gapi(token, "POST", `${API}/${sheetId}:batchUpdate`, { requests: reqs });
    g = await readGrid(token, sheetId, title);
  }
  const shift = kidRow >= 0 ? 1 : 0;
  const hallRow2 = hallRow >= 0 ? hallRow + shift : -1;

  // 3. 칸 채우기 (메모리에 모았다가 한 번에)
  const writes: { row: number; col: number; v: unknown }[] = [];
  const marks: { row: number; col: number; note: string; color: string; wrap?: boolean }[] = [];
  const put = (row: number, c: number | undefined, v: unknown) => { if (c !== undefined) writes.push({ row, col: c, v }); };
  const setC = (r: number, k: string, v: unknown) => put(r, col[k], v);
  const setSum = (r: number, v: number) => { const c = col["합계"]; if (c !== undefined && !g.formula[r]?.[c]) put(r, c, v); };
  const setRight = (re: RegExp, v: unknown, flag?: string | null) => {
    const c = findCell(g, re); if (!c) return null;
    const t = rightOf(g, c); put(t.row, t.col, v);
    if (flag) marks.push({ ...t, note: flag, color: "#fff59d" });
    return t;
  };

  const t = priceTotals_(q);
  const plabel = periodLabel_(q.period);
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const dateCell = findCell(g, /^\d{4}-\d{2}-\d{2}$/); if (dateCell) put(dateCell.row, dateCell.col, today);
  setRight(/^단체명$/, q.org);
  const loc = findCell(g, /^소재지$/);
  const cRow = findCell(g, /^담당자$/, loc ? loc.row : 0);
  if (cRow) { const x = rightOf(g, cRow); put(x.row, x.col, q.contact ? `${q.contact} 님` : ""); }
  setRight(/^연락처$/, q.phone);
  setRight(/^인원수$/, q.people);
  setRight(/^계약일자$/, scheduleLine_(q), q.checkin ? null : "날짜 확인 필요");

  const meals = CFG.MEALS[q.period];
  let hallDone = false, ondolDone = false, pensionDone = false;
  for (let r = head.row + 1; r <= endRow + extras.length + shift; r++) {
    if (r === kidRow || (hallRow2 >= 0 && r > hallRow2 && r <= hallRow2 + extras.length)) continue;
    const kind = g.vals[r]?.[kindCol] ?? "";
    const content = col["내용"] !== undefined ? g.vals[r]?.[col["내용"]] ?? "" : "";
    if (/패키지$/.test(kind)) {
      setC(r, "서비스종류", q.pkgName);
      setC(r, "내용", `${plabel} ${q.people}명(최소보증인원)`);
      setC(r, "수량", q.people); setC(r, "단가", q.unit);
      setC(r, "세액", q.vat ? Math.round(q.unit * 0.1) : 0);
      setSum(r, q.vat ? Math.round(q.unit * 1.1) * q.people : q.unit * q.people);
    } else if (/^BBQ/.test(kind)) {
      setC(r, "수량", q.bbq ? q.people : "—");
      setC(r, "단가", q.bbq ? meals.bbq : "제외");
      if (!q.bbq) setC(r, "내용", "미이용");
      if (col["비고"] !== undefined && meals.total) setC(r, "비고", q.bbq ? meals.total : "");
    } else if (/서비스 메뉴/.test(kind)) {
      setC(r, "수량", q.bbq ? q.people : "—"); setC(r, "단가", q.bbq ? "포함" : "제외");
    } else if (/^한식/.test(kind)) {
      setC(r, "내용", q.bbq ? meals.korean : (meals.noBbq || meals.korean));
      setC(r, "수량", q.people); setC(r, "단가", "포함");
    } else if (/객실/.test(kind) && /펜션/.test(content)) {
      pensionDone = true;
      setC(r, "내용", pensionText_(q.pensions));
      setC(r, "수량", q.pensions.length); setC(r, "단가", q.pensions.length ? "포함" : "미배정");
    } else if (/객실/.test(kind) && /온돌|침대/.test(content)) {
      ondolDone = true;
      setC(r, "내용", `${q.twin ? "2인1실" : "3인1실"} 온돌룸 (본관동)`);
      setC(r, "수량", q.ondol); setC(r, "단가", "포함");
    } else if (isHall(kind) && !hallDone) {
      hallDone = true;
      setC(r, "서비스종류", q.hall);
      setC(r, "내용", `${plabel.replace(" ", "")} 단독사용`);
      setC(r, "수량", 1); setC(r, "단가", "포함");
    }
  }
  extras.forEach((h, i) => {
    const r = hallRow2 + 1 + i;
    setC(r, "서비스종류", h.name); setC(r, "내용", h.label);
    setC(r, "수량", h.qty); setC(r, "단가", h.day);
    setC(r, "세액", q.vat ? Math.round(h.day * 0.1) : 0);
    setSum(r, q.vat ? Math.round(h.amount * 1.1) : h.amount);
  });
  if (kidRow >= 0) {
    setC(kidRow, "서비스종류", "초등이하 할인"); setC(kidRow, "내용", `초등 이하 ${q.kids}명`);
    setC(kidRow, "수량", q.kids); setC(kidRow, "단가", -CFG.KID_DISCOUNT); setC(kidRow, "세액", 0);
    setSum(kidRow, -CFG.KID_DISCOUNT * q.kids * (q.vat ? 1.1 : 1));
  }
  if (!pensionDone && q.pensions.length) q.flags.push(`양식에 펜션 줄이 없어 펜션 ${q.pensions.join("·")}동은 비고에 직접 적어주세요`);
  if (!ondolDone) q.flags.push("양식에 온돌룸 줄이 없음");

  // 합계·계약금·잔금
  const vatTxt = q.vat ? "부가세 포함" : "부가세 제외";
  const tot = findCell(g, /^총 금액 \(/);
  if (tot) { put(tot.row, tot.col, `총 금액 (식사+강당+음향기기)${vatTxt}`); const x = rightOf(g, tot); if (!g.formula[x.row]?.[x.col]) put(x.row, x.col, t.total); }
  const top = findCell(g, /^총 금액$/);
  if (top) { const x = rightOf(g, top); if (!g.formula[x.row]?.[x.col]) put(x.row, x.col, t.total); }
  for (const [re, amount] of [[/^계약금 입금/, t.deposit], [/^잔금/, t.balance]] as [RegExp, number][]) {
    const c = findCell(g, re); if (!c) continue;
    const a = rightOf(g, c); put(a.row, a.col, t.account);
    const b = rightOf(g, a); if (!g.formula[b.row]?.[b.col]) put(b.row, b.col, amount);
  }

  // 요청 원문(M5)과 확인 메모(M3)
  put(4, 12, reqText);
  const memo = [`[자동작성 확인용] ${q.period} / ${q.type} / 단가 ${q.unit.toLocaleString()} / 강당 ${q.hall} / 펜션 ${q.pensions.join("·") || "없음"} / 온돌 ${q.ondol}실 / 총액 ${t.total.toLocaleString()}${q.vat ? " (부가세 포함)" : ""}`];
  if (q.flags.length) memo.push(`확인 필요: ${q.flags.join(" / ")}`);
  put(2, 12, memo.join("\n"));
  marks.push({ row: 2, col: 12, note: "", color: q.flags.length ? "#fff59d" : "#e8f5e9", wrap: true });

  // 4. 한 번에 쓰기
  await gapi(token, "POST", `${API}/${sheetId}/values:batchUpdate`, {
    valueInputOption: "USER_ENTERED",
    data: writes.map((w) => ({ range: `${q1(title)}!${colA1(w.col)}${w.row + 1}`, values: [[w.v]] })),
  });
  const hex = (h: string) => ({ red: parseInt(h.slice(1, 3), 16) / 255, green: parseInt(h.slice(3, 5), 16) / 255, blue: parseInt(h.slice(5, 7), 16) / 255 });
  await gapi(token, "POST", `${API}/${sheetId}:batchUpdate`, { requests: marks.map((m) => ({ updateCells: {
    range: { sheetId: gid, startRowIndex: m.row, endRowIndex: m.row + 1, startColumnIndex: m.col, endColumnIndex: m.col + 1 },
    rows: [{ values: [{ note: m.note || undefined, userEnteredFormat: { backgroundColor: hex(m.color), ...(m.wrap ? { wrapStrategy: "WRAP" } : {}) } }] }],
    fields: (m.note ? "note," : "") + "userEnteredFormat.backgroundColor" + (m.wrap ? ",userEnteredFormat.wrapStrategy" : ""),
  } })) });

  return { title, gid, url: `https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=${gid}`, totals: t };
}
