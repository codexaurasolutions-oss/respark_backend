import { sendMail } from "../src/lib/mailer.js";

const TO = "ahmedbilalkhangl09@gmail.com";

const allTemplates = [
  {
    name: "1. Invoice Generated",
    title: "Invoice Generated",
    content: `Hi Ahmed,

Your invoice from <strong>Skillify Salon</strong> has been generated.

<strong>Invoice Number:</strong> INV-2026-001
<strong>Total Amount:</strong> Rs.2,500.00

If you have any questions, please contact our front desk.`
  },
  {
    name: "2. Invoice Refund Processed",
    title: "Invoice Refund Processed",
    content: `Hi Ahmed,

A refund has been processed against your recent invoice at <strong>Skillify Salon</strong>.

The amount should reflect in your account shortly depending on your payment method. For any queries, please contact our front desk.`
  },
  {
    name: "3. Invoice Cancelled",
    title: "Invoice Cancelled",
    content: `Hi Ahmed,

Your recent invoice at <strong>Skillify Salon</strong> has been cancelled.

If you did not request this cancellation, please contact our front desk immediately.`
  },
  {
    name: "4. Membership Welcome",
    title: "Welcome to your Membership",
    content: `Hi Ahmed,

Your membership at <strong>Skillify Salon</strong> is now active.

You can now enjoy all your exclusive benefits and perks.

<strong>Valid until:</strong> August 6, 2027`
  },
  {
    name: "5. Package Purchase",
    title: "Your Package is Active",
    content: `Hi Ahmed,

Your package at <strong>Skillify Salon</strong> is now active.

<strong>Sessions available:</strong> 10

We look forward to seeing you for your next session.`
  },
  {
    name: "6. Payment Receipt",
    title: "Payment Receipt",
    content: `Hi Ahmed,

We have received your payment of <strong>Rs.2,500.00</strong> at <strong>Skillify Salon</strong>.

Thank you for your payment.`
  },
  {
    name: "7. Appointment Confirmed",
    title: "Appointment Confirmed",
    content: `Hi Ahmed,

Your appointment at <strong>Skillify Salon</strong> has been confirmed.

<strong>Date & Time:</strong> Thursday, August 06, 2026 at 10:00 AM

If you need to reschedule, please contact us at your earliest convenience.`
  },
  {
    name: "8. Appointment Reminder",
    title: "Appointment Reminder",
    content: `Hi Ahmed,

This is a reminder that you have an upcoming appointment at <strong>Skillify Salon</strong>.

<strong>Date & Time:</strong> Thursday, August 06, 2026 at 10:00 AM

We look forward to seeing you.`
  },
  {
    name: "9. Appointment Cancelled",
    title: "Appointment Cancelled",
    content: `Hi Ahmed,

Your appointment at <strong>Skillify Salon</strong> scheduled for <strong>Thursday, August 06, 2026 at 10:00 AM</strong> has been cancelled.

We hope to see you again soon.`
  },
  {
    name: "10. Order Confirmation",
    title: "Order Confirmation",
    content: `Hi Ahmed,

Thank you for your order from <strong>Skillify Salon</strong>.

<strong>Order Number:</strong> ORD-2026-042
<strong>Total Amount:</strong> Rs.1,200.00

We are processing your order and will keep you updated.`
  },
  {
    name: "11. Enquiry Follow Up",
    title: "Update on your Enquiry",
    content: `Hi Ahmed,

Thank you for contacting <strong>Skillify Salon</strong>. Our team has reviewed your enquiry and left an update for you.

We will stay in touch to ensure everything is resolved.`
  },
  {
    name: "12. Feedback Follow Up",
    title: "Update on your Feedback",
    content: `Hi Ahmed,

Thank you for sharing your feedback with <strong>Skillify Salon</strong>. We take your comments seriously and our team has an update regarding your experience.

We are committed to providing you with the best possible service.`
  },
  {
    name: "13. Feedback Request",
    title: "How was your experience?",
    content: `Hi Ahmed,

Thank you for your recent visit to <strong>Skillify Salon</strong>. We hope you had a great experience.

We would love to hear your thoughts. Please share your feedback at your convenience.`
  },
  {
    name: "14. Birthday Offer",
    title: "Happy Birthday",
    content: `Hi Ahmed,

Wishing you a very Happy Birthday from all of us at <strong>Skillify Salon</strong>.

We have a special birthday treat waiting for you. Visit us soon to claim it.`
  },
  {
    name: "15. Anniversary Offer",
    title: "Happy Anniversary",
    content: `Hi Ahmed,

Happy Anniversary from <strong>Skillify Salon</strong>.

Celebrate with a special pampering session. We have an exclusive anniversary offer just for you.`
  },
  {
    name: "16. Loyalty Points Earned",
    title: "Loyalty Points Earned",
    content: `Hi Ahmed,

You have earned <strong>50 loyalty points</strong> at <strong>Skillify Salon</strong>.

<strong>Your new balance:</strong> 250 points.

Keep visiting to unlock exciting rewards.`
  },
  {
    name: "17. Loyalty Points Expiring",
    title: "Loyalty Points Expiring Soon",
    content: `Hi Ahmed,

Your loyalty points at <strong>Skillify Salon</strong> are expiring soon.

Book your next visit today and redeem your points before they expire.`
  },
  {
    name: "18. Membership Expiring",
    title: "Membership Expiring Soon",
    content: `Hi Ahmed,

Your membership at <strong>Skillify Salon</strong> is expiring on <strong>August 6, 2026</strong>.

Renew now to continue enjoying your VIP perks and discounts.`
  },
  {
    name: "19. Membership Renewed",
    title: "Membership Renewed",
    content: `Hi Ahmed,

Your membership at <strong>Skillify Salon</strong> has been renewed successfully.

<strong>New expiry date:</strong> August 6, 2027

Thank you for being a valued member.`
  },
  {
    name: "20. Package Expiring",
    title: "Package Expiring Soon",
    content: `Hi Ahmed,

Your package at <strong>Skillify Salon</strong> is nearing its expiration date.

<strong>Sessions remaining:</strong> 3

Book your appointments before they expire.`
  },
  {
    name: "21. Gift Card Received",
    title: "Gift Card Received",
    content: `Hi Ahmed,

You have received a gift card from <strong>Skillify Salon</strong>.

<strong>Code:</strong> GIFT-ABCD-1234
<strong>Value:</strong> Rs.1,000.00

Show this code at the desk on your next visit to redeem.`
  },
  {
    name: "22. Gift Card Expiring",
    title: "Gift Card Expiring Soon",
    content: `Hi Ahmed,

Your gift card at <strong>Skillify Salon</strong> is expiring soon.

Book your appointment and redeem your balance before it expires.`
  },
  {
    name: "23. Gift Card Redeemed",
    title: "Gift Card Redeemed",
    content: `Hi Ahmed,

Your gift card (Code: GIFT-ABCD-1234) has been used for <strong>Rs.500.00</strong> at <strong>Skillify Salon</strong>.

<strong>Remaining Balance:</strong> Rs.500.00`
  },
  {
    name: "24. Referral Code",
    title: "Your Referral Code",
    content: `Hi Ahmed,

Here is your personal referral code for <strong>Skillify Salon</strong>:

<strong>AHMED-REF-2026</strong>

Share this code with your friends and family. When they visit us, you both earn rewards.`
  },
  {
    name: "25. Referral Reward Earned",
    title: "Referral Reward Earned",
    content: `Hi Ahmed,

A friend used your referral code and you have earned <strong>100 loyalty points</strong> at <strong>Skillify Salon</strong>.

Keep sharing your code to keep earning rewards.`
  },
  {
    name: "26. Welcome Email",
    title: "Welcome to Skillify Salon",
    content: `Hi Ahmed,

Welcome to <strong>Skillify Salon</strong>! Your account has been created successfully.

We are excited to have you on board. Explore our services and book your first appointment today.`
  }
];

