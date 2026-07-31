import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";

export const zohoCallbackRouter = Router();

const handleCallback = asyncHandler(async (req, res) => {
  const { code, location, error } = req.query;

  if (error) {
    return res.status(400).send(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #dc2626;">❌ Zoho Authorization Failed</h1>
          <p>Error: ${error}</p>
        </body>
      </html>
    `);
  }

  if (!code) {
    return res.status(200).send(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f8fafc; color: #0f172a;">
          <div style="max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <h1 style="color: #ea580c; margin-top: 0;">⚠️ Missing Authorization Code</h1>
            <p style="color: #475569; font-size: 15px;">This Zoho OAuth Callback endpoint is live and ready to receive authorization requests.</p>
            <p style="font-size: 13px; color: #94a3b8;">Endpoint: <code>/api/super-admin/zoho/callback</code></p>
          </div>
        </body>
      </html>
    `);
  }

  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const redirectUri = process.env.ZOHO_REDIRECT_URI || "https://saasbackend-production-9177.up.railway.app/api/v1/super-admin/zoho/callback";
  const domain = process.env.ZOHO_DOMAIN || "zoho.in";

  let tokenData = null;
  if (clientId && clientSecret) {
    try {
      const tokenUrl = `https://accounts.${domain}/oauth/v2/token`;
      const params = new URLSearchParams({
        code: String(code),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      });
      const tokenRes = await fetch(tokenUrl, { method: "POST", body: params });
      tokenData = await tokenRes.json();
    } catch (e) {
      console.error("[Zoho Callback] Token exchange failed:", e.message);
    }
  }

  res.send(`
    <html>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f8fafc; color: #0f172a;">
        <div style="max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <h1 style="color: #16a34a; margin-top: 0;">✅ Zoho Integration Authorized!</h1>
          <p style="color: #475569; font-size: 15px;">Your Zoho Meeting & Calendar integration has been successfully authorized with Salon Nest.</p>
          ${tokenData?.refresh_token ? `
            <div style="background: #f1f5f9; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 12px; word-break: break-all; margin: 15px 0;">
              <strong>Refresh Token:</strong> ${tokenData.refresh_token}
            </div>
          ` : ''}
          <p style="font-size: 13px; color: #94a3b8;">You can close this tab and return to your Salon Nest Dashboard.</p>
        </div>
      </body>
    </html>
  `);
});

zohoCallbackRouter.get("/", handleCallback);
zohoCallbackRouter.get("/zoho/callback", handleCallback);
zohoCallbackRouter.get("/super-admin/zoho/callback", handleCallback);
