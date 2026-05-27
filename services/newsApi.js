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
 * ║         Market Pulse Korea — News API Service                       ║
 * ║                                                                      ║
 * ║  담당 도메인:                                                        ║
 * ║    - 최신 시장 뉴스 수집 (국내/해외)                                ║
 * ║    - 섹터별 뉴스 필터링                                             ║
 * ║    - 종목 관련 뉴스 검색                                            ║
 * ║    - 뉴스 감성 분석 (긍정/중립/부정)                               ║
 * ║                                                                      ║
 * ║  지원 Provider:                                                      ║
 * ║    - naver_news   : 네이버 뉴스 검색 API (한국어, 무료)             ║
 * ║    - newsapi_org  : NewsAPI.org (영문, 무료 100req/day)             ║
 * ║    - gnews        : GNews API (다국어, 무료 100req/day)             ║
 * ║    - rss_parser   : RSS 직접 파싱 (연합뉴스, 한국경제, 매일경제)   ║
 * ║    - mock         : 목 데이터 (기본값)                              ║
 * ║                                                                      ║
 * ║  실제 API 연동 위치: 각 함수 내부 // ── [LIVE API] ── 블록          ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * 의존성 로드 순서 (index.html):
 *   config/apiConfig.js  →  services/newsApi.js  →  data/mockData.js
 *
 * 공통 newsInsight 스키마:
 * {
 *   id:           string,      // 고유 식별자
 *   headline:     string,      // 뉴스 제목
 *   summary:      string,      // 요약 (2~3문장)
 *   insight:      string,      // AI 생성 투자 인사이트 (없으면 summary 재사용)
 *   source:       string,      // 출처 매체
 *   sourceUrl:    string,      // 원문 URL
 *   publishedAt:  string,      // ISO 8601 (예: '2025-05-26T09:30:00+09:00')
 *   category:     string,      // 'macro'|'earnings'|'sector'|'fed'|'global'|'crypto'|...
 *   sentiment:    string,      // 'positive'|'neutral'|'negative'
 *   impact:       string,      // 'high'|'medium'|'low'
 *   relatedTickers: string[],  // 관련 종목 코드 ['005930', '000660', ...]
 *   isMockData:   boolean,
 * }
 */

'use strict';

// ══════════════════════════════════════════════════════════════════════
// 카테고리 → CSS 클래스 매핑
// dashboard.js 렌더러에서 배지 색상으로 사용합니다.
// ══════════════════════════════════════════════════════════════════════

const NEWS_CATEGORY_COLOR_MAP = {
  macro:     'badge-macro',       // 거시경제
  earnings:  'badge-earnings',    // 실적/어닝
  sector:    'badge-sector',      // 섹터 이슈
  fed:       'badge-fed',         // 연준/통화정책
  global:    'badge-global',      // 글로벌 이슈
  crypto:    'badge-crypto',      // 암호화폐
  ipo:       'badge-ipo',         // IPO/공모
  dividend:  'badge-dividend',    // 배당
  policy:    'badge-policy',      // 정책/규제
  default:   'badge-default',     // 기타
};

/**
 * 뉴스 카테고리에 해당하는 CSS 클래스 반환
 * @param {string} category
 * @returns {string}
 */
function getNewsCategoryClass(category) {
  return NEWS_CATEGORY_COLOR_MAP[category] || NEWS_CATEGORY_COLOR_MAP.default;
}

// ══════════════════════════════════════════════════════════════════════
// 섹터 → 검색 키워드 매핑
// getNewsBySector() 에서 섹터명을 뉴스 검색어로 변환할 때 사용합니다.
// ══════════════════════════════════════════════════════════════════════

