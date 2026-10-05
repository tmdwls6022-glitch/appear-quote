// 어피어 카톡 채널 견적 챗봇 (Supabase Edge Function "kakao-quote")
//
// 카카오 오픈빌더 스킬 → 이 함수 → Gemini(요청 읽기) + 노션(강당·펜션 예약 확인)
//   → 가격 계산(core.js) → 구글 시트에 견적 탭 직접 작성(sheet.ts, Sheets API) → 카톡 답장
// Apps Script는 쓰지 않는다(콜로그·기관수집의 하루 한도와 무관).
//
// 명령 (채널 대화창)
//   직원등록 이름   : 직원 등록 요청 (승인 전엔 견적 못 씀)
//   견적: <요청 글>  : 견적서 작성
//   결과            : 가장 최근 견적 결과 다시 보기 (콜백 승인 전용)
//   모의 / 모의 새로 / 모의결과 : 카톡방 요청글로 읽기 정확도 시험 (mock.ts, 시트에 안 씀)
// 답장 아래 버튼 [PDF] [사진] [시트] — 누르면 그때 견적서 부분(A~K열)만 PDF·PNG로 만든다(jin 10/5).
//   링크: GET ?f=pdf|png&j=작업번호&k=비밀값. 시트에서 고친 내용도 누를 때 반영된다.
// 그 밖의 말은 안내 문구로 답한다. 고객에게 견적을 자동으로 보내지 않는다.
//
// 비밀값 (Supabase → Edge Functions → Secrets, jin이 직접 입력)
//   GEMINI_API_KEY, NOTION_TOKEN, GOOGLE_SA_JSON(구글 서비스 계정 키 JSON)
//   QUOTE_SHEET_ID(선택, 없으면 테스트 시트 '자동화 복습')

import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildQuote_, assignRooms_, busyFromBookings_, scheduleLine_ } from "./core.js";
import { CFG } from "./core.js";
import { writeQuote, exportPdf } from "./sheet.ts";
import { pdfToPng } from "./image.ts";
import { startMock, runMock, mockSummary } from "./mock.ts";

const DEFAULT_SHEET = "1Ir02b_-zNbLCUkemxEG0yM63DCUJShUwhY0D_RkcDm0"; // 자동화 복습(테스트 시트)

const NOTION_DS = "1cf33639-fc7f-80e9-8abd-000bf8bbb0d0"; // DB_인입콜
const NOTION_VERSION = "2025-09-03";
const BRANCH = "어피어";

const env = (k: string) => Deno.env.get(k) ?? "";
const db = () => createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

// ───────── 카카오 응답 ─────────
function kakaoText(text: string) {
  return { version: "2.0", template: { outputs: [{ simpleText: { text: text.slice(0, 990) } }] } };
}
function json(obj: unknown) {
  return new Response(JSON.stringify(obj), { headers: { "Content-Type": "application/json; charset=utf-8" } });
}
// 요약 글 + 파일 버튼 카드
function fileLink(f: string, jobId: number, k: string) {
  return `${env("SUPABASE_URL")}/functions/v1/kakao-quote?f=${f}&j=${jobId}&k=${k}`;
}
function kakaoQuote(text: string, jobId: number | null, res: any) {
  const outputs: any[] = [{ simpleText: { text: text.slice(0, 990) } }];
  if (jobId && res?.share) outputs.push({ textCard: {
    title: "견적서 파일",
    description: "누르면 견적서 부분만 PDF·사진으로 열려요.\n시트에서 고친 내용도 반영돼요.",
    buttons: [
      { action: "webLink", label: "PDF", webLinkUrl: fileLink("pdf", jobId, res.share) },
      { action: "webLink", label: "사진", webLinkUrl: fileLink("png", jobId, res.share) },
      { action: "webLink", label: "시트 열기", webLinkUrl: res.url },
    ],
  } });
  return { version: "2.0", template: { outputs } };
}

const HELP = [
  "어피어플레이스 견적 도우미예요.",
  "",
  "직원용 명령",
  "· 견적: (고객 견적요청 글 붙여넣기)",
  "· 결과 : 마지막 견적 다시 보기",
  "· 모의 / 모의결과 : 견적 읽기 정확도 시험",
  "· 직원등록 이름 : 처음 한 번",
].join("\n");

