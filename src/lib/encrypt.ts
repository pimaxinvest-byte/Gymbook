/**
 * AES-256-GCM encryption helpers for sensitive data at rest.
 * Key material is derived from NEXTAUTH_SECRET (never stored alongside the ciphertext).
 *
 * SECURITY:
 *  - A fresh 12-byte IV is generated for every encrypt call.
 *  - The output is: base64(iv + authTag + ciphertext) — all in one string.
 *  - Only the server can decrypt (NEXTAUTH_SECRET is never sent to the client).
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// Derive a 32-byte key from the secret using SHA-256
function deriveKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set — cannot encrypt/decrypt");
  return createHash("sha256").update(secret).digest();
}

/**
 * Encrypt a plaintext string.
 * Returns a base64-encoded string containing IV + authTag + ciphertext.
 */
export function encrypt(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16 bytes

  // Layout: [12 bytes IV][16 bytes authTag][N bytes ciphertext]
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString("base64");
}

/**
 * Decrypt a base64 string produced by `encrypt`.
 * Throws on tampered/invalid data (GCM auth tag mismatch).
 */
export function decrypt(encoded: string): string {
  const key = deriveKey();
  const combined = Buffer.from(encoded, "base64");

  const iv = combined.subarray(0, 12);
  const authTag = combined.subarray(12, 28);
  const ciphertext = combined.subarray(28);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}
