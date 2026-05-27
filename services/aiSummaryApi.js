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
 * ║                                                                      ║
 * ║  ⚠️  LLM API 키 보안:                                              ║
 * ║      Gemini를 포함한 모든 LLM API 키는 CORS 허용 여부와 무관하게  ║
 * ║      브라우저에 노출하면 절대 안 됩니다.                           ║
 * ║      키를 탈취하면 무제한 과금 피해가 발생할 수 있습니다.          ║
 * ║      반드시 GitHub Secrets 또는 서버 환경변수에만 저장하세요.      ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║         Market Pulse Korea — AI Summary API Service                 ║
 * ║                                                                      ║
 * ║  담당 도메인:                                                        ║
 * ║    - 시장 전체 브리프 생성 (일일 마켓 요약)                         ║
 * ║    - 개별 뉴스 투자 인사이트 생성                                   ║
 * ║    - 종목별 인사이트 생성 (시세 + 관련 뉴스 컨텍스트)              ║
 * ║    - 핵심 이슈 / 체크포인트 생성                                    ║
 * ║                                                                      ║
 * ║  지원 Provider:                                                      ║
 * ║    - openai       : OpenAI GPT-4o / GPT-4.1 (유료)                 ║
 * ║    - anthropic    : Anthropic Claude 3.7 Sonnet (유료)              ║
 * ║    - google_gemini: Google Gemini 1.5 Pro / 2.0 Flash (유료)       ║
 * ║    - upstage      : Upstage Solar (한국어 특화, 유료)               ║
 * ║    - mock         : 목 데이터 (기본값)                              ║
 * ║                                                                      ║
 * ║  ⚠️  중요: LLM API는 CORS 정책 관계없이 API 키가 브라우저에        ║
 * ║      노출되는 문제가 있습니다. 프로덕션 환경에서는 반드시           ║
 * ║      서버리스 함수(Vercel/Netlify Function) 또는 백엔드             ║
 * ║      프록시를 통해 호출하세요.                                       ║
 * ║                                                                      ║
 * ║  실제 API 연동 위치: 각 함수 내부 // ── [LIVE API] ── 블록          ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * 의존성 로드 순서 (index.html):
 *   config/apiConfig.js  →  services/aiSummaryApi.js  →  data/mockData.js
 */

'use strict';

// ══════════════════════════════════════════════════════════════════════
// 시스템 프롬프트 & 프롬프트 템플릿
// ══════════════════════════════════════════════════════════════════════

/**
 * 공통 시스템 프롬프트
 * 모든 AI 요약 함수에서 system role로 사용됩니다.
 */
const SYSTEM_PROMPT_KR = `당신은 한국 주식시장 전문 금융 분석가입니다.
다음 원칙을 반드시 준수하세요:

1. 정보 제공 원칙: 투자 매수/매도 추천은 절대 하지 않습니다.
   대신 "모멘텀 유효", "약세 신호 관찰", "변동성 주의" 같은 중립적 표현만 사용합니다.
2. 언어: 한국어로 답변하되, 금융 전문 용어는 적절히 사용합니다.
3. 형식: 요청된 JSON 형식을 정확히 따릅니다. 추가 설명 없이 JSON만 반환합니다.
4. 길이: 간결하고 핵심적인 내용만 담습니다.
5. 컨텍스트: 제공된 데이터 범위 내에서만 분석합니다.`;

/**
 * 시장 전체 브리프 생성 프롬프트 빌더
 * @param {object} marketData  - { indices, investorFlows, sectorTrends }
 * @param {object[]} newsItems - 최신 뉴스 5~10건 (headline, summary 포함)
 * @returns {string}
 */
