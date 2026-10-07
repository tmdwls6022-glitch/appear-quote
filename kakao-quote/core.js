// 어피어 견적 가격 계산 (순수 함수) — 카톡 챗봇 서버(kakao-quote)가 씀.
// 원본: quote/견적자동작성.gs 의 같은 이름 함수들. 가격을 바꾸면 이 파일의 CFG를 고친다.
export const CFG = {
  NOTION_DS: '1cf33639-fc7f-80e9-8abd-000bf8bbb0d0', // DB_인입콜 data source
  NOTION_VERSION: '2025-09-03',
  BRANCH: '어피어',                                    // 예약지점에 이 글자가 들어간 것만
  DEPOSIT_CLEAN: 100000,                               // 청소보증금
  ACC_DEFAULT: '카카오뱅크 3333-15-5582511 김은하',
  ACC_VAT: '신한 140-015-577115 (주)어피어플레이스',
  // 1인 단가(부가세 별도)
  PRICE: {
    '당일': { bbq: 43000, korean: 30000, bbqHigh: 47000, koreanHigh: 37000 }, // jin 10/3: 금·토·일과 7~8월은 높은 값 / jin 10/7: 평일 BBQ 4.3만
    '1박2일': { church: 75000, group: 75000, company3: 75000, company2: 85000, mt: 49000 },
    '2박3일': { uni: 108000, offWeekday: 130000, offWeekend: 130000, peak: 150000 }, // 영업방 10/2: 평일 12, 주말 13, 7~8월 패키지 15
    '3박4일': { def: 175000, peak: 185000 },        // jin 10/3: 비수기 17.5만, 7~8월 18.5만
    '4박5일': { def: 260000 }
  },
  KID_DISCOUNT: 20000,
  ONDOL_ROOMS: 90, BED_ROOMS: 6,                       // jin 10/7: 본관동 96실 = 온돌 90 + 침대 6
  BBQ_300G_DISC: 4000,                                 // jin 10/7: 기본은 BBQ 무제한, 300g 원하면 1인 −4천
  PENSION_EXTRA: 150000,
  PEAK_1N: 10000,                                      // 1박2일 7~8월 1인 추가
  TWIN_PER_NIGHT: 10000,                               // 2인1실 1인 1박당 추가 — jin 10/3
  MEAL_DROP: 10000,                                    // 식사 1끼 빼면 1인 −1만, 7~8월 불가 — jin 10/3
  ROOM_EXTRA: 60000,                                   // 객실 1실 추가(1박) — jin 10/3
  MAIN_HALL_UPGRADE: 800000,   // jin 10/7: 작은 단체 대강당 업그레이드 기본 80만(한 번), 성수기는 300만까지 — 사람이 정함
  // 견적서 PDF·사진 내보내기 — jin 10/5: 배율은 나중에 실제 화면 보고 조정
  EXPORT: {
    size: 'A4', portrait: true,
    scale: 4,        // 구글 배율: 1=100%, 2=너비 맞춤, 3=높이 맞춤, 4=한 쪽에 맞춤
    margin: 0.4,     // 여백(인치)
    pngScale: 2      // 사진 해상도: PDF 1pt 당 픽셀 (2 ≈ 144dpi, A4 폭 약 1190px)
  },
  // 강당: 인원 한도, 추가 대관 하루 요금
  HALLS: [
    { name: '1강당', cap: 20, extra: 300000 },
    { name: '2강당', cap: 55, extra: 500000 },   // jin 10/5: 60 → 55 (여유)
    { name: '3강당', cap: 55, extra: 500000 },   // 2강당과 같은 크기라 같이 내림
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
    else if (type === 'company' || type === 'agency' || type === 'adultuniv') { unit = r.twinRoom ? CFG.PRICE['1박2일'].company2 : CFG.PRICE['1박2일'].company3; tpl = 'company'; pkgName = '바베큐 패키지'; }
    else { unit = type === 'church' ? CFG.PRICE['1박2일'].church : CFG.PRICE['1박2일'].group; tpl = '1박2일'; pkgName = '1박 2일 패키지'; }
    if (type !== 'university' && (month === 7 || month === 8)) unit += CFG.PEAK_1N;   // jin 10/3: 1박2일 7~8월 +1만
  } else if (period === '2박3일') {
    if (month === 7 || month === 8) unit = CFG.PRICE['2박3일'].peak;   // jin 10/5: 여름 대학도 일단 15만(여름 2박3일은 대개 교회) — 나중에 다시 정함
    else if (type === 'university') { unit = CFG.PRICE['2박3일'].uni; flags.push('대학 2박3일은 3식 10.8만 — 식사 문구를 총 3식으로 고쳐 주세요'); }
    else unit = hasWeekendNight_(r.checkin, nights) ? CFG.PRICE['2박3일'].offWeekend : CFG.PRICE['2박3일'].offWeekday;
    if (!r.checkin) flags.push('날짜를 몰라 평일 단가 사용');
    tpl = '2박3일'; pkgName = '수련회 패키지';
  } else { unit = (CFG.PRICE[period].peak && (month === 7 || month === 8)) ? CFG.PRICE[period].peak : CFG.PRICE[period].def; tpl = 'long'; pkgName = '수련회 패키지'; }
  if (people >= 250) flags.push('대형 단체 특가(11.5~12만)는 대표 방침상 전화로만 — 견적가 확인');
  if (nights >= 2 && r.twinRoom) unit += CFG.TWIN_PER_NIGHT * nights;   // 2인1실: 1박당 +1만
  if (nights === 1 && r.twinRoom && (type === 'church' || type === 'group')) unit += CFG.TWIN_PER_NIGHT;   // jin 10/5: 교회·일반 1박2일 2인1실도 +1만
  var skip = Number(r.skipMeals) || 0;
  if (skip > 0 && period !== '당일') {
    if (month === 7 || month === 8) flags.push('7~8월은 식사를 뺄 수 없음 — 고객이 ' + skip + '끼 빼 달라고 함');
    else { unit -= CFG.MEAL_DROP * skip; flags.push('식사 ' + skip + '끼 빼고 1인 ' + (CFG.MEAL_DROP * skip).toLocaleString() + '원 깎음 — 식사 문구(총 몇 식)는 직접 고쳐 주세요'); }
  }

  if (Number(r.unitOverride) > 0) {   // jin 10/5: 조정장치 — 사람이 1인 단가를 직접 정함
    flags.push('1인 단가를 직접 ' + Number(r.unitOverride).toLocaleString() + '원으로 정함(자동 계산 ' + unit.toLocaleString() + '원)');
    unit = Number(r.unitOverride);
  }

  var bbq = r.bbq !== false; // 언급 없으면 기본 포함
  var bbq300 = bbq && !!r.bbq300;
  if (bbq300) { unit -= CFG.BBQ_300G_DISC; flags.push('BBQ 300g 요청 — 1인 ' + CFG.BBQ_300G_DISC.toLocaleString() + '원 뺌'); }
  if (period === '1박2일' && type === 'university') bbq = true;

  var days = Math.max(1, nights); // 강당 대관 "하루" = 박 수
  var vat = !!r.vatDoc || type === 'company' || type === 'agency';   // jin 10/7: 대학원·사이버대·야간대(adultuniv)는 회사 단가지만 부가세 없음·기본 계좌

  return {
    org: r.org || '단체명 미정', contact: r.contact || '', phone: r.phone || '',
    adults: adults, kids: kids, people: people, period: period, nights: nights, days: days,
    checkin: r.checkin || null, checkout: r.checkout || null, scheduleText: r.scheduleText || '',
    type: type, unit: unit, tplKey: tpl, pkgName: pkgName, bbq: bbq, bbq300: bbq300, vat: vat,
    twin: !!r.twinRoom, wantsMainHall: !!r.wantsMainHall, wantsPension: !!r.wantsPension, extraHallsWanted: r.extraHalls || [], extraRooms: Number(r.extraRooms) || 0, skipMeals: Number(r.skipMeals) || 0, month: month,
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
    if (busy.halls[name]) q.flags.push('추가 요청한 ' + name + '은(는) 그날 예약 있음');
    if (name === '독립대강당' && q.wantsMainHall) {
      // jin 10/7: 작은 단체가 대강당을 원하면 '업그레이드' 기본 80만(박 수와 무관), 성수기(7~8월)는 300만까지 받음
      // jin 10/7: 7~8월 전체, 1~2월 금·토·일(공휴일 포함)은 150만~300만 — 사람이 정함
      if (isPeak_(q)) q.flags.push('성수기 대강당 업그레이드 — 150만~300만 받는 기간(7~8월, 1~2월 금·토·일·공휴일). 80만으로 적었으니 금액 정해 주세요');
      q.extraHalls.push({ name: '대강당 업그레이드', label: hall + ' → 대강당', day: CFG.MAIN_HALL_UPGRADE, qty: 1, amount: CFG.MAIN_HALL_UPGRADE });
      q.hall = '대강당';   // 강당 줄은 대강당으로 (실제 견적처럼), 업그레이드 비용은 아래 줄
      return;
    }
    q.extraHalls.push({ name: name + ' (추가)', label: '추가 대관 ' + q.days + '일 (하루 ' + h.extra.toLocaleString() + '원)', day: h.extra, qty: q.days, amount: h.extra * q.days });
  });
  if (q.extraRooms && q.nights > 0) {
    var rq = q.extraRooms * q.nights;
    q.extraHalls.push({ name: '객실 추가', label: q.extraRooms + '실 × ' + q.nights + '박 (1실 ' + CFG.ROOM_EXTRA.toLocaleString() + '원)', day: CFG.ROOM_EXTRA, qty: rq, amount: CFG.ROOM_EXTRA * rq });
  }

  // 객실 — jin 10/7: 기본은 3인1실 온돌만. 객실옵션 1(펜션+온돌)·2(온돌만)는 펜션·다인실을 요청했거나,
  // 젊은 층(MT·청년부·대학부·중고등부), 친목 모임(가족·동창·동호회)일 때만.
  q.roomOptions = roomOptions_(q);
  var need = !q.roomOptions ? 0 : q.people < 10 ? 0 : q.people < 40 ? 1 : q.people < 70 ? 2 : 3;   // 실제 견적: 10~39명 1동, 40~69명 2동, 70명~ 3동
  if (q.nights === 0) { q.pensions = []; q.ondol = 0; q.ondolOnly = 0; return; }             // 당일: 숙박 없음
  q.pensionPaid = q.type === 'university' && q.period === '1박2일';      // MT: 펜션은 1동 15만 추가
  var free = ['A', 'B', 'C'].filter(function (d) { return !busy.pensions[d]; });
  if (free.length < need) q.flags.push('펜션 ' + need + '동 필요한데 ' + free.length + '동만 비어 있음');
  q.pensions = free.slice(0, need);
  var inPension = q.pensions.length * 10;
  q.ondol = Math.max(0, Math.ceil((q.people - inPension) / (q.twin ? 2 : 3)));
  q.ondolOnly = Math.ceil(q.people / (q.twin ? 2 : 3));   // 객실옵션 2: 펜션 없이 온돌만으로 전원
  // jin 10/7: 본관동 96실 = 온돌룸 90 + 침대룸 6
  var maxRooms = q.roomOptions ? q.ondol : q.ondolOnly;
  if (maxRooms > CFG.ONDOL_ROOMS) q.flags.push('온돌 ' + maxRooms + '실 필요 — 본관 온돌은 ' + CFG.ONDOL_ROOMS + '실뿐(침대룸 ' + CFG.BED_ROOMS + '실·펜션 포함해 배치 확인)');
}

