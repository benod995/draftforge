// STRATZ synergy proxy — Cloudflare Pages Function, served at /synergy?hero={id}
// Keeps the STRATZ token server-side (env secret STRATZ_TOKEN) and caches each
// hero's synergy table at the edge for 24h, so a whole friend group costs a
// handful of STRATZ calls per day.

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const hero = parseInt(url.searchParams.get("hero"), 10);

  if (!hero || hero < 1 || hero > 500) return json({ error: "hero param required" }, 400);
  if (!env.STRATZ_TOKEN) return json({ error: "synergy not configured" }, 503);

  // Edge cache: one entry per hero per day
  const cache = caches.default;
  const cacheKey = new Request(url.origin + "/synergy?hero=" + hero);
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const query = `{ heroStats { matchUp(heroId: ${hero}, take: 160) { with { heroId2 synergy } } } }`;
  const r = await fetch("https://api.stratz.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + env.STRATZ_TOKEN,
      "User-Agent": "STRATZ_API",
    },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) return json({ error: "STRATZ responded " + r.status }, 502);

  const d = await r.json();
  const rows = (d?.data?.heroStats?.matchUp?.[0]?.with || []).map(w => ({
    heroId2: w.heroId2,
    synergy: w.synergy,
  }));

  const res = json(rows, 200, { "Cache-Control": "public, max-age=86400" });
  context.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
