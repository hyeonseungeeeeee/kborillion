// 이미 있는 public/kbo_derby.json으로 조합 문제를 더 만들고 비거리를 다시 매기는 스크립트
// 실행: node scripts/remix_data.mjs   (위키백과 접속 없이 이 저장소 안에서 바로 돌아감)
// build_data.js로 데이터를 새로 만든 뒤에도 이 스크립트를 한 번 더 돌릴 것
//
// 하는 일
// 0) 선수 목록 문서처럼 선수가 아닌 항목을 정답에서 뺌
// 1) 문제마다 묶음(g)을 붙임 → 게임에서 같은 종류 문제가 몰리지 않게 골고루 냄
// 2) 기존 문제를 조합한 새 문제 추가(x: 1 표시, 다시 돌리면 지우고 새로 만듦)
// 3) 비거리: 뻔한 순서대로 2% 뜬공(0) · 6% 펜스(80) · 나머지 홈런 95~179, 가장 덜 뻔한 10%는 180
//    (180은 게임에서 칠 때마다 180~185m 무작위). 크릴리온 정답(gem)은 없앰
// 4) data/namu.json(scripts/namu/build.py가 만듦)이 있으면
//    - '뻔한 정도'를 나무위키 유명도로 다시 매김: 문제 안 유명도 순위 × (팀 문제면 거친 구단 수로 나눈 값)^0.7
//      → 한 팀에서만 뛴 스타는 그 팀 문제의 뻔한 답, 여러 팀을 거친 스타는 덜 뻔함
//    - 나무위키 분류·명단 문제를 더함(x: 2)
//    - 유명도 0.8 이상(대략 상위 20%) 정답이 KNOWN명 미만인 '너무 마이너한' 문제는 h: 1 (게임에 안 나옴)
import fs from "fs";

const FILE = new URL("../public/kbo_derby.json", import.meta.url);
const d = JSON.parse(fs.readFileSync(FILE, "utf8"));
const names = d.players.map((p) => p[0]);
// 위키백과 '○○의 선수 목록', '틀:' 문서가 선수로 잘못 들어온 것은 정답에서 뺌
const junk = new Set(names.map((n, i) => (/의 (외국인 )?선수 목록$|^틀:/.test(n) ? i : -1)).filter((i) => i >= 0));
const base = d.prompts.filter((p) => !p.x).map((p) => ({ ...p, m: p.m.filter(([i]) => !junk.has(i)) }));
const NAMU = new URL("../data/namu.json", import.meta.url);
const namu = fs.existsSync(NAMU) ? JSON.parse(fs.readFileSync(NAMU, "utf8")) : null;
const fame = namu ? namu.fame : null;

// 문제별 '뻔한 정도' (0 = 가장 뻔함, 1 = 가장 덜 뻔함). 나무위키가 없으면 지금 비거리 순서를 그대로 씀
const rankOf = new Map();
const FRANCHISE = [["삼성 라이온즈"], ["롯데 자이언츠"], ["LG 트윈스", "MBC 청룡"], ["두산 베어스", "OB 베어스"], ["KIA 타이거즈", "해태 타이거즈"],
  ["한화 이글스", "빙그레 이글스"], ["SK 와이번스", "SSG 랜더스"], ["NC 다이노스"], ["KT 위즈"], ["키움 히어로즈", "넥센 히어로즈"],
  ["현대 유니콘스", "태평양 돌핀스", "삼미 슈퍼스타즈"], ["쌍방울 레이더스"]];
