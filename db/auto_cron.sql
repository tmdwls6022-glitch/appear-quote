-- 견적 자동 시작 예약 작업 (jin 10/17) — 아직 적용 안 함. kakao-quote 에 auto.js 가 든 판을 배포한 뒤 SQL Editor 에서 한 번 실행.
-- 08:00~21:50 KST(= 23:00~12:50 UTC) 10분마다 kakao-quote 에 {"auto":"inbound"} 를 보낸다.
-- 함수는 노션 DB_인입콜에서 '어피어연수원 견적' 새 카드를 읽어 견적 탭을 만들고 카드에 댓글을 단다(한 번에 2건, 이미 만든 카드는 건너뜀).
-- 끄기: select cron.unschedule('kakao-quote-auto');
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'kakao-quote-auto',
  '*/10 23,0-12 * * *',
  $$ select net.http_post(
       url := 'https://ykujzljgaxtbwawuwoff.supabase.co/functions/v1/kakao-quote',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{"auto": "inbound"}'::jsonb
     ) $$
);
