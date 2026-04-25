-- lib/decrement.lua
--
-- Atomic "claim a view" against a Datapath secret.
--
-- KEYS[1] = secret id
-- ARGV[1] = expected payload version (string)
--
-- Returns one of:
--   { 'gone' }                           — key missing or expired
--   { 'corrupt' }                        — JSON parse failed or wrong version or no TTL
--   { 'ok', remainingAfter, payload }    — claim successful; returns the FRESH stored
--                                         payload (with remainingViews already decremented)
--                                         so the caller can verify the access key against
--                                         the same record that was just claimed.
--
-- Why this script exists:
--   The previous implementation did GET → TTL → SET/DEL across three HTTP calls.
--   Two concurrent readers could both see remainingViews=1 and both succeed,
--   breaking the max-views guarantee. This script collapses the read-modify-write
--   into a single atomic Redis operation.
--
-- Important: this script claims the view BEFORE the access key is verified.
-- That is the correct ordering for a one-time-secret system: the alternative
-- (verify, then claim) reintroduces the race. A wrong-key request will still
-- consume a view here. That is an acceptable trade — it converts a correctness
-- bug into a minor abuse vector that rate limiting handles. See raw/[id].js
-- for the full reasoning and the rate-limit hookup.

local raw = redis.call('GET', KEYS[1])
if not raw then
    return { 'gone' }
end

local ok, payload = pcall(cjson.decode, raw)
if not ok or type(payload) ~= 'table' then
    return { 'corrupt' }
end

if tostring(payload.v) ~= ARGV[1] then
    return { 'corrupt' }
end

local remaining = tonumber(payload.remainingViews) or 0
remaining = remaining - 1

if remaining <= 0 then
    redis.call('DEL', KEYS[1])
    payload.remainingViews = 0
    return { 'ok', 0, cjson.encode(payload) }
end

-- Preserve the existing TTL. PTTL returns -2 if missing, -1 if no expiry.
-- We refuse to write back without a TTL: a Datapath secret without expiry is a bug.
local pttl = redis.call('PTTL', KEYS[1])
if pttl == -2 then
    return { 'gone' }
end
if pttl < 0 then
    -- No TTL set — treat the record as corrupt and delete it. Better to lose
    -- one secret than to leak it forever.
    redis.call('DEL', KEYS[1])
    return { 'corrupt' }
end

payload.remainingViews = remaining
local encoded = cjson.encode(payload)
redis.call('SET', KEYS[1], encoded, 'PX', pttl)
return { 'ok', remaining, encoded }
