import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.join(__dirname, "../uploads");
const DEFAULT_LOGO_PATH = path.join(__dirname, "../public/logo.png");
const LOGO_PREFIX = "logo";

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    cb(null, `${LOGO_PREFIX}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (_req, file, cb) => {
    const allowed = /^image\/(png|jpeg|jpg|gif|webp|svg\+xml)$/i;
    if (allowed.test(file.mimetype)) cb(null, true);
    else cb(new Error("Only image files (PNG, JPEG, GIF, WebP, SVG) are allowed"));
  },
});

export const settingsRoutes = Router();

/** POST /api/settings/logo — upload logo. Accepts multipart/form-data with field "logo". */
settingsRoutes.post("/logo", (req, res, next) => {
  upload.single("logo")(req, res, (err: unknown) => {
    if (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      return res.status(400).json({ error: msg });
    }
    next();
  });
}, (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded. Use field name 'logo'." });
    // Remove any other logo.* files
    const files = fs.readdirSync(UPLOADS_DIR);
    for (const f of files) {
      if (f.startsWith(LOGO_PREFIX) && f !== req.file.filename) {
        fs.unlinkSync(path.join(UPLOADS_DIR, f));
      }
    }
    res.json({ ok: true, filename: req.file.filename });
  } catch (err) {
    console.error("Logo upload error:", err);
    res.status(500).json({ error: "Failed to upload logo" });
  }
});

/** GET /api/settings/logo — serve logo (uploaded or default). Returns 204 if none. */
settingsRoutes.get("/logo", (req, res) => {
  try {
    const files = fs.existsSync(UPLOADS_DIR) ? fs.readdirSync(UPLOADS_DIR) : [];
    const logoFile = files.find((f) => f.startsWith(LOGO_PREFIX));
    if (logoFile) {
      return res.sendFile(path.resolve(path.join(UPLOADS_DIR, logoFile)));
    }
    if (fs.existsSync(DEFAULT_LOGO_PATH)) {
      return res.sendFile(path.resolve(DEFAULT_LOGO_PATH));
    }
    res.status(204).send();
  } catch (err) {
    console.error("Logo serve error:", err);
    res.status(500).json({ error: "Failed to serve logo" });
  }
});