const nClub = new Map();
for (const f of FRANCHISE) {
  const s = new Set(base.filter((p) => f.some((t) => p.q.startsWith(t))).flatMap((p) => p.m.map(([i]) => i)));
  for (const i of s) nClub.set(i, (nClub.get(i) || 0) + 1);
}
const teamQ = (q) => /삼성|롯데|LG|MBC|두산|OB|KIA|해태|한화|빙그레|SK|SSG|NC|KT|키움|넥센|히어로즈|현대|태평양|삼미|쌍방울/.test(q);
function obviousOrder(q, ids) {
  // 유명한 순(뻔한 순)으로 줄 세움. 팀 문제는 여러 구단을 거친 선수를 덜 뻔하게
  const byFame = [...ids].sort((a, b) => fame[b] - fame[a] || a - b), n = byFame.length;
  const fp = new Map(byFame.map((i, r) => [i, 1 - r / Math.max(1, n - 1)]));
  const o = (i) => fp.get(i) * (teamQ(q) ? Math.pow(1 / (nClub.get(i) || 1), 0.7) : 1);
  return [...ids].sort((a, b) => o(b) - o(a) || a - b);
}
for (const p of base) {
  const ord = fame ? obviousOrder(p.q, p.m.map(([i]) => i)) : p.m.map(([i, m], k) => [i, m, k]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(([i]) => i);
  rankOf.set(p.q, new Map(ord.map((i, r) => [i, r / Math.max(1, ord.length - 1)])));
}
const S = (q) => { const r = rankOf.get(q); if (!r) throw new Error("문제 없음: " + q); return new Set(r.keys()); };
const U = (...a) => new Set(a.flatMap((s) => [...s]));
const I = (...a) => new Set([...a[0]].filter((x) => a.slice(1).every((s) => s.has(x))));

function distances(order) {
  const n = order.length, nf = Math.round(n * 0.02), nk = Math.round(n * 0.06), hr = n - nf - nk, top = Math.max(1, Math.round(hr * 0.1)), lin = hr - top;
  return order.map((i, r) => {
    if (r < nf) return [i, 0];
    if (r < nf + nk) return [i, 80];
    const h = r - nf - nk;
    return [i, h >= lin ? 180 : Math.round(95 + 84 * (lin > 1 ? h / (lin - 1) : 0))];
  });
}
// parents: 뻔한 정도를 빌려 올 문제들. 선수가 들어 있는 부모들의 평균으로 줄 세움
function make(q, set, parents) {
  const score = (i) => { let s = 0, c = 0; for (const pq of parents) { const r = rankOf.get(pq).get(i); if (r != null) { s += r; c++; } } return c ? s / c : 1; };
  const order = [...set].sort((a, b) => score(a) - score(b) || a - b);
  return { q, m: distances(order), x: 1 };
}

// ---------- 새 문제 ----------
const ALL = "KBO에서 뛴 적 있는 선수", FOR = "KBO 외국인 선수", NAT = "야구 국가대표를 지낸 KBO 선수";
const JM = "세 팀 이상을 거친 저니맨 (한국인 선수)", OC = "한 팀에서만 뛴 원클럽맨 (한국인 선수)";
const GONE = "지금은 없어진 구단에서 뛴 선수 (해태·OB·MBC·빙그레·현대·쌍방울 등)", TWO = "두 팀 이상에서 뛴 한국인 선수";
const POS = { 투수: ["KBO에서 투수로 뛴 선수"], 포수: ["KBO에서 포수로 뛴 선수"],
  내야수: ["KBO에서 1루수로 뛴 선수", "KBO에서 2루수로 뛴 선수", "KBO에서 3루수로 뛴 선수", "KBO에서 유격수로 뛴 선수"],
  외야수: ["KBO에서 외야수로 뛴 선수"] };
const posSet = (k) => U(...POS[k].map(S));
const TEAM = { "삼성": ["삼성 라이온즈에서 뛴 선수"], "롯데": ["롯데 자이언츠에서 뛴 선수"],
  "LG(MBC)": ["LG 트윈스에서 뛴 선수", "MBC 청룡에서 뛴 선수"], "두산(OB)": ["두산 베어스에서 뛴 선수", "OB 베어스에서 뛴 선수"],
  "KIA(해태)": ["KIA 타이거즈에서 뛴 선수", "해태 타이거즈에서 뛴 선수"], "한화(빙그레)": ["한화 이글스에서 뛴 선수", "빙그레 이글스에서 뛴 선수"],
  "SK·SSG": ["SK 와이번스에서 뛴 선수", "SSG 랜더스에서 뛴 선수"], "NC": ["NC 다이노스에서 뛴 선수"], "KT": ["KT 위즈에서 뛴 선수"],
  "히어로즈": ["키움 히어로즈에서 뛴 선수", "넥센 히어로즈 시절 선수"] };
const teamSet = (k) => U(...TEAM[k].map(S));
const MIN = 60, extra = [];
const add = (q, set, parents, g) => { if (set.size >= MIN) extra.push({ ...make(q, set, parents), g }); };
const josa = (w, a, b) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 ? a : b; };

for (const t in TEAM) add(`${t}${josa(t.replace(/\)$/, ""), "을", "를")} 거친 외국인 선수`, I(teamSet(t), S(FOR)), [FOR, ...TEAM[t]], "외국인");
for (const t in TEAM) add(`${t}${josa(t.replace(/\)$/, ""), "을", "를")} 거친 저니맨 (세 팀 이상, 한국인)`, I(teamSet(t), S(JM)), [JM, ...TEAM[t]], "경력");
for (const t in TEAM) add(`${t}에서 뛴 국가대표`, I(teamSet(t), S(NAT)), [NAT, ...TEAM[t]], "국가대표");
for (const k in POS) {
  add(`국가대표를 지낸 ${k}`, I(posSet(k), S(NAT)), [NAT, ...POS[k]], "국가대표");
  add(`세 팀 이상 거친 저니맨 ${k} (한국인)`, I(posSet(k), S(JM)), [JM, ...POS[k]], "경력");
  add(`한 팀에서만 뛴 원클럽맨 ${k} (한국인)`, I(posSet(k), S(OC)), [OC, ...POS[k]], "원클럽맨");
  add(`지금은 없어진 구단에서 뛴 ${k}`, I(posSet(k), S(GONE)), [GONE, ...POS[k]], "경력");
}
add("LG(MBC)와 SK·SSG 모두에서 뛴 선수", I(teamSet("LG(MBC)"), teamSet("SK·SSG")), [...TEAM["LG(MBC)"], ...TEAM["SK·SSG"]], "팀");
add("미국 출신 투수", I(S("미국 출신 KBO 선수"), posSet("투수")), ["미국 출신 KBO 선수", "외국인 투수"], "출신");
add("두 팀 이상에서 뛴 국가대표 (한국인)", I(S(TWO), S(NAT)), [NAT, TWO], "국가대표");
add("골든글러브를 받은 야수 (투수 제외)", new Set([...S("골든글러브를 받은 선수")].filter((i) => !posSet("투수").has(i))), ["골든글러브를 받은 선수"], "수상·기록");

