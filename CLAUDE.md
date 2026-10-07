# appear-quote 규칙

어피어 견적 자동 작성. 2026-10-05 appear-calllog 의 `quote/` 에서 떼어 냄(커밋 기록 그대로 옮김).
콜로그(appear-calllog)·기관수집(appear-leads)과는 별개 프로젝트다.

## 구조

| 경로 | 내용 |
|---|---|
| `kakao-quote/` | **카톡 채널 견적 챗봇** — Supabase Edge Function. 프로젝트 "room arrange"(`ykujzljgaxtbwawuwoff`) |
| `kakao-quote/index.ts` | 카카오 스킬 진입점 · Gemini 로 요청 읽기 · 노션 DB_인입콜 예약 겹침 확인 |
| `kakao-quote/core.js` | 가격 계산(순수 함수). **가격은 여기 `CFG` 를 고친다** |
| `kakao-quote/sheet.ts` | Sheets API(서비스 계정)로 양식 탭 복사·칸 채우기 |
| `견적자동작성.gs` | 견적 시트 메뉴 버튼용 Apps Script (예전 판). 가격을 바꾸면 이쪽도 같이 |
| `db/schema.sql` | `quote_bot_users`, `quote_bot_jobs` 테이블 (기록용) |

## 기본 규칙

- 고객에게 견적을 자동으로 보내지 않는다. 시트의 노란 칸·M3 메모는 사람이 확인한다.
- Apps Script 를 쓰지 않는다(콜로그·기관수집의 UrlFetch 하루 한도와 분리).
- 비밀값은 Supabase → Edge Functions → Secrets 에만: `GEMINI_API_KEY`, `NOTION_TOKEN`, `GOOGLE_SA_JSON`, (선택) `QUOTE_SHEET_ID`. 키·고객 정보는 커밋·출력하지 않는다.
- 노션 통합이 DB_인입콜(`1cf33639-fc7f-80e9-8abd-000bf8bbb0d0`)에 연결돼 있어야 예약 겹침을 본다(404 = 연결 안 됨, 401 = 키 틀림).
- 배포: Supabase `kakao-quote` 함수 새 버전 (index.ts·core.js·sheet.ts 세 파일 함께). 배포 뒤 운영 코드와 git 이 같은지 확인.
- 완료는 코드 / 배포 / 실사용(카톡에서 직접 견적)으로 나눠 말한다. 사용자가 카톡에서 직접 해 보기 전에는 완료라고 하지 않는다.
- 커밋 메시지는 "견적: 바뀐 점" / "견적 챗봇: 바뀐 점". 주석은 한국어, 날짜·결정자(`jin 10/3:`)를 남긴다.
- 직원 승인: 채널에 "직원등록 이름" → `quote_bot_users.approved = true`.
- 이 저장소와 appear-calllog의 quote/ 두 곳에서 견적 코드가 따로 고쳐지고 있다(10/7). 정본 결정(하네스 HANDOFF D6) 전까지 고치기 전에 두 곳 최신을 비교한다.
- 견적 양식에 줄(추가 강당·업그레이드 등)을 넣으면 합계 수식이 새 줄을 잡는지 확인한다(10/7 총액이 새 줄을 빼고 계산됨, 2e3ffae).
- 가격·성수기 규칙은 jin 이 답한 것만 쓰고 근거(날짜·답)를 커밋에 남긴다.
