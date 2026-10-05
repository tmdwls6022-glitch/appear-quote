"""카톡 견적방 내보내기(CSV) → quote_test_cases 넣을 SQL.

jin 10/5: 견적방(2026-09-03 ~ 10-05) 요청글로 모의 견적 정답표를 만듦.
  QUOTE_USER_KEY=<승인된 직원 user_key> python3 tests/load_cases.py <카톡.csv>   → kakao-quote 로 올림(같은 id 는 덮어씀)
  (키 없이 돌리면 JSON 만 출력). CSV 는 고객 글이 들어 있으니 커밋하지 않는다. 이 파일엔 정답(날짜·인원·종류)만 있다.

정답 키 (kakao-quote/eval.js 와 같음)
  ci/co 체크인·체크아웃, n 박수, p 전체 인원(성인+아동, [최소,최대] 가능), k 초등 이하,
  t 단체종류(None 이면 채점 안 함), bbq/mh/twin/vat, unsure(날짜 후보 여럿 등)
인원 규칙: 중고등·청소년은 성인 값(p 에만), 미취학·초등만 k.
"""
import csv
import re
import sys

C, CO, U, G, A = "church", "company", "university", "group", "agency"

# 카톡 CSV 행 번호 → 정답. 날짜 후보가 여럿이면 첫 후보 + unsure.
L = {
    1:   dict(ci="2026-12-19", co="2026-12-20", n=1, p=150, k=0, t=None, note="대학 임원 송년회 — MT 단가가 맞는지 애매"),
    2:   dict(ci="2026-09-12", co="2026-09-13", n=1, p=25, k=0, t=G, unsure=True),
    3:   dict(ci="2026-10-10", p=14, k=0, t=C, bbq=True, note="일정 '10.10/10.10-' 박수 애매"),
    4:   dict(n=1, p=[50, 60], k=0, t=G, unsure=True, note="10.06~10.10 사이 1박"),
    5:   dict(ci="2027-08-13", co="2027-08-15", n=2, p=[230, 250], k=0, t=C),
    6:   dict(ci="2027-07-22", co="2027-07-24", n=2, p=80, k=0, t=C),
    8:   dict(ci="2026-10-30", co="2026-10-31", n=1, p=60, k=0, t=U),
    9:   dict(ci="2027-02-18", co="2027-02-20", n=2, p=50, k=0, t=C),
    10:  dict(ci="2026-10-23", co="2026-10-24", n=1, p=25, k=0, t=C),
    14:  dict(ci="2026-10-23", co="2026-10-24", n=1, p=60, k=0, t=None),
    15:  dict(ci="2027-01-18", co="2027-01-21", n=3, p=[40, 60], k=0, t=C),
    16:  dict(ci=None, n=1, p=40, k=0, t=C, note="1-2월 중 금-토 혹은 일-월"),
    17:  dict(ci="2026-10-04", co="2026-10-05", n=1, p=[30, 35], k=0, t=C, unsure=True),
    18:  dict(ci="2026-11-06", co="2026-11-08", n=2, p=50, k=14, t=C),
    19:  dict(ci="2026-09-24", co="2026-09-25", n=1, p=13, k=0, t=G, bbq=True),
    20:  dict(ci="2026-11-11", co="2026-11-13", n=2, p=44, k=0, t=CO, note="국방부 — 1인실·2인실 요청"),
    22:  dict(ci="2026-09-18", co="2026-09-19", n=1, p=[30, 40], k=0, t=U),
    23:  dict(ci="2027-08-14", co="2027-08-16", n=2, p=60, k=0, t=C),
    24:  dict(ci=None, n=2, p=[65, 70], k=0, t=C, note="27년 1월 중순~후반 금토일"),
    26:  dict(ci=None, n=1, p=31, k=0, t=CO),
    27:  dict(ci="2026-11-10", n=0, p=[380, 400], k=0, t=A, note="여행사(센타투어) 통한 구청 행사, 300명 넘음"),
    28:  dict(ci="2026-10-05", co="2026-10-06", n=1, p=60, k=0, t=None, bbq=True),
    29:  dict(ci=None, n=1, p=[100, 120], k=0, t=U),
    32:  dict(ci="2026-10-18", n=0, p=60, k=30, t=None, unsure=True, note="당일 후보 4개, 외부 고기 반입"),
    36:  dict(ci="2027-01-15", co="2027-01-17", n=2, p=70, k=0, t=C, mh=True),
    42:  dict(ci="2026-10-02", co="2026-10-03", n=1, p=20, k=0, t=None),
    43:  dict(ci="2027-01-21", co="2027-01-23", n=2, p=[270, 300], k=0, t=C, unsure=True),
    44:  dict(ci="2026-11-13", co="2026-11-14", n=1, p=30, k=0, t=CO, bbq=True),
    45:  dict(ci="2026-11-14", co="2026-11-15", n=1, p=30, k=0, t=G, bbq=True),
    46:  dict(ci="2027-08-05", co="2027-08-07", n=2, p=[50, 60], k=0, t=C),
    47:  dict(ci="2026-10-19", co="2026-10-20", n=1, p=30, k=0, t=CO, bbq=True),
    51:  dict(ci="2026-10-16", co="2026-10-17", n=1, p=70, k=0, t=CO, bbq=True),
    52:  dict(ci="2026-10-24", co="2026-10-25", n=1, p=60, k=0, t=C),
    54:  dict(ci="2026-10-09", co="2026-10-10", n=1, p=24, k=0, t=U),
    55:  dict(ci="2026-10-30", co="2026-10-31", n=1, p=30, k=0, t=CO, bbq=True),
    56:  dict(ci=None, n=2, p=130, k=0, t=C, note="27년 7월 중순 목금토"),
    57:  dict(ci="2026-10-16", co="2026-10-17", n=1, p=57, k=0, t=CO, bbq=True),
    58:  dict(ci="2026-10-09", co="2026-10-10", n=1, p=100, k=0, t=U),
    69:  dict(ci="2027-02-12", co="2027-02-14", n=2, p=45, k=0, t=C),
    70:  dict(ci="2027-07-22", co="2027-07-24", n=2, p=100, k=0, t=C),
    71:  dict(ci="2027-01-21", co="2027-01-23", n=2, p=[50, 55], k=0, t=C),
    73:  dict(ci="2026-09-27", n=0, p=15, k=0, t=C, bbq=True),
    74:  dict(ci="2026-11-13", co="2026-11-14", n=1, p=100, k=0, t=CO),
    75:  dict(ci="2027-07-29", co="2027-07-31", n=2, p=130, k=0, t=C),
    77:  dict(ci="2026-10-23", co="2026-10-24", n=1, p=[22, 23], k=0, t=CO),
    78:  dict(ci="2026-10-29", co="2026-10-30", n=1, p=100, k=0, t=CO),
    80:  dict(ci="2026-11-13", co="2026-11-14", n=1, p=100, k=0, t=C, bbq=True, mh=True),
    82:  dict(ci="2026-11-13", co="2026-11-14", n=1, p=60, k=0, t=CO, mh=True, note="4강당·대강당 둘 다 견적"),
    83:  dict(ci="2027-08-15", co="2027-08-17", n=2, p=40, k=0, t=C, bbq=True, unsure=True),
    86:  dict(ci="2027-01-21", co="2027-01-23", n=2, p=45, k=0, t=C),
    87:  dict(ci=None, n=0, p=60, k=0, t=CO, note="11월 초 평일 당일"),
    91:  dict(ci=None, n=2, p=40, k=0, t=C, note="내년 1월 중, 4끼"),
    92:  dict(ci="2026-11-28", co="2026-11-29", n=1, p=[42, 52], k=2, t=G, bbq=True),
    94:  dict(ci="2027-08-13", co="2027-08-16", n=3, p=250, k=0, t=C),
    95:  dict(ci="2026-10-31", co="2026-11-01", n=1, p=100, k=0, t=U, bbq=True),
    96:  dict(ci="2027-01-15", co="2027-01-17", n=2, p=28, k=0, t=C),
    97:  dict(ci="2026-10-31", co="2026-11-01", n=1, p=50, k=0, t=C, unsure=True),
    98:  dict(ci="2027-07-23", co="2027-07-25", n=2, p=80, k=50, t=C),
    103: dict(ci="2027-01-28", co="2027-01-30", n=2, p=120, k=0, t=C),
    104: dict(ci="2026-10-10", n=0, p=200, k=0, t=None, note="단체: 종로구(관공서?)"),
    105: dict(ci="2027-01-09", co="2027-01-10", n=1, p=[70, 80], k=10, t=C),
    107: dict(ci="2026-10-24", co="2026-10-25", n=1, p=13, k=0, t=G, bbq=True),
    108: dict(ci="2026-11-06", n=0, p=23, k=0, t=CO),
    109: dict(ci="2026-10-02", p=15, k=0, t=None, unsure=True, note="1안 당일 / 2안 1박"),
    110: dict(ci="2026-10-16", co="2026-10-17", n=1, p=30, k=0, t=CO, bbq=True),
    111: dict(ci="2027-07-29", co="2027-07-31", n=2, p=70, k=0, t=C),
    112: dict(ci="2026-10-31", co="2026-11-01", n=1, p=45, k=0, t=None),
    114: dict(ci="2026-11-06", p=50, k=0, t=CO, unsure=True, note="당일·1박 둘 다, 날짜 2개"),
    115: dict(ci="2026-10-16", co="2026-10-17", n=1, p=[20, 25], k=0, t=CO),
    116: dict(ci="2026-10-24", co="2026-10-25", n=1, p=30, k=0, t=None, note="MBA 과정"),
    117: dict(ci="2026-10-30", co="2026-10-31", n=1, p=55, k=0, t=CO),
    118: dict(ci="2027-01-08", co="2027-01-09", n=1, p=[25, 30], k=0, t=C),
    119: dict(ci="2026-10-23", co="2026-10-24", n=1, p=30, k=0, t=CO),
    120: dict(ci="2027-01-28", co="2027-01-30", n=2, p=130, k=0, t=C),
    121: dict(ci="2027-01-29", co="2027-01-31", n=2, p=[340, 350], k=0, t=C, unsure=True),
    122: dict(ci="2026-10-16", co="2026-10-17", n=1, p=16, k=0, t=CO),
    123: dict(ci="2026-12-11", co="2026-12-12", n=1, p=22, k=0, t=CO),
    124: dict(ci="2027-01-29", co="2027-01-31", n=2, p=60, k=0, t=C, unsure=True),
    125: dict(ci="2027-01-21", co="2027-01-23", n=2, p=[20, 26], k=4, t=C, unsure=True),
    126: dict(ci="2026-10-01", n=0, p=[20, 30], k=0, t=CO),
    127: dict(ci="2026-10-16", n=0, p=200, k=0, t=CO),
    134: dict(ci="2026-10-15", co="2026-10-16", n=1, p=57, k=0, t=CO, bbq=True),
    135: dict(ci="2026-11-13", co="2026-11-14", n=1, p=150, k=0, t=CO),
    136: dict(ci="2027-07-29", co="2027-07-31", n=2, p=100, k=0, t=C, unsure=True),
    137: dict(ci="2026-10-18", n=0, p=100, k=10, t=C),
    138: dict(ci="2027-07-30", co="2027-08-01", n=2, p=70, k=0, t=C, unsure=True),
    139: dict(ci="2027-01-15", co="2027-01-17", n=2, p=52, k=10, t=C),
    140: dict(ci="2027-02-18", co="2027-02-20", n=2, p=190, k=0, t=C),
    141: dict(ci="2026-10-31", co="2026-11-01", n=1, p=24, k=0, t=G),
    142: dict(ci="2026-11-16", co="2026-11-17", n=1, p=[150, 200], k=0, t=CO),
    143: dict(ci="2026-11-07", co="2026-11-08", n=1, p=45, k=0, t=None, bbq=True),
    145: dict(ci="2026-10-27", co="2026-10-28", n=1, p=28, k=0, t=CO, bbq=True, vat=True, unsure=True),
    147: dict(ci="2027-01-21", co="2027-01-23", n=2, p=200, k=0, t=C, unsure=True),
    148: dict(ci="2026-10-24", co="2026-10-25", n=1, p=14, k=0, t=G, bbq=True),
    149: dict(ci="2026-12-04", co="2026-12-05", n=1, p=60, k=0, t=U, bbq=True),
    150: dict(ci="2027-08-14", p=[350, 400], k=0, t=C, unsure=True),
    151: dict(ci="2027-08-02", co="2027-08-04", n=2, p=250, k=0, t=None, note="캠프 업체"),
    152: dict(ci="2026-10-04", co="2026-10-05", n=1, p=30, k=0, t=C),
    153: dict(ci="2026-11-20", n=0, p=200, k=0, t=CO),
    154: dict(ci="2027-01-28", co="2027-01-30", n=2, p=[20, 30], k=0, t=C),
    155: dict(ci=None, n=2, p=60, k=0, t=C, note="1월말·2월 둘째주 금토일"),
    156: dict(ci="2026-10-29", co="2026-10-30", n=1, p=72, k=0, t=CO, bbq=True),
    162: dict(ci="2027-08-12", co="2027-08-14", n=2, p=90, k=0, t=C),
    163: dict(ci="2026-10-18", n=0, p=90, k=0, t=G),
    164: dict(ci="2026-10-08", co="2026-10-09", n=1, p=40, k=0, t=C),
    165: dict(ci="2026-10-02", co="2026-10-03", n=1, p=40, k=0, t=U),
    166: dict(ci="2026-11-20", co="2026-11-21", n=1, p=140, k=0, t=None),
    167: dict(ci="2026-10-09", co="2026-10-10", n=1, p=[70, 80], k=0, t=C),
    168: dict(ci="2027-07-29", co="2027-07-31", n=2, p=65, k=40, t=C),
    170: dict(ci="2026-11-13", co="2026-11-14", n=1, p=[35, 40], k=0, t=C),
    171: dict(ci="2026-10-16", n=0, p=[25, 30], k=0, t=CO),
    172: dict(ci="2027-01-03", co="2027-01-05", n=2, p=200, k=0, t=C, unsure=True),
    174: dict(ci="2027-01-28", co="2027-01-30", n=2, p=130, k=0, t=C, mh=True),
    175: dict(ci="2026-10-16", co="2026-10-17", n=1, p=[30, 35], k=0, t=CO, bbq=True),
    176: dict(ci="2027-08-14", co="2027-08-16", n=2, p=[160, 200], k=0, t=C),
    177: dict(ci="2027-02-25", co="2027-02-27", n=2, p=25, k=0, t=C),
    181: dict(ci="2026-11-06", co="2026-11-07", n=1, p=50, k=0, t=None),
    182: dict(ci="2027-07-23", co="2027-07-24", n=1, p=96, k=70, t=C),
    184: dict(ci="2026-11-07", co="2026-11-08", n=1, p=[25, 30], k=0, t=G, bbq=True),
    186: dict(ci="2027-07-23", co="2027-07-25", n=2, p=100, k=0, t=C, mh=True),
    187: dict(ci="2027-01-29", co="2027-02-01", n=3, p=50, k=0, t=U, note="바베큐 말고 다른 식사 가능한지 물음"),
    188: dict(ci="2027-08-05", co="2027-08-07", n=2, p=400, t=C, note="아이 수 확인중"),
    189: dict(ci="2027-07-22", co="2027-07-24", n=2, p=70, k=0, t=C),
    190: dict(ci="2026-10-05", co="2026-10-06", n=1, p=19, k=0, t=None, note="예산 40만원대"),
    191: dict(ci=None, n=3, p=75, t=None, note="초1~고2 섞임, 27년 2월 평일"),
    195: dict(ci="2027-08-04", co="2027-08-07", n=3, p=100, k=0, t=C),
    197: dict(ci="2026-12-25", co="2026-12-27", n=2, p=70, k=0, t=C),
    198: dict(ci="2026-10-31", n=0, p=[100, 120], k=20, t=C),
    199: dict(ci="2026-10-29", co="2026-10-30", n=1, p=13, k=0, t=CO),
    200: dict(ci="2026-10-24", co="2026-10-25", n=1, p=30, k=0, t=G),
    201: dict(ci="2026-11-27", co="2026-11-28", n=1, p=38, k=0, t=CO, bbq=True),
    202: dict(ci="2027-02-18", co="2027-02-20", n=2, p=75, k=0, t=C),
    203: dict(ci=None, n=1, p=60, k=0, t=U, note="3월 중순-말 평일"),
    204: dict(ci="2026-11-11", co="2026-11-12", n=1, p=90, k=0, t=CO, bbq=True),
    205: dict(ci="2027-07-16", p=85, k=5, t=C, unsure=True, note="7월 16~18일인데 1박 2일이라고 씀"),
    206: dict(ci="2027-07-26", co="2027-07-30", n=4, p=320, k=20, t=None, mh=True),
    207: dict(ci="2027-07-29", co="2027-07-31", n=2, p=100, k=0, t=C, unsure=True),
    208: dict(ci="2027-07-29", co="2027-07-31", n=2, p=100, k=0, t=C, unsure=True),
    209: dict(ci="2026-11-28", co="2026-11-29", n=1, p=[34, 40], k=0, t=A),
    210: dict(ci="2026-11-07", co="2026-11-08", n=1, p=25, k=0, t=G),
    212: dict(ci="2027-02-22", co="2027-02-24", n=2, p=200, k=0, t=U),
    213: dict(ci="2026-10-23", co="2026-10-24", n=1, p=[50, 60], k=0, t=C),
    214: dict(ci="2026-10-28", n=0, p=30, k=0, t=CO, bbq=True),
    215: dict(ci="2026-10-18", co="2026-10-19", n=1, p=85, k=0, t=CO, bbq=True),
    216: dict(ci=None, n=1, p=15, k=0, t=CO, bbq=True, note="날짜 없음, '1박 1일'"),
    221: dict(ci="2027-08-20", co="2027-08-22", n=2, p=50, k=9, t=C),
    222: dict(ci="2027-03-27", co="2027-03-28", n=1, p=[27, 35], k=[2, 5], t=G),
    223: dict(ci="2027-08-13", co="2027-08-15", n=2, p=300, k=70, t=C, unsure=True),
    224: dict(ci="2026-11-05", co="2026-11-06", n=1, p=56, k=0, t=CO, bbq=True),
    225: dict(ci=None, n=2, p=[30, 35], k=0, t=C),
    226: dict(ci="2027-07-29", co="2027-07-31", n=2, p=[50, 60], k=0, t=C, mh=True),
    227: dict(ci="2026-10-26", n=0, p=30, k=0, t=CO),
    228: dict(ci="2027-07-29", co="2027-07-31", n=2, p=70, k=0, t=C),
    229: dict(ci="2026-12-19", co="2026-12-20", n=1, p=[15, 20], k=0, t=G, bbq=True),
    230: dict(ci="2027-08-14", co="2027-08-16", n=2, p=70, k=0, t=C),
    231: dict(ci="2026-10-31", co="2026-11-01", n=1, p=14, k=0, t=G),
    232: dict(ci="2026-11-28", co="2026-11-29", n=1, p=[80, 100], k=0, t=CO),
    233: dict(ci="2026-12-18", n=0, p=[100, 120], k=0, t=None, unsure=True),
    234: dict(ci="2027-02-28", co="2027-03-01", n=1, p=[250, 300], k=100, t=C),
    235: dict(ci="2026-12-12", co="2026-12-13", n=1, p=[40, 100], k=0, t=U),
    236: dict(ci="2026-11-14", co="2026-11-15", n=1, p=80, k=0, t=CO, unsure=True),
    237: dict(ci="2026-10-23", co="2026-10-24", n=1, p=36, k=0, t=CO, bbq=True),
    238: dict(ci="2026-11-05", co="2026-11-06", n=1, p=[70, 80], k=0, t=U, bbq=True),
    239: dict(ci="2026-11-06", n=0, p=35, k=0, t=CO, bbq=True),
    240: dict(ci="2026-10-29", co="2026-10-30", n=1, p=40, k=0, t=CO),
    241: dict(ci="2026-10-29", co="2026-10-30", n=1, p=25, k=0, t=CO, twin=True),
    250: dict(ci="2026-10-30", co="2026-10-31", n=1, p=120, k=0, t=None),
    251: dict(ci="2026-11-05", co="2026-11-06", n=1, p=23, k=0, t=CO, bbq=True),
    255: dict(n=1, p=7, k=0, t=G, bbq=True, unsure=True, note="'26.12.11~26 또는 12.12~13' 날짜 이상"),
    256: dict(ci="2026-10-17", co="2026-10-18", n=1, p=20, k=6, t=G),
    257: dict(ci=None, n=2, p=60, k=0, t=C, note="27년 7월말 목금토 또는 수목금"),
    259: dict(ci="2026-12-18", co="2026-12-19", n=1, p=[45, 50], k=0, t=C),
    265: dict(p=50, k=0, t=C, unsure=True, note="1월말 1박 또는 7월말 2박 중 하나"),
    266: dict(ci="2027-01-21", co="2027-01-23", n=2, p=[20, 30], k=0, t=C),
    268: dict(ci="2027-01-29", co="2027-01-30", n=1, p=[20, 30], k=0, t=C),
}
# 같은 글이 두 번 올라온 것: 39(=28), 40(=32), 41(=36), 48(=45 거의 같음), 267(=257) → 뺌


