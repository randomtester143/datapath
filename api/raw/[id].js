import redis from "../../lib/redis.js";

export default async function handler(req, res) {
    const { id } = req.query;

    const data = await redis.get(id);

    if (!data) {
        return res.status(404).send("Expired or invalid");
    }

    await redis.del(id);

    const parsed = JSON.parse(data);

    res.setHeader("Content-Type", "text/plain");
    res.send(parsed.text);
}