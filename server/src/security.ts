import crypto from 'node:crypto';
import fs from 'node:fs';
import { SECRET_FILE } from './config.js';

let cachedServerSecret: string | null = null;

/**
 * Returns or initializes the persistent server secret key
 */
export function getServerSecret(): string {
  if (cachedServerSecret) return cachedServerSecret;

  if (fs.existsSync(SECRET_FILE)) {
    cachedServerSecret = fs.readFileSync(SECRET_FILE, 'utf-8').trim();
    return cachedServerSecret;
  }

  // Generate new cryptographic 256-bit secret
  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SECRET_FILE, secret, { mode: 0o600, encoding: 'utf-8' });
  cachedServerSecret = secret;
  return cachedServerSecret;
}

/**
 * Hashes a plaintext room password with a random 16-byte salt via scrypt
 */
export async function hashPassword(password: string): Promise<{ salt: string; hash: string }> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve({ salt, hash: derivedKey.toString('hex') });
    });
  });
}

/**
 * Verifies a password against the stored scrypt hash and salt
 */
export async function verifyPassword(
  password: string,
  salt: string,
  storedHash: string
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      const derivedHex = derivedKey.toString('hex');
      try {
        const a = Buffer.from(derivedHex, 'hex');
        const b = Buffer.from(storedHash, 'hex');
        if (a.length !== b.length) return resolve(false);
        resolve(crypto.timingSafeEqual(a, b));
      } catch {
        resolve(false);
      }
    });
  });
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Generates an HMAC-SHA256 session token for an authenticated room
 */
export function generateRoomToken(roomId: string, expiresInMs: number = SEVEN_DAYS_MS): string {
  const secret = getServerSecret();
  const expiresAt = Date.now() + expiresInMs;
  const payload = `${roomId}:${expiresAt}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64url');
}

/**
 * Validates a room HMAC session token
 */
export function verifyRoomToken(roomId: string, token: string): boolean {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const [tokenRoomId, expiresAtStr, signature] = decoded.split(':');
    if (!tokenRoomId || !expiresAtStr || !signature) return false;

    if (tokenRoomId !== roomId) return false;

    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt) || Date.now() > expiresAt) return false;

    const secret = getServerSecret();
    const payload = `${tokenRoomId}:${expiresAtStr}`;
    const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const a = Buffer.from(signature, 'hex');
    const b = Buffer.from(expectedSig, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
