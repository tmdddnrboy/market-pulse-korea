/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║          Market Pulse Korea — Data Layer v2.0                   ║
 * ║                                                                  ║
 * ║  이 파일은 "데이터 레이어"입니다.                                ║
 * ║  Mock 데이터와 실제 API fetch 함수가 함께 존재합니다.            ║
 * ║                                                                  ║
 * ║  실제 API 연동 시:                                               ║
 * ║    각 fetchXxx() 함수 내부의 // [API ENDPOINT] 주석 위치에       ║
 * ║    실제 fetch() 요청을 작성하면 됩니다.                          ║
 * ║    Mock 데이터는 fallback으로 그대로 유지됩니다.                 ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * 데이터 그룹:
 *   1. marketOverview   — 시장 전체 요약 (센티멘트, 수급, 컨디션)
 *   2. marketIndices    — 지수 카드 (KOSPI, KOSDAQ, 환율 등)
 *   3. tickerTape       — 상단 티커 테이프 항목
 *   4. watchlistStocks  — 모멘텀 종목 워치리스트
 *   5. sectorTrends     — 섹터별 흐름 & 자금 동향
 *   6. keyIssues        — 핵심 이슈 (체크포인트)
 *   7. newsInsights     — 뉴스 + AI 인사이트
 *   8. riskCalendar     — 리스크 이벤트 캘린더
 *   9. investorFlows    — 투자자별 수급
 *  10. aiSummary        — AI 시장 종합 요약
 */

'use strict';

// ══════════════════════════════════════════════════════════════════════
// ① marketOverview
// ══════════════════════════════════════════════════════════════════════
const MOCK_MARKET_OVERVIEW = {
  id:              'market_overview',
  source:          'mock',                         // 실제: 'KRX' | 'FnGuide' | 'Bloomberg'
  lastUpdated:     '2025-05-26T09:30:00+09:00',
  updateInterval:  300,                            // seconds (5분)
  confidenceLevel: 'mock',                         // 실제: 'high' | 'medium' | 'low'
  isMockData:      true,

  sentimentScore:  62,     // 0~100 (0=극단적 공포, 100=극단적 탐욕)
  sentimentLabel:  '약간 강세',
  marketCondition: '신중한 낙관',
  conditionColor:  'green',                        // 'green' | 'yellow' | 'red'
  fearGreedIndex:  58,
  fearGreedLabel:  'Greed',
  putCallRatio:    0.82,
  advanceDeclineRatio: 1.42,                       // 상승 종목 수 / 하락 종목 수
  tradingHalt:     false,
  marketStatus:    'closed',                       // 'pre' | 'open' | 'closed' | 'after'
  marketStatusLabel: '장 마감',
};

// ══════════════════════════════════════════════════════════════════════
// ② marketIndices
// ══════════════════════════════════════════════════════════════════════
const MOCK_MARKET_INDICES = [
  {
    id:          'kospi',
    name:        'KOSPI',
    value:       2714.32,
    change:      +18.45,
    changePercent: +0.68,
    volume:      '4조 2,310억',
    high:        2721.80,
    low:         2698.10,
    open:        2700.10,
    prevClose:   2695.87,
    trend:       'up',                             // 'up' | 'down' | 'neutral'
    sparkline:   [2682, 2690, 2698, 2695, 2701, 2708, 2705, 2711, 2714],
    currency:    'KRW',
    source:      'mock',                           // 실제: 'KRX'
    lastUpdated: '2025-05-26T09:30:00+09:00',
    isMockData:  true,
  },
  {
    id:          'kosdaq',
    name:        'KOSDAQ',
    value:       841.17,
    change:      -3.22,
    changePercent: -0.38,
    volume:      '6조 1,890억',
    high:        848.30,
    low:         838.90,
    open:        844.20,
    prevClose:   844.39,
    trend:       'down',
    sparkline:   [848, 846, 845, 847, 844, 842, 843, 841, 841],
    currency:    'KRW',
    source:      'mock',
    lastUpdated: '2025-05-26T09:30:00+09:00',
    isMockData:  true,
  },
  {
    id:          'kospi200',
    name:        'KOSPI 200',
    value:       368.54,
    change:      +2.31,
    changePercent: +0.63,
    volume:      '-',
    high:        369.80,
    low:         365.20,
    open:        366.50,
    prevClose:   366.23,
    trend:       'up',
    sparkline:   [364, 365, 366, 365, 367, 367, 368, 368, 369],
    currency:    'KRW',
    source:      'mock',
    lastUpdated: '2025-05-26T09:30:00+09:00',
    isMockData:  true,
  },
  {
    id:          'usdkrw',
    name:        'USD/KRW',
    value:       1342.50,
    change:      -5.30,
    changePercent: -0.39,
    volume:      '-',
    high:        1348.10,
    low:         1340.80,
    open:        1347.80,
    prevClose:   1347.80,
    trend:       'down',
    sparkline:   [1350, 1349, 1347, 1348, 1346, 1345, 1343, 1342, 1342],
    currency:    'KRW',
    source:      'mock',                           // 실제: 'BOK' | 'Investing.com'
    lastUpdated: '2025-05-26T09:30:00+09:00',
    isMockData:  true,
  },
  {
    id:          'us10y',
    name:        '미 국채 10Y',
    value:       4.312,
    change:      +0.021,
    changePercent: +0.49,
    volume:      '-',
    high:        4.330,
    low:         4.295,
    open:        4.291,
    prevClose:   4.291,
    trend:       'up',
    sparkline:   [4.27, 4.28, 4.29, 4.29, 4.30, 4.30, 4.31, 4.31, 4.31],
    currency:    'PCT',
    source:      'mock',                           // 실제: 'UST' | 'Bloomberg'
    lastUpdated: '2025-05-26T09:30:00+09:00',
    isMockData:  true,
  },
  {
    id:          'wti',
    name:        'WTI 원유',
    value:       78.42,
    change:      +1.18,
    changePercent: +1.53,
    volume:      '-',
    high:        78.90,
    low:         76.80,
    open:        77.24,
    prevClose:   77.24,
    trend:       'up',
    sparkline:   [76, 76.5, 77, 77.2, 77.5, 77.8, 78, 78.2, 78.4],
    currency:    'USD',
    source:      'mock',                           // 실제: 'EIA' | 'CME'
    lastUpdated: '2025-05-26T09:30:00+09:00',
    isMockData:  true,
  },
];

