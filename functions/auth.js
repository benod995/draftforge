// Steam OpenID sign-in — Cloudflare Pages Function, served at /auth
// Flow: GET /auth → redirect to Steam → Steam redirects back to /auth with
// openid.* params → verify with Steam → redirect to /?id={steam32}

const STEAM_OPENID = "https://steamcommunity.com/openid/login";
const STEAM64_OFFSET = 76561197960265728n;

export async function onRequest({ request }) {
  const url = new URL(request.url);
  const origin = url.origin;

  // Phase 1: no openid params yet → kick off the login
  if (!url.searchParams.get("openid.mode")) {
    const p = new URLSearchParams({
      "openid.ns": "http://specs.openid.net/auth/2.0",
      "openid.mode": "checkid_setup",
      "openid.return_to": origin + "/auth",
      "openid.realm": origin,
      "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
      "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
    });
    return Response.redirect(STEAM_OPENID + "?" + p.toString(), 302);
  }

  // Phase 2: callback from Steam → verify the assertion server-side
  const params = new URLSearchParams(url.search);
  params.set("openid.mode", "check_authentication");
  const verify = await fetch(STEAM_OPENID, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const body = await verify.text();
  if (!/is_valid\s*:\s*true/.test(body)) {
    return new Response("Steam login could not be verified. Go back and try again.", { status: 401 });
  }

  const claimed = url.searchParams.get("openid.claimed_id") || "";
  const m = claimed.match(/\/openid\/id\/(\d+)$/);
  if (!m) {
    return new Response("Unexpected response from Steam.", { status: 400 });
  }

  const steam32 = (BigInt(m[1]) - STEAM64_OFFSET).toString();
  return Response.redirect(origin + "/?id=" + steam32, 302);
}
