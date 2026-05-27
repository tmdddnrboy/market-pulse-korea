/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║         Market Pulse Korea — API Configuration                      ║
 * ║                                                                      ║
 * ║  모든 외부 API의 provider, baseURL, 키 로딩 위치를 관리합니다.      ║
 * ║                                                                      ║
 * ║  실제 API 연동 시:                                                   ║
 * ║    1. .env.example → .env 로 복사                                    ║
 * ║    2. 각 환경변수에 실제 API 키 입력                                 ║
 * ║    3. PROVIDERS 객체에서 사용할 provider로 변경                      ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * ⚠️  API 키를 이 파일에 직접 하드코딩하지 마세요.
 *     모든 키는 환경변수(.env)에서만 로드합니다.
 *
 * 환경변수 로드 방식:
 *   - Vite 환경: import.meta.env.VITE_XXX
 *   - 브라우저 순수 JS (현재): window.__ENV__ 또는 빌드 시 인라인
 *   - Node.js 서버 사이드: process.env.XXX
 */

'use strict';

// ══════════════════════════════════════════════════════════════════════
// 환경변수 로더
// 빌드 도구(Vite/Webpack) 없이 순수 브라우저에서도 동작하도록
// window.__ENV__ 주입 방식을 fallback으로 사용합니다.
// ══════════════════════════════════════════════════════════════════════

/**
 * 환경변수 읽기 헬퍼
 * 우선순위: import.meta.env (Vite) → window.__ENV__ → 기본값
 *
 * @param {string} key   - 환경변수 이름 (VITE_ 접두사 포함)
 * @param {string} fallback - 환경변수가 없을 때 기본값
 * @returns {string}
 */
function getEnv(key, fallback = '') {
  // Vite 빌드 환경
  if (typeof import_meta_env !== 'undefined') {
    return import_meta_env[key] || fallback;
  }
  // window.__ENV__ 주입 방식 (index.html에서 <script>window.__ENV__={...}</script> 형태)
  if (typeof window !== 'undefined' && window.__ENV__ && window.__ENV__[key]) {
    return window.__ENV__[key];
  }
  return fallback;
}

// ══════════════════════════════════════════════════════════════════════
// PROVIDER 목록
// 각 도메인별로 사용 가능한 API provider를 나열합니다.
// SELECTED_PROVIDERS 에서 실제 사용할 provider를 설정하세요.
// ══════════════════════════════════════════════════════════════════════

