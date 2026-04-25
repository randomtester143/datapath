import { redis } from '../../lib/redis.js';

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send('test with redis\n');
}