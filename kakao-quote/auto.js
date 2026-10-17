// 자동 시작 (순수 함수) — jin 10/17: 직원이 카톡에 "견적:"을 붙여 넣지 않아도 견적 초안이 먼저 만들어지게.
// 노션 DB_인입콜에 상태 '어피어연수원 견적' 카드가 새로 생기면, 그 카드의 칸으로 요청글을 만들어
// 지금과 같은 길(Gemini 읽기 → core.js → 시트 탭)로 견적 탭을 만든다. 고객에게는 보내지 않는다.
// 카드 칸은 읽기만 한다(DB_인입콜은 웹·매출 수식이 읽는 표). 결과는 그 카드 댓글과 카톡 "목록"으로 알린다.

export const AUTO_USER = 'auto:notion';      // quote_bot_jobs.user_key — 자동으로 만든 견적
export const AUTO_STATUS = '어피어연수원 견적'; // DB_인입콜 '상태'(다중 선택)에 이 값이 있는 카드만
export const AUTO_FROM = '2026-10-18';        // 이 날(KST) 이후 생긴 카드만. 예전 카드 수백 장을 한꺼번에 만들지 않게
export const AUTO_LOOKBACK_DAYS = 3;          // 최근 며칠 카드까지 볼지(놓친 것 다시 잡기)
export const AUTO_PER_RUN = 2;                // 한 번 깨울 때 만들 개수 — 함수 시간 한도(1건 30초쯤) 안에서, 한 건씩 차례로

// 노션 속성 → 글자
function txt(p) {
  if (!p) return '';
  switch (p.type) {
    case 'title': case 'rich_text': return (p[p.type] || []).map((t) => t.plain_text).join('').trim();
    case 'select': return p.select ? p.select.name : '';
    case 'multi_select': return (p.multi_select || []).map((o) => o.name).join(', ');
    case 'number': return p.number == null ? '' : String(p.number);
    case 'date': return p.date ? (p.date.end && p.date.end !== p.date.start ? `${p.date.start.slice(0, 10)} ~ ${p.date.end.slice(0, 10)}` : p.date.start.slice(0, 10)) : '';
    case 'created_time': return p.created_time || '';
    default: return '';
  }
}

// 요청글 첫 줄 표지 — 같은 카드를 두 번 만들지 않게 이 줄로 찾는다
export const marker_ = (pageId) => `[노션 ${String(pageId).replace(/-/g, '')}]`;

// 카드 → 견적요청 글. 연락처·이메일·담당자명은 넣지 않는다(견적 계산에 안 씀)
export function inboundText_(page) {
  const p = page.properties || {};
  const name = txt(p['단체명 ']) || txt(p['단체명']);
  const rows = [
    ['단체명', name],
    ['행사인원', txt(p['행사인원']) && `${txt(p['행사인원'])}명`],
    ['기간', txt(p['기간'])],
    ['체크인', txt(p['체크인'])],
    ['세금관련', txt(p['세금관련'])],
    ['문의사항', txt(p['문의사항'])],
    ['고객협의내용', txt(p['고객협의내용'])],
    ['특이사항', txt(p['특이사항'])],
  ].filter(([, v]) => v);
  return [marker_(page.id), ...rows.map(([k, v]) => `${k}: ${v}`)].join('\n');
}

// 카드를 받은 날(KST) — Gemini 의 "오늘"(연도 없는 날짜 해석)
export function asofKst_(page) {
  const t = page.created_time || txt((page.properties || {})['문의요청일']);
  return t ? new Date(Date.parse(t) + 9 * 3600e3).toISOString().slice(0, 10) : null;
}

// 만들 카드 고르기: 상태에 AUTO_STATUS, AUTO_FROM 이후, 아직 안 만든 것, 단체명·인원 있는 것. 오래된 것부터
export function pickNew_(pages, doneIds) {
  const done = new Set([...doneIds].map((x) => String(x).replace(/-/g, '')));
  return pages
    .filter((pg) => txt((pg.properties || {})['상태']).split(', ').includes(AUTO_STATUS))
    .filter((pg) => (asofKst_(pg) || '') >= AUTO_FROM)
    .filter((pg) => !done.has(String(pg.id).replace(/-/g, '')))
    .filter((pg) => { const p = pg.properties || {}; return (txt(p['단체명 ']) || txt(p['단체명'])) && (txt(p['행사인원']) || txt(p['문의사항'])); })
    .sort((a, b) => String(a.created_time).localeCompare(String(b.created_time)))
    .slice(0, AUTO_PER_RUN);
}

// 요청글 첫 줄에서 노션 카드 번호 꺼내기
export function pageIdOf_(request) {
  const m = String(request || '').match(/^\[노션 ([0-9a-f]{32})\]/);
  return m ? m[1] : null;
}

// 카드 댓글(직원이 노션 카드에서 바로 보는 것)
export function commentText_(reply) {
  return `🤖 견적 초안을 만들었어요 (고객에게는 아직 안 보냄)\n${String(reply).slice(0, 1700)}\n\n고칠 때: 카톡 채널 "목록" → "수정#번호: 인원 60" 또는 시트 조정표 고친 뒤 "다시#번호"`;
}
