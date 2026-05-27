#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║    Market Pulse Korea — Dashboard Data Update Script                ║
 * ║                                                                      ║
 * ║  ⚠️  이 스크립트는 Node.js 서버 환경(GitHub Actions 포함)에서만    ║
 * ║      실행됩니다. 브라우저에서 직접 실행하지 마십시오.               ║
 * ║                                                                      ║
 * ║  역할:                                                               ║
 * ║    1. 무료 공개 API에서 시장 데이터/뉴스/경제지표 수집              ║
 * ║    2. AI 요약 생성 (선택적, API 키 필요)                            ║
 * ║    3. 실패한 섹션은 기존 data/latestDashboardData.json 값 유지      ║
 * ║    4. 전체 결과를 data/latestDashboardData.json 으로 저장            ║
 * ║    5. _meta.status: 'healthy' | 'degraded' | 'mock' 설정            ║
 * ║                                                                      ║
 * ║  실행 방법:                                                          ║
 * ║    node scripts/updateDashboardData.js                              ║
 * ║                                                                      ║
 * ║  환경변수 (.env 또는 GitHub Secrets):                               ║
 * ║    .env.example 참조                                                 ║
 * ║                                                                      ║
 * ║  주의사항:                                                           ║
 * ║    - API 키를 이 파일에 직접 입력하지 마십시오.                     ║
 * ║    - API 키는 .env 또는 GitHub Secrets 에만 저장하십시오.           ║
 * ║    - 이 파일 자체는 공개 레포에 올려도 안전합니다.                  ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const https = require('https');
const http  = require('http');

// ── dotenv 로드 (선택적 — dotenv 미설치 시 process.env 직접 사용) ──────
try {
  require('dotenv').config();
} catch (_) {
  // dotenv 미설치 환경 (GitHub Actions는 Secrets를 직접 env로 주입)
}

// ══════════════════════════════════════════════════════════════════════
// 설정
// ══════════════════════════════════════════════════════════════════════

const DATA_FILE_PATH = path.resolve(__dirname, '../data/latestDashboardData.json');

/** API 키를 환경변수에서 읽는 헬퍼 */
const ENV = {
  // ── 뉴스
  gnewsKey:      process.env.GNEWS_API_KEY      || '',  // gnews.io (무료 100req/day)
  naverClientId: process.env.NAVER_CLIENT_ID     || '',  // Naver Search API
  naverSecret:   process.env.NAVER_CLIENT_SECRET || '',
  // ── AI 요약
  geminiKey:     process.env.GEMINI_API_KEY      || '',  // Google AI Studio (무료 1500req/day)
  openaiKey:     process.env.OPENAI_API_KEY      || '',  // OpenAI (유료)
  anthropicKey:  process.env.ANTHROPIC_API_KEY   || '',  // Anthropic (유료)
  // ── 경제지표 / 주가 시그널
  alphaKey:      process.env.ALPHA_VANTAGE_KEY   || '',  // alphavantage.co (무료 25req/day)
  fredKey:       process.env.FRED_API_KEY        || '',  // fred.stlouisfed.org (무료)
  finnhubKey:    process.env.FINNHUB_API_KEY     || '',  // finnhub.io (무료 60req/min)
  // ── 한국 공시 (DART)
  dartKey:       process.env.DART_API_KEY        || '',  // opendart.fss.or.kr (무료)
  // ── 가상자산
  coingeckoKey:  process.env.COINGECKO_API_KEY   || '',  // coingecko.com (무료 플랜은 키 불필요)
  // ── 기타
  bokKey:        process.env.BOK_ECOS_KEY        || '',
  twelveKey:     process.env.TWELVE_DATA_KEY     || '',
};

/** 각 섹션의 업데이트 성공/실패 여부 추적 */
const updateStatus = {
  overview:      false,
  indices:       false,
  ticker:        false,
  stocks:        false,
  sectors:       false,
  keyIssues:     false,
  news:          false,
  newsRss:       false,  // Google News RSS (API 키 불필요)
  risks:         false,
  flows:         false,
  aiSummary:     false,
  disclosures:   false,  // DART 공시
  cryptoPrices:  false,  // CoinGecko 가상자산
  finnhubSignal: false,  // Finnhub 시장 시그널
};

const errors = [];

// ══════════════════════════════════════════════════════════════════════
// 유틸리티
// ══════════════════════════════════════════════════════════════════════

/** 간단한 HTTP GET 래퍼 (Node.js 내장 http/https 사용) */
function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const { timeout = 10000, headers = {} } = options;
    const lib = url.startsWith('https') ? https : http;

    const req = lib.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        if (res.statusCode === 429) {
          reject(new Error(`Rate limit (429): ${url}`));
          return;
        }
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${url}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (_) {
          resolve(data); // JSON이 아닌 경우 (CSV 등) 텍스트 반환
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(timeout, () => {
      req.destroy(new Error(`Timeout (${timeout}ms): ${url}`));
    });
  });
}

