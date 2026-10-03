/**
 * 어피어연수원 견적서 자동작성 (2026-10-03, v1 테스트)
 *
 * 쓰는 법
 *  1) 아무 견적 탭의 M열(요청사항 칸)에 고객 "*견적요청" 글을 붙여넣는다.
 *  2) 메뉴 [견적 자동작성] → [이 탭의 요청으로 견적 만들기]
 *  3) 기간·고객 종류에 맞는 양식 탭을 복사해 "단체명" 이름의 새 탭을 만들고 칸을 채운다.
 *     애매한 칸은 노란색 + 메모. 발송은 하지 않는다.
 *
 * 스크립트 속성(직접 입력, 채팅에 쓰지 말 것)
 *  GEMINI_API_KEY : Gemini 키
 *  NOTION_TOKEN   : 노션 통합 키 (예약 캘린더 DB_인입콜에 연결돼 있어야 함)
 */

// ───────────────────────── 설정 (jin 확정 가격표 10/3) ─────────────────────────
var CFG = {
  NOTION_DS: '1cf33639-fc7f-80e9-8abd-000bf8bbb0d0', // DB_인입콜 data source
  NOTION_VERSION: '2025-09-03',
  BRANCH: '어피어',                                    // 예약지점에 이 글자가 들어간 것만
  DEPOSIT_CLEAN: 100000,                               // 청소보증금
  ACC_DEFAULT: '카카오뱅크 3333-15-5582511 김은하',
  ACC_VAT: '신한 140-015-577115 (주)어피어플레이스',
  // 1인 단가(부가세 별도)
  PRICE: {
    '당일': { bbq: 40000, korean: 30000, bbqHigh: 47000, koreanHigh: 37000 }, // jin 10/3: 금·토·일과 7~8월은 높은 값
    '1박2일': { church: 75000, group: 75000, company3: 75000, company2: 85000, mt: 49000 },
    '2박3일': { uni: 108000, offWeekday: 120000, offWeekend: 130000, peak: 150000 }, // 영업방 10/2: 평일 12, 주말 13, 7~8월 패키지 15
    '3박4일': { def: 175000, peak: 185000 },        // jin 10/3: 비수기 17.5만, 7~8월 18.5만
    '4박5일': { def: 260000 }
  },
  KID_DISCOUNT: 20000,
  PENSION_EXTRA: 150000,
  PEAK_1N: 10000,                                      // 1박2일 7~8월 1인 추가
  TWIN_PER_NIGHT: 10000,                               // 2인1실 1인 1박당 추가 — jin 10/3
  MEAL_DROP: 10000,                                    // 식사 1끼 빼면 1인 −1만, 7~8월 불가 — jin 10/3
  ROOM_EXTRA: 60000,                                   // 객실 1실 추가(1박) — jin 10/3
  MAIN_HALL_UPGRADE: 1000000,                          // 4강당 단체가 대강당 원할 때 하루 — jin 10/3, 7~8월 불가
  // 강당: 인원 한도, 추가 대관 하루 요금
  HALLS: [
    { name: '1강당', cap: 20, extra: 300000 },
    { name: '2강당', cap: 60, extra: 500000 },
    { name: '3강당', cap: 60, extra: 500000 },
    { name: '4강당', cap: 130, extra: 800000 },
    { name: '독립대강당', cap: 300, extra: 1000000 }
  ],
  // 기간·종류별 복사할 양식 탭 (앞에서부터 있는 탭 사용)
  TEMPLATES: {
    mt: ['MT', '기본 양식'],
    company: ['※ 워크샵', '기본 양식'],
    '1박2일': ['★여름 1박 2일', '기본 양식'],
    '2박3일': ['☆여름 2박 3일', '★여름 2박 3일'],
    long: ['★여름 3박 4일', '☆여름 2박 3일', '★여름 2박 3일'],
    '당일': ['기본 양식']
  },
  MEALS: {
    '당일': { bbq: '포함', korean: '', total: '총 1식' },
    '1박2일': { bbq: '포함(1일 차 석식)', korean: '퇴실일 조식', total: '총 2식' },
    '2박3일': { bbq: '포함(2일 차 석식)', korean: '1일 차 석식 / 2일 차 조,중식 / 3일 차 조식', total: '총 5식',
      noBbq: '1일 차 석식 / 2일 차 조,중,석식 / 3일 차 조식' },
    '3박4일': { bbq: '포함(2일 차 석식)', korean: '1일 차 석식 / 2일 차 조,중식 / 3일 차 조,중,석식 / 4일 차 조식', total: '총 8식',
      noBbq: '1일 차 석식 / 2일 차 조,중,석식 / 3일 차 조,중,석식 / 4일 차 조식' },
    '4박5일': { bbq: '포함(2일 차 석식)', korean: '1일 차 석식 / 2일 차 조,중식 / 3일 차 조,중,석식 / 4일 차 조,중,석식 / 5일 차 조식', total: '총 11식',
      noBbq: '1일 차 석식 / 2일 차 조,중,석식 / 3일 차 조,중,석식 / 4일 차 조,중,석식 / 5일 차 조식' }
  }
};