var YOUNG_RE_ = /청년|대학부|고등부|중고등|중등부|학생부|청소년|\bMT\b|엠티/i;
var SOCIAL_RE_ = /동창|동문|동호회|친목|가족|향우|계모임|친구|산악회|모임/;
function roomOptions_(q) {
  if (q.wantsPension) return true;
  if (q.type === 'university' || q.type === 'group') return true;    // MT, 가족·친구·동창 같은 일반 모임
  var t = (q.org || '') + ' ' + (q.notes || '');
  return YOUNG_RE_.test(t) || SOCIAL_RE_.test(t);
}

// 공휴일 (콜로그 Config.gs HOLIDAYS_ 와 같은 목록, 1~2월 성수기 판단용) — 새 해가 오면 더한다
var HOLIDAYS_ = ['2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', '2027-01-01', '2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09',
  '2028-01-01', '2028-01-26', '2028-01-27', '2028-01-28'];
// jin 10/7: 성수기 = 7~8월 전체 + 1~2월 금·토·일·공휴일 (지금은 대강당 업그레이드 금액 확인에만 씀 — 패키지 단가는 실제 견적도 1~2월 주말 13만)
function isPeak_(q) {
  if (q.month === 7 || q.month === 8) return true;
  if (!(q.month === 1 || q.month === 2) || !q.checkin) return false;
  var d = new Date(q.checkin + 'T00:00:00');
  for (var i = 0; i <= Math.max(0, q.nights); i++) {
    var x = new Date(d.getTime() + i * 86400000), w = x.getDay();
    var s = x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2);
    if ((i < Math.max(1, q.nights) && (w === 5 || w === 6 || w === 0)) || HOLIDAYS_.indexOf(s) >= 0) return true;
  }
  return false;
}

