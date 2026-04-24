import redis from "../../lib/redis.js";

export default async function handler(req, res) {
    try {
        const id = req.query.id || req.url.split("/").pop();

        if (!id) {
            return res.status(400).send("Invalid ID");
        }

        const data = await redis.get(id);

        if (!data) {
            return res.status(404).send("Expired or invalid");
        }

        await redis.del(id);

        res.setHeader("Content-Type", "text/plain");
        res.send(data.text);

    } catch (err) {
        console.error("RAW ERROR:", err);
        res.status(500).send("Server error");
    }
}