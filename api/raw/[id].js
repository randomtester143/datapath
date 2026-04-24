import { redis } from '../../lib/redis.js';
import crypto from 'crypto';

export default async function handler(req, res) {
    const { id } = req.query;
    if (!id) return res.status(400).send('Bad Request\n');

    const key = req.query.key || req.headers['x-key'];

    // Fetch payload (do not delete yet to prevent unauthenticated data destruction)
    const data = await redis.get(id);

    if (!data) {
        return res.status(404).send('Not Found or Already Read\n');
    }

    // Handle missing key
    if (!key) {
        return res.status(401).send('Enter key:\n');
    }

    // Validate key
    const providedHash = crypto.createHash('sha256').update(key).digest('hex');

    if (providedHash !== data.keyHash) {
        return res.status(403).send('Invalid key\n');
    }

    // Key is correct: execute read-once destruction
    await redis.del(id);

    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send(data.text + '\n');
}