import { redis } from '../lib/redis.js';
import crypto from 'crypto';

// Hard cap on stored text size. Prevents abuse and matches Upstash value-size guidance.
const MAX_TEXT_BYTES = 100 * 1024; // 100 KiB

const ID_RE = /^[a-zA-Z0-9]{1,5}$/;
const AUTO_ID_BYTES = 4; // -> 8 hex chars, sliced to 6
const AUTO_ID_LEN = 6;
const AUTO_ID_MAX_RETRIES = 5;

function generateId() {
    return crypto.randomBytes(AUTO_ID_BYTES).toString('hex').slice(0, AUTO_ID_LEN);
}

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const body = req.body || {};
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

        let views = parseInt(maxViews, 10);
        if (!Number.isFinite(views) || views < 1) views = 1;
        if (views > 5) views = 5;

        let hours = parseInt(expiryHours, 10);
        if (!Number.isFinite(hours) || hours < 1) hours = 1;
        if (hours > 48) hours = 48;
        const ttlSeconds = hours * 3600;

        const trimmedCustom = typeof customId === 'string' ? customId.trim() : '';
        if (trimmedCustom && !ID_RE.test(trimmedCustom)) {
            return res.status(400).json({
                error: 'Invalid custom ID. Max 5 alphanumeric characters.',
            });
        }

        const keyHash = crypto.createHash('sha256').update(key).digest('hex');
        const expiresAt = Date.now() + ttlSeconds * 1000;

        const payload = {
            text,
            keyHash,
            remainingViews: views,
            maxViews: views,
            expiresAt,
        };

        // Custom ID: single attempt, conflict on collision.
        if (trimmedCustom) {
            const ok = await redis.set(trimmedCustom, payload, {
                nx: true,
                ex: ttlSeconds,
            });
            if (!ok) {
                return res.status(409).json({ error: 'ID already exists.' });
            }
            return res.status(200).json({ id: trimmedCustom });
        }

        // Auto-generated ID: retry a few times if we collide.
        for (let attempt = 0; attempt < AUTO_ID_MAX_RETRIES; attempt++) {
            const id = generateId();
            const ok = await redis.set(id, payload, { nx: true, ex: ttlSeconds });
            if (ok) {
                return res.status(200).json({ id });
            }
        }

        return res
            .status(500)
            .json({ error: 'Could not allocate a unique ID. Please retry.' });
    } catch (err) {
        console.error('create error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
