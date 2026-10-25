// 객실·단가 규칙 시험 — node tests/rooms.test.mjs (jin 10/7)
import assert from "node:assert/strict";
import { buildQuote_, assignRooms_, busyFromBookings_, priceTotals_, CFG } from "../kakao-quote/core.js";
const run = (r, bookings = []) => { const q = buildQuote_(r); assignRooms_(q, busyFromBookings_(bookings)); return { q, t: priceTotals_(q) }; };

// 1. 기본(교회 일반)은 3인1실 온돌만 — 펜션·옵션 없음
let { q } = run({ org: "시험교회", adults: 60, checkin: "2027-01-17", nights: 2, customerType: "church" });
assert.equal(q.roomOptions, false); assert.deepEqual(q.pensions, []); assert.equal(q.ondolOnly, 20); assert.equal(q.ondol, 20);

// 2. 청년부, 펜션 요청, 친목(일반 모임), MT 는 객실옵션 1·2 (10/25 jin: 중고등부는 뺌)
for (const r of [
  { org: "시험교회 청년부", customerType: "church" },
  { org: "시험교회", customerType: "church", wantsPension: true },
  { org: "OO고 동창회", customerType: "group" },
  { org: "시험대 경영학과", customerType: "university" },
]) {
  ({ q } = run({ ...r, adults: 60, checkin: "2026-11-13", nights: 1 }));
  assert.equal(q.roomOptions, true, r.org);
  assert.deepEqual(q.pensions, ["A"]); assert.equal(q.ondol, 10); assert.equal(q.ondolOnly, 20);   // 펜션 A동(30명, jin 10/25) + 온돌 35명/3
}
// 펜션 수: 10명 이상이면 1동만(jin 10/7 Q17·18)
for (const [n, k] of [[9, 0], [10, 1], [39, 1], [40, 1], [69, 1], [70, 1]]) {
  ({ q } = run({ org: "청년부", adults: n, checkin: "2026-11-13", nights: 1, customerType: "church" }));
  assert.equal(q.pensions.length, k, n + "명");
}
// MT 펜션 추가금은 총액에 안 넣음(사람이 정함, jin 10/7)
let rr = run({ org: "시험대", adults: 30, checkin: "2026-11-13", nights: 1, customerType: "university" });
assert.equal(rr.q.pensionPaid, true); assert.equal(rr.t.supply, 49000 * 30);

// 3. 2인1실이면 온돌 2명씩
({ q } = run({ adults: 41, checkin: "2026-11-13", nights: 1, customerType: "church", twinRoom: true }));
assert.equal(q.ondolOnly, 21);

// 4. 2박3일 비수기 평일 12만 / 주말 13만 (jin 10/7 답 7-나)
assert.equal(run({ adults: 40, checkin: "2026-11-11", nights: 2, customerType: "church" }).q.unit, 130000);  // 수~금 — jin 10/20: 비수기 2박3일은 요일 무관 13만
assert.equal(run({ adults: 40, checkin: "2026-11-13", nights: 2, customerType: "church" }).q.unit, 130000);  // 금~일
// 1박2일 비수기 7.5만, 여름 8.5만
assert.equal(run({ adults: 40, checkin: "2026-11-13", nights: 1, customerType: "church" }).q.unit, 75000);
assert.equal(run({ adults: 40, checkin: "2027-07-16", nights: 1, customerType: "church" }).q.unit, 85000);