// ───────────────────────── 메뉴 ─────────────────────────
function onOpen() {
  SpreadsheetApp.getUi().createMenu('견적 자동작성')
    .addItem('이 탭의 요청으로 견적 만들기', 'makeQuoteFromActiveSheet')
    .addItem('설정 확인', 'checkSetup')
    .addToUi();
}

function checkSetup() {
  var p = PropertiesService.getScriptProperties();
  var msg = [];
  msg.push('Gemini 키: ' + (p.getProperty('GEMINI_API_KEY') ? '있음' : '없음'));
  msg.push('노션 키: ' + (p.getProperty('NOTION_TOKEN') ? '있음' : '없음'));
  try { msg.push('Gemini 모델: ' + pickGeminiModel_()); } catch (e) { msg.push('Gemini 확인 실패: ' + e.message); }
  try { var n = notionBookings_('2027-01-14', '2027-01-16'); msg.push('노션 연결: 성공 (2027-01-14~16 겹치는 예약 ' + n.length + '건)'); }
  catch (e) { msg.push('노션 확인 실패: ' + e.message); }
  SpreadsheetApp.getUi().alert(msg.join('\n'));
}

// ───────────────────────── 본체 ─────────────────────────
function makeQuoteFromActiveSheet() {
  var ss = SpreadsheetApp.getActive();
  var src = ss.getActiveSheet();
  var reqText = readRequestText_(src);
  if (!reqText) { SpreadsheetApp.getUi().alert('M~N열에서 견적요청 글을 못 찾았어요. M열에 붙여넣고 다시 눌러주세요.'); return; }

  var req = parseRequest_(reqText);                 // Gemini
  var q = buildQuote_(req);                          // 가격·배정 계산
  var busy = { halls: {}, pensions: {} };
  if (q.checkin) {
    try { busy = busyFromBookings_(notionBookings_(q.checkin, q.checkout)); }
    catch (e) { q.flags.push('노션 예약 확인 실패: ' + e.message); }
  } else {
    q.flags.push('날짜가 확실하지 않아 예약 현황을 못 봤어요');
  }
  assignRooms_(q, busy);

  var sh = copyTemplate_(ss, q);
  fillSheet_(sh, q, reqText);
  ss.setActiveSheet(sh);
  SpreadsheetApp.getUi().alert('견적 탭 "' + sh.getName() + '" 만들었어요.\n' +
    (q.flags.length ? '확인할 것:\n- ' + q.flags.join('\n- ') : '확인할 것 없음'));
}

function readRequestText_(sh) {
  var last = Math.min(sh.getLastRow(), 60);
  if (last < 1) return '';
  var vals = sh.getRange(1, 13, last, 2).getDisplayValues(); // M:N
  var lines = [];
  vals.forEach(function (r) { r.forEach(function (c) { c = String(c).trim(); if (c && c !== '←' && c.indexOf('내용을 채워주세요') < 0 && c.indexOf('아래에계약서있음') < 0) lines.push(c); }); });
  return lines.join('\n').trim();
}

// ───────────────────────── Gemini: 요청 읽기 ─────────────────────────
function pickGeminiModel_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('gemini_model'); if (hit) return hit;
  var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY 없음');
  var res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=' + key, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('모델 목록 ' + res.getResponseCode());
  var names = JSON.parse(res.getContentText()).models
    .filter(function (m) { return (m.supportedGenerationMethods || []).indexOf('generateContent') >= 0; })
    .map(function (m) { return m.name.replace('models/', ''); })
    .filter(function (n) { return /^gemini-[\d.]+-flash$/.test(n) || /^gemini-[\d.]+-flash-latest$/.test(n) || n === 'gemini-flash-latest'; });
  if (!names.length) throw new Error('flash 모델 없음');
  names.sort(function (a, b) { return verOf_(b) - verOf_(a); });
  cache.put('gemini_model', names[0], 21600);
  return names[0];
}
function verOf_(n) { var m = n.match(/gemini-([\d.]+)/); return m ? parseFloat(m[1]) : 99; }