const API_PROVIDERS = {

  // ─── 시장 지수 (국내) ───────────────────────────────────────────────
  MARKET_KR: {
    KRX:        'krx',           // KRX 정보데이터시스템 (무료, 회원가입)
    FNGUIDE:    'fnguide',       // FnGuide API (유료)
    WISEFN:     'wisefn',        // Wisefn (유료)
    KISDEV:     'kisdev',        // 한국투자증권 KIS Developers (무료)
    MOCK:       'mock',
  },

  // ─── 시장 지수 (해외) ───────────────────────────────────────────────
  MARKET_GLOBAL: {
    YAHOO:      'yahoo_finance', // Yahoo Finance v8 (비공식, 무료)
    TWELVE:     'twelve_data',   // Twelve Data (무료 플랜: 800req/day)
    ALPHA:      'alpha_vantage', // Alpha Vantage (무료 플랜: 25req/day)
    POLYGON:    'polygon_io',    // Polygon.io (유료)
    MOCK:       'mock',
  },

  // ─── 환율 ─────────────────────────────────────────────────────────
  FOREX: {
    BOK:        'bok_ecos',      // 한국은행 ECOS API (무료)
    EXCHANGERATE: 'exchangerate_api', // ExchangeRate-API (무료 플랜)
    ALPHA:      'alpha_vantage',
    MOCK:       'mock',
  },

  // ─── 원자재 ───────────────────────────────────────────────────────
  COMMODITY: {
    EIA:        'eia',           // EIA (미국 에너지정보청, 무료)
    CME:        'cme',           // CME DataMine (유료)
    ALPHA:      'alpha_vantage',
    MOCK:       'mock',
  },

  // ─── 암호화폐 ─────────────────────────────────────────────────────
  CRYPTO: {
    COINGECKO:  'coingecko',     // CoinGecko API (무료 플랜: 30req/min)
    BINANCE:    'binance',       // Binance API (무료)
    MOCK:       'mock',
  },

  // ─── 종목 시세 (한국) ─────────────────────────────────────────────
  STOCK_KR: {
    KRX:        'krx',
    KISDEV:     'kisdev',        // KIS Developers (무료, OAuth)
    EBEST:      'ebest',         // eBest 투자증권 Open API
    KIWOOM:     'kiwoom',        // 키움증권 Open API (Windows 환경)
    FNGUIDE:    'fnguide',
    MOCK:       'mock',
  },

  // ─── 종목 시세 (미국) ─────────────────────────────────────────────
  STOCK_US: {
    YAHOO:      'yahoo_finance',
    POLYGON:    'polygon_io',
    ALPHA:      'alpha_vantage',
    TWELVE:     'twelve_data',
    MOCK:       'mock',
  },

  // ─── 뉴스 ─────────────────────────────────────────────────────────
  NEWS: {
    NAVER:      'naver_news',    // 네이버 뉴스 검색 API (무료, 하루 25,000건)
    NEWSAPI:    'newsapi_org',   // NewsAPI.org (무료 플랜: 100req/day)
    GNEWS:      'gnews',         // GNews API (무료 플랜: 100req/day)
    BING_NEWS:  'bing_news',     // Bing News Search (Azure, 유료)
    RSS:        'rss_parser',    // RSS 직접 파싱 (연합뉴스, 한국경제 등)
    MOCK:       'mock',
  },

  // ─── AI 요약 ──────────────────────────────────────────────────────
  AI: {
    OPENAI:     'openai',        // OpenAI GPT-4o (유료)
    ANTHROPIC:  'anthropic',     // Anthropic Claude 3.7 Sonnet (유료)
    GEMINI:     'google_gemini', // Google Gemini 1.5 Pro (유료)
    UPSTAGE:    'upstage',       // Upstage Solar (한국어 특화, 유료)
    MOCK:       'mock',
  },

  // ─── 경제지표 일정 ────────────────────────────────────────────────
  ECONOMIC_CALENDAR: {
    ALPHA:      'alpha_vantage', // Economic Calendar endpoint (무료)
    TWELVE:     'twelve_data',   // Economic Calendar (무료 플랜)
    INVESTING:  'investing_com', // Investing.com (서드파티 스크래핑)
    FRED:       'fred',          // FRED (St. Louis Fed, 무료)
    BOK:        'bok_ecos',      // 한국은행 (국내 지표)
    MOCK:       'mock',
  },

  // ─── 실적 캘린더 ──────────────────────────────────────────────────
  EARNINGS: {
    ALPHA:      'alpha_vantage',
    POLYGON:    'polygon_io',
    TWELVE:     'twelve_data',
    MOCK:       'mock',
  },
};

// ══════════════════════════════════════════════════════════════════════
// 현재 선택된 Provider
// 실제 API를 붙일 때 아래 값을 변경하세요.
// 'mock' → 실제 provider 이름으로 교체
// ══════════════════════════════════════════════════════════════════════

const SELECTED_PROVIDERS = {
  marketKr:          API_PROVIDERS.MARKET_KR.MOCK,
  marketGlobal:      API_PROVIDERS.MARKET_GLOBAL.MOCK,
  forex:             API_PROVIDERS.FOREX.MOCK,
  commodity:         API_PROVIDERS.COMMODITY.MOCK,
  crypto:            API_PROVIDERS.CRYPTO.MOCK,
  stockKr:           API_PROVIDERS.STOCK_KR.MOCK,
  stockUs:           API_PROVIDERS.STOCK_US.MOCK,
  news:              API_PROVIDERS.NEWS.MOCK,
  ai:                API_PROVIDERS.AI.MOCK,
  economicCalendar:  API_PROVIDERS.ECONOMIC_CALENDAR.MOCK,
  earnings:          API_PROVIDERS.EARNINGS.MOCK,
};

