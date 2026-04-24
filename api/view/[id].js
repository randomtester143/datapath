import redis from "../../lib/redis.js";

export default async function handler(req, res) {
    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).send("Invalid ID");
        }

        const data = await redis.get(id);

        if (!data) {
            return res.status(404).send("Expired or invalid");
        }

        await redis.del(id);

        if (data.stealth) {
            return res.send(`
        <html>
          <body style="margin:0;">
            <script>
              const text = ${JSON.stringify(data.text)};
              document.addEventListener("click", async () => {
                try {
                  await navigator.clipboard.writeText(text);
                  document.body.innerHTML = "Copied";
                } catch {
                  document.body.innerHTML = "<pre>"+text+"</pre>";
                }
              });
            </script>
          </body>
        </html>
      `);
        }

        res.send(`<pre>${data.text}</pre>`);

    } catch (err) {
        console.error("VIEW ERROR:", err);
        res.status(500).send("Server error");
    }
}