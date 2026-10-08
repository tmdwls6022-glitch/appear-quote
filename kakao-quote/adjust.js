// 견적 조정장치 (순수 함수) — jin 10/5: 봇이 만든 견적을 사람이 보고 몇 칸만 고쳐 다시 계산.
//   ① 시트 탭 오른쪽 '조정표'(M8~N21) 칸을 고치고 카톡에 "다시"
//   ② 카톡에 "수정: 인원 60, 단가 80000, 바베큐 빼기"
// 두 방법 모두 결국 Gemini 가 읽은 요청(req)에 덮어쓰고 core.js 로 다시 계산한다(Gemini 다시 안 부름).

const TYPE_KO = { church: '교회', company: '회사', university: '대학', adultuniv: '대학원', group: '일반', agency: '여행사' };
const TYPE_EN = { 교회: 'church', 성당: 'church', 회사: 'company', 기업: 'company', 기관: 'company', 관공서: 'company',
  대학: 'university', 대학교: 'university', 학교: 'university', 대학원: 'adultuniv', 사이버대: 'adultuniv', 야간대: 'adultuniv', 일반: 'group', 개인: 'group', 가족: 'group', 여행사: 'agency' };
const OX = (v) => (v ? 'O' : 'X');
const yes = (s) => /^(o|O|ㅇ|예|네|있음|포함|true|1|y|Y)$/.test(String(s).trim());
const no = (s) => /^(x|X|아니오|아니요|없음|빼기|제외|false|0|n|N)$/.test(String(s).trim());

// 조정표 줄: [시트에 보이는 이름, req 필드, req→칸 값, 칸 값→req 값(빈칸이면 undefined = 안 바꿈)]
const num = (v) => { const n = Number(String(v).replace(/[^\d.-]/g, '')); return String(v).trim() === '' || isNaN(n) ? undefined : n; };
const ROWS = [
  ['인원(성인·중고등)', 'adults', (r) => r.adults ?? '', num],
  ['초등 이하', 'kids', (r) => r.kids ?? 0, num],
  ['체크인 (YYYY-MM-DD)', 'checkin', (r) => r.checkin ?? '', (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v).trim()) ? String(v).trim() : undefined],
  ['박 수 (당일 0)', 'nights', (r) => r.nights ?? '', num],
  ['단체종류 (교회/회사/대학/대학원/일반/여행사)', 'customerType', (r) => TYPE_KO[r.customerType] ?? '', (v) => TYPE_EN[String(v).trim()]],
  ['바베큐 (O/X)', 'bbq', (r) => OX(r.bbq !== false), (v) => yes(v) ? true : no(v) ? false : undefined],
  ['2인1실 (O/X)', 'twinRoom', (r) => OX(!!r.twinRoom), (v) => yes(v) ? true : no(v) ? false : undefined],
  ['대강당 (O/X)', 'wantsMainHall', (r) => OX(!!r.wantsMainHall), (v) => yes(v) ? true : no(v) ? false : undefined],
  ['추가 강당 (예: 1강당,2강당)', 'extraHalls', (r) => (r.extraHalls ?? []).join(','), (v) => String(v).trim() === '' ? [] : String(v).split(/[,\s]+/).filter(Boolean)],
  ['객실 추가 (실)', 'extraRooms', (r) => r.extraRooms ?? 0, num],
  ['빼는 식사 (끼)', 'skipMeals', (r) => r.skipMeals ?? 0, num],
  ['부가세 포함 (O/X)', 'vatDoc', (r) => OX(!!r.vatDoc), (v) => yes(v) ? true : no(v) ? false : undefined],
  ['1인 단가 직접 (비우면 자동)', 'unitOverride', (r) => r.unitOverride ?? '', (v) => String(v).trim() === '' ? null : num(v)],
];
const ADJ_ROW = 7;   // 0부터 센 줄 번호 → 시트 M8 부터
const ADJ_COL = 12;  // M열(라벨), N열(값)

// 시트에 쓸 표: [[라벨, 값], ...] (첫 줄은 제목)
function adjustTable_(req) {
  return [['▼ 조정표 — N열을 고치고 카톡에 "다시"', '']].concat(ROWS.map(([label, , get]) => [label, get(req)]));
}
// 시트에서 읽은 N열 값들 → req 에 덮어쓸 값
function fromTable_(values) {
  const out = {};
  ROWS.forEach(([, key, , parse], i) => { const v = parse(values[i] ?? ''); if (v !== undefined) out[key] = v; });
  return out;
}

