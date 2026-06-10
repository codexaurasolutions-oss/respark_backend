const target = process.env.HEALTHCHECK_URL || `http://127.0.0.1:${process.env.PORT || 5050}/health`;

try {
  const response = await fetch(target, { headers: { Accept: "application/json" } });
  const body = await response.json().catch(() => ({}));

  if (!response.ok || body.ok !== true) {
    console.error("Healthcheck failed", { target, status: response.status, body });
    process.exit(1);
  }

  console.log("Healthcheck passed", { target, status: response.status, uptimeSec: body.uptimeSec });
} catch (error) {
  console.error("Healthcheck request failed", { target, message: error.message });
  process.exit(1);
}
