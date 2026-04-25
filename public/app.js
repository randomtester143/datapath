document.getElementById('shareBtn').addEventListener('click', async () => {
    const text = document.getElementById('text').value;
    const key = document.getElementById('key').value;
    const customId = document.getElementById('customId').value.trim();
    const maxViews = document.getElementById('maxViews').value;
    const expiryHours = document.getElementById('expiryHours').value;
    const errorBox = document.getElementById('errorBox');

    errorBox.style.display = 'none';

    if (!text) return showError('Input cannot be empty.');
    if (!key) return showError('Access Key is required.');
    if (customId && !/^[a-zA-Z0-9]{1,5}$/.test(customId)) return showError('Custom ID must be 1-5 alphanumeric characters.');
    if (expiryHours < 1 || expiryHours > 48) return showError('Expiry must be between 1 and 48 hours.');

    try {
        const res = await fetch('/api/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, key, customId, maxViews, expiryHours })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Server error');
        }

        const baseUrl = window.location.origin;

        document.getElementById('browserLink').value = `${baseUrl}/${data.id}`;
        document.getElementById('rawLink').value = `${baseUrl}/raw/${data.id}`;

        document.getElementById('links').style.display = 'block';

        document.getElementById('text').value = '';
        document.getElementById('key').value = '';

    } catch (e) {
        showError(e.message);
    }
});

function showError(msg) {
    const errorBox = document.getElementById('errorBox');
    errorBox.textContent = msg;
    errorBox.style.display = 'block';
}

window.copyToClipboard = function (elementId) {
    const el = document.getElementById(elementId);
    el.select();
    document.execCommand('copy');
};