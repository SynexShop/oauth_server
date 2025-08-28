import axios from "axios";

const CALLBACK_PATH = "/api/discord/callback";
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_ROLE_ID = process.env.DISCORD_ROLE_ID;

const mask = (v, n = 8) => (typeof v === "string" ? v.slice(0, n) + "…" : v);

export default async function handler(req, res) {
  try {
    // --- 0) Sanity check env + query
    console.log("[INIT] env", {
      DISCORD_CLIENT_ID: mask(DISCORD_CLIENT_ID),
      DISCORD_CLIENT_SECRET: DISCORD_CLIENT_SECRET ? "***" : "(missing)",
      PUBLIC_BASE_URL,
      CALLBACK_PATH,
      DISCORD_GUILD_ID,
      DISCORD_BOT_TOKEN: DISCORD_BOT_TOKEN ? "***" : "(missing)",
      DISCORD_ROLE_ID,
    });

    const code = String(req.query.code || "");
    const redirectUri = `${PUBLIC_BASE_URL}${CALLBACK_PATH}`;

    console.log("[STEP 0] incoming query", {
      codePresent: Boolean(code),
      codePreview: mask(code),
      redirectUri,
    });

    if (!code) {
      console.error("[ERROR] missing ?code in query");
      return res.status(400).send("Missing code");
    }

    // --- 1) Échange code → access_token user
    let tokenResp;
    try {
      console.log("[STEP 1] exchange code for token (POST /oauth2/token) body", {
        client_id: DISCORD_CLIENT_ID,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      });

      tokenResp = await axios.post(
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

      console.log("[STEP 1] token response", {
        status: tokenResp.status,
        data: {
          token_type: tokenResp.data?.token_type,
          scope: tokenResp.data?.scope,
          expires_in: tokenResp.data?.expires_in,
          access_token_preview: mask(tokenResp.data?.access_token),
          refresh_token_present: Boolean(tokenResp.data?.refresh_token),
        },
      });
    } catch (err) {
      console.error("[ERROR] token exchange failed", {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
      return res.status(500).send("Discord token exchange failed");
    }

    const userAccessToken = tokenResp.data.access_token;

    // --- 2) Récupère infos user
    let meResp;
    try {
      console.log("[STEP 2] GET /users/@me with user access token", {
        access_token_preview: mask(userAccessToken),
      });

      meResp = await axios.get("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${userAccessToken}` },
        validateStatus: () => true,
      });

      console.log("[STEP 2] /users/@me response", {
        status: meResp.status,
        dataPreview: {
          id: meResp.data?.id,
          username: meResp.data?.username,
          global_name: meResp.data?.global_name,
        },
      });

      if (meResp.status < 200 || meResp.status >= 300) {
        console.error("[ERROR] /users/@me non-2xx", meResp.data);
        return res.status(500).send("Failed to fetch user profile");
      }
    } catch (err) {
      console.error("[ERROR] /users/@me failed", {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
      return res.status(500).send("Discord /users/@me failed");
    }

    const userId = meResp.data.id;

    // --- 3) Join le serveur
    try {
      console.log("[STEP 3] PUT add guild member", {
        guild: DISCORD_GUILD_ID,
        userId,
        body: { access_token: mask(userAccessToken) },
        authHeader: "Bot ***",
      });

      const joinResp = await axios.put(
        `https://discord.com/api/guilds/${DISCORD_GUILD_ID}/members/${userId}`,
        { access_token: userAccessToken },
        {
          headers: {
            Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
            "Content-Type": "application/json",
          },
          validateStatus: () => true,
        }
      );

      console.log("[STEP 3] add member response", {
        status: joinResp.status, // 201 created, 200/204 possible
        data: joinResp.data,
      });

      if (![200, 201, 204].includes(joinResp.status)) {
        console.error("[ERROR] add member non-2xx", joinResp.data);
        // On continue vers la redirection mais on retourne une 500 pour investiguer
        return res.status(500).send("Failed to add member to guild");
      }
    } catch (err) {
      console.error("[ERROR] add member failed", {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
      return res.status(500).send("Discord add member failed");
    }

    // --- 4) Ajoute le rôle
    if (DISCORD_ROLE_ID) {
      try {
        console.log("[STEP 4] PUT add role to member", {
          guild: DISCORD_GUILD_ID,
          userId,
          role: DISCORD_ROLE_ID,
          authHeader: "Bot ***",
        });

        const roleResp = await axios.put(
          `https://discord.com/api/guilds/${DISCORD_GUILD_ID}/members/${userId}/roles/${DISCORD_ROLE_ID}`,
          null,
          {
            headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
            validateStatus: () => true,
          }
        );

        console.log("[STEP 4] add role response", {
          status: roleResp.status, // 204 expected
          data: roleResp.data,
        });

        if (roleResp.status !== 204) {
          console.error("[WARN] add role non-204", roleResp.data);
          // On ne bloque pas la redirection, mais on log l'erreur
        }
      } catch (err) {
        console.error("[ERROR] add role failed", {
          status: err?.response?.status,
          data: err?.response?.data,
          message: err?.message,
        });
        // idem: on n’empêche pas la redirection finale
      }
    } else {
      console.log("[STEP 4] no role to add (DISCORD_ROLE_ID not set)");
    }

    // --- 5) Redirection finale
    console.log("[DONE] redirecting user to https://www.google.com");
    return res.redirect(302, "https://www.google.com");
  } catch (e) {
    console.error("[FATAL] OAuth error:", e?.response?.data || e.message);
    return res.status(500).send("Erreur OAuth Discord");
  }
}