function parseRequest_(text) {
  var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  var prompt = [
    '너는 수련원 예약 담당이야. 아래 고객 견적요청 글을 읽고 JSON 하나만 돌려줘. 모르는 값은 null.',
    '오늘 날짜: ' + today + ' (연도가 없으면 오늘 이후 가장 가까운 날짜로).',
    '필드:',
    'org(단체명), contact(담당자 이름), phone, adults(성인 수, 숫자), kids(초등 이하 수, 숫자, 없으면 0),',
    'checkin(YYYY-MM-DD), checkout(YYYY-MM-DD), nights(박 수, 당일이면 0),',
    'scheduleText(고객이 쓴 일정 원문), customerType(church|company|university|group|agency 중 하나),',
    'bbq(true면 바베큐 원함, false면 원하지 않음/제외, null이면 언급 없음),',
    'twinRoom(2인1실 원하면 true), vatDoc(세금계산서·현금영수증·카드결제 언급 시 true),',
    'extraHalls(추가로 쓰고 싶다는 강당 이름 배열, 예 ["1강당"]), wantsMainHall(대강당 원하면 true), extraRooms(객실을 몇 실 더 원하는지 숫자, 없으면 0), skipMeals(기본 패키지에서 빼 달라는 식사 끼니 수, 없으면 0),',
    'notes(그 밖의 요청 한 줄), unsure(확실하지 않은 점 배열, 예: "날짜 후보가 2개").',
    '',
    '견적요청 글:',
    text
  ].join('\n');
  var body = { contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0 } };
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + pickGeminiModel_() + ':generateContent?key=' + key;
  var res = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Gemini ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
  var out = JSON.parse(res.getContentText()).candidates[0].content.parts[0].text;
  return JSON.parse(out.replace(/^```json\s*|```$/g, ''));
}

// ───────────────────────── 가격 계산 (순수 함수, 테스트 가능) ─────────────────────────
function periodName_(nights) {
  return nights <= 0 ? '당일' : nights === 1 ? '1박2일' : nights === 2 ? '2박3일' : nights === 3 ? '3박4일' : '4박5일';
}
function periodLabel_(p) { return p === '당일' ? '당일' : p.replace('박', '박 '); } // "1박 2일"

// 금요일 밤이나 토요일 밤이 끼면 주말 단가(목금토·금토일)
function hasWeekendNight_(checkin, nights) {
  if (!checkin) return false;
  var d = new Date(checkin + 'T00:00:00');
  for (var i = 0; i < nights; i++) { var w = (d.getDay() + i) % 7; if (w === 5 || w === 6) return true; }
  return false;
}

