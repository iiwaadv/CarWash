import fs from "fs";
import multer from "multer";
import path from "path";
import { put } from "@vercel/blob";

// Prefer Vercel Blob when BLOB_READ_WRITE_TOKEN is set (persistent).
 // Otherwise fall back to local disk /tmp on Vercel (ephemeral — demo only).
const USE_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? (process.env.VERCEL ? "/tmp/uploads" : "./uploads");

if (!USE_BLOB) {
  for (const sub of ["photos", "audio"]) {
    const dir = path.join(UPLOAD_DIR, sub);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

// Always buffer in memory so we can push to Blob or write to disk after the fact.
const memory = multer.memoryStorage();

export const uploadPhotos = multer({
  storage: memory,
  limits: { fileSize: 10 * 1024 * 1024, files: 8 },
});

export const uploadAudio = multer({
  storage: memory,
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
});

function extFor(file: Express.Multer.File, sub: "photos" | "audio") {
  return path.extname(file.originalname) || (sub === "audio" ? ".webm" : ".jpg");
}

/** Persist a multer memory file and return a durable public URL. */
export async function persistUpload(file: Express.Multer.File, sub: "photos" | "audio"): Promise<string> {
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extFor(file, sub)}`;
  const contentType = file.mimetype || (sub === "audio" ? "audio/webm" : "image/jpeg");

  if (USE_BLOB) {
    const blob = await put(`${sub}/${filename}`, file.buffer, {
      access: "public",
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return blob.url;
  }

  const dest = path.join(UPLOAD_DIR, sub, filename);
  fs.writeFileSync(dest, file.buffer);
  return `/uploads/${sub}/${filename}`;
}

export async function persistUploads(files: Express.Multer.File[], sub: "photos" | "audio"): Promise<string[]> {
  return Promise.all(files.map((f) => persistUpload(f, sub)));
}

/** @deprecated prefer persistUpload — kept for any leftover callers */
export function publicUrl(sub: "photos" | "audio", filename: string): string {
  return `/uploads/${sub}/${filename}`;
}
