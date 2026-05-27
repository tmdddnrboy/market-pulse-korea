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
 * ║         Market Pulse Korea — Market API Service                     ║
 * ║                                                                      ║
 * ║  담당 도메인:                                                        ║
 * ║    - 국내 시장 지수 (KOSPI, KOSDAQ, KOSPI200)                       ║
 * ║    - 글로벌 지수 (S&P500, NASDAQ, Nikkei, Hang Seng)               ║
 * ║    - 환율 (USD/KRW, JPY/KRW, EUR/KRW)                              ║
 * ║    - 원자재 (WTI, Brent, Gold, Silver)                              ║
 * ║    - 암호화폐 (BTC, ETH)                                            ║
 * ║    - 시장 전체 센티멘트 / 투자자 수급                               ║
 * ║    - 티커 테이프용 통합 데이터                                      ║
 * ║                                                                      ║
 * ║  실제 API 연동 위치: 각 함수 내부 // ── [LIVE API] ── 블록          ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * 의존성 로드 순서 (index.html):
 *   config/apiConfig.js  →  services/marketApi.js  →  data/mockData.js
 */

'use strict';

// ══════════════════════════════════════════════════════════════════════
// 내부 유틸: 응답 정규화
// 각 provider의 응답 포맷을 공통 스키마로 변환합니다.
// ══════════════════════════════════════════════════════════════════════

/**
 * KRX API 지수 응답 → 공통 Index 스키마로 변환
 * TODO: KRX API 실제 응답 구조 확인 후 매핑 작성
 * @param {object} raw - KRX API 원본 응답
 * @returns {object}   - 공통 Index 스키마
 */
function _normalizeKrxIndex(raw) {
  // KRX 응답 예시 (실제 구조는 API 문서 확인 필요):
  // { ISU_CD, ISU_NM, TDD_CLSPRC, FLUC_TP_CD, CMPPREVDD_PRC, FLUC_RT, ACC_TRDVOL, ... }
  return {
    id:            (raw.ISU_NM || '').toLowerCase().replace(/\s/g, '_'),
    name:          raw.ISU_NM          || '',
    value:         parseFloat(raw.TDD_CLSPRC?.replace(/,/g, '') || 0),
    change:        parseFloat(raw.CMPPREVDD_PRC?.replace(/,/g, '') || 0),
    changePercent: parseFloat(raw.FLUC_RT || 0),
    volume:        raw.ACC_TRDVOL      || '-',
    trend:         raw.FLUC_TP_CD === '2' ? 'up' : raw.FLUC_TP_CD === '5' ? 'down' : 'neutral',
    sparkline:     [],  // KRX는 별도 API로 일중 데이터 조회 필요
    source:        'krx',
    lastUpdated:   new Date().toISOString(),
    isMockData:    false,
  };
}

/**
 * Twelve Data API 응답 → 공통 Index 스키마로 변환
 * @param {object} raw   - Twelve Data /quote 응답
 * @param {string} id    - 내부 식별자 ('sp500', 'nasdaq', ...)
 * @returns {object}
 */
function _normalizeTwelveIndex(raw, id) {
  const close = parseFloat(raw.close || 0);
  const prev  = parseFloat(raw.previous_close || close);
  const chg   = close - prev;
  const chgPct= prev !== 0 ? (chg / prev) * 100 : 0;
  return {
    id,
    name:          raw.name          || id,
    value:         close,
    change:        chg,
    changePercent: chgPct,
    volume:        raw.volume        || '-',
    high:          parseFloat(raw.high  || 0),
    low:           parseFloat(raw.low   || 0),
    open:          parseFloat(raw.open  || 0),
    prevClose:     prev,
    trend:         chg >= 0 ? 'up' : 'down',
    sparkline:     [],
    source:        'twelve_data',
    lastUpdated:   raw.datetime ? new Date(raw.datetime).toISOString() : new Date().toISOString(),
    isMockData:    false,
  };
}

/**
 * Alpha Vantage GLOBAL_QUOTE 응답 → 공통 Index 스키마로 변환
 * @param {object} raw   - Alpha Vantage {'Global Quote': {...}} 내부 객체
 * @param {string} id    - 내부 식별자
 * @param {string} name  - 표시 이름
 * @returns {object}
 */
