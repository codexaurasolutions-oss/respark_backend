export const errorHandler = (err, req, res, next) => {
  console.error(`[${req.requestId || "no-request-id"}]`, JSON.stringify(err, Object.getOwnPropertyNames(err), 2));

  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  if (err?.code === "P2002") {
    const target = Array.isArray(err.meta?.target) ? err.meta.target.join(", ") : err.meta?.target || "unique field";
    return res.status(409).json({ message: `${target} already exists` });
  }

  if (err?.code === "P2025") {
    return res.status(404).json({ message: err.message || "Record not found" });
  }

  if (err?.code === "P2003") {
    const field = err.meta?.field_name || err.meta?.target || "foreign key";
    return res.status(400).json({ message: `Invalid reference: ${field}. The related record does not exist.` });
  }

  const status = err.status || 500;
  const message = status >= 500
    ? process.env.NODE_ENV === "production"
      ? err.message || "Internal server error"
      : (err.message || "Internal server error")
    : (err.message || "Request failed");

  const response = { message: message || "Internal server error" };
  if (err.issues) response.issues = err.issues;
  if (req.requestId) response.requestId = req.requestId;
  res.status(status).json(response);
};
