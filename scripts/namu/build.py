# 나무위키 2단계: extract.py 결과로 선수별 유명도와 나무위키 문제를 만들어 data/namu.json에 저장
# 실행: python3 scripts/namu/build.py 작업폴더
# 그다음 node scripts/remix_data.mjs 를 돌리면 게임 데이터(public/kbo_derby.json)에 반영됨
#
# 유명도 = (나무위키 역링크 수 순위 + 문서 길이(하위 문서 포함) 순위) / 2, 0~1
#   역링크 = 그 선수 문서로 링크를 건 다른 문서 수(넘겨주기로 들어오는 것 포함)
#   나무위키 문서를 못 찾은 선수는 위키백과 조회수 순위 × 0.25 (대부분 문서가 없을 만큼 무명)
import collections, json, os, pickle, re, sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
work = sys.argv[1]
D = json.load(open(os.path.join(ROOT, "public", "kbo_derby.json"), encoding="utf-8"))
P = D["players"]
L = pickle.load(open(os.path.join(work, "links.pkl"), "rb"))
cnt, redir, sublen = L["cnt"], L["redir"], L["sublen"]
CAT = re.compile(r"\[\[분류:([^\]|]+)")
LINK = re.compile(r"\[\[([^\]\|#\n]+)")


def resolve(t):
    t, seen = t.strip(), set()
    while t in redir and t not in seen:
        seen.add(t)
        t = redir[t].split("#")[0].strip()
    return t


# ---------- 선수 문서 ----------
docs = {}
for line in open(os.path.join(work, "players.jsonl"), encoding="utf-8"):
    d = json.loads(line)
    docs[d["title"]] = (d["text"], [c.strip() for c in CAT.findall(d["text"])])
back = collections.Counter()
for t, c in cnt.items():
    back[resolve(t)] += c
bybase = collections.defaultdict(list)
for t in docs:
    bybase[t.split("(")[0].strip()].append(t)

# 우리 데이터의 선수별 구단(동명이인 가를 때 씀)
FR = {"삼성 라이온즈": "삼성", "롯데 자이언츠": "롯데", "LG 트윈스": "LG", "MBC 청룡": "LG", "두산 베어스": "두산", "OB 베어스": "두산",
      "KIA 타이거즈": "KIA", "해태 타이거즈": "KIA", "한화 이글스": "한화", "빙그레 이글스": "한화", "SK 와이번스": "SK", "SSG 랜더스": "SK",
      "NC 다이노스": "NC", "KT 위즈": "KT", "키움 히어로즈": "히어로즈", "넥센 히어로즈": "히어로즈", "현대 유니콘스": "현대",
      "태평양 돌핀스": "현대", "삼미 슈퍼스타즈": "현대", "쌍방울 레이더스": "쌍방울"}
CATW = {"삼성": ["삼성"], "롯데": ["롯데"], "LG": ["LG", "MBC"], "두산": ["두산", "OB"], "KIA": ["KIA", "해태"], "한화": ["한화", "빙그레"],
        "SK": ["SK", "SSG"], "NC": ["NC"], "KT": ["KT", "kt"], "히어로즈": ["히어로즈"], "현대": ["현대", "태평양", "삼미", "청보"], "쌍방울": ["쌍방울"]}
mine = collections.defaultdict(set)
for p in D["prompts"]:
    for q, k in FR.items():
        if p["q"] == q + "에서 뛴 선수":
            for i, _ in p["m"]:
                mine[i].add(k)
doc_fr = lambda cats: {k for k, ws in CATW.items() for c in cats if "/" in c and any(w in c for w in ws)}

title = [None] * len(P)
used = set()
for i in sorted(range(len(P)), key=lambda i: -P[i][1]):
    n = P[i][0]
    cs = list(bybase.get(n, []))
    r = resolve(n)
    if r != n and r in docs:
        cs.append(r)
    cs = [t for t in dict.fromkeys(cs) if t not in used]
    if not cs:
        continue
    cs.sort(key=lambda t: (-len(doc_fr(docs[t][1]) & mine[i]), -back[t]))
    title[i] = cs[0]
    used.add(cs[0])

ids = [i for i in range(len(P)) if title[i]]
def pct(vals):
    o = sorted(ids, key=lambda i: vals[i])
    return {i: r / max(1, len(o) - 1) for r, i in enumerate(o)}
pb = pct({i: back[title[i]] for i in ids})
pl = pct({i: len(docs[title[i]][0]) + sublen[title[i]] for i in ids})
wv = sorted(range(len(P)), key=lambda i: P[i][1])
pw = {i: r / (len(P) - 1) for r, i in enumerate(wv)}
fame = [round((pb[i] + pl[i]) / 2, 4) if title[i] else round(pw[i] * 0.25, 4) for i in range(len(P))]
t2i = {title[i]: i for i in ids}
link_ids = lambda text: {t2i.get(resolve(x)) for x in LINK.findall(text)} - {None}

