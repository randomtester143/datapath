import redis from "../../lib/redis.js";

export default async function handler(req, res) {
    const { id } = req.query;

    const data = await redis.get(id);

    if (!data) {
        return res.status(404).send("Expired or invalid");
    }

    await redis.del(id);

    if (data.stealth) {
        return res.send(`
      <html>
        <body style="margin:0;background:#fff;">
          <script>
            const text = ${JSON.stringify(data.text)};
            document.addEventListener("click", async () => {
              try {
                await navigator.clipboard.writeText(text);
                document.body.innerHTML = "<div style='text-align:center;margin-top:40vh;font-family:sans-serif;'>Copied</div>";
              } catch {
                document.body.innerHTML = "<pre>"+text+"</pre>";
              }
            });
          </script>
        </body>
      </html>
    `);
    }

    res.send(`
    <html>
      <body style="padding:40px;font-family:sans-serif;">
        <pre>${data.text}</pre>
      </body>
    </html>
  `);
}