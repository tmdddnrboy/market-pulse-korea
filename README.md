# Market Pulse Korea 📊

> **무료 공개 데이터 기반 한국 주식시장 인사이트 대시보드**
> Blogger/블로그스팟 테마로 배포되며, GitHub Actions가 주기적으로 데이터를 수집·갱신합니다.

---

## ⚠️ 면책 고지 (반드시 확인)

```
본 서비스에서 제공하는 모든 정보는 투자 참고 목적의 정보 제공에 한합니다.
특정 종목의 매수·매도를 추천하거나 투자 결과를 보장하지 않습니다.
모든 투자 판단과 책임은 투자자 본인에게 있으며, 주식 투자는 원금 손실 위험이 있습니다.

- 이 서비스는 완전 실시간 시세 서비스가 아닙니다.
- 데이터는 최대 30~60분 지연될 수 있으며, 일부 항목은 누락되거나 부정확할 수 있습니다.
- 무료 공개 API 한도 초과 시 이전 데이터가 유지됩니다.
- AdSense 광고 코드는 Blogger 테마 최종 적용 후 별도로 추가해야 합니다.
```

---

## 1. 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                     데이터 수집 레이어 (서버/CI)                      │
│                                                                     │
│  GitHub Actions (30분 cron)                                        │
│    └── node scripts/updateDashboardData.js                         │
│          ├─ Google News RSS   ← API 키 불필요 (완전 무료)           │
│          ├─ GNews API         ← GNEWS_API_KEY (무료 100req/day)    │
│          ├─ DART OpenAPI      ← DART_API_KEY  (무료)               │
│          ├─ Finnhub API       ← FINNHUB_API_KEY (무료 60req/min)   │
│          ├─ CoinGecko API     ← COINGECKO_API_KEY (무료 가능)      │
│          ├─ Alpha Vantage     ← ALPHA_VANTAGE_KEY (무료 25req/day) │
│          ├─ FRED API          ← FRED_API_KEY (무료)                │
│          └─ Gemini AI         ← GEMINI_API_KEY (무료 1500req/day)  │
│                    ↓                                                │
│          data/latestDashboardData.json  ← git commit & push        │
└─────────────────────────────────────────────────────────────────────┘
                              ↓ (GitHub Pages 공개 URL)
┌─────────────────────────────────────────────────────────────────────┐
│                   프론트엔드 레이어 (Blogger 테마)                    │
│                                                                     │
│  Blogger 테마 (HTML/CSS/JS)                                        │
│    └── dashboard.js                                                 │
│          ├─ 1순위: fetch(DASHBOARD_JSON_URL)  ← GitHub Pages URL   │
│          ├─ 2순위: fetch('data/latestDashboardData.json') (상대)   │
│          └─ 3순위: mockData.js fallback (JSON 로드 완전 실패 시)   │
│                    ↓                                                │
│          renderAll() → 10개 섹션 렌더링                            │
└─────────────────────────────────────────────────────────────────────┘

핵심 원칙:
  ⛔  프론트엔드(Blogger)는 외부 API를 직접 호출하지 않습니다.
  ⛔  API 키는 절대 Blogger 테마 코드에 포함하지 않습니다.
  ⛔  CORS 허용 여부와 무관하게 브라우저에 키를 노출하지 않습니다.
  ✅  모든 API 호출은 GitHub Actions(서버/CI)에서만 수행합니다.
  ✅  API 키는 GitHub Secrets에만 저장합니다.
  ✅  Blogger는 정적 JSON 파일만 읽습니다.
```

---

## 2. Blogger 적용 방법

### 단계 1 — GitHub Pages 활성화
```
GitHub 저장소 → Settings → Pages
  → Source: Deploy from a branch
  → Branch: main / (root)
  → Save
```
활성화 후 공개 URL 확인:
```
https://<your-username>.github.io/<repository-name>/
```

### 단계 2 — JSON 공개 URL 확인
GitHub Actions가 실행되면 아래 URL로 JSON에 접근 가능합니다:
```
https://<your-username>.github.io/<repository-name>/data/latestDashboardData.json
```

### 단계 3 — Blogger 테마 편집기에서 URL 설정
Blogger 테마 편집기(`테마 → HTML 편집`)에서 `<head>` 안에 아래를 추가:

```html
<!-- ★ Market Pulse Korea — JSON 데이터 URL 설정 ★ -->
<meta name="dashboard-json-url"
  content="https://<your-username>.github.io/<repository-name>/data/latestDashboardData.json">
