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

-- jin 10/5: 모의 견적(정확도 시험). 카톡 견적방 요청글 + 사람이 매긴 정답.
-- 요청글의 연락처·이메일·담당자 이름은 지워서 넣는다(tests/load_cases.py).
create table if not exists quote_test_cases (
  id         text primary key,                -- 예: "c0901" (카톡방 메시지 번호 기준)
  request    text not null,                   -- 견적요청 글 (개인정보 지움)
  asof       date not null,                   -- 요청을 받은 날. Gemini 에 "오늘"로 알려 줌
  expect     jsonb not null default '{}',     -- 정답 (kakao-quote/eval.js 주석 참고)
  note       text,                            -- 애매한 점 메모
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists quote_test_runs (
  id          bigserial primary key,
  run_id      text not null,                  -- 회차 (시작 시각 KST)
  case_id     text not null references quote_test_cases(id),
  status      text not null default 'running', -- running / done / error
  ok          boolean,                        -- 읽은 값이 정답과 전부 같음
  unit_ok     boolean,                        -- 1인 단가가 정답으로 계산한 값과 같음
  unit_bot    integer,
  unit_gold   integer,
  miss        jsonb,                          -- [{field, want, got}]
  parsed      jsonb,                          -- Gemini 가 읽은 값
  quote       jsonb,                          -- {period, people, type, unit, flags}
  created_at  timestamptz not null default now(),
  finished_at timestamptz,
  unique (run_id, case_id)
);
alter table quote_test_cases enable row level security;
alter table quote_test_runs enable row level security;
