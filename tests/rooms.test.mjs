// 객실·단가 규칙 시험 — node tests/rooms.test.mjs (jin 10/7)
import assert from "node:assert/strict";
import { buildQuote_, assignRooms_, busyFromBookings_, priceTotals_ } from "../kakao-quote/core.js";
const run = (r, bookings = []) => { const q = buildQuote_(r); assignRooms_(q, busyFromBookings_(bookings)); return { q, t: priceTotals_(q) }; };

// 1. 기본(교회 일반)은 3인1실 온돌만 — 펜션·옵션 없음
let { q } = run({ org: "시험교회", adults: 60, checkin: "2027-01-17", nights: 2, customerType: "church" });
assert.equal(q.roomOptions, false); assert.deepEqual(q.pensions, []); assert.equal(q.ondolOnly, 20); assert.equal(q.ondol, 20);

// 2. 청년부·고등부, 펜션 요청, 친목(일반 모임), MT 는 객실옵션 1·2
for (const r of [
  { org: "시험교회 청년부", customerType: "church" },
  { org: "시험교회 중고등부", customerType: "church" },
  { org: "시험교회", customerType: "church", wantsPension: true },
  { org: "OO고 동창회", customerType: "group" },
  { org: "시험대 경영학과", customerType: "university" },
]) {
  ({ q } = run({ ...r, adults: 60, checkin: "2026-11-13", nights: 1 }));
  assert.equal(q.roomOptions, true, r.org);
  assert.deepEqual(q.pensions, ["A", "B"]); assert.equal(q.ondol, 14); assert.equal(q.ondolOnly, 20);
}
// 펜션 수: 10~39명 1동, 40~69명 2동, 70명~ 3동
for (const [n, k] of [[9, 0], [10, 1], [39, 1], [40, 2], [69, 2], [70, 3]]) {
  ({ q } = run({ org: "청년부", adults: n, checkin: "2026-11-13", nights: 1, customerType: "church" }));
  assert.equal(q.pensions.length, k, n + "명");
}
// MT 펜션은 유료 표시
({ q } = run({ org: "시험대", adults: 30, checkin: "2026-11-13", nights: 1, customerType: "university" }));
assert.equal(q.pensionPaid, true);

// 3. 2인1실이면 온돌 2명씩
({ q } = run({ adults: 41, checkin: "2026-11-13", nights: 1, customerType: "church", twinRoom: true }));
assert.equal(q.ondolOnly, 21);

// 4. 2박3일 비수기는 요일 무관 13만 (jin 10/7)
assert.equal(run({ adults: 40, checkin: "2026-11-11", nights: 2, customerType: "church" }).q.unit, 130000);  // 수~금
assert.equal(run({ adults: 40, checkin: "2026-11-13", nights: 2, customerType: "church" }).q.unit, 130000);  // 금~일
// 1박2일 비수기 7.5만, 여름 8.5만
assert.equal(run({ adults: 40, checkin: "2026-11-13", nights: 1, customerType: "church" }).q.unit, 75000);
assert.equal(run({ adults: 40, checkin: "2027-07-16", nights: 1, customerType: "church" }).q.unit, 85000);

// 5. 대강당 업그레이드 80만 한 번 (박 수 무관), 여름도 가능 + 확인 표시
let r = run({ adults: 60, checkin: "2026-11-13", nights: 2, customerType: "church", wantsMainHall: true });
assert.deepEqual(r.q.extraHalls.map((h) => [h.name, h.amount]), [["대강당 업그레이드", 800000]]);
r = run({ adults: 60, checkin: "2027-07-16", nights: 1, customerType: "church", wantsMainHall: true });
assert.equal(r.q.extraHalls[0].amount, 800000); assert.ok(r.q.flags.some((f) => /300만/.test(f)));

// 6. 대학원·사이버대·야간대 = 회사 단가, 부가세 없음, 기본 계좌
r = run({ adults: 30, checkin: "2026-11-13", nights: 1, customerType: "adultuniv" });
assert.equal(r.q.unit, 75000); assert.equal(r.q.vat, false); assert.equal(r.t.total, 2250000); assert.match(r.t.account, /카카오뱅크/);
assert.equal(run({ adults: 30, checkin: "2026-11-13", nights: 1, customerType: "company" }).q.vat, true);

// 7. 당일은 객실 없음
({ q } = run({ adults: 30, checkin: "2026-11-13", nights: 0, customerType: "church" }));
assert.equal(q.ondolOnly, 0);
console.log("rooms.test 통과");
// 8. jin 10/7: BBQ 300g −4천, 당일 평일 4.3만·금토일 4.7만, 겨울 주말 대강당 확인
{
  const a = run({ adults: 40, checkin: "2026-11-13", nights: 1, customerType: "church", bbq300: true });
  assert.equal(a.q.unit, 71000); assert.equal(a.q.bbq300, true);
  assert.equal(run({ adults: 40, checkin: "2026-11-11", nights: 0, customerType: "company" }).q.unit, 43000);   // 수
  assert.equal(run({ adults: 40, checkin: "2026-11-14", nights: 0, customerType: "company" }).q.unit, 47000);   // 토
  const w = run({ adults: 40, checkin: "2027-01-22", nights: 2, customerType: "church", wantsMainHall: true });
  assert.ok(w.q.flags.some((f) => /150만/.test(f)));
  console.log("rooms.test 8 통과");
}
{ // 9. 성수기: 1~2월 금토일·공휴일
  const pk = (ci, n) => run({ adults: 40, checkin: ci, nights: n, customerType: "church", wantsMainHall: true }).q.flags.some((f) => /150만/.test(f));
  assert.equal(pk("2027-01-20", 1), false);  // 수~목
  assert.equal(pk("2027-01-22", 1), true);   // 금
  assert.equal(pk("2027-02-08", 1), true);   // 설 연휴(월)
  assert.equal(pk("2026-11-13", 1), false);  // 11월 금
  assert.equal(pk("2027-07-14", 1), true);   // 7월
  console.log("rooms.test 9 통과");
}
{ // 10. 온돌 90실 한도
  const f = (n) => run({ adults: n, checkin: "2026-11-13", nights: 1, customerType: "church" }).q.flags.some((x) => /온돌 90실뿐|90실뿐/.test(x));
  assert.equal(f(270), false); assert.equal(f(273), true);
  console.log("rooms.test 10 통과");
}
