import redis from "../lib/redis.js";
import crypto from "crypto";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).end();
    }

    let body = req.body;
    if (typeof body === "string") {
        try {
            body = JSON.parse(body);
        } catch {
            return res.status(400).json({ error: "Invalid JSON" });
        }
    }

    const { text, stealth } = body || {};

    if (!text) {
        return res.status(400).json({ error: "No text" });
    }

    if (text.length > 50000) {
        return res.status(400).json({ error: "Too large" });
    }

    const id = crypto.randomBytes(4).toString("hex");

    await redis.set(id, { text, stealth }, { ex: 300 }); // 5 min

    res.json({
        link: `${req.headers.origin}/${id}`,
        raw: `${req.headers.origin}/raw/${id}`
    });
}