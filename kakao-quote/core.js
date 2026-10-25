// 어피어 견적 가격 계산 (순수 함수) — 카톡 챗봇 서버(kakao-quote)가 씀.
// 원본: quote/견적자동작성.gs 의 같은 이름 함수들. 가격을 바꾸면 이 파일의 CFG를 고친다.
export const CFG = {
  NOTION_DS: '1cf33639-fc7f-80e9-8abd-000bf8bbb0d0', // DB_인입콜 data source
  NOTION_VERSION: '2025-09-03',
  BRANCH: '어피어',                                    // 예약지점에 이 글자가 들어간 것만
  DEPOSIT_CLEAN: 100000,                               // 청소보증금
  // jin 10/19: 부가세 없는 곳은 아래 계좌 중 하나(한 달마다 바꿀 수 있음, 지침은 jin이 따로 줌).
  // jin 10/20: '일단 카카오 3333-15 기본값으로 진행' → 기본 계좌를 3333-15 로 되돌림
  //   지침을 받기 전까지는 첫 계좌로 적고 '확인할 것'에 계좌 확인을 띄운다
  ACC_DEFAULT: '카카오뱅크 3333-15-5582511 김은하',
  ACC_OTHERS: ['카카오뱅크 3333-15-5582511 김은하', '농협 173801-51-059904 신향수', '카카오뱅크 3333-21-2982355 김은하', '카카오뱅크 3333-12-2247451 김홍철'],
  ACC_VAT: '신한 140-015-577115 (주)어피어플레이스',
  // 1인 단가(부가세 별도)
  PRICE: {
    '당일': { bbq: 40000, korean: 37000, bbqHigh: 47000, koreanHigh: 45000 }, // jin 10/7: 평일 4.3만 → 10/21 카드 '4만', 금·토·일·성수기 4.7만 / 10/20: BBQ 없는 한식 평일 3.7만·주말 4.5만
    '1박2일': { church: 75000, group: 75000, company3: 75000, company2: 85000, mt: 49000 },
    '2박3일': { uni: 130000, offWeekday: 130000, offWeekend: 130000, peak: 150000, company: 130000 },   // company: jin 10/21 Q34 15만 → 같은 날 카드 '모두 13만'(비수기 회사·기관도 13만)
    // jin 10/7·10/20: 비수기 요일 무관 13만(5식 기준), 7~8월 15만
    '3박4일': { def: 190000, peak: 210000 },        // jin 10/20: 비수기 19만(18.5만 아님), 7~8월·1~2월 금토일 21만(Q14·Q48)
    '4박5일': { def: 260000 }                      // jin 10/20 Q15 '가': 4박5일 26만으로 자동 견적
  },
  KID_DISCOUNT: 20000,
  PENSION_CAP: 30,                                     // jin 10/25: 펜션 정원 30명(C동 35명)
  PENSION_CAPS: { A: 30, B: 30, C: 35 },
  MEAL_ADD: 12000,                                     // jin 10/25: 식사 1끼 추가 1인 1.2만(견적서에 따로 한 줄)
  BBQ_NONE_DROP_2N: 10000,                             // jin 10/25: 2박 이상 바베큐 빼면 1인 −1만
  BBQ_EXTRA: 25000,                                    // jin 10/25: 바베큐 한 번 더 1인 +2.5만
  GRILL_SET: 30000,                                    // jin 10/25: 숯·그릴 1세트 대여 3만
  SINGLE_ROOM: 30000,                                  // jin 10/25: 1인 1실 1인 1박 +3만(더 정할 예정)
  PRESCHOOL_DROP_SHORT: 25000,                         // jin 10/25: 2박 미만 미취학 1인 −2.5만
  ONDOL_ROOMS: 90, BED_ROOMS: 6,                       // jin 10/7: 본관동 96실 = 온돌 90 + 침대 6
  PENSION_EXTRA: 150000,
  PENSION_RENT_BASE: 600000, PENSION_RENT_BASE_PEOPLE: 10, PENSION_RENT_PER: 20000, PENSION_RENT_MAX: 1000000,   // jin 10/25: 펜션 통임대 1동 1박 10명 60만, +1명 2만, 최대 100만
  PEAK_1N: 10000,                                      // 1박2일 7~8월 1인 추가
  TWIN_PER_NIGHT: 10000,                               // 2인1실 1인 1박당 추가 — jin 10/3
  MEAL_DROP: 8000,                                     // 식사 1끼 빼면 1인 −8천(모든 일정), 7~8월 불가 — jin 10/3 −1만 → 10/20 Q12 '가' −8천
  BBQ_NONE_DROP_1N: 10000,                             // 1박2일 바베큐 빼면 1인 −1만 — jin 10/20 Q21
  ROOM_EXTRA: 60000,                                   // 객실 1실 추가(1박) — jin 10/3
  MAIN_HALL_UPGRADE_SUMMER: 3000000, // jin 10/7: 7~8월은 300만
  HOLIDAY_EVE_1N: 10000,               // jin 10/21 Q39: 연휴·공휴일 전날 묵는 1박2일 1인 +1만(7~8월처럼)
  PEAK_WEEKDAY_DROP_1N: 5000,          // jin 10/21 Q38: 7~8월 평일 1박2일은 1인 −5천
  MAIN_HALL_UPGRADE_PEAK: 3000000,   // jin 10/21 Q40 '다': 1~2월 금·토·일·공휴일도 300만 (10/7 150~300만, 10/21 '130명+ 100만' 답을 대체)
  MAIN_HALL_FREE_PEOPLE: 200,        // jin 10/21: 성수기 대강당 업그레이드비는 200명 이상 단체 아니면 무조건 부과 — 견적은 사람이 때마다 다르게 할 수 있음
  HALF_DAY_RATE: 0.5,                // jin 10/20: 강당 오전만·오후만은 하루 대관료의 절반(필요하면 사람이 고침)
  EARLY_LATE: 300000,                // jin 10/20: 얼리 체크인·레이트 체크아웃 한 번에 30만
  BBQ_300G_DROP: 4000,               // jin 10/7: BBQ 기본은 무제한, 300g 원하면 1인 −4천원
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
    // jin 10/18: 견적서6 양식 탭이 '★2박 3일' 로 이름이 바뀌고 3박 양식은 없어짐 → 2박3일·3박4일 견적이 전부 '양식 탭을 못 찾음'으로 실패했음(시험 20건 중 2박 4건).
    //   3박4일도 2박 양식을 복사해 씀(식사 문구·박수는 봇이 기간에 맞게 고침). 예전 이름은 다른 시트용으로 뒤에 남김
    '2박3일': ['★2박 3일', '☆여름 2박 3일', '★여름 2박 3일', '★여름 3박 4일'],
    long: ['★여름 3박 4일', '★2박 3일', '☆여름 2박 3일', '★여름 2박 3일'],
    '당일': ['★여름 1박 2일', '기본 양식', '빈 견적서 양식(래인)']   // jin 10/10: 실제 당일 견적처럼 1박 양식을 복사해 한식·객실 줄을 지움 ('당일' 탭 양식은 패키지(1인 단가) 줄이 없어 단가·총액이 비어 뺌)
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

// 금·토·일요일 밤이 끼면 주말 단가(목금토·금토일·일월) — jin 10/25 Q38 '나': 일요일 밤(일~월)도 주말
function hasWeekendNight_(checkin, nights) {
  if (!checkin) return false;
  var d = new Date(checkin + 'T00:00:00');
  for (var i = 0; i < nights; i++) { var w = (d.getDay() + i) % 7; if (w === 5 || w === 6 || w === 0) return true; }
  return false;
}

// jin 10/10: 단체명이 '산악회·가족모임·모임·동창회'처럼 행사 이름뿐이면 'ooo님 산악회'로 (시트 탭·단체명 칸)
var EVENT_ONLY_RE_ = /^(산악회|가족\s*모임|가족\s*여행|모임|친목\s*모임|친목회|동창회|동문회|동호회|향우회|계모임|친구\s*모임|야유회|워크숍|워크샵|MT|엠티)$/i;
function eventOrg_(org, contact) {
  var o = String(org || '').trim();
  if (!o) return contact ? String(contact).trim() + '님 단체' : '단체명 미정';
  if (contact && EVENT_ONLY_RE_.test(o)) return String(contact).trim().replace(/님$/, '') + '님 ' + o;
  return o;
}

function buildQuote_(r) {
  var flags = (r.unsure || []).slice();
  // jin 10/19 카드 '띄우기': 가격표에 없는 특별 요청은 금액에 안 들어가니 사람이 넣게 알린다
  (Array.isArray(r.specials) ? r.specials : []).slice(0, 8).forEach(function (s) {
    s = String(s || '').trim();
    if (s) flags.push('가격표에 없는 요청: ' + s.slice(0, 40) + ' — 금액은 직접 넣어 주세요');
  });
  var nights = r.nights;
  if ((nights === null || nights === undefined) && r.checkin && r.checkout) {
    nights = Math.round((new Date(r.checkout) - new Date(r.checkin)) / 86400000);
  }
  if (nights === null || nights === undefined) { nights = 1; flags.push('박 수를 몰라 1박2일로 가정'); }
  if (nights >= 5) throw new Error(nights + '박' + (nights + 1) + '일 이상은 견적을 자동으로 만들지 않아요(jin 10/7: 사람이 직접 정함, 10/20: 4박5일까지만 자동)');
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
    var high = month === 7 || month === 8 || dw === 5 || dw === 6 || dw === 0 || HOLIDAYS_.indexOf(r.checkin) >= 0;   // jin 10/25 Q47: 공휴일 당일도 주말 단가
    var dp = CFG.PRICE['당일'];
    unit = r.bbq === false ? (high ? dp.koreanHigh : dp.korean) : (high ? dp.bbqHigh : dp.bbq); tpl = (type === 'company' || type === 'agency' || type === 'adultuniv') ? 'company' : 'TEMPLATES.당일';
    pkgName = r.bbq === false ? '당일 패키지' : '바베큐 패키지'; }   // jin 10/10: 실제 당일 견적 135건 — 1박 양식에서 한식·객실 줄을 빼고 씀, 이름은 대개 '바베큐 패키지'
  else if (period === '1박2일') {
    if (type === 'university') { unit = CFG.PRICE['1박2일'].mt; tpl = 'mt'; pkgName = 'MT 패키지'; }
    else if (type === 'company' || type === 'agency' || type === 'adultuniv') { unit = r.twinRoom ? CFG.PRICE['1박2일'].company2 : CFG.PRICE['1박2일'].company3; tpl = 'company'; pkgName = '바베큐 패키지'; }
    else { unit = type === 'church' ? CFG.PRICE['1박2일'].church : CFG.PRICE['1박2일'].group; tpl = '1박2일'; pkgName = '1박 2일 패키지'; }
    var companyType = type === 'company' || type === 'agency' || type === 'adultuniv';
    // jin 10/10: 1~2월 금·토·일 1박2일은 +1만 하지 않음(8.5 말고 7.5) — 1박2일 +1만은 7~8월만
    if (type !== 'university' && !(companyType && r.twinRoom) && (month === 7 || month === 8 || lunarPeak_(r.checkin, nights))) unit += CFG.PEAK_1N;   // jin 10/3: 1박2일 7~8월 +1만 (10/7: 회사 2인1실은 85,000원 그대로)
    if (type !== 'university' && !(companyType && r.twinRoom) && (month === 7 || month === 8) && r.checkin && !hasWeekendNight_(r.checkin, 1)) { unit -= CFG.PEAK_WEEKDAY_DROP_1N; flags.push('7~8월 평일 1박 — 1인 ' + CFG.PEAK_WEEKDAY_DROP_1N.toLocaleString() + '원 깎음(jin 10/21)'); }
    else if (type !== 'university' && !(companyType && r.twinRoom) && !(month === 7 || month === 8) && holidayEve_(r.checkin)) { unit += CFG.HOLIDAY_EVE_1N; flags.push('공휴일 전날 1박 — 1인 ' + CFG.HOLIDAY_EVE_1N.toLocaleString() + '원 더함(jin 10/21)'); }
    if (r.twinRoom && (type === 'church' || type === 'group')) unit = CFG.PRICE['1박2일'].company2;   // jin 10/7: 교회·일반 1박2일 2인1실은 85,000원 고정
  } else if (period === '2박3일') {
    if (month === 7 || month === 8 || lunarPeak_(r.checkin, nights)) unit = CFG.PRICE['2박3일'].peak;   // jin 10/25 Q46: 설·추석 연휴 중간에 묵으면 성수기   // jin 10/5: 여름 대학도 일단 15만(여름 2박3일은 대개 교회) — 나중에 다시 정함
    else if (type === 'company' || type === 'agency' || type === 'adultuniv') unit = CFG.PRICE['2박3일'].company;   // jin 10/21 Q34
    else if (type === 'university') unit = CFG.PRICE['2박3일'].uni;   // jin 10/11 카드: 2박3일 대학(MT 아님) 비수기 13만 (평일·주말 구분 없음)
    else unit = hasWeekendNight_(r.checkin, nights) ? CFG.PRICE['2박3일'].offWeekend : CFG.PRICE['2박3일'].offWeekday;
    if (!r.checkin) flags.push('날짜를 몰라 평일 단가 사용');
    tpl = '2박3일'; pkgName = '수련회 패키지';
  } else {
    // jin 10/20 Q48: 3박4일은 1~2월 금·토·일·공휴일도 7~8월처럼 21만
    var longPeak = month === 7 || month === 8 || lunarPeak_(r.checkin, nights) || (period === '3박4일' && isPeak_({ month: month, checkin: r.checkin, nights: nights }));
    unit = (CFG.PRICE[period].peak && longPeak) ? CFG.PRICE[period].peak : CFG.PRICE[period].def; tpl = 'long'; pkgName = '수련회 패키지';
  }
  if (nights >= 2 && r.twinRoom) unit += CFG.TWIN_PER_NIGHT * nights;   // 2인1실: 1박당 +1만
  if (r.bbq300 && r.bbq !== false && period !== '당일') { unit -= CFG.BBQ_300G_DROP; flags.push('BBQ 300g 요청 — 1인 ' + CFG.BBQ_300G_DROP.toLocaleString() + '원 깎음'); }
  if (r.bbq === false && period === '1박2일' && type !== 'university') { unit -= CFG.BBQ_NONE_DROP_1N; flags.push('바베큐 제외 — 1인 ' + CFG.BBQ_NONE_DROP_1N.toLocaleString() + '원 깎음(jin 10/20)'); }
  else if (r.bbq === false && nights >= 2) { unit -= CFG.BBQ_NONE_DROP_2N; flags.push('바베큐 제외 — 1인 ' + CFG.BBQ_NONE_DROP_2N.toLocaleString() + '원 깎음(jin 10/25)'); }
  // jin 10/21 Q43: 여행사도 같은 단가 — '사람이 확인' 안내 뺌
  // 10/25 모의 견적: 숙박은 하는데 시설 식사를 전혀 안 먹는 경우도 패키지 단가로 나갔음 → 사람이 정하게 띄움
  if (r.noMeals && !r.spaceOnly && period !== '당일') flags.push('시설 식사 없이 숙박만 — 가격은 사람이 정함(지금 단가는 식사 포함 패키지 기준)');
  if (r.spaceOnly) flags.push('숙박·식사 없이 공간만 대관 — 가격은 사람이 정함(jin 10/20, 지금 단가는 패키지 기준)');
  if (kids > 0) flags.push('초등 이하 ' + kids + '명 — 할인 금액은 사람이 정함(참고: 2박 이상 미취학 무료·초등 −2만, 2박 미만 미취학 −2.5만 — jin 10/20·10/25)');
  if (type === 'university' && nights === 2) flags.push('대학 2박3일 단가는 사람이 정함(jin 10/25)');
  if (type === 'university' && nights === 0) flags.push('대학 당일 단가는 사람이 정함(jin 10/25)');
  if (type === 'university' && r.twinRoom) flags.push('대학 MT는 2인1실 불가(jin 10/25) — 고객에게 안내');
  if (r.pets) flags.push('반려동물 동반 불가(jin 10/25) — 고객에게 안내');
  if (r.yearEnd || (r.checkin && /-12-(2[4-9]|3[01])$/.test(r.checkin))) flags.push('연말(성탄·연말연시) 단가는 사람이 정함(jin 10/25)');
  if (r.specialDiet) flags.push('특식 요청(' + r.specialDiet + ') — 금액은 사람이 정함');
  var skip = Number(r.skipMeals) || 0;
  if (skip > 0 && period !== '당일') {
    if (month === 7 || month === 8) flags.push('7~8월은 식사를 뺄 수 없음 — 고객이 ' + skip + '끼 빼 달라고 함');
    else { unit -= CFG.MEAL_DROP * skip; flags.push('식사 ' + skip + '끼 빼고 1인 ' + (CFG.MEAL_DROP * skip).toLocaleString() + '원 깎음 — 식사 문구(총 몇 식)는 직접 고쳐 주세요'); }
  }

  // jin 10/11 카드: 당일·대학 MT 빼고 1인 단가를 가까운 쪽으로 끊음 — 10만원 미만 5천원, 10만원 이상 만원 단위(총액은 끊지 않고 인원×단가)
  if (period !== '당일' && !(period === '1박2일' && type === 'university')) {
    var step = unit >= 100000 ? 10000 : 5000, rounded = Math.round(unit / step) * step;
    if (rounded !== unit) { flags.push('1인 단가 ' + unit.toLocaleString() + '원 → ' + rounded.toLocaleString() + '원(' + (step / 1000) + '천원 단위로 맞춤)'); unit = rounded; }
  }
  if (Number(r.unitOverride) > 0) {   // jin 10/5: 조정장치 — 사람이 1인 단가를 직접 정함
    flags.push('1인 단가를 직접 ' + Number(r.unitOverride).toLocaleString() + '원으로 정함(자동 계산 ' + unit.toLocaleString() + '원)');
    unit = Number(r.unitOverride);
  }

  var bbq = r.bbq !== false; // 언급 없으면 기본 포함
  if (period === '1박2일' && type === 'university') bbq = true;

  var days = Math.max(1, nights); // 강당 대관 "하루" = 박 수
  var vat = !!r.vatDoc || type === 'company' || type === 'agency';   // jin 10/7: 대학원·사이버대·야간대(adultuniv)는 회사 단가지만 부가세 없음·기본 계좌
  if (r.publicOrg) { vat = false; flags.push('공공기관·학교 — 부가세 없음(jin 10/25)'); }
  if (r.bigTruck) flags.push('5톤 등 대형 트럭 주차·반입은 불가 — 고객에게 안내(jin 10/25)');
  // jin 10/25: 펜션동만 통임대(식사 없음)는 1동 1박 10명까지 60만, 1명 더할 때 +2만, 최대 100만
  if (r.wantsPension && r.noMeals && nights > 0) { var pr = Math.min(CFG.PENSION_RENT_MAX, CFG.PENSION_RENT_BASE + Math.max(0, people - CFG.PENSION_RENT_BASE_PEOPLE) * CFG.PENSION_RENT_PER); flags.push('펜션 통임대(식사 없음) — 1동 1박 ' + pr.toLocaleString() + '원 × ' + nights + '박 = ' + (pr * nights).toLocaleString() + '원 기준(jin 10/25), 패키지 단가 대신 이 금액으로 고쳐 주세요'); }
  if (!vat) flags.push('입금 계좌를 ' + CFG.ACC_DEFAULT + '(으)로 적음 — 이번 달 계좌가 다르면 바꿔 주세요(신향수·김은하·김홍철 계좌도 있음)');   // jin 10/19

  return {
    org: eventOrg_(r.org, r.contact), contact: r.contact || '', phone: r.phone || '',
    adults: adults, kids: kids, people: people, period: period, nights: nights, days: days,
    checkin: r.checkin || null, checkout: r.checkout || null, scheduleText: r.scheduleText || '',
    type: type, unit: unit, tplKey: tpl, pkgName: pkgName, bbq: bbq, vat: vat,
    twin: !!r.twinRoom, wantsMainHall: !!r.wantsMainHall, wantsPension: !!r.wantsPension, bbq300: !!r.bbq300, halfDayHall: !!r.halfDayHall, earlyLate: !!r.earlyLate, extraHallsWanted: r.extraHalls || [], extraRooms: Number(r.extraRooms) || 0, skipMeals: Number(r.skipMeals) || 0, month: month,
    spaceOnly: !!r.spaceOnly, twinPart: Number(r.twinPart) || 0, addMeals: Number(r.addMeals) || 0, extraBbq: Number(r.extraBbq) || 0, grillSets: Number(r.grillSets) || 0, singleRooms: Number(r.singleRooms) || 0,
    notes: r.notes || '', flags: flags, lines: [], extras: []
  };
}