// ══════════════════════════════════════════════════════════════════════
// ③ tickerTape  (티커 테이프 전용 — 더 많은 항목 포함 가능)
// ══════════════════════════════════════════════════════════════════════
const MOCK_TICKER_TAPE = [
  { id: 'kospi',    name: 'KOSPI',        value: 2714.32, changePercent: +0.68,  trend: 'up'   },
  { id: 'kosdaq',   name: 'KOSDAQ',       value: 841.17,  changePercent: -0.38,  trend: 'down' },
  { id: 'usdkrw',  name: 'USD/KRW',      value: 1342.50, changePercent: -0.39,  trend: 'down' },
  { id: 'sp500',   name: 'S&P 500',      value: 5304.72, changePercent: +0.52,  trend: 'up'   },
  { id: 'nasdaq',  name: 'NASDAQ',        value: 16785.22,changePercent: +0.78,  trend: 'up'   },
  { id: 'nikkei',  name: 'NIKKEI 225',   value: 38402.10,changePercent: -0.81,  trend: 'down' },
  { id: 'hsi',     name: 'HANG SENG',    value: 18562.43,changePercent: +0.34,  trend: 'up'   },
  { id: 'us10y',   name: '미 국채 10Y',  value: 4.312,   changePercent: +0.49,  trend: 'up'   },
  { id: 'wti',     name: 'WTI',          value: 78.42,   changePercent: +1.53,  trend: 'up'   },
  { id: 'gold',    name: 'GOLD',         value: 2341.80, changePercent: +0.22,  trend: 'up'   },
  { id: 'btc',     name: 'BTC/USD',      value: 68420.00,changePercent: +2.14,  trend: 'up'   },
  {
    source:      'mock',
    lastUpdated: '2025-05-26T09:30:00+09:00',
    isMockData:  true,
  },
];

// ══════════════════════════════════════════════════════════════════════
// ④ watchlistStocks  (종목 워치리스트)
// ══════════════════════════════════════════════════════════════════════
const MOCK_WATCHLIST_STOCKS = [
  {
    id:               'stock_005930',
    name:             '삼성전자',
    ticker:           '005930',
    market:           'KOSPI',
    price:            74800,
    change:           +1200,
    changePercent:    +1.63,
    volume:           12847320,
    volumeFormatted:  '1,284만',
    marketCap:        '447조',
    sector:           '반도체',
    momentum:         'up',                        // 'up' | 'down' | 'neutral'
    signal:           '강세',
    signalColor:      'green',                     // 'green' | 'red' | 'yellow'
    aiInsight:        'HBM3E 공급 계약 확대 기대감으로 기관 순매수 유입. 외국인 3일 연속 매수세.',
    relatedNewsCount: 4,
    riskTags:         ['환율위험', '반도체업황'],
    tags:             ['HBM', 'AI반도체', '기관매수'],
    source:           'mock',                      // 실제: 'KRX' | 'FnGuide'
    lastUpdated:      '2025-05-26T09:30:00+09:00',
    isMockData:       true,
  },
  {
    id:               'stock_000660',
    name:             'SK하이닉스',
    ticker:           '000660',
    market:           'KOSPI',
    price:            196500,
    change:           +4500,
    changePercent:    +2.34,
    volume:           3214550,
    volumeFormatted:  '321만',
    marketCap:        '143조',
    sector:           '반도체',
    momentum:         'up',
    signal:           '강세',
    signalColor:      'green',
    aiInsight:        '엔비디아 H200 HBM 독점 공급 재확인. 2분기 실적 기대치 상향 조정 잇따라.',
    relatedNewsCount: 6,
    riskTags:         ['공급과잉리스크'],
    tags:             ['HBM3E', 'NVDA', '실적상향'],
    source:           'mock',
    lastUpdated:      '2025-05-26T09:30:00+09:00',
    isMockData:       true,
  },
  {
    id:               'stock_035420',
    name:             'NAVER',
    ticker:           '035420',
    market:           'KOSPI',
    price:            182500,
    change:           -1500,
    changePercent:    -0.82,
    volume:           1042300,
    volumeFormatted:  '104만',
    marketCap:        '29조',
    sector:           '인터넷·플랫폼',
    momentum:         'neutral',
    signal:           '관망',
    signalColor:      'yellow',
    aiInsight:        'AI 검색 전환 비용 우려. 라인야후 지분 이슈 재부각. 단기 변동성 주의.',
    relatedNewsCount: 3,
    riskTags:         ['라인야후이슈', '규제리스크'],
    tags:             ['라인야후', 'AI검색', '변동성'],
    source:           'mock',
    lastUpdated:      '2025-05-26T09:30:00+09:00',
    isMockData:       true,
  },
  {
    id:               'stock_005380',
    name:             '현대차',
    ticker:           '005380',
    market:           'KOSPI',
    price:            228000,
    change:           +3000,
    changePercent:    +1.33,
    volume:           876440,
    volumeFormatted:  '87만',
    marketCap:        '48조',
    sector:           '자동차',
    momentum:         'up',
    signal:           '강세',
    signalColor:      'green',
    aiInsight:        '미국 관세 우려 완화 및 전기차 인센티브 연장 소식. 2Q 북미 판매 호조 예상.',
    relatedNewsCount: 3,
    riskTags:         ['관세리스크', '환율위험'],
    tags:             ['관세완화', 'EV', '북미판매'],
    source:           'mock',
    lastUpdated:      '2025-05-26T09:30:00+09:00',
    isMockData:       true,
  },
  {
    id:               'stock_068270',
    name:             '셀트리온',
    ticker:           '068270',
    market:           'KOSPI',
    price:            158000,
    change:           -4200,
    changePercent:    -2.59,
    volume:           2301880,
    volumeFormatted:  '230만',
    marketCap:        '21조',
    sector:           '바이오',
    momentum:         'down',
    signal:           '약세',
    signalColor:      'red',
    aiInsight:        '램시마SC 미국 보험 적용 범위 축소 우려. 외국인 이틀째 순매도. 단기 조정 국면.',
    relatedNewsCount: 2,
    riskTags:         ['FDA리스크', '바이오시밀러경쟁'],
    tags:             ['바이오시밀러', '외국인매도', '조정'],
    source:           'mock',
    lastUpdated:      '2025-05-26T09:30:00+09:00',
    isMockData:       true,
  },
  {
    id:               'stock_051910',
    name:             'LG화학',
    ticker:           '051910',
    market:           'KOSPI',
    price:            312000,
    change:           +7500,
    changePercent:    +2.46,
    volume:           654220,
    volumeFormatted:  '65만',
    marketCap:        '22조',
    sector:           '배터리·소재',
    momentum:         'up',
    signal:           '강세',
    signalColor:      'green',
    aiInsight:        '배터리 분리막 신규 수주 공시. 미국 IRA 수혜 지속. 목표주가 상향 리포트 2건.',
    relatedNewsCount: 2,
    riskTags:         ['원자재가격', 'IRA정책변화'],
    tags:             ['IRA수혜', '분리막', '목표주가↑'],
    source:           'mock',
    lastUpdated:      '2025-05-26T09:30:00+09:00',
    isMockData:       true,
  },
];

