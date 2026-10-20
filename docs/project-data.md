# 프로젝트 지표 · 트러블슈팅 원본

`src/data/projects.ts` 의 `metrics` 와 `troubleshooting` 필드에 들어가는 값의
출처를 남겨 둔 문서입니다.

수치는 전부 각 프로젝트 저장소의 README · 코드 · 테스트에서 직접 확인한 것입니다.
추정하거나 보기 좋게 반올림한 값은 없고, 확인 경로를 note 열에 같이 적어
나중에 다시 검증할 수 있게 했습니다.

정리에는 Claude Code 를 함께 썼습니다. 저장소를 훑어 후보 수치를 모으고 표로
옮기는 작업을 맡겼고, 그중 무엇을 지표로 내보낼지는 직접 골랐습니다.

---

## 1. NEXTOUR (travel-agency)

### metrics
| label | value | note |
|---|---|---|
| ADR | 62건 | 0001–0062, 결번 없음 |
| 결제 | 2-phase | 좌석 선점 → PG 승인 → DB 확정 |
| 환불 | 3-phase saga | 외부 IO를 DB 트랜잭션 밖으로 격리 |
| 멱등성 | 3중 | Idempotency-Key · RefundJob 게이트 · providerEventId |
| 아키텍처 | FSD 5-레이어 | app · widgets 13 · features 20 · entities 10 · shared |
| 테스트 | 1,417건 | 176개 파일 · 2026.10 기준 |
| 성능 계측 | 자체 RUM | Web Vitals p75 · PostgreSQL percentile_cont |

### troubleshooting — 외부 PG 호출을 DB 트랜잭션 밖으로

**Situation**
환불은 자사 DB와 외부 PG(토스)에 걸친 분산 트랜잭션입니다.
PG 호출과 DB 갱신이 한 트랜잭션 안에 있으면, PG는 성공했는데 DB 커밋이 실패하는 순간
고객 돈은 나갔지만 시스템은 환불을 모르는 상태가 됩니다.

**Cause**
외부 네트워크 호출이 트랜잭션 안에 있으면 두 가지가 동시에 문제가 됩니다.
PG 응답을 기다리는 수 초 동안 DB 락이 유지되고, 실패 지점에 따라 결과가 갈립니다.

**Solution**
Phase를 셋으로 쪼갰습니다.
Phase 1(DB Tx)에서 멱등 게이트를 통과시키고 원장을 조건부 차감해 예약합니다.
Phase 2는 트랜잭션 **밖**에서 PG를 호출합니다.
Phase 3(DB Tx)에서 정산하고 이벤트를 적재합니다.
PG 호출이 실패하면 RefundJob을 PENDING으로 적재하고 지수 백오프로 cron worker가 재시도합니다.
그동안에도 예약 상태는 무결성을 유지합니다.

**Outcome**
락 윈도우가 마이크로초 단위로 줄었고, PG 실패가 데이터 불일치로 이어지지 않습니다.
3중 멱등성으로 이중 환불도 차단됩니다. (ADR-0003)

---

## 2. SEFLIX (netflix)

### metrics
| label | value | note |
|---|---|---|
| Performance | 93 | Lighthouse 13.2.0 · Emulated Desktop · 2026.06.17 |
| Accessibility | 98 | |
| Best Practices | 100 | |
| SEO | 100 | |
| LCP | 1.6s | Good 구간 |
| CLS | 0 | Good 구간 |
| TBT | 0ms | Good 구간 |

### troubleshooting — 예고편 모달이 중복으로 열리는 문제

**Situation**
카드 사이로 마우스를 빠르게 옮기면 예고편 모달이 여러 개 겹쳐 열렸습니다.

**Cause**
호버할 때마다 영상 정보를 비동기로 요청하는데, 응답 도착 순서가 요청 순서와 다를 수 있습니다.
먼저 벗어난 카드의 응답이 나중에 도착하면, 이미 떠나온 카드의 모달이 뒤늦게 열립니다.

**Solution**
카드마다 UUID를 부여하고 전역 modalId와 일치할 때만 모달을 열도록 했습니다.
응답이 도착해도 자기 차례가 아니면 무시됩니다.
호버 3초 후에 요청하고 벗어나면 취소해, 스쳐 지나가는 호버는 애초에 요청하지 않습니다.

