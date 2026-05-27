/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️  SERVER-SIDE ONLY — DO NOT IMPORT IN BROWSER CODE              ║
 * ║                                                                      ║
 * ║  This module is intended for scheduled data collection ONLY.        ║
 * ║  It is executed by scripts/updateDashboardData.js in a             ║
 * ║  Node.js / GitHub Actions environment.                              ║
 * ║                                                                      ║
 * ║  브라우저(프론트엔드)에서 이 파일을 직접 import하거나              ║
 * ║  <script src="..."> 태그로 로드하지 마십시오.                      ║
 * ║  API 키가 브라우저에 노출됩니다.                                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║         Market Pulse Korea — Risk Calendar API Service              ║
 * ║                                                                      ║
 * ║  담당 도메인:                                                        ║
 * ║    - 리스크 이벤트 캘린더 (FOMC, CPI, 실적발표, 옵션만기)          ║
 * ║    - 경제지표 일정 (미국/한국)                                      ║
 * ║    - 기업 실적 발표 캘린더                                          ║
 * ║                                                                      ║
 * ║  지원 Provider:                                                      ║
 * ║    - alpha_vantage   : Alpha Vantage Economic Calendar (무료)       ║
 * ║    - fred            : FRED St. Louis Fed API (무료, 인증 필요)     ║
 * ║    - bok_ecos        : 한국은행 ECOS API (무료, 인증 필요)          ║
 * ║    - twelve_data     : Twelve Data Economic Calendar (무료 일부)    ║
 * ║    - mock            : 목 데이터 (기본값)                           ║
 * ║                                                                      ║
 * ║  실제 API 연동 위치: 각 함수 내부 // ── [LIVE API] ── 블록          ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * 의존성 로드 순서 (index.html):
 *   config/apiConfig.js  →  services/riskCalendarApi.js  →  data/mockData.js
 *
 * 공통 RiskEvent 스키마:
 * {
 *   id:          string,      // 고유 식별자
 *   date:        string,      // 'YYYY-MM-DD'
 *   time:        string,      // '21:30' (현지 시간) 또는 '미정'
 *   timezone:    string,      // 'KST' | 'EST' | 'UTC'
 *   title:       string,      // 이벤트명
 *   description: string,      // 이벤트 설명
 *   type:        string,      // 'fomc'|'cpi'|'pce'|'jobs'|'earnings'|'options_expiry'|'bok'|'gdp'|'other'
 *   impact:      string,      // 'high'|'medium'|'low'
 *   country:     string,      // 'US'|'KR'|'JP'|'CN'|'EU'
 *   previous:    string|null, // 이전 발표값
 *   forecast:    string|null, // 시장 예측값
 *   actual:      string|null, // 실제 발표값 (발표 전: null)
 *   dDay:        string,      // 'D-Day'|'D-3'|'D+2' (클라이언트에서 계산)
 *   source:      string,      // 데이터 출처
 *   isMockData:  boolean,
 * }
 */

'use strict';

// ══════════════════════════════════════════════════════════════════════
// 이벤트 타입 → 아이콘/배지 색상 매핑
// dashboard.js 렌더러에서 UI 표현에 사용합니다.
// ══════════════════════════════════════════════════════════════════════

const EVENT_TYPE_META = {
  fomc:            { icon: '🏛️', label: 'FOMC',       color: 'badge-fed',      impact: 'high'   },
  cpi:             { icon: '📈', label: 'CPI',        color: 'badge-macro',    impact: 'high'   },
  pce:             { icon: '📊', label: 'PCE',        color: 'badge-macro',    impact: 'high'   },
  jobs:            { icon: '👷', label: '고용',        color: 'badge-macro',    impact: 'high'   },
  gdp:             { icon: '🌐', label: 'GDP',        color: 'badge-macro',    impact: 'medium' },
  earnings:        { icon: '💰', label: '실적발표',   color: 'badge-earnings', impact: 'medium' },
  options_expiry:  { icon: '⚡', label: '옵션만기',   color: 'badge-options',  impact: 'medium' },
  bok:             { icon: '🏦', label: '한국은행',   color: 'badge-bok',      impact: 'high'   },
  ism:             { icon: '🏭', label: 'ISM',        color: 'badge-macro',    impact: 'medium' },
  retail_sales:    { icon: '🛍️', label: '소매판매',  color: 'badge-macro',    impact: 'medium' },
  housing:         { icon: '🏠', label: '주택지표',   color: 'badge-macro',    impact: 'low'    },
  other:           { icon: '📅', label: '기타',       color: 'badge-default',  impact: 'low'    },
};

