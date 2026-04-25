const viewsSlider = document.getElementById("viewsSlider");
const viewsValue = document.getElementById("viewsValue");

viewsSlider.oninput = () => {
    const v = parseInt(viewsSlider.value);
    viewsValue.textContent = v + (v === 1 ? " view" : " views");
};

const expirySlider = document.getElementById("expirySlider");
const expiryValue = document.getElementById("expiryValue");
const expiryPreview = document.getElementById("expiryPreview");

function updateExpiryPreview() {
    const h = parseInt(expirySlider.value);
    expiryValue.textContent = h + (h === 1 ? " hour" : " hours");

    const future = new Date(Date.now() + h * 3600 * 1000);
    const options = { weekday: 'short', hour: 'numeric', minute: '2-digit' };
    expiryPreview.textContent = "Expires " + future.toLocaleDateString(undefined, options);
}

expirySlider.oninput = updateExpiryPreview;
updateExpiryPreview(); // Init on load

document.getElementById('shareBtn').addEventListener('click', async () => {
    const text = document.getElementById('text').value;
    const key = document.getElementById('key').value;
    const customId = document.getElementById('customId').value.trim();
    const maxViews = viewsSlider.value;
    const expiryHours = expirySlider.value;
    const errorBox = document.getElementById('errorBox');

    errorBox.style.display = 'none';

    if (!text) return showError('Input cannot be empty.');
    if (!key) return showError('Access Key is required.');
    if (customId && !/^[a-zA-Z0-9]{1,5}$/.test(customId)) return showError('Custom ID must be 1-5 alphanumeric characters.');

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

    const btn = el.nextElementSibling;
    const originalText = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = originalText; }, 1500);
};