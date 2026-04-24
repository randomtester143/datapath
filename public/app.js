async function create() {
    const text = document.getElementById("text").value;
    const stealth = document.getElementById("stealth").checked;

    const res = await fetch("/api/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, stealth })
    });

    const data = await res.json();

    document.getElementById("result").innerHTML = `
    <p>browser:</p>
    <a href="${data.link}" target="_blank">${data.link}</a>

    <p>terminal:</p>
    <code>${data.raw}</code>
  `;
}