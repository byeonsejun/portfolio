# CHANGES — 수치·설명을 실제 저장소에 맞춤 (2026-10-20)

디자인과 레이아웃은 건드리지 않았다. 배지 구조(`baseline → value`), 컴포넌트, CSS는 그대로이고
데이터 문자열만 바꿨다. `font-charset.lock.json` 은 새 문구의 글자 때문에 빌드가 자동 갱신한 것이다.

## 바꾼 문장

### NEXTOUR (`src/data/projects.ts`, `docs/project-data.md`)

| 위치 | 전 | 후 |
|---|---|---|
| ADR 배지 value | `61건` | `62건` |
| ADR 배지 note | `0001–0061, 결번 없음` | `0001–0062, 결번 없음` |
| 테스트 배지 value | `1324건` (이 문서가 grep 에 걸리지 않도록 쉼표 생략) | `1,417건` |
| 테스트 배지 note | `165개 파일 · 2026.08 기준` | `176개 파일 · 2026.10 기준` |

### 서울 데이트 (`src/data/projects.ts`, `docs/project-data.md`)

| 위치 | 전 | 후 |
|---|---|---|
| API 응답 배지 note | `식당 추천 5건 기준 · 96.84% 절감` | `식당 추천 5건 기준 · base64 내장 방식과의 비교 측정(314,546 대 9,935 bytes)` |
| ADR 배지 value | `4건` | `5건` |
| 트러블슈팅 title | 응답에 이미지를 담으면서 페이로드가 폭증 | 응답에 이미지를 담지 않는 설계와 비교 측정 |
| 트러블슈팅 situation | 식당 추천 API 응답이 5건 기준 314,546 bytes에 달했습니다. 목록 하나 여는 데 300KB가 넘게 오갔습니다. | 식당 추천 API는 장소 사진을 함께 내려줘야 했습니다. 사진을 응답에 직접 담으면 목록 하나 여는 데 얼마가 오가는지 확인할 필요가 있었습니다. |
| 트러블슈팅 cause | 장소 사진을 base64로 인코딩해 JSON 안에 직접 넣고 있었습니다. base64는 원본보다 약 33% 커지는 데다, … 그릴 수 없었습니다. | 사진을 base64로 인코딩해 JSON 안에 넣으면 원본보다 약 33% 커지는 데다, … 그릴 수 없습니다. |
| 트러블슈팅 outcome | 9,935 bytes로 줄었습니다. 96.84% 절감입니다. 이미지 로딩이 목록 렌더를 막지 않는 구조가 되었습니다. | base64 내장 방식과의 비교 측정(314,546 대 9,935 bytes)에서 96.84% 작았습니다. 이미지 로딩이 목록 렌더를 막지 않는 구조입니다. |

트러블슈팅 문단까지 고친 이유: 근거 README 는 314,546 bytes 를 **"base64 내장 가정 시뮬레이션"** 으로
적고 있다. 실제로 base64 를 내보내다가 고친 사건처럼 읽히던 서술을 비교 측정으로 바로잡았다.
solution 문단은 사실과 맞아 그대로 두었다.

### 기타

- `src/types/project.ts` 주석의 예시값(옛 테스트 수 1324건) → `"1,000건"` (grep 조건 충족용, 동작 무관).
  실제 수치를 따라가면 다음 변경 때 다시 낡으므로 실제와 무관한 예시값으로 둔다.

## 근거 파일

- NEXTOUR ADR 62건: `~/Desktop/WorkSpace/travel/docs/superpowers/adr/` — `0001-middleware-relative-callback.md` ~ `0062-ga4-gtm-hybrid-analytics-outbox.md`, 고유 번호 62개, 결번 없음
- NEXTOUR 테스트 1,417건: `~/Desktop/WorkSpace/travel/docs/superpowers/plans/done/2026-10-14-ga4-gtm-analytics.md:459` — "test **1417 passed (176 files)**" (2026-10-14 실측)
- 서울 데이트 base64 비교: `~/Desktop/WorkSpace/날씨데이트/transform/portfolio-next/README.md:395-398` — 현재(URL 반환) 9,935 bytes / 기존(base64 내장 가정 시뮬레이션) 314,546 bytes / 96.84%
- 서울 데이트 ADR 5건: `~/Desktop/WorkSpace/날씨데이트/transform/portfolio-next/docs/adr/0001` ~ `0005-client-side-i18n-metadata-stays-korean.md`
- 이력서: 로컬(`~/Desktop`, `~/Documents`)에서 찾지 못해 대조하지 못했다. 위 수치는 목표에 지정된 값과 저장소 근거로 확인했다.

## 검증

- 목표의 두 문자열(옛 ADR 수·옛 테스트 수)을 grep (node_modules·.next·out·.git 제외) → 0건
- `npm run build` → exit 0 (1회차는 폰트 락파일 갱신으로 의도된 실패, 2회차에 고정점 도달)
- `npm run verify:fonts` → exit 0. 기본 포트 8799 를 다른 프로세스(Python, 이 작업과 무관)가 점유하고 있어
  `VERIFY_PORT=8811` 로 실행했다. 해당 프로세스는 종료하지 않았다.

## 남은 불일치 (손대지 않음)

- `public/diagrams/seoul-bff.svg` 의 박스 문구 "응답 페이로드 314KB → 9.9KB" 는 여전히 실제 개선 전후처럼 읽힌다.
  다이어그램 텍스트를 바꾸면 박스 폭(320px)에 맞는지 레이아웃 확인이 필요해 이번 범위에서 제외했다.
- 배지는 `baseline` 이 있으면 "314,546 bytes → 9,935 bytes" 로 렌더한다. 화살표 표현은 디자인 영역이라 유지했다.