function buildQuote_(r) {
  var flags = (r.unsure || []).slice();
  var nights = r.nights;
  if ((nights === null || nights === undefined) && r.checkin && r.checkout) {
    nights = Math.round((new Date(r.checkout) - new Date(r.checkin)) / 86400000);
  }
  if (nights === null || nights === undefined) { nights = 1; flags.push('박 수를 몰라 1박2일로 가정'); }
  if (nights > 4) { flags.push(nights + '박은 가격표에 없어 4박5일 단가 사용'); }
  var period = periodName_(nights);
  var adults = Number(r.adults) || 0, kids = Number(r.kids) || 0;
  var people = adults + kids;
  if (!people) { flags.push('인원을 몰라 30명으로 가정'); adults = 30; people = 30; }
  var type = r.customerType || 'group';
  var month = r.checkin ? Number(r.checkin.slice(5, 7)) : null;

  // 단가와 양식
  var unit, tpl, pkgName;
  if (period === '당일') {
    var dw = r.checkin ? new Date(r.checkin + 'T00:00:00').getDay() : -1;
    var high = month === 7 || month === 8 || dw === 5 || dw === 6 || dw === 0;
    var dp = CFG.PRICE['당일'];
    unit = r.bbq === false ? (high ? dp.koreanHigh : dp.korean) : (high ? dp.bbqHigh : dp.bbq); tpl = 'TEMPLATES.당일'; pkgName = '당일 패키지'; }
  else if (period === '1박2일') {
    if (type === 'university') { unit = CFG.PRICE['1박2일'].mt; tpl = 'mt'; pkgName = 'MT 패키지'; }
    else if (type === 'company' || type === 'agency') { unit = r.twinRoom ? CFG.PRICE['1박2일'].company2 : CFG.PRICE['1박2일'].company3; tpl = 'company'; pkgName = '바베큐 패키지'; }
    else { unit = type === 'church' ? CFG.PRICE['1박2일'].church : CFG.PRICE['1박2일'].group; tpl = '1박2일'; pkgName = '1박 2일 패키지'; }
    if (type !== 'university' && (month === 7 || month === 8)) unit += CFG.PEAK_1N;   // jin 10/3: 1박2일 7~8월 +1만
  } else if (period === '2박3일') {
    if (month === 7 || month === 8) unit = CFG.PRICE['2박3일'].peak;
    else if (type === 'university') { unit = CFG.PRICE['2박3일'].uni; flags.push('대학 2박3일은 3식 10.8만 — 식사 문구를 총 3식으로 고쳐 주세요'); }
    else unit = hasWeekendNight_(r.checkin, nights) ? CFG.PRICE['2박3일'].offWeekend : CFG.PRICE['2박3일'].offWeekday;
    if (!r.checkin) flags.push('날짜를 몰라 평일 단가 사용');
    tpl = '2박3일'; pkgName = '수련회 패키지';
  } else { unit = (CFG.PRICE[period].peak && (month === 7 || month === 8)) ? CFG.PRICE[period].peak : CFG.PRICE[period].def; tpl = 'long'; pkgName = '수련회 패키지'; }
  if (people >= 250) flags.push('대형 단체 특가(11.5~12만)는 대표 방침상 전화로만 — 견적가 확인');
  if (nights >= 2 && r.twinRoom) unit += CFG.TWIN_PER_NIGHT * nights;   // 2인1실: 1박당 +1만
  var skip = Number(r.skipMeals) || 0;
  if (skip > 0 && period !== '당일') {
    if (month === 7 || month === 8) flags.push('7~8월은 식사를 뺄 수 없음 — 고객이 ' + skip + '끼 빼 달라고 함');
    else { unit -= CFG.MEAL_DROP * skip; flags.push('식사 ' + skip + '끼 빼고 1인 ' + (CFG.MEAL_DROP * skip).toLocaleString() + '원 깎음 — 식사 문구(총 몇 식)는 직접 고쳐 주세요'); }
  }

  var bbq = r.bbq !== false; // 언급 없으면 기본 포함
  if (period === '1박2일' && type === 'university') bbq = true;

  var days = Math.max(1, nights); // 강당 대관 "하루" = 박 수
  var vat = !!r.vatDoc || type === 'company' || type === 'agency';

  return {
    org: r.org || '단체명 미정', contact: r.contact || '', phone: r.phone || '',
    adults: adults, kids: kids, people: people, period: period, nights: nights, days: days,
    checkin: r.checkin || null, checkout: r.checkout || null, scheduleText: r.scheduleText || '',
    type: type, unit: unit, tplKey: tpl, pkgName: pkgName, bbq: bbq, vat: vat,
    twin: !!r.twinRoom, wantsMainHall: !!r.wantsMainHall, extraHallsWanted: r.extraHalls || [], extraRooms: Number(r.extraRooms) || 0, skipMeals: Number(r.skipMeals) || 0, month: month,
    notes: r.notes || '', flags: flags, lines: [], extras: []
  };
}

function smallestHallFor_(people, wantsMain) {
  if (wantsMain && people > 130) return '독립대강당';
  for (var i = 0; i < CFG.HALLS.length; i++) if (people <= CFG.HALLS[i].cap) return CFG.HALLS[i].name;
  return null;
}
function hallInfo_(name) { for (var i = 0; i < CFG.HALLS.length; i++) if (CFG.HALLS[i].name === name) return CFG.HALLS[i]; return null; }

