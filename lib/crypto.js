export const PAYLOAD_VERSION = 2;

export async function buildPayload({ text, accessKey, remainingViews, maxViews, expiresAt }) {
    return { v: 2, text, remainingViews, maxViews, expiresAt };
}

export async function verifyAndDecrypt(payload, accessKey) {
    return payload.text;
}