const SECTOR_KEYWORD_MAP = {
  semiconductor: ['반도체', 'HBM', 'DRAM', 'NAND', '삼성전자', 'SK하이닉스', '엔비디아'],
  bio:           ['바이오', '셀트리온', '삼성바이오', '제약', 'FDA', '임상'],
  auto:          ['현대차', '기아', '자동차', '전기차', 'EV', '배터리'],
  battery:       ['배터리', 'LG에너지솔루션', '삼성SDI', 'LGES', '리튬', '양극재'],
  internet:      ['네이버', '카카오', '플랫폼', '인터넷', 'IT'],
  finance:       ['금융', '은행', '증권', '보험', '금리', '대출'],
  energy:        ['에너지', '석유', '정유', '한국전력', 'WTI', '유가'],
  defense:       ['방산', '한화에어로스페이스', 'LIG넥스원', '방위산업', '무기'],
  healthcare:    ['헬스케어', '의료기기', '병원', '진단'],
};

/**
 * 섹터명으로 검색 키워드 배열 반환
 * @param {string} sector
 * @returns {string[]}
 */
function _getSectorKeywords(sector) {
  return SECTOR_KEYWORD_MAP[sector] || [sector];
}

// ══════════════════════════════════════════════════════════════════════
// 내부 유틸: 응답 정규화
// 각 provider 응답 포맷을 공통 newsInsight 스키마로 변환합니다.
// ══════════════════════════════════════════════════════════════════════

/**
 * 네이버 뉴스 검색 API 응답 → 공통 newsInsight 스키마 변환
 *
 * 네이버 뉴스 응답 예시 (items[]):
 * {
 *   title:       '&lt;b&gt;삼성전자&lt;/b&gt; HBM 수주...',   // HTML 엔티티 포함
 *   originallink: 'https://...',
 *   link:         'https://n.news.naver.com/...',
 *   description:  '...',
 *   pubDate:      'Mon, 26 May 2025 09:30:00 +0900',
 * }
 *
 * ⚠️  네이버 뉴스 API 사용 전 주의사항:
 *   - 네이버 클라우드 플랫폼(https://developers.naver.com) 앱 등록 필요
 *   - 검색 API는 서버사이드에서만 호출 가능 (CORS 미지원)
 *   - 순수 정적 사이트에서는 CORS 프록시 서버 또는 서버리스 함수 경유 필요
 *   - 일일 25,000건 무료 제공
 *
 * @param {object} raw       - 네이버 뉴스 API items[] 단일 항목
 * @param {number} idx       - 배열 인덱스 (id 생성용)
 * @returns {object}         - 공통 newsInsight 스키마
 */
