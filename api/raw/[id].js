import { redis } from '../../lib/redis.js';
import crypto from 'crypto';

// Upstash's JS client auto-serializes objects on `set` and parses JSON on `get`,
// but older records in this project were stored via `JSON.stringify(...)`. To stay
// compatible with both, normalize whatever `get` returns into a plain object.
function normalize(raw) {
    if (raw == null) return null;
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }
    if (typeof raw === 'object') return raw;
    return null;
}

function timingSafeEqualHex(aHex, bHex) {
    if (typeof aHex !== 'string' || typeof bHex !== 'string') return false;
    if (aHex.length !== bHex.length) return false;
    try {
        const a = Buffer.from(aHex, 'hex');
        const b = Buffer.from(bHex, 'hex');
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');

    const { id } = req.query;
    if (!id || typeof id !== 'string') {
        return res.status(400).send('Bad Request\n');
    }

    const key = req.query.key || req.headers['x-key'];

    let raw;
    try {
        raw = await redis.get(id);
    } catch (err) {
        console.error('raw get error:', err);
        return res.status(500).send('Internal server error\n');
    }

    const data = normalize(raw);
    if (!data) {
        return res.status(404).send('Not Found or Already Read\n');
    }

    if (!key) {
        return res.status(401).send('Enter key:\n');
    }

    const providedHash = crypto
        .createHash('sha256')
        .update(String(key))
        .digest('hex');

    if (!timingSafeEqualHex(providedHash, data.keyHash)) {
        return res.status(403).send('Invalid key\n');
    }

    const remainingBefore = Number.isFinite(data.remainingViews)
        ? data.remainingViews
        : 1;
    const remainingAfter = remainingBefore - 1;

    // Persist the new view count (or delete) BEFORE returning the content.
    // Use a pipeline so TTL fetch + write happen back-to-back, narrowing the
    // window for races with concurrent reads or expiry.
    try {
        if (remainingAfter <= 0) {
            await redis.del(id);
        } else {
            const ttl = await redis.ttl(id);
            // ttl: -2 => key gone, -1 => no expiry set, >=0 => seconds left.
            if (ttl === -2) {
                // Already expired between get and ttl — treat as gone.
                return res.status(404).send('Not Found or Already Read\n');
            }
            const updated = { ...data, remainingViews: remainingAfter };
            if (ttl > 0) {
                await redis.set(id, updated, { ex: ttl });
            } else {
                // ttl === -1 (shouldn't happen — we always set ex on create — but
                // guard anyway so we don't accidentally drop the existing TTL).
                await redis.set(id, updated);
            }
        }
    } catch (err) {
        console.error('raw write error:', err);
        return res.status(500).send('Internal server error\n');
    }

    const output =
        `Views remaining: ${remainingAfter}\n` +
        `-------------------\n` +
        `${data.text}\n`;

    return res.status(200).send(output);
}
