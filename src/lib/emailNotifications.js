import { prisma } from "./prisma.js";
import { sendMail } from "./mailer.js";
import { renderTemplateText, resolveTemplateContext } from "./phase3.js";

const normalizeTemplateType = (value) => String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");

const fallbackTemplates = {
  invoice_template: {
    title: "Invoice Generated",
    content: "Hi <strong>{{customer_name}}</strong>,<br/><br/>Your latest invoice from <strong>{{salon_name}}</strong> has been generated.<br/><br/>💰 <strong>Total Amount:</strong> ₹{{invoice_amount}}<br/>🔗 <a href='{{invoice_link}}' style='color:#0284c7;text-decoration:none;font-weight:bold;'>Click here to view your invoice</a><br/><br/>If you have any questions, feel free to reach out."
  },
  invoice_refund_template: {
    title: "Invoice Refund Processed",
    content: "Hi <strong>{{customer_name}}</strong>,<br/><br/>We wanted to let you know that a refund has been successfully processed against your recent invoice at <strong>{{salon_name}}</strong>.<br/><br/>🔗 <a href='{{invoice_link}}' style='color:#0284c7;text-decoration:none;font-weight:bold;'>View your updated invoice here</a><br/><br/>The amount should reflect in your account shortly depending on your payment method."
  },
  invoice_cancel_template: {
    title: "Invoice Cancelled",
    content: "Hi <strong>{{customer_name}}</strong>,<br/><br/>This is a confirmation that your recent invoice at <strong>{{salon_name}}</strong> has been cancelled.<br/><br/>If you did not request this cancellation or have any questions, please contact our front desk."
  },
  membership_purchase_template: {
    title: "Welcome to your Membership!",
    content: "Hi <strong>{{customer_name}}</strong>,<br/><br/>Congratulations! Your membership at <strong>{{salon_name}}</strong> is now officially active. 🎉<br/><br/>You can now enjoy all your exclusive benefits and perks.<br/><br/>📅 <strong>Valid until:</strong> {{membership_expiry}}"
  },
  package_purchase_template: {
    title: "Your Package is Active!",
    content: "Hi <strong>{{customer_name}}</strong>,<br/><br/>Your new package at <strong>{{salon_name}}</strong> is now active and ready to use! ✨<br/><br/>You have <strong>{{package_balance}} sessions</strong> available.<br/><br/>We look forward to seeing you for your next session."
  },
  payment_receipt_template: {
    title: "Payment Receipt",
    content: "Hi <strong>{{customer_name}}</strong>,<br/><br/>Thank you for your payment! We have successfully received <strong>₹{{invoice_amount}}</strong>.<br/><br/>🔗 <a href='{{invoice_link}}' style='color:#0284c7;text-decoration:none;font-weight:bold;'>View your receipt here</a>"
  },
  appointment_confirmation: {
    title: "Appointment Confirmed",
    content: "Hi <strong>{{customer_name}}</strong>,<br/><br/>We are thrilled to confirm your upcoming appointment at <strong>{{salon_name}}</strong>. ✨<br/><br/>🗓 <strong>Date & Time:</strong> {{appointment_date_time}}<br/><br/>If you need to reschedule, please let us know at your earliest convenience."
  },
  appointment_reminder: {
    title: "Appointment Reminder",
    content: "Hi <strong>{{customer_name}}</strong>,<br/><br/>This is a friendly reminder that you have an upcoming appointment at <strong>{{salon_name}}</strong>.<br/><br/>🗓 <strong>Date & Time:</strong> {{appointment_date_time}}<br/><br/>We are excited to see you soon!"
  },
  appointment_cancelled: {
    title: "Appointment Cancelled",
    content: "Hi <strong>{{customer_name}}</strong>,<br/><br/>Your appointment at <strong>{{salon_name}}</strong> scheduled for <strong>{{appointment_date_time}}</strong> has been successfully cancelled.<br/><br/>We hope to see you again soon. You can book a new appointment online anytime."
  },
  order_confirmation: {
    title: "Order Confirmation",
    content: "Hi <strong>{{customer_name}}</strong>,<br/><br/>Thank you for your order from <strong>{{salon_name}}</strong>!<br/><br/>📦 <strong>Order Number:</strong> {{order_number}}<br/>💰 <strong>Total Amount:</strong> ₹{{order_amount}}<br/><br/>We are currently processing your order and will keep you updated."
  },
  enquiry_follow_up: {
    title: "Update on your Enquiry",
    content: "Hi <strong>{{customer_name}}</strong>,<br/><br/>Thank you for getting in touch with <strong>{{salon_name}}</strong>. Our team has reviewed your enquiry and left an update for you.<br/><br/>We will stay in touch to ensure everything is resolved perfectly."
  },
  feedback_follow_up: {
    title: "Following up on your Feedback",
    content: "Hi <strong>{{customer_name}}</strong>,<br/><br/>Thank you for taking the time to share your feedback with <strong>{{salon_name}}</strong>. We take your comments seriously and our team has added an update regarding your experience.<br/><br/>We are committed to providing you with the best possible service."
  },
  feedback_request_template: {
    title: "How was your experience?",
    content: "Hi <strong>{{customer_name}}</strong>,<br/><br/>Thank you for your recent visit to <strong>{{salon_name}}</strong>! We hope you had a wonderful experience.<br/><br/>We'd love to hear your thoughts. It only takes a minute!<br/><br/>🔗 <a href='{{feedback_link}}' style='color:#0284c7;text-decoration:none;font-weight:bold;'>Click here to leave your feedback</a>"
  },
  birthday_offer_template: {
    title: "Happy Birthday! 🎉",
    content: "Hi <strong>{{customer_name}}</strong>,<br/><br/>Wishing you a very Happy Birthday from all of us at <strong>{{salon_name}}</strong>! 🎂<br/><br/>To celebrate your special day, we have a special birthday treat waiting for you. Visit us soon to claim it and pamper yourself!"
  },
  anniversary_offer_template: {
    title: "Happy Anniversary! 💍",
    content: "Hi <strong>{{customer_name}}</strong>,<br/><br/>Happy Anniversary from <strong>{{salon_name}}</strong>! 🥂<br/><br/>Celebrate your love with a special pampering session. We have an exclusive anniversary offer just for you. Book an appointment today to celebrate in style!"
  },
  loyalty_earning_template: {
    title: "You've earned new Loyalty Points! 🌟",
    content: "Hi <strong>{{customer_name}}</strong>,<br/><br/>Great news! You just earned <strong>{{points_earned}} loyalty points</strong> at <strong>{{salon_name}}</strong>. 🎉<br/><br/>🏆 <strong>Your new balance:</strong> {{new_balance}} points.<br/><br/>Keep visiting to unlock exciting rewards!"
  },
  loyalty_expiry_template: {
    title: "Your Points are Expiring Soon! ⏰",
    content: "Hi <strong>{{customer_name}}</strong>,<br/><br/>Just a quick heads-up: your loyalty points at <strong>{{salon_name}}</strong> are expiring soon!<br/><br/>Don't let them go to waste. Book your next visit today and redeem your points for a special treat."
  },
  membership_expiry_template: {
    title: "Membership Expiring Soon",
    content: "Hi <strong>{{customer_name}}</strong>,<br/><br/>Your exclusive membership at <strong>{{salon_name}}</strong> is expiring on <strong>{{membership_expiry}}</strong>.<br/><br/>Renew now to ensure you don't lose access to your VIP perks and discounts!"
  },
  membership_renewal_template: {
    title: "Membership Renewed Successfully! 🎉",
    content: "Hi <strong>{{customer_name}}</strong>,<br/><br/>Great news! Your membership at <strong>{{salon_name}}</strong> has been successfully renewed.<br/><br/>Your new expiration date is <strong>{{membership_expiry}}</strong>. Thank you for being a valued member!"
  },
  package_expiry_template: {
    title: "Package Expiring Soon",
    content: "Hi <strong>{{customer_name}}</strong>,<br/><br/>Your package at <strong>{{salon_name}}</strong> is nearing its expiration date.<br/><br/>You still have <strong>{{package_balance}} sessions</strong> remaining. Make sure to book your appointments before they expire!"
  },
  gift_card_issued: {
    title: "You've received a Gift Card! 🎁",
    content: "Hi <strong>{{customer_name}}</strong>,<br/><br/>You have received a special Gift Card from <strong>{{salon_name}}</strong>!<br/><br/>🎫 <strong>Code:</strong> {{gift_card_code}}<br/>💰 <strong>Value:</strong> ₹{{gift_card_amount}}<br/><br/>Show this code at the desk on your next visit to redeem your gift. Enjoy!"
  },
  gift_card_expiry_template: {
    title: "Gift Card Expiring Soon",
    content: "Hi <strong>{{customer_name}}</strong>,<br/><br/>Don't forget about your gift card at <strong>{{salon_name}}</strong>!<br/><br/>It is expiring soon. We would love to pamper you, so book your appointment and redeem your balance before it's too late."
  },
  gift_card_redeemed_template: {
    title: "Gift Card Used Successfully",
    content: "Hi <strong>{{customer_name}}</strong>,<br/><br/>Your gift card (Code: {{gift_card_code}}) was successfully used for <strong>₹{{amount_used}}</strong> at <strong>{{salon_name}}</strong>.<br/><br/>💳 <strong>Remaining Balance:</strong> ₹{{balance_amount}}<br/><br/>Thank you for visiting us!"
  },
  referral_code_sms: {
    title: "Share & Earn! 🎁",
    content: "Hi <strong>{{customer_name}}</strong>,<br/><br/>Here is your personal referral code for <strong>{{salon_name}}</strong>:<br/><br/><strong style='font-size:18px;color:#0284c7;'>{{referral_code}}</strong><br/><br/>Share this code with your friends and family. When they visit us, you both earn exciting rewards!"
  },
  referrer_reward_sms: {
    title: "Referral Reward Unlocked! 🎉",
    content: "Hi <strong>{{customer_name}}</strong>,<br/><br/>Congratulations! Because a friend used your referral code, you just earned <strong>{{points_earned}} loyalty points</strong> at <strong>{{salon_name}}</strong>.<br/><br/>Keep sharing your code to keep earning more rewards!"
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
            
            <hr style="border: 0; border-top: 1px dashed #cbd5e1; margin: 40px 0 24px 0;" />
            <p style="font-size: 14px; color: #64748b; margin: 0; text-align: center;">
              Thank you for choosing <strong>${variables.salon_name || "us"}</strong>.<br/>We look forward to serving you!
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f1f5f9; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="font-size: 13px; color: #64748b; margin: 0; font-weight: 500;">
              © ${new Date().getFullYear()} ${variables.salon_name || "Salon"}. All rights reserved.
            </p>
            <p style="font-size: 12px; color: #94a3b8; margin: 8px 0 0 0;">
              This is an automated message. Please do not reply directly to this email.
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
