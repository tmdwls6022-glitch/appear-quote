// 모의 견적 (jin 10/5) — 카톡 견적방 요청글(quote_test_cases)을 Gemini 로 읽혀 정답과 비교한다.
// 시트에 쓰지 않고 노션도 보지 않는다. 결과는 quote_test_runs 에만 남긴다.
//   "모의"     : 진행 중인 회차의 남은 사례를 한 번에 BATCH 건씩 돌림 (다 끝났으면 새 회차 시작)
//   "모의 새로" : 새 회차 시작
//   "모의결과"  : 최근 회차 점수와 틀린 사례

import { buildQuote_ } from "./core.js";
import { scoreCase_ } from "./eval.js";

const BATCH = 25;      // 한 번 호출에 돌릴 사례 수 (Edge Function 실행 시간 한도 안에서)
const PARALLEL = 3;    // Gemini 동시 호출 수

type Parse = (text: string, asof?: string) => Promise<any>;

async function latestRun(sb: any) {
  const { data } = await sb.from("quote_test_runs").select("run_id").order("id", { ascending: false }).limit(1).maybeSingle();
  return data?.run_id as string | undefined;
}

// 이번에 돌릴 사례를 골라 running 으로 먼저 박아 둔다(겹쳐 호출돼도 같은 사례를 두 번 돌리지 않게).
export async function startMock(sb: any, fresh: boolean) {
  const { data: cases } = await sb.from("quote_test_cases").select("id").eq("active", true).order("id");
  const all = (cases ?? []).map((c: any) => c.id as string);
  if (!all.length) return { runId: "", picked: [] as string[], total: 0, done: 0 };
  let runId = fresh ? undefined : await latestRun(sb);
  let doneIds: string[] = [];
  if (runId) {
    const { data } = await sb.from("quote_test_runs").select("case_id").eq("run_id", runId);
    doneIds = (data ?? []).map((r: any) => r.case_id);
    if (all.every((id: string) => doneIds.includes(id))) runId = undefined; // 다 끝난 회차 → 새로
  }
  if (!runId) { runId = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace("T", " "); doneIds = []; }
  const picked = all.filter((id: string) => !doneIds.includes(id)).slice(0, BATCH);
  if (picked.length) await sb.from("quote_test_runs").insert(picked.map((id: string) => ({ run_id: runId, case_id: id, status: "running" })));
  return { runId, picked, total: all.length, done: doneIds.length };
}

export async function runMock(sb: any, parse: Parse, runId: string, ids: string[]) {
  const { data: cases } = await sb.from("quote_test_cases").select("id, request, asof, expect").in("id", ids);
  const queue = [...(cases ?? [])];
  const worker = async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      let row: any;
      try {
        const parsed = await parse(c.request, c.asof);
        const s = scoreCase_(c.expect ?? {}, parsed);
        const q: any = buildQuote_(parsed);
        row = { status: "done", ok: s.ok, unit_ok: s.unitOk, unit_bot: s.unitBot, unit_gold: s.unitGold,
          miss: s.miss, parsed, quote: { period: q.period, people: q.people, type: q.type, unit: q.unit, flags: q.flags } };
      } catch (e) {
        row = { status: "error", ok: false, unit_ok: false, miss: [{ field: "error", want: "", got: String((e as Error).message).slice(0, 300) }] };
      }
      await sb.from("quote_test_runs").update({ ...row, finished_at: new Date().toISOString() }).eq("run_id", runId).eq("case_id", c.id);
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
}

const FIELD: Record<string, string> = { ci: "체크인", co: "체크아웃", n: "박수", p: "인원", k: "아동", t: "단체종류",
  bbq: "바베큐", mh: "대강당", twin: "2인1실", vat: "부가세", unsure: "애매함표시", error: "오류" };
const show = (v: unknown) => Array.isArray(v) ? v.join("~") : v === null || v === undefined ? "없음" : String(v);

export async function mockSummary(sb: any) {
  const runId = await latestRun(sb);
  if (!runId) return "아직 모의 견적을 돌린 적이 없어요. '모의'를 보내 주세요.";
  const { data: rows } = await sb.from("quote_test_runs").select("case_id, status, ok, unit_ok, miss").eq("run_id", runId);
  const { count: total } = await sb.from("quote_test_cases").select("id", { count: "exact", head: true }).eq("active", true);
  const done = (rows ?? []).filter((r: any) => r.status !== "running");
  const running = (rows ?? []).length - done.length;
  const ok = done.filter((r: any) => r.ok).length, unitOk = done.filter((r: any) => r.unit_ok).length;
  const pct = (a: number) => done.length ? Math.round(a * 100 / done.length) : 0;
  const byField: Record<string, number> = {};
  for (const r of done) for (const m of r.miss ?? []) byField[m.field] = (byField[m.field] ?? 0) + 1;
  const lines = [
    `🧪 모의 견적 ${runId}`,
    `진행 ${done.length}/${total ?? "?"}${running ? ` (돌리는 중 ${running})` : ""}`,
    `읽기 전부 맞음 ${ok}/${done.length} (${pct(ok)}%) · 단가 맞음 ${unitOk}/${done.length} (${pct(unitOk)}%)`,
  ];
  const top = Object.entries(byField).sort((a, b) => b[1] - a[1]);
  if (top.length) lines.push("틀린 항목: " + top.map(([f, n]) => `${FIELD[f] ?? f} ${n}`).join(", "));
  const bad = done.filter((r: any) => !r.ok).slice(0, 12);
  if (bad.length) {
    lines.push("", "틀린 사례(일부):");
    for (const r of bad) lines.push(`· ${r.case_id} ` + (r.miss ?? []).slice(0, 3).map((m: any) => `${FIELD[m.field] ?? m.field} ${show(m.want)}→${show(m.got)}`).join(" / "));
  }
  if (done.length + running < (total ?? 0)) lines.push("", "남은 사례가 있어요. '모의'를 한 번 더 보내 주세요.");
  return lines.join("\n");
}