function priceTotals_(q) {
  var base = q.unit * q.people;
  var kidDisc = q.kids ? -CFG.KID_DISCOUNT * q.kids : 0;
  var extraHall = q.extraHalls.reduce(function (s, h) { return s + h.amount; }, 0);
  // MT 펜션(1동 15만)은 실제 견적처럼 총액에 넣는다 (견적서 1~7: 159건 포함, 10건 미포함) — jin 10/7
  var pension = q.pensionPaid && q.pensions ? CFG.PENSION_EXTRA * q.pensions.length : 0;
  var supply = base + kidDisc + extraHall + pension;
  var total = q.vat ? Math.round(supply * 1.1) : supply;
  var deposit = Math.round(total * 0.3 / 100000) * 100000;
  if (q.period === '1박2일' && q.type === 'university') deposit = Math.min(deposit, 300000);
  var balance = total - deposit + CFG.DEPOSIT_CLEAN;
  return { base: base, kidDisc: kidDisc, extraHall: extraHall, supply: supply, tax: total - supply,
    total: total, deposit: deposit, balance: balance, account: q.vat ? CFG.ACC_VAT : CFG.ACC_DEFAULT };
}

function busyFromBookings_(list) {
  var busy = { halls: {}, pensions: {} };
  list.forEach(function (b) {
    CFG.HALLS.forEach(function (h) { if (b.halls.indexOf(h.name) >= 0) busy.halls[h.name] = b.name; });
    ['A', 'B', 'C'].forEach(function (d) { if (new RegExp('(^|[^A-Z])' + d + '($|[^A-Z])').test(b.pensions)) busy.pensions[d] = b.name; });
  });
  return busy;
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

export { isPeak_, roomOptions_, periodName_, periodLabel_, hasWeekendNight_, buildQuote_, smallestHallFor_, hallInfo_, assignRooms_, priceTotals_, busyFromBookings_, scheduleLine_, pensionText_ };