// ══════════════════════════════════════════════════════════════════════
// ⑤ sectorTrends  (섹터 흐름)
// ══════════════════════════════════════════════════════════════════════
const MOCK_SECTOR_TRENDS = [
  {
    id:             'sector_semiconductor',
    name:           '반도체',
    changePercent:  +2.18,
    strength:       92,               // 0~100 (섹터 모멘텀 강도)
    trend:          'up',             // 'up' | 'down' | 'neutral'
    leadingStocks:  ['SK하이닉스', '삼성전자', 'DB하이텍'],
    keyDrivers:     ['NVDA 어닝서프라이즈', 'HBM 수요 폭증', 'AI 서버 투자 확대'],
    risks:          ['공급과잉 우려', '미중 수출규제'],
    fundFlow:       '기관·외인 동반 매수',
    fundFlowAmount: '+3,520억',
    source:         'mock',           // 실제: 'KRX' | 'FnGuide' | 'Fn에프앤가이드'
    lastUpdated:    '2025-05-26T09:30:00+09:00',
    isMockData:     true,
  },
  {
    id:             'sector_battery',
    name:           '배터리·소재',
    changePercent:  +1.84,
    strength:       78,
    trend:          'up',
    leadingStocks:  ['LG화학', 'LG에너지솔루션', '에코프로비엠'],
    keyDrivers:     ['미국 IRA 수혜 지속', '전기차 배터리 수주'],
    risks:          ['리튬 가격 하락', '중국 경쟁사 공세'],
    fundFlow:       '기관 순매수',
    fundFlowAmount: '+1,240억',
    source:         'mock',
    lastUpdated:    '2025-05-26T09:30:00+09:00',
    isMockData:     true,
  },
  {
    id:             'sector_auto',
    name:           '자동차',
    changePercent:  +1.22,
    strength:       65,
    trend:          'up',
    leadingStocks:  ['현대차', '기아', '현대모비스'],
    keyDrivers:     ['미국 관세 우려 완화', '북미 EV 판매 호조'],
    risks:          ['원화 강세', '미중 무역갈등'],
    fundFlow:       '외국인 매수 재개',
    fundFlowAmount: '+890억',
    source:         'mock',
    lastUpdated:    '2025-05-26T09:30:00+09:00',
    isMockData:     true,
  },
  {
    id:             'sector_steel',
    name:           '철강·소재',
    changePercent:  +0.45,
    strength:       42,
    trend:          'up',
    leadingStocks:  ['POSCO홀딩스', '현대제철', '고려아연'],
    keyDrivers:     ['중국 경기 부양책 기대'],
    risks:          ['중국 공급 과잉', '글로벌 수요 둔화'],
    fundFlow:       '소폭 유입',
    fundFlowAmount: '+210억',
    source:         'mock',
    lastUpdated:    '2025-05-26T09:30:00+09:00',
    isMockData:     true,
  },
  {
    id:             'sector_finance',
    name:           '금융·보험',
    changePercent:  -0.12,
    strength:       38,
    trend:          'neutral',
    leadingStocks:  ['KB금융', '신한지주', '하나금융지주'],
    keyDrivers:     ['금리 동결 기조 지속'],
    risks:          ['금리 인하 사이클 진입 시 NIM 축소'],
    fundFlow:       '관망세',
    fundFlowAmount: '-80억',
    source:         'mock',
    lastUpdated:    '2025-05-26T09:30:00+09:00',
    isMockData:     true,
  },
  {
    id:             'sector_telecom',
    name:           '통신·유틸리티',
    changePercent:  -0.31,
    strength:       30,
    trend:          'down',
    leadingStocks:  ['KT', 'SKT', 'LG유플러스'],
    keyDrivers:     ['배당 기대감'],
    risks:          ['통신요금 인하 압박', '투자 확대 부담'],
    fundFlow:       '소폭 이탈',
    fundFlowAmount: '-130억',
    source:         'mock',
    lastUpdated:    '2025-05-26T09:30:00+09:00',
    isMockData:     true,
  },
  {
    id:             'sector_bio',
    name:           '바이오·헬스케어',
    changePercent:  -1.43,
    strength:       22,
    trend:          'down',
    leadingStocks:  ['셀트리온', '삼성바이오로직스', '한미약품'],
    keyDrivers:     [],
    risks:          ['FDA 규제 리스크', '바이오시밀러 경쟁 심화', '외국인 이탈'],
    fundFlow:       '외국인 순매도',
    fundFlowAmount: '-780억',
    source:         'mock',
    lastUpdated:    '2025-05-26T09:30:00+09:00',
    isMockData:     true,
  },
  {
    id:             'sector_internet',
    name:           '인터넷·플랫폼',
    changePercent:  -0.76,
    strength:       28,
    trend:          'down',
    leadingStocks:  ['NAVER', '카카오', '크래프톤'],
    keyDrivers:     ['개인 투자자 매수'],
    risks:          ['라인야후 이슈', 'AI 전환 비용', '광고 시장 둔화'],
    fundFlow:       '개인 매수 / 기관 이탈',
    fundFlowAmount: '+40억 (개인) / -320억 (기관)',
    source:         'mock',
    lastUpdated:    '2025-05-26T09:30:00+09:00',
    isMockData:     true,
  },
];

// ══════════════════════════════════════════════════════════════════════
// ⑥ keyIssues  (오늘의 핵심 체크포인트 — AI 생성)
// ══════════════════════════════════════════════════════════════════════
const MOCK_KEY_ISSUES = {
  id:              'key_issues_today',
  source:          'mock_ai',                      // 실제: 'openai_gpt4o' | 'anthropic_claude'
  lastUpdated:     '2025-05-26T09:30:00+09:00',
  updateInterval:  1800,                           // 30분 (AI 생성 주기)
  confidenceLevel: 'mock',
  isMockData:      true,

  marketCondition: '신중한 낙관',
  conditionColor:  'green',
  generatedAt:     '2025-05-26T09:30:00+09:00',
  summary:         'NVDA 어닝서프라이즈와 연준 금리 인하 기대감이 시장 전반에 긍정적으로 작용 중. 단, 바이오 섹터 불확실성과 원화 강세 압력은 섹터별 온도차를 만들고 있습니다.',

  items: [
    {
      id:            'issue_001',
      priority:      '핵심',
      priorityColor: 'red',
      icon:          '🔥',
      text:          '반도체 (SK하이닉스·삼성전자): NVDA 호실적 수혜 지속. 기관·외인 동반 매수 흐름 확인 후 접근.',
      relatedTickers: ['000660', '005930'],
      relatedSectors: ['반도체'],
    },
    {
      id:            'issue_002',
      priority:      '주목',
      priorityColor: 'yellow',
      icon:          '👀',
      text:          '원달러 환율 1,340원 지지 여부: 원화 강세 지속 시 수출주 실적 전망 하향 조정 가능. 환율 1,335원 하단 주시.',
      relatedTickers: ['usdkrw'],
      relatedSectors: ['반도체', '자동차'],
    },
    {
      id:            'issue_003',
      priority:      '주목',
      priorityColor: 'yellow',
      icon:          '⚠️',
      text:          '바이오 섹터: 셀트리온 FDA 판결 여파로 섹터 전반 약세. 단기 추격 매수보다는 바닥 확인 후 접근 권고.',
      relatedTickers: ['068270'],
      relatedSectors: ['바이오·헬스케어'],
    },
    {
      id:            'issue_004',
      priority:      '참고',
      priorityColor: 'blue',
      icon:          '📅',
      text:          '5/28 미국 PCE 발표 전까지 단기 포지션 관리 중요. 예상치 상회 시 금리 인하 기대 후퇴로 성장주 조정 가능.',
      relatedTickers: ['KOSPI', 'USD/KRW'],
      relatedSectors: [],
    },
    {
      id:            'issue_005',
      priority:      '참고',
      priorityColor: 'blue',
      icon:          '🚗',
      text:          '자동차 섹터 (현대차·기아): 미국 관세 리스크 완화 기대감 지속. 북미 전기차 판매 지표 확인 필요.',
      relatedTickers: ['005380'],
      relatedSectors: ['자동차'],
    },
  ],
};