function assignRooms_(q, busy) {
  // 강당: 인원에 맞는 가장 작은 강당, 차 있으면 다음 크기
  var want = smallestHallFor_(q.people, q.wantsMainHall);
  var order = CFG.HALLS.map(function (h) { return h.name; });
  var hall = null;
  if (!want) { q.flags.push(q.people + '명은 대강당 한도(300명) 초과 — 강당 확인 필요'); want = '독립대강당'; }
  for (var i = order.indexOf(want); i < order.length; i++) {
    if (!busy.halls[order[i]]) { hall = order[i]; break; }
  }
  if (!hall) { hall = want; q.flags.push(want + ' 이후 큰 강당이 모두 예약돼 있음 — 확인 필요'); }
  else if (hall !== want) q.flags.push(want + '이(가) 예약돼 있어 ' + hall + '(으)로 배정');
  q.hall = hall;

  // 추가 강당 (4강당 이하 단체가 대강당 원하면 추가 대관으로)
  q.extraHalls = [];
  var wanted = q.extraHallsWanted.slice();
  if (q.wantsMainHall && hall !== '독립대강당') wanted.push('독립대강당');
  var seen = {};
  wanted.forEach(function (n) {
    var name = String(n).replace(/\s/g, '').replace(/^대강당$/, '독립대강당');
    var h = hallInfo_(name);
    if (!h) { q.flags.push('추가 강당 "' + n + '"을(를) 못 알아봄'); return; }
    if (name === hall || seen[name]) return; seen[name] = 1;
    if (name === '독립대강당' && (q.month === 7 || q.month === 8)) { q.flags.push('여름(7~8월)엔 작은 단체 대강당 대관 불가 — 대강당 줄 넣지 않음'); return; }
    if (name === '독립대강당' && (q.month === 12 || q.month === 1 || q.month === 2)) q.flags.push('겨울 대강당 대관은 jin 결정 대기 — 하루 100만으로 적음, 진행 여부 확인');
    if (busy.halls[name]) q.flags.push('추가 요청한 ' + name + '은(는) 그날 예약 있음');
    q.extraHalls.push({ name: name + ' (추가)', label: '추가 대관 ' + q.days + '일 (하루 ' + h.extra.toLocaleString() + '원)', day: h.extra, qty: q.days, amount: h.extra * q.days });
  });
  if (q.extraRooms && q.nights > 0) {
    var rq = q.extraRooms * q.nights;
    q.extraHalls.push({ name: '객실 추가', label: q.extraRooms + '실 × ' + q.nights + '박 (1실 ' + CFG.ROOM_EXTRA.toLocaleString() + '원)', day: CFG.ROOM_EXTRA, qty: rq, amount: CFG.ROOM_EXTRA * rq });
  }

  // 펜션동
  var need = q.people <= 20 ? 0 : q.people <= 40 ? 1 : q.people <= 70 ? 2 : 3;
  if (q.nights === 0) { q.pensions = []; q.ondol = 0; return; }             // 당일: 숙박 없음
  if (q.type === 'university' && q.period === '1박2일') need = 0;           // MT: 본관만, 펜션은 동당 15만 선택
  var free = ['A', 'B', 'C'].filter(function (d) { return !busy.pensions[d]; });
  if (free.length < need) q.flags.push('펜션 ' + need + '동 필요한데 ' + free.length + '동만 비어 있음');
  q.pensions = free.slice(0, need);
  var inPension = q.pensions.length * 10;
  q.ondol = Math.max(0, Math.ceil((q.people - inPension) / (q.twin ? 2 : 3)));
}

function priceTotals_(q) {
  var base = q.unit * q.people;
  var kidDisc = q.kids ? -CFG.KID_DISCOUNT * q.kids : 0;
  var extraHall = q.extraHalls.reduce(function (s, h) { return s + h.amount; }, 0);
  var supply = base + kidDisc + extraHall;
  var total = q.vat ? Math.round(supply * 1.1) : supply;
  var deposit = Math.round(total * 0.3 / 100000) * 100000;
  if (q.period === '1박2일' && q.type === 'university') deposit = Math.min(deposit, 300000);
  var balance = total - deposit + CFG.DEPOSIT_CLEAN;
  return { base: base, kidDisc: kidDisc, extraHall: extraHall, supply: supply, tax: total - supply,
    total: total, deposit: deposit, balance: balance, account: q.vat ? CFG.ACC_VAT : CFG.ACC_DEFAULT };
}

