// 모의 견적 채점 (순수 함수) — mock.ts 와 tests/ 가 씀.
// jin 10/5: 카톡 견적방 요청글로 만든 정답(quote_test_cases.expect)과 Gemini 가 읽은 값을 비교한다.
//
// expect 필드 (없는 필드는 채점 안 함)
//   ci, co      : 체크인·체크아웃 YYYY-MM-DD (null 이면 "날짜 모름"이 정답)
//   n           : 박 수 (당일 0)
//   p           : 전체 인원(성인+아동). 숫자 또는 [최소, 최대]
//   k           : 초등 이하 인원. 숫자 또는 [최소, 최대]
//   t           : church | company | university | group | agency
//   bbq, mh, twin, vat : 바베큐 원함 / 대강당 원함 / 2인1실 / 세금계산서 (true·false)
//   unsure      : true 면 날짜 후보가 여럿 등 → unsure 배열이 비어 있으면 틀림
import { buildQuote_ } from "./core.js";

const inRange = (v, e) => Array.isArray(e) ? v >= e[0] && v <= e[1] : v === e;
const nightsOf = (r) => {
  if (r.nights !== null && r.nights !== undefined) return Number(r.nights);
  if (r.checkin && r.checkout) return Math.round((new Date(r.checkout) - new Date(r.checkin)) / 86400000);
  return null;
};

// 정답으로 만든 요청(가격 비교용). 인원 범위는 Gemini 값이 범위 안이면 그 값, 아니면 최대값.
function goldRequest_(e, parsed) {
  const pick = (exp, got) => exp === undefined ? got : Array.isArray(exp) ? (inRange(got, exp) ? got : exp[1]) : exp;
  const p = pick(e.p, (Number(parsed.adults) || 0) + (Number(parsed.kids) || 0));
  const k = pick(e.k, Number(parsed.kids) || 0);
  return {
    checkin: e.ci !== undefined ? e.ci : parsed.checkin, checkout: e.co !== undefined ? e.co : parsed.checkout,
    nights: e.n !== undefined ? e.n : parsed.nights, adults: p - k, kids: k,
    customerType: e.t !== undefined ? e.t : parsed.customerType,
    bbq: e.bbq !== undefined ? e.bbq : parsed.bbq, twinRoom: e.twin !== undefined ? e.twin : parsed.twinRoom,
    vatDoc: e.vat !== undefined ? e.vat : parsed.vatDoc, wantsMainHall: e.mh !== undefined ? e.mh : parsed.wantsMainHall,
  };
}

function scoreCase_(e, parsed) {
  const miss = [];
  const add = (field, want, got) => miss.push({ field, want, got });
  const got = {
    ci: parsed.checkin || null, co: parsed.checkout || null, n: nightsOf(parsed),
    p: (Number(parsed.adults) || 0) + (Number(parsed.kids) || 0), k: Number(parsed.kids) || 0,
    t: parsed.customerType || null, bbq: parsed.bbq === undefined ? null : parsed.bbq,
    mh: !!parsed.wantsMainHall, twin: !!parsed.twinRoom, vat: !!parsed.vatDoc,
  };
  if (e.ci !== undefined && got.ci !== e.ci) add("ci", e.ci, got.ci);
  if (e.co !== undefined && e.co !== null && got.co !== e.co) add("co", e.co, got.co);
  if (e.n !== undefined && got.n !== e.n) add("n", e.n, got.n);
  if (e.p !== undefined && !inRange(got.p, e.p)) add("p", e.p, got.p);
  if (e.k !== undefined && !inRange(got.k, e.k)) add("k", e.k, got.k);
  if (e.t !== undefined && e.t !== null && got.t !== e.t) add("t", e.t, got.t);
  if (e.bbq !== undefined && got.bbq !== e.bbq) add("bbq", e.bbq, got.bbq);
  for (const f of ["mh", "twin", "vat"]) if (e[f] !== undefined && got[f] !== e[f]) add(f, e[f], got[f]);
  if (e.unsure && !(parsed.unsure || []).length) add("unsure", "후보 여럿·애매함 표시", "표시 없음");

  // 단가: 정답으로 계산한 값과 Gemini 값으로 계산한 값
  const unitBot = buildQuote_(parsed).unit;
  const unitGold = buildQuote_(goldRequest_(e, parsed)).unit;
  return { ok: miss.length === 0, unitOk: unitBot === unitGold, unitBot, unitGold, miss, got };
}

export { scoreCase_, goldRequest_, inRange };
