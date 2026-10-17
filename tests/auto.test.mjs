// 자동 시작(kakao-quote/auto.js) 오프라인 시험 — node tests/auto.test.mjs. jin 10/17
import assert from "node:assert/strict";
import { inboundText_, pickNew_, pageIdOf_, marker_, asofKst_, AUTO_PER_RUN } from "../kakao-quote/auto.js";

const rt = (s) => ({ type: "rich_text", rich_text: [{ plain_text: s }] });
const card = (id, created, over = {}) => ({
  id, created_time: created,
  properties: {
    "단체명 ": { type: "title", title: [{ plain_text: "가짜교회 청년부" }] },
    "상태": { type: "multi_select", multi_select: [{ name: "어피어연수원 견적" }] },
    "행사인원": { type: "number", number: 45 },
    "기간": { type: "select", select: { name: "1박 2일" } },
    "체크인": { type: "date", date: { start: "2026-11-13", end: "2026-11-14" } },
    "문의사항": rt("바베큐 원해요, 세금계산서 필요"),
    "연락처": { type: "phone_number", phone_number: "010-0000-0000" },
    ...over,
  },
});

// 1. 카드 → 요청글: 표지 줄 + 견적에 쓰는 칸만, 연락처는 안 들어감
const a = card("11111111-2222-3333-4444-555555555555", "2026-10-18T01:00:00.000Z");
const t = inboundText_(a);
assert.equal(t.split("\n")[0], "[노션 11111111222233334444555555555555]");
assert.ok(t.includes("행사인원: 45명") && t.includes("체크인: 2026-11-13 ~ 2026-11-14") && t.includes("문의사항: 바베큐"));
assert.ok(!t.includes("010-"));
assert.equal(pageIdOf_(t), "11111111222233334444555555555555");
assert.equal(pageIdOf_("견적 그냥 글"), null);

// 2. KST 날짜: 10/17 16시(UTC) = 10/18 01시 KST
assert.equal(asofKst_(card("x", "2026-10-17T16:00:00.000Z")), "2026-10-18");

// 3. 고르기: 이미 만든 것·시작일 전·다른 상태·단체명 없는 것은 빼고, 오래된 것부터 AUTO_PER_RUN 개
const pages = [
  card("aaaa", "2026-10-19T03:00:00.000Z"),
  card("bbbb", "2026-10-18T03:00:00.000Z"),
  card("cccc", "2026-10-16T03:00:00.000Z"),                                       // 시작일 전
  card("dddd", "2026-10-18T05:00:00.000Z", { "상태": { type: "multi_select", multi_select: [{ name: "상담종료" }] } }),
  card("eeee", "2026-10-18T06:00:00.000Z", { "단체명 ": { type: "title", title: [] } }),
  card("ffff", "2026-10-18T07:00:00.000Z"),
  card("gggg", "2026-10-18T08:00:00.000Z"),
];
const picked = pickNew_(pages, ["ffff"]).map((p) => p.id);
assert.equal(AUTO_PER_RUN, 2);
assert.deepEqual(picked, ["bbbb", "gggg"]);
assert.equal(marker_("ab-cd"), "[노션 abcd]");

console.log("auto.test 통과");
