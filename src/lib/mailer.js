import nodemailer from "nodemailer";

let transporter;

// Increase timeout to 30 seconds for better reliability
const DEFAULT_TIMEOUT_MS = Number(process.env.SMTP_TIMEOUT_MS || 30000);

const smtpConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_FROM);

const createTransporter = () => {
  if (smtpConfigured()) {
    const port = Number(process.env.SMTP_PORT || 587);
    const secureSetting = process.env.SMTP_SECURE;
    const secure = secureSetting === "true" || secureSetting === "1" || secureSetting === true;

    const config = {
      host: process.env.SMTP_HOST,
      port: port,
      secure: secure,
      family: 4,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
      tls: {
        rejectUnauthorized: false
      }
    };

    if (process.env.SMTP_USER) {
      config.auth = {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS || ""
      };
    }

    console.log("[mailer] SMTP Config:", {
      host: config.host,
      port: config.port,
      secure: config.secure,
      hasAuth: !!process.env.SMTP_USER
    });

    return nodemailer.createTransport(config);
  }

  return nodemailer.createTransport({
    jsonTransport: true
  });
};

export const getMailer = () => {
  if (!transporter) transporter = createTransporter();
  return transporter;
};

export const mailerMode = () => (smtpConfigured() ? "smtp" : "json");

const withTimeout = async (promise, timeoutMs) => {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Email delivery timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export const sendMail = async (options) => {
  try {
    const mail = await withTimeout(
      getMailer().sendMail({
        from: process.env.SMTP_FROM || "Skillify <no-reply@skillify.local>",
        ...options
      }),
      DEFAULT_TIMEOUT_MS
    );

    return {
      mode: mailerMode(),
      messageId: mail.messageId || null,
      preview: typeof mail.message === "string" ? mail.message : null
    };
  } catch (error) {
    console.error("[mailer] Send error:", {
      message: error.message,
      code: error.code,
      to: options.to,
      timeout: DEFAULT_TIMEOUT_MS
    });
    throw error;
  }
};

