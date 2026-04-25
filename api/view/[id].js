export default function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).send('Bad Request');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Secure Message</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f5f5f7;
      color: #1c1c1e;
      margin: 0;
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      box-sizing: border-box;
    }
    .container {
      width: 100%;
      max-width: 420px;
      background: white;
      padding: 24px;
      border-radius: 20px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.06);
      box-sizing: border-box;
      transition: max-width 0.3s ease;
    }
    h2 {
      margin-top: 0;
      font-size: 22px;
      font-weight: 700;
      text-align: center;
      margin-bottom: 20px;
    }
    input {
      width: 100%;
      padding: 16px;
      border-radius: 14px;
      border: 1px solid #e5e5ea;
      background: #fafafa;
      font-size: 16px;
      box-sizing: border-box;
      font-family: inherit;
      margin-bottom: 16px;
      transition: border-color 0.2s;
    }
    input:focus {
      outline: none;
      border-color: #007aff;
      background: #fff;
    }
    button {
      width: 100%;
      padding: 16px;
      border-radius: 14px;
      border: none;
      background: #000;
      color: white;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.1s;
    }
    button:hover {
      opacity: 0.85;
    }
    button:active {
      transform: scale(0.98);
    }
    .error {
      color: #ff3b30;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 16px;
      display: none;
      text-align: center;
      background: #ffe5e5;
      padding: 12px;
      border-radius: 10px;
    }
    .status-text {
      color: #8e8e93;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
      text-align: center;
    }
    .message-box {
      background: #111;
      color: #0f0;
      padding: 20px;
      border-radius: 14px;
      font-family: monospace;
      font-size: 14px;
      line-height: 1.5;
      overflow-x: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
      margin: 0;
      box-shadow: inset 0 0 10px rgba(0,0,0,0.5);
    }
    .result-view {
      animation: fadeIn 0.3s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
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
        const res = await fetch('/api/raw/' + id + '?key=' + encodeURIComponent(key));
        const text = await res.text();

        if (res.ok) {
          const authBox = document.getElementById('authBox');
          authBox.style.maxWidth = '600px'; 
          
          const parts = text.split('\\n-------------------\\n');
          let displayHtml = '<div class="result-view"><h2>Decrypted Content</h2>';
          
          if (parts.length > 1) {
            displayHtml += '<div class="status-text">' + parts[0] + '</div>';
            displayHtml += '<div class="message-box"><pre id="messageText" style="margin:0; font-family:inherit;"></pre></div></div>';
            authBox.innerHTML = displayHtml;
            document.getElementById('messageText').textContent = parts.slice(1).join('\\n-------------------\\n').trim();
          } else {
            displayHtml += '<div class="message-box"><pre id="messageText" style="margin:0; font-family:inherit;"></pre></div></div>';
            authBox.innerHTML = displayHtml;
            document.getElementById('messageText').textContent = text.trim();
          }
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