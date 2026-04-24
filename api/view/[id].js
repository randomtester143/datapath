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
    :root { --bg: #f4f4f5; --surface: #ffffff; --text: #18181b; --primary: #000000; --border: #e4e4e7; --error: #d93025; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
      background: var(--bg); 
      color: var(--text); 
      margin: 0; 
      display: flex; 
      justify-content: center; 
      align-items: center;
      min-height: 100vh;
      padding: 1rem;
      box-sizing: border-box;
    }
    .container { 
      background: var(--surface); 
      padding: 2rem; 
      border-radius: 12px; 
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); 
      width: 100%; 
      max-width: 400px; 
      box-sizing: border-box; 
    }
    h2 { margin-top: 0; font-size: 1.5rem; margin-bottom: 1rem; text-align: center; }
    input, button { 
      width: 100%; 
      padding: 12px; 
      margin-bottom: 12px; 
      border: 1px solid var(--border); 
      border-radius: 8px; 
      box-sizing: border-box; 
      font-size: 16px; 
    }
    input { background: #fff; }
    button { 
      background: var(--primary); 
      color: white; 
      border: none; 
      font-weight: 600; 
      cursor: pointer; 
      transition: opacity 0.2s; 
    }
    button:hover { opacity: 0.8; }
    .error { color: var(--error); font-size: 0.9rem; font-weight: 600; margin-bottom: 1rem; display: none; text-align: center; }
    pre {
      background: var(--bg);
      padding: 1rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: monospace;
      font-size: 14px;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="container" id="authBox">
    <h2>Secure Message</h2>
    <div id="errorMsg" class="error"></div>
    <form id="keyForm">
      <input 
        id="keyInput" 
        type="password" 
        placeholder="Enter key" 
        required 
        inputmode="text" 
        autocapitalize="off" 
        autocomplete="off" 
      />
      <button type="submit">Unlock</button>
    </form>
  </div>

  <script>
    window.onload = () => {
      document.getElementById("keyInput").focus();
    };

    document.getElementById("keyForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const errorMsg = document.getElementById("errorMsg");
      const keyInput = document.getElementById("keyInput");
      const key = keyInput.value.trim();
      
      if (!key) return;
      errorMsg.style.display = 'none';

      try {
        const id = window.location.pathname.split("/").pop();
        const res = await fetch('/raw/' + id + '?key=' + encodeURIComponent(key));
        const text = await res.text();

        if (res.ok) {
          const authBox = document.getElementById('authBox');
          authBox.style.maxWidth = '600px'; 
          
          // Replace form with exact terminal output, safely injected
          authBox.innerHTML = '<h2>Decrypted Content</h2><pre id="output"></pre>';
          document.getElementById('output').textContent = text.trim();
        } else {
          errorMsg.textContent = text.trim();
          errorMsg.style.display = 'block';
          keyInput.value = '';
          keyInput.focus();
        }
      } catch (err) {
        errorMsg.textContent = "Network error. Please try again.";
        errorMsg.style.display = 'block';
      }
    });
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
}