// ───────────────────────── 노션: 예약 현황 ─────────────────────────
function notionBookings_(checkin, checkout) {
  var token = PropertiesService.getScriptProperties().getProperty('NOTION_TOKEN');
  if (!token) throw new Error('NOTION_TOKEN 없음');
  var end = checkout || checkin;
  var url = 'https://api.notion.com/v1/data_sources/' + CFG.NOTION_DS + '/query';
  var body = { page_size: 100, filter: { and: [
    { property: '체크인', date: { on_or_before: end } },
    { property: '체크인', date: { on_or_after: shiftDate_(checkin, -10) } }
  ] } };
  var out = [], cursor = null;
  do {
    if (cursor) body.start_cursor = cursor;
    var res = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + token, 'Notion-Version': CFG.NOTION_VERSION }, payload: JSON.stringify(body) });
    if (res.getResponseCode() !== 200) throw new Error('노션 ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
    var j = JSON.parse(res.getContentText());
    j.results.forEach(function (pg) {
      var p = pg.properties;
      var d = p['체크인'] && p['체크인'].date; if (!d) return;
      var s = d.start.slice(0, 10), e = (d.end || d.start).slice(0, 10);
      if (e < checkin || s > end) return;                          // 기간 안 겹침
      if (propText_(p['예약지점']).indexOf(CFG.BRANCH) < 0) return;
      var confirmed = propBool_(p['예약확정고객']) || propBool_(p['가예약']);
      if (!confirmed) return;
      out.push({ name: propText_(p['단체명 ']) || propText_(p['단체명']), start: s, end: e,
        halls: propText_(p['강당 배정']), pensions: propText_(p['어피어 펜션동']) });
    });
    cursor = j.has_more ? j.next_cursor : null;
  } while (cursor);
  return out;
}
function busyFromBookings_(list) {
  var busy = { halls: {}, pensions: {} };
  list.forEach(function (b) {
    CFG.HALLS.forEach(function (h) { if (b.halls.indexOf(h.name) >= 0) busy.halls[h.name] = b.name; });
    ['A', 'B', 'C'].forEach(function (d) { if (new RegExp('(^|[^A-Z])' + d + '($|[^A-Z])').test(b.pensions)) busy.pensions[d] = b.name; });
  });
  return busy;
}
function propText_(p) {
  if (!p) return '';
  switch (p.type) {
    case 'title': case 'rich_text': return (p[p.type] || []).map(function (t) { return t.plain_text; }).join('');
    case 'select': case 'status': return p[p.type] ? p[p.type].name : '';
    case 'multi_select': return (p.multi_select || []).map(function (o) { return o.name; }).join(',');
    case 'checkbox': return p.checkbox ? 'Y' : '';
    case 'formula': return p.formula ? String(p.formula[p.formula.type] || '') : '';
    default: return '';
  }
}
function propBool_(p) { if (!p) return false; if (p.type === 'checkbox') return p.checkbox; return !!propText_(p); }
function shiftDate_(ymd, n) { var d = new Date(ymd + 'T00:00:00'); d.setDate(d.getDate() + n); return Utilities.formatDate(d, 'Asia/Seoul', 'yyyy-MM-dd'); }

// ───────────────────────── 시트 채우기 ─────────────────────────
function copyTemplate_(ss, q) {
  var names = q.tplKey === 'TEMPLATES.당일' ? CFG.TEMPLATES['당일'] : CFG.TEMPLATES[q.tplKey];
  var tpl = null;
  for (var i = 0; i < names.length && !tpl; i++) tpl = ss.getSheetByName(names[i]);
  if (!tpl) throw new Error('양식 탭을 못 찾음: ' + names.join(', '));
  var name = q.org, n = 2;
  while (ss.getSheetByName(name)) name = q.org + ' (' + (n++) + ')';
  var sh = tpl.copyTo(ss).setName(name);
  ss.setActiveSheet(sh); ss.moveActiveSheet(1);
  return sh;
}

function findCell_(sh, re, startRow) {
  var vals = sh.getDataRange().getDisplayValues();
  for (var r = (startRow || 0); r < vals.length; r++)
    for (var c = 0; c < Math.min(vals[r].length, 11); c++)
      if (re.test(String(vals[r][c]).trim())) return { row: r + 1, col: c + 1 };
  return null;
}
// 라벨 칸(병합 포함) 오른쪽의 첫 값 칸
function rightOf_(sh, cell) {
  var rg = sh.getRange(cell.row, cell.col);
  var m = rg.getMergedRanges();
  var col = m.length ? m[0].getLastColumn() + 1 : cell.col + 1;
  return sh.getRange(cell.row, col);
}
function setRight_(sh, re, value, flag) {
  var c = findCell_(sh, re);
  if (!c) return null;
  var rg = rightOf_(sh, c);
  rg.setValue(value);
  if (flag) mark_(rg, flag);
  return rg;
}
function mark_(rg, note) { rg.setBackground('#fff59d'); rg.setNote(note); }

