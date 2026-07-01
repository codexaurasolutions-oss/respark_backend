import { createApp } from "./app.js";
import { createServer } from "http";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PORT = process.env.PORT || 5050;

const app = createApp();

const server = createServer(app);

server.listen(PORT, async () => {
  try {
    await prisma.$connect();
    console.log(`Database connected`);
  } catch (err) {
    console.error("Database connection failed:", err.message);
  }
  console.log(`Backend running on ${PORT}`);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});
