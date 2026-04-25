import { redis } from '../lib/redis.js';
import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { text, key, customId, maxViews, expiryHours } = req.body;

        if (!text || !key) {
            return res.status(400).json({ error: 'Missing text or key' });
        }

        let views = parseInt(maxViews, 10);
        if (isNaN(views) || views < 1) views = 1;
        if (views > 5) views = 5;

        let hours = parseInt(expiryHours, 10);
        if (isNaN(hours) || hours < 1) hours = 1;
        if (hours > 48) hours = 48;
        const ttlSeconds = hours * 3600;

        let id = customId?.trim();
        if (id) {
            if (id.length > 5 || !/^[a-zA-Z0-9]+$/.test(id)) {
                return res.status(400).json({ error: 'Invalid custom ID. Max 5 alphanumeric characters.' });
            }
        } else {
            id = crypto.randomBytes(4).toString('hex').slice(0, 6);
        }

        const keyHash = crypto.createHash('sha256').update(key).digest('hex');
        const expiresAt = Date.now() + ttlSeconds * 1000;

        const payload = JSON.stringify({
            text,
            keyHash,
            remainingViews: views,
            maxViews: views,
            expiresAt
        });

        const success = await redis.set(id, payload, { nx: true, ex: ttlSeconds });

        if (!success) {
            return res.status(409).json({ error: 'ID already exists' });
        }

        res.status(200).json({ id });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
}