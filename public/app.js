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

        const data = await res.json();

        if (!res.ok) {
            document.getElementById("result").innerText = data.error || "Error";
            return;
        }

        document.getElementById("result").innerHTML = `
      <p><b>Browser link:</b></p>
      <a href="${data.link}" target="_blank">${data.link}</a>

      <p><b>Terminal link:</b></p>
      <code>${data.raw}</code>
    `;

    } catch (err) {
        console.error(err);
        document.getElementById("result").innerText = "Error: " + err.message;
    }
}