export default function handler(req, res) {
    const { id } = req.query;
    if (!id) return res.status(400).send('Bad Request');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>View Secure Payload</title>
  <style>
    :root { --bg: #f4f4f5; --surface: #ffffff; --text: #18181b; --primary: #000000; --border: #e4e4e7; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); padding: 1rem; margin: 0; display: flex; justify-content: center; }
    .container { background: var(--surface); padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); width: 100%; max-width: 500px; box-sizing: border-box; }
    h2 { margin-top: 0; font-size: 1.5rem; }
    input, button, textarea { width: 100%; padding: 0.875rem; margin-bottom: 1rem; border: 1px solid var(--border); border-radius: 8px; box-sizing: border-box; font-size: 16px; }
    button { background: var(--primary); color: white; border: none; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
    button:hover { opacity: 0.8; }
    textarea { height: 250px; font-family: monospace; resize: vertical; background: #fafafa; }
    .warn { color: #d93025; font-size: 0.9rem; font-weight: 600; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Secure Message</h2>
    <div id="auth">
      <p style="font-size: 0.9rem; margin-bottom: 1rem; color: #52525b;">This message is protected. Enter the key to reveal it.</p>
      <input type="password" id="key" placeholder="Enter access key">
      <button onclick="reveal()">Decrypt & Read</button>
    </div>
    <div id="result" style="display:none;">
      <p class="warn" id="statusMessage"></p>
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
          
          // Parse the terminal format into UI elements
          const parts = text.split('\\n-------------------\\n');
          if (parts.length > 1) {
            document.getElementById('statusMessage').textContent = parts[0];
            document.getElementById('output').value = parts.slice(1).join('\\n-------------------\\n').trim();
          } else {
            document.getElementById('output').value = text.trim();
          }
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