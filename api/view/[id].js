function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(400).send('Bad Request');
  }

  // Defensive — id is interpolated below into a JS string only via JSON.stringify,
  // and into the page <title> via escapeHtml. Both are safe.
  const safeIdAttr = escapeHtml(id);
  const safeIdJs = JSON.stringify(id);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="robots" content="noindex, nofollow">
  <title>Secure Message · ${safeIdAttr}</title>
  <style>
    :root {
      --bg: #f5f5f7;
      --card: #ffffff;
      --text: #1c1c1e;
      --muted: #8e8e93;
      --border: #e5e5ea;
      --field: #fafafa;
      --accent: #007aff;
      --danger: #ff3b30;
      --danger-bg: #ffe5e5;
      --term-bg: #111;
      --term-fg: #0f0;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .container {
      width: 100%;
      max-width: 420px;
      background: var(--card);
      padding: 24px;
      border-radius: 20px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.06);
      transition: max-width 0.3s ease;
    }
    .container.wide { max-width: 600px; }
    h2 {
      margin: 0 0 20px;
      font-size: 22px;
      font-weight: 700;
      text-align: center;
    }
    input {
      width: 100%;
      padding: 16px;
      border-radius: 14px;
      border: 1px solid var(--border);
      background: var(--field);
      font-size: 16px;
      font-family: inherit;
      margin-bottom: 16px;
      transition: border-color 0.2s, background 0.2s;
    }
    input:focus {
      outline: none;
      border-color: var(--accent);
      background: #fff;
    }
    button {
      width: 100%;
      padding: 16px;
      border-radius: 14px;
      border: none;
      background: #000;
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.1s;
    }
    button:hover { opacity: 0.85; }
    button:active { transform: scale(0.98); }
    button:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .error {
      color: var(--danger);
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 16px;
      display: none;
      text-align: center;
      background: var(--danger-bg);
      padding: 12px;
      border-radius: 10px;
    }
    .status-text {
      color: var(--muted);
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
      text-align: center;
    }
    .message-box {
      background: var(--term-bg);
      color: var(--term-fg);
      padding: 20px;
      border-radius: 14px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
      font-size: 14px;
      line-height: 1.5;
      overflow-x: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
      box-shadow: inset 0 0 10px rgba(0,0,0,0.5);
      margin: 0;
    }
    .result-view { animation: fadeIn 0.3s ease-out; }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>
  <div class="container" id="authBox">
    <h2>Secure Message</h2>
    <div id="errorMsg" class="error" role="alert"></div>
    <form id="keyForm">
      <input
        id="keyInput"
        type="password"
        placeholder="Enter key"
        required
        inputmode="text"
        autocapitalize="off"
        autocomplete="off"
        spellcheck="false"
      />
      <button type="submit" id="submitBtn">Unlock</button>
    </form>
  </div>

  <script>
    (function () {
      var ID = ${safeIdJs};
      var SEPARATOR = '-------------------';

      var keyInput = document.getElementById('keyInput');
      var keyForm = document.getElementById('keyForm');
      var submitBtn = document.getElementById('submitBtn');
      var errorMsg = document.getElementById('errorMsg');
      var authBox = document.getElementById('authBox');

      window.addEventListener('load', function () { keyInput.focus(); });

      function showError(msg) {
        errorMsg.textContent = msg;
        errorMsg.style.display = 'block';
      }

      function renderResult(text) {
        // Split off the leading "Views remaining: N" status line if present.
        var status = '';
        var body = text;
        var sep = '\\n' + SEPARATOR + '\\n';
        var idx = text.indexOf(sep);
        if (idx !== -1) {
          status = text.slice(0, idx);
          body = text.slice(idx + sep.length);
        }

        // Build new DOM safely — never inject untrusted content as HTML.
        authBox.classList.add('wide');
        authBox.replaceChildren();

        var wrap = document.createElement('div');
        wrap.className = 'result-view';

        var h = document.createElement('h2');
        h.textContent = 'Decrypted Content';
        wrap.appendChild(h);

        if (status) {
          var s = document.createElement('div');
          s.className = 'status-text';
          s.textContent = status;
          wrap.appendChild(s);
        }

        var box = document.createElement('div');
        box.className = 'message-box';
        var pre = document.createElement('pre');
        pre.style.margin = '0';
        pre.style.fontFamily = 'inherit';
        pre.textContent = body.replace(/\\n+$/, '');
        box.appendChild(pre);
        wrap.appendChild(box);

        authBox.appendChild(wrap);
      }

      keyForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        var key = keyInput.value.trim();
        if (!key) return;

        errorMsg.style.display = 'none';
        submitBtn.disabled = true;

        try {
          var res = await fetch('/api/raw/' + encodeURIComponent(ID) + '?key=' + encodeURIComponent(key), {
            cache: 'no-store',
            credentials: 'omit',
          });
          var text = await res.text();

          if (res.ok) {
            renderResult(text);
            return; // form is gone now
          }

          showError((text || 'Error').trim());
          keyInput.value = '';
          keyInput.focus();
        } catch (err) {
          showError('Network error. Please try again.');
        } finally {
          submitBtn.disabled = false;
        }
      });
    })();
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}
