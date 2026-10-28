// 크보릴리온 홈런더비 리더보드 API
// GET  /api/scores           → 최고 비거리·총 비거리 상위 20명
// POST /api/scores {key,name,total,max,hr} → 개인 최고 기록 갱신
import { getStore } from "@netlify/blobs";

// 리더보드 저장 칸. 2026-10-28 새 규칙(최대 185m)으로 바꾸며 "board" → "board2"로 새로 시작(옛 기록은 "board"에 그대로 남아 있음)
const BOARD = "board2";
const MAX_DIST = 185;          // 한 타구 최대 비거리
const MAX_TOTAL = 185 * 300;   // 상식적인 총 비거리 상한
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });

async function loadBoard(store) {
  return (await store.get(BOARD, { type: "json" })) || {};
}
function top(board) {
  const rows = Object.entries(board).map(([key, r]) => ({ key, ...r }));
  const pick = (k) => rows.filter((r) => r[k] > 0).sort((a, b) => b[k] - a[k] || a.at - b.at).slice(0, 20)
    .map(({ key, name, total, max, hr }) => ({ id: key.slice(0, 8), name, total, max, hr }));
  return { max: pick("max"), total: pick("total") };
}

export default async (req) => {
  const store = getStore({ name: "leaderboard", consistency: "strong" });
  if (req.method === "GET") return json(top(await loadBoard(store)));
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let b;
  try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const key = String(b.key || "");
  const name = String(b.name || "").trim().slice(0, 12) || "익명 타자";
  const total = Math.floor(Number(b.total)), max = Math.floor(Number(b.max)), hr = Math.floor(Number(b.hr));
  if (!/^[a-z0-9]{16,40}$/.test(key)) return json({ error: "bad key" }, 400);
  if (!(total > 0 && total <= MAX_TOTAL && max >= 80 && max <= MAX_DIST && max <= total && hr >= 0 && hr <= total / 95))
    return json({ error: "기록이 올바르지 않아요." }, 400);

  const board = await loadBoard(store);
  const prev = board[key] || { total: 0, max: 0, hr: 0 };
  const rec = { name, total: Math.max(total, prev.total), max: Math.max(max, prev.max), hr: Math.max(hr, prev.hr), at: Date.now() };
  const newT = total > prev.total, newM = max > prev.max;
  if (newT || newM || prev.name !== name) { board[key] = rec; await store.setJSON(BOARD, board); }
  return json({ newTotal: newT, newMax: newM, board: top(board) });
};

export const config = { path: "/api/scores" };
