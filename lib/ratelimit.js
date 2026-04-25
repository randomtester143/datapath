// lib/ratelimit.js
//
// Tiny fixed-window rate limiter. Good enough for a serverless paste tool —
// not trying to be a full sliding-window implementation. The window is per
// (route, identifier), keyed in the same Redis we already use.
//
// Returns { ok, remaining, retryAfterSeconds }.

import { redis } from './redis.js';

export async function rateLimit({ route, identifier, limit, windowSeconds }) {
    const key = `rl:${route}:${identifier}`;
    // Pipeline INCR + EXPIRE NX in one roundtrip. EXPIRE only sets TTL if the
    // key was just created (i.e., this is the first hit of the window).
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, windowSeconds, 'NX');
    const [count] = await pipeline.exec();

    const used = Number(count) || 0;
    if (used > limit) {
        const ttl = await redis.ttl(key);
        return {
            ok: false,
            remaining: 0,
            retryAfterSeconds: Math.max(1, ttl > 0 ? ttl : windowSeconds),
        };
    }
    return { ok: true, remaining: Math.max(0, limit - used), retryAfterSeconds: 0 };
}

/**
 * Best-effort client IP extraction. Vercel sets x-forwarded-for; trust the
 * leftmost entry. Falls back to a constant so the limiter still works locally.
 */
export function clientIp(req) {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length > 0) {
        return xff.split(',')[0].trim();
    }
    const real = req.headers['x-real-ip'];
    if (typeof real === 'string' && real.length > 0) return real;
    return 'unknown';
}