// ───────── Gemini ─────────
let modelCache: { name: string; at: number } | null = null;
async function pickModel(key: string) {
  if (modelCache && Date.now() - modelCache.at < 6 * 3600e3) return modelCache.name;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${key}`);
  if (!r.ok) throw new Error(`모델 목록 ${r.status}`);
  const ver = (n: string) => { const m = n.match(/gemini-([\d.]+)/); return m ? parseFloat(m[1]) : 99; };
  const names = ((await r.json()).models ?? [])
    .filter((m: any) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((m: any) => String(m.name).replace("models/", ""))
    .filter((n: string) => /^gemini-[\d.]+-flash$/.test(n) || /^gemini-[\d.]+-flash-latest$/.test(n) || n === "gemini-flash-latest")
    .sort((a: string, b: string) => ver(b) - ver(a));
  if (!names.length) throw new Error("flash 모델 없음");
  modelCache = { name: names[0], at: Date.now() };
  return names[0];
}

function today() {
  return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // KST
}

// asof: 요청을 받은 날(모의 견적용). 없으면 오늘.
async function parseRequest(text: string, asof?: string) {
  const key = env("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY 없음");
  const prompt = [
    "너는 수련원 예약 담당이야. 아래 고객 견적요청 글을 읽고 JSON 하나만 돌려줘. 모르는 값은 null.",
    `오늘 날짜: ${asof || today()} (연도가 없으면 오늘 이후 가장 가까운 날짜로).`,
    "필드:",
    "org(단체명), contact(담당자 이름), phone, adults(성인 수, 숫자), kids(초등 이하 수, 숫자, 없으면 0),",
    "checkin(YYYY-MM-DD), checkout(YYYY-MM-DD), nights(박 수, 당일이면 0),",
    "scheduleText(고객이 쓴 일정 원문), customerType(church|company|university|group|agency 중 하나),",
    "bbq(true면 바베큐 원함, false면 원하지 않음/제외, null이면 언급 없음),",
    "twinRoom(2인1실 원하면 true), vatDoc(세금계산서·현금영수증·카드결제 언급 시 true),",
    'extraHalls(추가로 쓰고 싶다는 강당 이름 배열, 예 ["1강당"]), wantsMainHall(대강당 원하면 true), extraRooms(객실을 몇 실 더 원하는지 숫자, 없으면 0), skipMeals(기본 패키지에서 빼 달라는 식사 끼니 수, 없으면 0),',
    'notes(그 밖의 요청 한 줄), unsure(확실하지 않은 점 배열, 예: "날짜 후보가 2개").',
    "",
    "견적요청 글:",
    text,
  ].join("\n");
  const model = await pickModel(key);
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
    }),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const out = (await r.json()).candidates[0].content.parts[0].text as string;
  return JSON.parse(out.replace(/^```json\s*|```$/g, ""));
}

// ───────── 노션: 겹치는 예약 ─────────
function propText(p: any): string {
  if (!p) return "";
  switch (p.type) {
    case "title": case "rich_text": return (p[p.type] ?? []).map((t: any) => t.plain_text).join("");
    case "select": case "status": return p[p.type] ? p[p.type].name : "";
    case "multi_select": return (p.multi_select ?? []).map((o: any) => o.name).join(",");
    case "checkbox": return p.checkbox ? "Y" : "";
    case "formula": return p.formula ? String(p.formula[p.formula.type] ?? "") : "";
    default: return "";
  }
}
const propBool = (p: any) => (!p ? false : p.type === "checkbox" ? !!p.checkbox : !!propText(p));
function shiftDate(ymd: string, n: number) {
  const d = new Date(ymd + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}

async function notionBookings(checkin: string, checkout: string | null) {
  const token = env("NOTION_TOKEN");
  if (!token) throw new Error("NOTION_TOKEN 없음");
  const end = checkout || checkin;
  const body: any = { page_size: 100, filter: { and: [
    { property: "체크인", date: { on_or_before: end } },
    { property: "체크인", date: { on_or_after: shiftDate(checkin, -10) } },
  ] } };
  const out: any[] = [];
  let cursor: string | null = null;
  do {
    if (cursor) body.start_cursor = cursor;
    const r = await fetch(`https://api.notion.com/v1/data_sources/${NOTION_DS}/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Notion-Version": NOTION_VERSION, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      console.error("notion", r.status, (await r.text()).slice(0, 300));
      const why = r.status === 404 ? "통합이 DB_인입콜에 연결 안 됨"
        : r.status === 401 ? "노션 키가 맞지 않음" : `오류 ${r.status}`;
      throw new Error(`${why} → 강당·펜션 겹침은 직접 확인`);
    }
    const j = await r.json();
    for (const pg of j.results) {
      const p = pg.properties;
      const d = p["체크인"]?.date; if (!d) continue;
      const s = d.start.slice(0, 10), e = (d.end || d.start).slice(0, 10);
      if (e < checkin || s > end) continue;
      if (!propText(p["예약지점"]).includes(BRANCH)) continue;
      if (!(propBool(p["예약확정고객"]) || propBool(p["가예약"]))) continue;
      out.push({ name: propText(p["단체명 "]) || propText(p["단체명"]), start: s, end: e,
        halls: propText(p["강당 배정"]), pensions: propText(p["어피어 펜션동"]) });
    }
    cursor = j.has_more ? j.next_cursor : null;
  } while (cursor);
  return out;
}

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

