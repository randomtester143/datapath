document.getElementById('shareBtn').addEventListener('click', async () => {
    const text = document.getElementById('text').value;
    const key = document.getElementById('key').value;
    const customId = document.getElementById('customId').value.trim();
    const stealth = document.getElementById('stealth').checked;

    if (!text) return alert('Input cannot be empty.');
    if (!key) return alert('Access Key is required.');
    if (customId && !/^[a-zA-Z0-9]{1,5}$/.test(customId)) return alert('Custom ID must be 1-5 alphanumeric characters.');

    try {
        const res = await fetch('/api/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, key, customId, stealth })
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText);
        }

        const { id } = await res.json();
        const baseUrl = window.location.origin;

        document.getElementById('browserLink').value = `${baseUrl}/${id}`;
        document.getElementById('rawLink').value = `${baseUrl}/raw/${id}`;

        document.getElementById('links').style.display = 'block';

        // Clear sensitive fields
        document.getElementById('text').value = '';
        document.getElementById('key').value = '';

    } catch (e) {
        console.error(e);
        alert(`Creation failed: ${e.message}`);
    }
});

window.copyToClipboard = function (elementId) {
    const el = document.getElementById(elementId);
    el.select();
    document.execCommand('copy');
};