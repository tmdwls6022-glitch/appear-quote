// 객실옵션 2·대학원 단가 시험 — node tests/rooms.test.mjs (jin 10/7)
import assert from "node:assert/strict";
import { buildQuote_, assignRooms_, busyFromBookings_, priceTotals_ } from "../kakao-quote/core.js";
const run = (r, bookings = []) => { const q = buildQuote_(r); assignRooms_(q, busyFromBookings_(bookings)); return { q, t: priceTotals_(q) }; };

// 1. 60명: 옵션1 = 펜션 2동(20명) + 온돌 14실(42명), 옵션2 = 온돌만 20실(60명) — 예전엔 옵션2도 14실이라 18명이 잘 곳 없었음
let { q } = run({ adults: 60, checkin: "2027-01-17", nights: 2, customerType: "church", pensionWanted: true });
assert.deepEqual(q.pensions, ["A", "B"]); assert.equal(q.ondol, 14); assert.equal(q.ondolOnly, 20);
assert.ok(q.pensions.length * 10 + q.ondol * 3 >= 60); assert.ok(q.ondolOnly * 3 >= 60);

// 2. 2인1실이면 옵션2도 2명씩
({ q } = run({ adults: 41, checkin: "2026-11-13", nights: 1, customerType: "church", twinRoom: true }));
assert.equal(q.ondolOnly, 21);

// 3. 대학원·사이버대·야간대 = 회사 단가, 부가세 없음, 기본 계좌
let r = run({ adults: 30, checkin: "2026-11-13", nights: 1, customerType: "adultuniv" });
assert.equal(r.q.unit, 75000); assert.equal(r.q.vat, false); assert.equal(r.t.total, 2250000); assert.match(r.t.account, /카카오뱅크/);
r = run({ adults: 30, checkin: "2026-11-13", nights: 1, customerType: "company" });
assert.equal(r.q.vat, true);

// 4. 당일은 객실 없음
({ q } = run({ adults: 30, checkin: "2026-11-13", nights: 0, customerType: "church" }));
assert.equal(q.ondolOnly, 0);

// 5. jin 10/7: 펜션은 요청한 사람만 — 요청 없으면 온돌만(본관 34실 안이면)
({ q } = run({ adults: 60, checkin: "2027-01-17", nights: 2, customerType: "church" }));
assert.deepEqual(q.pensions, []); assert.equal(q.ondol, 20); assert.equal(q.ondolOnly, 20);
// 6. 객실이 모자라면(103명+) 펜션을 넣고 확인 표시
({ q } = run({ adults: 120, checkin: "2027-01-17", nights: 2, customerType: "church" }));
assert.ok(q.pensions.length >= 2); assert.ok(q.flags.some((f) => /모자라/.test(f)));
// 7. 대강당 업그레이드 기본 80만, 7~8월에도 막지 않고 확인 표시
({ q } = run({ adults: 60, checkin: "2027-01-17", nights: 2, customerType: "church", wantsMainHall: true }));
assert.equal(q.extraHalls[0].day, 800000);
({ q } = run({ adults: 60, checkin: "2027-07-20", nights: 2, customerType: "church", wantsMainHall: true }));
assert.equal(q.extraHalls.length, 1); assert.ok(q.flags.some((f) => /성수기 대강당/.test(f)));
// 8. 객실옵션 1·2: 펜션이 들어가거나 MT일 때만, 기본은 온돌 한 줄
({ q } = run({ adults: 60, checkin: "2027-01-17", nights: 2, customerType: "church" }));
assert.equal(q.roomOptions, false);
({ q } = run({ adults: 60, checkin: "2027-01-17", nights: 2, customerType: "church", pensionWanted: true }));
assert.equal(q.roomOptions, true);
({ q } = run({ adults: 40, checkin: "2026-11-06", nights: 1, customerType: "university" }));
assert.equal(q.roomOptions, true);
console.log("rooms.test 통과");
