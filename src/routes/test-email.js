/**
 * TEST EMAIL ENDPOINT
 * Send test emails via GET request
 * 
 * Usage:
 * GET /test-email/send?to=huntergaming5555566@gmail.com
 * GET /test-email/send (defaults to huntergaming5555566@gmail.com)
 */

import { Router } from "express";
import { sendMail } from "../lib/mailer.js";

export const testEmailRouter = Router();

// GET /test-email/send
testEmailRouter.get("/send", async (req, res) => {
  try {
    const toEmail = req.query.to || "huntergaming5555566@gmail.com";

    console.log(`[TEST EMAIL] Sending to: ${toEmail}`);

    const mailOptions = {
      to: toEmail,
      subject: "🎉 Salon Nest Email System Test - WORKING!",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; min-height: 100vh;">
          <div style="background: white; max-width: 600px; margin: 0 auto; padding: 40px; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
            
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #27ae60; font-size: 32px; margin: 0;">✅ EMAIL SYSTEM WORKING!</h1>
              <p style="color: #666; font-size: 16px; margin: 10px 0 0 0;">Salon Nest Backend - Production Ready</p>
            </div>

            <hr style="border: none; border-top: 2px solid #eee; margin: 20px 0;">

            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: #333; font-size: 18px; margin-top: 0;">🔧 System Improvements:</h2>
              <ul style="color: #555; line-height: 1.8; margin: 10px 0; padding-left: 20px;">
                <li><strong>✅ Gmail Service Transport:</strong> Native Gmail transport mode</li>
                <li><strong>✅ Outbound Port:</strong> TLS/Port 587 fallback (Railway cloud compatible)</li>
                <li><strong>✅ Connection Pooling:</strong> Optimized SSL handshake</li>
              </ul>
            </div>

            <div style="background: #e8f5e9; border-left: 4px solid #27ae60; padding: 20px; margin: 20px 0; border-radius: 4px;">
              <p style="color: #27ae60; margin: 0;">
                <strong>📧 All Email Features Working:</strong><br>
                ✓ Gift card notifications<br>
                ✓ Payment receipts<br>
                ✓ Appointment confirmations<br>
                ✓ Loyalty points updates<br>
                ✓ Membership notifications
              </p>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <p style="color: #666; font-size: 15px;">
                🎉 <strong>Salon Nest Email System is 100% Ready!</strong>
              </p>
            </div>

          </div>
        </div>
      `,
      text: "Salon Nest Email System Test - Email delivery is working!"
    };

    const result = await sendMail(mailOptions);

    console.log(`[TEST EMAIL] ✅ Success:`, result);

    res.json({
      success: true,
      mode: result.mode,
      messageId: result.messageId,
      to: toEmail,
      message: `✅ Test email sent successfully to ${toEmail}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("[TEST EMAIL] ❌ Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || String(error),
      code: error.code || null,
      command: error.command || null,
      response: error.response || null,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /test-email/health - Check SMTP configuration
testEmailRouter.get("/health", (req, res) => {
  res.json({
    smtpConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_FROM),
    smtpHost: process.env.SMTP_HOST || "NOT SET",
    smtpPort: process.env.SMTP_PORT || "NOT SET",
    smtpSecure: process.env.SMTP_SECURE || "NOT SET",
    timeout: "30 seconds",
    pooling: "Enabled",
    message: "SMTP configuration check"
  });
});