// 5. 대강당 업그레이드 80만 한 번 (박 수 무관), 여름도 가능 + 확인 표시
let r = run({ adults: 60, checkin: "2026-11-13", nights: 2, customerType: "church", wantsMainHall: true });
assert.deepEqual(r.q.extraHalls.map((h) => [h.name, h.amount]), [["대강당 업그레이드", 800000]]);
r = run({ adults: 60, checkin: "2027-07-16", nights: 1, customerType: "church", wantsMainHall: true });
assert.equal(r.q.extraHalls[0].amount, 3000000); assert.ok(r.q.flags.some((f) => /300만/.test(f)));   // 7~8월 300만
// 1~2월 금토일 낀 때도 300만(jin 10/21 Q40 다), 평일만이면 80만
assert.equal(run({ adults: 60, checkin: "2027-01-15", nights: 1, customerType: "church", wantsMainHall: true }).q.extraHalls[0].amount, 3000000);  // 금
assert.equal(run({ adults: 60, checkin: "2027-01-12", nights: 1, customerType: "church", wantsMainHall: true }).q.extraHalls[0].amount, 800000);   // 화~수

// 6. 대학원·사이버대·야간대 = 회사 단가, 부가세 없음, 기본 계좌
r = run({ adults: 30, checkin: "2026-11-13", nights: 1, customerType: "adultuniv" });
assert.equal(r.q.unit, 75000); assert.equal(r.q.vat, false); assert.equal(r.t.total, 2250000); assert.ok(CFG.ACC_OTHERS.includes(r.t.account));   // jin 10/19·10/20: 부가세 없는 곳은 기본 카카오 3333-15
assert.equal(run({ adults: 30, checkin: "2026-11-13", nights: 1, customerType: "company" }).q.vat, true);

