import { redis } from '../../lib/redis.js';
import { verifyAndDecrypt, PAYLOAD_VERSION } from '../../lib/crypto.js';

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send('alive with crypto\n');
}