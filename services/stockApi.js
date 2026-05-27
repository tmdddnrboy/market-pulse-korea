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
 * ║         Market Pulse Korea — Stock API Service                      ║
 * ║                                                                      ║
 * ║  담당 도메인:                                                        ║
 * ║    - 관심 종목(Watchlist) 시세 일괄 조회                            ║
 * ║    - 개별 종목 현재가 / 등락률 / 거래량                             ║
 * ║    - 종목 모멘텀 신호 (기술적 분석 기반)                            ║
 * ║    - 종목에 연결된 최신 뉴스 개수                                   ║
 * ║                                                                      ║
 * ║  실제 API 연동 위치: 각 함수 내부 // ── [LIVE API] ── 블록          ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * 의존성 로드 순서:
 *   config/apiConfig.js  →  services/stockApi.js  →  data/mockData.js
 */

'use strict';

// ══════════════════════════════════════════════════════════════════════
// 워치리스트 종목 코드 목록
// 실제 연동 시 사용자 설정 또는 서버에서 관리
// ══════════════════════════════════════════════════════════════════════

const DEFAULT_WATCHLIST_TICKERS = [
  { ticker: '005930', name: '삼성전자',  market: 'KOSPI' },
  { ticker: '000660', name: 'SK하이닉스',market: 'KOSPI' },
  { ticker: '035420', name: 'NAVER',     market: 'KOSPI' },
  { ticker: '005380', name: '현대차',    market: 'KOSPI' },
  { ticker: '068270', name: '셀트리온',  market: 'KOSPI' },
  { ticker: '051910', name: 'LG화학',    market: 'KOSPI' },
];

// ══════════════════════════════════════════════════════════════════════
// 내부 유틸: 응답 정규화
// ══════════════════════════════════════════════════════════════════════

/**
 * KIS Developers 현재가 응답 → 공통 Stock 스키마로 변환
 *
 * KIS API 응답 예시 (output):
 * { stck_prpr, prdy_vrss, prdy_ctrt, acml_vol, hts_avls, ... }
 *
 * @param {object} raw    - KIS API output 객체
 * @param {object} info   - { ticker, name, market }
 * @returns {object}      - 공통 Stock 스키마
 */
function _normalizeKisStock(raw, info) {
  const price     = parseInt(raw.stck_prpr?.replace(/,/g, '') || 0, 10);
  const change    = parseInt(raw.prdy_vrss?.replace(/,/g, '') || 0, 10);
  const chgPct    = parseFloat(raw.prdy_ctrt || 0);
  const volume    = parseInt(raw.acml_vol?.replace(/,/g, '') || 0, 10);

  return {
    id:               `stock_${info.ticker}`,
    name:             info.name,
    ticker:           info.ticker,
    market:           info.market,
    price,
    change,
    changePercent:    chgPct,
    volume,
    volumeFormatted:  _formatVolume(volume),
    marketCap:        raw.hts_avls || '-',
    momentum:         chgPct > 0 ? 'up' : chgPct < 0 ? 'down' : 'neutral',
    signal:           _calcSignal(chgPct),
    signalColor:      _calcSignalColor(chgPct),
    aiInsight:        '',     // aiSummaryApi.js에서 채움
    relatedNewsCount: 0,      // newsApi.js에서 채움
    riskTags:         [],
    tags:             [],
    source:           'kisdev',
    lastUpdated:      new Date().toISOString(),
    isMockData:       false,
  };
}

/**
 * KRX 종목 시세 응답 → 공통 Stock 스키마로 변환
 *
 * @param {object} raw    - KRX API 원본 행
 * @param {object} info   - { ticker, name, market }
 * @returns {object}
 */
