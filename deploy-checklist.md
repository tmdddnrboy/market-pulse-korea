# Market Pulse Korea — 배포 체크리스트

> **배포 전 아래 항목을 순서대로 확인하세요.**
> 모든 항목이 체크되어야 Blogger 정식 운영 준비가 완료됩니다.

---

## STEP 1 — API 키 발급 체크리스트

아래 API 키는 **GitHub Secrets에만 저장**합니다. Blogger 테마 코드에 절대 입력하지 마세요.

### 무료 / 필수 권장

- [ ] **DART_API_KEY** 발급 완료
  - 발급처: https://opendart.fss.or.kr/uat/uia/egovLoginUsr.do
  - 금융감독원 DART 사이트 회원가입 → 로그인 → 개발자 API → 인증키 신청/관리
  - 소요 시간: 즉시 발급

- [ ] **FRED_API_KEY** 발급 완료
  - 발급처: https://fred.stlouisfed.org/docs/api/api_key.html
  - FRED 계정 생성 → My Account → API Keys
  - 소요 시간: 즉시 발급

- [ ] **GEMINI_API_KEY** 발급 완료
  - 발급처: https://aistudio.google.com/app/apikey
  - Google 계정으로 로그인 → Create API key
  - 무료 한도: 1,500 req/day (Gemini 2.0 Flash)
  - 소요 시간: 즉시 발급

- [ ] **FINNHUB_API_KEY** 발급 완료
  - 발급처: https://finnhub.io/dashboard
  - 이메일 회원가입 → API Key 탭에서 확인
  - 무료 한도: 60 req/min
  - 소요 시간: 즉시 발급

- [ ] **COINGECKO_API_KEY** 발급 완료 (또는 빈값으로 무료 플랜 사용)
  - 발급처: https://www.coingecko.com/en/developers/dashboard
  - 무료 플랜은 API 키 없이도 사용 가능 (단, rate limit 낮음)
  - GitHub Secret에 빈값으로 등록해도 무료 엔드포인트 자동 사용

### 선택 (뉴스 보조)

- [ ] **GNEWS_API_KEY** 발급 완료 (Google News RSS 실패 시 보조)
  - 발급처: https://gnews.io/register
  - 무료 한도: 100 req/day

### 고급 (유료, 선택)

- [ ] **OPENAI_API_KEY** 발급 완료 (Gemini 실패 시 AI 요약 fallback)
  - 발급처: https://platform.openai.com/api-keys

- [ ] **ANTHROPIC_API_KEY** 발급 완료 (최종 AI 요약 fallback)
  - 발급처: https://console.anthropic.com/

> **Google News RSS**: API 키 불필요. 스크립트가 자동으로 수집합니다. ✅

---

## STEP 2 — GitHub Secrets 등록 체크리스트

```
GitHub 저장소 → Settings → Secrets and variables → Actions → New repository secret
```

- [ ] `DART_API_KEY` 등록 완료
- [ ] `FRED_API_KEY` 등록 완료
- [ ] `GEMINI_API_KEY` 등록 완료
- [ ] `FINNHUB_API_KEY` 등록 완료
- [ ] `COINGECKO_API_KEY` 등록 완료 (빈값 또는 Pro 키)
- [ ] `GNEWS_API_KEY` 등록 완료 (선택)
- [ ] `ALPHA_VANTAGE_KEY` 등록 완료 (선택)
- [ ] `OPENAI_API_KEY` 등록 완료 (선택)
- [ ] `ANTHROPIC_API_KEY` 등록 완료 (선택)
- [ ] `BOK_ECOS_KEY` 등록 완료 (선택)

---

## STEP 3 — GitHub Actions 실행 확인

- [ ] 저장소에 `.github/workflows/update-dashboard-data.yml` 파일이 있음
- [ ] GitHub Actions 탭 접근 가능 (저장소 공개 또는 Actions 활성화 확인)
- [ ] **첫 수동 실행 테스트**
  ```
  GitHub 저장소 → Actions 탭
    → "Update Dashboard Data" 워크플로 선택
    → "Run workflow" 클릭
    → 실행 로그 확인
  ```
- [ ] 워크플로 실행 로그에서 아래 항목 확인
  - [ ] `📡 Google News RSS 수집` — 성공 또는 실패 로그 확인
  - [ ] `📋 DART 공시 수집` — 성공 또는 실패 로그 확인
  - [ ] `📊 Finnhub 시그널 수집` — 성공 또는 실패 로그 확인
  - [ ] `✅ data/latestDashboardData.json 저장 완료` — 반드시 확인
  - [ ] `data: auto-update` 커밋이 저장소에 생성됨 — 반드시 확인

---

## STEP 4 — latestDashboardData.json 생성 확인

- [ ] `data/latestDashboardData.json` 파일이 저장소에 존재함
- [ ] JSON 파일의 `_meta.generatedAt` 값이 현재 시각에 가까운지 확인
- [ ] `_meta.status` 값 확인
  - `healthy`: 주요 API 수집 성공 ✅
  - `degraded`: 일부 실패, 기존 데이터 유지 ⚠️
  - `mock`: 모든 API 실패 또는 키 없음 (대시보드는 정상 표시) 🟡
- [ ] `_meta.errors` 배열이 비어있는지 확인 (또는 허용 가능한 수준인지)
- [ ] GitHub Pages URL로 JSON 직접 접근 가능 확인
  ```
  https://<username>.github.io/<repo>/data/latestDashboardData.json
  ```

---

## STEP 5 — GitHub Pages 활성화 확인