const wrapHtml = (variables, bodyContent) => `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #0f172a; line-height: 1.6;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01); border: 1px solid #e2e8f0;">
      <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 32px 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">
          ${variables.salon_name || "Skillify Salon"}
        </h1>
      </div>
      <div style="padding: 40px 32px;">
        <div style="font-size: 16px; color: #334155; margin-bottom: 24px; white-space: pre-wrap;">${bodyContent}</div>
      </div>
      <div style="background-color: #f1f5f9; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="font-size: 13px; color: #64748b; margin: 0; font-weight: 500;">
          &copy; 2026 ${variables.salon_name || "Skillify Salon"}. All rights reserved.
        </p>
        <p style="font-size: 12px; color: #94a3b8; margin: 8px 0 0 0;">
          This is an automated notification. Please do not reply directly to this email.
        </p>
      </div>
    </div>
  </div>
`;

const variables = {
  salon_name: "Skillify Salon",
  customer_name: "Ahmed",
  customer_phone: "+91 98765 43210",
  invoice_number: "INV-2026-001",
  invoice_amount: "2,500.00",
  appointment_date_time: "Thursday, August 06, 2026 at 10:00 AM",
  membership_expiry: "August 6, 2027",
  package_balance: "10",
  gift_card_code: "GIFT-ABCD-1234",
  gift_card_amount: "1,000.00",
  referral_code: "AHMED-REF-2026",
  points_earned: "50",
  new_balance: "250",
  order_number: "ORD-2026-042",
  order_amount: "1,200.00",
  amount_used: "500.00",
  balance_amount: "500.00"
};

async function sendAll() {
  console.log(`\nSending ${allTemplates.length} email templates to ${TO}...\n`);
  
  let sent = 0;
  let failed = 0;
  
  for (const tmpl of allTemplates) {
    try {
      const html = wrapHtml(variables, tmpl.content);
      await sendMail({
        to: TO,
        subject: `[Skillify Preview] ${tmpl.title}`,
        html,
        text: tmpl.content.replace(/<[^>]+>/g, "")
      });
      sent++;
      console.log(`  [${sent}/${allTemplates.length}] ${tmpl.name} - SENT`);
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      failed++;
      console.error(`  [${sent + failed}/${allTemplates.length}] ${tmpl.name} - FAILED: ${err.message}`);
    }
  }
  
  console.log(`\nDone! Sent: ${sent}, Failed: ${failed}`);
}

sendAll();
