import redis from "../../lib/redis.js";

export default async function handler(req, res) {
    const { id } = req.query;

    const data = await redis.get(id);

    if (!data) return res.status(404).send("Expired or invalid");

    await redis.del(id);

    if (data.stealth) {
        return res.send(`
      <html>
        <body style="margin:0;">
          <script>
            const text = ${JSON.stringify(data.text)};
            document.addEventListener("click", async () => {
              await navigator.clipboard.writeText(text);
              document.body.innerHTML = "Copied";
            });
          </script>
        </body>
      </html>
    `);
    }

    res.send(`<pre>${data.text}</pre>`);
}