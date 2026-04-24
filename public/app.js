async function create() {
    try {
        const text = document.getElementById("text").value.trim();
        const stealth = document.getElementById("stealth").checked;

        if (!text) {
            document.getElementById("result").innerText = "Enter text first";
            return;
        }

        const res = await fetch(`${window.location.origin}/api/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ text, stealth })
        });

        const raw = await res.text();
        console.log("STATUS:", res.status);
        console.log("RESPONSE:", raw);

        if (!res.ok) {
            document.getElementById("result").innerText = "Error: " + raw;
            return;
        }

        const data = JSON.parse(raw);

        document.getElementById("result").innerHTML = `
      <p><b>browser:</b></p>
      <a href="${data.link}" target="_blank">${data.link}</a>

      <p><b>terminal:</b></p>
      <code>${data.raw}</code>
    `;
    } catch (err) {
        console.error(err);
        document.getElementById("result").innerText = "Error: " + err.message;
    }
}