function buildMarketBriefPrompt(marketData, newsItems = []) {
  const indicesSummary = (marketData?.indices || [])
    .filter(idx => ['kospi', 'kosdaq', 'sp500', 'nasdaq'].includes(idx.id))
    .map(idx => `${idx.name}: ${idx.value} (${idx.changePercent > 0 ? '+' : ''}${idx.changePercent}%)`)
    .join(', ');

  const flowsSummary = marketData?.flows
    ? `외인 ${marketData.flows.foreign?.formatted || '-'} | 기관 ${marketData.flows.institutional?.formatted || '-'} | 개인 ${marketData.flows.retail?.formatted || '-'}`
    : '';

  const newsHeadlines = newsItems
    .slice(0, 8)
    .map((n, i) => `${i + 1}. ${n.headline || n.title || ''}`)
    .join('\n');

  return `오늘의 한국 주식시장 상황을 분석해주세요.

## 시장 지수
${indicesSummary || '데이터 없음'}

## 투자자 수급
${flowsSummary || '데이터 없음'}

## 오늘의 주요 뉴스 헤드라인
${newsHeadlines || '뉴스 데이터 없음'}

## 요청 형식 (JSON):
{
  "headline": "오늘의 시장 핵심 한 줄 요약 (30자 이내)",
  "body": "시장 전반 상황 설명 (100~150자)",
  "keyTakeaways": [
    "핵심 포인트 1 (종목/섹터명 — 상황 설명)",
    "핵심 포인트 2",
    "핵심 포인트 3",
    "핵심 포인트 4"
  ],
  "marketOutlook": "단기 전망 레이블 (예: '단기 중립~강세', '변동성 확대')",
  "outlookColor": "green | yellow | red"
}`;
}

/**
 * 개별 뉴스 인사이트 프롬프트 빌더
 * @param {object} newsItem - { headline, summary, source, publishedAt }
 * @returns {string}
 */
function buildNewsInsightPrompt(newsItem) {
  return `다음 뉴스를 한국 주식 투자자 관점에서 분석해주세요.

## 뉴스 정보
제목: ${newsItem.headline || newsItem.title || ''}
요약: ${newsItem.summary || newsItem.description || ''}
출처: ${newsItem.source || ''}
발행: ${newsItem.publishedAt || ''}

## 요청 형식 (JSON):
{
  "insight": "한국 투자자 관점의 핵심 인사이트 2~3문장 (80자 이내)",
  "sentiment": "positive | neutral | negative",
  "impact": "high | medium | low",
  "relatedSectors": ["영향받는 섹터1", "섹터2"],
  "watchPoints": "주의 깊게 볼 포인트 (30자 이내)"
}`;
}

/**
 * 종목 인사이트 프롬프트 빌더
 * @param {object}   stockData    - 종목 시세 데이터
 * @param {object[]} relatedNews  - 관련 뉴스 3~5건
 * @returns {string}
 */
function buildStockInsightPrompt(stockData, relatedNews = []) {
  const newsSummary = relatedNews
    .slice(0, 3)
    .map((n, i) => `${i + 1}. ${n.headline || n.title || ''}`)
    .join('\n');

  return `다음 종목 데이터와 관련 뉴스를 분석해주세요.

## 종목 정보
종목명: ${stockData.name || ''}
종목코드: ${stockData.ticker || ''}
현재가: ${stockData.price?.toLocaleString() || '-'}원
등락률: ${stockData.changePercent > 0 ? '+' : ''}${stockData.changePercent || 0}%
거래량: ${stockData.volume || '-'}
모멘텀 신호: ${stockData.signal || '-'}

## 관련 뉴스
${newsSummary || '관련 뉴스 없음'}

## 요청 형식 (JSON):
{
  "insight": "종목 핵심 인사이트 2문장 (60자 이내)",
  "momentum": "up | down | neutral",
  "riskLevel": "high | medium | low",
  "catalysts": ["모멘텀 요인 1", "요인 2"],
  "watchPoints": "주의 포인트 (30자 이내)"
}`;
}

/**
 * 핵심 이슈 / 체크포인트 생성 프롬프트 빌더
 * @param {object[]} newsList    - 최신 뉴스 10건
 * @param {object}   marketData - { indices, investorFlows }
 * @returns {string}
 */
