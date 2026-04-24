import { redis } from '../../lib/redis.js';

export default async function handler(req, res) {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Bad Request' });

    // Atomically retrieve and delete
    const pipeline = redis.pipeline();
    pipeline.get(id);
    pipeline.del(id);
    const results = await pipeline.exec();
    const data = results[0];

    if (!data) {
        return res.status(404).json({ error: 'Not Found or Already Read' });
    }

    // Returns raw ciphertext because the server lacks the key to decrypt
    res.status(200).json({
        notice: "Zero-knowledge enforcement: Server cannot decrypt. Decrypt this ciphertext locally using the key from the URL hash.",
        ciphertext: data.ciphertext,
        iv: data.iv,
        stealth: data.stealth
    });
}