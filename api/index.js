import express from "express";
import axios from "axios";

const app = express();
const DISCORD_CLIENT_ID = "1410558291461013575";
const DISCORD_CLIENT_SECRET = "Sgb0cn7uaiM6eje3qne4fRLWNx9vpnGd";

const CALLBACK_PATH = "/discord/callback";

app.get("/ping", (req, res) => {
  res.send("pong");
});

app.get("/discord/login", (req, res) => {
  const redirectUri = `${req.protocol}://${req.get("host")}${CALLBACK_PATH}`;
  const state = encodeURIComponent(req.query.shop || "");
  const url =
    `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code&scope=identify&state=${state}`;
  res.redirect(url);
});

app.get(CALLBACK_PATH, async (req, res) => {
  const code = req.query.code;
  const shop = decodeURIComponent(req.query.state || "");
  const redirectUri = `${req.protocol}://${req.get("host")}${CALLBACK_PATH}`;

  try {
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
    const userResp = await axios.get("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const did = userResp.data.id;
    const base = shop || "https://TON-SHOP.myshopify.com";

    // redirection vers Shopify
    res.redirect(`${base}/pages/discord-linked?did=${did}`);
  } catch (e) {
    console.error(e?.response?.data || e.message);
    res.status(500).send("Erreur OAuth Discord");
  }
});

app.listen(3000, () =>
  console.log("✅ Serveur OAuth Discord prêt")
);
