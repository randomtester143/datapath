async function create() {
    try {
        const textEl = document.getElementById("text");
        const stealthEl = document.getElementById("stealth");

        const text = textEl ? textEl.value.trim() : "";
        const stealth = stealthEl ? stealthEl.checked : false;

        if (!text) {
            document.getElementById("result").innerText = "Enter some text first";
            return;
        }

        const res = await fetch("/api/create", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ text, stealth })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || "Request failed");
        }

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