function buildKeyIssuesPrompt(newsList, marketData) {
  const newsHeadlines = newsList
    .slice(0, 10)
    .map((n, i) => `${i + 1}. [${n.category || 'news'}] ${n.headline || n.title || ''}`)
    .join('\n');

  const kospi = (marketData?.indices || []).find(i => i.id === 'kospi');
  const kosdaq = (marketData?.indices || []).find(i => i.id === 'kosdaq');

  return `오늘 한국 투자자가 반드시 체크해야 할 핵심 이슈 5개를 도출해주세요.

## 시장 현황
KOSPI: ${kospi ? `${kospi.value} (${kospi.changePercent > 0 ? '+' : ''}${kospi.changePercent}%)` : '데이터 없음'}
KOSDAQ: ${kosdaq ? `${kosdaq.value} (${kosdaq.changePercent > 0 ? '+' : ''}${kosdaq.changePercent}%)` : '데이터 없음'}

## 오늘의 주요 뉴스
${newsHeadlines || '뉴스 데이터 없음'}

## 요청 형식 (JSON):
{
  "issues": [
    {
      "id": "issue_1",
      "title": "이슈 제목 (20자 이내)",
      "description": "이슈 설명 (50자 이내)",
      "type": "macro | earnings | geopolitical | monetary | sector",
      "severity": "high | medium | low",
      "icon": "📊",
      "impact": "긍정적 | 부정적 | 중립적"
    }
  ]
}`;
}

// ══════════════════════════════════════════════════════════════════════
// 내부 유틸: AI Provider별 API 호출 래퍼
// ══════════════════════════════════════════════════════════════════════

/**
 * OpenAI Chat Completions API 호출
 *
 * ⚠️  보안 주의: API 키가 브라우저에 노출됩니다.
 *     프로덕션에서는 서버리스 함수 프록시 사용을 강력히 권고합니다.
 *
 * TODO: provider === 'openai' 구현
 *
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {object} options - { model, maxTokens, temperature }
 * @returns {Promise<string>} - AI 응답 텍스트
 */
async function _callOpenAI(systemPrompt, userPrompt, options = {}) {
  const {
    model       = 'gpt-4o-mini',  // 비용 절감: gpt-4o-mini 사용, 고품질: gpt-4o
    maxTokens   = 512,
    temperature = 0.3,
  } = options;

  const key = getApiKey('openai');
  if (!key) throw new ApiError('OpenAI API 키 미설정 (VITE_OPENAI_API_KEY)', 0, 'openai');

  // ── [LIVE API: OpenAI Chat Completions] ──────────────────────────────
  // TODO: 아래 주석 해제하여 활성화
  //
  // const proxyUrl = getEnv('VITE_AI_PROXY_URL', '');
  // const endpoint = proxyUrl
  //   ? `${proxyUrl}/openai/chat`                    // 프록시 경유 (권장)
  //   : `${getBaseUrl('openai')}/chat/completions`;  // 직접 호출 (개발용)
  //
  // const res = await fetchWithRetry(endpoint, {
  //   method:  'POST',
  //   headers: {
  //     'Content-Type':  'application/json',
  //     'Authorization': `Bearer ${key}`,
  //   },
  //   body: JSON.stringify({
  //     model,
  //     max_tokens:  maxTokens,
  //     temperature,
  //     messages: [
  //       { role: 'system', content: systemPrompt },
  //       { role: 'user',   content: userPrompt   },
  //     ],
  //     response_format: { type: 'json_object' },  // JSON 응답 강제
  //   }),
  //   signal: AbortSignal.timeout(15000),
  // });
  // const json = await res.json();
  // if (!res.ok) throw new ApiError(json.error?.message, res.status, 'openai');
  // return json.choices?.[0]?.message?.content || '';
  // ──────────────────────────────────────────────────────────────────────

  throw new ApiError('OpenAI: 미구현 (TODO 주석 해제 필요)', 0, 'openai');
}

/**
 * Anthropic Claude Messages API 호출
 *
 * ⚠️  보안 주의: API 키가 브라우저에 노출됩니다.
 *
 * TODO: provider === 'anthropic' 구현
 *
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {object} options - { model, maxTokens, temperature }
 * @returns {Promise<string>}
 */