function smallestHallFor_(people, wantsMain) {
  if (wantsMain && people > 130) return '독립대강당';
  for (var i = 0; i < CFG.HALLS.length; i++) if (people <= CFG.HALLS[i].cap) return CFG.HALLS[i].name;
  return null;
}
function hallInfo_(name) { for (var i = 0; i < CFG.HALLS.length; i++) if (CFG.HALLS[i].name === name) return CFG.HALLS[i]; return null; }

// jin 10/7: 대강당 업그레이드가 비싼 때 — 7~8월 전체, 1~2월 금·토·일(공휴일은 사람이 확인)
function hallPeak_(q) { return isPeak_(q); }   // jin 10/7: 7~8월 + 1~2월 금토일·공휴일

function assignRooms_(q, busy) {
  // 강당: 인원에 맞는 가장 작은 강당, 차 있으면 다음 크기
  var want = smallestHallFor_(q.people, q.wantsMainHall);
  var order = CFG.HALLS.map(function (h) { return h.name; });
  var hall = null;
  if (!want) { q.flags.push(q.people + '명은 대강당 한도(300명) 초과 — 강당 확인 필요'); want = '독립대강당'; }
  for (var i = order.indexOf(want); i < order.length; i++) {
    if (!busy.halls[order[i]]) { hall = order[i]; break; }
  }
  // jin 10/25: 원하는 강당이 차 있으면 다음 큰 강당으로 — 날짜를 바꿀 수 있는지도 고객에게 물어봄
  if (!hall) { hall = want; q.flags.push(want + ' 이후 큰 강당이 모두 예약돼 있음 — 확인 필요, 날짜 변경 가능한지 물어보기'); }
  else if (hall !== want) q.flags.push(want + '이(가) 예약돼 있어 ' + hall + '(으)로 배정 — 날짜 변경 가능한지도 물어보기');
  q.hall = hall;
  // jin 10/11 카드: 2·3강당은 'OR' 로 적지 않고 비는 쪽 하나로 정해 적음 (이전 10/7 규칙 대체)

  // 추가 강당 (4강당 이하 단체가 대강당 원하면 추가 대관으로)
  q.extraHalls = [];
  var wanted = q.extraHallsWanted.slice();
  if (q.wantsMainHall && hall !== '독립대강당') wanted.push('독립대강당');
  var seen = {};
  wanted.forEach(function (n) {
    var name = String(n).replace(/\s/g, '').replace(/^대강당$/, '독립대강당');
    var h = hallInfo_(name);
    // jin 10/25 Q25: 소회의실·분임토의실·소연습실 추가는 1강당 값으로(방 수 × 일 수)
    if (!h && /회의실|토의실|연습실|세미나실|소강당/.test(name)) {
      var small = hallInfo_('1강당'), cnt = Number((name.match(/(\d+)\s*(실|개)/) || [])[1]) || 1;
      q.extraHalls.push({ name: String(n).replace(/\s*\d+\s*(실|개)\s*$/, '') + ' (추가)', label: cnt + '실 × ' + q.days + '일 (1실 하루 ' + small.extra.toLocaleString() + '원, 1강당 값)', day: small.extra, qty: cnt * q.days, amount: small.extra * cnt * q.days });
      return;
    }
    if (!h) { q.flags.push('추가 강당 "' + n + '"을(를) 못 알아봄'); return; }
    if (name === hall || seen[name]) return; seen[name] = 1;
    if (busy.halls[name]) q.flags.push('추가 요청한 ' + name + '은(는) 그날 예약 있음');
    if (name === '독립대강당' && q.wantsMainHall) {
      // jin 10/7: 작은 단체가 대강당을 원하면 '업그레이드' 기본 80만(박 수와 무관), 성수기(7~8월)는 300만까지 받음
      var up = CFG.MAIN_HALL_UPGRADE;
      if (hallPeak_(q)) {
        if (q.month === 7 || q.month === 8) up = CFG.MAIN_HALL_UPGRADE_SUMMER;
        else up = CFG.MAIN_HALL_UPGRADE_PEAK;
        q.flags.push('성수기 대강당 업그레이드 — ' + (up / 10000) + '만으로 적음(사람이 때마다 정할 수 있음)');
      }
      q.extraHalls.push({ name: '대강당 업그레이드', label: hall.replace(' OR 3강당', '') + ' → 대강당', day: up, qty: 1, amount: up });
      q.hall = '대강당';   // 강당 줄은 대강당으로 (실제 견적처럼), 업그레이드 비용은 아래 줄
      return;
    }
    if (q.halfDayHall) {   // jin 10/20: 오전만·오후만이면 하루 값의 절반
      var half = Math.round(h.extra * CFG.HALF_DAY_RATE);
      q.flags.push(name + ' 반나절 대관 — 하루 값의 절반으로 적음, 필요하면 고쳐 주세요');
      q.extraHalls.push({ name: name + ' (추가)', label: '반나절 대관 ' + q.days + '회 (하루 ' + h.extra.toLocaleString() + '원의 절반)', day: half, qty: q.days, amount: half * q.days });
      return;
    }
    q.extraHalls.push({ name: name + ' (추가)', label: '추가 대관 ' + q.days + '일 (하루 ' + h.extra.toLocaleString() + '원)', day: h.extra, qty: q.days, amount: h.extra * q.days });
  });
  // jin 10/21: 성수기(7~8월, 1~2월 금토일·공휴일)엔 200명 미만이 대강당을 쓰면 요청이 없어도 업그레이드비 부과 (131~199명은 인원 때문에 대강당 배정)
  if (q.hall === '독립대강당' && !q.extraHalls.some(function (h) { return h.name === '대강당 업그레이드'; }) && hallPeak_(q) && q.people < CFG.MAIN_HALL_FREE_PEOPLE) {
    var up2 = (q.month === 7 || q.month === 8) ? CFG.MAIN_HALL_UPGRADE_SUMMER : CFG.MAIN_HALL_UPGRADE_PEAK;
    q.extraHalls.push({ name: '대강당 업그레이드', label: '성수기 대강당 사용(' + CFG.MAIN_HALL_FREE_PEOPLE + '명 미만)', day: up2, qty: 1, amount: up2 });
    q.flags.push('성수기 대강당 업그레이드 — ' + (up2 / 10000) + '만으로 적음(' + CFG.MAIN_HALL_FREE_PEOPLE + '명 미만, 사람이 때마다 정할 수 있음)');
  }
  if (q.earlyLate) {   // jin 10/20: 얼리 체크인·레이트 체크아웃은 한 번에 30만
    q.extraHalls.push({ name: '얼리·레이트 체크인', label: '얼리 체크인·레이트 체크아웃', day: CFG.EARLY_LATE, qty: 1, amount: CFG.EARLY_LATE });
  }
  // jin 10/25 Q12: 당일에 숙박·식사 없이 공간만 쓰면 강당 하루 대관료만
  if (q.spaceOnly && q.nights === 0) { var hi = hallInfo_(q.hall === '대강당' ? '독립대강당' : q.hall); if (hi) q.flags.push('공간만 대관(당일) — 1인 단가 대신 ' + q.hall + ' 하루 대관료 ' + hi.extra.toLocaleString() + '원으로 고쳐 주세요(jin 10/25)'); }
  // jin 10/25 Q17: 일부만 2인1실이면 기본 단가 + 그 방 인원만 1인 1박 +1만
  if (q.twinPart > 0 && !q.twin && q.nights > 0) { var tq = q.twinPart * 2 * q.nights; q.extraHalls.push({ name: '2인1실 추가', label: q.twinPart + '실(' + (q.twinPart * 2) + '명) × ' + q.nights + '박 (1인 1박 ' + CFG.TWIN_PER_NIGHT.toLocaleString() + '원)', day: CFG.TWIN_PER_NIGHT, qty: tq, amount: CFG.TWIN_PER_NIGHT * tq }); }
  // jin 10/25: 식사 추가·바베큐 한 번 더·그릴 대여·1인 1실은 단가에 섞지 않고 따로 한 줄(단가 끊기에 묻히지 않게)
  if (q.addMeals > 0) q.extraHalls.push({ name: '식사 추가', label: q.addMeals + '끼 × ' + q.people + '명 (1인 1끼 ' + CFG.MEAL_ADD.toLocaleString() + '원)', day: CFG.MEAL_ADD, qty: q.addMeals * q.people, amount: CFG.MEAL_ADD * q.addMeals * q.people });
  if (q.extraBbq > 0) q.extraHalls.push({ name: '바베큐 추가', label: q.extraBbq + '회 × ' + q.people + '명 (1인 ' + CFG.BBQ_EXTRA.toLocaleString() + '원)', day: CFG.BBQ_EXTRA, qty: q.extraBbq * q.people, amount: CFG.BBQ_EXTRA * q.extraBbq * q.people });
  if (q.grillSets > 0) q.extraHalls.push({ name: '숯·그릴 대여', label: q.grillSets + '세트 (1세트 ' + CFG.GRILL_SET.toLocaleString() + '원)', day: CFG.GRILL_SET, qty: q.grillSets, amount: CFG.GRILL_SET * q.grillSets });
  if (q.singleRooms > 0 && q.nights > 0) { var sq = q.singleRooms * q.nights; q.extraHalls.push({ name: '1인 1실 추가', label: q.singleRooms + '명 × ' + q.nights + '박 (1인 1박 ' + CFG.SINGLE_ROOM.toLocaleString() + '원)', day: CFG.SINGLE_ROOM, qty: sq, amount: CFG.SINGLE_ROOM * sq }); q.flags.push('1인 1실 추가금 1박 3만은 임시(jin 10/25 더 정할 예정)'); }
  if (q.extraRooms && q.nights > 0) {
    var rq = q.extraRooms * q.nights;
    q.extraHalls.push({ name: '객실 추가', label: q.extraRooms + '실 × ' + q.nights + '박 (1실 ' + CFG.ROOM_EXTRA.toLocaleString() + '원)', day: CFG.ROOM_EXTRA, qty: rq, amount: CFG.ROOM_EXTRA * rq });
  }

  // 객실 — jin 10/7: 기본은 3인1실 온돌만. 객실옵션 1(펜션+온돌)·2(온돌만)는 펜션·다인실을 요청했거나,
  // 젊은 층(MT·청년부·대학부·중고등부), 친목 모임(가족·동창·동호회)일 때만.
  q.roomOptions = q.nights > 0 && roomOptions_(q);   // 당일은 객실 없음 — 옵션·온돌 줄 확인 표시도 안 띄움 (10/10)
  var need = !q.roomOptions ? 0 : q.people < 10 ? 0 : 1;   // jin 10/7 Q17·18: 펜션은 1동만(더 필요하면 사람이 정함)
  if (q.nights === 0) { q.pensions = []; q.ondol = 0; q.ondolOnly = 0; return; }             // 당일: 숙박 없음
  q.pensionPaid = q.type === 'university' && q.period === '1박2일';      // MT: 펜션은 1동 15만 추가
  var free = ['A', 'B', 'C'].filter(function (d) { return !busy.pensions[d]; });
  if (free.length < need) q.flags.push('펜션 ' + need + '동 필요한데 ' + free.length + '동만 비어 있음');
  q.pensions = free.slice(0, need);
  var inPension = q.pensions.reduce(function (n, d) { return n + (CFG.PENSION_CAPS[d] || CFG.PENSION_CAP); }, 0);   // jin 10/25: A·B 30명, C 35명
  q.ondol = Math.max(0, Math.ceil((q.people - inPension) / (q.twin ? 2 : 3)));
  q.ondolOnly = Math.ceil(q.people / (q.twin ? 2 : 3));   // 객실옵션 2: 펜션 없이 온돌만으로 전원
  // jin 10/7: 본관동 96실 = 온돌룸 90 + 침대룸 6
  var maxRooms = q.roomOptions ? q.ondol : q.ondolOnly;
  if (maxRooms > CFG.ONDOL_ROOMS) q.flags.push('온돌 ' + maxRooms + '실 필요 — 본관 온돌은 ' + CFG.ONDOL_ROOMS + '실뿐(침대룸 ' + CFG.BED_ROOMS + '실·펜션 포함해 배치 확인)');
}

