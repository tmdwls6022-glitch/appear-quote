// 조정장치(kakao-quote/adjust.js) 오프라인 시험 — node tests/adjust.test.mjs. jin 10/5
import assert from "node:assert/strict";
import { parseEdit_, applyAdjust_, adjustTable_, fromTable_, diff_, describe_ } from "../kakao-quote/adjust.js";
import { buildQuote_ } from "../kakao-quote/core.js";

const req = { org: "가짜교회", adults: 40, kids: 0, checkin: "2026-11-13", checkout: "2026-11-14", nights: 1, customerType: "church", bbq: null };

// 1. 카톡 수정 명령
let { set, bad } = parseEdit_("인원 60, 아동 5, 단가 80,000, 바베큐 빼기, 2인1실, 대강당, 2박, 종류 회사, 1강당 추가, 객실 2실 추가, 식사 1끼 빼기, 부가세, 이상한말");
assert.deepEqual(set, { adults: 60, kids: 5, unitOverride: 80000, bbq: false, twinRoom: true, wantsMainHall: true, nights: 2,
  customerType: "company", extraHalls: ["1강당"], extraRooms: 2, skipMeals: 1, vatDoc: true });
assert.deepEqual(bad, ["이상한말"]);

// 2. 박수를 바꾸면 체크아웃도 바뀜, 단가 직접 지정이 계산에 들어감
const r2 = applyAdjust_(req, { nights: 2, unitOverride: 99000 });
assert.equal(r2.checkout, "2026-11-15");
const q = buildQuote_(r2);
assert.equal(q.unit, 99000); assert.equal(q.period, "2박3일");
assert.ok(q.flags.some((f) => f.includes("직접")));

// 3. 조정표 왕복: 시트에 쓴 값을 그대로 읽으면 바뀐 것 없음, 한 칸 고치면 그것만
const tbl = adjustTable_(req).slice(1).map((row) => row[1]);
assert.deepEqual(diff_(req, fromTable_(tbl)), {});
tbl[0] = "55"; tbl[5] = "X";
assert.deepEqual(diff_(req, fromTable_(tbl)), { adults: 55, bbq: false });
assert.equal(describe_({ adults: 55, bbq: false }), "인원(성인·중고등) 55, 바베큐 X");

console.log("adjust.test 통과");
