// 링크 미리보기 이미지 public/og.png(1200x630)를 다시 만드는 스크립트
// 실행: (cd public && python3 -m http.server 8765) 를 켜 둔 채로  node scripts/make_og.js public/og.png
// 게임 화면의 야구장 그림(drawField)을 가져와 제목·부제와 함께 찍음. Playwright 필요
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:630}});
await p.goto('http://localhost:8765/');await p.waitForTimeout(1500);
const svg=await p.evaluate(()=>{drawField();/* 공 몇 개 */for(const [m,d] of [[178,-18],[152,22],[121,-34],[184,6]]){const [x,y]=pt(m,d);el("circle",{cx:x,cy:y,r:5,fill:m>=180?"#ffc24a":"#fff"},svg.layer);el("line",{x1:HX,y1:HY,x2:x,y2:y,stroke:"#fff","stroke-width":1.5,"stroke-dasharray":"3 4",opacity:.35},svg.layer);}return document.getElementById("svg").outerHTML;});
await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Do+Hyeon&family=IBM+Plex+Sans+KR:wght@600&display=swap">
<style>:root{--grass:#2f7d46;--grass-2:#2a7240;--dirt:#b98153;--chalk:#f4f1e6;--led:#ffc24a;--ball:#fff;--track:#8a5a3a;--wall:#14432a;--dim:#9db3a5;--out:#ff5a4a}body{margin:0;width:1200px;height:630px;overflow:hidden;background:radial-gradient(120% 90% at 70% 0%,#22392b 0%,#0a110d 60%);color:#f4f1e6;font-family:"IBM Plex Sans KR";display:flex;align-items:center}
.l{width:460px;padding-left:60px;flex:none;box-sizing:content-box}.r{flex:1;padding-right:40px}.r svg{width:100%;height:auto;display:block;border-radius:16px}
h1{font-family:"Black Han Sans";font-weight:400;font-size:78px;line-height:1;margin:0 0 18px}h1 span{color:#ffc24a}
.t{font-family:"Do Hyeon";font-size:44px;color:#ffc24a;margin:0 0 14px;text-shadow:0 0 14px rgba(255,194,74,.45)}
.s{font-size:24px;color:#c9d6cc;margin:0;line-height:1.5}</style></head><body>
<div class="l"><h1>KBO<span>rillion</span></h1><p class="t">KBO 퀴즈 홈런더비</p><p class="s">문제에 맞는 선수 이름을 대면 홈런!<br>뻔하지 않은 정답일수록 멀리 날아가요</p></div>
<div class="r">${svg}</div></body></html>`);
await p.waitForTimeout(2500);await p.screenshot({path:process.argv[2]});await b.close();})();
