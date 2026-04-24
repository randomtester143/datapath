import { redis } from '../lib/redis.js';
import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { ciphertext, iv, stealth } = req.body;
        if (!ciphertext || !iv) return res.status(400).json({ error: 'Missing encryption payload' });

        const id = crypto.randomBytes(6).toString('hex');
        const ttl = stealth ? 300 : 3600; // 5 minutes or 1 hour

        const payload = JSON.stringify({ ciphertext, iv, stealth });
        const success = await redis.set(id, payload, { nx: true, ex: ttl });

        if (!success) throw new Error('Collision or Redis failure');

        res.status(200).json({ id });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
}