function fillSheet_(sh, q, reqText) {
  var t = priceTotals_(q);
  var plabel = periodLabel_(q.period);

  // 머리 칸
  var dateCell = findCell_(sh, /^\d{4}-\d{2}-\d{2}$/);
  if (dateCell) sh.getRange(dateCell.row, dateCell.col).setValue(Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'));
  setRight_(sh, /^단체명$/, q.org);
  var cRow = findCell_(sh, /^담당자$/, (findCell_(sh, /^소재지$/) || { row: 1 }).row - 1);
  if (cRow) rightOf_(sh, cRow).setValue(q.contact ? q.contact + ' 님' : ''); // 둘째 '담당자'(소재지 줄)
  setRight_(sh, /^연락처$/, q.phone);
  setRight_(sh, /^인원수$/, q.people);
  setRight_(sh, /^계약일자$/, scheduleLine_(q), q.checkin ? null : '날짜 확인 필요');

  // 표
  var head = findCell_(sh, /^서비스종류$/);
  if (!head) throw new Error('표 머리(서비스종류)를 못 찾음');
  var hv = sh.getRange(head.row, 1, 1, 11).getDisplayValues()[0];
  var col = {};
  ['서비스종류', '내용', '수량', '단가', '세액', '합계', '비고'].forEach(function (k) { var i = hv.indexOf(k); if (i >= 0) col[k] = i + 1; });
  var endRow = (findCell_(sh, /선택사항/, head.row) || { row: head.row + 15 }).row - 1;
  var meals = CFG.MEALS[q.period];
  var hallDone = false, ondolDone = false, pensionDone = false;
  var setC = function (r, k, v) { if (col[k]) sh.getRange(r, col[k]).setValue(v); };
  var setSum = function (r, v) { if (!col['합계']) return; var c = sh.getRange(r, col['합계']); if (!c.getFormula()) c.setValue(v); };

  for (var r = head.row + 1; r <= endRow; r++) {
    var kind = String(sh.getRange(r, col['서비스종류'] || 2).getDisplayValue()).trim();
    var content = col['내용'] ? String(sh.getRange(r, col['내용']).getDisplayValue()) : '';
    if (/패키지$/.test(kind)) {
      setC(r, '서비스종류', q.pkgName);
      setC(r, '내용', plabel + ' ' + q.people + '명(최소보증인원)');
      setC(r, '수량', q.people); setC(r, '단가', q.unit);
      setC(r, '세액', q.vat ? Math.round(q.unit * 0.1) : 0);
      setSum(r, q.vat ? Math.round(q.unit * 1.1) * q.people : q.unit * q.people);
    } else if (/^BBQ/.test(kind)) {
      setC(r, '수량', q.bbq ? q.people : '—');
      setC(r, '단가', q.bbq ? meals.bbq : '제외');
      if (!q.bbq) setC(r, '내용', '미이용');
      if (col['비고'] && meals.total) setC(r, '비고', q.bbq ? meals.total : '');
    } else if (/서비스 메뉴/.test(kind)) {
      setC(r, '수량', q.bbq ? q.people : '—'); setC(r, '단가', q.bbq ? '포함' : '제외');
    } else if (/^한식/.test(kind)) {
      setC(r, '내용', q.bbq ? meals.korean : (meals.noBbq || meals.korean));
      setC(r, '수량', q.people); setC(r, '단가', '포함');
    } else if (/객실/.test(kind) && /펜션/.test(content)) {
      pensionDone = true;
      setC(r, '내용', pensionText_(q.pensions));
      setC(r, '수량', q.pensions.length); setC(r, '단가', q.pensions.length ? '포함' : '미배정');
    } else if (/객실/.test(kind) && /온돌|침대/.test(content)) {
      ondolDone = true;
      setC(r, '내용', (q.twin ? '2인1실' : '3인1실') + ' 온돌룸 (본관동)');
      setC(r, '수량', q.ondol); setC(r, '단가', '포함');
    } else if (/강당$|강당 OR|강당 or/.test(kind) && !/음향/.test(kind)) {
      if (!hallDone) {
        hallDone = true;
        setC(r, '서비스종류', q.hall);
        setC(r, '내용', plabel.replace(' ', '') + ' 단독사용');
        setC(r, '수량', 1); setC(r, '단가', '포함');
      }
    }
  }
  // 추가 강당 줄: 첫 강당 줄 아래에 끼워 넣기
  var hallRow = findCell_(sh, new RegExp('^' + q.hall + '$'), head.row);
  q.extraHalls.slice().reverse().forEach(function (h) {
    if (!hallRow) return;
    sh.insertRowAfter(hallRow.row);
    var nr = hallRow.row + 1;
    sh.getRange(hallRow.row, 1, 1, 11).copyTo(sh.getRange(nr, 1, 1, 11), { formatOnly: true });
    setC(nr, '서비스종류', h.name);
    setC(nr, '내용', h.label);
    setC(nr, '수량', h.qty); setC(nr, '단가', h.day);
    setC(nr, '세액', q.vat ? Math.round(h.day * 0.1) : 0);
    setSum(nr, q.vat ? Math.round(h.amount * 1.1) : h.amount);
  });
  if (q.kids && hallRow) {
    var pk = findCell_(sh, /패키지$/, head.row);
    sh.insertRowAfter(pk.row); var kr = pk.row + 1;
    sh.getRange(pk.row, 1, 1, 11).copyTo(sh.getRange(kr, 1, 1, 11), { formatOnly: true });
    setC(kr, '서비스종류', '초등이하 할인'); setC(kr, '내용', '초등 이하 ' + q.kids + '명');
    setC(kr, '수량', q.kids); setC(kr, '단가', -CFG.KID_DISCOUNT); setC(kr, '세액', 0);
    setSum(kr, -CFG.KID_DISCOUNT * q.kids * (q.vat ? 1.1 : 1));
  }
  if (!pensionDone && q.pensions.length) q.flags.push('양식에 펜션 줄이 없어 펜션 ' + q.pensions.join('·') + '동은 비고에 직접 적어주세요');
  if (!ondolDone) q.flags.push('양식에 온돌룸 줄이 없음');

  // 합계·계약금·잔금
  var vatTxt = q.vat ? '부가세 포함' : '부가세 제외';
  var totRow = findCell_(sh, /^총 금액 \(/);
  if (totRow) {
    sh.getRange(totRow.row, totRow.col).setValue('총 금액 (식사+강당+음향기기)' + vatTxt);
    var tv = rightOf_(sh, totRow); if (!tv.getFormula()) tv.setValue(t.total);
  }
  var topTot = findCell_(sh, /^총 금액$/);
  if (topTot) { var tt = rightOf_(sh, topTot); if (!tt.getFormula()) tt.setValue(t.total); }
  var dep = findCell_(sh, /^계약금 입금/);
  if (dep) { var a = rightOf_(sh, dep); a.setValue(t.account); var amt = rightOf_(sh, { row: dep.row, col: a.getColumn() }); if (!amt.getFormula()) amt.setValue(t.deposit); }
  var bal = findCell_(sh, /^잔금/);
  if (bal) { var b = rightOf_(sh, bal); b.setValue(t.account); var bamt = rightOf_(sh, { row: bal.row, col: b.getColumn() }); if (!bamt.getFormula()) bamt.setValue(t.balance); }

  // 요청 원문은 M열에 그대로 남김
  sh.getRange('M5').setValue(reqText);
  // 확인 메모
  var memo = ['[자동작성 확인용] ' + q.period + ' / ' + q.type + ' / 단가 ' + q.unit.toLocaleString() + ' / 강당 ' + q.hall +
    ' / 펜션 ' + (q.pensions.join('·') || '없음') + ' / 온돌 ' + q.ondol + '실 / 총액 ' + t.total.toLocaleString() + (q.vat ? ' (부가세 포함)' : '')];
  if (q.flags.length) memo.push('확인 필요: ' + q.flags.join(' / '));
  sh.getRange('M3').setValue(memo.join('\n')).setBackground(q.flags.length ? '#fff59d' : '#e8f5e9').setWrap(true);
}

function scheduleLine_(q) {
  if (!q.checkin) return q.scheduleText || '';
  var w = ['일', '월', '화', '수', '목', '금', '토'];
  var f = function (s) { var d = new Date(s + 'T00:00:00'); return (d.getMonth() + 1) + '월 ' + d.getDate() + '일(' + w[d.getDay()] + ')'; };
  var y = q.checkin.slice(0, 4) + '년 ';
  return y + f(q.checkin) + (q.checkout && q.checkout !== q.checkin ? ' ~ ' + f(q.checkout) : '') + ' · ' + periodLabel_(q.period);
}
function pensionText_(list) {
  if (!list.length) return '펜션 미배정';
  var ab = list.filter(function (d) { return d !== 'C'; }), out = [];
  if (ab.length) out.push('65평 복층 펜션 ' + ab.join(',') + '동(거실, 방4, 화장실3)');
  if (list.indexOf('C') >= 0) out.push('70평 복층 펜션 C동(거실, 방5, 화장실3)');
  return out.join('\n');
}

// Node 테스트용 내보내기 (Apps Script에서는 무시됨)
if (typeof module !== 'undefined') module.exports = { hasWeekendNight_, CFG: CFG, buildQuote_: buildQuote_, assignRooms_: assignRooms_, priceTotals_: priceTotals_, smallestHallFor_: smallestHallFor_, busyFromBookings_: busyFromBookings_ };