/**
 * 이벤트 타입에 해당하는 메타 정보 반환
 * @param {string} type
 * @returns {{ icon: string, label: string, color: string, impact: string }}
 */
function getEventTypeMeta(type) {
  return EVENT_TYPE_META[type] || EVENT_TYPE_META.other;
}

/**
 * D-Day 문자열 계산
 * @param {string} dateStr - 'YYYY-MM-DD' 형식
 * @returns {string} - 'D-Day' | 'D-3' | 'D+2'
 */
function _calcDDay(dateStr) {
  const today  = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = Math.floor((target - today) / 86400000);
  if (diff === 0) return 'D-Day';
  if (diff > 0)   return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
}

// ══════════════════════════════════════════════════════════════════════
// 내부 유틸: 응답 정규화
// ══════════════════════════════════════════════════════════════════════

/**
 * Alpha Vantage Economic Calendar 응답 → 공통 RiskEvent 스키마 변환
 *
 * Alpha Vantage 응답 예시 (items[]):
 * {
 *   event:         'CPI',
 *   date:          '2025-06-11',
 *   time:          '08:30',
 *   country:       'US',
 *   currency:      'USD',
 *   impact:        'High',
 *   previous:      '3.2%',
 *   estimate:      '3.4%',
 *   actual:        '',         // 발표 전
 * }
 *
 * @param {object} raw   - Alpha Vantage 응답 단일 항목
 * @param {number} idx   - 인덱스 (id 생성용)
 * @returns {object}
 */
function _normalizeAlphaCalendar(raw, idx) {
  const eventName  = (raw.event || '').toUpperCase();
  const type       = _inferEventType(eventName);
  const impactStr  = (raw.impact || '').toLowerCase();

  return {
    id:          `alpha_${idx}_${raw.date}`,
    date:        raw.date         || '',
    time:        raw.time         || '미정',
    timezone:    'EST',
    title:       raw.event        || '',
    description: _buildEventDescription(raw),
    type,
    impact:      impactStr === 'high' ? 'high' : impactStr === 'medium' ? 'medium' : 'low',
    country:     raw.country      || 'US',
    previous:    raw.previous     || null,
    forecast:    raw.estimate     || null,
    actual:      raw.actual || null,
    dDay:        _calcDDay(raw.date),
    source:      'alpha_vantage',
    isMockData:  false,
  };
}

/**
 * Twelve Data Economic Calendar 응답 → 공통 RiskEvent 스키마 변환
 *
 * Twelve Data 응답 예시 (result[]):
 * {
 *   event:          'Federal Reserve Interest Rate Decision',
 *   date:           '2025-06-18 18:00:00',
 *   country:        'US',
 *   currency:       'USD',
 *   importance:     'high',   // 'high'|'medium'|'low'
 *   actual:         null,
 *   previous:       '5.25%',
 *   estimate:       '5.25%',
 * }
 *
 * @param {object} raw   - Twelve Data 응답 단일 항목
 * @param {number} idx
 * @returns {object}
 */
function _normalizeTwelveCalendar(raw, idx) {
  const eventName = raw.event || '';
  const type      = _inferEventType(eventName.toUpperCase());

  // 날짜/시간 분리 ('2025-06-18 18:00:00' → date/time)
  const [date = '', timePart = ''] = (raw.date || '').split(' ');
  const time = timePart.slice(0, 5) || '미정';

  return {
    id:          `twelve_${idx}_${date}`,
    date,
    time,
    timezone:    'UTC',
    title:       eventName,
    description: _buildEventDescription(raw),
    type,
    impact:      raw.importance   || 'low',
    country:     raw.country      || 'US',
    previous:    raw.previous     || null,
    forecast:    raw.estimate     || null,
    actual:      raw.actual       || null,
    dDay:        _calcDDay(date),
    source:      'twelve_data',
    isMockData:  false,
  };
}