var YOUNG_RE_ = /청년|대학부|고등부|중고등|중등부|학생부|청소년|\bMT\b|엠티/i;
// jin 10/20: 펜션동(객실옵션 1·2)은 야유회 성격·대학생·청년부·MT·가족모임 같은 곳, 그리고 요청에 단체실·펜션동을 쓴다고 한 곳만.
// 동호회·클럽·선수단·협회처럼 성격만 '모임'인 곳은 기본 3인1실 온돌.
var SOCIAL_RE_ = /동창|동문|가족|친구|야유회/;
var ASK_PENSION_RE_ = /펜션|단체\s*실|단체\s*룸/;
// 10/25 모의 견적: '펜션동 미사용'처럼 안 쓴다는 말까지 펜션 요청으로 잡아 옵션이 나갔음 → 부정 표현은 지우고 본다
export function asksPension_(t) {
  t = String(t || '').replace(/(펜션\s*동?|단체\s*실|단체\s*룸)\s*(은|는|도)?\s*(미사용|사용\s*안|사용하지\s*않|안\s*씀|불필요|필요\s*없|제외|빼)/g, '');
  return ASK_PENSION_RE_.test(t);
}
function roomOptions_(q) {
  if (q.wantsPension) return true;
  if (q.type === 'university') return true;    // 대학생·MT
  var t = (q.org || '') + ' ' + (q.notes || '');
  return YOUNG_RE_.test(t) || SOCIAL_RE_.test(t) || asksPension_(q.notes || '');
}