// ══════════════════════════════════════════════════════════════════════
// API Base URLs
// ══════════════════════════════════════════════════════════════════════

const API_BASE_URLS = {
  // 한국 시장
  krx:              'https://data.krx.co.kr/comm/bldAttendant/executeForResourceBundle.cmd',
  kisdev:           'https://openapi.koreainvestment.com:9443',
  fnguide:          'https://api.fnguide.com',                    // 유료, 별도 계약 필요
  ebest:            'https://openapi.ebestsec.co.kr:8080',

  // 글로벌 시장
  yahoo_finance:    'https://query1.finance.yahoo.com/v8/finance',
  twelve_data:      'https://api.twelvedata.com',
  alpha_vantage:    'https://www.alphavantage.co/query',
  polygon_io:       'https://api.polygon.io/v2',

  // 환율
  bok_ecos:         'https://ecos.bok.or.kr/api',
  exchangerate_api: 'https://v6.exchangerate-api.com/v6',

  // 원자재
  eia:              'https://api.eia.gov/v2',

  // 암호화폐
  coingecko:        'https://api.coingecko.com/api/v3',
  binance:          'https://api.binance.com/api/v3',

  // 뉴스
  naver_news:       'https://openapi.naver.com/v1/search/news.json',
  newsapi_org:      'https://newsapi.org/v2',
  gnews:            'https://gnews.io/api/v4',

  // AI
  openai:           'https://api.openai.com/v1',
  anthropic:        'https://api.anthropic.com/v1',
  google_gemini:    'https://generativelanguage.googleapis.com/v1beta',
  upstage:          'https://api.upstage.ai/v1/solar',

  // 경제지표
  fred:             'https://api.stlouisfed.org/fred',
};

// ══════════════════════════════════════════════════════════════════════
// API 키 로딩
// 환경변수에서 읽어옵니다. 절대 하드코딩하지 마세요.
// ══════════════════════════════════════════════════════════════════════

const API_KEYS = {
  // 한국 시장
  krx:          getEnv('VITE_KRX_API_KEY'),
  kisdev_appkey:  getEnv('VITE_KISDEV_APP_KEY'),
  kisdev_secret:  getEnv('VITE_KISDEV_APP_SECRET'),
  fnguide:      getEnv('VITE_FNGUIDE_API_KEY'),
  ebest:        getEnv('VITE_EBEST_APP_KEY'),

  // 글로벌 시장
  twelve_data:  getEnv('VITE_TWELVE_DATA_API_KEY'),
  alpha_vantage:getEnv('VITE_ALPHA_VANTAGE_API_KEY'),
  polygon:      getEnv('VITE_POLYGON_API_KEY'),

  // 환율
  bok_ecos:     getEnv('VITE_BOK_API_KEY'),
  exchangerate: getEnv('VITE_EXCHANGERATE_API_KEY'),

  // 원자재
  eia:          getEnv('VITE_EIA_API_KEY'),

  // 암호화폐 (CoinGecko 무료 플랜은 키 불필요)
  coingecko:    getEnv('VITE_COINGECKO_API_KEY'),

  // 뉴스
  naver_client_id:     getEnv('VITE_NAVER_CLIENT_ID'),
  naver_client_secret: getEnv('VITE_NAVER_CLIENT_SECRET'),
  newsapi:      getEnv('VITE_NEWS_API_KEY'),
  gnews:        getEnv('VITE_GNEWS_API_KEY'),

  // AI
  openai:       getEnv('VITE_OPENAI_API_KEY'),
  anthropic:    getEnv('VITE_ANTHROPIC_API_KEY'),
  gemini:       getEnv('VITE_GEMINI_API_KEY'),
  upstage:      getEnv('VITE_UPSTAGE_API_KEY'),

  // 경제지표
  fred:         getEnv('VITE_FRED_API_KEY'),
};

// ══════════════════════════════════════════════════════════════════════
// 요청 설정 (타임아웃, 재시도, Rate Limit 등)
// ══════════════════════════════════════════════════════════════════════