function summary(q: any, t: any, url: string) {
  const lines = [
    `✅ ${q.org} 견적 탭을 만들었어요`,
    `${q.period} · ${q.checkin ? scheduleLine_(q) : "날짜 확인 필요"} · ${q.people}명`,
    `1인 ${won(q.unit)} · ${q.hall} · 펜션 ${q.pensions.length ? q.pensions.join("·") : "없음"} · 온돌 ${q.ondol}실`,
  ];
  for (const x of q.extraHalls ?? []) lines.push(`+ ${x.name} ${won(x.amount)}`);
  lines.push(`총 ${won(t.total)}${q.vat ? " (부가세 포함)" : ""}`);
  lines.push(`계약금 ${won(t.deposit)} / 잔금 ${won(t.balance)}`);
  if (q.flags.length) lines.push("", "확인할 것:", ...q.flags.map((f: string) => `· ${f}`));
  lines.push("", url);
  return lines.join("\n");
}

async function makeQuote(text: string) {
  const req = await parseRequest(text);
  const q: any = buildQuote_(req);
  let bookings: any[] = [];
  if (q.checkin) {
    try { bookings = await notionBookings(q.checkin, q.checkout); }
    catch (e) { q.flags.push(`노션 예약 확인 실패: ${(e as Error).message}`); }
  } else q.flags.push("날짜가 확실하지 않아 예약 현황을 못 봤어요");
  assignRooms_(q, busyFromBookings_(bookings));
  const sa = env("GOOGLE_SA_JSON");
  if (!sa) throw new Error("GOOGLE_SA_JSON 없음");
  const w = await writeQuote(q, text, env("QUOTE_SHEET_ID") || DEFAULT_SHEET, sa);
  return { reply: summary(q, w.totals, w.url), result: { title: w.title, url: w.url, q, t: w.totals,
    sheetId: w.sheetId, gid: w.gid, range: w.range, share: crypto.randomUUID().replace(/-/g, "") } };
}

// ───────── 작업 실행 (콜백 또는 기록) ─────────
async function runJob(userKey: string, text: string, callbackUrl: string | null) {
  const sb = db();
  const { data: job } = await sb.from("quote_bot_jobs").insert({ user_key: userKey, request: text }).select("id").single();
  let reply: string, status = "done", result: unknown = null;
  try { ({ reply, result } = await makeQuote(text)); }
  catch (e) { status = "error"; reply = `⚠️ 견적을 못 만들었어요: ${(e as Error).message}`; }
  if (job) await sb.from("quote_bot_jobs").update({ status, reply, result, finished_at: new Date().toISOString() }).eq("id", job.id);
  if (callbackUrl) {
    await fetch(callbackUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(kakaoQuote(reply, job?.id ?? null, result)) })
      .catch(() => {});
  }
}