// 7. 당일은 객실 없음
({ q } = run({ adults: 30, checkin: "2026-11-13", nights: 0, customerType: "church" }));
assert.equal(q.ondolOnly, 0);
// 9. jin 10/7 답 64개
assert.equal(run({ adults: 30, checkin: "2026-11-12", nights: 0 }).q.unit, 40000);   // 목 — jin 10/21 카드 4만
assert.equal(run({ adults: 30, checkin: "2026-11-13", nights: 0 }).q.unit, 47000);   // 금
assert.equal(run({ adults: 30, checkin: "2026-11-13", nights: 1, customerType: "university", bbq300: true }).q.unit, 45000);   // MT 300g
assert.equal(run({ adults: 30, checkin: "2026-11-13", nights: 1, customerType: "company", twinRoom: true }).q.unit, 85000);
assert.equal(run({ adults: 30, checkin: "2027-08-13", nights: 1, customerType: "company", twinRoom: true }).q.unit, 85000);   // 성수기도 그대로
assert.equal(run({ adults: 30, checkin: "2027-08-13", nights: 1, customerType: "company" }).q.unit, 85000);                   // 75+1만
assert.equal(run({ adults: 30, checkin: "2026-11-13", nights: 1, customerType: "church", twinRoom: true }).q.unit, 85000);     // 고정
assert.equal(run({ adults: 30, checkin: "2026-11-13", nights: 2, customerType: "university" }).q.unit, 130000);                // 대학 108,000 안 씀
assert.throws(() => run({ adults: 30, checkin: "2026-11-13", nights: 5, customerType: "church" }), /직접 정함/);   // 10/20: 4박5일은 자동(26만), 5박부터 사람이
r = run({ adults: 30, kids: 5, checkin: "2026-11-13", nights: 1, customerType: "church" });
assert.equal(r.t.kidDisc, 0); assert.ok(r.q.flags.some((f) => /초등 이하/.test(f)));
assert.equal(run({ adults: 30, checkin: "2026-11-13", nights: 1, customerType: "church" }).q.hall, "2강당");
assert.equal(run({ adults: 30, checkin: "2026-11-13", nights: 1, customerType: "church", twinRoom: false }).q.flags.some((f) => /250|특가/.test(f)), false);
console.log("rooms.test 통과");
// 8. jin 10/7: BBQ 300g −4천, 당일 평일 4.3만·금토일 4.7만, 겨울 주말 대강당 확인
{
  const a = run({ adults: 40, checkin: "2026-11-13", nights: 1, customerType: "church", bbq300: true });
  assert.equal(a.q.unit, 70000); assert.equal(a.q.bbq300, true);
  assert.equal(run({ adults: 40, checkin: "2026-11-11", nights: 0, customerType: "company" }).q.unit, 40000);   // 수
  assert.equal(run({ adults: 40, checkin: "2026-11-14", nights: 0, customerType: "company" }).q.unit, 47000);   // 토
  const w = run({ adults: 40, checkin: "2027-01-22", nights: 2, customerType: "church", wantsMainHall: true });
  assert.ok(w.q.flags.some((f) => /300만/.test(f)));
  console.log("rooms.test 8 통과");
}
{ // jin 10/10: 1~2월 금토일 1박2일도 7.5만 (+1만은 7~8월만)
  const { buildQuote_ } = await import('../kakao-quote/core.js');
  const fri = buildQuote_({ checkin: '2027-01-08', nights: 1, adults: 30, customerType: 'church' });
  const tue = buildQuote_({ checkin: '2027-01-05', nights: 1, adults: 30, customerType: 'church' });
  const jul = buildQuote_({ checkin: '2027-07-09', nights: 1, adults: 30, customerType: 'church' });
  if (fri.unit !== 75000 || tue.unit !== 75000 || jul.unit !== 85000) throw new Error('1박2일 단가 실패 ' + fri.unit + ' ' + tue.unit + ' ' + jul.unit);
  console.log('1~2월 금토일 7.5만 통과');
}
{ // 9. 성수기: 1~2월 금토일·공휴일
  const pk = (ci, n) => run({ adults: 40, checkin: ci, nights: n, customerType: "church", wantsMainHall: true }).q.flags.some((f) => /성수기 대강당/.test(f));
  assert.equal(pk("2027-01-20", 1), false);  // 수~목
  assert.equal(pk("2027-01-22", 1), true);   // 금
  assert.equal(pk("2027-02-08", 1), true);   // 설 연휴(월)
  assert.equal(pk("2026-11-13", 1), false);  // 11월 금
  assert.equal(pk("2027-07-14", 1), true);   // 7월
  console.log("rooms.test 9 통과");
}
{ // 10. 온돌 90실 한도
  const f = (n) => run({ adults: n, checkin: "2026-11-13", nights: 1, customerType: "church" }).q.flags.some((x) => /본관 온돌 90실에 침대룸/.test(x));
  assert.equal(f(270), false); assert.equal(f(273), true);
  console.log("rooms.test 10 통과");
}
{ // jin 10/10: 행사 이름(산악회 등)은 'ooo님 산악회'
  const { buildQuote_ } = await import('../kakao-quote/core.js');
  const a = buildQuote_({ org: '산악회', contact: '이철로', nights: 0, adults: 40, checkin: '2026-10-18' });
  const b = buildQuote_({ org: '관악감리교회', contact: '홍길동', nights: 1, adults: 25, checkin: '2027-01-22', customerType: 'church' });
  const c = buildQuote_({ org: '이철로님 산악회', contact: '이철로 님', nights: 0, adults: 40, checkin: '2026-10-18' });
  if (a.org !== '이철로님 산악회' || b.org !== '관악감리교회' || c.org !== '이철로님 산악회') throw new Error('행사명 탭 이름 실패 ' + a.org + '|' + b.org + '|' + c.org);
  console.log('행사명 탭 이름 통과');
}

// jin 10/11 카드: 1인 단가 가까운 쪽 끊기(10만 미만 5천·이상 만원), 당일·MT 제외, 2박3일 대학 13만
{
  const a = run({ adults: 30, checkin: "2026-11-10", nights: 1, customerType: "company", bbq300: true });
  assert.equal(a.q.unit, 70000, "7.5만−4천=71,000 → 7만");
  const b = run({ adults: 30, checkin: "2026-11-10", nights: 2, customerType: "university" });
  assert.equal(b.q.unit, 130000, "2박3일 대학 13만");
  const c = run({ adults: 30, checkin: "2026-11-10", nights: 0, customerType: "company" });
  assert.ok([40000, 47000].includes(c.q.unit), "당일은 끊지 않음");
  const d = run({ adults: 30, checkin: "2026-11-10", nights: 1, customerType: "university" });
  assert.equal(d.q.unit, 49000, "MT 는 끊지 않음");
}