const REQUEST_CONFIG = {
  timeout:        8000,    // ms — API 요청 타임아웃
  retryCount:     2,       // 실패 시 재시도 횟수
  retryDelay:     1000,    // ms — 재시도 간격
  cacheEnabled:   true,    // 응답 캐시 활성화
  cacheTTL:       300,     // seconds — 캐시 유효시간 (5분)
};

// ══════════════════════════════════════════════════════════════════════
// AI 모델 설정
// ══════════════════════════════════════════════════════════════════════

const AI_CONFIG = {
  // OpenAI
  openai: {
    model:          'gpt-4o',
    maxTokens:      1024,
    temperature:    0.3,   // 낮을수록 일관된 분석
    systemPrompt:   `당신은 한국 주식시장 전문 분석가입니다. 
주어진 데이터를 바탕으로 한국 개인 투자자에게 유용한 시장 인사이트를 제공하세요.
특정 종목의 매수/매도를 추천하지 마세요. 투자 참고 정보만 제공하세요.
응답은 반드시 JSON 형식으로 반환하세요.`,
  },

  // Anthropic
  anthropic: {
    model:          'claude-3-7-sonnet-20250219',
    maxTokens:      1024,
    temperature:    0.3,
  },

  // Google Gemini
  gemini: {
    model:          'gemini-1.5-pro',
    maxTokens:      1024,
    temperature:    0.3,
  },

  // Upstage Solar (한국어 특화)
  upstage: {
    model:          'solar-1-mini-chat',
    maxTokens:      1024,
    temperature:    0.3,
  },
};

// ══════════════════════════════════════════════════════════════════════
// 공개 설정 헬퍼 함수
// ══════════════════════════════════════════════════════════════════════

/**
 * 특정 도메인의 현재 provider가 mock인지 확인
 * @param {string} domain - 'marketKr' | 'news' | 'ai' 등
 * @returns {boolean}
 */
function isMockProvider(domain) {
  return SELECTED_PROVIDERS[domain] === 'mock';
}

/**
 * 모든 provider가 mock인지 확인 (전체 mock 모드)
 * @returns {boolean}
 */
function isFullMockMode() {
  return Object.values(SELECTED_PROVIDERS).every(p => p === 'mock');
}

/**
 * provider 이름으로 base URL 가져오기
 * @param {string} provider
 * @returns {string}
 */
function getBaseUrl(provider) {
  return API_BASE_URLS[provider] || '';
}

/**
 * provider 이름으로 API 키 가져오기
 * @param {string} provider
 * @returns {string}
 */
function getApiKey(provider) {
  return API_KEYS[provider] || '';
}

/**
 * fetch 요청 공통 옵션 생성
 * @param {string} provider
 * @param {object} extraHeaders
 * @returns {RequestInit}
 */
function buildFetchOptions(provider, extraHeaders = {}) {
  const headers = { 'Content-Type': 'application/json', ...extraHeaders };

  // Provider별 인증 헤더 주입
  switch (provider) {
    case 'openai':
      headers['Authorization'] = `Bearer ${API_KEYS.openai}`;
      break;
    case 'anthropic':
      headers['x-api-key']            = API_KEYS.anthropic;
      headers['anthropic-version']    = '2023-06-01';
      break;
    case 'google_gemini':
      // Gemini는 URL 파라미터로 키 전달 (헤더 불필요)
      break;
    case 'naver_news':
      headers['X-Naver-Client-Id']     = API_KEYS.naver_client_id;
      headers['X-Naver-Client-Secret'] = API_KEYS.naver_client_secret;
      break;
    case 'newsapi_org':
      headers['X-Api-Key'] = API_KEYS.newsapi;
      break;
    case 'kisdev':
      headers['appkey']    = API_KEYS.kisdev_appkey;
      headers['appsecret'] = API_KEYS.kisdev_secret;
      break;
    default:
      break;
  }

  return {
    headers,
    signal: AbortSignal.timeout(REQUEST_CONFIG.timeout),
  };
}

