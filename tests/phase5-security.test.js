import { Router } from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

const buildSecurityApp = (options = {}) => {
  const testRouter = Router();
  testRouter.get("/ping", (req, res) => {
    res.json({ ok: true, requestId: req.requestId });
  });
  testRouter.get("/explode", () => {
    throw new Error("database password leaked");
  });

  return createApp({
    routerOverride: testRouter,
    authMiddlewareOverride: (req, res, next) => next(),
    allowedOrigins: ["http://127.0.0.1:5173"],
    rateLimitWindowMs: 60 * 1000,
    rateLimitMax: 2,
    ...options
  });
};

describe("phase 5 security hardening", () => {
  it("serves security headers and request ids", async () => {
    const response = await request(buildSecurityApp()).get("/api/v1/ping");

    expect(response.status).toBe(200);
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["x-request-id"]).toBeTruthy();
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.body.requestId).toBe(response.headers["x-request-id"]);
  });

  it("allows configured CORS origins and blocks unknown ones", async () => {
    const allowed = await request(buildSecurityApp())
      .get("/api/v1/ping")
      .set("Origin", "http://127.0.0.1:5173");

    expect(allowed.status).toBe(200);
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:5173");

    const blocked = await request(buildSecurityApp())
      .get("/api/v1/ping")
      .set("Origin", "http://evil.example.com");

    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toMatch(/cors/i);
  });

  it("rate limits repeated requests", async () => {
    const app = buildSecurityApp();

    await request(app).get("/api/v1/ping").expect(200);
    await request(app).get("/api/v1/ping").expect(200);
    const limited = await request(app).get("/api/v1/ping");

    expect(limited.status).toBe(429);
    expect(limited.body.message).toMatch(/too many requests/i);
  });

  it("sanitizes internal errors in production mode", async () => {
    process.env.NODE_ENV = "production";

    const response = await request(buildSecurityApp()).get("/api/v1/explode");

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Internal server error");
    expect(response.body.message).not.toContain("database password");
    expect(response.body.requestId).toBeTruthy();
  });
});