// ══════════════════════════════════════════════════════════════════════
// ⑦ newsInsights  (뉴스 + AI 인사이트)
// ══════════════════════════════════════════════════════════════════════
const MOCK_NEWS_INSIGHTS = [
  {
    id:             'news_001',
    title:          '연준, 9월 금리 인하 가능성 시사…파월 의장 \'데이터 의존\' 재강조',
    source:         'Bloomberg',
    publishedAt:    '2025-05-26T08:42:00+09:00',
    category:       '거시경제',
    categoryColor:  'blue',
    summary:        '파월 연준 의장이 잭슨홀 연설에서 인플레이션 둔화 진전을 인정하며 9월 FOMC에서 금리 인하 가능성을 처음으로 공개 시사했다. 시장은 25bp 인하를 62% 확률로 반영 중.',
    aiInsight:      '금리 인하 기대감은 성장주·반도체주에 단기 호재. 단, 달러 약세에 따른 원화 강세는 수출주 실적에 복합적 영향을 줄 수 있어 환율 모니터링이 중요합니다.',
    relatedStocks:  ['005930', '000660'],
    relatedSectors: ['반도체', '인터넷·플랫폼'],
    impactLevel:    'high',                        // 'high' | 'medium' | 'low'
    sentiment:      'positive',                    // 'positive' | 'negative' | 'neutral'
    riskFactors:    ['예상치 상회 시 기대 후퇴', '달러 강세 반전'],
    url:            '',                            // 실제: 원본 기사 URL
    isBreaking:     true,
    isMockData:     true,
  },
  {
    id:             'news_002',
    title:          '엔비디아, 2분기 가이던스 어닝서프라이즈…HBM 수요 \'폭발적\'',
    source:         'CNBC',
    publishedAt:    '2025-05-26T07:15:00+09:00',
    category:       '반도체',
    categoryColor:  'purple',
    summary:        '엔비디아가 2분기 매출 가이던스를 시장 예상치 대비 15% 상회하는 280억 달러로 제시. CEO 젠슨 황은 HBM3E 공급 부족이 최소 2026년까지 지속될 것이라고 발언.',
    aiInsight:      'SK하이닉스와 삼성전자의 HBM 부문 수주 모멘텀에 직접적 호재. 특히 SK하이닉스의 경우 NVDA 단독 공급 계약 비중이 높아 수혜 강도가 더 클 것으로 예상됩니다.',
    relatedStocks:  ['000660', '005930'],
    relatedSectors: ['반도체'],
    impactLevel:    'high',
    sentiment:      'positive',
    riskFactors:    ['공급 부족 장기화 리스크', '경쟁사 HBM 진입'],
    url:            '',
    isBreaking:     true,
    isMockData:     true,
  },
  {
    id:             'news_003',
    title:          '미·중 반도체 수출 규제 완화 협상…한국 기업 반사이익 기대',
    source:         'Reuters',
    publishedAt:    '2025-05-26T06:30:00+09:00',
    category:       '정책·규제',
    categoryColor:  'orange',
    summary:        '미국 상무부가 일부 반도체 장비에 대한 대중 수출 통제 완화를 검토 중이라는 보도. 완전한 규제 해제보다는 특정 노드에 한정된 부분적 조정이 될 것으로 전망.',
    aiInsight:      '완전한 규제 해제가 아닌 부분 조정으로 한국 반도체 기업의 직접 수혜는 제한적일 수 있습니다. 다만 업황 전반의 심리 개선에는 긍정적으로 작용할 전망.',
    relatedStocks:  ['005930', '000660'],
    relatedSectors: ['반도체'],
    impactLevel:    'medium',
    sentiment:      'neutral',
    riskFactors:    ['협상 결렬 가능성', '미중 갈등 재점화'],
    url:            '',
    isBreaking:     false,
    isMockData:     true,
  },
  {
    id:             'news_004',
    title:          '셀트리온, 미 FDA 항소 기각…램시마SC 보험 적용 재검토 돌입',
    source:         '한국경제',
    publishedAt:    '2025-05-26T05:50:00+09:00',
    category:       '바이오',
    categoryColor:  'pink',
    summary:        '셀트리온이 제기한 미국 메디케어 약가 결정 관련 항소가 연방법원에서 기각됐다. 회사 측은 즉각 상소 의사를 밝혔으나, 단기 보험 적용 범위 축소는 피하기 어려울 전망.',
    aiInsight:      '단기적으로 미국 시장 매출 불확실성이 커진 상황입니다. 바이오시밀러 경쟁 심화와 맞물려 2분기 실적 전망에 보수적 시각이 필요합니다.',
    relatedStocks:  ['068270'],
    relatedSectors: ['바이오·헬스케어'],
    impactLevel:    'high',
    sentiment:      'negative',
    riskFactors:    ['미국 매출 급감', '추가 소송 비용'],
    url:            '',
    isBreaking:     false,
    isMockData:     true,
  },
  {
    id:             'news_005',
    title:          '한국 5월 소비자물가 2.3% 상승…한은 동결 기조 유지 전망',
    source:         '연합뉴스',
    publishedAt:    '2025-05-26T08:00:00+09:00',
    category:       '거시경제',
    categoryColor:  'blue',
    summary:        '통계청이 발표한 5월 소비자물가지수는 전년 동월 대비 2.3% 상승, 시장 예상(2.5%)을 하회. 한국은행의 기준금리 3.25% 동결 기조가 연내 유지될 가능성이 높아졌다.',
    aiInsight:      '물가 안정은 긍정적이나, 경기 둔화 신호와 맞물려 한은의 추가 완화 여력이 제한적입니다. 내수·소비 관련주보다는 수출·기술 섹터에 집중하는 전략이 유효할 수 있습니다.',
    relatedStocks:  [],
    relatedSectors: ['금융·보험'],
    impactLevel:    'medium',
    sentiment:      'neutral',
    riskFactors:    ['경기 둔화 심화', '가계부채 부담'],
    url:            '',
    isBreaking:     false,
    isMockData:     true,
  },
  {
    id:             'news_006',
    title:          '일본 닛케이, BOJ 긴축 우려 속 0.8% 하락…엔화 강세 재개',
    source:         'Nikkei Asia',
    publishedAt:    '2025-05-26T09:10:00+09:00',
    category:       '글로벌',
    categoryColor:  'teal',
    summary:        '일본은행(BOJ)의 조기 추가 금리 인상 가능성이 재부각되며 닛케이225 지수가 장중 0.8% 하락. 엔/달러 환율은 152엔대로 내려앉으며 수출주 중심 매도세 강화.',
    aiInsight:      '엔화 강세는 일본 수출주에 부정적이지만, 한국 경쟁 기업(반도체, 자동차) 입장에서는 상대적 가격 경쟁력 개선 효과를 기대할 수 있습니다.',
    relatedStocks:  ['005380'],
    relatedSectors: ['자동차', '반도체'],
    impactLevel:    'medium',
    sentiment:      'neutral',
    riskFactors:    ['엔저 재반전 가능성', '일본 경기 둔화'],
    url:            '',
    isBreaking:     false,
    isMockData:     true,
  },
];