**Outcome**
모달 중복이 사라졌고, 불필요한 API 호출도 함께 줄었습니다.

---

## 3. Junsgram

### metrics
| label | value | note |
|---|---|---|
| Next.js | 13.5 → 16 | App Router · Turbopack |
| React | 18 → 19 | |
| 인증 | NextAuth v4 → Auth.js v5 | |
| 단위 테스트 | 20건 | Vitest |
| E2E | 5건 | Playwright |
| CI | 전 PR 게이팅 | lint · typecheck · test · build |

### troubleshooting — 로그인할 때마다 유저가 중복 생성되던 버그

**Situation**
Auth.js v5로 마이그레이션하던 중, Sanity에 유저 문서가 계속 늘어나는 것을 발견했습니다.

**Cause**
앱이 Sanity 유저 문서의 키로 `user.id`를 쓰고 있었습니다.
그런데 이 값은 세션마다 새로 생성되는 랜덤 UUID였습니다.
같은 사람이 로그인해도 매번 다른 키가 나오니, 조회에 실패하고 새 문서를 만들었습니다.

**Solution**
로그인 방식이 같으면 변하지 않는 Google providerAccountId로 키를 교체했습니다.

**Outcome**
중복 생성이 멈췄습니다.
이 버그는 마이그레이션 때문에 생긴 게 아니라 원래 있던 문제였고,
전환 과정에서 인증 흐름을 다시 읽다가 드러났습니다.

---

## 4. 서울, 너와 함께 (date)

### metrics
| label | value | baseline | note |
|---|---|---|---|
| API 응답 | 9,935 bytes | 314,546 bytes | 식당 추천 5건 기준 · base64 내장 방식과의 비교 측정(314,546 대 9,935 bytes) |
| Accessibility | 96 | | Lighthouse |
| POI | 2,608건 | | 한 · 영 · 일 · 중(간체) |
| 플랫폼 | Web + Native | | 동일 /api 계약 공유 |
| ADR | 5건 | | |

### troubleshooting — 응답에 이미지를 담지 않는 설계와 비교 측정

**Situation**
식당 추천 API는 장소 사진을 함께 내려줘야 했습니다.
사진을 응답에 직접 담으면 목록 하나 여는 데 얼마가 오가는지 확인할 필요가 있었습니다.

**Cause**
사진을 base64로 인코딩해 JSON 안에 넣으면 원본보다 약 33% 커지는 데다,
응답 전체가 하나의 JSON이라 이미지가 다 도착할 때까지 목록을 그릴 수 없습니다.

**Solution**
응답에는 이미지 URL만 담고, 실제 이미지는 브라우저가 별도로 받아가게 했습니다.
텍스트 정보가 먼저 도착해 목록이 즉시 그려지고, 이미지는 뒤따라 채워집니다.

**Outcome**
base64 내장 방식과의 비교 측정(314,546 대 9,935 bytes)에서 96.84% 작았습니다.
이미지 로딩이 목록 렌더를 막지 않는 구조입니다.

---

## 5. SHOPPY (shoppy)

### metrics
(배지 없이 간결하게 — 5순위 프로젝트)

### troubleshooting — 비로그인 상태에서 발생하던 불필요한 요청

**Situation**
로그인하지 않은 사용자가 페이지에 들어와도 장바구니 조회 요청이 나갔습니다.

**Cause**
`useCart` 훅이 컴포넌트 마운트 시점에 무조건 실행됐습니다.
uid가 없으면 조회할 대상 자체가 없는데도 요청은 그대로 나갔습니다.

**Solution**
React Query의 `enabled: !!uid` 가드를 걸어 uid가 확정된 뒤에만 쿼리가 실행되게 했습니다.

**Outcome**
비로그인 사용자의 불필요한 요청이 사라졌습니다.
Firebase REST 호출을 fetch 얇은 래퍼로 직접 제어하고 모든 읽기에 빈 값 폴백을 두어,
네트워크 실패가 화면 전체를 깨뜨리지 않도록 했습니다.