def scrub(t: str) -> str:
    """연락처·이메일·담당자/신청자 이름을 지운다."""
    t = re.sub(r"[\w.+-]+@[\w-]+(\.[\w-]+)+", "(이메일)", t)
    t = re.sub(r"0\d{1,2}[\s.\-)]*\d{3,4}[\s.\-]*\d{4}(\(내선\d+\))?", "010-0000-0000", t)
    t = re.sub(r"(?m)^(\s*-?\s*(담당자?|신청자)\s*[:：]?\s*)(?!\(확인중\)).+$", r"\1(담당자)", t)
    t = re.sub(r"[가-힣]+(?<![으따])로\s?\d+(?![박일동])(번?길\s?\d+)?", "(주소)", t)   # 도로명 주소 ("중순으로 2박" 같은 건 빼고)
    t = re.sub(r"(?m)^[가-힣]{3}$", "(담당자)", t)            # 항목 이름 없이 이름만 적은 줄
    return t.strip()


URL = "https://ykujzljgaxtbwawuwoff.supabase.co/functions/v1/kakao-quote"


def build(path):
    rows = list(csv.DictReader(open(path, encoding="utf-8-sig")))
    out = []
    for i, lab in sorted(L.items()):
        lab = dict(lab)
        note = lab.pop("note", None)
        exp = {k: v for k, v in lab.items() if not (k == "t" and v is None)}
        out.append(dict(id="c%03d" % i, request=scrub(rows[i]["Message"]), asof=rows[i]["Date"][:10], expect=exp, note=note))
    return out


def main(path):
    """QUOTE_USER_KEY(승인된 직원 카카오 user id)가 있으면 kakao-quote 로 바로 올리고, 없으면 JSON 출력."""
    import json
    import os
    import urllib.request
    cases = build(path)
    key = os.environ.get("QUOTE_USER_KEY")
    if not key:
        print(json.dumps(cases, ensure_ascii=False, indent=1))
        return
    for n in range(0, len(cases), 50):
        body = json.dumps({"userKey": key, "mockCases": cases[n:n + 50]}).encode()
        req = urllib.request.Request(URL, body, {"Content-Type": "application/json"})
        print(urllib.request.urlopen(req, timeout=60).read().decode())


if __name__ == "__main__":
    main(sys.argv[1])
