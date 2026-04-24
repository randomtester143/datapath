export default function handler(req, res) {
    const { id } = req.query;
    if (!id) return res.status(400).send('Bad Request');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>View Secure Payload</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 2rem; max-width: 600px; margin: auto; background: #f4f4f5; color: #18181b; }
    .container { background: #fff; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    h2 { margin-top: 0; }
    input, button { width: 100%; padding: 0.75rem; margin-bottom: 1rem; border: 1px solid #e4e4e7; border-radius: 6px; box-sizing: border-box; }
    button { background: #000; color: #fff; border: none; font-weight: 600; cursor: pointer; }
    button:hover { opacity: 0.8; }
    textarea { width: 100%; height: 200px; padding: 1rem; border: 1px solid #e4e4e7; border-radius: 6px; font-family: monospace; box-sizing: border-box; resize: vertical; }
    .warn { color: #d93025; font-size: 0.9rem; font-weight: 600; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Secure Message</h2>
    <div id="auth">
      <input type="password" id="key" placeholder="Enter decryption key">
      <button onclick="reveal()">Decrypt & Read</button>
    </div>
    <div id="result" style="display:none;">
      <p class="warn">This message has been destroyed from the server. Copy it now.</p>
      <textarea id="output" readonly></textarea>
    </div>
  </div>
  <script>
    async function reveal() {
      const key = document.getElementById('key').value;
      if (!key) return alert("Key is required");

      try {
        const res = await fetch('/api/raw/${id}?key=' + encodeURIComponent(key));
        const text = await res.text();
        
        if (res.ok) {
          document.getElementById('auth').style.display = 'none';
          document.getElementById('result').style.display = 'block';
          document.getElementById('output').value = text.trim();
        } else {
          alert(text.trim());
        }
      } catch (e) {
        alert("Failed to communicate with server.");
      }
    }
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
}