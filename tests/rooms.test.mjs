// 객실옵션 2·대학원 단가 시험 — node tests/rooms.test.mjs (jin 10/7)
import assert from "node:assert/strict";
import { buildQuote_, assignRooms_, busyFromBookings_, priceTotals_ } from "../kakao-quote/core.js";
const run = (r, bookings = []) => { const q = buildQuote_(r); assignRooms_(q, busyFromBookings_(bookings)); return { q, t: priceTotals_(q) }; };

// 1. 60명: 옵션1 = 펜션 2동(20명) + 온돌 14실(42명), 옵션2 = 온돌만 20실(60명) — 예전엔 옵션2도 14실이라 18명이 잘 곳 없었음
let { q } = run({ adults: 60, checkin: "2027-01-17", nights: 2, customerType: "church" });
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
console.log("rooms.test 통과");
