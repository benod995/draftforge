// AI deep draft analysis — Cloudflare Pages Function at /explain
// Requires ANTHROPIC_API_KEY secret. Responses cached at the edge for 6h per
// unique draft+candidate, so repeated views cost nothing.

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });

const ROLE_NAMES = {0:"any role",1:"position 1 (carry)",2:"position 2 (mid)",3:"position 3 (offlane)",4:"position 4 (soft support)",5:"position 5 (hard support)"};

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.ANTHROPIC_API_KEY) return json({ error: "not configured" }, 503);

  const url = new URL(request.url);
  const p = url.searchParams;
  const name = (p.get("n") || "").slice(0, 40);
  if (!name) return json({ error: "candidate required" }, 400);
  const role = ROLE_NAMES[+p.get("role")] || "any role";
  const allies = (p.get("a") || "").split("|").filter(Boolean).slice(0, 4);
  const enemies = (p.get("e") || "").split("|").filter(Boolean).slice(0, 5);
  const games = +p.get("g") || 0, wins = +p.get("w") || 0;
  const metaWR = p.get("mw") || "?";

  // Edge cache: normalize the key so ally/enemy order doesn't matter
  const cacheKeyStr = [name, role, [...allies].sort().join(","), [...enemies].sort().join(",")].join("::");
  const cache = caches.default;
  const cacheKey = new Request(url.origin + "/explain?k=" + encodeURIComponent(cacheKeyStr));
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const prompt = `You are a concise, expert Dota 2 draft coach on the current patch.

A player is considering picking ${name} for ${role}.
Their record on ${name}: ${games} games, ${games ? Math.round(100*wins/games) : 0}% winrate. Current patch pub winrate: ${metaWR}%.
Their team so far: ${allies.length ? allies.join(", ") : "no picks yet"}.
Enemy team so far: ${enemies.length ? enemies.join(", ") : "no picks yet"}.

In 4-6 sentences of plain prose (no headers, no bullets), explain:
1) the specific ability interactions that make this pick good or risky against the revealed enemies,
2) how it combos with the revealed allies,
3) the likely lane matchup and what timing/window the player should play for,
4) one or two item adjustments specific to this draft.
Be concrete about ability names. If a matchup is genuinely bad, say so honestly.`;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!r.ok) return json({ error: "AI request failed (" + r.status + ")" }, 502);

  const d = await r.json();
  const text = (d.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
  if (!text) return json({ error: "empty response" }, 502);

  const res = json({ text }, 200, { "Cache-Control": "public, max-age=21600" });
  context.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