/**
 * FRED API 릴리스 캘린더 응답 → 공통 RiskEvent 스키마 변환
 *
 * FRED API 응답 예시 (/releases/dates):
 * {
 *   release_id:   12,
 *   release_name: 'Consumer Price Index',
 *   date:         '2025-06-11',
 * }
 *
 * ⚠️  FRED API는 릴리스 날짜 정보만 제공합니다.
 *     실제 발표값 및 예측값은 별도 조회 필요.
 *
 * @param {object} raw
 * @param {number} idx
 * @returns {object}
 */
function _normalizeFredRelease(raw, idx) {
  const type = _inferEventType((raw.release_name || '').toUpperCase());

  return {
    id:          `fred_${raw.release_id}_${raw.date}`,
    date:        raw.date         || '',
    time:        '미정',
    timezone:    'EST',
    title:       raw.release_name || '',
    description: `FRED 데이터 릴리스: ${raw.release_name}`,
    type,
    impact:      getEventTypeMeta(type).impact,
    country:     'US',
    previous:    null,
    forecast:    null,
    actual:      null,
    dDay:        _calcDDay(raw.date),
    source:      'fred',
    isMockData:  false,
  };
}

/**
 * 한국은행 ECOS API 통계 릴리스 → 공통 RiskEvent 스키마 변환
 *
 * BOK ECOS API 응답 예시 (/StatisticSearch):
 * {
 *   STAT_CODE:  '722Y001',
 *   STAT_NAME:  'GDP 및 주요지표',
 *   ITEM_CODE1: '10101',
 *   ITEM_NAME1: '국내총생산(GDP)',
 *   DATA_VALUE: '...',
 *   TIME:       '2025Q1',
 * }
 *
 * @param {object} raw
 * @param {number} idx
 * @returns {object}
 */
function _normalizeBokRelease(raw, idx) {
  const type = _inferEventType((raw.STAT_NAME || '').toUpperCase());

  return {
    id:          `bok_${idx}_${raw.TIME || Date.now()}`,
    date:        raw.releaseDate  || raw.TIME || '',  // ECOS는 별도 발표일 API 필요
    time:        '08:00',                             // BOK 발표는 보통 오전 8시
    timezone:    'KST',
    title:       raw.STAT_NAME    || raw.ITEM_NAME1 || '',
    description: `한국은행 ECOS: ${raw.STAT_NAME}`,
    type,
    impact:      getEventTypeMeta(type).impact,
    country:     'KR',
    previous:    null,
    forecast:    null,
    actual:      raw.DATA_VALUE   || null,
    dDay:        raw.releaseDate ? _calcDDay(raw.releaseDate) : 'D-?',
    source:      'bok_ecos',
    isMockData:  false,
  };
}

// ══════════════════════════════════════════════════════════════════════
// 내부 헬퍼: 이벤트 타입 추론
// ══════════════════════════════════════════════════════════════════════

/**
 * 이벤트명에서 타입 추론 (키워드 매칭)
 * @param {string} name - 대문자 이벤트명
 * @returns {string}
 */
