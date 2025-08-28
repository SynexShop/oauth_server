import axios from "axios";

const CALLBACK_PATH = "/api/discord/callback";
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;     // ton serveur
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;   // token du bot
const DISCORD_ROLE_ID = process.env.DISCORD_ROLE_ID;       // rôle à ajouter

export default async function handler(req, res) {
  try {
    const code = String(req.query.code || "");
    const redirectUri = `${PUBLIC_BASE_URL}${CALLBACK_PATH}`;

    // 1) Échange code → access_token user
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

    const userAccessToken = tokenResp.data.access_token;

    // 2) Récupère infos user
    const me = await axios.get("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${userAccessToken}` },
    });
    const userId = me.data.id;

    // 3) Join le serveur
    await axios.put(
      `https://discord.com/api/guilds/${DISCORD_GUILD_ID}/members/${userId}`,
      { access_token: userAccessToken },
      {
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        validateStatus: (s) => [200, 201, 204].includes(s),
      }
    );

    // 4) Ajoute le rôle
    if (DISCORD_ROLE_ID) {
      await axios.put(
        `https://discord.com/api/guilds/${DISCORD_GUILD_ID}/members/${userId}/roles/${DISCORD_ROLE_ID}`,
        null,
        {
          headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
          validateStatus: (s) => [204].includes(s),
        }
      );
    }

    // 5) Redirection finale simple
    return res.redirect(302, "https://www.google.com");

  } catch (e) {
    console.error("OAuth error:", e?.response?.data || e.message);
    return res.status(500).send("Erreur OAuth Discord");
  }
}