async function _callAnthropic(systemPrompt, userPrompt, options = {}) {
  const {
    model       = 'claude-3-haiku-20240307', // 비용 절감: haiku, 고품질: claude-3-7-sonnet-20250219
    maxTokens   = 512,
    temperature = 0.3,
  } = options;

  const key = getApiKey('anthropic');
  if (!key) throw new ApiError('Anthropic API 키 미설정 (VITE_ANTHROPIC_API_KEY)', 0, 'anthropic');

  // ── [LIVE API: Anthropic Messages] ───────────────────────────────────
  // TODO: 아래 주석 해제하여 활성화
  //
  // const proxyUrl = getEnv('VITE_AI_PROXY_URL', '');
  // const endpoint = proxyUrl
  //   ? `${proxyUrl}/anthropic/messages`
  //   : `${getBaseUrl('anthropic')}/messages`;
  //
  // const res = await fetchWithRetry(endpoint, {
  //   method:  'POST',
  //   headers: {
  //     'Content-Type':      'application/json',
  //     'x-api-key':         key,
  //     'anthropic-version': '2023-06-01',
  //   },
  //   body: JSON.stringify({
  //     model,
  //     max_tokens:  maxTokens,
  //     temperature,
  //     system:   systemPrompt,
  //     messages: [{ role: 'user', content: userPrompt }],
  //   }),
  //   signal: AbortSignal.timeout(15000),
  // });
  // const json = await res.json();
  // if (!res.ok) throw new ApiError(json.error?.message, res.status, 'anthropic');
  // return json.content?.[0]?.text || '';
  // ──────────────────────────────────────────────────────────────────────

  throw new ApiError('Anthropic: 미구현 (TODO 주석 해제 필요)', 0, 'anthropic');
}

/**
 * Google Gemini API 호출
 *
 * ⚠️  보안 주의: API 키가 브라우저에 노출됩니다.
 *
 * TODO: provider === 'google_gemini' 구현
 *
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {object} options - { model, maxTokens, temperature }
 * @returns {Promise<string>}
 */
async function _callGemini(systemPrompt, userPrompt, options = {}) {
  const {
    model       = 'gemini-2.0-flash',  // 무료 티어 있음
    maxTokens   = 512,
    temperature = 0.3,
  } = options;

  const key = getApiKey('gemini');
  if (!key) throw new ApiError('Gemini API 키 미설정 (VITE_GEMINI_API_KEY)', 0, 'google_gemini');

  // ── [LIVE API: Google Gemini generateContent] ─────────────────────────
  // TODO: 아래 주석 해제하여 활성화
  // ⚠️  Gemini API 키는 브라우저에 노출하면 절대 안 됩니다.
  //     scripts/updateDashboardData.js 에서만 호출하세요.
  //     CORS 허용 여부와 무관하게 API 키 보안이 우선입니다.
  //
  // const endpoint = `${getBaseUrl('google_gemini')}/models/${model}:generateContent?key=${key}`;
  // const res = await fetchWithRetry(endpoint, {
  //   method:  'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     system_instruction: { parts: [{ text: systemPrompt }] },
  //     contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
  //     generationConfig: {
  //       maxOutputTokens: maxTokens,
  //       temperature,
  //       responseMimeType: 'application/json',  // JSON 응답 강제
  //     },
  //   }),
  //   signal: AbortSignal.timeout(15000),
  // });
  // const json = await res.json();
  // if (!res.ok) throw new ApiError(json.error?.message, res.status, 'google_gemini');
  // return json.candidates?.[0]?.content?.parts?.[0]?.text || '';
  // ──────────────────────────────────────────────────────────────────────

  throw new ApiError('Gemini: 미구현 (TODO 주석 해제 필요)', 0, 'google_gemini');
}

/**
 * Upstage Solar API 호출
 *
 * 한국어 특화 LLM. OpenAI 호환 API 형식 사용.
 *
 * TODO: provider === 'upstage' 구현
 *
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {object} options
 * @returns {Promise<string>}
 */