// 이름 문제 (부모 = 전체 선수의 유명도)
const foreign = S(FOR);
const kor = names.map((_, i) => i).filter((i) => !foreign.has(i) && /^[가-힣]{2,4}$/.test(names[i]));
const forg = names.map((_, i) => i).filter((i) => foreign.has(i));
const cho = (c) => Math.floor((c.charCodeAt(0) - 0xac00) / 588), bat = (c) => (c.charCodeAt(0) - 0xac00) % 28;
// q 안의 {예}는 그 문제에서 가장 유명한 선수 이름으로 바꿈
const pop = (i) => (fame ? fame[i] : d.players[i][1]);
const nm = (q, f, pool = kor) => { const s = pool.filter((i) => f(names[i])), top = s.reduce((a, i) => (pop(i) > pop(a) ? i : a), s[0]);
  add(q.replace("{예}", names[top]), new Set(s), [ALL], "이름"); };
for (const ch of "준재성동태승진정원") nm(`이름에 '${ch}'${josa(ch, "이", "가")} 들어간 KBO 선수 (성 제외)`, (n) => n.slice(1).includes(ch));
for (const ch of "환성") nm(`이름이 '${ch}'${josa(ch, "으로", "로")} 끝나는 KBO 선수`, (n) => n.slice(-1) === ch);
nm("이름 세 글자에 모두 받침이 있는 선수 (예: {예})", (n) => n.length === 3 && [...n].every((c) => bat(c) > 0));
nm("성과 이름 첫 글자의 첫소리가 같은 선수 (예: {예})", (n) => cho(n[0]) === cho(n[1]));
nm("성 뺀 이름 두 글자의 첫소리가 같은 선수 (예: {예})", (n) => n.length === 3 && cho(n[1]) === cho(n[2]));
const fn = (n) => n.replace(/ /g, "");
for (const t of ["스", "리", "로", "라"]) nm(`이름에 '${t}'${josa(t, "이", "가")} 들어간 외국인 선수`, (n) => fn(n).includes(t), forg);
nm("성(마지막 단어)이 '스'로 끝나는 외국인 선수", (n) => n.split(" ").pop().endsWith("스"), forg);

// 나무위키 문제 (부모 없이 유명도 순)
if (namu) for (const { q, g, ids } of namu.sets) {
  const set = new Set(ids.filter((i) => !junk.has(i)));
  if (set.size >= MIN) extra.push({ q, m: distances(obviousOrder(q, set)), g, x: 2 });
}

// ---------- 묶음(g) ----------
function group(q) {
  if (/원클럽맨/.test(q)) return "원클럽맨";
  if (/모두에서 뛴/.test(q)) return "팀";
  if (/에서 뛴 (투수|포수|내야수|외야수)$/.test(q)) return "팀×포지션";
  if (/^KBO에서 .+로 뛴 선수$/.test(q)) return "포지션";
  if (/(에서 뛴 선수|시절 선수)$/.test(q) && !/^KBO에서/.test(q)) return "팀";
  if (/국가대표|올림픽|WBC/.test(q)) return "국가대표";
  if (/MVP|신인왕|골든글러브|왕|1위|타이틀|대기록|영구결번|개막전/.test(q)) return "수상·기록";
  if (/출신|년생/.test(q)) return "출신";
  if (/이름|외자|성씨|씨 성/.test(q)) return "이름";
  if (/외국인/.test(q)) return "외국인";
  return "경력";
}
const prompts = [...base.map((p) => ({ q: p.q, m: distances([...rankOf.get(p.q).entries()].sort((a, b) => a[1] - b[1]).map(([i]) => i)), g: group(p.q) })), ...extra];
// 너무 마이너한 문제 거르기: 알 만한 선수(유명도 0.8 이상)가 KNOWN명 미만이면 게임에 안 냄
const KNOWN = 10, hidden = [];
if (fame) for (const p of prompts) {
  const k = p.m.filter(([i]) => fame[i] >= 0.8).length;
  if (p.m.length >= MIN && k < KNOWN) { p.h = 1; hidden.push(`${p.q} (${k}명)`); }
}
const out = { players: d.players, prompts };
if (fame) out.fame = fame;
fs.writeFileSync(FILE, JSON.stringify(out));
const play = prompts.filter((p) => p.m.length >= MIN && !p.h), cnt = {};
for (const p of play) cnt[p.g] = (cnt[p.g] || 0) + 1;
console.log(`문제 ${prompts.length}개 (새로 ${extra.length}개) · 게임에 나오는 문제 ${play.length}개`, cnt);
if (hidden.length) console.log(`마이너해서 뺀 문제 ${hidden.length}개:\n  ` + hidden.join("\n  "));