function _normalizeAlphaIndex(raw, id, name) {
  const price    = parseFloat(raw['05. price'] || 0);
  const chg      = parseFloat(raw['09. change'] || 0);
  const chgPct   = parseFloat((raw['10. change percent'] || '0').replace('%', ''));
  return {
    id,
    name,
    value:         price,
    change:        chg,
    changePercent: chgPct,
    volume:        raw['06. volume'] || '-',
    high:          parseFloat(raw['03. high']  || 0),
    low:           parseFloat(raw['04. low']   || 0),
    open:          parseFloat(raw['02. open']  || 0),
    prevClose:     parseFloat(raw['08. previous close'] || 0),
    trend:         chg >= 0 ? 'up' : 'down',
    sparkline:     [],
    source:        'alpha_vantage',
    lastUpdated:   new Date().toISOString(),
    isMockData:    false,
  };
}

/**
 * BOK ECOS API 환율 응답 → 공통 Index 스키마로 변환
 * @param {object} raw - BOK API 응답 item
 * @returns {object}
 */
function _normalizeBokForex(raw) {
  const val = parseFloat(raw.DATA_VALUE || 0);
  return {
    id:            'usdkrw',
    name:          'USD/KRW',
    value:         val,
    change:        0,        // BOK API는 전일 대비 별도 계산 필요
    changePercent: 0,
    trend:         'neutral',
    currency:      'KRW',
    source:        'bok_ecos',
    lastUpdated:   new Date().toISOString(),
    isMockData:    false,
  };
}

// ══════════════════════════════════════════════════════════════════════
// ① getMarketOverview()
// 시장 전체 센티멘트, 컨디션, 등락종목 비율을 반환합니다.
// ══════════════════════════════════════════════════════════════════════

/**
 * 시장 전체 개요 데이터 가져오기
 *
 * TODO: 실제 연동 후보 API
 *   - KRX: 상하한가/등락종목 수 데이터
 *     GET https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd
 *     bld=dbms/MDC/STAT/standard/MDCSTAT01901
 *   - 공포탐욕지수(미국): https://fear-and-greed-index.p.rapidapi.com (유료 RapidAPI)
 *   - KIS Developers: 국내 시장 현황
 *
 * @returns {Promise<object>}  공통 marketOverview 스키마
 */
async function getMarketOverview() {
  const cacheKey = 'market_overview';
  const cached   = getCache(cacheKey);
  if (cached) return cached;

  const provider = SELECTED_PROVIDERS.marketKr;

  if (provider === 'mock') {
    // mock은 mockData.js의 MOCK_MARKET_OVERVIEW를 사용
    return null;  // null 반환 → mockData.js의 fallback 발동
  }

  try {
    // ── [LIVE API: KRX 시장 현황] ────────────────────────────────────
    // TODO: provider === 'krx' 구현
    // const url = `${getBaseUrl('krx')}?bld=...`;
    // const res = await fetchWithRetry(url, buildFetchOptions('krx'));
    // const json = await res.json();
    // const result = _normalizeKrxOverview(json);
    // ──────────────────────────────────────────────────────────────────

    // ── [LIVE API: KIS Developers 시장 현황] ─────────────────────────
    // TODO: provider === 'kisdev' 구현
    // const url = `${getBaseUrl('kisdev')}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice`;
    // ──────────────────────────────────────────────────────────────────

    throw new Error(`getMarketOverview: provider '${provider}' 미구현`);

  } catch (err) {
    _logApiError('getMarketOverview', provider, err);
    return null;  // fallback
  }
}

// ══════════════════════════════════════════════════════════════════════
// ② getMarketIndices()
// KOSPI, KOSDAQ 등 국내 + WTI·미국채 등 주요 지수를 반환합니다.
// ══════════════════════════════════════════════════════════════════════

/**
 * 시장 지수 배열 가져오기 (국내 + 글로벌 혼합)
 *
 * TODO: 실제 연동 후보 API
 *   ─ 국내 지수 ─
 *   - KRX 업종/지수 데이터:
 *     GET https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd
 *     bld=dbms/MDC/STAT/standard/MDCSTAT00101  (KOSPI)
 *     bld=dbms/MDC/STAT/standard/MDCSTAT00201  (KOSDAQ)
 *
 *   ─ 환율 ─
 *   - 한국은행 ECOS: /StatisticSearch/{key}/json/kr/1/1/036Y001/DD/{date}/{date}/0000001
 *
 *   ─ 미국채 수익률 ─
 *   - FRED: /series/observations?series_id=DGS10&api_key={key}&file_type=json
 *
 *   ─ 원자재 ─
 *   - EIA (WTI): /petroleum/pri/spt?data[]=value&sort[0][column]=period&sort[0][direction]=desc
 *   - Alpha Vantage: function=TIME_SERIES_DAILY&symbol=USO (WTI ETF)
 *
 * @returns {Promise<Array|null>}
 */