// jin 10/19: 가격표에 없는 특별 요청 → 확인할 것
{
  const q = buildQuote_({ checkin: '2026-11-11', checkout: '2026-11-12', nights: 1, adults: 18, kids: 0, customerType: 'company', specials: ['09시 얼리 체크인', '', '야외 촬영 장소'] });
  const sp = q.flags.filter((f) => f.startsWith('가격표에 없는 요청'));
  assert.equal(sp.length, 2);
  assert.ok(sp[0].includes('09시 얼리 체크인'));
  const q2 = buildQuote_({ checkin: '2026-11-11', checkout: '2026-11-12', nights: 1, adults: 18, kids: 0, customerType: 'company' });
  assert.equal(q2.flags.filter((f) => f.startsWith('가격표에 없는 요청')).length, 0);
  console.log('특별 요청 확인할 것 OK');
}

// jin 10/19·10/20: 부가세 없는 곳은 기본 카카오 3333-15 + 계좌 확인 표시, 부가세 있는 곳은 신한 법인 그대로
{
  const { buildQuote_, priceTotals_, assignRooms_, busyFromBookings_, CFG } = await import('../kakao-quote/core.js');
  const mk = (t) => { const q = buildQuote_({ adults: 30, nights: 1, checkin: '2026-11-11', checkout: '2026-11-12', customerType: t }); assignRooms_(q, busyFromBookings_([])); return q; };
  const ch = mk('church'), co = mk('company');
  if (!CFG.ACC_OTHERS.includes(priceTotals_(ch).account) || priceTotals_(ch).account !== '카카오뱅크 3333-15-5582511 김은하') throw new Error('교회 계좌');
  if (!ch.flags.some((f) => /입금 계좌/.test(f))) throw new Error('계좌 확인 표시 없음');
  if (priceTotals_(co).account !== CFG.ACC_VAT || co.flags.some((f) => /입금 계좌/.test(f))) throw new Error('회사 계좌');
  console.log('ok 계좌(10/19)');
}
{ // jin 10/20: 펜션 옵션은 야유회·대학·청년부·MT·가족모임·동창, 또는 단체실·펜션 요청만
  const { buildQuote_, assignRooms_, busyFromBookings_ } = await import('../kakao-quote/core.js');
  const ro = (r) => { const q = buildQuote_({ checkin: '2026-11-20', nights: 1, adults: 25, ...r }); assignRooms_(q, busyFromBookings_([])); return q.roomOptions; };
  const eq = (a, b, m) => { if (a !== b) throw new Error(m + ': ' + a + ' != ' + b); };
  eq(ro({ org: '골든 브라스 색소폰 동호회', customerType: 'group' }), false, '동호회');
  eq(ro({ org: '팀 불도저 종합격투기 선수단', customerType: 'group' }), false, '선수단');
  eq(ro({ org: '○○회사 가을 야유회', customerType: 'company' }), true, '야유회');
  eq(ro({ org: '김OO님 가족모임', customerType: 'group' }), true, '가족모임');
  eq(ro({ org: '○○교회 청년부', customerType: 'church' }), true, '청년부');
  eq(ro({ org: '○○대 경영학과', customerType: 'university' }), true, 'MT');
  eq(ro({ org: '○○동호회', customerType: 'group', notes: '단체실 원해요' }), true, '단체실 요청');
  eq(ro({ org: '○○동호회', customerType: 'group', wantsPension: true }), true, '펜션 요청');
  console.log('펜션 옵션 대상 통과');
}

