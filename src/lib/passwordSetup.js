import crypto from "crypto";

export const generateRawPasswordSetupToken = () => crypto.randomBytes(32).toString("hex");

export const hashPasswordSetupToken = (token) =>
  crypto.createHash("sha256").update(String(token)).digest("hex");

export const generateTemporaryPassword = () => crypto.randomBytes(18).toString("base64url");
