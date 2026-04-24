// Utility: Convert ArrayBuffer to Base64 safely without call stack limits
function bufferToBase64(buf) {
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

document.getElementById('shareBtn').addEventListener('click', async () => {
    const text = document.getElementById('text').value;
    if (!text) return alert('Input cannot be empty.');
    const stealth = document.getElementById('stealth').checked;

    try {
        // 1. Generate AES-GCM Key
        const key = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt']
        );
        const exportedKey = await crypto.subtle.exportKey('raw', key);
        const base64Key = bufferToBase64(exportedKey);

        // 2. Encrypt Payload
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encodedText = new TextEncoder().encode(text);
        const ciphertextBuffer = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            encodedText
        );

        const base64Ciphertext = bufferToBase64(ciphertextBuffer);
        const base64Iv = bufferToBase64(iv);

        // 3. Store Ciphertext
        const res = await fetch('/api/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ciphertext: base64Ciphertext, iv: base64Iv, stealth })
        });

        if (!res.ok) throw new Error('Server rejected payload');
        const { id } = await res.json();

        // 4. Expose Links
        const baseUrl = window.location.origin;
        document.getElementById('browserLink').value = `${baseUrl}/${id}#${base64Key}`;
        document.getElementById('rawLink').value = `${baseUrl}/raw/${id}#${base64Key}`;

        document.getElementById('links').style.display = 'block';
        document.getElementById('text').value = '';

    } catch (e) {
        console.error(e);
        alert('Encryption or sharing failed. Check console.');
    }
});

window.copyToClipboard = function (elementId) {
    const el = document.getElementById(elementId);
    el.select();
    document.execCommand('copy');
};