/** HTTP POST 래퍼 (AI API 용) */
function postUrl(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const lib  = url.startsWith('https') ? https : http;
    const data = JSON.stringify(body);
    const urlObj = new URL(url);

    const options = {
      hostname: urlObj.hostname,
      path:     urlObj.pathname + urlObj.search,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers,
      },
      timeout: 20000,
    };

    const req = lib.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => (responseData += chunk));
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${url} — ${responseData.slice(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(responseData));
        } catch (_) {
          resolve(responseData);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error(`POST Timeout: ${url}`)));
    req.write(data);
    req.end();
  });
}

/** 재시도 래퍼 */
async function fetchWithRetry(fn, retries = 2, delayMs = 1500) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i < retries) {
        console.warn(`  ↻ 재시도 ${i + 1}/${retries}: ${err.message}`);
        await sleep(delayMs * (i + 1));
      } else {
        throw err;
      }
    }
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/** D-Day 계산 */
function calcDDay(dateStr) {
  const today  = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = Math.floor((target - today) / 86400000);
  if (diff === 0) return 'D-Day';
  if (diff > 0)   return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
}

/** AI 응답 JSON 파싱 */
function parseAiJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text.trim());
  } catch (_) {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      try { return JSON.parse(match[1]); } catch (_) { /* fall through */ }
    }
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try { return JSON.parse(objMatch[0]); } catch (_) { /* fall through */ }
    }
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════
// 기존 데이터 로드
// ══════════════════════════════════════════════════════════════════════