function _inferEventType(name) {
  if (/FOMC|FEDERAL RESERVE|INTEREST RATE|연방공개시장|금리결정/.test(name)) return 'fomc';
  if (/CPI|CONSUMER PRICE/.test(name))                                         return 'cpi';
  if (/PCE|PERSONAL CONSUMPTION/.test(name))                                   return 'pce';
  if (/NONFARM|PAYROLL|EMPLOYMENT|JOBLESS|실업률|고용/.test(name))             return 'jobs';
  if (/GDP|GROSS DOMESTIC/.test(name))                                          return 'gdp';
  if (/ISM|PMI|MANUFACTURING/.test(name))                                       return 'ism';
  if (/RETAIL SALES|소매판매/.test(name))                                       return 'retail_sales';
  if (/HOUSING|HOME SALES|건설|주택/.test(name))                               return 'housing';
  if (/OPTIONS? EXPIR|OPEX|만기/.test(name))                                   return 'options_expiry';
  if (/EARNINGS|실적|어닝/.test(name))                                          return 'earnings';
  if (/BOK|한국은행|금통위|BASE RATE/.test(name))                               return 'bok';
  return 'other';
}

/**
 * Alpha Vantage / Twelve Data 응답에서 설명 문자열 생성
 * @param {object} raw
 * @returns {string}
 */
function _buildEventDescription(raw) {
  const parts = [];
  if (raw.country)  parts.push(raw.country);
  if (raw.previous) parts.push(`이전: ${raw.previous}`);
  if (raw.estimate || raw.forecast) parts.push(`예측: ${raw.estimate || raw.forecast}`);
  if (raw.actual)   parts.push(`실제: ${raw.actual}`);
  return parts.join(' | ');
}

// ══════════════════════════════════════════════════════════════════════
// ① getRiskCalendar()
// 전체 리스크 이벤트 캘린더 조회 (향후 30일)
// ══════════════════════════════════════════════════════════════════════

/**
 * 향후 30일 리스크 이벤트 캘린더 조회
 *
 * 내부적으로 getEconomicEvents() + getEarningsCalendar()를 병렬 호출하여
 * 통합된 캘린더를 반환합니다.
 *
 * TODO: 실제 연동 시 getEconomicEvents()와 getEarningsCalendar()가
 *       자동으로 선택된 provider를 사용합니다.
 *
 * @param {number} days - 조회 범위 (기본: 30일)
 * @returns {Promise<object[]|null>}
 */
