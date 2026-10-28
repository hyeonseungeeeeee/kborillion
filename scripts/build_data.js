/*
 * 크보릴리온 데이터 생성 스크립트
 * ─────────────────────────────────
 * 실행 위치: 브라우저에서 https://ko.wikipedia.org 아무 문서나 연 뒤, 개발자 도구 콘솔에 붙여 넣고 실행.
 *   (위키백과 API는 요청이 몰리면 503으로 막기 때문에, 일반 분류 페이지 HTML을 천천히 읽는다.)
 * 결과: 끝나면 kbo_derby.json 파일이 내려받아진다 → public/kbo_derby.json 으로 교체.
 * 소요 시간: 30분 안팎 (분류 페이지 수백 개 + 선수 조회수 3,000여 건 + 외국인 문서 500여 개)
 *
 * 비거리 규칙
 *  - 문제마다 '뻔함' 점수 = 조회수 순위 × (그 선수가 같은 종류 분류에 몇 개 속하는지의 역수)^0.7
 *    예) 한 팀에서만 뛴 레전드는 그 팀 문제의 뻔한 답, 여러 팀을 거친 선수는 잠깐 뛴 팀 문제에서 덜 뻔함
 *  - 가장 뻔한 5%(정답 60명 미만 문제는 10%) → 80m 펜스 직격
 *  - 나머지는 덜 뻔할수록 100~155m
 *  - 크릴리온 정답(165m 장외홈런): 유명하지만 그 문제와 연결이 약한 선수, 없으면 하위권 중 그나마 알려진 선수
 *  - 동명이인은 위키백과 문서 단위로 따로 저장(게임에서 이름이 같으면 맞는 사람을 골라 인정)
 */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clean = (t) => t.replace(/\s*\([^)]*\)\s*$/, "").trim();

  async function getHTML(url) {
    for (let i = 0; i < 8; i++) {
      await sleep(500);
      let r;
      try { r = await fetch(url); } catch { await sleep(3000); continue; }
      if (r.status === 429 || r.status === 503) { await sleep(1000 * (+r.headers.get("retry-after") || 10)); continue; }
      if (r.status !== 200) return null;
      return new DOMParser().parseFromString(await r.text(), "text/html");
    }
    return null;
  }
  // 분류 페이지의 문서 목록 전부 (200개씩 페이지 넘김)
  async function categoryMembers(cat) {
    let url = "/wiki/" + encodeURIComponent(("분류:" + cat).replace(/ /g, "_"));
    const out = new Set();
    while (url) {
      const d = await getHTML(url);
      const box = d && d.querySelector("#mw-pages");
      if (!box) break;
      box.querySelectorAll(".mw-category li a").forEach((a) => out.add(a.title));
      const nx = [...box.querySelectorAll(":scope > a")].find((a) => /다음/.test(a.textContent));
      url = nx ? nx.getAttribute("href") : null;
    }
    return out;
  }

  // 1) 문제 목록 (분류 이름, 문제 문구, 그룹)
  const TEAMS = ["삼성 라이온즈","롯데 자이언츠","LG 트윈스","두산 베어스","KIA 타이거즈","한화 이글스","SK 와이번스","SSG 랜더스","NC 다이노스","KT 위즈","키움 히어로즈","넥센 히어로즈","해태 타이거즈","현대 유니콘스","쌍방울 레이더스","OB 베어스","빙그레 이글스","태평양 돌핀스","MBC 청룡","삼미 슈퍼스타즈"];
  const P = [
    ...TEAMS.map((t) => [t + " 선수", t + "에서 뛴 선수", "team"]),
    ...[["투수","투수로"],["포수","포수로"],["유격수","유격수로"],["2루수","2루수로"],["3루수","3루수로"],["1루수","1루수로"],["외야수","외야수로"]]
      .map(([p, w]) => ["KBO 리그 " + p, `KBO에서 ${w} 뛴 선수`, "pos"]),
    ["KBO 리그 외국인 선수", "KBO 외국인 선수", "foreign"],
    ...[["KBO MVP 수상자","KBO 정규시즌 MVP 수상자"],["KBO 신인상 수상자","KBO 신인왕"],["KBO 골든글러브 수상자","골든글러브를 받은 선수"],
        ["KBO 홈런상 수상자","KBO 홈런왕"],["KBO 타율상 수상자","KBO 타격왕(타율 1위)"],["KBO 타점상 수상자","KBO 타점왕"],["KBO 안타상 수상자","KBO 최다안타 1위"],
        ["KBO 평균자책점상 수상자","KBO 평균자책점 1위"],["KBO 탈삼진상 수상자","KBO 탈삼진왕"],["KBO 승리상 수상자","KBO 다승왕"],
        ["KBO 리그 개막전 선발투수","KBO 개막전 선발투수"],["KBO 리그 영구 결번","KBO 영구결번 선수"]].map(([c, q]) => [c, q, "award"]),
    ...[["대한민국 야구 국가대표팀 선수","야구 국가대표를 지낸 KBO 선수"],["2008년 하계 올림픽 야구 참가 선수","2008 베이징 올림픽 야구 대표"],
        ["2006년 월드 베이스볼 클래식 참가 선수","2006 WBC 출전 선수"],["2009년 월드 베이스볼 클래식 참가 선수","2009 WBC 출전 선수"]].map(([c, q]) => [c, q, "intl"]),
  ];
  const EXTRA = {
    region: ["서울특별시","부산광역시","대구광역시","인천광역시","광주광역시","대전광역시","울산광역시","강원도","강원특별자치도","충청북도","충청남도","전라북도","전북특별자치도","전라남도","경상북도","경상남도","제주특별자치도"].map((x) => x + " 출신 야구 선수"),
    nation: ["도미니카 공화국","베네수엘라","미국","쿠바","일본","캐나다","푸에르토리코","멕시코","오스트레일리아","파나마"].map((x) => x + "의 야구 선수"),
    year: ["1982년 출생","1987년 출생","1999년 출생","2000년 출생"],
    mlb: ["뉴욕 양키스","보스턴 레드삭스","로스앤젤레스 다저스","시카고 컵스","뉴욕 메츠","피츠버그 파이리츠","텍사스 레인저스","시애틀 매리너스","샌디에이고 파드리스","신시내티 레즈","콜로라도 로키스","볼티모어 오리올스","미네소타 트윈스","오클랜드 애슬레틱스","애리조나 다이아몬드백스","세인트루이스 카디널스","토론토 블루제이스","디트로이트 타이거스","밀워키 브루어스","클리블랜드 인디언스","캔자스시티 로열스","휴스턴 애스트로스","탬파베이 레이스","시카고 화이트삭스","필라델피아 필리스","애틀랜타 브레이브스","샌프란시스코 자이언츠","로스앤젤레스 에인절스","마이애미 말린스","워싱턴 내셔널스"].map((x) => x + " 선수"),
    npb: ["요미우리 자이언츠","한신 타이거스","주니치 드래건스","후쿠오카 소프트뱅크 호크스","오릭스 버팔로즈","지바 롯데 마린스","도쿄 야쿠르트 스왈로스"].map((x) => x + " 선수"),
    abroadKor: ["미국에 거주한 대한민국인","일본에 거주한 대한민국인","대한민국의 미국 진출 야구 선수","대한민국 출신 메이저 리그 베이스볼 선수","대한민국 출신 일본 프로 야구 선수"],
  };

  // 2) KBO 선수 전체 = 20개 구단 분류의 합집합
  console.log("구단 분류 읽는 중…");
  const mem = {};
  for (const [c] of P.filter((p) => p[2] === "team")) mem[c] = await categoryMembers(c);
  const titles = [...new Set(Object.values(mem).flatMap((s) => [...s]))];
  const isKBO = new Set(titles);
  console.log("KBO 선수", titles.length, "명");

  // 3) 나머지 분류 (KBO 선수만 남김)
  const keep = (s) => new Set([...s].filter((t) => isKBO.has(t)));
  for (const [c] of P.filter((p) => p[2] !== "team")) mem[c] = keep(await categoryMembers(c));
  const ext = {};
  for (const list of Object.values(EXTRA)) for (const c of list) ext[c] = keep(await categoryMembers(c));
  console.log("분류 수집 완료");

  // 4) 조회수 (2025-10 ~ 2026-09, 위키미디어 통계 서버, 너무 빠르면 429)
  const views = {};
  const queue = [...titles];
  async function worker() {
    while (queue.length) {
      const t = queue.shift();
      const u = "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/ko.wikipedia/all-access/user/" +
        encodeURIComponent(t.replace(/ /g, "_")) + "/monthly/20251001/20260930";
      for (let i = 0; i < 6; i++) {
        let r; try { r = await fetch(u); } catch { await sleep(3000); continue; }
        if (r.ok) { views[t] = (await r.json()).items.reduce((a, x) => a + x.views, 0); break; }
        if (r.status === 404) { views[t] = 0; break; }
        await sleep(5000 * (i + 1));
      }
      await sleep(150);
    }
  }
  console.log("조회수 받는 중… (10분 이상)");
  await Promise.all([worker(), worker(), worker()]);

  // 5) 외국인 = 외국인 분류 ∪ 이름에 띄어쓰기가 있는 선수. 문서 분류로 투수/타자 판정
  const foreignT = new Set([...mem["KBO 리그 외국인 선수"], ...titles.filter((t) => /\s/.test(clean(t)))]);
  const fcat = {};
  console.log("외국인 선수 문서 읽는 중…", foreignT.size);
  for (const t of foreignT) {
    const d = await getHTML("/wiki/" + encodeURIComponent(t.replace(/ /g, "_")));
    fcat[t] = d ? [...d.querySelectorAll("#mw-normal-catlinks li a")].map((a) => a.textContent) : [];
  }

  // 6) 문제 만들기
  const pid = new Map(titles.map((t, i) => [t, i]));
  const players = titles.map((t) => [clean(t), views[t] || 0]);
  const V = (i) => players[i][1], N = (i) => players[i][0];
  const ids = (s) => [...s].map((t) => pid.get(t)).filter((x) => x != null);
  const isKor = (i) => /^[가-힣]{2,3}$/.test(N(i));
  const U = (...ss) => new Set(ss.flatMap((s) => [...s]));
  const S = {}; for (const [c] of P) S[c] = new Set(ids(mem[c]));
  const E = {}; for (const c in ext) E[c] = new Set(ids(ext[c]));

  const foreign = new Set(ids(foreignT));
  const P_ = S["KBO 리그 투수"];
  const F_ = U(...P.filter((p) => p[2] === "pos" && p[0] !== "KBO 리그 투수").map((p) => S[p[0]]));
  const fc = (i) => fcat[titles[i]] || [];
  const fP = (i) => P_.has(i) || fc(i).some((c) => c.includes("투수"));
  const fH = (i) => F_.has(i) || fc(i).some((c) => /(외야수|내야수|포수|루수|유격수|지명 타자)/.test(c));

  const cats = [["all", "KBO에서 뛴 적 있는 선수", players.map((_, i) => i)]];
  for (const [c, q, g] of P) cats.push([g, q, g === "foreign" ? foreign : S[c]]);
  const region = {};
  for (const c of EXTRA.region) { let x = c.replace(" 출신 야구 선수", "").replace(/(특별시|광역시|특별자치시|특별자치도)$/, ""); if (/^(경기|강원)도$/.test(x)) x = x.slice(0, 2); region[x] = U(region[x] || [], E[c]); }
  for (const [x, s] of Object.entries(region)) cats.push(["region", `${x} 출신 KBO 선수`, s]);
  for (const c of EXTRA.nation) cats.push(["nation", c.replace("의 야구 선수", "") + " 출신 KBO 선수", E[c]]);
  for (const c of EXTRA.year) cats.push(["year", c.replace("년 출생", "") + "년생 KBO 선수", E[c]]);

  // 구단 계열(이름만 바뀐 팀은 한 팀)
  const fr = { "KIA": ["해태 타이거즈","KIA 타이거즈"], "두산": ["OB 베어스","두산 베어스"], "LG": ["MBC 청룡","LG 트윈스"], "한화": ["빙그레 이글스","한화 이글스"],
    "히어로즈": ["넥센 히어로즈","키움 히어로즈"], "SSG": ["SK 와이번스","SSG 랜더스"], "현대": ["삼미 슈퍼스타즈","태평양 돌핀스","현대 유니콘스"],
    "삼성": ["삼성 라이온즈"], "롯데": ["롯데 자이언츠"], "NC": ["NC 다이노스"], "KT": ["KT 위즈"], "쌍방울": ["쌍방울 레이더스"] };
  const clubs = new Map();
  for (const [k, ts] of Object.entries(fr)) for (const t of ts) for (const i of S[t + " 선수"] || []) { if (!clubs.has(i)) clubs.set(i, new Set()); clubs.get(i).add(k); }
  const one = [...clubs].filter(([i, c]) => c.size === 1 && isKor(i) && !foreign.has(i)).map(([i]) => i);
  const nm = { KIA: "해태·KIA", 두산: "OB·두산", LG: "MBC·LG", 한화: "빙그레·한화", SSG: "SK·SSG", 현대: "현대(삼미~태평양 포함)" };
  cats.push(["fame", "한 팀에서만 뛴 원클럽맨 (한국인 선수)", one]);
  for (const k of Object.keys(fr)) cats.push(["fame", `${nm[k] || k}에서만 뛴 원클럽맨`, one.filter((i) => clubs.get(i).has(k))]);

  const mlbAll = U(...EXTRA.mlb.map((c) => E[c])), npbAll = U(...EXTRA.npb.map((c) => E[c]));
  const abroadKor = U(...EXTRA.abroadKor.map((c) => E[c]), [...mlbAll].filter(isKor), [...npbAll].filter(isKor));
  const gone = U(...["삼미 슈퍼스타즈","태평양 돌핀스","현대 유니콘스","쌍방울 레이더스","MBC 청룡","해태 타이거즈","OB 베어스","빙그레 이글스"].map((t) => S[t + " 선수"]));
  const titleSet = U(...P.filter((p) => p[2] === "award" && /MVP|신인상|홈런상|타율상|타점상|안타상|평균자책점상|탈삼진상|승리상/.test(p[0])).map((p) => S[p[0]]));
  cats.push(
    ["fame", "미국이나 일본에서 뛴 적 있는 한국인 선수", abroadKor],
    ["fame", "메이저리그 구단을 거친 외국인 선수", [...mlbAll].filter((i) => foreign.has(i))],
    ["fame", "세 팀 이상을 거친 저니맨 (한국인 선수)", [...clubs].filter(([i, c]) => c.size >= 3 && isKor(i)).map(([i]) => i)],
    ["fame", "두 팀 이상에서 뛴 한국인 선수", [...clubs].filter(([i, c]) => c.size >= 2 && isKor(i)).map(([i]) => i)],
    ["fame", "투수와 야수 기록이 모두 있는 선수 (포지션 전향 등)", [...P_].filter((i) => F_.has(i))],
    ["fame", "지금은 없어진 구단에서 뛴 선수 (해태·OB·MBC·빙그레·현대·쌍방울 등)", gone],
    ["fame", "외국인 투수", [...foreign].filter(fP)],
    ["fame", "외국인 타자", [...foreign].filter((i) => !fP(i) && fH(i))],
    ["fame", "개인 타이틀(MVP·신인왕·홈런왕·다승왕 등)을 하나라도 딴 선수", titleSet],
  );
  // 이름 문제 (한국 이름 2~3글자, 외자 포함)
  const kor = players.map((_, i) => i).filter(isKor);
  const sur = {}; kor.forEach((i) => (sur[N(i)[0]] = (sur[N(i)[0]] || 0) + 1));
  cats.push(["name", "외자 이름 KBO 선수 (예: ○○ 두 글자)", kor.filter((i) => N(i).length === 2)],
            ["name", "흔치 않은 성씨의 KBO 선수 (김·이·박 등 제외)", kor.filter((i) => sur[N(i)[0]] < 15)]);
  for (const ch of ["호","민","수","현","우","훈","진","석"]) cats.push(["name", `이름이 '${ch}'(으)로 끝나는 KBO 선수`, kor.filter((i) => N(i).slice(-1) === ch)]);
  for (const ch of ["용","영","상"]) cats.push(["name", `이름에 '${ch}'이(가) 들어간 KBO 선수 (성 제외)`, kor.filter((i) => N(i).slice(1).includes(ch))]);
  for (const ch of ["김","이","박","최","정","강","조","윤","장","임","한","오","신","권","황","송","류","홍"]) cats.push(["name", `${ch}씨 성의 KBO 선수`, kor.filter((i) => N(i)[0] === ch)]);

  // 7) 비거리 계산
  const cnt = {};
  for (const [g, , s] of cats) { if (!["team", "pos", "award", "intl"].includes(g)) continue; cnt[g] = cnt[g] || new Map(); for (const i of new Set(s)) cnt[g].set(i, (cnt[g].get(i) || 0) + 1); }
  const prompts = [];
  for (const [g, q, s0] of cats) {
    const s = [...new Set(s0)], n = s.length;
    if (n < 12) continue;
    const byV = [...s].sort((a, b) => V(b) - V(a));
    const fp = new Map(byV.map((id, r) => [id, 1 - r / Math.max(1, n - 1)]));
    const assoc = (id) => (cnt[g] && cnt[g].get(id) ? 1 / cnt[g].get(id) : 1);
    const o = (id) => fp.get(id) * Math.pow(assoc(id), 0.7);
    const ord = [...s].sort((a, b) => o(b) - o(a));
    let gem = null, best = 0;
    if (cnt[g]) for (const id of s) { const sc = fp.get(id) * (1 - assoc(id)); if (sc > best) { best = sc; gem = id; } }
    if (gem == null || best < 0.15) { const deep = ord.slice(Math.floor(n * 0.65)).sort((a, b) => V(b) - V(a)); gem = deep[Math.floor(deep.length * 0.1)]; }
    const rest = ord.filter((id) => id !== gem);
    const nf = Math.max(1, Math.round(rest.length * (n < 60 ? 0.1 : 0.05))), k = rest.length - nf;
    const m = rest.map((id, r) => [id, r < nf ? 80 : Math.round(100 + 55 * (k > 1 ? (r - nf) / (k - 1) : 0))]);
    m.push([gem, 165]);
    prompts.push({ q, m, gem });
  }

  // 8) 내려받기
  const out = JSON.stringify({ players, prompts });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([out], { type: "application/json" }));
  a.download = "kbo_derby.json";
  document.body.appendChild(a); a.click();
  console.log("완료: 선수", players.length, "명 · 문제", prompts.length, "개 (게임에는 정답 60명 이상만 나옴)");
})();