```

### 단계 4 — CSS / JS / HTML 삽입
Blogger 테마 `<head>` 닫히기 전:
```html
<!-- Market Pulse Korea Styles -->
<link rel="stylesheet" href="https://<your-username>.github.io/<repo>/css/style.css">
<link rel="stylesheet" href="https://<your-username>.github.io/<repo>/css/components.css">
```

`<body>` 닫히기 전:
```html
<!-- Market Pulse Korea Scripts -->
<script src="https://<your-username>.github.io/<repo>/data/mockData.js"></script>
<script src="https://<your-username>.github.io/<repo>/js/dashboard.js"></script>
```

대시보드 HTML은 `index.html`의 `<main>` 내용을 Blogger 포스트/위젯에 붙여넣습니다.

> **팁**: `index.html` 전체를 GitHub Pages URL로 iframe 삽입하는 방법도 간편합니다:
> ```html
> <iframe src="https://<user>.github.io/<repo>/" width="100%" height="2000px"
>   frameborder="0" scrolling="no" style="border:none;"></iframe>
> ```

### 단계 5 — AdSense 코드
Blogger 테마 최종 적용 및 실제 데이터 표시 확인 후 AdSense 코드를 별도로 삽입하세요.  
AdSense 정책에 따라 mock 데이터 상태에서는 광고 승인이 거부될 수 있습니다.

---

## 3. latestDashboardData.json 구조

GitHub Actions가 `data/latestDashboardData.json`을 주기적으로 갱신합니다.  
Blogger(dashboard.js)는 이 파일만 fetch합니다.

```json
{
  "_meta": {
    "schemaVersion": "4.0",
    "generatedAt": "2025-05-26T10:00:00+09:00",
    "generatedBy": "scripts/updateDashboardData.js",
    "status": "healthy | degraded | mock",
    "dataDisclaimer": "데이터는 최대 30~60분 지연될 수 있으며...",
    "sources": {
      "news": "google_news_rss",
      "riskCalendar": "alpha_vantage",
      "aiSummary": "ai_generated",
      "disclosures": "opendart",
      "crypto": "coingecko",
      "marketSignal": "finnhub"
    },
    "errors": [],
    "nextUpdateAt": "2025-05-26T10:30:00+09:00"
  },
  "overview":     { ... },   // 시장 센티멘트
  "indices":      [ ... ],   // KOSPI, KOSDAQ, KRX300
  "ticker":       [ ... ],   // 티커 테이프 항목
  "stocks":       [ ... ],   // 관심 종목 모멘텀
  "sectors":      [ ... ],   // 섹터 트렌드
  "keyIssues":    [ ... ],   // 오늘의 체크포인트
  "news":         [ ... ],   // 시장 뉴스 (Google News RSS)
  "risks":        [ ... ],   // 리스크 캘린더
  "flows":        { ... },   // 투자자 수급
  "aiSummary":    { ... },   // AI 시장 브리핑
  "disclosures":  [ ... ],   // DART 공시 (신규)
  "cryptoPrices": [ ... ],   // 가상자산 시세 (신규)
  "marketSignal": { ... }    // Finnhub 시장 시그널 (신규)
}
```

### `_meta.status` 3가지 상태

| 값 | 의미 | UI 뱃지 색상 |
|----|------|-------------|
| `healthy` | 주요 섹션 70% 이상 수집 성공 | 🟢 초록 |
| `degraded` | 일부 섹션 실패, 기존 데이터 유지 | 🟡 노랑 |
| `mock` | API 키 없음 또는 전체 실패 | ⚪ 기본 |

---

## 4. API 키 발급처 및 GitHub Secrets 이름

모든 API 키는 GitHub Actions에서만 사용됩니다. **Blogger 테마 코드에는 절대 포함하지 마세요.**

| Secret 이름 | 발급처 | 무료 한도 | 필수 여부 | 용도 |
|------------|--------|----------|----------|------|
| `DART_API_KEY` | [OpenDART](https://opendart.fss.or.kr/uat/uia/egovLoginUsr.do) — 금융감독원 회원가입 후 인증키 신청 | 제한 없음 | 선택 | 코스피/코스닥 공시 수집 |
| `FRED_API_KEY` | [FRED](https://fred.stlouisfed.org/docs/api/api_key.html) — 계정 생성 후 API Key 발급 | 제한 없음 | 선택 | 미국 경제지표 캘린더 |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/app/apikey) — Google 계정으로 즉시 발급 | 1,500 req/day | 선택 | AI 시장 브리핑 생성 |
| `FINNHUB_API_KEY` | [Finnhub Dashboard](https://finnhub.io/dashboard) — 이메일 회원가입 후 즉시 발급 | 60 req/min | 선택 | S&P500/NASDAQ/금 시세 |
| `COINGECKO_API_KEY` | [CoinGecko Developer Dashboard](https://www.coingecko.com/en/developers/dashboard) — Pro 계정 필요 | 무료 플랜은 키 불필요 | 선택 | BTC/ETH/XRP/SOL 시세 |
| `GNEWS_API_KEY` | [GNews](https://gnews.io/register) — 이메일 회원가입 | 100 req/day | 선택 | 뉴스 (RSS 실패 시 보조) |
| `ALPHA_VANTAGE_KEY` | [Alpha Vantage](https://www.alphavantage.co/support/#api-key) — 이메일로 즉시 발급 | 25 req/day | 선택 | 경제지표 캘린더 |
| `OPENAI_API_KEY` | [OpenAI Platform](https://platform.openai.com/api-keys) | 유료 | 선택 | AI 요약 (Gemini 실패 시) |
| `ANTHROPIC_API_KEY` | [Anthropic Console](https://console.anthropic.com/) | 유료 | 선택 | AI 요약 (최종 fallback) |
| `BOK_ECOS_KEY` | [한국은행 ECOS](https://ecos.bok.or.kr/api/) — 회원가입 후 발급 | 1,000 req/day | 선택 | 국내 경제지표 |

> **Google News RSS**: API 키 불필요. `scripts/updateDashboardData.js`에서 자동 수집.  
> 모든 키가 없어도 대시보드는 mock 데이터로 정상 표시됩니다.

### GitHub Secrets 등록 방법
```
GitHub 저장소 → Settings → Secrets and variables → Actions
  → New repository secret → Name: DART_API_KEY, Secret: 발급받은 키 입력