function _normalizeNaverNews(raw, idx) {
  // HTML 엔티티 및 태그 제거
  const decodeHtml = (str = '') =>
    str
      .replace(/<\/?b>/gi, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .trim();

  const title = decodeHtml(raw.title);

  // 카테고리 추론 (제목/설명 키워드 기반)
  const fullText = `${title} ${raw.description || ''}`;
  const category = _inferCategoryFromText(fullText);

  // 감성 분석 (단순 키워드 기반, 실제 연동 시 AI 대체)
  const sentiment = _inferSentimentFromText(fullText);

  return {
    id:             `naver_${idx}_${Date.now()}`,
    headline:       title,
    summary:        decodeHtml(raw.description || title),
    insight:        null,  // AI 인사이트는 aiSummaryApi.js에서 별도 생성
    source:         _extractNaverSource(raw.originallink || raw.link),
    sourceUrl:      raw.originallink || raw.link || '',
    publishedAt:    raw.pubDate ? new Date(raw.pubDate).toISOString() : new Date().toISOString(),
    category,
    sentiment,
    impact:         sentiment === 'negative' ? 'high' : 'medium',
    relatedTickers: _extractRelatedTickers(fullText),
    isMockData:     false,
  };
}

/**
 * NewsAPI.org 응답 → 공통 newsInsight 스키마 변환
 *
 * NewsAPI.org 응답 예시 (articles[]):
 * {
 *   title:       'Samsung Electronics...',
 *   description: '...',
 *   url:         'https://...',
 *   urlToImage:  'https://...',
 *   publishedAt: '2025-05-26T00:30:00Z',
 *   source:      { id: 'reuters', name: 'Reuters' },
 *   content:     '... [+2000 chars]',  // 무료 플랜은 200자 제한
 * }
 *
 * ⚠️  NewsAPI.org 사용 전 주의사항:
 *   - https://newsapi.org 에서 API 키 발급 (무료: 100req/day)
 *   - 브라우저에서 직접 호출 불가 (정적 사이트 → CORS 프록시 필요)
 *   - 무료 플랜: 헤드라인만, 1달 이전 기사 조회 불가
 *   - .env: VITE_NEWS_API_KEY=your_newsapi_key
 *
 * @param {object} raw   - NewsAPI.org articles[] 단일 항목
 * @param {number} idx   - 배열 인덱스 (id 생성용)
 * @returns {object}
 */
function _normalizeNewsApiOrg(raw, idx) {
  const fullText  = `${raw.title || ''} ${raw.description || ''}`;
  const category  = _inferCategoryFromText(fullText);
  const sentiment = _inferSentimentFromText(fullText);

  return {
    id:             `newsapi_${idx}_${Date.now()}`,
    headline:       raw.title     || '',
    summary:        raw.description || raw.title || '',
    insight:        null,
    source:         raw.source?.name || 'NewsAPI',
    sourceUrl:      raw.url || '',
    publishedAt:    raw.publishedAt || new Date().toISOString(),
    category,
    sentiment,
    impact:         sentiment === 'negative' ? 'high' : 'medium',
    relatedTickers: _extractRelatedTickers(fullText),
    isMockData:     false,
  };
}

/**
 * GNews API 응답 → 공통 newsInsight 스키마 변환
 *
 * GNews API 응답 예시 (articles[]):
 * {
 *   title:       '...',
 *   description: '...',
 *   content:     '...',
 *   url:         'https://...',
 *   image:       'https://...',
 *   publishedAt: '2025-05-26T00:30:00Z',
 *   source:      { name: 'Yonhap', url: 'https://...' },
 * }
 *
 * ⚠️  GNews API 사용 전 주의사항:
 *   - https://gnews.io 에서 API 키 발급 (무료: 100req/day, 10건/요청)
 *   - ⚠️  Node.js 서버/CI 환경에서만 호출할 것 (API 키 노출 방지)
 *   - 한국어 뉴스: lang=ko 파라미터 사용
 *   - .env: VITE_GNEWS_API_KEY=your_gnews_key
 *
 * @param {object} raw   - GNews API articles[] 단일 항목
 * @param {number} idx   - 배열 인덱스 (id 생성용)
 * @returns {object}
 */
function _normalizeGNews(raw, idx) {
  const fullText  = `${raw.title || ''} ${raw.description || ''}`;
  const category  = _inferCategoryFromText(fullText);
  const sentiment = _inferSentimentFromText(fullText);

  return {
    id:             `gnews_${idx}_${Date.now()}`,
    headline:       raw.title       || '',
    summary:        raw.description || raw.title || '',
    insight:        null,
    source:         raw.source?.name || 'GNews',
    sourceUrl:      raw.url || '',
    publishedAt:    raw.publishedAt || new Date().toISOString(),
    category,
    sentiment,
    impact:         sentiment === 'negative' ? 'high' : 'medium',
    relatedTickers: _extractRelatedTickers(fullText),
    isMockData:     false,
  };
}

// ══════════════════════════════════════════════════════════════════════
// 내부 헬퍼: 텍스트 분석
// ══════════════════════════════════════════════════════════════════════

/**
 * 텍스트에서 카테고리 추론 (키워드 매칭 기반)
 * 실제 연동 시 AI 분류 API로 대체 권장
 * @param {string} text
 * @returns {string}
 */
function _inferCategoryFromText(text) {
  const t = text.toLowerCase();

  if (/fomc|연준|fed |금리인상|금리인하|jerome powell|파월|통화정책/.test(t)) return 'fed';
  if (/어닝|실적|매출|영업이익|순이익|어닝서프라이즈|어닝쇼크|roe|eps/.test(t)) return 'earnings';
  if (/비트코인|이더리움|crypto|암호화폐|코인|btc|eth/.test(t)) return 'crypto';
  if (/ipo|공모|상장|코스피|코스닥 입성|기업공개/.test(t)) return 'ipo';
  if (/배당|배당금|dividend|주주환원/.test(t)) return 'dividend';
  if (/규제|정책|법안|금감원|금융당국|공정위/.test(t)) return 'policy';
  if (/반도체|hbm|dram|nand|nvda|엔비디아|tsmc/.test(t)) return 'sector';
  if (/gdp|cpi|pce|인플레이션|고용|실업률|무역수지|경상수지/.test(t)) return 'macro';
  if (/중국|미국|유럽|일본|글로벌|무역전쟁|관세/.test(t)) return 'global';
  return 'macro';
}

/**
 * 텍스트에서 감성 추론 (키워드 매칭 기반)
 * 실제 연동 시 AI 감성 분석 API로 대체 권장
 * @param {string} text
 * @returns {'positive'|'neutral'|'negative'}
 */
function _inferSentimentFromText(text) {
  const t = text.toLowerCase();

  const positiveKeywords = [
    '상승', '호재', '급등', '서프라이즈', '기대', '반등', '순매수', '최고',
    '성장', '수주', '호실적', '낙관', 'beat', 'surge', 'rally', 'strong',
  ];
  const negativeKeywords = [
    '하락', '악재', '급락', '쇼크', '우려', '하향', '순매도', '최저',
    '위기', '충격', '부진', '비관', 'miss', 'fall', 'drop', 'weak', '손실',
  ];

  const posScore = positiveKeywords.filter(kw => t.includes(kw)).length;
  const negScore = negativeKeywords.filter(kw => t.includes(kw)).length;

  if (posScore > negScore) return 'positive';
  if (negScore > posScore) return 'negative';
  return 'neutral';
}

/**
 * 네이버 뉴스 원문 링크에서 매체명 추출
 * @param {string} url
 * @returns {string}
 */
function _extractNaverSource(url = '') {
  if (!url) return '네이버뉴스';

  const sourceMap = {
    'hankyung.com':    '한국경제',
    'mk.co.kr':        '매일경제',
    'edaily.co.kr':    '이데일리',
    'yna.co.kr':       '연합뉴스',
    'inews24.com':     'iNews24',
    'fnnews.com':      '파이낸셜뉴스',
    'sedaily.com':     '서울경제',
    'newsis.com':      '뉴시스',
    'chosun.com':      '조선일보',
    'joongang.co.kr':  '중앙일보',
    'hani.co.kr':      '한겨레',
    'etnews.com':      '전자신문',
    'reuters.com':     'Reuters',
    'bloomberg.com':   'Bloomberg',
    'wsj.com':         'WSJ',
    'ft.com':          'FT',
  };

  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    for (const [key, name] of Object.entries(sourceMap)) {
      if (hostname.includes(key)) return name;
    }
  } catch (_) {
    // URL 파싱 실패 시 기본값
  }
  return '언론사';
}

