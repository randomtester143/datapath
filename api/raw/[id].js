import { redis } from '../../lib/redis.js';
import { verifyAndDecrypt, PAYLOAD_VERSION } from '../../lib/crypto.js';
import { rateLimit, clientIp } from '../../lib/ratelimit.js';

const DECREMENT_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then return { 'gone' } end
local ok, payload = pcall(cjson.decode, raw)
if not ok or type(payload) ~= 'table' then return { 'corrupt' } end
if tostring(payload.v) ~= ARGV[1] then return { 'corrupt' } end
local remaining = tonumber(payload.remainingViews) or 0
remaining = remaining - 1
if remaining <= 0 then
  redis.call('DEL', KEYS[1])
  payload.remainingViews = 0
  return { 'ok', 0, cjson.encode(payload) }
end
local pttl = redis.call('PTTL', KEYS[1])
if pttl == -2 then return { 'gone' } end
if pttl < 0 then
  redis.call('DEL', KEYS[1])
  return { 'corrupt' }
end
payload.remainingViews = remaining
local encoded = cjson.encode(payload)
redis.call('SET', KEYS[1], encoded, 'PX', pttl)
return { 'ok', remaining, encoded }
`;

const READ_RATE_LIMIT = { limit: 60, windowSeconds: 60 };

function getKey(req) {
    const fromHeader = req.headers['x-key'];
    if (typeof fromHeader === 'string' && fromHeader.length > 0) return fromHeader;
    const fromQuery = req.query.key;
    if (typeof fromQuery === 'string' && fromQuery.length > 0) return fromQuery;
    return null;
}

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');

    const { id } = req.query;
    if (!id || typeof id !== 'string') {
        return res.status(400).send('Bad Request\n');
    }

    try {
        const rl = await rateLimit({
            route: 'raw',
            identifier: clientIp(req),
            limit: READ_RATE_LIMIT.limit,
            windowSeconds: READ_RATE_LIMIT.windowSeconds,
        });
        if (!rl.ok) {
            res.setHeader('Retry-After', String(rl.retryAfterSeconds));
            return res.status(429).send('Too many requests. Slow down.\n');
        }
    } catch (err) {
        console.error('raw rate-limit error:', err);
    }

    const key = getKey(req);
    if (!key) {
        return res.status(401).send('Enter key:\n');
    }

    let claim;
    try {
        claim = await redis.eval(
            DECREMENT_LUA,
            [String(id)],
            [String(PAYLOAD_VERSION)]
        );
    } catch (err) {
        console.error('raw eval error:', err.message, err.stack);
        return res.status(500).send('Internal server error\n');
    }

    if (!Array.isArray(claim) || claim.length === 0) {
        return res.status(500).send('Internal server error\n');
    }

    const status = claim[0];
    if (status === 'gone') {
        return res.status(404).send('Not Found or Already Read\n');
    }
    if (status === 'corrupt') {
        return res.status(410).send('This secret is no longer valid. Please regenerate.\n');
    }
    if (status !== 'ok') {
        return res.status(500).send('Internal server error\n');
    }

    const remainingAfter = Number(claim[1]) || 0;
    const payloadJson = claim[2];

    let payload;
    try {
        payload = JSON.parse(payloadJson);
    } catch {
        return res.status(500).send('Internal server error\n');
    }

    if (typeof payload.expiresAt === 'number' && Date.now() > payload.expiresAt) {
        try { await redis.del(id); } catch { }
        return res.status(404).send('Not Found or Already Read\n');
    }

    let plaintext;
    try {
        plaintext = await verifyAndDecrypt(payload, key);
    } catch (err) {
        if (err && err.code === 'INVALID_KEY') {
            return res.status(403).send('Invalid key\n');
        }
        if (err && err.code === 'UNSUPPORTED') {
            return res.status(410).send('This secret is no longer valid. Please regenerate.\n');
        }
        console.error('raw decrypt error:', err);
        return res.status(500).send('Internal server error\n');
    }

    const output =
        `Views remaining: ${remainingAfter}\n` +
        `-------------------\n` +
        `${plaintext}\n`;

    return res.status(200).send(output);
}