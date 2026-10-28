// 크보릴리온 방문·플레이 통계
// POST /api/stats {key, type:"visit"|"play"}  → 오늘(한국 시간) 집계에 더함
// GET  /api/stats                              → 최근 30일 일별 집계와 누적
import { getStore } from "@netlify/blobs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const kstDate = (t = Date.now()) => new Date(t + 9 * 3600e3).toISOString().slice(0, 10);

export default async (req) => {
  const store = getStore({ name: "stats", consistency: "strong" });

  if (req.method === "GET") {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const date = kstDate(Date.now() - i * 86400e3);
      const d = (await store.get("day-" + date, { type: "json" })) || {};
      days.push({ date, views: d.views || 0, visitors: Object.keys(d.keys || {}).length, plays: d.plays || 0 });
    }
    const total = (await store.get("total", { type: "json" })) || { views: 0, plays: 0 };
    return json({ days, total });
  }
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let b;
  try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const type = b.type === "play" ? "play" : b.type === "visit" ? "visit" : null;
  const key = String(b.key || "");
  if (!type || !/^[a-z0-9]{8,40}$/.test(key)) return json({ error: "bad input" }, 400);

  const id = "day-" + kstDate();
  const d = (await store.get(id, { type: "json" })) || { views: 0, plays: 0, keys: {} };
  const total = (await store.get("total", { type: "json" })) || { views: 0, plays: 0 };
  if (type === "visit") { d.views++; total.views++; d.keys[key.slice(0, 12)] = 1; }
  else { d.plays++; total.plays++; }
  await store.setJSON(id, d);
  await store.setJSON("total", total);
  return json({ ok: true });
};

export const config = { path: "/api/stats" };