// ───────── PDF·사진 버튼 ─────────
function fileError(msg: string, status = 400) {
  return new Response(msg, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
async function serveFile(u: URL) {
  const f = u.searchParams.get("f"), j = Number(u.searchParams.get("j")), k = u.searchParams.get("k") ?? "";
  if ((f !== "pdf" && f !== "png") || !j || !k) return fileError("잘못된 링크예요.");
  const { data: job } = await db().from("quote_bot_jobs").select("result").eq("id", j).maybeSingle();
  const r: any = job?.result;
  if (!r?.share || r.share !== k) return fileError("링크가 맞지 않아요.", 404);
  try {
    const pdf = await exportPdf(r.sheetId, r.gid, r.range, env("GOOGLE_SA_JSON"));
    const body = f === "pdf" ? pdf : await pdfToPng(pdf, CFG.EXPORT.pngScale);
    // 파일 이름 한글은 RFC 5987 방식으로 (깨짐 방지), 영문 이름도 같이
    const name = `견적서_${r.title}.${f}`;
    return new Response(body, { headers: {
      "Content-Type": f === "pdf" ? "application/pdf" : "image/png",
      "Content-Disposition": `inline; filename="quote_${j}.${f}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    } });
  } catch (e) {
    console.error("file", f, j, (e as Error).message);
    return fileError(`${f === "pdf" ? "PDF" : "사진"}를 못 만들었어요: ${(e as Error).message}`, 500);
  }
}

// ───────── 진입점 ─────────
Deno.serve(async (req) => {
  if (req.method === "GET") {
    const u = new URL(req.url);
    if (u.searchParams.has("f")) return serveFile(u);
    return new Response("ok");
  }
  if (req.method !== "POST") return new Response("ok");
  let body: any;
  try { body = await req.json(); } catch { return json(kakaoText(HELP)); }
  // 모의 사례 올리기 (카톡 아님, tests/load_cases.py 가 직접 POST). 승인된 직원 키가 있어야 함. jin 10/5
  if (Array.isArray(body?.mockCases)) {
    const sb0 = db();
    const { data: u0 } = await sb0.from("quote_bot_users").select("approved").eq("user_key", String(body.userKey ?? "")).maybeSingle();
    if (!u0?.approved) return new Response("forbidden", { status: 403 });
    const rows = body.mockCases.map((c: any) => ({ id: String(c.id), request: String(c.request), asof: c.asof,
      expect: c.expect ?? {}, note: c.note ?? null, active: c.active ?? true }));
    const { error } = await sb0.from("quote_test_cases").upsert(rows, { onConflict: "id" });
    return json(error ? { ok: false, error: error.message } : { ok: true, count: rows.length });
  }
  const ur = body?.userRequest ?? {};
  const userKey: string = ur.user?.id ?? "";
  const utter: string = String(ur.utterance ?? "").trim();
  const callbackUrl: string | null = ur.callbackUrl ?? null;
  const sb = db();

  const reg = utter.match(/^직원\s*등록\s*(.*)$/);
  if (reg) {
    await sb.from("quote_bot_users").upsert({ user_key: userKey, label: reg[1].trim() || null }, { onConflict: "user_key", ignoreDuplicates: false });
    return json(kakaoText(`등록 요청을 받았어요(${reg[1].trim() || "이름 없음"}). 관리자가 승인하면 "견적:"을 쓸 수 있어요.`));
  }

  const m = utter.match(/^견적\s*[:：]?\s*([\s\S]+)$/);
  const isResult = /^결과$/.test(utter);
  const mock = utter.match(/^모의\s*(새로|결과)?$/);
  if (!m && !isResult && !mock) return json(kakaoText(HELP));

  const { data: u } = await sb.from("quote_bot_users").select("approved").eq("user_key", userKey).maybeSingle();
  if (!u?.approved) return json(kakaoText('직원용 기능이에요. 처음이면 "직원등록 이름"을 보내 주세요.'));

  if (isResult) {
    const { data: last } = await sb.from("quote_bot_jobs").select("id, status, reply, result").eq("user_key", userKey)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!last) return json(kakaoText("아직 만든 견적이 없어요."));
    if (last.status === "running") return json(kakaoText("아직 만드는 중이에요. 잠시 뒤 다시 '결과'를 보내 주세요."));
    return json(kakaoQuote(last.reply ?? "", last.id, last.result));
  }

  if (mock) {
    if (mock[1] === "결과") return json(kakaoText(await mockSummary(sb)));
    const s = await startMock(sb, mock[1] === "새로");
    if (!s.picked.length) return json(kakaoText("모의 사례가 없거나 지금 돌리는 중이에요. '모의결과'로 확인해 주세요."));
    // @ts-ignore EdgeRuntime는 Supabase 런타임 전역
    EdgeRuntime.waitUntil(runMock(sb, parseRequest, s.runId, s.picked));
    return json(kakaoText(`모의 견적 ${s.runId}: ${s.done + 1}~${s.done + s.picked.length}번째 (전체 ${s.total}) 돌리는 중이에요. 1분쯤 뒤 '모의결과'를 보내 주세요.`));
  }

  const text = m![1].trim();
  // @ts-ignore EdgeRuntime는 Supabase 런타임 전역
  EdgeRuntime.waitUntil(runJob(userKey, text, callbackUrl));
  if (callbackUrl) return json({ version: "2.0", useCallback: true, data: { text: "견적서 쓰는 중이에요. 30초쯤 걸려요." } });
  return json(kakaoText("견적서 쓰는 중이에요. 30초 뒤 '결과'라고 보내 주세요."));
});
