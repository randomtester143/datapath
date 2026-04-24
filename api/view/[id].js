import { redis } from '../../lib/redis.js';

export default async function handler(req, res) {
    const { id } = req.query;
    if (!id) return res.status(400).send('Bad Request');

    // Atomically retrieve and delete to guarantee read-once execution
    const pipeline = redis.pipeline();
    pipeline.get(id);
    pipeline.del(id);
    const results = await pipeline.exec();
    const data = results[0];

    if (!data) {
        return res.status(404).send('<!DOCTYPE html><html><body><h2 style="font-family: sans-serif; color: #d93025; padding: 2rem;">404 - Not Found or Already Read</h2></body></html>');
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>View Secure Payload</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 2rem; max-width: 600px; margin: auto; background: #f4f4f5; color: #18181b; }
    h2 { margin-top: 0; }
    textarea { width: 100%; height: 250px; padding: 1rem; border: 1px solid #e4e4e7; border-radius: 8px; font-family: monospace; background: #fff; box-sizing: border-box; resize: vertical; }
    .warn { color: #d93025; font-size: 0.9rem; font-weight: 600; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <h2>Decrypted Content</h2>
  <p class="warn">This message has been destroyed from the server. Copy it now.</p>
  <textarea id="output" readonly>Decrypting...</textarea>
  <script>
    async function decrypt() {
      try {
        const hash = window.location.hash.substring(1);
        if (!hash) throw new Error("Missing decryption key in URL fragment");
        
        const rawKey = Uint8Array.from(atob(hash), c => c.charCodeAt(0));
        const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', true, ['decrypt']);
        
        const iv = Uint8Array.from(atob("${data.iv}"), c => c.charCodeAt(0));
        const ciphertext = Uint8Array.from(atob("${data.ciphertext}"), c => c.charCodeAt(0));
        
        const decryptedBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
        document.getElementById('output').value = new TextDecoder().decode(decryptedBuffer);
      } catch (e) {
        document.getElementById('output').value = "Decryption failed. The key is invalid or missing.";
        console.error(e);
      }
    }
    decrypt();
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
}