async function _callUpstage(systemPrompt, userPrompt, options = {}) {
  const {
    model       = 'solar-pro',  // 또는 'solar-mini'
    maxTokens   = 512,
    temperature = 0.3,
  } = options;

  const key = getApiKey('upstage');
  if (!key) throw new ApiError('Upstage API 키 미설정 (VITE_UPSTAGE_API_KEY)', 0, 'upstage');

  // ── [LIVE API: Upstage Solar Chat Completions] ────────────────────────
  // TODO: 아래 주석 해제하여 활성화
  //
  // const res = await fetchWithRetry(`${getBaseUrl('upstage')}/chat/completions`, {
  //   method:  'POST',
  //   headers: {
  //     'Content-Type':  'application/json',
  //     'Authorization': `Bearer ${key}`,
  //   },
  //   body: JSON.stringify({
  //     model,
  //     max_tokens:  maxTokens,
  //     temperature,
  //     messages: [
  //       { role: 'system', content: systemPrompt },
  //       { role: 'user',   content: userPrompt   },
  //     ],
  //   }),
  //   signal: AbortSignal.timeout(15000),
  // });
  // const json = await res.json();
  // if (!res.ok) throw new ApiError(json.error?.message, res.status, 'upstage');
  // return json.choices?.[0]?.message?.content || '';
  // ──────────────────────────────────────────────────────────────────────

  throw new ApiError('Upstage: 미구현 (TODO 주석 해제 필요)', 0, 'upstage');
}

/**
 * 현재 선택된 AI provider로 LLM API 호출 (공통 라우터)
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {object} options
 * @returns {Promise<string>} - AI 응답 텍스트 (JSON 문자열)
 */
async function _callAI(systemPrompt, userPrompt, options = {}) {
  const provider = SELECTED_PROVIDERS.ai;

  switch (provider) {
    case 'openai':        return _callOpenAI(systemPrompt, userPrompt, options);
    case 'anthropic':     return _callAnthropic(systemPrompt, userPrompt, options);
    case 'google_gemini': return _callGemini(systemPrompt, userPrompt, options);
    case 'upstage':       return _callUpstage(systemPrompt, userPrompt, options);
    case 'mock':          return null;  // mock → mockData.js fallback
    default:
      throw new ApiError(`AI provider '${provider}' 미지원`, 0, provider);
  }
}

/**
 * AI 응답 텍스트를 JSON으로 안전하게 파싱
 * LLM이 JSON 외 텍스트를 포함할 경우 JSON 블록만 추출합니다.
 * @param {string} text
 * @returns {object|null}
 */
function _parseAiResponse(text) {
  if (!text) return null;
  try {
    // 1) 직접 파싱 시도
    return JSON.parse(text.trim());
  } catch (_) {
    // 2) ```json ... ``` 마크다운 코드 블록 추출
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      try { return JSON.parse(match[1]); } catch (_) { /* fall through */ }
    }
    // 3) { ... } 패턴 추출
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try { return JSON.parse(objMatch[0]); } catch (_) { /* fall through */ }
    }
    console.warn('[AiSummaryApi] AI 응답 JSON 파싱 실패:', text.slice(0, 100));
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════
// ① generateMarketBrief(marketData, newsItems)
// 시장 전체 브리프 생성
// ══════════════════════════════════════════════════════════════════════

/**
 * 일일 시장 종합 요약 생성
 *
 * 출력 스키마 (공통 aiSummary 스키마):
 * {
 *   headline:       string,    // 한 줄 요약
 *   body:           string,    // 본문 (100~150자)
 *   keyTakeaways:   string[],  // 핵심 포인트 4건
 *   marketOutlook:  string,    // '단기 중립~강세' 등
 *   outlookColor:   string,    // 'green'|'yellow'|'red'
 *   source:         string,    // AI provider 이름
 *   generatedAt:    string,    // ISO 타임스탬프
 *   isMockData:     boolean,
 * }
 *
 * TODO: 실제 연동 시 _callAI() 함수가 자동으로 선택된 provider를 사용합니다.
 *   1. SELECTED_PROVIDERS.ai 를 'openai' | 'anthropic' | 'google_gemini' | 'upstage' 로 변경
 *   2. .env 에 해당 API 키 입력
 *   3. 이 함수는 수정 없이 자동으로 해당 provider를 사용
 *
 * @param {object}   marketData  - { indices, investorFlows, sectorTrends }
 * @param {object[]} newsItems   - 최신 뉴스 5~10건
 * @returns {Promise<object|null>}
 */