- [ ] GitHub Pages 활성화 완료
  ```
  Settings → Pages → Source: Deploy from a branch → Branch: main → Save
  ```
- [ ] GitHub Pages URL 확인
  ```
  https://<username>.github.io/<repository-name>/
  ```
- [ ] `index.html` 접근 시 대시보드 정상 표시 확인
- [ ] `data/latestDashboardData.json` 직접 URL 접근 가능 확인

---

## STEP 6 — Blogger 테마 적용 확인

- [ ] Blogger 테마 편집기(`테마 → HTML 편집`)에서 `<meta name="dashboard-json-url">` 추가 완료
  ```html
  <meta name="dashboard-json-url"
    content="https://<username>.github.io/<repo>/data/latestDashboardData.json">
  ```
- [ ] CSS 파일 링크 추가 완료 (style.css, components.css)
- [ ] JS 파일 스크립트 태그 추가 완료 (mockData.js → dashboard.js 순서)
- [ ] 대시보드 HTML (`<main>` 내용 또는 iframe) Blogger에 삽입 완료
- [ ] 브라우저 개발자 도구 → Console 탭에서 에러 없음 확인
  - 기대 로그: `[Dashboard] 외부 JSON (latestDashboardData.json) 로드 완료`
- [ ] 데이터 상태 뱃지 확인
  - `최근 저장 데이터` (초록): healthy 상태 ✅
  - `일부 데이터 지연` (노랑): degraded 상태 ⚠️
  - `MOCK DATA` (기본): mock 상태 (API 키 없음) 🟡
- [ ] 헤더의 타임스탬프가 "X분 전 갱신 (주기적 갱신)" 형식으로 표시됨

---

## STEP 7 — 모바일 화면 확인

- [ ] Chrome 개발자 도구 → 모바일 에뮬레이터에서 확인
- [ ] 실제 스마트폰(Android/iOS)에서 Blogger 포스트 접근 확인
- [ ] 아래 항목 모바일에서 정상 표시 확인
  - [ ] 헤더 네비게이션 — 스크롤 시 섹션 이동
  - [ ] 티커 테이프 — 좌우 스크롤 애니메이션
  - [ ] 시장 지수 그리드 — 카드 정상 표시
  - [ ] 뉴스 카드 — 가독성 확인
  - [ ] 리스크 캘린더 — 날짜/D-Day 표시
  - [ ] 푸터 면책 문구 — 잘림 없이 표시

---

## STEP 8 — AdSense 코드 확인

> **⚠️ AdSense는 실제 데이터 정상 표시 확인 후 마지막에 추가하세요.**
> Mock 데이터 상태에서 AdSense 심사를 받으면 거부될 수 있습니다.

- [ ] `_meta.status`가 `healthy` 또는 `degraded` 상태인지 확인
- [ ] Blogger 포스트/페이지에 실제 콘텐츠(뉴스, 지수, AI 요약)가 정상 표시됨
- [ ] AdSense 계정에서 Blogger 블로그 사이트 승인 신청
- [ ] 승인 후 AdSense 코드를 Blogger 테마 적절한 위치에 삽입
  - 헤더 내 `<head>` 태그 또는 포스트 하단
  - 대시보드 UI와 겹치지 않는 위치 권장

---

## STEP 9 — 면책 문구 확인

- [ ] 대시보드 푸터에 아래 문구가 표시됨
  ```
  ⚠️ 투자 유의사항
  본 서비스에서 제공하는 모든 정보는 투자 참고 목적의 정보 제공에 한하며,
  특정 종목의 매수·매도를 추천하거나 투자 결과를 보장하지 않습니다.
  모든 투자 판단과 책임은 투자자 본인에게 있습니다.
  ```
- [ ] 사이트 어딘가에 데이터 지연 안내 문구 표시됨
  ```
  데이터는 30~60분 단위로 갱신됩니다 · 일부 데이터는 지연되거나 누락될 수 있습니다
  ```
- [ ] "실시간", "Live", "Real-time" 표현이 UI에 없음
- [ ] 영웅 섹션에 "데이터는 30~60분 단위로 갱신됩니다" 문구 표시됨
- [ ] 새로고침 버튼 tooltip에 "최근 저장 데이터 기준 — 30~60분 주기 갱신" 표시됨

---

## STEP 10 — 최종 체크 (전체 통합)

- [ ] GitHub Actions 자동 스케줄 실행 확인 (30분 후 자동 갱신됨)
- [ ] `data/latestDashboardData.json` 자동 커밋 이력 확인
- [ ] Blogger 블로그에서 새로고침 시 최신 데이터 표시됨
- [ ] 대시보드 우측 상단 타임스탬프가 갱신 시각을 정확히 표시함
- [ ] 브라우저 Console에 `404`, `CORS`, `TypeError` 등 에러 없음
- [ ] 네트워크 탭에서 `latestDashboardData.json` 외 외부 API 직접 호출 없음

---

## 배포 완료 🎉

모든 체크항목 완료 시 운영 준비가 완료된 것입니다.

### 운영 중 정기 점검 항목 (월 1회 권장)

- [ ] GitHub Actions 실행 성공률 확인 (Actions 탭 → 최근 30일 실행 기록)
- [ ] 무료 API 한도 초과 여부 확인 (`_meta.errors` 모니터링)
- [ ] 데이터가 mock 상태로 고착되지 않았는지 확인
- [ ] API 키 만료/재발급 필요 여부 확인
- [ ] 브라우저 Console 에러 없음 재확인

---

*Market Pulse Korea — Phase 5 최종 정리 완료*