```

---

## 5. 무료 API 한계 및 데이터 지연

### 무료 API 한도 표

| API | 무료 한도 | 초과 시 동작 | 비고 |
|-----|----------|------------|------|
| Google News RSS | 제한 없음 | — | API 키 불필요 |
| DART OpenAPI | 실질 무제한 | 기존 데이터 유지 | 당일 공시만 수집 |
| FRED | 무제한 | 기존 데이터 유지 | 릴리스 날짜 제공 |
| Finnhub | 60 req/min | 기존 데이터 유지 | US 주가만 무료 |
| CoinGecko (무료) | 약 10~30 req/min | 기존 데이터 유지 | 키 없이 사용 가능 |
| Gemini Flash | 1,500 req/day, 15 req/min | AI 요약 생략 | 무료 최선 |
| GNews | 100 req/day | 기존 뉴스 유지 | RSS 다음 보조 |
| Alpha Vantage | 25 req/day | 기존 캘린더 유지 | CSV 응답 |

### 데이터 지연 가능성

```
GitHub Actions 실행 → 수집 → JSON 저장 → GitHub Pages CDN 반영
  ↑ 최대 30분 간격           ↑ 최대 5분 CDN 전파 시간
  
총 지연 가능 시간: 최대 35분
```

- 무료 API는 요청 한도가 낮아 **일부 섹션은 이전 수집 데이터를 표시할 수 있습니다.**
- `_meta.errors` 배열에 실패한 섹션이 기록됩니다.
- 장 마감 후 / 주말에는 데이터가 갱신되지 않을 수 있습니다.

---

## 6. 파일 구조

```
index.html                         진입점 (대시보드 UI / Blogger 삽입용)
package.json                       Node.js 의존성 (dotenv)
.gitignore                         .env 커밋 방지
.env.example                       환경변수 템플릿 (실제 키 없음)

css/
  style.css                        CSS Variable 디자인 시스템 (다크 테마)
  components.css                   마이크로 인터랙션, 토스트, 애니메이션

js/
  dashboard.js                     렌더 엔진 v4.0
                                   (DASHBOARD_JSON_URL → 상대경로 → mock 3단계 fallback)

