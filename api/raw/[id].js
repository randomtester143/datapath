import { redis } from '../../lib/redis.js';
import { verifyAndDecrypt, PAYLOAD_VERSION } from '../../lib/crypto.js';

function getKey(req) {
    const fromHeader = req.headers['x-key'];
    if (typeof fromHeader === 'string' && fromHeader.length > 0) return fromHeader;
    const fromQuery = req.query.key;
    if (typeof fromQuery === 'string' && fromQuery.length > 0) return fromQuery;
    return null;
}

function normalize(raw) {
    if (raw == null) return null;
    if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return null; } }
    if (typeof raw === 'object') return raw;
    return null;
}

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');

    const { id } = req.query;
    if (!id || typeof id !== 'string') return res.status(400).send('Bad Request\n');

    const key = getKey(req);
    if (!key) return res.status(401).send('Enter key:\n');

    const data = normalize(await redis.get(id));
    if (!data) return res.status(404).send('Not Found\n');

    const remaining = (data.remainingViews || 1) - 1;

    if (remaining <= 0) {
        await redis.del(id);
    } else {
        const ttl = await redis.ttl(id);
        if (ttl > 0) await redis.set(id, { ...data, remainingViews: remaining }, { ex: ttl });
        else await redis.del(id);
    }

    const plaintext = await verifyAndDecrypt(data, key);

    return res.status(200).send(
        `Views remaining: ${remaining}\n-------------------\n${plaintext}\n`
    );
}