// ══════════════════════════════════════════════════════════════════════
// ⑧ riskCalendar  (리스크 이벤트 캘린더)
// ══════════════════════════════════════════════════════════════════════
const MOCK_RISK_CALENDAR = [
  {
    id:               'risk_001',
    eventName:        '미국 PCE 물가지수 발표',
    date:             '2025-05-28',
    region:           '미국',
    importance:       'high',                      // 'high' | 'medium' | 'low'
    expectedImpact:   'KOSPI ±1.5%, 원달러 변동성 확대',
    relatedSectors:   ['반도체', '인터넷·플랫폼', '자동차'],
    dDay:             null,                        // JS에서 동적 계산
    description:      '연준이 선호하는 인플레이션 지표. 예상치 상회 시 금리 인하 기대 후퇴.',
    type:             '경제지표',
    source:           'mock',                      // 실제: 'investing.com' | 'Bloomberg'
    lastUpdated:      '2025-05-26T09:30:00+09:00',
    isMockData:       true,
  },
  {
    id:               'risk_002',
    eventName:        '삼성전자 주주총회 & 2Q 가이던스 발표',
    date:             '2025-06-02',
    region:           '한국',
    importance:       'medium',
    expectedImpact:   '반도체 섹터 ±2~3% 변동 예상',
    relatedSectors:   ['반도체'],
    dDay:             null,
    description:      'HBM 수주 현황 및 하반기 메모리 수요 전망 발표 예정. 반도체 섹터 방향성 결정 이벤트.',
    type:             '기업 이벤트',
    source:           'mock',
    lastUpdated:      '2025-05-26T09:30:00+09:00',
    isMockData:       true,
  },
  {
    id:               'risk_003',
    eventName:        '미국 FOMC 금리 결정',
    date:             '2025-06-11',
    region:           '미국',
    importance:       'medium',
    expectedImpact:   '글로벌 증시 변동성 확대, 달러 인덱스 방향 결정',
    relatedSectors:   ['금융·보험', '반도체', '자동차'],
    dDay:             null,
    description:      '6월 FOMC. 현재 시장은 동결 95% 반영. 점도표 변화에 시장 집중.',
    type:             '통화정책',
    source:           'mock',
    lastUpdated:      '2025-05-26T09:30:00+09:00',
    isMockData:       true,
  },
  {
    id:               'risk_004',
    eventName:        'G7 정상회의 (무역·관세 의제)',
    date:             '2025-06-13',
    region:           '글로벌',
    importance:       'low',
    expectedImpact:   '정보기술·반도체 섹터 단기 변동성',
    relatedSectors:   ['반도체', '자동차'],
    dDay:             null,
    description:      '미중 관계 및 반도체 수출 규제 관련 공동성명 주목. 예상치 못한 강경 발표 리스크.',
    type:             '지정학',
    source:           'mock',
    lastUpdated:      '2025-05-26T09:30:00+09:00',
    isMockData:       true,
  },
];

// ══════════════════════════════════════════════════════════════════════
// ⑨ investorFlows  (투자자별 수급)
// ══════════════════════════════════════════════════════════════════════
const MOCK_INVESTOR_FLOWS = {
  id:          'investor_flows_today',
  source:      'mock',                             // 실제: 'KRX' | 'KOSCOM'
  lastUpdated: '2025-05-26T09:30:00+09:00',
  updateInterval: 300,
  isMockData:  true,

  market:      'KOSPI',
  date:        '2025-05-26',

  // 순매수 금액 (억 원, 양수=매수 우위, 음수=매도 우위)
  foreign:       { net: +2340, formatted: '순매수 +2,340억', trend: 'up',   consecutive: 3 },
  institutional: { net: +1180, formatted: '순매수 +1,180억', trend: 'up',   consecutive: 2 },
  retail:        { net: -3220, formatted: '순매도 -3,220억', trend: 'down', consecutive: 3 },

  // 상세 기관 분류
  institutionalDetail: {
    investmentTrust: +520,                         // 투신
    pension:         +380,                         // 연기금
    insurance:       +180,                         // 보험
    bank:            +100,                         // 은행
    other:           +0,
  },
};

// ══════════════════════════════════════════════════════════════════════
// ⑩ aiSummary  (AI 시장 종합 요약)
// ══════════════════════════════════════════════════════════════════════
const MOCK_AI_SUMMARY = {
  id:              'ai_summary_today',
  source:          'mock_ai',                      // 실제: 'openai_gpt4o' | 'anthropic_claude'
  lastUpdated:     '2025-05-26T09:30:00+09:00',
  updateInterval:  1800,                           // 30분
  confidenceLevel: 'mock',                         // 실제: 'high' | 'medium' | 'low'
  modelVersion:    'mock-v1',                      // 실제: 'gpt-4o-2025-05' | 'claude-3-7-sonnet'
  isMockData:      true,

  headline:        '반도체 주도 강세 속 바이오 약세 — 섹터 양극화 심화',
  body:            'NVDA 어닝서프라이즈가 국내 HBM 수혜주(SK하이닉스·삼성전자)의 강세를 이끌고 있습니다. 연준의 9월 금리 인하 기대감도 성장주에 긍정적 환경을 조성 중입니다. 반면 셀트리온 FDA 이슈로 바이오 섹터는 단기 하락 압력을 받고 있으며, 원화 강세에 따른 수출주 실적 우려도 일부 반영되는 모습입니다.',
  keyTakeaways: [
    '반도체(SK하이닉스·삼성전자) — 핵심 모멘텀 유효, 기관·외인 동반 매수',
    'WTI 반등(+1.5%) — 에너지 관련 인플레이션 재점화 여부 모니터링 필요',
    '원달러 1,342원 — 1,340원 지지 여부가 수출주 향방 결정',
    '5/28 PCE 발표 전 포지션 관리 권고',
  ],
  marketOutlook:   '단기 중립~강세',
  outlookColor:    'green',
  generatedAt:     '2025-05-26T09:30:00+09:00',
};


