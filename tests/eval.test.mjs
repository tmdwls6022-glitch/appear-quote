// 채점 함수(kakao-quote/eval.js) 오프라인 시험 — node tests/eval.test.mjs
// 고객 글 없이 만든 가짜 사례만 쓴다. jin 10/5
import assert from "node:assert/strict";
import { scoreCase_ } from "../kakao-quote/eval.js";

// 1. 다 맞음
let s = scoreCase_({ ci: "2026-11-13", co: "2026-11-14", n: 1, p: [50, 60], k: 0, t: "church" },
  { checkin: "2026-11-13", checkout: "2026-11-14", nights: 1, adults: 55, kids: 0, customerType: "church", unsure: [] });
assert.equal(s.ok, true); assert.equal(s.unitOk, true); assert.equal(s.unitBot, 75000);

// 2. 중고등을 성인으로 안 세서 인원이 틀림 (자주 나올 실수)
s = scoreCase_({ n: 2, p: 80, k: 0 }, { checkin: "2027-07-22", nights: 2, adults: 20, kids: 0 });
assert.equal(s.ok, false); assert.deepEqual(s.miss.map((m) => m.field), ["p"]);

// 3. 단체 종류가 틀리면 단가도 틀림 (대학 1박 MT 4.9만 vs 회사 7.5만)
s = scoreCase_({ ci: "2026-10-29", n: 1, p: 30, t: "company" }, { checkin: "2026-10-29", nights: 1, adults: 30, customerType: "university" });
assert.equal(s.unitOk, false); assert.equal(s.unitGold, 75000); assert.equal(s.unitBot, 49000);

// 4. 날짜 후보가 여럿인데 unsure 표시가 없으면 틀림
s = scoreCase_({ ci: "2026-10-04", unsure: true }, { checkin: "2026-10-04", nights: 1, adults: 30, unsure: [] });
assert.deepEqual(s.miss.map((m) => m.field), ["unsure"]);

// 5. 날짜 모름이 정답인데 아무 날짜나 지어냄
s = scoreCase_({ ci: null, n: 2 }, { checkin: "2027-01-15", checkout: "2027-01-17", adults: 40 });
assert.deepEqual(s.miss.map((m) => m.field), ["ci"]);

// 6. 단가는 같아도 부가세(회사)가 갈리면 금액 틀림
s = scoreCase_({ n: 2, t: "company" }, { checkin: "2026-11-11", nights: 2, adults: 40, customerType: "group" });
assert.equal(s.unitBot, s.unitGold); assert.equal(s.unitOk, false);

console.log("eval.test 통과");