data/
  latestDashboardData.json         ← GitHub Actions가 주기 갱신하는 유일한 데이터 파일
  mockData.js                      mock fallback (JSON 로드 완전 실패 시)

scripts/
  updateDashboardData.js           Node.js 데이터 수집 스크립트 (CI 전용)
                                   수집: Google News RSS, GNews, DART,
                                         Finnhub, CoinGecko, Alpha Vantage,
                                         FRED, Gemini AI

.github/
  workflows/
    update-dashboard-data.yml      GitHub Actions 30분 스케줄 워크플로

services/                          ⚠️ SERVER-SIDE ONLY — 브라우저에서 로드하지 마세요
  marketApi.js
  stockApi.js
  newsApi.js
  aiSummaryApi.js
  riskCalendarApi.js

config/
  apiConfig.js                     ⚠️ SERVER-SIDE ONLY
```

---

## 7. 보안 설계

| 항목 | 방침 |
|------|------|
| API 키 저장 위치 | GitHub Secrets (CI) 또는 로컬 `.env` |
| 브라우저 노출 | **절대 금지** — CORS 허용 여부 무관 |
| Blogger 테마 코드 | 외부 API 직접 호출 없음, JSON 읽기만 |
| `services/`, `config/` | Node.js 스크립트 전용, `index.html`에서 로드하지 않음 |
| `.env` 파일 | `.gitignore` 등록, 절대 git 커밋 금지 |
| Gemini/OpenAI | CI에서만 호출, 응답 결과만 JSON에 저장 |

---

## 8. GitHub Actions 워크플로 동작

```yaml
# .github/workflows/update-dashboard-data.yml
on:
  schedule:
    - cron: '*/30 * * * *'   # 30분마다 (UTC)
  workflow_dispatch:           # GitHub UI에서 수동 실행 가능

jobs:
  update-data:
    runs-on: ubuntu-latest
    permissions:
      contents: write          # JSON 파일 자동 커밋 권한
    steps:
      - checkout + node setup
      - node scripts/updateDashboardData.js   # 데이터 수집
      - git add data/latestDashboardData.json
      - git commit "data: auto-update [skip ci]"
      - git push
```

---

## 9. 빠른 시작

### API 키 없이 바로 실행 (Mock 모드)
```bash
# 1. 레포 클론 후 index.html을 브라우저에서 열기
open index.html
# → data/latestDashboardData.json 로드 → mock 데이터로 정상 표시
```

### 실제 데이터 수집 (로컬 테스트)
```bash
cp .env.example .env
# .env에 실제 API 키 1개 이상 입력

npm install
node scripts/updateDashboardData.js
# → data/latestDashboardData.json 갱신

open index.html
```

---

## 10. Phase 완료 현황

| Phase | 내용 | 상태 |
|-------|------|------|
| Phase 1 | 대시보드 UI (다크 테마, 카드 레이아웃, 스켈레톤) | ✅ 완료 |
| Phase 2 | 데이터 레이어 v2.0 (10개 섹션 mock 데이터) | ✅ 완료 |
| Phase 3 | Service/Adapter 아키텍처 (서버 전용 services/) | ✅ 완료 |
| Phase 4 | 보안 강화 (프론트엔드 API 직접 호출 제거, JSON 기반) | ✅ 완료 |
| Phase 5 | **최종 정리** (Blogger 적용, DART/Finnhub/CoinGecko/RSS 추가) | ✅ 완료 |

---

## 11. 다음 개발 단계 (Phase 6)

- [ ] Blogger 테마 실제 적용 테스트 (iframe 또는 직접 삽입)
- [ ] AdSense 코드 삽입 (실제 데이터 표시 확인 후)
- [ ] DART 공시 섹션 UI 렌더링 추가 (`dashboard.js`에 renderDisclosures())
- [ ] CoinGecko 가상자산 섹션 UI 추가 (`dashboard.js`에 renderCrypto())
- [ ] Finnhub 글로벌 시장 시그널 섹션 UI 추가
- [ ] 장중 자동 갱신 최적화 (평일 KST 09~15시 15분 간격 cron)
- [ ] 관심 종목 커스터마이징 (localStorage 기반)

---

*최종 업데이트: Phase 5 완료 — Blogger 적용 구조 완성, DART/Finnhub/CoinGecko/Google News RSS 추가*
