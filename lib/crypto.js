// lib/crypto.js
//
// Centralized cryptographic primitives for Datapath.
//
// Threat model: Upstash Redis is treated as untrusted. An attacker with full
// read access to the database must not be able to recover plaintext, and must
// not be able to mount a cheap offline brute-force against the access key.
//
// Two derivations from the user's access key:
//   1. authHash  — used to verify the user knows the key (constant-time compare)
//   2. encKey    — used to AES-256-GCM encrypt the payload text
// Both go through scrypt with per-record random salts, so two records with the
// same access key produce different stored material.

import crypto from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(crypto.scrypt);

// scrypt cost. N=2^14 is a reasonable serverless-friendly setting:
// ~50–80ms on a Vercel function, low enough to not blow the function timeout
// even on cold start, high enough to make rainbow tables and casual brute-force
// uneconomic. Bump N if you move off serverless.
const SCRYPT_N = 1 << 13;
const SCRYPT_r = 8;
const SCRYPT_p = 1;
const SCRYPT_OPTS = { N: SCRYPT_N, r: SCRYPT_r, p: SCRYPT_p, maxmem: 32 * 1024 * 1024 };

const AUTH_KEY_BYTES = 32;   // 256-bit auth tag from scrypt
const ENC_KEY_BYTES = 32;    // AES-256
const SALT_BYTES = 16;
const IV_BYTES = 12;         // GCM standard
const SALT_AUTH_LABEL = Buffer.from('datapath:auth:v2');
const SALT_ENC_LABEL = Buffer.from('datapath:enc:v2');

export const PAYLOAD_VERSION = 2;

function randomBytes(n) {
    return crypto.randomBytes(n);
}

/**
 * Derive both the auth hash and the encryption key from the user's access key.
 * Different labels mixed into the salt ensure auth and enc keys are independent
 * even though they share the same per-record salt material.
 */
async function deriveBoth(accessKey, salt) {
    if (typeof accessKey !== 'string' || accessKey.length === 0) {
        throw new Error('access key required');
    }
    const authSalt = Buffer.concat([salt, SALT_AUTH_LABEL]);
    const encSalt = Buffer.concat([salt, SALT_ENC_LABEL]);

    const authHash = await scrypt(accessKey, authSalt, AUTH_KEY_BYTES, SCRYPT_OPTS);
    const encKey = await scrypt(accessKey, encSalt, ENC_KEY_BYTES, SCRYPT_OPTS);
    return { authHash, encKey };
}

/**
 * Build the encrypted payload to store at create time.
 * Returns the object shape that goes into Redis.
 */
export async function buildPayload({ text, accessKey, remainingViews, maxViews, expiresAt }) {
    const salt = randomBytes(SALT_BYTES);
    const { authHash, encKey } = await deriveBoth(accessKey, salt);

    const iv = randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
    const ciphertext = Buffer.concat([
        cipher.update(text, 'utf8'),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return {
        v: PAYLOAD_VERSION,
        salt: salt.toString('base64'),
        authHash: authHash.toString('base64'),
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        ct: ciphertext.toString('base64'),
        remainingViews,
        maxViews,
        expiresAt,
    };
}

/**
 * Verify a provided access key against a stored payload and decrypt the text.
 * Throws a tagged error on failure so the handler can map to the right HTTP status.
 *
 * Errors thrown:
 *   { code: 'INVALID_KEY' }    — auth hash mismatch
 *   { code: 'CORRUPT' }        — payload missing fields or AES-GCM auth tag failed
 *   { code: 'UNSUPPORTED' }    — payload version we don't understand
 */
export async function verifyAndDecrypt(payload, accessKey) {
    if (!payload || typeof payload !== 'object') {
        const e = new Error('corrupt'); e.code = 'CORRUPT'; throw e;
    }
    if (payload.v !== PAYLOAD_VERSION) {
        const e = new Error('unsupported version'); e.code = 'UNSUPPORTED'; throw e;
    }
    const required = ['salt', 'authHash', 'iv', 'tag', 'ct'];
    for (const f of required) {
        if (typeof payload[f] !== 'string') {
            const e = new Error('corrupt'); e.code = 'CORRUPT'; throw e;
        }
    }

    let salt, storedAuth, iv, tag, ct;
    try {
        salt = Buffer.from(payload.salt, 'base64');
        storedAuth = Buffer.from(payload.authHash, 'base64');
        iv = Buffer.from(payload.iv, 'base64');
        tag = Buffer.from(payload.tag, 'base64');
        ct = Buffer.from(payload.ct, 'base64');
    } catch {
        const e = new Error('corrupt'); e.code = 'CORRUPT'; throw e;
    }

    const { authHash, encKey } = await deriveBoth(String(accessKey), salt);

    // Constant-time compare. Length check first because timingSafeEqual throws on mismatch.
    if (authHash.length !== storedAuth.length || !crypto.timingSafeEqual(authHash, storedAuth)) {
        const e = new Error('invalid key'); e.code = 'INVALID_KEY'; throw e;
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, iv);
    decipher.setAuthTag(tag);
    let plaintext;
    try {
        plaintext = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
    } catch {
        // GCM auth tag failure — payload tampered with, or key->ciphertext mismatch.
        const e = new Error('corrupt'); e.code = 'CORRUPT'; throw e;
    }
    return plaintext;
}