/**
 * 뉴스 텍스트에서 관련 종목 코드 추출 (한국 종목 위주)
 * 종목명 → 종목 코드 매핑
 * @param {string} text
 * @returns {string[]}
 */
function _extractRelatedTickers(text) {
  const tickerMap = {
    '삼성전자':   '005930',
    'sk하이닉스': '000660',
    'SK하이닉스': '000660',
    '네이버':     '035420',
    '카카오':     '035720',
    '현대차':     '005380',
    '셀트리온':   '068270',
    'lg화학':     '051910',
    'LG화학':     '051910',
    '삼성바이오': '207940',
    'lg에너지':   '373220',
    'LG에너지':   '373220',
    '포스코홀딩': '005490',
    '한화에어':   '012450',
    '기아':       '000270',
  };

  const found = [];
  const t = text;
  for (const [name, code] of Object.entries(tickerMap)) {
    if (t.includes(name) && !found.includes(code)) {
      found.push(code);
    }
  }
  return found;
}

// ══════════════════════════════════════════════════════════════════════
// ① getLatestMarketNews(limit)
// 최신 시장 뉴스 수집
// ══════════════════════════════════════════════════════════════════════

/**
 * 최신 시장 뉴스 목록 조회
 *
 * Provider 선택 기준:
 *   - naver_news  : 국내 투자자 대상, 한국어 뉴스 위주
 *   - newsapi_org : 글로벌 뉴스 포함, 영문
 *   - gnews       : Node.js 서버/CI에서 호출 (브라우저 직접 호출 금지)
 *   - rss_parser  : 특정 매체 RSS 구독
 *
 * TODO: 실제 연동 후보 API
 *
 *   [naver_news]
 *   GET https://openapi.naver.com/v1/search/news.json
 *     ?query=주식시장&sort=date&display={limit}
 *   Headers:
 *     X-Naver-Client-Id: {VITE_NAVER_CLIENT_ID}
 *     X-Naver-Client-Secret: {VITE_NAVER_CLIENT_SECRET}
 *   ⚠️  서버사이드 전용 (CORS 미지원) — CORS 프록시 필요
 *
 *   [newsapi_org]
 *   GET https://newsapi.org/v2/everything
 *     ?q=Korean+stock+market&language=ko&sortBy=publishedAt&pageSize={limit}
 *     &apiKey={VITE_NEWS_API_KEY}
 *   ⚠️  브라우저 직접 호출 불가 — 프록시 필요
 *
 *   [gnews]
 *   GET https://gnews.io/api/v4/search
 *     ?q=주식&lang=ko&country=kr&max={limit}
 *     &apikey={VITE_GNEWS_API_KEY}
 *   ⚠️  Node.js 서버/CI에서만 호출 (API 키 브라우저 노출 금지)
 *
 *   [rss_parser]
 *   GET https://rss.hankyung.com/feed/news.xml  (한국경제)
 *   GET https://www.yna.co.kr/RSS/economy.xml   (연합뉴스 경제)
 *   GET https://www.mk.co.kr/rss/30000001/      (매일경제 주식)
 *   ⚠️  RSS는 XML → JSON 파싱 필요, CORS 이슈 있을 수 있음
 *
 * @param {number} limit - 조회할 뉴스 건수 (기본: 20)
 * @returns {Promise<object[]|null>}  - 공통 newsInsight 스키마 배열 또는 null(mock fallback)
 */
