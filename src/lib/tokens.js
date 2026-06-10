import jwt from "jsonwebtoken";
export const signAccessToken = (payload) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });
export const signRefreshToken = (payload) => jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
export const signLoginAccessToken = (payload) => jwt.sign({ ...payload, purpose: "DEMO_LOGIN" }, process.env.JWT_SECRET, { expiresIn: "30d" });
export const verifyAccessToken = (token) => jwt.verify(token, process.env.JWT_SECRET);
export const verifyRefreshToken = (token) => jwt.verify(token, process.env.JWT_REFRESH_SECRET);
export const verifyLoginAccessToken = (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (decoded?.purpose !== "DEMO_LOGIN") throw new Error("Invalid login access token");
  return decoded;
};