// 카톡 "수정: 인원 60, 아동 5, 단가 80000, 바베큐 빼기, 2인1실, 대강당, 날짜 2026-11-13, 2박, 종류 회사"
function parseEdit_(text) {
  const out = {}, bad = [];
  for (const raw of String(text).split(/,(?!\d{3}(?!\d))|[\n/]+/)) {   // 80,000 의 쉼표는 안 자름
    const s = raw.trim(); if (!s) continue;
    let m;
    if ((m = s.match(/^(인원|성인)\s*(\d+)/))) out.adults = +m[2];
    else if ((m = s.match(/^(아동|초등|어린이|키즈)\s*(\d+)/))) out.kids = +m[2];
    else if ((m = s.match(/^단가\s*([\d,]+)/))) out.unitOverride = +m[1].replace(/,/g, '');
    else if (/^단가\s*(자동|원래)/.test(s)) out.unitOverride = null;
    else if ((m = s.match(/^(날짜|체크인)\s*(\d{4}-\d{2}-\d{2})/))) out.checkin = m[2];
    else if ((m = s.match(/^(\d+)\s*박/)) || (m = s.match(/^박수?\s*(\d+)/))) out.nights = +m[1];
    else if (/^당일/.test(s)) out.nights = 0;
    else if ((m = s.match(/^(종류|단체)\s*(\S+)/)) && TYPE_EN[m[2]]) out.customerType = TYPE_EN[m[2]];
    else if (/^바베큐\s*(빼|제외|없|X|x)/.test(s)) out.bbq = false;
    else if (/^바베큐/.test(s)) out.bbq = true;
    else if (/^2인\s*1실\s*(빼|취소|X|x|없)/.test(s)) out.twinRoom = false;
    else if (/^2인\s*1실/.test(s)) out.twinRoom = true;
    else if (/^대강당\s*(빼|취소|X|x|없)/.test(s)) out.wantsMainHall = false;
    else if (/^대강당/.test(s)) out.wantsMainHall = true;
    else if ((m = s.match(/^([1-4]강당)\s*추가/))) out.extraHalls = [...(out.extraHalls ?? []), m[1]];
    else if ((m = s.match(/^객실\s*(\d+)\s*실?\s*추가/)) || (m = s.match(/^객실\s*추가\s*(\d+)/))) out.extraRooms = +m[1];
    else if ((m = s.match(/^식사\s*(\d+)\s*끼?\s*빼/)) || (m = s.match(/^(\d+)\s*끼\s*빼/))) out.skipMeals = +m[1];
    else if (/^부가세\s*(빼|제외|X|x|없)/.test(s)) out.vatDoc = false;
    else if (/^부가세/.test(s)) out.vatDoc = true;
    else bad.push(s);
  }
  return { set: out, bad };
}

// 날짜·박수를 바꾸면 체크아웃도 맞춘다
function applyAdjust_(req, set) {
  const r = { ...req, ...set };
  if (('checkin' in set || 'nights' in set) && r.checkin && r.nights !== null && r.nights !== undefined) {
    const d = new Date(r.checkin + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + Number(r.nights));
    r.checkout = d.toISOString().slice(0, 10);
  }
  return r;
}

// 조정표에서 읽은 값 중 실제로 바뀐 것만 (빈칸·같은 값은 제외)
function diff_(req, set) {
  const cur = Object.fromEntries(ROWS.map(([, k, get, parse]) => [k, parse(get(req))]));
  return Object.fromEntries(Object.entries(set).filter(([k, v]) => JSON.stringify(v ?? null) !== JSON.stringify(cur[k] ?? null)));
}

// 사람이 읽을 바뀐 점 한 줄
function describe_(set) {
  const label = Object.fromEntries(ROWS.map(([l, k]) => [k, l.replace(/ \(.*/, '')]));
  return Object.entries(set).map(([k, v]) => `${label[k] ?? k} ${v === null ? '자동' : typeof v === 'boolean' ? OX(v) : Array.isArray(v) ? v.join(',') || '없음' : k === 'customerType' ? TYPE_KO[v] : v}`).join(', ');
}

export { adjustTable_, fromTable_, diff_, parseEdit_, applyAdjust_, describe_, ADJ_ROW, ADJ_COL, ROWS };
