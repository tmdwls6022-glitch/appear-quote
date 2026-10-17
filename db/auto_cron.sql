-- 견적 자동 시작 예약 작업 (jin 10/17) — 10/18 켰다가 같은 날 jin "봇 깨우지 말고" 로 끔(cron.unschedule). 다시 켜려면 아래 실행. 대신 노션 쪽에서 알려 주는 방식(웹훅) 검토 중 — docs/견적_인계.md 4절.
-- 08:00~21:50 KST(= 23:00~12:50 UTC) 10분마다 kakao-quote 에 {"auto":"inbound"} 를 보낸다.
-- 함수는 노션 DB_인입콜에서 '어피어연수원 견적' 새 카드를 읽어 견적 탭을 만들고 카드에 댓글을 단다(한 번에 1건, 이미 만든 카드는 건너뜀).
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