// jin 10/20 가격 답: 식사 1끼 −8천, 1박 BBQ 빼면 −1만, 당일 한식 3.7/4.5만, 4박5일 26만 자동
{
  assert.equal(run({ adults: 30, checkin: "2026-11-11", nights: 2, customerType: "church", skipMeals: 1 }).q.unit, 120000);   // 13만−8천=12.2만 → 만원 단위 12만
  assert.equal(run({ adults: 30, checkin: "2026-11-10", nights: 1, customerType: "church", bbq: false }).q.unit, 65000);
  assert.equal(run({ adults: 30, checkin: "2026-11-10", nights: 1, customerType: "university", bbq: false }).q.unit, 49000);  // MT는 그대로
  assert.equal(run({ adults: 30, checkin: "2026-11-10", nights: 0, customerType: "church", bbq: false }).q.unit, 37000);
  assert.equal(run({ adults: 30, checkin: "2026-11-14", nights: 0, customerType: "church", bbq: false }).q.unit, 45000);
  assert.equal(run({ adults: 30, checkin: "2026-11-09", nights: 4, customerType: "church" }).q.unit, 260000);
  assert.throws(() => buildQuote_({ adults: 30, checkin: "2026-11-09", nights: 5, customerType: "church" }));
  console.log('10/20 가격 답 통과');
}

// jin 10/21 가격 답: 회사 2박 15만, 7~8월 평일 1박 −5천, 공휴일 전날 1박 +1만, MT 계약금 상한 없음, 1~2월 대강당 130명+ 100만
{
  assert.equal(run({ adults: 30, checkin: "2026-11-11", nights: 2, customerType: "company" }).q.unit, 130000);   // jin 10/21 카드 모두 13만
  assert.equal(run({ adults: 30, checkin: "2027-07-13", nights: 1, customerType: "church" }).q.unit, 80000);   // 화요일
  assert.equal(run({ adults: 30, checkin: "2027-07-16", nights: 1, customerType: "church" }).q.unit, 85000);   // 금요일
  assert.equal(run({ adults: 30, checkin: "2026-12-24", nights: 1, customerType: "church" }).q.unit, 85000);   // 성탄 전날(목)
  assert.equal(run({ adults: 30, checkin: "2026-12-23", nights: 1, customerType: "church" }).q.unit, 75000);
  const mt = run({ adults: 60, checkin: "2026-11-10", nights: 1, customerType: "university" });
  assert.equal(mt.t.deposit, Math.round(mt.t.total * 0.3 / 100000) * 100000);
  const upAmt = (n, ci) => (run({ adults: n, checkin: ci, nights: 1, customerType: "church", wantsMainHall: true }).q.extraHalls.find((h) => h.name === "대강당 업그레이드") || {}).amount;
  assert.equal(upAmt(140, "2027-01-15"), 3000000);   // 1~2월 금, 200명 미만
  assert.equal(upAmt(60, "2027-07-14"), 3000000);    // 7~8월
  assert.equal(upAmt(210, "2027-07-14"), undefined); // 200명 이상은 안 받음
  assert.equal(upAmt(140, "2026-11-11"), undefined); // 비수기 큰 단체는 원래 대강당
  assert.equal(upAmt(60, "2026-11-11"), 800000);     // 비수기 작은 단체 요청 80만
  console.log('10/21 가격 답 통과');
}
{ // 10. jin 10/20 가격 답
  const { buildQuote_, priceTotals_ } = await import('../kakao-quote/core.js');
  assert.equal(buildQuote_({ checkin: '2026-11-17', nights: 2, adults: 20, customerType: 'company' }).unit, 130000);   // Q34 15만 → 10/21 카드 모두 13만
  assert.equal(buildQuote_({ checkin: '2026-11-17', nights: 2, adults: 20, customerType: 'church' }).unit, 130000);
  assert.equal(buildQuote_({ checkin: '2026-11-17', nights: 3, adults: 20, customerType: 'church' }).unit, 190000);   // 3박4일 19만
  assert.equal(buildQuote_({ checkin: '2027-01-15', nights: 3, adults: 20, customerType: 'church' }).unit, 210000);   // Q48 1~2월 금 낀 3박4일 21만
  assert.equal(buildQuote_({ checkin: '2026-10-08', nights: 1, adults: 30, customerType: 'church' }).unit, 85000);    // Q39 한글날(10/9) 전날 +1만
  assert.equal(buildQuote_({ checkin: '2026-10-14', nights: 1, adults: 30, customerType: 'church' }).unit, 75000);
  // Q40 '다'(jin 10/21): 1~2월 금토일 대강당 업그레이드도 300만
  const big = run({ adults: 120, checkin: '2027-01-22', nights: 1, customerType: 'church', wantsMainHall: true });
  assert.equal(big.q.extraHalls.find((h) => /업그레이드/.test(h.name)).amount, 3000000);
  // 반나절 추가 강당은 절반, 얼리·레이트는 30만 한 번
  const half = run({ adults: 30, checkin: '2026-11-17', nights: 1, customerType: 'church', extraHalls: ['1강당'], halfDayHall: true, earlyLate: true });
  assert.equal(half.q.extraHalls.find((h) => /1강당/.test(h.name)).amount, 150000);
  assert.equal(half.q.extraHalls.find((h) => /얼리/.test(h.name)).amount, 300000);
  // Q37 MT 계약금도 30%(최대 30만 없음)
  const mt = buildQuote_({ checkin: '2026-11-17', nights: 1, adults: 100, customerType: 'university' });
  mt.extraHalls = [];
  assert.equal(priceTotals_(mt).deposit, 1500000);
  console.log('10/20 가격 답 통과');
}