async function getMarketIndices() {
  const cacheKey = 'market_indices';
  const cached   = getCache(cacheKey);
  if (cached) return cached;

  const provider = SELECTED_PROVIDERS.marketKr;

  if (provider === 'mock') return null;

  try {
    // ── [LIVE API: KRX 국내 지수] ─────────────────────────────────────
    // TODO: provider === 'krx' 구현
    // const kospiRes  = await fetchWithRetry(KRX_KOSPI_URL,  buildFetchOptions('krx'));
    // const kosdaqRes = await fetchWithRetry(KRX_KOSDAQ_URL, buildFetchOptions('krx'));
    // const kospiData  = _normalizeKrxIndex(await kospiRes.json());
    // const kosdaqData = _normalizeKrxIndex(await kosdaqRes.json());
    // ──────────────────────────────────────────────────────────────────

    // ── [LIVE API: Twelve Data 글로벌 지수] ───────────────────────────
    // TODO: provider === 'twelve_data' 구현
    // const symbols = 'SPX,NDX,N225';   // S&P500, NASDAQ100, Nikkei225
    // const url = `${getBaseUrl('twelve_data')}/quote?symbol=${symbols}&apikey=${getApiKey('twelve_data')}`;
    // const res = await fetchWithRetry(url);
    // const json = await res.json();
    // const globalIndices = Object.entries(json).map(([sym, data]) =>
    //   _normalizeTwelveIndex(data, sym.toLowerCase())
    // );
    // ──────────────────────────────────────────────────────────────────

    // ── [LIVE API: BOK ECOS 환율] ─────────────────────────────────────
    // TODO: provider === 'bok_ecos' 구현 (환율 별도 처리)
    // const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
    // const bokUrl = `${getBaseUrl('bok_ecos')}/StatisticSearch/${getApiKey('bok_ecos')}/json/kr/1/1/036Y001/DD/${today}/${today}/0000001`;
    // const bokRes = await fetchWithRetry(bokUrl);
    // const bokJson = await bokRes.json();
    // const forexData = _normalizeBokForex(bokJson.StatisticSearch?.row?.[0] || {});
    // ──────────────────────────────────────────────────────────────────

    throw new Error(`getMarketIndices: provider '${provider}' 미구현`);

  } catch (err) {
    _logApiError('getMarketIndices', provider, err);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════
// ③ getTickerTape()
// 티커 테이프용: 더 많은 글로벌 지수 + 암호화폐 포함
// ══════════════════════════════════════════════════════════════════════

/**
 * 티커 테이프 데이터 가져오기
 *
 * TODO: 실제 연동 후보 API
 *   - 국내 지수: KRX (위와 동일)
 *   - 해외 지수: Yahoo Finance v8 (비공식, 무료)
 *     GET https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=1d
 *     symbol 예: %5EGSPC(S&P500), %5EIXIC(NASDAQ), N225.T, HSI
 *   - 암호화폐: CoinGecko (무료)
 *     GET https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true
 *   - 금: Alpha Vantage COMMODITY
 *     function=GOLD_PRICE 또는 symbol=GC=F (Yahoo Finance)
 *
 * @returns {Promise<Array|null>}
 */
async function getTickerTape() {
  const cacheKey = 'ticker_tape';
  const cached   = getCache(cacheKey);
  if (cached) return cached;

  const marketProvider = SELECTED_PROVIDERS.marketGlobal;
  const cryptoProvider = SELECTED_PROVIDERS.crypto;

  if (marketProvider === 'mock' && cryptoProvider === 'mock') return null;

  try {
    const results = [];

    // ── [LIVE API: Yahoo Finance 해외 지수] ───────────────────────────
    // TODO: marketProvider === 'yahoo_finance' 구현
    // const symbols = ['^GSPC', '^IXIC', '^N225', '^HSI'];
    // for (const sym of symbols) {
    //   const url = `${getBaseUrl('yahoo_finance')}/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;
    //   const res  = await fetchWithRetry(url);
    //   const json = await res.json();
    //   results.push(_normalizeYahooIndex(json, sym));
    // }
    // ──────────────────────────────────────────────────────────────────

    // ── [LIVE API: CoinGecko 암호화폐] ────────────────────────────────
    // TODO: cryptoProvider === 'coingecko' 구현
    // const coingeckoUrl = `${getBaseUrl('coingecko')}/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true`;
    // const coinRes  = await fetchWithRetry(coingeckoUrl);
    // const coinJson = await coinRes.json();
    // results.push({
    //   id: 'btc', name: 'BTC/USD',
    //   value: coinJson.bitcoin.usd,
    //   changePercent: coinJson.bitcoin.usd_24h_change,
    //   trend: coinJson.bitcoin.usd_24h_change >= 0 ? 'up' : 'down',
    //   source: 'coingecko', lastUpdated: new Date().toISOString(), isMockData: false,
    // });
    // ──────────────────────────────────────────────────────────────────

    if (results.length === 0) throw new Error('getTickerTape: 유효한 데이터 없음');

    setCache(cacheKey, results);
    return results;

  } catch (err) {
    _logApiError('getTickerTape', `${marketProvider}+${cryptoProvider}`, err);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════
// ④ getInvestorFlows()
// 외국인/기관/개인 수급 데이터
// ══════════════════════════════════════════════════════════════════════

/**
 * 투자자별 수급 데이터 가져오기
 *
 * TODO: 실제 연동 후보 API
 *   - KRX 투자자별 순매매: 
 *     GET https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd
 *     bld=dbms/MDC/STAT/standard/MDCSTAT02203
 *     (파라미터: trdDd=오늘날짜, mktId=STK/KSQ)
 *   - KOSCOM API (유료): 실시간 수급 데이터
 *   - KIS Developers:
 *     GET /uapi/domestic-stock/v1/quotations/inquire-investor (투자자 동향)
 *
 * @returns {Promise<object|null>}
 */
async function getInvestorFlows() {
  const cacheKey = 'investor_flows';
  const cached   = getCache(cacheKey);
  if (cached) return cached;

  const provider = SELECTED_PROVIDERS.marketKr;
  if (provider === 'mock') return null;

  try {
    // ── [LIVE API: KRX 투자자별 순매매] ──────────────────────────────
    // TODO: provider === 'krx' 구현
    // const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
    // const url = `${getBaseUrl('krx')}?bld=dbms/MDC/STAT/standard/MDCSTAT02203&trdDd=${today}&mktId=STK`;
    // const res = await fetchWithRetry(url, buildFetchOptions('krx'));
    // const json = await res.json();
    // const result = _normalizeKrxInvestorFlows(json);
    // setCache(cacheKey, result);
    // return result;
    // ──────────────────────────────────────────────────────────────────

    throw new Error(`getInvestorFlows: provider '${provider}' 미구현`);

  } catch (err) {
    _logApiError('getInvestorFlows', provider, err);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════
// ⑤ getSectorTrends()
// 섹터별 등락률, 수급, 키드라이버
// ══════════════════════════════════════════════════════════════════════

/**
 * 섹터 트렌드 데이터 가져오기
 *
 * TODO: 실제 연동 후보 API
 *   - KRX 업종 시세:
 *     GET https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd
 *     bld=dbms/MDC/STAT/standard/MDCSTAT03901  (업종시세)
 *   - FnGuide 섹터 분류 API (유료)
 *   - Wisefn API (유료)
 *   - KIS Developers: 업종별 현재가
 *     GET /uapi/domestic-stock/v1/quotations/inquire-price-by-group
 *
 * @returns {Promise<Array|null>}
 */
async function getSectorTrends() {
  const cacheKey = 'sector_trends';
  const cached   = getCache(cacheKey);
  if (cached) return cached;

  const provider = SELECTED_PROVIDERS.marketKr;
  if (provider === 'mock') return null;

  try {
    // ── [LIVE API: KRX 업종 시세] ─────────────────────────────────────
    // TODO: provider === 'krx' 구현
    // const url = `${getBaseUrl('krx')}?bld=dbms/MDC/STAT/standard/MDCSTAT03901&...`;
    // const res  = await fetchWithRetry(url, buildFetchOptions('krx'));
    // const json = await res.json();
    // const result = json.OutBlock_1?.map(_normalizeKrxSector) || [];
    // setCache(cacheKey, result);
    // return result;
    // ──────────────────────────────────────────────────────────────────

    throw new Error(`getSectorTrends: provider '${provider}' 미구현`);

  } catch (err) {
    _logApiError('getSectorTrends', provider, err);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════
// 내부 에러 로거
// ══════════════════════════════════════════════════════════════════════

function _logApiError(fnName, provider, err) {
  // mock provider가 아닌 경우만 경고 출력
  if (provider !== 'mock') {
    console.warn(`[MarketApi] ${fnName} (${provider}) 실패 → mock fallback:`, err.message);
  }
}
