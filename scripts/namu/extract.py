# 나무위키 덤프에서 KBOrillion에 필요한 것만 뽑는 1단계 스크립트
#
# 덤프: https://huggingface.co/datasets/iamtalker/yourwiki-namumark-20260829 (CC BY-NC-SA 2.0 KR, 2026-08-29 기준)
#   7z 안에 JSON 배열 하나(약 31GB). 풀지 않고 7z로 흘려 읽는다(8분쯤, 메모리 2GB 안쪽)
# 실행: python3 scripts/namu/extract.py 덤프.7z 작업폴더
# 작업폴더에 생기는 것
#   links.pkl    모든 문서의 링크 대상별 '링크 건 문서 수', 넘겨주기 목록, 하위 문서 길이 합(문서명/… 의 글자 수)
#   players.jsonl 야구 선수 문서(분류에 '야구 선수'·'외국인 선수(야구)' 또는 구단/현역·은퇴 분류) 원문
#   lists.jsonl  구단·KBO 리그 하위 문서, 최강야구·불꽃야구, 골든글러브, 올스타전, 신인 드래프트 문서 원문
import json, os, pickle, re, subprocess, sys, time, collections

dump, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
LINK = re.compile(r"\[\[([^\]\|#\n]+)")
RED = re.compile(r"#(?:redirect|넘겨주기)\s+([^\n#]+)", re.I)
CAT = re.compile(r"\[\[분류:([^\]|]+)")
TEAM = r"(라이온즈|자이언츠|트윈스|베어스|타이거즈|이글스|와이번스|랜더스|다이노스|위즈|wiz|히어로즈|유니콘스|돌핀스|레이더스|청룡|슈퍼스타즈|핀토스)"
BALL = re.compile(r"야구 선수|외국인 선수\(야구\)|" + TEAM + r"/(은퇴|현역)")
LISTS = re.compile(r"^(삼성 라이온즈|롯데 자이언츠|LG 트윈스|MBC 청룡|두산 베어스|OB 베어스|KIA 타이거즈|해태 타이거즈|한화 이글스|빙그레 이글스|"
                   r"SK 와이번스|SSG 랜더스|NC 다이노스|kt wiz|KT 위즈|키움 히어로즈|넥센 히어로즈|히어로즈|현대 유니콘스|태평양 돌핀스|"
                   r"삼미 슈퍼스타즈|쌍방울 레이더스|KBO 리그)/|^(최강야구|최강 몬스터즈|불꽃야구|불꽃 파이터즈|KBO 올스타|KBO 골든글러브)|신인 드래프트")


def docs(f):
    # 문서 경계 '},{"namespace"'로 잘라 하나씩 읽음(문자열 안 따옴표는 \" 라 경계와 헷갈리지 않음)
    sep, buf, first = b'},{"namespace"', b"", True
    while True:
        chunk = f.read(1 << 24)
        if not chunk:
            break
        buf += chunk
        parts = buf.split(sep)
        buf = parts.pop()
        for x in parts:
            yield json.loads(x.lstrip()[1:] + b"}" if first else b'{"namespace"' + x + b"}")
            first = False
    yield json.loads(b'{"namespace"' + buf.rstrip().rstrip(b"]"))


cnt, redir, sublen = collections.Counter(), {}, collections.Counter()
fp = open(os.path.join(out, "players.jsonl"), "w")
fl = open(os.path.join(out, "lists.jsonl"), "w")
p = subprocess.Popen(["7z", "x", "-so", dump], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
t0, n = time.time(), 0
for doc in docs(p.stdout):
    n += 1
    if n % 200000 == 0:
        print(n, round(time.time() - t0), flush=True)
    if doc.get("namespace", 0) != 0:
        continue
    title, text = doc["title"], doc.get("text") or ""
    if text[:40].lstrip().startswith("#"):
        m = RED.match(text.lstrip())
        if m:
            redir[title] = m.group(1).strip()
            continue
    tg = {x.strip() for x in LINK.findall(text)}
    tg.discard(title)
    cnt.update(x for x in tg if not x.startswith(("파일:", "분류:", "http", "틀:")))
    line = json.dumps({"title": title, "text": text}, ensure_ascii=False) + "\n"
    if LISTS.search(title):
        fl.write(line)
    elif "/" in title:
        sublen[title.split("/")[0]] += len(text)
    elif any(BALL.search(c) for c in CAT.findall(text)):
        fp.write(line)
fp.close(); fl.close()
pickle.dump({"cnt": cnt, "redir": redir, "sublen": sublen}, open(os.path.join(out, "links.pkl"), "wb"))
print("done", n, round(time.time() - t0), flush=True)