/**
 * 재시도 로직이 포함된 fetch 래퍼
 * @param {string}      url
 * @param {RequestInit} options
 * @param {number}      retries
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options = {}, retries = REQUEST_CONFIG.retryCount) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      // Rate limit (429) 또는 서버 오류 (5xx) 시 재시도
      if ((res.status === 429 || res.status >= 500) && retries > 0) {
        console.warn(`[ApiConfig] HTTP ${res.status} — ${retries}회 재시도 남음`);
        await sleep(REQUEST_CONFIG.retryDelay);
        return fetchWithRetry(url, options, retries - 1);
      }
      throw new ApiError(`HTTP ${res.status}: ${res.statusText}`, res.status);
    }
    return res;
  } catch (err) {
    if (retries > 0 && !(err instanceof ApiError && err.status < 500)) {
      console.warn(`[ApiConfig] 요청 실패 — ${retries}회 재시도 남음:`, err.message);
      await sleep(REQUEST_CONFIG.retryDelay);
      return fetchWithRetry(url, options, retries - 1);
    }
    throw err;
  }
}

// ══════════════════════════════════════════════════════════════════════
// 인메모리 캐시
// ══════════════════════════════════════════════════════════════════════

const _cache = new Map();

/**
 * 캐시에서 데이터 읽기
 * @param {string} key
 * @returns {*|null}
 */
function getCache(key) {
  if (!REQUEST_CONFIG.cacheEnabled) return null;
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > REQUEST_CONFIG.cacheTTL * 1000) {
    _cache.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * 캐시에 데이터 저장
 * @param {string} key
 * @param {*}      data
 */
function setCache(key, data) {
  if (!REQUEST_CONFIG.cacheEnabled) return;
  _cache.set(key, { data, timestamp: Date.now() });
}

/** 캐시 전체 초기화 */
function clearCache() {
  _cache.clear();
}

// ══════════════════════════════════════════════════════════════════════
// 커스텀 에러 클래스
// ══════════════════════════════════════════════════════════════════════

class ApiError extends Error {
  constructor(message, status = 0, provider = '') {
    super(message);
    this.name     = 'ApiError';
    this.status   = status;
    this.provider = provider;
  }
}

class RateLimitError extends ApiError {
  constructor(provider, retryAfter = 60) {
    super(`Rate limit exceeded for ${provider}`, 429, provider);
    this.name       = 'RateLimitError';
    this.retryAfter = retryAfter; // seconds
  }
}

class EmptyResponseError extends ApiError {
  constructor(provider) {
    super(`Empty or invalid response from ${provider}`, 0, provider);
    this.name = 'EmptyResponseError';
  }
}

// ══════════════════════════════════════════════════════════════════════
// 유틸리티
// ══════════════════════════════════════════════════════════════════════

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 응답 데이터가 비어있는지 검사
 * @param {*} data
 * @returns {boolean}
 */
function isEmptyResponse(data) {
  if (data === null || data === undefined) return true;
  if (Array.isArray(data) && data.length === 0) return true;
  if (typeof data === 'object' && Object.keys(data).length === 0) return true;
  return false;
}

// ══════════════════════════════════════════════════════════════════════
// 현재 API 설정 상태 출력 (개발용)
// ══════════════════════════════════════════════════════════════════════

function logApiStatus() {
  const isMock = isFullMockMode();
  const style  = isMock
    ? 'color:#fbbf24;font-weight:bold'
    : 'color:#34d399;font-weight:bold';

  console.group('%c[Market Pulse] API Config Status', style);
  console.log('Mode:', isMock ? '🟡 FULL MOCK' : '🟢 LIVE API');
  Object.entries(SELECTED_PROVIDERS).forEach(([domain, provider]) => {
    const isMockPvd = provider === 'mock';
    console.log(
      `  ${isMockPvd ? '🟡' : '🟢'} ${domain.padEnd(20)} → ${provider}`
    );
  });
  console.groupEnd();
}

// 페이지 로드 시 상태 출력
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', logApiStatus);
}
