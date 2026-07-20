import crypto from "crypto";

const PIN_SALT = process.env.JWT_SECRET ?? "coe-fallback-salt";

export function hashPin(pin: string): string {
  return crypto.createHash("sha256").update(`${pin}:${PIN_SALT}`).digest("hex");
}

export function verifyPin(pin: string, hash: string): boolean {
  return hashPin(pin) === hash;
}
