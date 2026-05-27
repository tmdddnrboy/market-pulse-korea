/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║       Market Pulse Korea — Dashboard Engine v4.0                ║
 * ║                                                                  ║
 * ║  배포 대상: Blogger/블로그스팟 테마 (또는 GitHub Pages)         ║
 * ║                                                                  ║
 * ║  데이터 소스 전략:                                               ║
 * ║    1순위: DASHBOARD_JSON_URL (설정된 외부 JSON URL)             ║
 * ║           → GitHub Pages의 latestDashboardData.json             ║
 * ║           → 예) https://<user>.github.io/<repo>/data/           ║
 * ║                 latestDashboardData.json                         ║
 * ║    2순위: 상대경로 data/latestDashboardData.json (로컬/테스트)  ║
 * ║    3순위: mockData.js의 MOCK_* 객체 (완전 fallback)             ║
 * ║                                                                  ║
 * ║  ⚠️  이 파일은 외부 API를 직접 호출하지 않습니다.              ║
 * ║      모든 API 호출은 scripts/updateDashboardData.js 에서만      ║
 * ║      서버/CI(GitHub Actions) 환경에서 수행됩니다.               ║
 * ║      API 키는 절대 이 파일에 포함하지 마십시오.                 ║
 * ║                                                                  ║
 * ║  Blogger 적용 방법:                                             ║
 * ║    1. DASHBOARD_JSON_URL 을 GitHub Pages 공개 URL로 교체        ║
 * ║    2. <script src="...dashboard.js"></script> 을 테마에 삽입    ║
 * ║    3. mockData.js 도 테마에 dashboard.js 앞에 삽입              ║
 * ║                                                                  ║
 * ║  데이터 흐름:                                                   ║
 * ║    GitHub Actions (30분) → latestDashboardData.json (GitHub)   ║
 * ║      → Blogger fetch → renderAll() → 10개 섹션 렌더            ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

'use strict';

// ══════════════════════════════════════════════════════════════════════
// ★ Blogger / 외부 배포 설정
//   Blogger 테마에 적용 시, 이 URL을 GitHub Pages 공개 URL로 교체하세요.
//   예: 'https://your-username.github.io/market-pulse-korea/data/latestDashboardData.json'
//   로컬 개발/GitHub Pages 직접 서빙 시에는 빈 문자열('')로 두면 상대경로 사용.
// ══════════════════════════════════════════════════════════════════════
const DASHBOARD_JSON_URL = (function () {
  // 1) HTML의 <meta name="dashboard-json-url" content="..."> 태그에서 읽기
  //    Blogger 테마 편집기에서 이 방법이 가장 유연합니다.
  const metaTag = document.querySelector('meta[name="dashboard-json-url"]');
  if (metaTag && metaTag.content && metaTag.content.startsWith('http')) {
    return metaTag.content;
  }
  // 2) window.DASHBOARD_JSON_URL 전역 변수 (테마 <script>에서 직접 설정 가능)
  if (typeof window.DASHBOARD_JSON_URL === 'string' && window.DASHBOARD_JSON_URL.startsWith('http')) {
    return window.DASHBOARD_JSON_URL;
  }
  // 3) 기본값: 상대경로 (GitHub Pages 직접 서빙 또는 로컬 테스트)
  return '';
}());

// ══════════════════════════════════════════════════════════════════════
// 전역 상태
// ══════════════════════════════════════════════════════════════════════
const AppState = {
  data:                null,
  isLoading:           false,
  error:               null,
  lastUpdated:         null,
  dataGeneratedAt:     null,   // JSON의 _meta.generatedAt (서버 생성 시각)
  dataStatus:          'mock', // 'healthy' | 'degraded' | 'mock'
  sectionUpdatedAt:    {},
  refreshTimer:        null,
  progressTimer:       null,
  progressValue:       0,
  // JSON 갱신 주기(30분)에 맞춰 프론트도 30분마다 re-fetch
  AUTO_REFRESH_INTERVAL: 30 * 60 * 1000,  // 30분 (ms)
  PROGRESS_INTERVAL:   1000,
};

// ══════════════════════════════════════════════════════════════════════
// DOM 레퍼런스 (lazy getter 패턴 — 매번 쿼리하지 않음)
// ══════════════════════════════════════════════════════════════════════
const DOM = {
  tickerTape:        () => document.getElementById('ticker-tape-inner'),
  indicesGrid:       () => document.getElementById('indices-grid'),
  stockGrid:         () => document.getElementById('stock-grid'),
  sectorList:        () => document.getElementById('sector-list'),
  newsList:          () => document.getElementById('news-list'),
  riskList:          () => document.getElementById('risk-list'),
  checkpointSection: () => document.getElementById('checkpoint-section'),
  heroSentiment:     () => document.getElementById('hero-sentiment'),
  heroFlow:          () => document.getElementById('hero-flow'),
  lastUpdatedText:   () => document.getElementById('last-updated-text'),
  statusDot:         () => document.getElementById('status-dot'),
  refreshBtn:        () => document.getElementById('refresh-btn'),
  loadingOverlay:    () => document.getElementById('loading-overlay'),
  errorBanner:       () => document.getElementById('error-banner'),
  errorMsg:          () => document.querySelector('.error-msg'),
  progressBar:       () => document.getElementById('refresh-progress'),
  mockBadge:         () => document.getElementById('mock-data-badge'),
};