// ══════════════════════════════════════════════════════════════════════
//
//  FETCH FUNCTIONS
//  ─────────────────────────────────────────────────────────────────
//  각 함수는 아래 구조를 따릅니다:
//
//  async function fetchXxx() {
//    try {
//      // ─── [API ENDPOINT] ─────────────────────────────────────
//      //  실제 API 연동 시 이 블록을 교체하세요.
//      //  현재는 mock data + 네트워크 딜레이 시뮬레이션
//      // ────────────────────────────────────────────────────────
//      await simulateNetworkDelay(min, max);
//      return wrapResponse(MOCK_DATA);
//
//    } catch (error) {
//      console.warn('[DataLayer] fetchXxx fallback:', error.message);
//      return wrapResponse(MOCK_DATA, { isFallback: true, error });
//    }
//  }
//
// ══════════════════════════════════════════════════════════════════════

/**
 * ① 시장 전체 개요 (센티멘트, 컨디션)
 *
 * [API ENDPOINT — 주가 API 연결 지점]
 * 실제 연동 예시:
 *   const res = await fetch('https://api.yourservice.com/v1/market/overview', {
 *     headers: { 'Authorization': `Bearer ${API_KEY}` }
 *   });
 *   const json = await res.json();
 *   return wrapResponse(json.data);
 *
 * 참고 API: FnGuide, KIS Developers, Wisefn
 */
async function fetchMarketOverview() {
  try {
    // ─── [STEP 1] services/marketApi.js 먼저 시도 ────────────────
    // getMarketOverview()는 provider === 'mock'이면 null 반환
    if (typeof getMarketOverview === 'function') {
      const liveData = await getMarketOverview();
      if (liveData) return wrapResponse(liveData);
    }
    // ─── [STEP 2] live 데이터 없으면 mock fallback ────────────────
    await simulateNetworkDelay(200, 500);
    return wrapResponse(MOCK_MARKET_OVERVIEW);
    // ─────────────────────────────────────────────────────────────
  } catch (error) {
    console.warn('[DataLayer] fetchMarketOverview fallback:', error.message);
    return wrapResponse(MOCK_MARKET_OVERVIEW, { isFallback: true, error: error.message });
  }
}

/**
 * ② 시장 지수 데이터 (KOSPI, KOSDAQ, 환율, 원자재 등)
 *
 * [API ENDPOINT — 주가/지수 API 연결 지점]
 * 실제 연동 예시 (KRX OpenAPI):
 *   const res = await fetch('https://openapi.krx.co.kr/contents/COM/GenerateOTP.jspx?...');
 *   ...
 *
 * 참고 API: KRX OpenAPI, Alpha Vantage (/GLOBAL_QUOTE), Yahoo Finance API
 * 환율 참고: 한국은행 Open API (https://ecos.bok.or.kr/api/)
 * 원자재 참고: EIA API, CME DataMine
 */
async function fetchMarketIndices() {
  try {
    // ─── [STEP 1] services/marketApi.js 먼저 시도 ────────────────
    if (typeof getMarketIndices === 'function') {
      const liveData = await getMarketIndices();
      if (liveData) return wrapResponse(liveData);
    }
    // ─── [STEP 2] mock fallback ───────────────────────────────────
    await simulateNetworkDelay(300, 700);
    return wrapResponse(MOCK_MARKET_INDICES);
    // ─────────────────────────────────────────────────────────────
  } catch (error) {
    console.warn('[DataLayer] fetchMarketIndices fallback:', error.message);
    return wrapResponse(MOCK_MARKET_INDICES, { isFallback: true, error: error.message });
  }
}

/**
 * ③ 티커 테이프 데이터 (글로벌 지수 포함)
 *
 * [API ENDPOINT — 글로벌 지수 API 연결 지점]
 * 국내 지수 + 해외 지수(S&P500, NASDAQ, Nikkei) + 암호화폐
 *
 * 참고 API:
 *   - 해외 지수: Yahoo Finance v8 API, Twelve Data
 *   - 암호화폐: CoinGecko API (https://api.coingecko.com/api/v3/simple/price)
 */
async function fetchTickerTape() {
  try {
    // ─── [STEP 1] services/marketApi.js 먼저 시도 ────────────────
    if (typeof getTickerTape === 'function') {
      const liveData = await getTickerTape();
      if (liveData) return wrapResponse(liveData);
    }
    // ─── [STEP 2] mock fallback ───────────────────────────────────
    await simulateNetworkDelay(200, 400);
    const tickerItems = MOCK_TICKER_TAPE.filter(item => item.id);
    return wrapResponse(tickerItems);
    // ─────────────────────────────────────────────────────────────
  } catch (error) {
    console.warn('[DataLayer] fetchTickerTape fallback:', error.message);
    const tickerItems = MOCK_TICKER_TAPE.filter(item => item.id);
    return wrapResponse(tickerItems, { isFallback: true, error: error.message });
  }
}

/**
 * ④ 워치리스트 종목 데이터 (모멘텀 + AI 인사이트)
 *
 * [API ENDPOINT — 종목 데이터 + AI 요약 API 연결 지점]
 *
 * 종목 데이터 참고 API:
 *   - KRX 정보데이터시스템 (data.krx.co.kr)
 *   - FnGuide API
 *   - KOSCOM 시세 API
 *
 * AI 요약 연결 예시:
 *   const stockData = await fetch('https://api.fnguide.com/stock/...');
 *   const aiSummary = await fetch('https://api.openai.com/v1/chat/completions', {
 *     method: 'POST',
 *     headers: { Authorization: `Bearer ${OPENAI_KEY}` },
 *     body: JSON.stringify({
 *       model: 'gpt-4o',
 *       messages: [{ role: 'user', content: `종목 ${ticker} 분석: ${newsContext}` }]
 *     })
 *   });
 */