// 10/25 모의 견적: '펜션동 미사용'은 펜션 요청 아님, 식사 없는 숙박은 사람이 정함
{
  const { asksPension_ } = await import("../kakao-quote/core.js");
  assert.equal(asksPension_("본관 호텔형 객실 15실 (펜션동 미사용)"), false);
  assert.equal(asksPension_("강당 미사용, 펜션동은 필요 없음"), false);
  assert.equal(asksPension_("독채 펜션 1동 통임대"), true);
  assert.equal(asksPension_("단체실 원해요"), true);
  assert.ok(run({ adults: 30, checkin: "2026-11-16", nights: 2, customerType: "group", noMeals: true }).q.flags.some((f) => /식사 없이 숙박만/.test(f)));
  console.log('10/25 모의 견적 수정 통과');
}

// jin 10/25 질문 답: 공공기관 부가세 없음, 일부 2인1실, 소회의실=1강당 값, 펜션 통임대, 트럭 주차 불가
{
  let x = run({ adults: 30, checkin: "2026-11-16", nights: 1, customerType: "group", publicOrg: true, vatDoc: true });
  assert.equal(x.q.vat, false);
  x = run({ adults: 36, checkin: "2026-11-12", nights: 1, customerType: "company", twinPart: 2 });
  assert.equal(x.q.unit, 75000); assert.equal(x.q.extraHalls.find((h) => h.name === "2인1실 추가").amount, 40000);
  x = run({ adults: 30, checkin: "2026-11-23", nights: 4, customerType: "company", extraHalls: ["분임토의실 3실"] });
  assert.equal(x.q.extraHalls[0].amount, 300000 * 3 * 4);
  x = run({ adults: 20, checkin: "2026-11-21", nights: 1, customerType: "group", wantsPension: true, noMeals: true });
  assert.ok(x.q.flags.some((f) => /1동 1박 800,000원/.test(f)));
  assert.ok(run({ adults: 30, checkin: "2026-11-16", nights: 1, bigTruck: true }).q.flags.some((f) => /트럭/.test(f)));
  console.log('10/25 질문 답 통과');
}

