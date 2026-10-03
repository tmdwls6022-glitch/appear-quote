# 견적서 자동 작성 (Apps Script)

견적 구글 시트에 붙이는 스크립트입니다. 콜로그 Apps Script와는 별개 프로젝트입니다.

1. 견적 시트 → 확장 프로그램 → Apps Script → `견적자동작성.gs` 내용 붙여넣기 → 저장
2. 프로젝트 설정 → 스크립트 속성: `GEMINI_API_KEY`, `NOTION_TOKEN` (키는 사용자가 직접 입력)
3. 시트 새로고침 → 메뉴 [견적 자동작성] → 설정 확인 → 권한 허용
4. 고객 요청을 M~N열에 붙여넣고 [견적 자동작성] → 이 탭 요청으로 견적 만들기

고객에게 자동 발송하지 않습니다. 노란 칸과 M3 메모는 사람이 확인할 곳입니다.

## 카톡 채널 챗봇 (kakao-quote)
- `kakao-quote/index.ts`: Supabase Edge Function. 프로젝트 "room arrange"(ykujzljgaxtbwawuwoff)에 배포되어 있음.
  - 스킬 URL: https://ykujzljgaxtbwawuwoff.supabase.co/functions/v1/kakao-quote
- 흐름: 카카오 오픈빌더 스킬 → Edge Function(Gemini로 요청 읽기, 노션 예약 확인) → 견적 시트 Apps Script 웹앱 `doPost`(가격 계산·견적 탭 작성) → 카톡 답장.
- Supabase 비밀값(jin 직접 입력): `GEMINI_API_KEY`, `NOTION_TOKEN`, `GAS_URL`(웹앱 /exec 주소).
- 웹앱 호출은 본문을 GEMINI_API_KEY로 HMAC 서명한 `sig`로 확인함. 두 곳의 키가 같아야 함.
- 직원 승인: 직원이 채널에 "직원등록 이름"을 보내면 `quote_bot_users`에 들어감. 승인은 `approved=true`로 바꿈.
- 콜백 승인 전에는 "결과"라고 보내면 마지막 견적을 받음.