async function fetchWatchlistStocks() {
  try {
    // ─── [STEP 1] services/stockApi.js 먼저 시도 ─────────────────
    if (typeof getWatchlistStocks === 'function') {
      const liveData = await getWatchlistStocks();
      if (liveData) return wrapResponse(liveData);
    }
    // ─── [STEP 2] mock fallback ───────────────────────────────────
    await simulateNetworkDelay(400, 900);
    return wrapResponse(MOCK_WATCHLIST_STOCKS);
    // ─────────────────────────────────────────────────────────────
  } catch (error) {
    console.warn('[DataLayer] fetchWatchlistStocks fallback:', error.message);
    return wrapResponse(MOCK_WATCHLIST_STOCKS, { isFallback: true, error: error.message });
  }
}

/**
 * ⑤ 섹터 트렌드 (섹터별 등락, 수급, 키드라이버, 리스크)
 *
 * [API ENDPOINT — 섹터 지수 API 연결 지점]
 *
 * 참고 API:
 *   - KRX 업종지수: https://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd
 *   - FnGuide 섹터 분류
 *   - Wisefn 테마/섹터 API
 */
async function fetchSectorTrends() {
  try {
    // ─── [STEP 1] services/marketApi.js 먼저 시도 ────────────────
    if (typeof getSectorTrends === 'function') {
      const liveData = await getSectorTrends();
      if (liveData) return wrapResponse(liveData);
    }
    // ─── [STEP 2] mock fallback ───────────────────────────────────
    await simulateNetworkDelay(300, 600);
    return wrapResponse(MOCK_SECTOR_TRENDS);
    // ─────────────────────────────────────────────────────────────
  } catch (error) {
    console.warn('[DataLayer] fetchSectorTrends fallback:', error.message);
    return wrapResponse(MOCK_SECTOR_TRENDS, { isFallback: true, error: error.message });
  }
}

/**
 * ⑥ 핵심 이슈 / 체크포인트 (AI 생성)
 *
 * [API ENDPOINT — AI 요약 API 연결 지점]
 *
 * 연결 흐름:
 *   1. 최신 뉴스 5~10건 수집 (뉴스 API)
 *   2. 시장 지수/수급 데이터 수집
 *   3. AI 모델에 프롬프트 전달
 *   4. 구조화된 체크포인트 JSON 반환
 *
 * 예시 (OpenAI):
 *   const res = await fetch('https://api.openai.com/v1/chat/completions', {
 *     method: 'POST',
 *     headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
 *     body: JSON.stringify({
 *       model: 'gpt-4o',
 *       response_format: { type: 'json_object' },
 *       messages: [
 *         { role: 'system', content: KEY_ISSUES_SYSTEM_PROMPT },
 *         { role: 'user', content: `오늘의 뉴스: ${JSON.stringify(newsItems)}` }
 *       ]
 *     })
 *   });
 */
async function fetchKeyIssues() {
  try {
    // ─── [STEP 1] services/aiSummaryApi.js 먼저 시도 ─────────────
    // generateKeyIssues()는 뉴스 + 시장 데이터가 필요하나,
    // 여기서는 간소화된 호출로 이슈 목록만 생성 시도
    if (typeof generateKeyIssues === 'function') {
      const liveData = await generateKeyIssues([], {});
      if (liveData) return wrapResponse(liveData);
    }
    // ─── [STEP 2] mock fallback ───────────────────────────────────
    await simulateNetworkDelay(600, 1400);
    return wrapResponse(MOCK_KEY_ISSUES);
    // ─────────────────────────────────────────────────────────────
  } catch (error) {
    console.warn('[DataLayer] fetchKeyIssues fallback:', error.message);
    return wrapResponse(MOCK_KEY_ISSUES, { isFallback: true, error: error.message });
  }
}

/**
 * ⑦ 뉴스 + AI 인사이트
 *
 * [API ENDPOINT — 뉴스 API + AI 인사이트 API 연결 지점]
 *
 * 뉴스 수집 참고 API:
 *   - 네이버 뉴스 검색 API (https://openapi.naver.com/v1/search/news.json)
 *   - Korea Economic Daily API
 *   - NewsAPI (https://newsapi.org/v2/everything?q=주식&language=ko)
 *   - RSS 파싱: 연합뉴스, 한국경제, 매일경제
 *
 * AI 인사이트 생성:
 *   각 뉴스 본문을 AI에 전달하여 '한국 투자자 관점의 핵심 인사이트' 생성
 *   예시 프롬프트: "다음 뉴스를 한국 주식 투자자 관점에서 핵심 인사이트 2~3문장으로 요약해줘..."
 */
async function fetchNewsInsights() {
  try {
    // ─── [STEP 1] services/newsApi.js 먼저 시도 ──────────────────
    if (typeof getLatestMarketNews === 'function') {
      const liveNews = await getLatestMarketNews(10);
      if (liveNews && liveNews.length > 0) {
        // AI 인사이트 생성 시도 (aiSummaryApi.js 연동)
        if (typeof generateNewsInsight === 'function') {
          const enriched = await Promise.allSettled(
            liveNews.map(async (item) => {
              const insight = await generateNewsInsight(item);
              return insight
                ? { ...item, insight: insight.insight, sentiment: insight.sentiment || item.sentiment }
                : item;
            })
          );
          const result = enriched
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value);
          return wrapResponse(result);
        }
        return wrapResponse(liveNews);
      }
    }
    // ─── [STEP 2] mock fallback ───────────────────────────────────
    await simulateNetworkDelay(500, 1200);
    return wrapResponse(MOCK_NEWS_INSIGHTS);
    // ─────────────────────────────────────────────────────────────
  } catch (error) {
    console.warn('[DataLayer] fetchNewsInsights fallback:', error.message);
    return wrapResponse(MOCK_NEWS_INSIGHTS, { isFallback: true, error: error.message });
  }
}

/**
 * ⑧ 리스크 이벤트 캘린더
 *
 * [API ENDPOINT — 경제지표 일정 API 연결 지점]
 *
 * 참고 API:
 *   - Investing.com Economic Calendar (비공식 스크레이핑 또는 서드파티)
 *   - Alpha Vantage Economic Calendar: https://www.alphavantage.co/query?function=ECONOMIC_CALENDAR
 *   - Twelve Data Economic Calendar
 *   - FRED (St. Louis Fed) API
 *   - 한국은행 ECOS API (국내 경제지표)
 *
 * D-Day 계산은 클라이언트에서 동적으로 처리합니다.
 */