async function getLatestMarketNews(limit = 20) {
  const cacheKey = `news_latest_${limit}`;
  const cached   = getCache(cacheKey);
  if (cached) return cached;

  const provider = SELECTED_PROVIDERS.news;
  if (provider === 'mock') return null;

  try {

    // ── [LIVE API: 네이버 뉴스 검색 API] ─────────────────────────────
    // TODO: provider === 'naver_news' 구현
    // ⚠️  네이버 뉴스 API는 CORS 미지원 → 서버리스 프록시(Vercel Function 등) 경유 필요
    //
    // const proxyUrl  = getEnv('VITE_NEWS_PROXY_URL', '');
    // if (!proxyUrl) throw new ApiError('네이버 뉴스 프록시 URL 미설정', 0, 'naver_news');
    //
    // const url = `${proxyUrl}/naver/news?query=${encodeURIComponent('주식시장')}&sort=date&display=${limit}`;
    // const res = await fetchWithRetry(url, {
    //   headers: {
    //     'X-Naver-Client-Id':     getApiKey('naver_client_id'),
    //     'X-Naver-Client-Secret': getApiKey('naver_client_secret'),
    //   },
    // });
    // const json    = await res.json();
    // const items   = json.items || [];
    // if (!items.length) throw new EmptyResponseError('naver_news');
    // const results = items.slice(0, limit).map((item, idx) => _normalizeNaverNews(item, idx));
    // setCache(cacheKey, results);
    // return results;
    // ──────────────────────────────────────────────────────────────────

    // ── [LIVE API: GNews API] ─────────────────────────────────────────
    // TODO: provider === 'gnews' 구현
    // ⚠️  Node.js 서버/CI에서만 호출 (API 키 브라우저 노출 금지)
    //
    // const key = getApiKey('gnews');
    // if (!key) throw new ApiError('GNews API 키 미설정', 0, 'gnews');
    //
    // const url  = `${getBaseUrl('gnews')}/search`
    //            + `?q=${encodeURIComponent('주식')}&lang=ko&country=kr&max=${limit}&apikey=${key}`;
    // const res  = await fetchWithRetry(url, { signal: AbortSignal.timeout(8000) });
    // const json = await res.json();
    // if (!json.articles?.length) throw new EmptyResponseError('gnews');
    // const results = json.articles.slice(0, limit).map((a, idx) => _normalizeGNews(a, idx));
    // setCache(cacheKey, results);
    // return results;
    // ──────────────────────────────────────────────────────────────────

    // ── [LIVE API: NewsAPI.org] ───────────────────────────────────────
    // TODO: provider === 'newsapi_org' 구현
    // ⚠️  브라우저 직접 호출 시 CORS 차단 → 프록시 경유 필요
    //
    // const key = getApiKey('newsapi');
    // if (!key) throw new ApiError('NewsAPI 키 미설정', 0, 'newsapi_org');
    //
    // const url  = `${getBaseUrl('newsapi_org')}/everything`
    //            + `?q=Korean+stock+market&language=ko&sortBy=publishedAt&pageSize=${limit}&apiKey=${key}`;
    // const res  = await fetchWithRetry(url);
    // const json = await res.json();
    // if (json.status !== 'ok' || !json.articles?.length) throw new EmptyResponseError('newsapi_org');
    // const results = json.articles.slice(0, limit).map((a, idx) => _normalizeNewsApiOrg(a, idx));
    // setCache(cacheKey, results);
    // return results;
    // ──────────────────────────────────────────────────────────────────

    // ── [LIVE API: RSS 파서] ──────────────────────────────────────────
    // TODO: provider === 'rss_parser' 구현
    // RSS XML을 DOMParser로 파싱하거나 rss2json.com 같은 공개 변환 서비스 사용
    //
    // RSS → JSON 변환 서비스 예시 (무료, CORS 허용):
    // const rssUrl  = encodeURIComponent('https://rss.hankyung.com/feed/news.xml');
    // const url     = `https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}&count=${limit}`;
    // const res     = await fetchWithRetry(url);
    // const json    = await res.json();
    // if (json.status !== 'ok') throw new EmptyResponseError('rss_parser');
    // const results = json.items.map((item, idx) => _normalizeNaverNews({
    //   title:       item.title,
    //   description: item.description,
    //   originallink: item.link,
    //   pubDate:     item.pubDate,
    // }, idx));
    // setCache(cacheKey, results);
    // return results;
    // ──────────────────────────────────────────────────────────────────

    throw new ApiError(
      `getLatestMarketNews: provider '${provider}' 미구현`,
      0,
      provider,
    );

  } catch (err) {
    _logNewsApiError('getLatestMarketNews', provider, err);
    return null;  // null 반환 → mockData.js fallback
  }
}