// jin 10/25 Q38 '나': 일요일 밤(일~월)도 주말 — 7~8월 일요일 1박은 평일 −5천 안 깎음
{
  const { hasWeekendNight_ } = await import("../kakao-quote/core.js");
  assert.equal(hasWeekendNight_("2026-11-15", 1), true);
  assert.equal(hasWeekendNight_("2026-11-16", 1), false);
  assert.equal(buildQuote_({ checkin: "2027-08-01", nights: 1, adults: 30, customerType: "church" }).unit, 85000);
  console.log('일요일 밤 주말 통과');
}

// jin 10/25 금액 답: 식사 추가 1.2만·바베큐 추가 2.5만·그릴 3만·1인1실 3만(줄 따로), 2박 바베큐 빼면 −1만, 설·추석 연휴 성수기, 공휴일 당일 주말 단가
{
  let x = run({ adults: 20, checkin: "2026-11-26", nights: 1, customerType: "company", addMeals: 1, grillSets: 2, singleRooms: 2 });
  const amt = (n) => (x.q.extraHalls.find((h) => h.name === n) || {}).amount;
  assert.equal(x.q.unit, 75000); assert.equal(amt("식사 추가"), 240000); assert.equal(amt("숯·그릴 대여"), 60000); assert.equal(amt("1인 1실 추가"), 60000);
  x = run({ adults: 20, checkin: "2026-11-16", nights: 2, customerType: "church", extraBbq: 1 });
  assert.equal(amt("바베큐 추가"), 500000);
  assert.equal(run({ adults: 30, checkin: "2026-11-16", nights: 2, customerType: "church", bbq: false }).q.unit, 120000);
  assert.equal(run({ adults: 30, checkin: "2027-09-14", nights: 2, customerType: "church" }).q.unit, 150000);   // 추석
  assert.equal(run({ adults: 30, checkin: "2027-10-11", nights: 0, customerType: "church" }).q.unit, 47000);    // 한글날 대체(월)
  console.log('10/25 금액 답 통과');
}

// jin 10/25 Q30·Q34: 캠프파이어 30만, 2박 미만 미취학 −2.5만 줄
{ const { buildQuote_, assignRooms_ } = await import("../kakao-quote/core.js");
  const q = buildQuote_({ adults: 30, kids: 3, preschool: 3, checkin: "2026-11-13", nights: 1, customerType: "church", campfire: true });
  assignRooms_(q, { halls: {}, pensions: {} });
  const names = q.extraHalls.map((h) => h.name + ":" + h.amount);
  assert.ok(names.includes("미취학 할인:-75000") && names.includes("캠프파이어:300000"), names.join());
  const q2 = buildQuote_({ adults: 30, kids: 3, preschool: 3, checkin: "2026-11-13", nights: 2, customerType: "church" });
  assert.equal(q2.preschool, 0);
  console.log('캠프파이어·미취학 통과'); }

// 10/25: 펜션이 모두 예약돼 있으면 객실 옵션 없이 온돌 한 가지
{
  const b = [{ name: "x", checkin: "2027-07-30", checkout: "2027-08-01", halls: [], pensions: ["A", "B", "C"] }];
  const { q: z } = run({ org: "○○교회 고등부", adults: 70, checkin: "2027-07-30", nights: 2, customerType: "church" }, b);
  assert.equal(z.roomOptions, false);
  console.log('펜션 다 참 통과');
}

// 10/25 jin: 중고등부·고등부는 펜션 옵션 없이 온돌 한 가지
{
  const { q: hs } = run({ org: "○○교회 고등부", adults: 70, checkin: "2026-11-13", nights: 1, customerType: "church" });
  assert.equal(hs.roomOptions, false); assert.deepEqual(hs.pensions, []);
  console.log('고등부 펜션 없음 통과');
}
