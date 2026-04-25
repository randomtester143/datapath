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

const READ_RATE_LIMIT = { limit: 60, windowSeconds: 60 }; // 60 reads / min / IP

function getKey(req) {
    // Prefer the header — it doesn't end up in browser history or logs.
    // Fall back to ?key= so existing curl users keep working.
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

    // Per-IP rate limit — protects against brute-force key guessing and
    // ID enumeration. Same-handler limit covers both the GET-key-prompt
    // path and the actual claim, since both touch this endpoint.
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
        // Don't claim a view just to ask for the key. The Lua script is the
        // claim point — we only run it once we have a key to try.
        return res.status(401).send('Enter key:\n');
    }

    // Atomic claim: GET → decrement → SET-with-preserved-PTTL or DEL, all in
    // one Redis roundtrip. Eliminates the original GET/TTL/SET race.
    //
    // Trade-off discussion (read this before "fixing"):
    //   The script claims the view BEFORE we verify the access key. This means
    //   a wrong-key request still consumes a view. The alternative — verify
    //   first, then claim — reintroduces the race the script exists to prevent.
    //   We accept the wrong-key-burns-a-view behavior and rate-limit /raw/:id
    //   to keep abuse cheap.
    //
    //   In practice, legitimate users hit the right key on the first try (they
    //   have it). Attackers who guess keys are exactly who we want to feel the
    //   cost of a consumed view + a rate-limit hit.
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
        // Shouldn't happen — Lua always returns a tagged array.
        return res.status(500).send('Internal server error\n');
    }

    const status = claim[0];
    if (status === 'gone') {
        return res.status(404).send('Not Found or Already Read\n');
    }
    if (status === 'corrupt') {
        // Either an unsupported old-format record, or stored data we couldn't
        // parse. Tell the user to regenerate without leaking why.
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

    // Defense in depth: if the stored expiresAt has passed, refuse even if
    // Redis somehow still has the record. Should never trip in practice
    // because TTL handles it, but cheap to enforce.
    if (typeof payload.expiresAt === 'number' && Date.now() > payload.expiresAt) {
        // Best-effort cleanup; ignore failure.
        try { await redis.del(id); } catch { /* ignore */ }
        return res.status(404).send('Not Found or Already Read\n');
    }

    // Decrypt and verify the access key. The view has already been claimed.
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
