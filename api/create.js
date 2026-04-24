import redis from "../lib/redis.js";
import crypto from "crypto";

export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).end();

    const { text, stealth } = req.body;

    if (!text) {
        return res.status(400).json({ error: "No text" });
    }

    if (text.length > 50000) {
        return res.status(400).json({ error: "Too large" });
    }

    const id = crypto.randomBytes(4).toString("hex");

    await redis.set(
        id,
        JSON.stringify({ text, stealth }),
        "EX",
        300 // 5 minutes
    );

    res.json({
        link: `${req.headers.origin}/${id}`,
        raw: `${req.headers.origin}/raw/${id}`
    });
}