function _normalizeKrxStock(raw, info) {
  const price  = parseFloat(raw.TDD_CLSPRC?.replace(/,/g, '') || 0);
  const change = parseFloat(raw.CMPPREVDD_PRC?.replace(/,/g, '') || 0);
  const chgPct = parseFloat(raw.FLUC_RT || 0);
  const volume = parseInt(raw.ACC_TRDVOL?.replace(/,/g, '') || 0, 10);

  return {
    id:               `stock_${info.ticker}`,
    name:             info.name,
    ticker:           info.ticker,
    market:           info.market,
    price,
    change,
    changePercent:    chgPct,
    volume,
    volumeFormatted:  _formatVolume(volume),
    marketCap:        raw.MKTCAP || '-',
    momentum:         chgPct > 0 ? 'up' : chgPct < 0 ? 'down' : 'neutral',
    signal:           _calcSignal(chgPct),
    signalColor:      _calcSignalColor(chgPct),
    aiInsight:        '',
    relatedNewsCount: 0,
    riskTags:         [],
    tags:             [],
    source:           'krx',
    lastUpdated:      new Date().toISOString(),
    isMockData:       false,
  };
}

/**
 * Alpha Vantage GLOBAL_QUOTE → 공통 Stock 스키마 (미국 주식용)
 *
 * @param {object} raw    - Alpha Vantage 'Global Quote' 내부 객체
 * @param {object} info   - { ticker, name, market }
 * @returns {object}
 */
function _normalizeAlphaStock(raw, info) {
  const price  = parseFloat(raw['05. price'] || 0);
  const change = parseFloat(raw['09. change'] || 0);
  const chgPct = parseFloat((raw['10. change percent'] || '0%').replace('%', ''));
  const volume = parseInt(raw['06. volume'] || 0, 10);

  return {
    id:               `stock_${info.ticker}`,
    name:             info.name,
    ticker:           info.ticker,
    market:           info.market || 'NASDAQ',
    price,
    change,
    changePercent:    chgPct,
    volume,
    volumeFormatted:  _formatVolume(volume),
    marketCap:        '-',
    momentum:         chgPct > 0 ? 'up' : chgPct < 0 ? 'down' : 'neutral',
    signal:           _calcSignal(chgPct),
    signalColor:      _calcSignalColor(chgPct),
    aiInsight:        '',
    relatedNewsCount: 0,
    riskTags:         [],
    tags:             [],
    source:           'alpha_vantage',
    lastUpdated:      new Date().toISOString(),
    isMockData:       false,
  };
}

// ══════════════════════════════════════════════════════════════════════
// ① getWatchlistStocks()
// 워치리스트 전체 종목 시세를 한 번에 가져옵니다.
// ══════════════════════════════════════════════════════════════════════

/**
 * 워치리스트 종목 데이터 일괄 조회
 *
 * TODO: 실제 연동 후보 API
 *   ─ 국내 종목 ─
 *   - KIS Developers (권장, 무료):
 *     GET /uapi/domestic-stock/v1/quotations/inquire-price
 *     Header: tr_id=FHKST01010100, appkey, appsecret, Authorization(Bearer)
 *     Query:  FID_COND_MRKT_DIV_CODE=J, FID_INPUT_ISCD={ticker}
 *     → 종목별 1회씩 요청 필요 (배치 처리)
 *
 *   - KRX 일별 시세 (REST):
 *     POST https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd
 *     body: bld=dbms/MDC/STAT/standard/MDCSTAT01501&isuCd={ticker}
 *
 *   - eBest Open API:
 *     POST /stock/market-data  (t1102 TR)
 *
 *   ─ 미국 종목 ─
 *   - Alpha Vantage (무료, 25 req/day 제한):
 *     function=GLOBAL_QUOTE&symbol={ticker}&apikey={key}
 *   - Polygon.io (유료, 권장):
 *     GET /v2/aggs/ticker/{ticker}/prev?adjusted=true&apiKey={key}
 *   - Twelve Data (무료 플랜):
 *     GET /quote?symbol={ticker}&apikey={key}
 *
 * @param {Array}  tickers - 조회할 종목 목록 (기본: DEFAULT_WATCHLIST_TICKERS)
 * @returns {Promise<Array|null>}
 */
