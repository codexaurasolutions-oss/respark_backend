import { prisma } from "./prisma.js";
import { sendMail } from "./mailer.js";
import { renderTemplateText, resolveTemplateContext } from "./phase3.js";

const normalizeTemplateType = (value) => String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");

const fallbackTemplates = {
  invoice_template: {
    title: "Invoice Generated",
    content: "Hi {{customer_name}},<br/><br/>Your invoice from <strong>{{salon_name}}</strong> has been generated.<br/><br/><strong>Invoice Number:</strong> {{invoice_number}}<br/><strong>Total Amount:</strong> Rs.{{invoice_amount}}<br/><br/>If you have any questions, please contact our front desk."
  },
  invoice_refund_template: {
    title: "Invoice Refund Processed",
    content: "Hi {{customer_name}},<br/><br/>A refund has been processed against your recent invoice at <strong>{{salon_name}}</strong>.<br/><br/>The amount should reflect in your account shortly depending on your payment method. For any queries, please contact our front desk."
  },
  invoice_cancel_template: {
    title: "Invoice Cancelled",
    content: "Hi {{customer_name}},<br/><br/>Your recent invoice at <strong>{{salon_name}}</strong> has been cancelled.<br/><br/>If you did not request this cancellation, please contact our front desk immediately."
  },
  membership_purchase_template: {
    title: "Welcome to your Membership",
    content: "Hi {{customer_name}},<br/><br/>Your membership at <strong>{{salon_name}}</strong> is now active.<br/><br/>You can now enjoy all your exclusive benefits and perks.<br/><br/><strong>Valid until:</strong> {{membership_expiry}}"
  },
  package_purchase_template: {
    title: "Your Package is Active",
    content: "Hi {{customer_name}},<br/><br/>Your package at <strong>{{salon_name}}</strong> is now active.<br/><br/><strong>Sessions available:</strong> {{package_balance}}<br/><br/>We look forward to seeing you for your next session."
  },
  payment_receipt_template: {
    title: "Payment Receipt",
    content: "Hi {{customer_name}},<br/><br/>We have received your payment of <strong>Rs.{{invoice_amount}}</strong> at <strong>{{salon_name}}</strong>.<br/><br/>Thank you for your payment."
  },
  appointment_confirmation: {
    title: "Appointment Confirmed",
    content: "Hi {{customer_name}},<br/><br/>Your appointment at <strong>{{salon_name}}</strong> has been confirmed.<br/><br/><strong>Date & Time:</strong> {{appointment_date_time}}<br/><br/>If you need to reschedule, please contact us at your earliest convenience."
  },
  appointment_reminder: {
    title: "Appointment Reminder",
    content: "Hi {{customer_name}},<br/><br/>This is a reminder that you have an upcoming appointment at <strong>{{salon_name}}</strong>.<br/><br/><strong>Date & Time:</strong> {{appointment_date_time}}<br/><br/>We look forward to seeing you."
  },
  appointment_cancelled: {
    title: "Appointment Cancelled",
    content: "Hi {{customer_name}},<br/><br/>Your appointment at <strong>{{salon_name}}</strong> scheduled for <strong>{{appointment_date_time}}</strong> has been cancelled.<br/><br/>We hope to see you again soon."
  },
  order_confirmation: {
    title: "Order Confirmation",
    content: "Hi {{customer_name}},<br/><br/>Thank you for your order from <strong>{{salon_name}}</strong>.<br/><br/><strong>Order Number:</strong> {{order_number}}<br/><strong>Total Amount:</strong> Rs.{{order_amount}}<br/><br/>We are processing your order and will keep you updated."
  },
  enquiry_follow_up: {
    title: "Update on your Enquiry",
    content: "Hi {{customer_name}},<br/><br/>Thank you for contacting <strong>{{salon_name}}</strong>. Our team has reviewed your enquiry and left an update for you.<br/><br/>We will stay in touch to ensure everything is resolved."
  },
  feedback_follow_up: {
    title: "Update on your Feedback",
    content: "Hi {{customer_name}},<br/><br/>Thank you for sharing your feedback with <strong>{{salon_name}}</strong>. We take your comments seriously and our team has an update regarding your experience.<br/><br/>We are committed to providing you with the best possible service."
  },
  feedback_request_template: {
    title: "How was your experience?",
    content: "Hi {{customer_name}},<br/><br/>Thank you for your recent visit to <strong>{{salon_name}}</strong>. We hope you had a great experience.<br/><br/>We would love to hear your thoughts. Please share your feedback at your convenience."
  },
  birthday_offer_template: {
    title: "Happy Birthday",
    content: "Hi {{customer_name}},<br/><br/>Wishing you a very Happy Birthday from all of us at <strong>{{salon_name}}</strong>.<br/><br/>We have a special birthday treat waiting for you. Visit us soon to claim it."
  },
  anniversary_offer_template: {
    title: "Happy Anniversary",
    content: "Hi {{customer_name}},<br/><br/>Happy Anniversary from <strong>{{salon_name}}</strong>.<br/><br/>Celebrate with a special pampering session. We have an exclusive anniversary offer just for you."
  },
  loyalty_earning_template: {
    title: "Loyalty Points Earned",
    content: "Hi {{customer_name}},<br/><br/>You have earned <strong>{{points_earned}} loyalty points</strong> at <strong>{{salon_name}}</strong>.<br/><br/><strong>Your new balance:</strong> {{new_balance}} points.<br/><br/>Keep visiting to unlock exciting rewards."
  },
  loyalty_expiry_template: {
    title: "Loyalty Points Expiring Soon",
    content: "Hi {{customer_name}},<br/><br/>Your loyalty points at <strong>{{salon_name}}</strong> are expiring soon.<br/><br/>Book your next visit today and redeem your points before they expire."
  },
  membership_expiry_template: {
    title: "Membership Expiring Soon",
    content: "Hi {{customer_name}},<br/><br/>Your membership at <strong>{{salon_name}}</strong> is expiring on <strong>{{membership_expiry}}</strong>.<br/><br/>Renew now to continue enjoying your VIP perks and discounts."
  },
  membership_renewal_template: {
    title: "Membership Renewed",
    content: "Hi {{customer_name}},<br/><br/>Your membership at <strong>{{salon_name}}</strong> has been renewed successfully.<br/><br/><strong>New expiry date:</strong> {{membership_expiry}}<br/><br/>Thank you for being a valued member."
  },
  package_expiry_template: {
    title: "Package Expiring Soon",
    content: "Hi {{customer_name}},<br/><br/>Your package at <strong>{{salon_name}}</strong> is nearing its expiration date.<br/><br/><strong>Sessions remaining:</strong> {{package_balance}}<br/><br/>Book your appointments before they expire."
  },
  gift_card_issued: {
    title: "Gift Card Received",
    content: "Hi {{customer_name}},<br/><br/>You have received a gift card from <strong>{{salon_name}}</strong>.<br/><br/><strong>Code:</strong> {{gift_card_code}}<br/><strong>Value:</strong> Rs.{{gift_card_amount}}<br/><br/>Show this code at the desk on your next visit to redeem."
  },
  gift_card_expiry_template: {
    title: "Gift Card Expiring Soon",
    content: "Hi {{customer_name}},<br/><br/>Your gift card at <strong>{{salon_name}}</strong> is expiring soon.<br/><br/>Book your appointment and redeem your balance before it expires."
  },
  gift_card_redeemed_template: {
    title: "Gift Card Redeemed",
    content: "Hi {{customer_name}},<br/><br/>Your gift card (Code: {{gift_card_code}}) has been used for <strong>Rs.{{amount_used}}</strong> at <strong>{{salon_name}}</strong>.<br/><br/><strong>Remaining Balance:</strong> Rs.{{balance_amount}}"
  },
  referral_code_sms: {
    title: "Your Referral Code",
    content: "Hi {{customer_name}},<br/><br/>Here is your personal referral code for <strong>{{salon_name}}</strong>:<br/><br/><strong>{{referral_code}}</strong><br/><br/>Share this code with your friends and family. When they visit us, you both earn rewards."
  },
  referrer_reward_sms: {
    title: "Referral Reward Earned",
    content: "Hi {{customer_name}},<br/><br/>A friend used your referral code and you have earned <strong>{{points_earned}} loyalty points</strong> at <strong>{{salon_name}}</strong>.<br/><br/>Keep sharing your code to keep earning rewards."
  }
};