async function generateMarketBrief(marketData, newsItems = []) {
  const cacheKey = `ai_market_brief_${new Date().toDateString()}`;
  const cached   = getCache(cacheKey);
  if (cached) return cached;

  const provider = SELECTED_PROVIDERS.ai;
  if (provider === 'mock') return null;

  try {
    const userPrompt = buildMarketBriefPrompt(marketData, newsItems);
    const rawText    = await _callAI(SYSTEM_PROMPT_KR, userPrompt, {
      model:       _getDefaultModel(provider, 'brief'),
      maxTokens:   600,
      temperature: 0.3,
    });
    if (!rawText) return null;

    const parsed = _parseAiResponse(rawText);
    if (!parsed) return null;

    const result = {
      ...parsed,
      source:      provider,
      modelVersion: _getDefaultModel(provider, 'brief'),
      generatedAt: new Date().toISOString(),
      isMockData:  false,
    };
    setCache(cacheKey, result);
    return result;

  } catch (err) {
    _logAiError('generateMarketBrief', provider, err);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════
// ② generateNewsInsight(newsItem)
// 개별 뉴스 투자 인사이트 생성
// ══════════════════════════════════════════════════════════════════════

/**
 * 개별 뉴스 아이템에 대한 투자 인사이트 생성
 *
 * 출력 스키마:
 * {
 *   insight:        string,    // 핵심 인사이트 2~3문장
 *   sentiment:      string,    // 'positive'|'neutral'|'negative'
 *   impact:         string,    // 'high'|'medium'|'low'
 *   relatedSectors: string[],  // 영향 섹터
 *   watchPoints:    string,    // 주의 포인트
 * }
 *
 * @param {object} newsItem - 공통 newsInsight 스키마 항목
 * @returns {Promise<object|null>}
 */
async function generateNewsInsight(newsItem) {
  if (!newsItem) return null;

  const cacheKey = `ai_news_insight_${newsItem.id}`;
  const cached   = getCache(cacheKey);
  if (cached) return cached;

  const provider = SELECTED_PROVIDERS.ai;
  if (provider === 'mock') return null;

  try {
    const userPrompt = buildNewsInsightPrompt(newsItem);
    const rawText    = await _callAI(SYSTEM_PROMPT_KR, userPrompt, {
      model:       _getDefaultModel(provider, 'news'),
      maxTokens:   256,
      temperature: 0.2,
    });
    if (!rawText) return null;

    const parsed = _parseAiResponse(rawText);
    if (!parsed) return null;

    setCache(cacheKey, parsed);
    return parsed;

  } catch (err) {
    _logAiError('generateNewsInsight', provider, err);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════
// ③ generateStockInsight(stockData, relatedNews)
// 종목 인사이트 생성
// ══════════════════════════════════════════════════════════════════════

/**
 * 종목 데이터 + 관련 뉴스 기반 인사이트 생성
 *
 * 출력 스키마:
 * {
 *   insight:     string,    // 핵심 인사이트 2문장
 *   momentum:    string,    // 'up'|'down'|'neutral'
 *   riskLevel:   string,    // 'high'|'medium'|'low'
 *   catalysts:   string[],  // 모멘텀 요인
 *   watchPoints: string,    // 주의 포인트
 * }
 *
 * @param {object}   stockData   - 공통 Stock 스키마 항목
 * @param {object[]} relatedNews - 관련 뉴스 3~5건
 * @returns {Promise<object|null>}
 */
async function generateStockInsight(stockData, relatedNews = []) {
  if (!stockData) return null;

  const cacheKey = `ai_stock_insight_${stockData.ticker}_${new Date().toDateString()}`;
  const cached   = getCache(cacheKey);
  if (cached) return cached;

  const provider = SELECTED_PROVIDERS.ai;
  if (provider === 'mock') return null;

  try {
    const userPrompt = buildStockInsightPrompt(stockData, relatedNews);
    const rawText    = await _callAI(SYSTEM_PROMPT_KR, userPrompt, {
      model:       _getDefaultModel(provider, 'stock'),
      maxTokens:   256,
      temperature: 0.2,
    });
    if (!rawText) return null;

    const parsed = _parseAiResponse(rawText);
    if (!parsed) return null;

    setCache(cacheKey, parsed);
    return parsed;

  } catch (err) {
    _logAiError('generateStockInsight', provider, err);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════
// ④ generateKeyIssues(newsList, marketData)
// 핵심 이슈 / 체크포인트 생성
// ══════════════════════════════════════════════════════════════════════

/**
 * 뉴스 목록 + 시장 데이터 기반 핵심 이슈 5개 생성
 *
 * 출력 스키마:
 * {
 *   issues: [
 *     {
 *       id:          string,
 *       title:       string,
 *       description: string,
 *       type:        string,    // 'macro'|'earnings'|'geopolitical'|'monetary'|'sector'
 *       severity:    string,    // 'high'|'medium'|'low'
 *       icon:        string,    // 이모지
 *       impact:      string,    // '긍정적'|'부정적'|'중립적'
 *     }
 *   ]
 * }
 *
 * @param {object[]} newsList    - 최신 뉴스 목록 (최대 10건)
 * @param {object}   marketData  - { indices, investorFlows }
 * @returns {Promise<object[]|null>}  - issues 배열 또는 null
 */
async function generateKeyIssues(newsList = [], marketData = {}) {
  const cacheKey = `ai_key_issues_${new Date().toDateString()}`;
  const cached   = getCache(cacheKey);
  if (cached) return cached;

  const provider = SELECTED_PROVIDERS.ai;
  if (provider === 'mock') return null;

  try {
    const userPrompt = buildKeyIssuesPrompt(newsList, marketData);
    const rawText    = await _callAI(SYSTEM_PROMPT_KR, userPrompt, {
      model:       _getDefaultModel(provider, 'issues'),
      maxTokens:   800,
      temperature: 0.25,
    });
    if (!rawText) return null;

    const parsed = _parseAiResponse(rawText);
    if (!parsed?.issues) return null;

    // 이슈 배열에 타임스탬프와 source 추가
    const issues = parsed.issues.map(issue => ({
      ...issue,
      source:      provider,
      generatedAt: new Date().toISOString(),
      isMockData:  false,
    }));

    setCache(cacheKey, issues);
    return issues;

  } catch (err) {
    _logAiError('generateKeyIssues', provider, err);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════
// 내부 헬퍼
// ══════════════════════════════════════════════════════════════════════

/**
 * Provider별 기본 모델 이름 반환
 * 용도(task)에 따라 비용 효율적인 모델 선택
 * @param {string} provider
 * @param {string} task   - 'brief'|'news'|'stock'|'issues'
 * @returns {string}
 */
function _getDefaultModel(provider, task = 'brief') {
  const modelMap = {
    openai: {
      brief:  'gpt-4o-mini',   // 비용 절감 (gpt-4o 대비 ~20배 저렴)
      news:   'gpt-4o-mini',
      stock:  'gpt-4o-mini',
      issues: 'gpt-4o-mini',
    },
    anthropic: {
      brief:  'claude-3-haiku-20240307',  // 빠르고 저렴
      news:   'claude-3-haiku-20240307',
      stock:  'claude-3-haiku-20240307',
      issues: 'claude-3-5-sonnet-20241022',  // 이슈 추출은 더 강력한 모델
    },
    google_gemini: {
      brief:  'gemini-2.0-flash',   // 빠르고 저렴, 무료 티어 있음
      news:   'gemini-2.0-flash',
      stock:  'gemini-2.0-flash',
      issues: 'gemini-2.0-flash',
    },
    upstage: {
      brief:  'solar-pro',
      news:   'solar-mini',  // 간단한 작업은 mini
      stock:  'solar-mini',
      issues: 'solar-pro',
    },
  };

  return modelMap[provider]?.[task] || 'unknown';
}

/**
 * API 에러 로그 출력
 * @param {string} fnName
 * @param {string} provider
 * @param {Error}  err
 */
function _logAiError(fnName, provider, err) {
  if (provider !== 'mock') {
    console.warn(`[AiSummaryApi] ${fnName} (${provider}) 실패 → mock fallback:`, err.message);
  }
}
