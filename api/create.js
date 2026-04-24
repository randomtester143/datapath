import { redis } from '../lib/redis.js';
import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { text, key, customId, stealth } = req.body;

        if (!text || !key) {
            return res.status(400).send('Missing text or key');
        }

        // Resolve ID
        let id = customId;
        if (id) {
            if (id.length > 5 || !/^[a-zA-Z0-9]+$/.test(id)) {
                return res.status(400).send('Invalid custom ID. Max 5 alphanumeric characters.');
            }
        } else {
            id = crypto.randomBytes(4).toString('hex').slice(0, 6);
        }

        // Hash key server-side
        const keyHash = crypto.createHash('sha256').update(key).digest('hex');
        const ttl = stealth ? 300 : 3600; // 5 minutes or 1 hour

        const payload = JSON.stringify({
            text,
            keyHash,
            mode: 'protected'
        });

        const success = await redis.set(id, payload, { nx: true, ex: ttl });

        if (!success) {
            return res.status(409).send('ID already exists. Try another custom ID.');
        }

        res.status(200).json({ id });
    } catch (err) {
        res.status(500).send('Internal server error');
    }
}