async function fetchRiskCalendar() {
  try {
    // ─── [STEP 1] services/riskCalendarApi.js 먼저 시도 ──────────
    if (typeof getRiskCalendar === 'function') {
      const liveData = await getRiskCalendar(30);
      if (liveData && liveData.length > 0) return wrapResponse(liveData);
    }
    // ─── [STEP 2] mock fallback + D-Day 동적 계산 주입 ───────────
    await simulateNetworkDelay(200, 500);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const withDDay = MOCK_RISK_CALENDAR.map(event => {
      const target = new Date(event.date);
      target.setHours(0, 0, 0, 0);
      const diff = Math.floor((target - today) / 86400000);
      return {
        ...event,
        dDay: diff === 0 ? 'D-Day' : diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`,
      };
    });
    return wrapResponse(withDDay);
    // ─────────────────────────────────────────────────────────────
  } catch (error) {
    console.warn('[DataLayer] fetchRiskCalendar fallback:', error.message);
    return wrapResponse(MOCK_RISK_CALENDAR, { isFallback: true, error: error.message });
  }
}

/**
 * ⑨ 투자자별 수급 데이터
 *
 * [API ENDPOINT — 수급 데이터 API 연결 지점]
 *
 * 참고 API:
 *   - KRX 투자자별 매매: https://data.krx.co.kr
 *   - KOSCOM API (유료)
 *   - 증권사 OpenAPI (키움, 대신 등)
 */
async function fetchInvestorFlows() {
  try {
    // ─── [STEP 1] services/marketApi.js 먼저 시도 ────────────────
    if (typeof getInvestorFlows === 'function') {
      const liveData = await getInvestorFlows();
      if (liveData) return wrapResponse(liveData);
    }
    // ─── [STEP 2] mock fallback ───────────────────────────────────
    await simulateNetworkDelay(300, 700);
    return wrapResponse(MOCK_INVESTOR_FLOWS);
    // ─────────────────────────────────────────────────────────────
  } catch (error) {
    console.warn('[DataLayer] fetchInvestorFlows fallback:', error.message);
    return wrapResponse(MOCK_INVESTOR_FLOWS, { isFallback: true, error: error.message });
  }
}

/**
 * ⑩ AI 시장 종합 요약
 *
 * [API ENDPOINT — AI 종합 요약 API 연결 지점]
 *
 * 연결 흐름:
 *   1. 시장 데이터(지수, 수급, 섹터) 수집
 *   2. 뉴스 헤드라인 5~10건 수집
 *   3. AI 모델에 전체 컨텍스트 전달
 *   4. 시장 종합 요약 JSON 반환
 *
 * 예시 (Anthropic Claude):
 *   const res = await fetch('https://api.anthropic.com/v1/messages', {
 *     method: 'POST',
 *     headers: {
 *       'x-api-key': ANTHROPIC_KEY,
 *       'anthropic-version': '2023-06-01',
 *       'Content-Type': 'application/json',
 *     },
 *     body: JSON.stringify({
 *       model: 'claude-3-7-sonnet-20250219',
 *       max_tokens: 1024,
 *       messages: [{ role: 'user', content: MARKET_SUMMARY_PROMPT }]
 *     })
 *   });
 */
async function fetchAISummary() {
  try {
    // ─── [STEP 1] services/aiSummaryApi.js 먼저 시도 ─────────────
    // generateMarketBrief()는 provider === 'mock'이면 null 반환
    if (typeof generateMarketBrief === 'function') {
      const liveData = await generateMarketBrief({}, []);
      if (liveData) return wrapResponse(liveData);
    }
    // ─── [STEP 2] mock fallback ───────────────────────────────────
    await simulateNetworkDelay(700, 1500);
    return wrapResponse(MOCK_AI_SUMMARY);
    // ─────────────────────────────────────────────────────────────
  } catch (error) {
    console.warn('[DataLayer] fetchAISummary fallback:', error.message);
    return wrapResponse(MOCK_AI_SUMMARY, { isFallback: true, error: error.message });
  }
}

/**
 * 전체 대시보드 데이터를 병렬 fetch하여 dashboardData 객체로 반환
 *
 * 개별 fetch 실패는 wrapResponse의 fallback 처리로 흡수됩니다.
 * 전체 Promise.allSettled를 사용해 일부 실패 시에도 나머지 데이터는 렌더됩니다.
 */
async function fetchDashboardData() {
  const fetchMap = {
    overview:      fetchMarketOverview(),
    indices:       fetchMarketIndices(),
    ticker:        fetchTickerTape(),
    stocks:        fetchWatchlistStocks(),
    sectors:       fetchSectorTrends(),
    keyIssues:     fetchKeyIssues(),
    news:          fetchNewsInsights(),
    risks:         fetchRiskCalendar(),
    flows:         fetchInvestorFlows(),
    aiSummary:     fetchAISummary(),
  };

  const keys    = Object.keys(fetchMap);
  const results = await Promise.allSettled(Object.values(fetchMap));

  const dashboardData = { _meta: { fetchedAt: new Date().toISOString(), errors: [] } };

  results.forEach((result, i) => {
    const key = keys[i];
    if (result.status === 'fulfilled') {
      dashboardData[key] = result.value.data;
      // 섹션별 lastUpdated 전달
      dashboardData[`${key}UpdatedAt`] = result.value.lastUpdated;
      if (result.value.isFallback) {
        dashboardData._meta.errors.push({ key, message: result.value.error });
      }
    } else {
      // Promise 자체가 reject된 경우 (네트워크 완전 단절 등)
      console.error(`[DataLayer] fetchDashboardData ${key} rejected:`, result.reason);
      dashboardData[key] = null;
      dashboardData._meta.errors.push({ key, message: result.reason?.message || 'unknown' });
    }
  });

  return dashboardData;
}


// ══════════════════════════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════════════════════════

/**
 * 모든 fetch 함수의 공통 응답 래퍼
 *
 * isMockData 판정 로직:
 *   - data 자체에 isMockData 필드가 있으면 그 값 우선 사용 (live data 구별)
 *   - isFallback === true 이면 항상 true
 *   - 그 외 기본값 true (mock fallback)
 *
 * @param {*}       data       - 실제 데이터
 * @param {object}  options    - { isFallback, error }
 */
function wrapResponse(data, options = {}) {
  // live data는 isMockData: false 필드를 직접 포함하거나 배열 첫 항목을 확인
  const dataMockFlag = Array.isArray(data)
    ? (data[0]?.isMockData !== false)           // 배열: 첫 항목이 live data인지 확인
    : (data?.isMockData !== false);             // 단일 객체

  return {
    data,
    lastUpdated: new Date().toISOString(),
    isFallback:  options.isFallback || false,
    error:       options.error      || null,
    isMockData:  options.isFallback ? true : dataMockFlag,
  };
}

/**
 * 네트워크 딜레이 시뮬레이션 (mock 전용)
 * 실제 API 연동 시 이 함수는 호출되지 않습니다.
 */
function simulateNetworkDelay(min = 200, max = 800) {
  const ms = Math.random() * (max - min) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 하위 호환성 별칭 — 구 코드에서 fetchAllDashboardData()를 호출하는 경우 대응
 * @deprecated fetchDashboardData() 사용 권장
 */
const fetchAllDashboardData = fetchDashboardData;
