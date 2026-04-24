import { redis } from '../../lib/redis.js';
import crypto from 'crypto';

export default async function handler(req, res) {
    const { id } = req.query;
    if (!id) return res.status(400).send('Bad Request\n');

    const key = req.query.key || req.headers['x-key'];

    // Fetch payload
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

    // Handle Views Logic
    const viewsLeftAfterThis = (data.remainingViews || 1) - 1;

    if (viewsLeftAfterThis <= 0) {
        await redis.del(id);
    } else {
        data.remainingViews = viewsLeftAfterThis;
        await redis.set(id, JSON.stringify(data), { keepttl: true });
    }

    // Format terminal output
    const output = `Views remaining: ${viewsLeftAfterThis}\n-------------------\n${data.text}\n`;

    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send(output);
}