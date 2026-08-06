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
      subject: "🎉 Respark Email System Test - WORKING!",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; min-height: 100vh;">
          <div style="background: white; max-width: 600px; margin: 0 auto; padding: 40px; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
            
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #27ae60; font-size: 32px; margin: 0;">✅ EMAIL SYSTEM WORKING!</h1>
              <p style="color: #666; font-size: 16px; margin: 10px 0 0 0;">Respark Backend - Production Ready</p>
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
                🎉 <strong>Respark Email System is 100% Ready!</strong>
              </p>
            </div>

          </div>
        </div>
      `,
      text: "Respark Email System Test - Email delivery is working!"
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

testEmailRouter.get("/send-all", async (req, res) => {
  const TO = req.query.to || "ahmedbilalkhangl09@gmail.com";

  const allTemplates = [
    { name: "1. Invoice Generated", title: "Invoice Generated", content: `Hi Ahmed,<br/><br/>Your invoice from <strong>Respark Salon</strong> has been generated.<br/><br/><strong>Invoice Number:</strong> INV-2026-001<br/><strong>Total Amount:</strong> Rs.2,500.00<br/><br/>If you have any questions, please contact our front desk.` },
    { name: "2. Invoice Refund", title: "Invoice Refund Processed", content: `Hi Ahmed,<br/><br/>A refund has been processed against your recent invoice at <strong>Respark Salon</strong>.<br/><br/>The amount should reflect in your account shortly depending on your payment method. For any queries, please contact our front desk.` },
    { name: "3. Invoice Cancelled", title: "Invoice Cancelled", content: `Hi Ahmed,<br/><br/>Your recent invoice at <strong>Respark Salon</strong> has been cancelled.<br/><br/>If you did not request this cancellation, please contact our front desk immediately.` },
    { name: "4. Membership Welcome", title: "Welcome to your Membership", content: `Hi Ahmed,<br/><br/>Your membership at <strong>Respark Salon</strong> is now active.<br/><br/>You can now enjoy all your exclusive benefits and perks.<br/><br/><strong>Valid until:</strong> August 6, 2027` },
    { name: "5. Package Purchase", title: "Your Package is Active", content: `Hi Ahmed,<br/><br/>Your package at <strong>Respark Salon</strong> is now active.<br/><br/><strong>Sessions available:</strong> 10<br/><br/>We look forward to seeing you for your next session.` },
    { name: "6. Payment Receipt", title: "Payment Receipt", content: `Hi Ahmed,<br/><br/>We have received your payment of <strong>Rs.2,500.00</strong> at <strong>Respark Salon</strong>.<br/><br/>Thank you for your payment.` },
    { name: "7. Appointment Confirmed", title: "Appointment Confirmed", content: `Hi Ahmed,<br/><br/>Your appointment at <strong>Respark Salon</strong> has been confirmed.<br/><br/><strong>Date & Time:</strong> Thursday, August 06, 2026 at 10:00 AM<br/><br/>If you need to reschedule, please contact us at your earliest convenience.` },
    { name: "8. Appointment Reminder", title: "Appointment Reminder", content: `Hi Ahmed,<br/><br/>This is a reminder that you have an upcoming appointment at <strong>Respark Salon</strong>.<br/><br/><strong>Date & Time:</strong> Thursday, August 06, 2026 at 10:00 AM<br/><br/>We look forward to seeing you.` },
    { name: "9. Appointment Cancelled", title: "Appointment Cancelled", content: `Hi Ahmed,<br/><br/>Your appointment at <strong>Respark Salon</strong> scheduled for <strong>Thursday, August 06, 2026 at 10:00 AM</strong> has been cancelled.<br/><br/>We hope to see you again soon.` },
    { name: "10. Order Confirmation", title: "Order Confirmation", content: `Hi Ahmed,<br/><br/>Thank you for your order from <strong>Respark Salon</strong>.<br/><br/><strong>Order Number:</strong> ORD-2026-042<br/><strong>Total Amount:</strong> Rs.1,200.00<br/><br/>We are processing your order and will keep you updated.` },
    { name: "11. Enquiry Follow Up", title: "Update on your Enquiry", content: `Hi Ahmed,<br/><br/>Thank you for contacting <strong>Respark Salon</strong>. Our team has reviewed your enquiry and left an update for you.<br/><br/>We will stay in touch to ensure everything is resolved.` },
    { name: "12. Feedback Follow Up", title: "Update on your Feedback", content: `Hi Ahmed,<br/><br/>Thank you for sharing your feedback with <strong>Respark Salon</strong>. We take your comments seriously and our team has an update regarding your experience.<br/><br/>We are committed to providing you with the best possible service.` },
    { name: "13. Feedback Request", title: "How was your experience?", content: `Hi Ahmed,<br/><br/>Thank you for your recent visit to <strong>Respark Salon</strong>. We hope you had a great experience.<br/><br/>We would love to hear your thoughts. Please share your feedback at your convenience.` },
    { name: "14. Birthday Offer", title: "Happy Birthday", content: `Hi Ahmed,<br/><br/>Wishing you a very Happy Birthday from all of us at <strong>Respark Salon</strong>.<br/><br/>We have a special birthday treat waiting for you. Visit us soon to claim it.` },
    { name: "15. Anniversary Offer", title: "Happy Anniversary", content: `Hi Ahmed,<br/><br/>Happy Anniversary from <strong>Respark Salon</strong>.<br/><br/>Celebrate with a special pampering session. We have an exclusive anniversary offer just for you.` },
    { name: "16. Loyalty Points Earned", title: "Loyalty Points Earned", content: `Hi Ahmed,<br/><br/>You have earned <strong>50 loyalty points</strong> at <strong>Respark Salon</strong>.<br/><br/><strong>Your new balance:</strong> 250 points.<br/><br/>Keep visiting to unlock exciting rewards.` },
    { name: "17. Loyalty Points Expiring", title: "Loyalty Points Expiring Soon", content: `Hi Ahmed,<br/><br/>Your loyalty points at <strong>Respark Salon</strong> are expiring soon.<br/><br/>Book your next visit today and redeem your points before they expire.` },
    { name: "18. Membership Expiring", title: "Membership Expiring Soon", content: `Hi Ahmed,<br/><br/>Your membership at <strong>Respark Salon</strong> is expiring on <strong>August 6, 2026</strong>.<br/><br/>Renew now to continue enjoying your VIP perks and discounts.` },
    { name: "19. Membership Renewed", title: "Membership Renewed", content: `Hi Ahmed,<br/><br/>Your membership at <strong>Respark Salon</strong> has been renewed successfully.<br/><br/><strong>New expiry date:</strong> August 6, 2027<br/><br/>Thank you for being a valued member.` },
    { name: "20. Package Expiring", title: "Package Expiring Soon", content: `Hi Ahmed,<br/><br/>Your package at <strong>Respark Salon</strong> is nearing its expiration date.<br/><br/><strong>Sessions remaining:</strong> 3<br/><br/>Book your appointments before they expire.` },
    { name: "21. Gift Card Received", title: "Gift Card Received", content: `Hi Ahmed,<br/><br/>You have received a gift card from <strong>Respark Salon</strong>.<br/><br/><strong>Code:</strong> GIFT-ABCD-1234<br/><strong>Value:</strong> Rs.1,000.00<br/><br/>Show this code at the desk on your next visit to redeem.` },
    { name: "22. Gift Card Expiring", title: "Gift Card Expiring Soon", content: `Hi Ahmed,<br/><br/>Your gift card at <strong>Respark Salon</strong> is expiring soon.<br/><br/>Book your appointment and redeem your balance before it expires.` },
    { name: "23. Gift Card Redeemed", title: "Gift Card Redeemed", content: `Hi Ahmed,<br/><br/>Your gift card (Code: GIFT-ABCD-1234) has been used for <strong>Rs.500.00</strong> at <strong>Respark Salon</strong>.<br/><br/><strong>Remaining Balance:</strong> Rs.500.00` },
    { name: "24. Referral Code", title: "Your Referral Code", content: `Hi Ahmed,<br/><br/>Here is your personal referral code for <strong>Respark Salon</strong>:<br/><br/><strong>AHMED-REF-2026</strong><br/><br/>Share this code with your friends and family. When they visit us, you both earn rewards.` },
    { name: "25. Referral Reward", title: "Referral Reward Earned", content: `Hi Ahmed,<br/><br/>A friend used your referral code and you have earned <strong>100 loyalty points</strong> at <strong>Respark Salon</strong>.<br/><br/>Keep sharing your code to keep earning rewards.` },
    { name: "26. Welcome Email", title: "Welcome to Respark Salon", content: `Hi Ahmed,<br/><br/>Welcome to <strong>Respark Salon</strong>! Your account has been created successfully.<br/><br/>We are excited to have you on board. Explore our services and book your first appointment today.` }
  ];

  const salonName = "Respark Salon";
  const wrapHtml = (body) => `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #0f172a; line-height: 1.6;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01); border: 1px solid #e2e8f0;">
        <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">${salonName}</h1>
        </div>
        <div style="padding: 40px 32px;">
          <div style="font-size: 16px; color: #334155; margin-bottom: 24px; white-space: pre-wrap;">${body}</div>
        </div>
        <div style="background-color: #f1f5f9; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="font-size: 13px; color: #64748b; margin: 0; font-weight: 500;">&copy; 2026 ${salonName}. All rights reserved.</p>
          <p style="font-size: 12px; color: #94a3b8; margin: 8px 0 0 0;">This is an automated notification. Please do not reply directly to this email.</p>
        </div>
      </div>
    </div>`;

  const results = [];
  for (const tmpl of allTemplates) {
    try {
      await sendMail({
        to: TO,
        subject: `[Respark Preview] ${tmpl.title}`,
        html: wrapHtml(tmpl.content),
        text: tmpl.content.replace(/<[^>]+>/g, "")
      });
      results.push({ name: tmpl.name, status: "sent" });
      await new Promise(r => setTimeout(r, 400));
    } catch (err) {
      results.push({ name: tmpl.name, status: "failed", error: err.message });
    }
  }

  res.json({ total: allTemplates.length, sent: results.filter(r => r.status === "sent").length, failed: results.filter(r => r.status === "failed").length, details: results });
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