# ---------- 문제: 분류 ----------
cats = {i: docs[title[i]][1] for i in ids}
def by_cat(pat):
    return {i for i in ids if any(re.search(pat, c) for c in cats[i])}
S, G = {}, {}
def put(q, s, g):
    S[q], G[q] = s, g
put("좌투좌타 선수", by_cat(r"^좌투좌타$"), "포지션")
put("우투좌타 선수 (오른손으로 던지고 왼쪽 타석에 서는)", by_cat(r"^우투좌타$"), "포지션")
put("사이드암·언더핸드 투수", by_cat(r"^(우사|좌사|우언|좌언)|사이드암 투수|언더핸드 투수"), "포지션")
put("감독을 지낸 선수 (프로·아마추어 포함)", by_cat(r"야구 감독|감독 대행/야구|/역대 감독"), "은퇴 후")
put("코치를 지낸 선수", by_cat(r"야구 코치"), "은퇴 후")
put("야구 해설위원을 지낸 선수", by_cat(r"야구 해설자"), "은퇴 후")
put("상무에서 뛴 선수", by_cat(r"^상무 피닉스 야구단/"), "경력")
put("경찰 야구단에서 뛴 선수", by_cat(r"^경찰 야구단/"), "경력")
put("병역특례를 받은 선수 (아시안게임·올림픽 등)", by_cat(r"병역특례자/야구"), "경력")
put("아시안게임 메달을 딴 선수", by_cat(r"아시안 게임 메달리스트"), "국가대표")
put("프리미어12에 나간 선수 (국적 무관)", by_cat(r"프리미어 12 참가"), "국가대표")
put("MVP를 받은 선수 (정규시즌·한국시리즈·플레이오프·준플레이오프)", by_cat(r"^KBO (한국시리즈 |플레이오프 |준플레이오프 )?MVP$"), "수상·기록")
put("이름을 바꾼(개명한) 선수", by_cat(r"^개명한 인물$"), "이름")

# 왼손 투수, 투타 × 포지션 (포지션은 우리 데이터의 위키백과 포지션 문제를 씀)
lefty = by_cat(r"^좌완 투수$")
put("왼손 투수", lefty, "포지션")
POSQ = {"내야수": [f"KBO에서 {x}로 뛴 선수" for x in ("1루수", "2루수", "3루수", "유격수")], "외야수": ["KBO에서 외야수로 뛴 선수"]}
pos = {k: {i for p in D["prompts"] if p["q"] in qs for i, _ in p["m"]} for k, qs in POSQ.items()}
put("우투좌타 내야수", by_cat(r"^우투좌타$") & pos["내야수"], "포지션")
put("우투좌타 외야수", by_cat(r"^우투좌타$") & pos["외야수"], "포지션")
put("좌투좌타 외야수", by_cat(r"^좌투좌타$") & pos["외야수"], "포지션")

# 시대: 데뷔·은퇴 연대, 연대 × 구단
def years(i, kind):
    return [int(m.group(1)) for c in cats[i] for m in [re.match(r"^(\d{4})년 " + kind + "$", c)] if m]
debut = {a: {i for i in ids if any(a <= y < a + 10 for y in years(i, "데뷔"))} for a in (1980, 1990, 2000, 2010, 2020)}
for a, s in debut.items():
    put(f"{a}년대에 데뷔한 선수", s, "시대")
for a in (1990, 2000, 2010, 2020):
    put(f"{a}년대에 은퇴한 선수", {i for i in ids if any(a <= y < a + 10 for y in years(i, "은퇴"))}, "시대")
# 그해 현역(데뷔 연도 ≤ 그해 ≤ 은퇴 연도, 현역이면 2026). 외국인은 분류의 데뷔 연도가 미국·일본 데뷔라 뺌
foreign = by_cat(r"외국인 선수\(야구\)") | {i for p in D["prompts"] if p["q"] == "KBO 외국인 선수" for i, _ in p["m"]}
def active(i):
    d = years(i, "데뷔")
    e = years(i, "은퇴") or ([2026] if any(re.search(r"/현역", c) for c in cats[i]) else [])
    return (min(d), max(e)) if d and e else None
span = {i: active(i) for i in ids if i not in foreign}
for y in (1982, 1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020, 2025):
    put(f"{y}년에 현역으로 뛴 한국인 선수" + (" (원년)" if y == 1982 else ""), {i for i, s in span.items() if s and s[0] <= y <= s[1]}, "시대")
FRN = {"삼성": "삼성", "롯데": "롯데", "LG": "LG(MBC)", "두산": "두산(OB)", "KIA": "KIA(해태)", "한화": "한화(빙그레)",
       "SK": "SK·SSG", "NC": "NC", "KT": "KT", "히어로즈": "히어로즈", "현대": "현대(삼미~태평양)"}
