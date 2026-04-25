import { redis } from '../lib/redis.js';
import { buildPayload } from '../lib/crypto.js';
import { rateLimit, clientIp } from '../lib/ratelimit.js';
import crypto from 'crypto';

// Hard cap on stored text size. Enforced both at the body-parser boundary
// (so we don't burn CPU parsing huge JSON) and after parse (defense in depth).
const MAX_TEXT_BYTES = 100 * 1024; // 100 KiB

// Tell Vercel's parser to refuse oversized bodies before we ever see them.
// Slightly larger than MAX_TEXT_BYTES to allow for JSON envelope overhead.
export const config = {
    api: {
        bodyParser: { sizeLimit: '120kb' },
    },
};

const ID_RE = /^[a-zA-Z0-9]{1,5}$/;
const AUTO_ID_BYTES = 4;
const AUTO_ID_LEN = 8;             // 8 hex chars = 4.2B namespace, ~no collisions in practice
const AUTO_ID_MAX_RETRIES = 8;

const CREATE_RATE_LIMIT = { limit: 30, windowSeconds: 60 }; // 30 creates / min / IP

function generateId() {
    return crypto.randomBytes(AUTO_ID_BYTES).toString('hex').slice(0, AUTO_ID_LEN);
}

function strictNumber(value, { min, max, fallback }) {
    // Reject things like "3abc", null, undefined, NaN, booleans, etc.
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return fallback;
    } else if (typeof value === 'string') {
        if (!/^-?\d+$/.test(value.trim())) return fallback;
    } else {
        return fallback;
    }
    let n = Math.trunc(Number(value));
    if (!Number.isFinite(n)) return fallback;
    if (n < min) n = min;
    if (n > max) n = max;
    return n;
}

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Per-IP rate limit. Best-effort: failures here should not block creates.
    try {
        const ip = clientIp(req);
        const rl = await rateLimit({
            route: 'create',
            identifier: ip,
            limit: CREATE_RATE_LIMIT.limit,
            windowSeconds: CREATE_RATE_LIMIT.windowSeconds,
        });
        if (!rl.ok) {
            res.setHeader('Retry-After', String(rl.retryAfterSeconds));
            return res.status(429).json({ error: 'Too many requests. Slow down.' });
        }
    } catch (err) {
        // Don't fail-closed on rate-limiter errors; log and continue.
        console.error('create rate-limit error:', err);
    }

    try {
        // Body parser may have given us an object (good) or a string (Content-Type mismatch).
        const body = (req.body && typeof req.body === 'object' && !Array.isArray(req.body))
            ? req.body
            : null;
        if (!body) {
            return res.status(400).json({ error: 'Invalid request body. Send JSON.' });
        }

        const { text, key, customId, maxViews, expiryHours } = body;

        if (typeof text !== 'string' || !text.trim()) {
            return res.status(400).json({ error: 'Input cannot be empty.' });
        }
        if (typeof key !== 'string' || !key) {
            return res.status(400).json({ error: 'Access key is required.' });
        }
        if (Buffer.byteLength(text, 'utf8') > MAX_TEXT_BYTES) {
            return res.status(413).json({ error: 'Text is too large.' });
        }
        // Reasonable lower bound on key length to discourage trivial brute-force.
        // Combined with scrypt this is mostly belt-and-braces.
        if (key.length < 4) {
            return res.status(400).json({ error: 'Access key must be at least 4 characters.' });
        }

        const views = strictNumber(maxViews, { min: 1, max: 5, fallback: 1 });
        const hours = strictNumber(expiryHours, { min: 1, max: 48, fallback: 1 });
        const ttlSeconds = hours * 3600;

        const trimmedCustom = typeof customId === 'string' ? customId.trim() : '';
        if (trimmedCustom && !ID_RE.test(trimmedCustom)) {
            return res.status(400).json({
                error: 'Invalid custom ID. Max 5 alphanumeric characters.',
            });
        }

        const expiresAt = Date.now() + ttlSeconds * 1000;
        const payload = await buildPayload({
            text,
            accessKey: key,
            remainingViews: views,
            maxViews: views,
            expiresAt,
        });

        // Custom ID: single attempt, conflict on collision.
        if (trimmedCustom) {
            // Upstash returns "OK" on success and null on NX-failure.
            const ok = await redis.set(trimmedCustom, payload, { nx: true, ex: ttlSeconds });
            if (ok !== 'OK') {
                return res.status(409).json({ error: 'ID already exists.' });
            }
            return res.status(200).json({ id: trimmedCustom });
        }

        // Auto-generated ID: retry a few times if we collide.
        for (let attempt = 0; attempt < AUTO_ID_MAX_RETRIES; attempt++) {
            const id = generateId();
            const ok = await redis.set(id, payload, { nx: true, ex: ttlSeconds });
            if (ok === 'OK') {
                return res.status(200).json({ id });
            }
        }

        return res.status(500).json({
            error: 'Could not allocate a unique ID. Please retry.',
        });
    } catch (err) {
        console.error('create error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
