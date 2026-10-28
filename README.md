# KBOrillion

KBO 선수 이름으로 치는 홈런더비 게임이에요. 문제에 맞는 선수를 대면 홈런이고, 그 문제의 정답으로 뻔하지 않을수록 멀리 날아가요.

## 규칙

- 정답 = 홈런. 덜 뻔한 정답일수록 95~185m, 아무도 생각 못 할 정답은 180m 이상
- 꽤 뻔한 정답은 펜스 직격 80m, 너무너무 뻔한 정답은 뜬공 아웃
- 틀리면 스트라이크, 한 문제에서 3스트라이크면 아웃
- 투구 시계 15초 초과나 건너뛰기는 바로 아웃, 3아웃이면 경기 끝
- 외국인 선수는 성이나 이름 한 단어만 쳐도 누구인지 확인해 줌
- 리더보드: 최고 비거리와 총 비거리 상위 20명 (브라우저별 개인 최고 기록)

## 파일

| 경로 | 내용 |
|---|---|
| `public/index.html` | 게임 화면 |
| `public/kbo_derby.json` | 선수 3,380명과 문제 데이터 (게임에는 정답 60명 이상인 문제만 나옴, 팀·이름·국가대표 등 묶음을 고르게 돌아가며 출제) |
| `netlify/functions/scores.mjs` | 리더보드 API (`/api/scores`), Netlify Blobs에 저장 |
| `netlify/functions/stats.mjs` | 방문·플레이 집계 API (`/api/stats`) |
| `public/stats.html` | 통계 확인 페이지 (`/stats.html`, 검색엔진 제외) |
| `scripts/build_data.js` | 위키백과에서 데이터를 다시 만드는 스크립트 |
| `scripts/remix_data.mjs` | 지금 데이터로 조합 문제를 더 만들고 비거리를 다시 매기는 스크립트 (`node scripts/remix_data.mjs`) |

## 배포 (Netlify)

1. Netlify에 GitHub 계정으로 로그인
2. **Add new site → Import an existing project → GitHub** → 이 저장소 선택
3. 설정은 `netlify.toml`이 알아서 채워요. 빌드 명령은 비워 두고 **Deploy**
4. 이후 이 저장소에 올라오는 변경은 자동으로 다시 배포돼요

## 데이터 다시 만들기

`scripts/build_data.js` 맨 위 설명을 따라 ko.wikipedia.org를 연 브라우저 콘솔에서 실행하면 `kbo_derby.json`이 내려받아져요. 그 파일로 `public/kbo_derby.json`을 바꾼 뒤 `node scripts/remix_data.mjs`를 한 번 돌리면 돼요.

데이터 출처는 한국어 위키백과의 분류와 위키미디어 조회수 통계예요. 위키백과 문서에 분류가 빠진 선수는 일부 문제에서 누락될 수 있어요.