// ══════════════════════════════════════════════════════════════════════
// ② getNewsBySector(sector, limit)
// 섹터별 뉴스 필터링
// ══════════════════════════════════════════════════════════════════════

/**
 * 특정 섹터 관련 뉴스 조회
 *
 * 섹터 키워드 매핑: SECTOR_KEYWORD_MAP 참조
 *
 * TODO: 실제 연동 후보 API
 *
 *   [naver_news]
 *   GET https://openapi.naver.com/v1/search/news.json
 *     ?query={섹터키워드}&sort=date&display={limit}
 *   ⚠️  CORS 미지원 → 프록시 경유 필요
 *
 *   [gnews]
 *   GET https://gnews.io/api/v4/search
 *     ?q={섹터키워드}&lang=ko&country=kr&max={limit}&apikey={key}
 *   ⚠️  Node.js 서버/CI에서만 호출 (API 키 브라우저 노출 금지)
 *
 * @param {string} sector  - 섹터 식별자 (예: 'semiconductor', 'bio', 'auto')
 * @param {number} limit   - 조회할 건수 (기본: 10)
 * @returns {Promise<object[]|null>}
 */
async function getNewsBySector(sector, limit = 10) {
  const cacheKey = `news_sector_${sector}_${limit}`;
  const cached   = getCache(cacheKey);
  if (cached) return cached;

  const provider = SELECTED_PROVIDERS.news;
  if (provider === 'mock') return null;

  const keywords = _getSectorKeywords(sector);
  const query    = keywords.slice(0, 2).join(' OR ');  // 상위 2개 키워드로 검색

  try {

    // ── [LIVE API: 네이버 뉴스 섹터별 검색] ──────────────────────────
    // TODO: provider === 'naver_news' 구현
    //
    // const proxyUrl = getEnv('VITE_NEWS_PROXY_URL', '');
    // const url = `${proxyUrl}/naver/news?query=${encodeURIComponent(keywords[0])}&sort=date&display=${limit}`;
    // const res = await fetchWithRetry(url, {
    //   headers: {
    //     'X-Naver-Client-Id':     getApiKey('naver_client_id'),
    //     'X-Naver-Client-Secret': getApiKey('naver_client_secret'),
    //   },
    // });
    // const json    = await res.json();
    // const items   = (json.items || []).slice(0, limit);
    // if (!items.length) throw new EmptyResponseError('naver_news');
    // const results = items.map((item, idx) => ({
    //   ..._normalizeNaverNews(item, idx),
    //   category: 'sector',  // 섹터 검색이므로 카테고리 강제 지정
    // }));
    // setCache(cacheKey, results);
    // return results;
    // ──────────────────────────────────────────────────────────────────

    // ── [LIVE API: GNews 섹터별 검색] ─────────────────────────────────
    // TODO: provider === 'gnews' 구현
    //
    // const key = getApiKey('gnews');
    // const url = `${getBaseUrl('gnews')}/search`
    //           + `?q=${encodeURIComponent(query)}&lang=ko&max=${limit}&apikey=${key}`;
    // const res  = await fetchWithRetry(url, { signal: AbortSignal.timeout(8000) });
    // const json = await res.json();
    // if (!json.articles?.length) throw new EmptyResponseError('gnews');
    // const results = json.articles.map((a, idx) => ({
    //   ..._normalizeGNews(a, idx),
    //   category: 'sector',
    // }));
    // setCache(cacheKey, results);
    // return results;
    // ──────────────────────────────────────────────────────────────────

    throw new ApiError(
      `getNewsBySector(${sector}): provider '${provider}' 미구현`,
      0,
      provider,
    );

  } catch (err) {
    _logNewsApiError('getNewsBySector', provider, err);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════
// ③ getNewsByTicker(ticker, limit)
// 종목 관련 뉴스 검색
// ══════════════════════════════════════════════════════════════════════

/**
 * 특정 종목 관련 뉴스 조회
 *
 * 종목명 매핑: DEFAULT_WATCHLIST_TICKERS (stockApi.js에서 관리)
 *
 * TODO: 실제 연동 후보 API
 *
 *   [naver_news]
 *   GET https://openapi.naver.com/v1/search/news.json
 *     ?query={종목명}&sort=date&display={limit}
 *   ⚠️  CORS 미지원
 *
 *   [gnews]
 *   GET https://gnews.io/api/v4/search
 *     ?q={종목명}&lang=ko&max={limit}&apikey={key}
 *   ⚠️  Node.js 서버/CI에서만 호출 (API 키 브라우저 노출 금지)
 *
 *   [newsapi_org — 미국 종목 경우]
 *   GET https://newsapi.org/v2/everything
 *     ?q={ticker_symbol}&language=en&sortBy=publishedAt&pageSize={limit}&apiKey={key}
 *   ⚠️  프록시 필요
 *
 * @param {string} ticker  - 종목 코드 (예: '005930') 또는 심볼 (예: 'AAPL')
 * @param {number} limit   - 조회할 건수 (기본: 5)
 * @returns {Promise<object[]|null>}
 */
async function getNewsByTicker(ticker, limit = 5) {
  const cacheKey = `news_ticker_${ticker}_${limit}`;
  const cached   = getCache(cacheKey);
  if (cached) return cached;

  const provider = SELECTED_PROVIDERS.news;
  if (provider === 'mock') return null;

  // 종목 코드 → 종목명 변환
  const tickerNameMap = {
    '005930': '삼성전자',
    '000660': 'SK하이닉스',
    '035420': '네이버',
    '035720': '카카오',
    '005380': '현대차',
    '068270': '셀트리온',
    '051910': 'LG화학',
    '207940': '삼성바이오로직스',
    '373220': 'LG에너지솔루션',
    '012450': '한화에어로스페이스',
    '000270': '기아',
  };
  const searchQuery = tickerNameMap[ticker] || ticker;

  try {

    // ── [LIVE API: 네이버 뉴스 종목별 검색] ──────────────────────────
    // TODO: provider === 'naver_news' 구현
    //
    // const proxyUrl = getEnv('VITE_NEWS_PROXY_URL', '');
    // const url = `${proxyUrl}/naver/news?query=${encodeURIComponent(searchQuery)}&sort=date&display=${limit}`;
    // const res = await fetchWithRetry(url, {
    //   headers: {
    //     'X-Naver-Client-Id':     getApiKey('naver_client_id'),
    //     'X-Naver-Client-Secret': getApiKey('naver_client_secret'),
    //   },
    // });
    // const json    = await res.json();
    // const items   = (json.items || []).slice(0, limit);
    // if (!items.length) throw new EmptyResponseError('naver_news');
    // const results = items.map((item, idx) => ({
    //   ..._normalizeNaverNews(item, idx),
    //   relatedTickers: [ticker],  // 검색 종목 코드 강제 삽입
    // }));
    // setCache(cacheKey, results);
    // return results;
    // ──────────────────────────────────────────────────────────────────

    // ── [LIVE API: GNews 종목별 검색] ─────────────────────────────────
    // TODO: provider === 'gnews' 구현
    //
    // const key = getApiKey('gnews');
    // const url = `${getBaseUrl('gnews')}/search`
    //           + `?q=${encodeURIComponent(searchQuery)}&lang=ko&max=${limit}&apikey=${key}`;
    // const res  = await fetchWithRetry(url, { signal: AbortSignal.timeout(8000) });
    // const json = await res.json();
    // if (!json.articles?.length) throw new EmptyResponseError('gnews');
    // const results = json.articles.map((a, idx) => ({
    //   ..._normalizeGNews(a, idx),
    //   relatedTickers: [ticker],
    // }));
    // setCache(cacheKey, results);
    // return results;
    // ──────────────────────────────────────────────────────────────────

    throw new ApiError(
      `getNewsByTicker(${ticker}): provider '${provider}' 미구현`,
      0,
      provider,
    );

  } catch (err) {
    _logNewsApiError('getNewsByTicker', provider, err);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════
// 내부 헬퍼
// ══════════════════════════════════════════════════════════════════════

/**
 * API 에러 로그 출력 (mock provider는 에러 없음)
 * @param {string} fnName
 * @param {string} provider
 * @param {Error}  err
 */
function _logNewsApiError(fnName, provider, err) {
  if (provider !== 'mock') {
    console.warn(`[NewsApi] ${fnName} (${provider}) 실패 → mock fallback:`, err.message);
  }
}
