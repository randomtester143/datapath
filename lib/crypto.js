import crypto from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(crypto.scrypt);

const SCRYPT_N = 1 << 13;
const SCRYPT_r = 8;
const SCRYPT_p = 1;
const SCRYPT_OPTS = { N: SCRYPT_N, r: SCRYPT_r, p: SCRYPT_p, maxmem: 32 * 1024 * 1024 };

const AUTH_KEY_BYTES = 32;
const ENC_KEY_BYTES = 32;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const SALT_AUTH_LABEL = Buffer.from('datapath:auth:v2');
const SALT_ENC_LABEL = Buffer.from('datapath:enc:v2');

export const PAYLOAD_VERSION = 2;

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

export async function buildPayload({ text, accessKey, remainingViews, maxViews, expiresAt }) {
    const salt = crypto.randomBytes(SALT_BYTES);
    const { authHash, encKey } = await deriveBoth(accessKey, salt);
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
    const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
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
    const salt = Buffer.from(payload.salt, 'base64');
    const storedAuth = Buffer.from(payload.authHash, 'base64');
    const iv = Buffer.from(payload.iv, 'base64');
    const tag = Buffer.from(payload.tag, 'base64');
    const ct = Buffer.from(payload.ct, 'base64');
    const { authHash, encKey } = await deriveBoth(String(accessKey), salt);
    if (authHash.length !== storedAuth.length || !crypto.timingSafeEqual(authHash, storedAuth)) {
        const e = new Error('invalid key'); e.code = 'INVALID_KEY'; throw e;
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, iv);
    decipher.setAuthTag(tag);
    try {
        return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
    } catch {
        const e = new Error('corrupt'); e.code = 'CORRUPT'; throw e;
    }
}