async function getRiskCalendar(days = 30) {
  const cacheKey = `risk_calendar_${days}`;
  const cached   = getCache(cacheKey);
  if (cached) return cached;

  const provider = SELECTED_PROVIDERS.economicCalendar;
  if (provider === 'mock') return null;

  try {
    // 경제지표 + 실적 캘린더 병렬 조회
    const [ecoEvents, earnings] = await Promise.allSettled([
      getEconomicEvents(days),
      getEarningsCalendar(),
    ]);

    const combined = [
      ...(ecoEvents.status === 'fulfilled' && ecoEvents.value  ? ecoEvents.value  : []),
      ...(earnings.status  === 'fulfilled' && earnings.value   ? earnings.value   : []),
    ];

    if (!combined.length) return null;

    // 날짜순 정렬 + D-Day 재계산
    const sorted = combined
      .map(event => ({ ...event, dDay: _calcDDay(event.date) }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    setCache(cacheKey, sorted);
    return sorted;

  } catch (err) {
    _logCalendarError('getRiskCalendar', provider, err);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════
// ② getEconomicEvents(days)
// 경제지표 일정 조회 (미국 + 한국)
// ══════════════════════════════════════════════════════════════════════

/**
 * 경제지표 발표 일정 조회
 *
 * TODO: 실제 연동 후보 API
 *
 *   [alpha_vantage]
 *   GET https://www.alphavantage.co/query
 *     ?function=ECONOMIC_CALENDAR&horizon=3month&apikey={key}
 *   ⚠️  Node.js 서버/CI에서만 호출 (API 키 브라우저 노출 금지)
 *   무료 플랜: 25req/day 제한
 *   응답 형식: CSV (파싱 필요)
 *
 *   [twelve_data]
 *   GET https://api.twelvedata.com/economic_calendar
 *     ?start_date={YYYY-MM-DD}&end_date={YYYY-MM-DD}&importance=high,medium
 *     &apikey={key}
 *   ⚠️  Node.js 서버/CI에서만 호출 (API 키 브라우저 노출 금지)
 *   무료 플랜: 800req/day
 *
 *   [fred]
 *   GET https://api.stlouisfed.org/fred/releases/dates
 *     ?api_key={key}&file_type=json&include_release_dates_with_no_data=true
 *   ⚠️  Node.js 서버/CI에서만 호출 (API 키 브라우저 노출 금지)
 *   무료 키 발급: https://fred.stlouisfed.org/docs/api/api_key.html
 *
 *   [bok_ecos]
 *   GET https://ecos.bok.or.kr/api/KeyStatisticList/{key}/json/kr/1/100/
 *   ⚠️  Node.js 서버/CI에서만 호출 (API 키 브라우저 노출 금지)
 *   무료 키 발급: https://ecos.bok.or.kr/#/AuthKeyService
 *
 * @param {number} days - 조회 범위 (기본: 30일)
 * @returns {Promise<object[]|null>}
 */
async function getEconomicEvents(days = 30) {
  const cacheKey = `eco_events_${days}`;
  const cached   = getCache(cacheKey);
  if (cached) return cached;

  const provider = SELECTED_PROVIDERS.economicCalendar;
  if (provider === 'mock') return null;

  const today   = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + days);
  const startStr = today.toISOString().split('T')[0];
  const endStr   = endDate.toISOString().split('T')[0];

  try {

    // ── [LIVE API: Alpha Vantage Economic Calendar] ───────────────────
    // TODO: provider === 'alpha_vantage' 구현
    // 응답 형식이 CSV이므로 파싱 처리 필요
    //
    // const key = getApiKey('alpha_vantage');
    // if (!key) throw new ApiError('Alpha Vantage 키 미설정', 0, 'alpha_vantage');
    //
    // const url = `${getBaseUrl('alpha_vantage')}`
    //           + `?function=ECONOMIC_CALENDAR&horizon=3month&apikey=${key}`;
    // const res  = await fetchWithRetry(url, { signal: AbortSignal.timeout(10000) });
    // const text = await res.text();
    // // CSV 파싱: 첫 줄 헤더, 나머지 데이터
    // const lines  = text.trim().split('\n');
    // const header = lines[0].split(',');
    // const events = lines.slice(1)
    //   .filter(line => line.trim())
    //   .map((line, idx) => {
    //     const cols = line.split(',');
    //     const raw  = Object.fromEntries(header.map((h, i) => [h.trim(), (cols[i] || '').trim()]));
    //     return _normalizeAlphaCalendar(raw, idx);
    //   })
    //   .filter(e => e.date >= startStr && e.date <= endStr)
    //   .filter(e => ['high', 'medium'].includes(e.impact));  // 중요도 필터
    // setCache(cacheKey, events);
    // return events;
    // ──────────────────────────────────────────────────────────────────

    // ── [LIVE API: Twelve Data Economic Calendar] ─────────────────────
    // TODO: provider === 'twelve_data' 구현
    //
    // const key = getApiKey('twelve_data');
    // if (!key) throw new ApiError('Twelve Data 키 미설정', 0, 'twelve_data');
    //
    // const url  = `${getBaseUrl('twelve_data')}/economic_calendar`
    //            + `?start_date=${startStr}&end_date=${endStr}&importance=high,medium&apikey=${key}`;
    // const res  = await fetchWithRetry(url, { signal: AbortSignal.timeout(10000) });
    // const json = await res.json();
    // if (!json.result?.length) throw new EmptyResponseError('twelve_data');
    // const events = json.result.map((item, idx) => _normalizeTwelveCalendar(item, idx));
    // setCache(cacheKey, events);
    // return events;
    // ──────────────────────────────────────────────────────────────────

    // ── [LIVE API: FRED Releases Calendar] ───────────────────────────
    // TODO: provider === 'fred' 구현
    //
    // const key = getApiKey('fred');
    // if (!key) throw new ApiError('FRED API 키 미설정', 0, 'fred');
    //
    // const url  = `${getBaseUrl('fred')}/releases/dates`
    //            + `?api_key=${key}&file_type=json&include_release_dates_with_no_data=true`
    //            + `&realtime_start=${startStr}&realtime_end=${endStr}`;
    // const res  = await fetchWithRetry(url);
    // const json = await res.json();
    // const releases = (json.release_dates || [])
    //   .filter(r => r.date >= startStr && r.date <= endStr)
    //   .map((r, idx) => _normalizeFredRelease(r, idx))
    //   .filter(e => e.type !== 'other');  // 주요 지표만
    // setCache(cacheKey, releases);
    // return releases;
    // ──────────────────────────────────────────────────────────────────

    // ── [LIVE API: 한국은행 ECOS API] ────────────────────────────────
    // TODO: provider === 'bok_ecos' 구현
    //
    // const key = getApiKey('bok_ecos');
    // if (!key) throw new ApiError('BOK ECOS 키 미설정', 0, 'bok_ecos');
    //
    // const url  = `${getBaseUrl('bok_ecos')}/StatisticSearch/${key}/json/kr/1/100/722Y001/A`;
    // const res  = await fetchWithRetry(url);
    // const json = await res.json();
    // const rows = json.StatisticSearch?.row || [];
    // if (!rows.length) throw new EmptyResponseError('bok_ecos');
    // const events = rows.map((r, idx) => _normalizeBokRelease(r, idx));
    // setCache(cacheKey, events);
    // return events;
    // ──────────────────────────────────────────────────────────────────

    throw new ApiError(
      `getEconomicEvents: provider '${provider}' 미구현`,
      0,
      provider,
    );

  } catch (err) {
    _logCalendarError('getEconomicEvents', provider, err);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════
// ③ getEarningsCalendar()
// 기업 실적 발표 캘린더
// ══════════════════════════════════════════════════════════════════════

/**
 * 향후 주요 기업 실적 발표 일정 조회
 *
 * 한국 기업과 미국 기업 (NVDA, AAPL 등 한국 시장 영향 종목) 포함
 *
 * TODO: 실제 연동 후보 API
 *
 *   [alpha_vantage]
 *   GET https://www.alphavantage.co/query
 *     ?function=EARNINGS_CALENDAR&symbol={ticker}&horizon=3month&apikey={key}
 *   응답 형식: CSV
 *   ⚠️  Node.js 서버/CI에서만 호출 (API 키 브라우저 노출 금지)
 *
 *   [polygon_io]
 *   GET https://api.polygon.io/v3/reference/tickers/events
 *   유료 플랜 필요
 *
 *   [twelve_data]
 *   GET https://api.twelvedata.com/earnings_calendar
 *     ?start_date={YYYY-MM-DD}&end_date={YYYY-MM-DD}&apikey={key}
 *   무료 플랜 일부 지원
 *
 *   [한국 기업 실적 일정]
 *   KRX 공시시스템(dart.fss.or.kr) OPEN API:
 *   GET https://opendart.fss.or.kr/api/disclosureSearch.json
 *     ?crtfc_key={key}&bgn_de={YYYYMMDD}&end_de={YYYYMMDD}&pblntf_ty=A
 *   (정기보고서 공시 조회)
 *
 * @returns {Promise<object[]|null>}
 */
async function getEarningsCalendar() {
  const cacheKey = 'earnings_calendar';
  const cached   = getCache(cacheKey);
  if (cached) return cached;

  const provider = SELECTED_PROVIDERS.earnings || SELECTED_PROVIDERS.economicCalendar;
  if (provider === 'mock') return null;

  // 조회 대상 종목 (한국 시장 영향력 높은 미국 종목 + 주요 한국 종목)
  const watchTickers = {
    us: ['NVDA', 'AAPL', 'MSFT', 'TSLA', 'AMZN', 'META'],
    kr: ['005930', '000660', '035420', '005380'],
  };

  try {

    // ── [LIVE API: Alpha Vantage Earnings Calendar] ────────────────────
    // TODO: provider === 'alpha_vantage' 구현
    //
    // const key = getApiKey('alpha_vantage');
    // if (!key) throw new ApiError('Alpha Vantage 키 미설정', 0, 'alpha_vantage');
    //
    // const results = [];
    // for (const ticker of watchTickers.us) {
    //   const url  = `${getBaseUrl('alpha_vantage')}`
    //              + `?function=EARNINGS_CALENDAR&symbol=${ticker}&horizon=3month&apikey=${key}`;
    //   const res  = await fetchWithRetry(url, { signal: AbortSignal.timeout(8000) });
    //   const text = await res.text();
    //   const lines  = text.trim().split('\n');
    //   const header = lines[0].split(',');
    //   const events = lines.slice(1)
    //     .filter(line => line.trim())
    //     .map((line, idx) => {
    //       const cols = line.split(',');
    //       const raw  = Object.fromEntries(header.map((h, i) => [h.trim(), (cols[i] || '').trim()]));
    //       return {
    //         id:          `earnings_${ticker}_${raw.reportDate}`,
    //         date:        raw.reportDate  || '',
    //         time:        raw.reportTime  || '미정',  // 'before-open'|'after-close'
    //         timezone:    'EST',
    //         title:       `${ticker} 실적발표 (Q${raw.fiscalQuarter || '?'})`,
    //         description: `EPS 예측: ${raw.estimate || '-'} | 통화: ${raw.currency || 'USD'}`,
    //         type:        'earnings',
    //         impact:      'medium',
    //         country:     'US',
    //         previous:    null,
    //         forecast:    raw.estimate || null,
    //         actual:      null,
    //         dDay:        _calcDDay(raw.reportDate),
    //         source:      'alpha_vantage',
    //         isMockData:  false,
    //       };
    //     });
    //   results.push(...events);
    //   await new Promise(r => setTimeout(r, 500));  // rate limit (25req/day)
    // }
    // setCache(cacheKey, results);
    // return results;
    // ──────────────────────────────────────────────────────────────────

    // ── [LIVE API: Twelve Data Earnings Calendar] ─────────────────────
    // TODO: provider === 'twelve_data' 구현
    //
    // const today  = new Date();
    // const future = new Date();
    // future.setDate(future.getDate() + 30);
    // const key = getApiKey('twelve_data');
    //
    // const url  = `${getBaseUrl('twelve_data')}/earnings_calendar`
    //            + `?start_date=${today.toISOString().split('T')[0]}`
    //            + `&end_date=${future.toISOString().split('T')[0]}`
    //            + `&apikey=${key}`;
    // const res  = await fetchWithRetry(url);
    // const json = await res.json();
    // const events = (json.earnings || [])
    //   .filter(e => watchTickers.us.includes(e.symbol))
    //   .map((e, idx) => ({
    //     id:          `twelve_earnings_${e.symbol}_${e.date}`,
    //     date:        e.date         || '',
    //     time:        e.time         || '미정',
    //     timezone:    'EST',
    //     title:       `${e.symbol} (${e.company_name || ''}) 실적발표`,
    //     description: `EPS 예측: ${e.eps_estimate || '-'}`,
    //     type:        'earnings',
    //     impact:      'medium',
    //     country:     'US',
    //     previous:    e.eps_prior    || null,
    //     forecast:    e.eps_estimate || null,
    //     actual:      e.eps_actual   || null,
    //     dDay:        _calcDDay(e.date),
    //     source:      'twelve_data',
    //     isMockData:  false,
    //   }));
    // setCache(cacheKey, events);
    // return events;
    // ──────────────────────────────────────────────────────────────────

    throw new ApiError(
      `getEarningsCalendar: provider '${provider}' 미구현`,
      0,
      provider,
    );

  } catch (err) {
    _logCalendarError('getEarningsCalendar', provider, err);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════
// 내부 헬퍼
// ══════════════════════════════════════════════════════════════════════

/**
 * API 에러 로그 출력
 * @param {string} fnName
 * @param {string} provider
 * @param {Error}  err
 */
function _logCalendarError(fnName, provider, err) {
  if (provider !== 'mock') {
    console.warn(`[RiskCalendarApi] ${fnName} (${provider}) 실패 → mock fallback:`, err.message);
  }
}