for a, s in debut.items():
    for k, nm in FRN.items():
        put(f"{a}년대에 데뷔해 {nm}에서 뛴 선수", {i for i in s if k in mine[i]}, "시대")
for k, nm in FRN.items():
    put(f"{nm}에서 뛴 왼손 투수", {i for i in lefty if k in mine[i]}, "팀×포지션")

# 2026 시즌 현역 명단 (덤프 기준일 2026-08-29의 '구단/현역' 분류)
NOW = {"삼성 라이온즈": "삼성 라이온즈", "롯데 자이언츠": "롯데 자이언츠", "LG 트윈스": "LG 트윈스", "두산 베어스": "두산 베어스",
       "KIA 타이거즈": "KIA 타이거즈", "한화 이글스": "한화 이글스", "SSG 랜더스": "SSG 랜더스", "NC 다이노스": "NC 다이노스",
       "kt wiz": "KT 위즈", "키움 히어로즈": "키움 히어로즈"}
for c, nm in NOW.items():
    put(f"2026 시즌 {nm} 선수 (8월 말 기준)", by_cat("^" + re.escape(c) + "/현역"), "현역")

# ---------- 문제: 명단 문서 ----------
lists = {}
for line in open(os.path.join(work, "lists.jsonl"), encoding="utf-8"):
    d = json.loads(line)
    lists[d["title"]] = d["text"]
def section(text, start, end):
    a = text.find(start)
    if a < 0:
        return ""
    b = text.find(end, a + len(start)) if end else -1
    return text[a:b if b > 0 else None]

tv = set()
tv |= link_ids(re.sub(r"=== 중계·해설진 ===.*?(?==== )", "", section(lists.get("최강 몬스터즈", ""), "== 선수단 ==", "== 선수단 배번"), flags=re.S))
tv |= link_ids(section(lists.get("불꽃 파이터즈", ""), "== 선수단 ==", "== 역대 전적"))
tv |= by_cat(r"방송인|유튜버|야구 해설자")  # '인터넷 밈'은 현역도 많아 뺌
put("해설·예능·유튜브로 방송에 나선 선수 (최강야구·불꽃야구 포함)", tv, "은퇴 후")

fa = set()  # 나무위키에 연도별 문서가 있는 2017~2026년만(그 뒤는 예정 명단)
for t, tx in lists.items():
    m = re.match(r"^KBO 리그/역대 FA/(\d{4})$", t)
    if m and 2017 <= int(m.group(1)) <= 2026:
        for row in tx.split("\n"):
            if row.startswith("||") and "신청" in row and "미신청" not in row:
                fa |= link_ids(row)
put("2017~2026년 FA를 신청한 선수", fa, "경력")

trade = set()  # 트레이드마다 붙은 제목 '=== [[A]] ↔ [[B]] ===' 에 나오는 선수만(본문 언급은 뺌)
for t, tx in lists.items():
    if t.startswith("KBO 리그/역대 트레이드/"):
        for h in re.findall(r"^=+ (.+?) =+$", tx, re.M):
            if "↔" in h:
                trade |= link_ids(h)
put("트레이드로 팀을 옮긴 적 있는 선수", trade, "경력")

# 프랜차이즈 스타 문서는 7개 구단에만 있어 빠지는 선수가 많아 문제로 안 씀

hit1000 = link_ids(section(lists.get("KBO 리그/1000안타 달성 선수 목록", ""), "== 개요", "== 달성 가능성이 높은 선수"))
put("KBO 통산 1000안타를 친 선수", hit1000, "수상·기록")

second = by_cat(r"^야구 선수 자녀$")
for row in section(lists.get("KBO 리그/야구인 2세", ""), "=== 3대 ===", "=== 삼촌-조카").split("\n"):  # 삼촌-조카·조손은 뺌
    if row.startswith("||"):
        cells = row.split("||")[2:]  # 첫 칸(부모 세대)은 뺌
        second |= link_ids("||".join(cells))
put("아버지도 야구 선수였던 선수 (야구인 2세)", second, "경력")

os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
out = {"source": "나무위키 2026-08-29 덤프(CC BY-NC-SA 2.0 KR) https://huggingface.co/datasets/iamtalker/yourwiki-namumark-20260829",
       "fame": fame, "title": title,
       "sets": [{"q": q, "g": G[q], "ids": sorted(s)} for q, s in S.items()]}
json.dump(out, open(os.path.join(ROOT, "data", "namu.json"), "w", encoding="utf-8"), ensure_ascii=False)
print(f"나무위키 문서 짝지음 {len(ids)}/{len(P)}명")
for q, s in S.items():
    print(f"{len(s):5d} {q}")
