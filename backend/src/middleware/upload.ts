import fs from "fs";
import multer from "multer";
import path from "path";

// Vercel's serverless filesystem is read-only except for /tmp, and /tmp is
// wiped between cold starts — fine for a quick demo, but replace with real
// object storage (e.g. Vercel Blob / S3) before relying on this in production.
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? (process.env.VERCEL ? "/tmp/uploads" : "./uploads");

for (const sub of ["photos", "audio"]) {
  const dir = path.join(UPLOAD_DIR, sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function storageFor(sub: "photos" | "audio") {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(UPLOAD_DIR, sub)),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || (sub === "audio" ? ".webm" : ".jpg");
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, unique);
    },
  });
}

export const uploadPhotos = multer({
  storage: storageFor("photos"),
  limits: { fileSize: 10 * 1024 * 1024, files: 8 },
});

export const uploadAudio = multer({
  storage: storageFor("audio"),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
});

export function publicUrl(sub: "photos" | "audio", filename: string): string {
  return `/uploads/${sub}/${filename}`;
}
