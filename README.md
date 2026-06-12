# Draftforge

Personal Dota 2 draft recommender. Friends sign in through Steam — no IDs, no tokens.

## Stack
- `index.html` — the whole app (vanilla JS, talks to OpenDota client-side)
- `functions/auth.js` — Steam OpenID sign-in (`/auth`)
- `functions/synergy.js` — STRATZ synergy proxy (`/synergy?hero=N`), token stays server-side, 24h edge cache

## Deploy (Cloudflare Pages, free)

1. Push this folder to a GitHub repo:
   ```
   git init && git add . && git commit -m "Draftforge v2 — Steam login"
   git branch -M main
   git remote add origin https://github.com/benod995/draftforge.git
   git push -u origin main
   ```
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick the repo.
   - Framework preset: **None**. Build command: empty. Output directory: `/`
3. After first deploy: project → **Settings → Environment variables** → add **secret**:
   - `STRATZ_TOKEN` = your token from stratz.com/api
   - Redeploy (Deployments → ⋯ → Retry) so the secret takes effect.
4. Done. Live at `https://draftforge.pages.dev` (or your custom domain).

## Notes
- Steam login needs no Steam API key — OpenID identification is keyless; names/avatars come from OpenDota.
- Friends must have **Expose Public Match Data** enabled in Dota (Settings → Options → Social), then play one game.
- OpenDota calls are made from each visitor's browser → rate limits are per-visitor, not per-site.
- Without `STRATZ_TOKEN` set, the app still works on comfort + counters and says so.
