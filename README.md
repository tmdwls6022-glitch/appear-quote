# 견적서 자동 작성 (Apps Script)

견적 구글 시트에 붙이는 스크립트입니다. 콜로그 Apps Script와는 별개 프로젝트입니다.

1. 견적 시트 → 확장 프로그램 → Apps Script → `견적자동작성.gs` 내용 붙여넣기 → 저장
2. 프로젝트 설정 → 스크립트 속성: `GEMINI_API_KEY`, `NOTION_TOKEN` (키는 사용자가 직접 입력)
3. 시트 새로고침 → 메뉴 [견적 자동작성] → 설정 확인 → 권한 허용
4. 고객 요청을 M~N열에 붙여넣고 [견적 자동작성] → 이 탭 요청으로 견적 만들기

고객에게 자동 발송하지 않습니다. 노란 칸과 M3 메모는 사람이 확인할 곳입니다.

## 카톡 채널 챗봇 (kakao-quote) — Apps Script 없이 동작
- `kakao-quote/`: Supabase Edge Function. 프로젝트 "room arrange"(ykujzljgaxtbwawuwoff)에 배포되어 있음.
  - 스킬 URL: https://ykujzljgaxtbwawuwoff.supabase.co/functions/v1/kakao-quote
- 흐름: 카카오 오픈빌더 스킬 → `index.ts`(Gemini로 요청 읽기, 노션 예약 확인) → `core.js`(가격 계산) → `sheet.ts`(Sheets API로 양식 탭 복사·칸 채우기) → 카톡 답장.
- Supabase 비밀값(jin 직접 입력): `GEMINI_API_KEY`, `NOTION_TOKEN`, `GOOGLE_SA_JSON`(서비스 계정 키). 선택: `QUOTE_SHEET_ID`(기본은 '자동화 복습').
- 견적 시트는 서비스 계정 이메일에 편집자로 공유해야 함.
- 가격을 바꿀 때는 `kakao-quote/core.js`의 CFG를 고치고 다시 배포함. `견적자동작성.gs`는 시트 메뉴 버튼용 예전 판이라, 같이 고쳐야 같은 값이 됨.
- 직원 승인: 채널에 "직원등록 이름" → `quote_bot_users.approved=true`.