const resolveMessageTemplate = async (salonId, templateType) => {
  const normalizedType = normalizeTemplateType(templateType);
  const existing = await prisma.messageTemplate.findUnique({
    where: { salonId_type: { salonId, type: normalizedType } }
  });
  if (existing) return existing;
  const fallback = fallbackTemplates[normalizedType];
  if (!fallback) return null;
  return prisma.messageTemplate.create({
    data: {
      salonId,
      type: normalizedType,
      title: fallback.title,
      content: fallback.content,
      variables: []
    }
  });
};

const areNotificationEmailsEnabled = async (salonId) => {
  if (!salonId) return true;
  const setting = await prisma.salonSetting.findFirst({
    where: { salonId, branchId: null },
    select: { advancedSettings: true }
  });
  return setting?.advancedSettings?.notificationSettings?.emailEnabled !== false;
};

export const attemptCustomerTemplateEmail = async ({ salonId, toEmail, templateType, context = {} }) => {
  if (!toEmail) {
    return { skipped: true, reason: "missing-recipient" };
  }

  try {
    const emailEnabled = await areNotificationEmailsEnabled(salonId);
    if (!emailEnabled) {
      return { skipped: true, reason: "email-alerts-disabled" };
    }

    const template = await resolveMessageTemplate(salonId, templateType);
    if (!template?.content) {
      return { skipped: true, reason: "missing-template" };
    }

    const variables = await resolveTemplateContext(salonId, context);
    const textContent = renderTemplateText(template.content, variables);
    const subject = template.title || "Salon update";
    
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #0f172a; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01); border: 1px solid #e2e8f0;">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 32px 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">
              ${variables.salon_name || "Notification"}
            </h1>
          </div>
          
          <!-- Body -->
          <div style="padding: 40px 32px;">
            <div style="font-size: 16px; color: #334155; margin-bottom: 24px; white-space: pre-wrap;">${textContent}</div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f1f5f9; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="font-size: 13px; color: #64748b; margin: 0; font-weight: 500;">
              &copy; ${new Date().getFullYear()} ${variables.salon_name || "Salon"}. All rights reserved.
            </p>
            <p style="font-size: 12px; color: #94a3b8; margin: 8px 0 0 0;">
              This is an automated notification. Please do not reply directly to this email.
            </p>
          </div>
          
        </div>
      </div>
    `;

    const delivery = await sendMail({
      to: toEmail,
      subject,
      html,
      text: textContent
    });

    return {
      skipped: false,
      templateType: template.type,
      delivery
    };
  } catch (error) {
    console.error(`[emailNotifications] Failed to send email of type ${templateType} to ${toEmail}:`, error);
    return {
      skipped: true,
      reason: "delivery-error",
      error: error.message
    };
  }
};