function loadExistingData() {
  try {
    if (fs.existsSync(DATA_FILE_PATH)) {
      const raw = fs.readFileSync(DATA_FILE_PATH, 'utf8');
      console.log('📂 기존 latestDashboardData.json 로드 완료');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('⚠️  기존 데이터 로드 실패:', err.message);
  }
  console.log('📂 기존 데이터 없음 — mock 시드 데이터 사용');
  return null;
}

// ══════════════════════════════════════════════════════════════════════
// ① 뉴스 수집
//
//  1순위: Google News RSS (API 키 불필요 — 완전 무료)
//    URL: https://news.google.com/rss/search?q=코스피&hl=ko&gl=KR&ceid=KR:ko
//
//  2순위: GNews API (무료 100req/day, API 키 필요)
//    https://gnews.io/docs/
//
//  ⚠️  API 키는 반드시 환경변수에서만 로드합니다.
//      브라우저에서 직접 실행하지 마십시오.
// ══════════════════════════════════════════════════════════════════════

/** Google News RSS XML을 파싱해 뉴스 배열 반환 (API 키 불필요) */
async function collectNewsFromRSS() {
  console.log('\n📡 [뉴스 수집] Google News RSS 호출 (API 키 불필요)...');
  const queries = [
    '코스피 증시',
    '주식 시장 금리',
    '코스닥 경제',
  ];
  const allArticles = [];

  for (const q of queries) {
    try {
      const url = `https://news.google.com/rss/search`
        + `?q=${encodeURIComponent(q)}&hl=ko&gl=KR&ceid=KR:ko`;
      const xmlText = await fetchWithRetry(() => fetchUrl(url, { timeout: 10000 }), 1, 1000);
      if (typeof xmlText !== 'string') continue;

      // XML 간단 파싱 (Node.js 내장만 사용)
      const items = xmlText.match(/<item>([\s\S]*?)<\/item>/g) || [];
      items.slice(0, 5).forEach((item, idx) => {
        const extractTag = (tag) => {
          const cdataMatch = item.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[(.*?)\\]\\]><\\/${tag}>`, 's'));
          const plainMatch = item.match(new RegExp(`<${tag}[^>]*>(.*?)<\\/${tag}>`, 's'));
          return (cdataMatch || plainMatch || [])[1] || '';
        };
        const title   = extractTag('title').replace(/\s+/g, ' ').trim();
        const link    = extractTag('link').trim();
        const pubDate = extractTag('pubDate').trim();
        const source  = extractTag('source').replace(/<[^>]+>/g, '').trim() || 'Google News';
        const desc    = extractTag('description').replace(/<[^>]+>/g, '').trim();

        if (!title || title.length < 5) return;
        const text = `${title} ${desc}`;
        allArticles.push({
          id:             `rss_${Date.now()}_${idx}`,
          headline:       title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'"),
          summary:        desc.slice(0, 200) || title,
          insight:        null,
          source:         source.replace(/&amp;/g, '&'),
          sourceUrl:      link,
          publishedAt:    pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          category:       inferCategory(text),
          categoryLabel:  inferCategoryLabel(text),
          sentiment:      inferSentiment(text),
          impact:         'medium',
          relatedTickers: [],
          provider:       'google_news_rss',
          isMockData:     false,
        });
      });
      await sleep(400); // RSS 서버 부하 방지
    } catch (err) {
      console.warn(`  ⚠️  RSS 쿼리 [${q}] 실패: ${err.message}`);
    }
  }

  if (allArticles.length === 0) return null;

  // 중복 제목 제거 (첫 30자 기준)
  const seen = new Set();
  const deduped = allArticles.filter(a => {
    const key = a.headline.slice(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  updateStatus.newsRss = true;
  console.log(`  ✅ Google News RSS ${deduped.length}건 수집 완료`);
  return deduped;
}

async function collectNews(existingNews) {
  console.log('\n📰 [뉴스 수집] Google News RSS → GNews API 순으로 시도...');

  // ── 1순위: Google News RSS (API 키 불필요) ─────────────────────────
  const rssNews = await collectNewsFromRSS();
  if (rssNews && rssNews.length > 0) return rssNews;

  // ── 2순위: GNews API ────────────────────────────────────────────────
  if (!ENV.gnewsKey) {
    console.log('  ℹ️  GNEWS_API_KEY 미설정 → 기존 데이터 유지');
    return existingNews || [];
  }

  try {
    const url = `https://gnews.io/api/v4/search`
      + `?q=${encodeURIComponent('주식 코스피 증시')}`
      + `&lang=ko&country=kr&max=10`
      + `&apikey=${ENV.gnewsKey}`;

    const json = await fetchWithRetry(() => fetchUrl(url, { timeout: 12000 }));

    if (!json.articles || !json.articles.length) {
      console.warn('  ⚠️  GNews 응답 빈 배열 → 기존 데이터 유지');
      errors.push({ section: 'news', message: 'GNews 빈 응답' });
      return existingNews || [];
    }

    const now = new Date().toISOString();
    const articles = json.articles.map((a, idx) => {
      const text = `${a.title || ''} ${a.description || ''}`;
      return {
        id:           `gnews_${Date.now()}_${idx}`,
        headline:     a.title       || '',
        summary:      a.description || a.title || '',
        insight:      null,           // AI 요약은 아래 단계에서 enrichment
        source:       a.source?.name || 'GNews',
        sourceUrl:    a.url          || '',
        publishedAt:  a.publishedAt  || now,
        category:     inferCategory(text),
        categoryLabel: inferCategoryLabel(text),
        sentiment:    inferSentiment(text),
        impact:       'medium',
        relatedTickers: [],
        isMockData:   false,
      };
    });

    updateStatus.news = true;
    console.log(`  ✅ 뉴스 ${articles.length}건 수집 완료`);
    return articles;

  } catch (err) {
    console.error(`  ❌ GNews 수집 실패: ${err.message}`);
    errors.push({ section: 'news', message: err.message });
    return existingNews || [];
  }
}

// ══════════════════════════════════════════════════════════════════════
// ② 경제지표 일정 — Alpha Vantage Economic Calendar
//
//  Alpha Vantage: https://www.alphavantage.co/documentation/
//  무료 플랜: 25req/day
//  Economic Calendar endpoint: function=ECONOMIC_CALENDAR
//  응답 형식: CSV
// ══════════════════════════════════════════════════════════════════════

async function collectRiskCalendar(existingRisks) {
  console.log('\n📅 [리스크 캘린더] Alpha Vantage Economic Calendar 호출...');

  if (!ENV.alphaKey) {
    console.log('  ℹ️  ALPHA_VANTAGE_KEY 미설정 → 기존 데이터 유지 + D-Day 재계산');
    // 기존 데이터라도 D-Day는 현재 날짜 기준으로 재계산
    return (existingRisks || []).map(r => ({
      ...r,
      dDay: r.date ? calcDDay(r.date) : r.dDay,
    }));
  }

  try {
    const url = `https://www.alphavantage.co/query`
      + `?function=ECONOMIC_CALENDAR&horizon=3month&apikey=${ENV.alphaKey}`;

    const csvText = await fetchWithRetry(() => fetchUrl(url, { timeout: 12000 }));

    if (typeof csvText !== 'string' || !csvText.includes(',')) {
      throw new Error('Alpha Vantage CSV 응답 파싱 실패');
    }

    const lines  = csvText.trim().split('\n');
    const header = lines[0].split(',').map(h => h.trim());
    const today  = new Date();
    const future = new Date();
    future.setDate(future.getDate() + 45);
    const todayStr  = today.toISOString().split('T')[0];
    const futureStr = future.toISOString().split('T')[0];

    const events = lines.slice(1)
      .filter(line => line.trim())
      .map((line, idx) => {
        const cols = line.split(',');
        const raw  = {};
        header.forEach((h, i) => { raw[h] = (cols[i] || '').trim(); });
        return raw;
      })
      .filter(r => r.date >= todayStr && r.date <= futureStr)
      .filter(r => ['High', 'Medium'].includes(r.impact))
      .map((r, idx) => ({
        id:          `alpha_${idx}_${r.date}`,
        date:        r.date         || '',
        time:        r.time         || '미정',
        timezone:    'EST',
        title:       r.event        || '',
        description: buildCalendarDesc(r),
        type:        inferEventType(r.event || ''),
        impact:      (r.impact || '').toLowerCase(),
        country:     r.country      || 'US',
        previous:    r.previous     || null,
        forecast:    r.estimate     || null,
        actual:      r.actual || null,
        dDay:        calcDDay(r.date),
        source:      'alpha_vantage',
        isMockData:  false,
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 10);

    if (!events.length) {
      throw new Error('Alpha Vantage 고영향 이벤트 없음');
    }

    updateStatus.risks = true;
    console.log(`  ✅ 경제지표 이벤트 ${events.length}건 수집 완료`);
    return events;

  } catch (err) {
    console.error(`  ❌ Alpha Vantage 캘린더 수집 실패: ${err.message}`);
    errors.push({ section: 'risks', message: err.message });
    // 기존 데이터 + D-Day 재계산
    return (existingRisks || []).map(r => ({
      ...r,
      dDay: r.date ? calcDDay(r.date) : r.dDay,
    }));
  }
}

// ══════════════════════════════════════════════════════════════════════
// ③ AI 요약 생성 (선택적)
//
//  우선순위: Gemini Flash > Upstage Solar > OpenAI gpt-4o-mini
//  키가 없으면 기존 데이터 유지 (mock 또는 이전 생성 결과)
//
//  ⚠️  LLM API 키는 절대 브라우저에 노출하지 마십시오.
//      이 스크립트(서버/CI)에서만 사용합니다.
// ══════════════════════════════════════════════════════════════════════

async function generateAISummary(newsItems, existingSummary) {
  console.log('\n🤖 [AI 요약] 시장 브리프 생성...');

  const headlines = (newsItems || [])
    .slice(0, 8)
    .map((n, i) => `${i + 1}. ${n.headline || ''}`)
    .join('\n');

  const userPrompt = `다음 뉴스 헤드라인을 바탕으로 한국 주식 투자자를 위한 시장 브리프를 작성해주세요.
투자 매수/매도 추천은 하지 않으며, 정보 제공 목적으로만 작성합니다.

헤드라인:
${headlines || '(뉴스 데이터 없음)'}

아래 JSON 형식으로만 응답하세요:
{
  "headline": "오늘의 시장 핵심 한 줄 (30자 이내)",
  "body": "시장 상황 설명 (100~150자)",
  "keyTakeaways": ["핵심1", "핵심2", "핵심3", "핵심4"],
  "marketOutlook": "단기 전망 (예: '단기 중립~강세')",
  "outlookColor": "green 또는 yellow 또는 red"
}`;

  // Gemini Flash 시도 (무료 티어: 15req/min, 1500req/day)
  if (ENV.geminiKey) {
    try {
      console.log('  🔸 Gemini Flash 호출...');
      const res = await fetchWithRetry(() =>
        postUrl(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${ENV.geminiKey}`,
          {
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: {
              maxOutputTokens: 512,
              temperature: 0.3,
              responseMimeType: 'application/json',
            },
          }
        )
      );

      const text   = res.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsed = parseAiJson(text);
      if (parsed?.headline) {
        updateStatus.aiSummary = true;
        console.log('  ✅ Gemini Flash AI 요약 생성 완료');
        return {
          ...parsed,
          id:           'ai_summary_today',
          source:       'google_gemini',
          modelVersion: 'gemini-2.0-flash',
          generatedAt:  new Date().toISOString(),
          isMockData:   false,
        };
      }
    } catch (err) {
      console.warn(`  ⚠️  Gemini 실패: ${err.message}`);
      errors.push({ section: 'aiSummary', provider: 'gemini', message: err.message });
    }
  }

  // OpenAI gpt-4o-mini 시도 (fallback)
  if (ENV.openaiKey) {
    try {
      console.log('  🔸 OpenAI gpt-4o-mini 호출...');
      const res = await fetchWithRetry(() =>
        postUrl(
          'https://api.openai.com/v1/chat/completions',
          {
            model:       'gpt-4o-mini',
            max_tokens:  512,
            temperature: 0.3,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: '당신은 한국 주식시장 전문 금융 분석가입니다. 매수/매도 추천 없이 정보 제공 목적으로만 답변합니다.' },
              { role: 'user',   content: userPrompt },
            ],
          },
          { Authorization: `Bearer ${ENV.openaiKey}` }
        )
      );

      const text   = res.choices?.[0]?.message?.content || '';
      const parsed = parseAiJson(text);
      if (parsed?.headline) {
        updateStatus.aiSummary = true;
        console.log('  ✅ OpenAI AI 요약 생성 완료');
        return {
          ...parsed,
          id:           'ai_summary_today',
          source:       'openai_gpt4o_mini',
          modelVersion: 'gpt-4o-mini',
          generatedAt:  new Date().toISOString(),
          isMockData:   false,
        };
      }
    } catch (err) {
      console.warn(`  ⚠️  OpenAI 실패: ${err.message}`);
      errors.push({ section: 'aiSummary', provider: 'openai', message: err.message });
    }
  }

  // Anthropic Claude Haiku 시도 (fallback)
  if (ENV.anthropicKey) {
    try {
      console.log('  🔸 Anthropic Claude Haiku 호출...');
      const res = await fetchWithRetry(() =>
        postUrl(
          'https://api.anthropic.com/v1/messages',
          {
            model:       'claude-3-haiku-20240307',
            max_tokens:  512,
            temperature: 0.3,
            messages: [{ role: 'user', content: userPrompt }],
          },
          {
            'x-api-key':         ENV.anthropicKey,
            'anthropic-version': '2023-06-01',
          }
        )
      );

      const text   = res.content?.[0]?.text || '';
      const parsed = parseAiJson(text);
      if (parsed?.headline) {
        updateStatus.aiSummary = true;
        console.log('  ✅ Anthropic AI 요약 생성 완료');
        return {
          ...parsed,
          id:           'ai_summary_today',
          source:       'anthropic_claude_haiku',
          modelVersion: 'claude-3-haiku-20240307',
          generatedAt:  new Date().toISOString(),
          isMockData:   false,
        };
      }
    } catch (err) {
      console.warn(`  ⚠️  Anthropic 실패: ${err.message}`);
      errors.push({ section: 'aiSummary', provider: 'anthropic', message: err.message });
    }
  }

  // 모든 AI 실패 → 기존 데이터 유지
  console.log('  ℹ️  AI 키 없음 또는 모든 AI 실패 → 기존 AI 요약 유지');
  return existingSummary || null;
}

// ══════════════════════════════════════════════════════════════════════
// ④ 뉴스 인사이트 Enrichment (뉴스 수집 성공 + AI 키 있을 때)
//
//  각 뉴스 아이템에 AI 인사이트 필드를 추가합니다.
//  호출 비용 절감을 위해 상위 5건만 처리합니다.
// ══════════════════════════════════════════════════════════════════════

async function enrichNewsWithAI(newsItems) {
  if (!newsItems || !newsItems.length) return newsItems;
  if (!ENV.geminiKey && !ENV.openaiKey && !ENV.anthropicKey) {
    return newsItems;
  }

  console.log('\n✨ [뉴스 인사이트] AI Enrichment (상위 5건)...');

  const toEnrich = newsItems.slice(0, 5);
  const rest     = newsItems.slice(5);

  const enriched = await Promise.allSettled(
    toEnrich.map(async (item) => {
      const prompt = `다음 뉴스를 한국 주식 투자자 관점에서 2문장으로 요약해주세요. 매수/매도 추천 없이 정보 제공만 합니다.
제목: ${item.headline}
요약: ${item.summary}
JSON 형식: { "insight": "..." }`;

      try {
        if (ENV.geminiKey) {
          const res = await postUrl(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${ENV.geminiKey}`,
            {
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { maxOutputTokens: 128, temperature: 0.2, responseMimeType: 'application/json' },
            }
          );
          const text   = res.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const parsed = parseAiJson(text);
          if (parsed?.insight) return { ...item, insight: parsed.insight };
        }
      } catch (_) { /* 실패 시 원본 유지 */ }

      return item;
    })
  );

  const result = [
    ...enriched.map(r => r.status === 'fulfilled' ? r.value : r.reason),
    ...rest,
  ];

  console.log(`  ✅ 뉴스 인사이트 enrichment 완료`);
  return result;
}

// ══════════════════════════════════════════════════════════════════════
// ⑤ 공통 텍스트 분석 유틸 (Node.js용 — services/newsApi.js와 동일 로직)
// ══════════════════════════════════════════════════════════════════════

function inferCategory(text) {
  const t = text.toLowerCase();
  if (/fomc|연준|fed |금리|jerome powell|파월|통화정책/.test(t))      return 'fed';
  if (/어닝|실적|매출|영업이익|순이익|eps/.test(t))                    return 'earnings';
  if (/비트코인|이더리움|crypto|암호화폐|btc|eth/.test(t))             return 'crypto';
  if (/gdp|cpi|pce|인플레이션|고용|실업률|무역수지/.test(t))          return 'macro';
  if (/반도체|hbm|dram|nand|nvda|엔비디아|tsmc/.test(t))              return 'sector';
  if (/규제|정책|법안|금감원|금융당국/.test(t))                        return 'policy';
  if (/중국|미국|유럽|일본|글로벌|무역전쟁|관세/.test(t))             return 'global';
  return 'macro';
}

function inferCategoryLabel(text) {
  const map = {
    fed: '연준', earnings: '실적', crypto: '암호화폐',
    macro: '거시경제', sector: '섹터', policy: '정책·규제', global: '글로벌',
  };
  return map[inferCategory(text)] || '거시경제';
}

function inferSentiment(text) {
  const t = text.toLowerCase();
  const pos = ['상승','호재','급등','서프라이즈','반등','순매수','성장','수주','beat','surge','rally'].filter(k => t.includes(k)).length;
  const neg = ['하락','악재','급락','쇼크','우려','순매도','위기','손실','miss','fall','drop','부진'].filter(k => t.includes(k)).length;
  if (pos > neg) return 'positive';
  if (neg > pos) return 'negative';
  return 'neutral';
}

function inferEventType(name) {
  const n = name.toUpperCase();
  if (/FOMC|FEDERAL RESERVE|INTEREST RATE/.test(n)) return 'fomc';
  if (/CPI|CONSUMER PRICE/.test(n))                  return 'cpi';
  if (/PCE|PERSONAL CONSUMPTION/.test(n))            return 'pce';
  if (/NONFARM|PAYROLL|EMPLOYMENT|JOBLESS/.test(n))  return 'jobs';
  if (/GDP/.test(n))                                  return 'gdp';
  if (/ISM|PMI/.test(n))                              return 'ism';
  if (/OPTIONS?|EXPIR/.test(n))                       return 'options_expiry';
  if (/EARNINGS/.test(n))                             return 'earnings';
  return 'other';
}

function buildCalendarDesc(r) {
  const parts = [];
  if (r.country)  parts.push(r.country);
  if (r.previous) parts.push(`이전: ${r.previous}`);
  if (r.estimate) parts.push(`예측: ${r.estimate}`);
  if (r.actual)   parts.push(`실제: ${r.actual}`);
  return parts.join(' | ') || r.event || '';
}

// ══════════════════════════════════════════════════════════════════════
// _meta 상태 판정
// ══════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════
// ④ DART 공시 수집 — OpenDART (무료, API 키 필요)
//
//  DART API: https://opendart.fss.or.kr/
//  무료 발급: 금융감독원 DART 개발자 센터 회원가입
//  사용 엔드포인트: /api/list.json (최근 공시 목록)
// ══════════════════════════════════════════════════════════════════════

async function collectDartDisclosures(existingDisclosures) {
  console.log('\n📋 [DART 공시] OpenDART API 호출...');

  if (!ENV.dartKey) {
    console.log('  ℹ️  DART_API_KEY 미설정 → 기존 데이터 유지');
    return existingDisclosures || [];
  }

  try {
    // 최근 1일 주요 공시 (KOSPI 상장사)
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const url = `https://opendart.fss.or.kr/api/list.json`
      + `?crtfc_key=${ENV.dartKey}`
      + `&bgn_de=${today}&end_de=${today}`
      + `&pblntf_ty=A&corp_cls=Y`  // 유가증권 상장사, 정기공시
      + `&page_no=1&page_count=10`;

    const json = await fetchWithRetry(() => fetchUrl(url, { timeout: 12000 }));

    if (json.status !== '000' || !json.list) {
      console.warn(`  ⚠️  DART 응답 오류: ${json.message || JSON.stringify(json).slice(0, 100)}`);
      return existingDisclosures || [];
    }

    const disclosures = json.list.map(d => ({
      id:           `dart_${d.rcept_no}`,
      corpName:     d.corp_name,
      corpCode:     d.corp_code,
      stockCode:    d.stock_code,
      reportName:   d.report_nm,
      receivedAt:   d.rcept_dt  // 'YYYYMMDD' 형식
        ? `${d.rcept_dt.slice(0,4)}-${d.rcept_dt.slice(4,6)}-${d.rcept_dt.slice(6,8)}`
        : new Date().toISOString().split('T')[0],
      url:          `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${d.rcept_no}`,
      importance:   d.report_nm?.includes('분기') || d.report_nm?.includes('반기') ? 'high' : 'medium',
      isMockData:   false,
    }));

    updateStatus.disclosures = true;
    console.log(`  ✅ DART 공시 ${disclosures.length}건 수집 완료`);
    return disclosures;

  } catch (err) {
    console.error(`  ❌ DART 공시 수집 실패: ${err.message}`);
    errors.push({ section: 'disclosures', message: err.message });
    return existingDisclosures || [];
  }
}

// ══════════════════════════════════════════════════════════════════════
// ⑤ 가상자산 시세 — CoinGecko (무료, API 키 선택)
//
//  CoinGecko API: https://www.coingecko.com/en/api/documentation
//  무료 플랜: API 키 없이 사용 가능 (단, rate limit 낮음)
//  Pro 플랜 키: Developer Dashboard에서 발급
// ══════════════════════════════════════════════════════════════════════

async function collectCryptoPrices(existingCrypto) {
  console.log('\n🪙 [가상자산] CoinGecko API 호출...');

  const COINS = ['bitcoin', 'ethereum', 'ripple', 'solana'];

  try {
    // API 키가 있으면 헤더에 포함, 없어도 무료 엔드포인트 사용
    const baseUrl = ENV.coingeckoKey
      ? 'https://pro-api.coingecko.com/api/v3'
      : 'https://api.coingecko.com/api/v3';

    const headers = ENV.coingeckoKey
      ? { 'x-cg-pro-api-key': ENV.coingeckoKey }
      : {};

    const url = `${baseUrl}/coins/markets`
      + `?vs_currency=usd&ids=${COINS.join(',')}`
      + `&order=market_cap_desc&per_page=10&page=1`
      + `&price_change_percentage=24h`;

    const json = await fetchWithRetry(
      () => fetchUrl(url, { timeout: 10000, headers }),
      1, 2000
    );

    if (!Array.isArray(json) || json.length === 0) {
      console.warn('  ⚠️  CoinGecko 빈 응답 → 기존 데이터 유지');
      return existingCrypto || [];
    }

    const prices = json.map(c => ({
      id:              c.id,
      symbol:          c.symbol?.toUpperCase(),
      name:            c.name,
      priceUsd:        c.current_price,
      change24h:       c.price_change_percentage_24h,
      marketCapRank:   c.market_cap_rank,
      updatedAt:       new Date().toISOString(),
      isMockData:      false,
    }));

    updateStatus.cryptoPrices = true;
    console.log(`  ✅ CoinGecko ${prices.length}개 코인 시세 수집 완료`);
    return prices;

  } catch (err) {
    console.error(`  ❌ CoinGecko 수집 실패: ${err.message}`);
    errors.push({ section: 'cryptoPrices', message: err.message });
    return existingCrypto || [];
  }
}

// ══════════════════════════════════════════════════════════════════════
// ⑥ Finnhub 시장 시그널 — 주요 지수 Quote + 시장 상태
//
//  Finnhub API: https://finnhub.io/docs/api
//  무료 플랜: 60req/min, 실시간 US 주가, 국제 주가 일부
//  사용 엔드포인트: /quote, /market-status
// ══════════════════════════════════════════════════════════════════════

async function collectFinnhubSignal(existingSignal) {
  console.log('\n📊 [Finnhub 시그널] Finnhub API 호출...');

  if (!ENV.finnhubKey) {
    console.log('  ℹ️  FINNHUB_API_KEY 미설정 → 기존 데이터 유지');
    return existingSignal || null;
  }

  // 조회할 주요 심볼 (Finnhub 심볼 형식)
  const SYMBOLS = [
    { symbol: 'SPY',       label: 'S&P 500 ETF',  region: 'US' },
    { symbol: 'QQQ',       label: 'NASDAQ 100',    region: 'US' },
    { symbol: 'DX-Y.NYB',  label: 'USD Index',     region: 'FX' },
    { symbol: 'GC=F',      label: '금 선물',       region: 'Commodity' },
  ];

  const quotes = [];
  for (const item of SYMBOLS) {
    try {
      const url = `https://finnhub.io/api/v1/quote`
        + `?symbol=${encodeURIComponent(item.symbol)}`
        + `&token=${ENV.finnhubKey}`;
      const q = await fetchWithRetry(() => fetchUrl(url, { timeout: 8000 }));

      if (q && q.c && q.c > 0) {
        quotes.push({
          symbol:        item.symbol,
          label:         item.label,
          region:        item.region,
          price:         q.c,
          change:        q.d,
          changePercent: q.dp,
          high:          q.h,
          low:           q.l,
          open:          q.o,
          prevClose:     q.pc,
          updatedAt:     new Date().toISOString(),
          isMockData:    false,
        });
      }
      await sleep(200); // 60req/min 한도 준수
    } catch (err) {
      console.warn(`  ⚠️  Finnhub [${item.symbol}] 실패: ${err.message}`);
    }
  }

  if (quotes.length === 0) {
    console.warn('  ⚠️  Finnhub 전체 실패 → 기존 데이터 유지');
    return existingSignal || null;
  }

  updateStatus.finnhubSignal = true;
  console.log(`  ✅ Finnhub ${quotes.length}개 심볼 시세 수집 완료`);
  return {
    quotes,
    collectedAt: new Date().toISOString(),
    provider:    'finnhub',
    isMockData:  false,
  };
}

// ══════════════════════════════════════════════════════════════════════
// _meta 판정 헬퍼
// ══════════════════════════════════════════════════════════════════════

function calcMetaStatus() {
  const successCount = Object.values(updateStatus).filter(Boolean).length;
  const totalCount   = Object.keys(updateStatus).length;

  if (successCount === 0)              return 'mock';
  if (successCount >= totalCount * 0.7) return 'healthy';
  return 'degraded';
}

function buildSourcesMap() {
  const sources = {};
  // 뉴스
  if (updateStatus.newsRss)       sources.news         = 'google_news_rss (무료)';
  else if (updateStatus.news)     sources.news         = 'gnews';
  else                            sources.news         = 'mock (기존 유지)';
  // 경제 캘린더
  if (updateStatus.risks)         sources.riskCalendar = ENV.alphaKey ? 'alpha_vantage' : ENV.fredKey ? 'fred' : 'mock';
  else                            sources.riskCalendar = 'mock (기존 유지)';
  // AI 요약
  if (updateStatus.aiSummary)     sources.aiSummary    = 'ai_generated';
  else                            sources.aiSummary    = 'mock (기존 유지)';
  // DART 공시
  if (updateStatus.disclosures)   sources.disclosures  = 'opendart';
  else                            sources.disclosures  = 'mock (기존 유지)';
  // 가상자산
  if (updateStatus.cryptoPrices)  sources.crypto       = 'coingecko';
  else                            sources.crypto       = 'mock (기존 유지)';
  // Finnhub 시그널
  if (updateStatus.finnhubSignal) sources.marketSignal = 'finnhub';
  else                            sources.marketSignal = 'mock (기존 유지)';

  sources.marketIndices = ENV.finnhubKey ? 'finnhub (부분)' : 'mock (수동 업데이트 필요)';
  sources.investorFlows = 'mock (수동 업데이트 필요)';
  sources.sectorTrends  = 'mock (수동 업데이트 필요)';
  return sources;
}

// ══════════════════════════════════════════════════════════════════════
// 메인 실행
// ══════════════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Market Pulse Korea — Dashboard Data Update  ║');
  console.log(`║  실행 시각: ${new Date().toISOString()}  ║`);
  console.log('╚══════════════════════════════════════════════╝\n');

  // 1. 기존 데이터 로드
  const existing = loadExistingData();

  // 2. 각 섹션 병렬 수집 (실패해도 기존 데이터 유지)
  console.log('\n⚙️  병렬 데이터 수집 시작...');
  const [
    news,
    risks,
    disclosures,
    cryptoPrices,
    marketSignal,
  ] = await Promise.allSettled([
    collectNews(existing?.news),
    collectRiskCalendar(existing?.risks),
    collectDartDisclosures(existing?.disclosures),
    collectCryptoPrices(existing?.cryptoPrices),
    collectFinnhubSignal(existing?.marketSignal),
  ]).then(results => results.map(r =>
    r.status === 'fulfilled' ? r.value : (console.error('섹션 오류:', r.reason?.message), null)
  ));

  // 3. AI 요약 생성 (뉴스 수집 완료 후 순차 실행)
  const enrichedNews = news ? await enrichNewsWithAI(news) : null;
  const aiSummary    = await generateAISummary(enrichedNews || existing?.news, existing?.aiSummary);

  // 4. 결과 조합 — 실패한 섹션은 기존 데이터 유지 (null-safe)
  const now          = new Date().toISOString();
  const nextUpdateAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const result = {
    _meta: {
      schemaVersion:   '4.0',
      generatedAt:     now,
      generatedBy:     'scripts/updateDashboardData.js',
      status:          calcMetaStatus(),
      dataDisclaimer:  '이 데이터는 최대 30~60분 지연될 수 있으며, 일부 항목은 누락되거나 부정확할 수 있습니다. 투자 참고용 정보이며 매수·매도를 추천하지 않습니다.',
      sources:         buildSourcesMap(),
      errors:          errors,
      nextUpdateAt:    nextUpdateAt,
    },
    // 실패 시 기존 데이터 유지 (null-safe)
    overview:     existing?.overview     || null,
    indices:      existing?.indices      || [],
    ticker:       existing?.ticker       || [],
    stocks:       existing?.stocks       || [],
    sectors:      existing?.sectors      || [],
    keyIssues:    existing?.keyIssues    || [],
    news:         enrichedNews || news   || existing?.news         || [],
    risks:        risks                  || existing?.risks        || [],
    flows:        existing?.flows        || null,
    aiSummary:    aiSummary              || existing?.aiSummary    || null,
    disclosures:  disclosures            || existing?.disclosures  || [],
    cryptoPrices: cryptoPrices           || existing?.cryptoPrices || [],
    marketSignal: marketSignal           || existing?.marketSignal || null,
  };

  // 5. 파일 저장
  try {
    const dir = path.dirname(DATA_FILE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(result, null, 2), 'utf8');
    console.log(`\n✅ data/latestDashboardData.json 저장 완료`);
  } catch (err) {
    console.error('❌ 파일 저장 실패:', err.message);
    process.exit(1);
  }

  // 6. 결과 요약
  const status = calcMetaStatus();
  console.log('\n══ 업데이트 결과 요약 ══════════════════════════');
  console.log(`  Status    : ${status === 'healthy' ? '✅ healthy' : status === 'degraded' ? '⚠️  degraded' : '🟡 mock'}`);
  console.log(`  뉴스 (RSS)  : ${updateStatus.newsRss      ? '✅' : '⏭️  기존 유지'}`);
  console.log(`  뉴스 (API)  : ${updateStatus.news          ? '✅' : '—'}`);
  console.log(`  캘린더      : ${updateStatus.risks          ? '✅' : '⏭️  기존 유지'}`);
  console.log(`  AI 요약     : ${updateStatus.aiSummary      ? '✅' : '⏭️  기존 유지'}`);
  console.log(`  DART 공시   : ${updateStatus.disclosures    ? '✅' : '⏭️  기존 유지'}`);
  console.log(`  가상자산    : ${updateStatus.cryptoPrices   ? '✅' : '⏭️  기존 유지'}`);
  console.log(`  시장 시그널 : ${updateStatus.finnhubSignal  ? '✅' : '⏭️  기존 유지'}`);
  console.log(`  오류        : ${errors.length}건`);
  if (errors.length) {
    errors.forEach(e => console.log(`    - [${e.section}] ${e.message}`));
  }
  console.log('════════════════════════════════════════════════\n');

  process.exit(0);
}

main().catch(err => {
  console.error('💥 치명적 오류:', err);
  process.exit(1);
});
