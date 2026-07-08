import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";

export const uploadRouter = Router();

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const ALLOWED_MIMES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf"
];
const ALLOWED_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".pdf"];

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIMES.includes(file.mimetype) || !ALLOWED_EXTS.includes(ext)) {
      return cb(new Error("Only image files (JPG, PNG, GIF, WebP, SVG) and PDFs are allowed"));
    }
    cb(null, true);
  }
});

uploadRouter.post("/", (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "File too large. Maximum size is 5MB." });
      }
      return res.status(400).json({ message: err.message || "Invalid file type" });
    }
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
    const fileUrl = `${proto}://${req.get("host")}/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
  });
});
