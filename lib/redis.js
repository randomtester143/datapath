import { Redis } from '@upstash/redis';

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
    // Fail at module load so cold starts surface the misconfig in logs
    // instead of producing confusing 500s on the first real request.
    throw new Error(
        'Missing Upstash Redis credentials: set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.'
    );
}

export const redis = new Redis({ url, token });
