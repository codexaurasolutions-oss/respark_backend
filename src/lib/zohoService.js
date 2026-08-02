import { prisma } from "./prisma.js";

/**
 * Zoho Meeting & Zoho Calendar API Integration Service
 * Automatic token refresh via OAuth 2.0 & automated meeting creation.
 */

let cachedAccessToken = null;
let tokenExpiresAt = 0;

/**
 * Fetches a valid Access Token using Client ID, Secret & Refresh Token
 */
export async function getZohoAccessToken() {
  const now = Date.now();
  if (cachedAccessToken && now < tokenExpiresAt - 60000) {
    return cachedAccessToken;
  }

  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  const domain = process.env.ZOHO_DOMAIN || "zoho.in";

  if (!clientId || !clientSecret || !refreshToken) {
    console.warn("[Zoho API] Missing ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, or ZOHO_REFRESH_TOKEN in env.");
    return null;
  }

  try {
    const tokenUrl = `https://accounts.${domain}/oauth/v2/token`;
    const params = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token"
    });

    const res = await fetch(tokenUrl, { method: "POST", body: params });
    const data = await res.json();

    if (data.access_token) {
      cachedAccessToken = data.access_token;
      tokenExpiresAt = now + (data.expires_in || 3600) * 1000;
      return cachedAccessToken;
    } else {
      console.error("[Zoho API] Refresh token error:", data);
      return null;
    }
  } catch (err) {
    console.error("[Zoho API] Failed to fetch access token:", err.message);
    return null;
  }
}

/**
 * Automatically creates a real meeting on Zoho Meeting API
 */
export async function createZohoMeeting({ topic, startTime, durationMinutes = 30, leadEmail }) {
  const token = await getZohoAccessToken();
  const domain = process.env.ZOHO_DOMAIN || "zoho.in";

  if (!token) {
    // Fallback: Generate valid join URL structure if credentials not configured yet
    const key = `rsp-${Math.random().toString(36).substring(2, 8)}`;
    return {
      meetingUrl: `https://meeting.${domain}/meeting/join?key=${key}`,
      meetingId: key,
      isRealApi: false
    };
  }

  try {
    const meetingUrl = `https://meeting.${domain}/api/v1/user/meeting.json`;
    const body = {
      session: {
        topic: topic || "Salon Nest Product Demo",
        startTime: new Date(startTime).toLocaleString("en-US", { hour12: false }),
        duration: durationMinutes * 60 * 1000,
        participants: leadEmail ? [{ email: leadEmail }] : []
      }
    };

    const res = await fetch(meetingUrl, {
      method: "POST",
      headers: {
        "Authorization": `Zoho-oauthtoken ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (data.session && data.session.joinLink) {
      return {
        meetingUrl: data.session.joinLink,
        meetingId: data.session.meetingKey,
        isRealApi: true
      };
    } else {
      console.warn("[Zoho API] Meeting creation fallback:", data);
      const key = `rsp-${Math.random().toString(36).substring(2, 8)}`;
      return {
        meetingUrl: `https://meeting.${domain}/meeting/join?key=${key}`,
        meetingId: key,
        isRealApi: false
      };
    }
  } catch (err) {
    console.error("[Zoho API] Failed to create meeting:", err.message);
    const key = `rsp-${Math.random().toString(36).substring(2, 8)}`;
    return {
      meetingUrl: `https://meeting.${domain}/meeting/join?key=${key}`,
      meetingId: key,
      isRealApi: false
    };
  }
}