// ══════════════════════════════════════════════════════════════════════
// 진입점
// ══════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
  bindEvents();
});

async function initDashboard() {
  showInitialLoading();
  await loadData(false);
  startAutoRefresh();
  startProgressBar();
}

// ══════════════════════════════════════════════════════════════════════
// 데이터 로드 & 렌더 오케스트레이터
// ══════════════════════════════════════════════════════════════════════
async function loadData(isRefresh = false) {
  setLoadingState(true, isRefresh);

  try {
    // ── 1순위: data/latestDashboardData.json fetch ──────────────────
    // GitHub Actions가 30분마다 갱신하는 정적 JSON 파일을 읽습니다.
    // 이 파일은 외부 API를 직접 호출하지 않습니다.
    const dashboardData = await fetchJsonData();

    AppState.data            = dashboardData;
    AppState.error           = null;
    AppState.lastUpdated     = new Date();
    AppState.dataGeneratedAt = dashboardData._meta?.generatedAt || null;
    AppState.dataStatus      = dashboardData._meta?.status      || 'mock';

    renderAll(dashboardData);
    setLoadingState(false);
    hideError();
    updateHeaderTimestamp();
    updateDataStatusBadge(dashboardData);

    if (isRefresh) flashRefreshSuccess();

    // 부분 실패 경고
    if (dashboardData._meta?.errors?.length > 0) {
      const failedSections = dashboardData._meta.errors.map(e => e.section || e.key).join(', ');
      console.warn('[Dashboard] 일부 섹션 데이터 누락 (기존 데이터 유지):', failedSections);
    }

  } catch (err) {
    console.error('[Dashboard] 데이터 로드 실패:', err);
    AppState.error = err;
    setLoadingState(false);
    showError('저장된 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    showToast('데이터 로드에 실패했습니다', 'error');
  }
}

// ══════════════════════════════════════════════════════════════════════
// JSON 데이터 fetch
//   1순위: DASHBOARD_JSON_URL (Blogger → GitHub Pages 공개 URL)
//   2순위: 상대경로 data/latestDashboardData.json (로컬/GitHub Pages 직접)
//   3순위: mockData.js의 fetchDashboardData() (완전 fallback)
// ══════════════════════════════════════════════════════════════════════
async function fetchJsonData() {

  // ── 공통 fetch 헬퍼 ──────────────────────────────────────────────
  async function tryFetch(url, label) {
    const res = await fetch(url, {
      cache: 'no-cache',
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    console.log(`[Dashboard] ${label} 로드 완료 —`,
      json._meta?.generatedAt || '시각 미상',
      `(${json._meta?.status || 'unknown'})`);
    return json;
  }

  // ── 1순위: DASHBOARD_JSON_URL (Blogger → GitHub Pages) ───────────
  if (DASHBOARD_JSON_URL) {
    try {
      return await tryFetch(DASHBOARD_JSON_URL, `외부 JSON (${DASHBOARD_JSON_URL.split('/').pop()})`);
    } catch (err) {
      console.warn('[Dashboard] 외부 JSON URL 로드 실패 → 상대경로 시도:', err.message);
    }
  }

  // ── 2순위: 상대경로 (로컬 / GitHub Pages 직접 서빙) ──────────────
  try {
    return await tryFetch('data/latestDashboardData.json', 'latestDashboardData.json');
  } catch (err) {
    console.warn('[Dashboard] 상대경로 JSON 로드 실패 → mock fallback:', err.message);
  }

  // ── 3순위: mockData.js fallback ───────────────────────────────────
  if (typeof fetchDashboardData === 'function') {
    console.log('[Dashboard] mock fallback 사용 (mockData.js)');
    const mockData = await fetchDashboardData();
    mockData._meta             = mockData._meta || {};
    mockData._meta.status      = 'mock';
    mockData._meta.generatedAt = new Date().toISOString();
    return mockData;
  }

  // ── 모든 소스 실패 ────────────────────────────────────────────────
  throw new Error('데이터를 불러오지 못했습니다 (JSON 로드 실패, mockData.js 없음)');
}

// ══════════════════════════════════════════════════════════════════════
// 전체 렌더 오케스트레이터
// ══════════════════════════════════════════════════════════════════════
function renderAll(d) {
  // 각 섹션 데이터가 null이면 empty state 렌더
  renderTickerTape(d.ticker    || d.indices || []);
  renderMarketHero(d.overview, d.flows, d.keyIssues);
  renderIndices(d.indices      || []);
  renderStocks(d.stocks        || []);
  renderSectors(d.sectors      || []);
  renderCheckpoints(d.keyIssues);
  renderNews(d.news            || []);
  renderRisks(d.risks          || []);

  // 섹션별 타임스탬프 업데이트
  updateSectionTimestamps(d);
}

// ══════════════════════════════════════════════════════════════════════
// ① 티커 테이프
// ══════════════════════════════════════════════════════════════════════
function renderTickerTape(items) {
  const el = DOM.tickerTape();
  if (!el) return;

  if (!items || items.length === 0) {
    el.innerHTML = '<div class="ticker-item"><span class="ticker-name">데이터 없음</span></div>';
    return;
  }

  // 무한 스크롤을 위해 2배 복제
  const doubled = [...items, ...items];
  el.innerHTML = doubled.map(item => {
    const pct   = item.changePercent ?? 0;
    const trend = item.trend ?? (pct >= 0 ? 'up' : 'down');
    const fmt   = formatTickerValue(item);
    return `
      <div class="ticker-item">
        <span class="ticker-name">${item.name}</span>
        <span class="ticker-value">${fmt}</span>
        <span class="ticker-change ${trend}">
          ${trend === 'up' ? '▲' : '▼'} ${Math.abs(pct).toFixed(2)}%
        </span>
      </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════════════
// ② 마켓 히어로 (센티멘트 게이지 + 투자자 수급)
// ══════════════════════════════════════════════════════════════════════
function renderMarketHero(overview, flows, keyIssues) {
  renderSentimentGauge(overview);
  renderInvestorFlows(flows);
}

function renderSentimentGauge(overview) {
  const el = DOM.heroSentiment();
  if (!el) return;

  // overview null 처리 — empty state
  if (!overview) {
    el.innerHTML = `<div class="empty-state-mini">센티멘트 데이터 없음</div>`;
    return;
  }

  const score         = overview.sentimentScore ?? 50;
  const label         = overview.sentimentLabel ?? '-';
  const gaugeColor    = score >= 60 ? '#34d399' : score >= 40 ? '#fbbf24' : '#f87171';
  const circumference = Math.PI * 50;  // viewBox 기준 r=50 반원
  const offset        = circumference * (1 - score / 100);

  el.innerHTML = `
    <div class="sentiment-label-top">시장 센티멘트</div>
    <div class="gauge-wrap">
      <svg class="gauge-svg" viewBox="0 0 120 70">
        <path d="M 10 65 A 50 50 0 0 1 110 65"
          fill="none" stroke="#1e2640" stroke-width="10"/>
        <path d="M 10 65 A 50 50 0 0 1 110 65"
          fill="none" stroke-width="10" stroke-linecap="round"
          stroke="${gaugeColor}"
          stroke-dasharray="${circumference.toFixed(2)}"
          stroke-dashoffset="${offset.toFixed(2)}"/>
        <text x="60" y="62" text-anchor="middle"
          font-size="18" font-weight="800" fill="#e8ecf4"
          font-family="'JetBrains Mono', monospace">${score}</text>
      </svg>
    </div>
    <div class="gauge-status" style="color:${gaugeColor}">${label}</div>
    ${overview.isMockData
      ? '<div style="font-size:10px;color:var(--text-muted);margin-top:4px">MOCK DATA</div>'
      : ''}
  `;
}

function renderInvestorFlows(flows) {
  const el = DOM.heroFlow();
  if (!el) return;

  if (!flows) {
    el.innerHTML = `<div class="empty-state-mini">수급 데이터 없음</div>`;
    return;
  }

  const rows = [
    { label: '외국인',  data: flows.foreign },
    { label: '기관',    data: flows.institutional },
    { label: '개인',    data: flows.retail },
  ];

  el.innerHTML = `
    <div class="flow-title">
      투자자별 수급
      ${flows.isMockData ? '<span style="font-size:10px;color:var(--text-muted);margin-left:4px">MOCK</span>' : ''}
    </div>
    ${rows.map(r => {
      if (!r.data) return '';
      const cls = r.data.net >= 0 ? 'up' : 'down';
      return `
        <div class="flow-row">
          <span class="flow-label">${r.label}</span>
          <span class="flow-value ${cls}">${r.data.formatted}</span>
        </div>`;
    }).join('')}
  `;
}

// ══════════════════════════════════════════════════════════════════════
// ③ 시장 지수 카드
// ══════════════════════════════════════════════════════════════════════
function renderIndices(indices) {
  const el = DOM.indicesGrid();
  if (!el) return;

  if (!indices || indices.length === 0) {
    el.innerHTML = renderEmptyState('지수 데이터를 불러오지 못했습니다.', '📊');
    return;
  }

  el.innerHTML = indices.map(idx => {
    const trend = idx.trend ?? (idx.changePercent >= 0 ? 'up' : 'down');
    return `
      <div class="index-card ${trend} animate-in" role="listitem">
        <div class="index-name">${idx.name}</div>
        <div class="index-value">${formatIndexValue(idx)}</div>
        <div class="index-change-row">
          <span class="index-change ${trend}">
            ${idx.changePercent >= 0 ? '+' : ''}${formatIndexChange(idx)}
          </span>
          <span class="index-pct-badge ${trend}">
            ${idx.changePercent >= 0 ? '+' : ''}${(idx.changePercent ?? 0).toFixed(2)}%
          </span>
        </div>
        <div class="sparkline-wrap" aria-hidden="true">
          ${renderSparklineSVG(idx.sparkline, trend)}
        </div>
        ${idx.isMockData
          ? '<div class="index-mock-label">MOCK</div>'
          : `<div class="index-updated">${formatShortTime(idx.lastUpdated)}</div>`}
      </div>`;
  }).join('');
}

// SVG 스파크라인
function renderSparklineSVG(data, trend) {
  if (!data || data.length < 2) return '';
  const W = 100, H = 32;
  const min   = Math.min(...data);
  const max   = Math.max(...data);
  const range = max - min || 1;
  const pts   = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const color  = trend === 'up' ? '#34d399' : '#f87171';
  const gradId = `sg_${Math.random().toString(36).slice(2, 8)}`;
  const area   = `0,${H} ${pts} ${W},${H}`;
  return `
    <svg class="sparkline-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <polygon points="${area}" fill="url(#${gradId})"/>
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`;
}

// ══════════════════════════════════════════════════════════════════════
// ④ 종목 워치리스트 카드
// ══════════════════════════════════════════════════════════════════════
function renderStocks(stocks) {
  const el = DOM.stockGrid();
  if (!el) return;

  if (!stocks || stocks.length === 0) {
    el.innerHTML = renderEmptyState('종목 데이터를 불러오지 못했습니다.', '📈');
    return;
  }

  el.innerHTML = stocks.map(s => {
    const trend = s.momentum ?? (s.changePercent >= 0 ? 'up' : 'down');
    return `
      <article class="stock-card animate-in" role="listitem" data-ticker="${s.ticker ?? ''}">
        <header class="stock-card-header">
          <div class="stock-name-wrap">
            <div class="stock-name">${s.name}</div>
            <div class="stock-meta">
              <span>${s.ticker}</span>
              <span>·</span>
              <span>${s.sector ?? ''}</span>
              ${s.relatedNewsCount > 0
                ? `<span style="color:var(--cat-blue);font-size:10px">뉴스 ${s.relatedNewsCount}</span>`
                : ''}
            </div>
          </div>
          <span class="stock-signal ${s.signalColor ?? 'yellow'}">${s.signal ?? '-'}</span>
        </header>

        <div class="stock-price-row">
          <span class="stock-price">
            ${(s.price ?? 0).toLocaleString()}<small style="font-size:12px;font-weight:500;color:var(--text-muted)">원</small>
          </span>
          <span class="stock-change ${trend}">
            ${(s.changePercent ?? 0) >= 0 ? '+' : ''}${(s.changePercent ?? 0).toFixed(2)}%
          </span>
        </div>

        <p class="stock-ai-summary">${s.aiInsight ?? s.aiSummary ?? '데이터 없음'}</p>

        ${s.riskTags && s.riskTags.length > 0
          ? `<div class="stock-risk-tags" style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:6px">
              ${s.riskTags.map(t =>
                `<span class="tag" style="border-color:var(--down-border);color:var(--down-primary);font-size:9px">⚠ ${t}</span>`
              ).join('')}
            </div>`
          : ''}

        <div class="stock-tags">
          ${(s.tags ?? []).map(t => `<span class="tag">${t}</span>`).join('')}
        </div>

        <div class="stock-footer" style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:8px;border-top:1px solid var(--border-subtle)">
          <span style="font-size:10px;color:var(--text-muted)">거래량 ${s.volumeFormatted ?? formatVolume(s.volume)}</span>
          ${s.isMockData
            ? '<span style="font-size:10px;color:var(--text-muted)">MOCK</span>'
            : `<span style="font-size:10px;color:var(--text-muted)">${formatShortTime(s.lastUpdated)}</span>`}
        </div>
      </article>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════════════
// ⑤ 섹터 트렌드
// ══════════════════════════════════════════════════════════════════════
function renderSectors(sectors) {
  const el = DOM.sectorList();
  if (!el) return;

  if (!sectors || sectors.length === 0) {
    el.innerHTML = renderEmptyState('섹터 데이터를 불러오지 못했습니다.', '🏭');
    return;
  }

  el.innerHTML = sectors.map(s => {
    const trend = s.trend ?? (s.changePercent >= 0 ? 'up' : 'down');
    const pct   = s.changePercent ?? 0;
    const str   = s.strength ?? 50;

    return `
      <div class="sector-item animate-in" role="listitem">
        <div class="sector-item-top">
          <span class="sector-name">${s.name}</span>
          <span class="sector-change ${trend}">${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%</span>
        </div>
        <div class="sector-bar-wrap">
          <div class="sector-bar ${trend}" style="width:${str}%"></div>
        </div>
        <div class="sector-bottom">
          <span>${s.fundFlow ?? '-'}</span>
          <span style="font-family:var(--font-mono);color:var(--text-accent);font-size:10px">
            ${s.fundFlowAmount ?? ''}
          </span>
        </div>

        ${/* 키드라이버 & 리스크 — 호버 시 노출 (현재 항상 노출) */
          s.keyDrivers && s.keyDrivers.length > 0
            ? `<div class="sector-drivers" style="margin-top:6px;display:flex;flex-wrap:wrap;gap:3px">
                ${s.keyDrivers.map(d =>
                  `<span style="font-size:10px;padding:1px 6px;background:var(--up-secondary);color:var(--up-primary);border-radius:3px">${d}</span>`
                ).join('')}
              </div>`
            : ''}

        ${s.risks && s.risks.length > 0
          ? `<div class="sector-risks" style="margin-top:3px;display:flex;flex-wrap:wrap;gap:3px">
              ${s.risks.map(r =>
                `<span style="font-size:10px;padding:1px 6px;background:var(--down-secondary);color:var(--down-primary);border-radius:3px">⚠ ${r}</span>`
              ).join('')}
            </div>`
          : ''}
      </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════════════
// ⑥ 체크포인트 (keyIssues)
// ══════════════════════════════════════════════════════════════════════
function renderCheckpoints(keyIssues) {
  const el = DOM.checkpointSection();
  if (!el) return;

  if (!keyIssues) {
    el.innerHTML = renderEmptyState('AI 체크포인트를 불러오지 못했습니다.', '🎯', true);
    return;
  }

  const genTime = formatDateTime(keyIssues.generatedAt ?? keyIssues.lastUpdated);

  el.innerHTML = `
    <div class="checkpoint-header">
      <div class="checkpoint-title-wrap">
        <h2 class="checkpoint-title">
          <span>🎯</span>
          오늘의 시장 체크포인트
        </h2>
        <p class="checkpoint-subtitle">${keyIssues.summary ?? ''}</p>
      </div>
      <span class="market-condition-badge ${keyIssues.conditionColor ?? 'yellow'}">
        시장 컨디션: ${keyIssues.marketCondition ?? '-'}
      </span>
    </div>

    <div class="checkpoint-list">
      ${(keyIssues.items ?? []).length === 0
        ? renderEmptyState('체크포인트 항목 없음', '📭', false)
        : (keyIssues.items).map(item => `
          <div class="checkpoint-item animate-in">
            <span class="checkpoint-icon">${item.icon ?? '•'}</span>
            <div class="checkpoint-body">
              <div class="checkpoint-priority ${item.priorityColor ?? 'blue'}">${item.priority ?? ''}</div>
              <p class="checkpoint-text">${item.text ?? ''}</p>
              ${item.relatedTickers && item.relatedTickers.length > 0
                ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px">
                    ${item.relatedTickers.map(t =>
                      `<span style="font-size:10px;padding:1px 7px;border-radius:3px;background:rgba(99,179,237,0.1);color:var(--text-accent);border:1px solid rgba(99,179,237,0.2)">${t}</span>`
                    ).join('')}
                  </div>`
                : ''}
            </div>
          </div>`).join('')}
    </div>

    <div class="checkpoint-generated">
      <span>🤖 AI 생성</span>
      <span>·</span>
      <span>${genTime} 기준</span>
      ${keyIssues.isMockData
        ? '<span>·</span><span style="color:var(--neutral-primary)">MOCK DATA</span>'
        : `<span>·</span><span style="color:var(--text-muted)">${keyIssues.source ?? ''}</span>`}
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════════════
// ⑦ 뉴스 인사이트 (newsInsights)
// ══════════════════════════════════════════════════════════════════════
function renderNews(newsItems) {
  const el = DOM.newsList();
  if (!el) return;

  if (!newsItems || newsItems.length === 0) {
    el.innerHTML = renderEmptyState('뉴스 데이터를 불러오지 못했습니다.', '📰');
    return;
  }

  el.innerHTML = newsItems.map(item => {
    // 구 필드명(headline) → 새 필드명(title) 호환
    const title     = item.title      ?? item.headline  ?? '제목 없음';
    const impact    = item.sentiment  ?? item.impact     ?? 'neutral';
    const catColor  = item.categoryColor ?? 'blue';
    const relTickers = item.relatedStocks ?? item.relatedTickers ?? [];

    return `
      <article class="news-card animate-in" role="listitem"
        data-id="${item.id}" data-impact="${impact}">

        <header class="news-card-header">
          <span class="news-category ${catColor}">${item.category ?? ''}</span>
          ${item.isBreaking
            ? '<span class="news-breaking-badge">BREAKING</span>'
            : ''}
          ${item.impactLevel === 'high'
            ? '<span style="font-size:10px;padding:2px 6px;border-radius:3px;background:rgba(248,113,113,0.1);color:var(--down-primary)">HIGH IMPACT</span>'
            : ''}
          <time class="news-time" datetime="${item.publishedAt}">
            ${formatRelativeTime(item.publishedAt)}
          </time>
        </header>

        <h3 class="news-headline">${title}</h3>
        <p class="news-summary">${item.summary ?? ''}</p>

        ${item.aiInsight
          ? `<div class="news-ai-insight">
              <div class="news-ai-label"><span>⚡</span><span>AI 인사이트</span></div>
              ${item.aiInsight}
            </div>`
          : ''}

        ${item.riskFactors && item.riskFactors.length > 0
          ? `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:8px">
              ${item.riskFactors.map(r =>
                `<span style="font-size:10px;padding:2px 7px;border-radius:3px;background:var(--neutral-secondary);color:var(--neutral-primary);border:1px solid var(--neutral-border)">⚠ ${r}</span>`
              ).join('')}
            </div>`
          : ''}

        <footer class="news-footer">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="news-source">📰 ${item.source ?? ''}</span>
            ${relTickers.length > 0
              ? `<div style="display:flex;gap:4px">
                  ${relTickers.slice(0, 3).map(t =>
                    `<span style="font-size:10px;padding:1px 6px;border-radius:3px;background:rgba(99,179,237,0.08);color:var(--text-accent);border:1px solid rgba(99,179,237,0.15)">${t}</span>`
                  ).join('')}
                </div>`
              : ''}
          </div>
          <span class="news-impact ${impact}">
            ${impact === 'positive' ? '▲ 긍정' : impact === 'negative' ? '▼ 부정' : '→ 중립'}
          </span>
        </footer>

      </article>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════════════
// ⑧ 리스크 이벤트 캘린더
// ══════════════════════════════════════════════════════════════════════
function renderRisks(risks) {
  const el = DOM.riskList();
  if (!el) return;

  if (!risks || risks.length === 0) {
    el.innerHTML = renderEmptyState('리스크 이벤트 데이터 없음', '⚠️');
    return;
  }

  el.innerHTML = risks.map(risk => {
    const date  = new Date(risk.date);
    const month = date.toLocaleDateString('ko-KR', { month: 'short' }).replace('월', 'M');
    const day   = date.getDate();
    // dDay: fetchRiskCalendar에서 미리 계산되어 있으나, 없을 경우 재계산
    const dDay  = risk.dDay ?? calcDDay(risk.date);
    const imp   = risk.importance ?? risk.risk ?? 'low';

    return `
      <div class="risk-item animate-in" role="listitem">
        <div class="risk-date-col">
          <div class="risk-date-month">${month}</div>
          <div class="risk-date-day">${day}</div>
        </div>
        <div class="risk-content">
          <div class="risk-type-row">
            <span class="risk-type">${risk.type ?? risk.region ?? ''}</span>
            <span class="risk-level ${imp}">
              ${imp === 'high' ? '⚠ HIGH' : imp === 'medium' ? '● MED' : '○ LOW'}
            </span>
            <span style="margin-left:auto;font-size:11px;color:var(--text-muted)">${dDay}</span>
          </div>
          <div class="risk-title">${risk.eventName ?? risk.title ?? ''}</div>
          <p class="risk-desc">${risk.description ?? ''}</p>
          <div class="risk-impact-label">예상 영향: ${risk.expectedImpact ?? '-'}</div>
          ${risk.relatedSectors && risk.relatedSectors.length > 0
            ? `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:5px">
                ${risk.relatedSectors.map(s =>
                  `<span style="font-size:10px;padding:1px 6px;border-radius:3px;background:var(--bg-elevated);color:var(--text-muted)">${s}</span>`
                ).join('')}
              </div>`
            : ''}
        </div>
      </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════════════
// 섹션별 lastUpdated 타임스탬프 업데이트
// ══════════════════════════════════════════════════════════════════════
function updateSectionTimestamps(d) {
  const sectionMap = {
    'indices-updated':   d.indicesUpdatedAt,
    'stocks-updated':    d.stocksUpdatedAt,
    'sectors-updated':   d.sectorsUpdatedAt,
    'news-updated':      d.newsUpdatedAt,
    'risks-updated':     d.risksUpdatedAt,
    'checkpoint-updated':d.keyIssuesUpdatedAt,
  };

  Object.entries(sectionMap).forEach(([id, ts]) => {
    const el = document.getElementById(id);
    if (el && ts) {
      el.textContent = formatShortTime(ts) + ' 기준';
    }
  });
}

// 데이터 상태 뱃지 업데이트
function updateDataStatusBadge(d) {
  const badge = DOM.mockBadge();
  if (!badge) return;

  const status = d._meta?.status || 'mock';
  const anyMock = status === 'mock' || d.overview?.isMockData || d.indices?.[0]?.isMockData;

  badge.style.display = 'flex'; // 항상 표시

  if (status === 'healthy') {
    badge.innerHTML = `<span class="mock-dot" style="background:#34d399" aria-hidden="true"></span>최근 저장 데이터`;
    badge.title = `Last generated: ${AppState.dataGeneratedAt || '-'}`;
    badge.style.background = 'rgba(52,211,153,0.08)';
    badge.style.borderColor = 'rgba(52,211,153,0.2)';
    badge.style.color = '#34d399';
  } else if (status === 'degraded') {
    badge.innerHTML = `<span class="mock-dot" style="background:#fbbf24" aria-hidden="true"></span>일부 데이터 지연`;
    badge.title = '일부 섹션 데이터 수집 실패 — Data may be delayed';
    badge.style.background = 'rgba(251,191,36,0.08)';
    badge.style.borderColor = 'rgba(251,191,36,0.2)';
    badge.style.color = 'var(--neutral-primary)';
  } else {
    badge.innerHTML = `<span class="mock-dot" aria-hidden="true"></span>MOCK DATA`;
    badge.title = 'Mock 데이터 사용 중 — API 키 설정 시 실제 데이터로 전환됩니다';
    badge.style.background = '';
    badge.style.borderColor = '';
    badge.style.color = '';
  }
}

// ══════════════════════════════════════════════════════════════════════
// 로딩 / 에러 상태 관리
// ══════════════════════════════════════════════════════════════════════
function showInitialLoading() {
  const overlay = DOM.loadingOverlay();
  if (overlay) overlay.classList.add('active');
}

function setLoadingState(loading, isRefresh = false) {
  AppState.isLoading = loading;
  const dot     = DOM.statusDot();
  const btn     = DOM.refreshBtn();
  const overlay = DOM.loadingOverlay();

  if (loading) {
    if (dot)    dot.className = 'status-dot loading';
    if (btn)    btn.classList.add('spinning');
    if (!isRefresh && overlay) overlay.classList.add('active');
  } else {
    if (overlay) overlay.classList.remove('active');
    if (dot)     dot.className = AppState.error ? 'status-dot error' : 'status-dot';
    if (btn)     btn.classList.remove('spinning');
  }
}

function showError(msg) {
  const banner = DOM.errorBanner();
  if (!banner) return;
  const msgEl = DOM.errorMsg();
  if (msgEl) msgEl.textContent = msg;
  banner.classList.add('active');
  const dot = DOM.statusDot();
  if (dot) dot.className = 'status-dot error';
}

function hideError() {
  const banner = DOM.errorBanner();
  if (banner) banner.classList.remove('active');
}

function updateHeaderTimestamp() {
  const el = DOM.lastUpdatedText();
  if (!el) return;

  // 서버 생성 시각이 있으면 표시 (GitHub Actions 생성 시각)
  if (AppState.dataGeneratedAt) {
    try {
      const genDate = new Date(AppState.dataGeneratedAt);
      const now     = new Date();
      const diffMin = Math.floor((now - genDate) / 60000);
      let label;
      if (diffMin < 1)         label = '방금 갱신';
      else if (diffMin < 60)   label = `${diffMin}분 전 갱신`;
      else if (diffMin < 1440) label = `${Math.floor(diffMin / 60)}시간 전 갱신`;
      else                     label = `${Math.floor(diffMin / 1440)}일 전 갱신`;

      el.textContent = `${label} (주기적 갱신)`;
      el.title = `Last generated: ${AppState.dataGeneratedAt}`;
      return;
    } catch (_) { /* fall through */ }
  }

  // fallback: 로드 시각
  if (AppState.lastUpdated) {
    el.textContent = AppState.lastUpdated.toLocaleTimeString('ko-KR', {
      hour: '2-digit', minute: '2-digit',
    }) + ' 로드';
  }
}

// ══════════════════════════════════════════════════════════════════════
// Auto Refresh
// ══════════════════════════════════════════════════════════════════════
function startAutoRefresh() {
  clearInterval(AppState.refreshTimer);
  AppState.refreshTimer = setInterval(async () => {
    await loadData(true);
    resetProgressBar();
    startProgressBar();
  }, AppState.AUTO_REFRESH_INTERVAL);
}

function startProgressBar() {
  const bar = DOM.progressBar();
  if (!bar) return;
  AppState.progressValue = 0;
  bar.classList.add('active');
  clearInterval(AppState.progressTimer);
  AppState.progressTimer = setInterval(() => {
    AppState.progressValue += (AppState.PROGRESS_INTERVAL / AppState.AUTO_REFRESH_INTERVAL) * 100;
    if (AppState.progressValue >= 100) AppState.progressValue = 100;
    bar.style.width = AppState.progressValue + '%';
  }, AppState.PROGRESS_INTERVAL);
}

function resetProgressBar() {
  clearInterval(AppState.progressTimer);
  const bar = DOM.progressBar();
  if (bar) { bar.style.width = '0%'; AppState.progressValue = 0; }
}

// ══════════════════════════════════════════════════════════════════════
// 이벤트 바인딩
// ══════════════════════════════════════════════════════════════════════
function bindEvents() {
  // 수동 새로고침
  const btn = DOM.refreshBtn();
  if (btn) {
    btn.addEventListener('click', async () => {
      if (AppState.isLoading) return;
      clearInterval(AppState.refreshTimer);
      clearInterval(AppState.progressTimer);
      await loadData(true);
      resetProgressBar();
      startProgressBar();
      startAutoRefresh();
    });
  }

  // 에러 배너 재시도
  const retryBtn = document.getElementById('error-retry');
  if (retryBtn) {
    retryBtn.addEventListener('click', async () => {
      hideError();
      await loadData(true);
    });
  }

  // 탭 가시성 변화 처리
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(AppState.refreshTimer);
      clearInterval(AppState.progressTimer);
    } else {
      const elapsed = AppState.lastUpdated
        ? Date.now() - AppState.lastUpdated.getTime()
        : Infinity;
      if (elapsed > AppState.AUTO_REFRESH_INTERVAL) loadData(true);
      startAutoRefresh();
      startProgressBar();
    }
  });
}

// ══════════════════════════════════════════════════════════════════════
// 토스트 알림
// ══════════════════════════════════════════════════════════════════════
function showToast(msg, type = 'info', duration = 3000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✅', error: '❌', info: '📡' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] ?? '📡'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toast-out 0.3s ease both';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function flashRefreshSuccess() {
  const btn = DOM.refreshBtn();
  if (btn) {
    btn.style.borderColor = 'var(--up-border)';
    btn.style.color       = 'var(--up-primary)';
    setTimeout(() => { btn.style.borderColor = ''; btn.style.color = ''; }, 1500);
  }
  showToast('저장된 데이터를 다시 불러왔습니다', 'success', 2500);
}

// ══════════════════════════════════════════════════════════════════════
// Empty State 헬퍼
// ══════════════════════════════════════════════════════════════════════
function renderEmptyState(msg, icon = '📭', fullCard = false) {
  const style = fullCard
    ? 'padding:40px;text-align:center;'
    : 'padding:24px;text-align:center;';
  return `
    <div style="${style}color:var(--text-muted);font-size:13px;">
      <div style="font-size:28px;margin-bottom:8px">${icon}</div>
      <div>${msg}</div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════════════
// 포맷 유틸리티
// ══════════════════════════════════════════════════════════════════════

/** 지수 카드 값 포맷 */
function formatIndexValue(idx) {
  const id  = idx.id ?? '';
  const val = idx.value ?? 0;
  if (id === 'usdkrw') return val.toFixed(2);
  if (id === 'us10y')  return val.toFixed(3) + '%';
  if (id === 'wti')    return '$' + val.toFixed(2);
  if (val >= 1000)     return val.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  return val.toFixed(2);
}

/** 지수 카드 변화값 포맷 */
function formatIndexChange(idx) {
  const id  = idx.id ?? '';
  const chg = Math.abs(idx.change ?? 0);
  if (id === 'usdkrw') return chg.toFixed(2);
  if (id === 'us10y')  return chg.toFixed(3);
  if (id === 'wti')    return '$' + chg.toFixed(2);
  if (chg >= 1)        return chg.toFixed(2);
  return chg.toFixed(3);
}

/** 티커 테이프 값 포맷 */
function formatTickerValue(item) {
  const id  = item.id ?? '';
  const val = item.value ?? 0;
  if (id === 'usdkrw') return val.toFixed(2);
  if (id === 'us10y')  return val.toFixed(3) + '%';
  if (id === 'wti' || id === 'gold') return '$' + val.toFixed(2);
  if (id === 'btc')    return '$' + val.toLocaleString();
  if (val >= 10000)    return val.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  return val.toFixed(2);
}

/** 거래량 포맷 */
function formatVolume(vol) {
  if (!vol) return '-';
  if (typeof vol === 'string') return vol;
  if (vol >= 10000000) return (vol / 10000000).toFixed(1) + '천만';
  if (vol >= 10000)    return (vol / 10000).toFixed(0) + '만';
  return vol.toLocaleString();
}

/** 상대 시간 (뉴스용) */
function formatRelativeTime(isoString) {
  if (!isoString) return '-';
  const diff    = Date.now() - new Date(isoString).getTime();
  const diffMin = Math.floor(diff / 60000);
  const diffHr  = Math.floor(diffMin / 60);
  if (diffMin < 1)  return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHr < 24)  return `${diffHr}시간 전`;
  return new Date(isoString).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

/** 짧은 시간 표시 (섹션 타임스탬프용) */
function formatShortTime(isoString) {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleTimeString('ko-KR', {
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
}

/** 날짜+시간 표시 (체크포인트용) */
function formatDateTime(isoString) {
  if (!isoString) return '-';
  try {
    return new Date(isoString).toLocaleString('ko-KR', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return '-'; }
}

/** D-Day 계산 (riskCalendar fallback용) */
function calcDDay(dateStr) {
  const today  = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr); target.setHours(0,0,0,0);
  const diff   = Math.floor((target - today) / 86400000);
  if (diff === 0) return 'D-Day';
  if (diff > 0)   return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
}
