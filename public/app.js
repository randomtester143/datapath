(function () {
    'use strict';

    var $ = function (id) { return document.getElementById(id); };

    var els = {
        text: $('text'),
        key: $('key'),
        customId: $('customId'),
        viewsSlider: $('viewsSlider'),
        viewsValue: $('viewsValue'),
        expirySlider: $('expirySlider'),
        expiryValue: $('expiryValue'),
        expiryPreview: $('expiryPreview'),
        shareBtn: $('shareBtn'),
        errorBox: $('errorBox'),
        links: $('links'),
        browserLink: $('browserLink'),
        rawLink: $('rawLink'),
    };

    function plural(n, word) {
        return n + ' ' + word + (n === 1 ? '' : 's');
    }

    function showError(msg) {
        els.errorBox.textContent = msg;
        els.errorBox.style.display = 'block';
    }

    function clearError() {
        els.errorBox.style.display = 'none';
        els.errorBox.textContent = '';
    }

    function updateViewsLabel() {
        var v = parseInt(els.viewsSlider.value, 10);
        if (!Number.isFinite(v)) v = 1;
        els.viewsValue.textContent = plural(v, 'view');
    }

    function updateExpiryLabel() {
        var h = parseInt(els.expirySlider.value, 10);
        if (!Number.isFinite(h)) h = 1;
        els.expiryValue.textContent = plural(h, 'hour');

        var future = new Date(Date.now() + h * 3600 * 1000);
        var opts = { weekday: 'short', hour: 'numeric', minute: '2-digit' };
        // toLocaleString gives both date and time portions per `opts`.
        els.expiryPreview.textContent = 'Expires ' + future.toLocaleString(undefined, opts);
    }

    els.viewsSlider.addEventListener('input', updateViewsLabel);
    els.expirySlider.addEventListener('input', updateExpiryLabel);
    updateViewsLabel();
    updateExpiryLabel();

    var inFlight = false;

    async function submit() {
        if (inFlight) return;

        var text = els.text.value;
        var key = els.key.value;
        var customId = els.customId.value.trim();
        var maxViews = els.viewsSlider.value;
        var expiryHours = els.expirySlider.value;

        clearError();

        if (!text.trim()) return showError('Input cannot be empty.');
        if (!key) return showError('Access Key is required.');
        if (customId && !/^[a-zA-Z0-9]{1,5}$/.test(customId)) {
            return showError('Custom ID must be 1-5 alphanumeric characters.');
        }

        inFlight = true;
        els.shareBtn.disabled = true;
        var originalLabel = els.shareBtn.textContent;
        els.shareBtn.textContent = 'Working...';

        try {
            var res = await fetch('/api/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text, key: key, customId: customId, maxViews: maxViews, expiryHours: expiryHours }),
                cache: 'no-store',
                credentials: 'omit',
            });

            var data;
            try { data = await res.json(); } catch (_) { data = {}; }

            if (!res.ok) {
                throw new Error(data.error || ('Server error (' + res.status + ')'));
            }

            var baseUrl = window.location.origin;
            els.browserLink.value = baseUrl + '/' + data.id;
            els.rawLink.value = baseUrl + '/raw/' + data.id;
            els.links.style.display = 'block';

            // Clear sensitive inputs after success.
            els.text.value = '';
            els.key.value = '';
            els.customId.value = '';
        } catch (e) {
            showError(e && e.message ? e.message : 'Network error.');
        } finally {
            inFlight = false;
            els.shareBtn.disabled = false;
            els.shareBtn.textContent = originalLabel;
        }
    }

    els.shareBtn.addEventListener('click', submit);

    // Copy buttons via event delegation — no inline onclick handlers.
    async function copyFrom(targetId, btn) {
        var input = $(targetId);
        if (!input) return;
        var value = input.value;
        var ok = false;
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(value);
                ok = true;
            }
        } catch (_) { /* fall through */ }

        if (!ok) {
            try {
                input.removeAttribute('readonly');
                input.select();
                input.setSelectionRange(0, value.length);
                ok = document.execCommand('copy');
            } catch (_) {
                ok = false;
            } finally {
                input.setAttribute('readonly', 'readonly');
                if (window.getSelection) window.getSelection().removeAllRanges();
            }
        }

        var original = btn.textContent;
        btn.textContent = ok ? 'Copied!' : 'Failed';
        setTimeout(function () { btn.textContent = original; }, 1500);
    }

    document.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('button[data-copy-target]');
        if (!btn) return;
        copyFrom(btn.getAttribute('data-copy-target'), btn);
    });
})();