// 공휴일 (콜로그 Config.gs HOLIDAYS_ 와 같은 목록, 1~2월 성수기 판단용) — 새 해가 오면 더한다
var HOLIDAYS_ = ['2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', '2026-10-05', '2026-10-09', '2026-12-25',
  '2027-01-01', '2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09', '2027-03-01', '2027-05-05', '2027-05-13', '2027-08-16',
  '2027-09-14', '2027-09-15', '2027-09-16', '2027-10-04', '2027-10-11', '2027-12-27',
  '2028-01-01', '2028-01-26', '2028-01-27', '2028-01-28'];
// jin 10/25 Q46: 설·추석 연휴 날에 묵으면(그 밤 날짜가 연휴) 7~8월처럼 성수기 단가
var LUNAR_HOL_ = ['2027-02-06', '2027-02-07', '2027-02-08', '2027-09-14', '2027-09-15', '2027-09-16', '2028-01-26', '2028-01-27', '2028-01-28'];
function lunarPeak_(checkin, nights) {
  if (!checkin || !nights) return false;
  var d = new Date(checkin + 'T00:00:00');
  for (var i = 0; i < nights; i++) {
    var x = new Date(d.getTime() + i * 86400000);
    var s = x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2);
    if (LUNAR_HOL_.indexOf(s) >= 0) return true;
  }
  return false;
}
// 묵는 다음 날이 공휴일인 1박(금·토 밤은 원래 주말이라 뺌) — jin 10/21 Q39
function holidayEve_(checkin) {
  if (!checkin) return false;
  var d = new Date(checkin + 'T00:00:00'), w = d.getDay();
  if (w === 5 || w === 6) return false;
  var n = new Date(d.getTime() + 86400000);
  var s = n.getFullYear() + '-' + ('0' + (n.getMonth() + 1)).slice(-2) + '-' + ('0' + n.getDate()).slice(-2);
  return HOLIDAYS_.indexOf(s) >= 0;
}
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
  var kidDisc = 0;   // jin 10/7: 초등 이하 할인은 사람이 정함(자동 할인 없음)
  var extraHall = q.extraHalls.reduce(function (s, h) { return s + h.amount; }, 0);
  // MT 펜션(1동 15만)은 실제 견적처럼 총액에 넣는다 (견적서 1~7: 159건 포함, 10건 미포함) — jin 10/7
  var pension = 0;   // jin 10/7: 펜션 추가금은 사람이 정함(총액에 안 넣음)
  var supply = base + kidDisc + extraHall + pension;
  var total = q.vat ? Math.round(supply * 1.1) : supply;
  var deposit = Math.round(total * 0.3 / 100000) * 100000;
  // jin 10/21 Q37: MT도 일단 총액 30%(예전 MT 상한 30만 없앰) — 나중에 필요하면 조정
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

export { eventOrg_, isPeak_, roomOptions_, periodName_, periodLabel_, hasWeekendNight_, buildQuote_, smallestHallFor_, hallInfo_, assignRooms_, priceTotals_, busyFromBookings_, scheduleLine_, pensionText_ };