async function getWatchlistStocks(tickers = DEFAULT_WATCHLIST_TICKERS) {
  const cacheKey = `watchlist_${tickers.map(t => t.ticker).join('_')}`;
  const cached   = getCache(cacheKey);
  if (cached) return cached;

  const provider = SELECTED_PROVIDERS.stockKr;
  if (provider === 'mock') return null;

  try {
    // ── [LIVE API: KIS Developers 현재가 일괄 조회] ───────────────────
    // TODO: provider === 'kisdev' 구현
    // 1. OAuth 토큰 발급 (1회)
    // const tokenRes = await fetch(`${getBaseUrl('kisdev')}/oauth2/tokenP`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     grant_type: 'client_credentials',
    //     appkey: getApiKey('kisdev_appkey'),
    //     appsecret: getApiKey('kisdev_secret'),
    //   }),
    // });
    // const { access_token } = await tokenRes.json();
    //
    // 2. 종목별 현재가 조회 (병렬 처리, rate limit 고려)
    // const results = await Promise.all(tickers.map(async info => {
    //   const url = `${getBaseUrl('kisdev')}/uapi/domestic-stock/v1/quotations/inquire-price`
    //             + `?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${info.ticker}`;
    //   const res = await fetchWithRetry(url, {
    //     headers: {
    //       Authorization: `Bearer ${access_token}`,
    //       appkey: getApiKey('kisdev_appkey'),
    //       appsecret: getApiKey('kisdev_secret'),
    //       tr_id: 'FHKST01010100',
    //     }
    //   });
    //   const json = await res.json();
    //   return _normalizeKisStock(json.output, info);
    // }));
    // setCache(cacheKey, results);
    // return results;
    // ──────────────────────────────────────────────────────────────────

    // ── [LIVE API: Alpha Vantage 배치 조회 (미국 종목용)] ─────────────
    // TODO: provider === 'alpha_vantage' 구현
    // const results = [];
    // for (const info of tickers) {
    //   const url = `${getBaseUrl('alpha_vantage')}?function=GLOBAL_QUOTE&symbol=${info.ticker}&apikey=${getApiKey('alpha_vantage')}`;
    //   const res  = await fetchWithRetry(url);
    //   const json = await res.json();
    //   const quote = json['Global Quote'];
    //   if (isEmptyResponse(quote)) continue;
    //   results.push(_normalizeAlphaStock(quote, info));
    //   await sleep(500);  // rate limit 대응 (25 req/day 공유)
    // }
    // setCache(cacheKey, results);
    // return results;
    // ──────────────────────────────────────────────────────────────────

    throw new Error(`getWatchlistStocks: provider '${provider}' 미구현`);

  } catch (err) {
    _logApiError('getWatchlistStocks', provider, err);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════
// ② getStockQuote(ticker)
// 단일 종목 현재가 조회
// ══════════════════════════════════════════════════════════════════════

/**
 * 단일 종목 현재가 조회
 *
 * TODO: 실제 연동 후보 API (위 getWatchlistStocks와 동일)
 *
 * @param {string} ticker - 종목 코드 (예: '005930')
 * @param {string} market - 'KOSPI' | 'KOSDAQ' | 'NASDAQ' | 'NYSE'
 * @returns {Promise<object|null>}
 */
async function getStockQuote(ticker, market = 'KOSPI') {
  const cacheKey = `quote_${ticker}`;
  const cached   = getCache(cacheKey);
  if (cached) return cached;

  const provider = SELECTED_PROVIDERS.stockKr;
  if (provider === 'mock') return null;

  try {
    // ── [LIVE API: KIS Developers 단일 종목 현재가] ───────────────────
    // TODO: provider === 'kisdev' 구현
    // const url = `${getBaseUrl('kisdev')}/uapi/domestic-stock/v1/quotations/inquire-price`
    //           + `?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${ticker}`;
    // const res  = await fetchWithRetry(url, buildFetchOptions('kisdev'));
    // const json = await res.json();
    // const info = DEFAULT_WATCHLIST_TICKERS.find(t => t.ticker === ticker) || { ticker, name: ticker, market };
    // const result = _normalizeKisStock(json.output, info);
    // setCache(cacheKey, result);
    // return result;
    // ──────────────────────────────────────────────────────────────────

    throw new Error(`getStockQuote: provider '${provider}' 미구현`);

  } catch (err) {
    _logApiError('getStockQuote', provider, err);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════
// ③ getStockMomentum(ticker)
// 단일 종목 모멘텀 신호 (기술적 분석 기반)
// ══════════════════════════════════════════════════════════════════════

/**
 * 단일 종목 모멘텀 신호 계산
 *
 * TODO: 실제 연동 후보 API
 *   - KIS Developers:
 *     GET /uapi/domestic-stock/v1/quotations/inquire-daily-price (일봉 데이터)
 *     → 이동평균(MA5/20/60), RSI, MACD 직접 계산
 *   - Alpha Vantage 기술적 지표:
 *     function=RSI&symbol={ticker}&interval=daily&time_period=14&series_type=close
 *     function=MACD&symbol={ticker}&interval=daily&series_type=close
 *   - Polygon.io:
 *     GET /v1/indicators/rsi/{ticker}?timespan=day&window=14&series_type=close
 *   - Twelve Data:
 *     GET /rsi?symbol={ticker}&interval=1day&time_period=14&apikey={key}
 *
 * @param {string} ticker
 * @returns {Promise<object|null>}  { signal, signalColor, momentum, indicators }
 */
async function getStockMomentum(ticker) {
  const cacheKey = `momentum_${ticker}`;
  const cached   = getCache(cacheKey);
  if (cached) return cached;

  const provider = SELECTED_PROVIDERS.stockKr;
  if (provider === 'mock') return null;

  try {
    // ── [LIVE API: Twelve Data RSI + MACD] ───────────────────────────
    // TODO: provider === 'twelve_data' 구현
    // const [rsiRes, macdRes] = await Promise.all([
    //   fetchWithRetry(`${getBaseUrl('twelve_data')}/rsi?symbol=${ticker}&interval=1day&time_period=14&apikey=${getApiKey('twelve_data')}`),
    //   fetchWithRetry(`${getBaseUrl('twelve_data')}/macd?symbol=${ticker}&interval=1day&apikey=${getApiKey('twelve_data')}`),
    // ]);
    // const rsiJson  = await rsiRes.json();
    // const macdJson = await macdRes.json();
    // const rsi      = parseFloat(rsiJson.values?.[0]?.rsi || 50);
    // const macdLine = parseFloat(macdJson.values?.[0]?.macd || 0);
    // const signal   = rsi > 70 ? '과매수' : rsi < 30 ? '과매도' : rsi > 55 ? '강세' : rsi < 45 ? '약세' : '관망';
    // const result = {
    //   signal,
    //   signalColor:  rsi > 55 ? 'green' : rsi < 45 ? 'red' : 'yellow',
    //   momentum:     macdLine > 0 ? 'up' : macdLine < 0 ? 'down' : 'neutral',
    //   indicators:   { rsi, macd: macdLine },
    //   source:       'twelve_data',
    //   lastUpdated:  new Date().toISOString(),
    // };
    // setCache(cacheKey, result);
    // return result;
    // ──────────────────────────────────────────────────────────────────

    throw new Error(`getStockMomentum: provider '${provider}' 미구현`);

  } catch (err) {
    _logApiError('getStockMomentum', provider, err);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════
// 내부 헬퍼
// ══════════════════════════════════════════════════════════════════════

/**
 * 등락률 기반 시그널 문자열 계산
 * @param {number} chgPct
 * @returns {string}
 */
function _calcSignal(chgPct) {
  if (chgPct >= 2.0) return '강세';
  if (chgPct >= 0.5) return '상승';
  if (chgPct <= -2.0) return '약세';
  if (chgPct <= -0.5) return '하락';
  return '관망';
}

/**
 * 등락률 기반 시그널 컬러 계산
 * @param {number} chgPct
 * @returns {'green'|'red'|'yellow'}
 */
function _calcSignalColor(chgPct) {
  if (chgPct >= 0.5)  return 'green';
  if (chgPct <= -0.5) return 'red';
  return 'yellow';
}

/**
 * 거래량 포맷팅
 * @param {number} vol
 * @returns {string}
 */
function _formatVolume(vol) {
  if (!vol || vol === 0) return '-';
  if (vol >= 100000000) return (vol / 100000000).toFixed(1) + '억';
  if (vol >= 10000)     return (vol / 10000).toFixed(0) + '만';
  return vol.toLocaleString();
}

function _logApiError(fnName, provider, err) {
  if (provider !== 'mock') {
    console.warn(`[StockApi] ${fnName} (${provider}) 실패 → mock fallback:`, err.message);
  }
}
