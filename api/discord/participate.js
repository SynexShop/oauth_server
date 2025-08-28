const CALLBACK_PATH = "/api/discord/callback";
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "https://oauthserver.vercel.app";

export default function handler(req, res) {
  const state = encodeURIComponent(req.query.shop || "");
  const redirectUri = `${PUBLIC_BASE_URL}${CALLBACK_PATH}`;

  const url =
    `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code&scope=identify%20guilds.join&state=${state}`;

  res.redirect(302, url);
}
