import axios from "axios";

const CALLBACK_PATH = "/api/discord/callback";
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "https://oauthserver.vercel.app";

export default async function handler(req, res) {
  try {
    const code = String(req.query.code || "");
    const shop = decodeURIComponent(req.query.state || "");
    const redirectUri = `${PUBLIC_BASE_URL}${CALLBACK_PATH}`;

    const tokenResp = await axios.post(
      "https://discord.com/api/oauth2/token",
      new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const access_token = tokenResp.data.access_token;

    const me = await axios.get("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const did = me.data.id;
    const base = shop || "https://TON-SHOP.myshopify.com";
    return res.redirect(302, `${base}/pages/discord-linked?did=${did}`);
  } catch (e) {
    console.error("OAuth error:", e?.response?.data || e.message);
    return res.status(500).send("Erreur OAuth Discord");
  }
}
