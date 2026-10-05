-- 카톡 견적 챗봇 테이블 (Supabase 프로젝트 "room arrange" ykujzljgaxtbwawuwoff, public 스키마)
-- 10/5: 운영 DB 에서 그대로 옮겨 적음 (기록용). 이미 만들어져 있으니 다시 실행할 필요 없음.

create table if not exists quote_bot_users (
  user_key   text primary key,               -- 카카오 userRequest.user.id
  label      text,                           -- "직원등록 이름" 의 이름
  approved   boolean not null default false, -- 관리자가 true 로 바꿔야 "견적:" 사용 가능
  created_at timestamptz not null default now()
);

create table if not exists quote_bot_jobs (
  id          bigserial primary key,
  user_key    text not null,
  request     text not null,                 -- 고객 견적요청 원문
  status      text not null default 'running', -- running / done / error
  reply       text,                          -- 카톡으로 보낸 답장
  result      jsonb,                         -- { title, url, q, t }
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);
