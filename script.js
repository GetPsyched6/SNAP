(() => {
    "use strict";

    // Theme Toggle Logic
    const themeToggle = document.getElementById("themeToggle");
    const body = document.body;
    const savedTheme = localStorage.getItem("theme") || "dark";

    body.setAttribute("data-theme", savedTheme);
    updateThemeToggle(savedTheme);

    function updateThemeToggle(theme) {
        const icon = themeToggle.querySelector(".theme-toggle-icon");
        const label = themeToggle.querySelector(".theme-toggle-label");
        if (theme === "light") {
            icon.textContent = "☀️";
            label.textContent = "Light";
        } else {
            icon.textContent = "🌙";
            label.textContent = "Dark";
        }
    }

    themeToggle.addEventListener("click", () => {
        const current = body.getAttribute("data-theme");
        const next = current === "dark" ? "light" : "dark";
        body.setAttribute("data-theme", next);
        localStorage.setItem("theme", next);
        updateThemeToggle(next);
    });

    const bulkForm = document.getElementById("bulkForm");
    const bulkClear = document.getElementById("bulkClear");
    const addrList = document.getElementById("addrList");
    const cards = document.getElementById("cards");

    const enc = (s) => encodeURIComponent(s).replace(/%20/g, "+");
    const escapeHTML = (s) => s.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

    function openGoogleMaps(q) {
        window.open(`https://www.google.com/maps/search/?api=1&query=${enc(q)}`, "_blank", "noopener");
    }
    function openUSPSWebsite() {
        window.open("https://tools.usps.com/zip-code-lookup.htm?byaddress", "_blank", "noopener");
    }

    async function geocodeAddress(q) {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`, {
            headers: { "Accept": "application/json" }
        });
        if (!r.ok) throw new Error(`Geocode ${r.status}`);
        const j = await r.json();
        if (!Array.isArray(j) || !j.length) throw new Error("No match");
        return { lat: j[0].lat, lon: j[0].lon };
    }

    function openHereWeGoByCoords(lat, lon, zoom = 17, targetWin) {
        const url = `https://wego.here.com/l/${lat},${lon},${zoom}?map=${lat},${lon},${zoom},normal`;
        if (targetWin && !targetWin.closed) targetWin.location = url;
        else window.open(url, "_blank", "noopener");
    }

    function makeCard(address, idx) {
        const wrap = document.createElement("div");
        wrap.className = "card-line";
        wrap.innerHTML = `
      <div class="line-row">
        <span class="addr">${escapeHTML(address)}</span>
        <div class="spacer"></div>
        <button class="btn go" data-addr="${encodeURIComponent(address)}">Go</button>
      </div>
      <div class="usps-slab" id="usps-${idx}">USPS: (pending)</div>
    `;
        return wrap;
    }

    function setUSPSState(el, state) {
        if (!el) return;
        el.classList.remove('ok', 'err');
        if (state) el.classList.add(state);
    }

    // Auto-detect API base: use local server in development, Netlify functions in production
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE = isLocalhost ? 'http://localhost:5501/api' : '/api';

    async function uspsStandardizeLine(addressLine) {
        const r = await fetch(`${API_BASE}/usps/standardize-line`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addressLine })
        });
        const text = await r.text();
        return JSON.parse(text);
    }

    async function uspsRetry(fields) {
        const r = await fetch(`${API_BASE}/usps/retry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fields)
        });
        const text = await r.text();
        return JSON.parse(text);
    }

    function renderUSPSSuccess(payload, slabEl) {
        try {
            const a = payload?.result?.address || {};
            const info = payload?.result?.additionalInfo || {};
            const line1 = [a.streetAddress, a.city, a.state].filter(Boolean).join(', ');
            const zip = [a.ZIPCode, a.ZIPPlus4 ? `-${a.ZIPPlus4}` : ''].join('');
            const dpv = info.DPVConfirmation ?? 'N/A';
            const cr = info.carrierRoute ?? 'N/A';
            const biz = info.business ?? 'N/A';
            const vac = info.vacant ?? 'N/A';

            slabEl.innerHTML = line1 && zip
                ? `<div class="usps-result">USPS: ${escapeHTML(line1)} ${escapeHTML(zip)} <span class="usps-meta">⋅ DPV:${dpv} ⋅ CR:${cr} ⋅ Biz:${biz} ⋅ Vacant:${vac}</span></div>`
                : `USPS: (no standardized address returned)`;
            setUSPSState(slabEl, 'ok');
        } catch {
            slabEl.textContent = 'USPS: (parse error)';
            setUSPSState(slabEl, 'err');
        }
    }

    function renderUSPSError(data, slabEl, idx) {
        const errors = [];

        // AI parsing error
        if (data.aiError) {
            errors.push(`AI: ${data.aiError}`);
        }

        // USPS error
        if (data.uspsError) {
            let uspsMsg = `USPS @${data.uspsError.stage || 'unknown'}`;
            if (data.uspsError.status) uspsMsg += ` (${data.uspsError.status})`;
            if (data.uspsError.body) {
                try {
                    const parsed = JSON.parse(data.uspsError.body);
                    if (parsed.error?.message) uspsMsg += `: ${parsed.error.message}`;
                    else if (parsed.message) uspsMsg += `: ${parsed.message}`;
                } catch {
                    // body is not JSON, keep as is
                }
            }
            errors.push(uspsMsg);
        }

        const errorText = errors.join(' ⋅ ') || 'Unknown error';

        // If we have parsed data and USPS failed, show editable fields
        const hasParsedData = data.parsed && !data.parsed._fallback;
        const showRetryForm = data.uspsError && hasParsedData;

        if (showRetryForm) {
            const p = data.parsed;
            const q = data.query || {};
            slabEl.innerHTML = `
                <div class="error-header">⚠️ ${escapeHTML(errorText)}</div>
                <div class="retry-form" data-idx="${idx}">
                    <div class="retry-fields">
                        <div class="retry-field">
                            <label>Number</label>
                            <input type="text" name="number" value="${escapeHTML(p.number || '')}" placeholder="123" />
                        </div>
                        <div class="retry-field">
                            <label>Prefix</label>
                            <input type="text" name="prefix" value="${escapeHTML(p.prefix || '')}" placeholder="N, S, E, W" />
                        </div>
                        <div class="retry-field retry-field-wide">
                            <label>Street Name</label>
                            <input type="text" name="name" value="${escapeHTML(p.name || '')}" placeholder="Main" />
                        </div>
                        <div class="retry-field">
                            <label>Type</label>
                            <input type="text" name="type" value="${escapeHTML(p.type || '')}" placeholder="St, Ave" />
                        </div>
                        <div class="retry-field">
                            <label>Suffix</label>
                            <input type="text" name="suffix" value="${escapeHTML(p.suffix || '')}" placeholder="NE, SW" />
                        </div>
                        <div class="retry-field">
                            <label>City</label>
                            <input type="text" name="city" value="${escapeHTML(p.city || q.city || '')}" placeholder="Springfield" />
                        </div>
                        <div class="retry-field">
                            <label>State</label>
                            <input type="text" name="state" value="${escapeHTML(p.state || q.state || '')}" placeholder="IL" maxlength="2" />
                        </div>
                        <div class="retry-field">
                            <label>ZIP</label>
                            <input type="text" name="postal" value="${escapeHTML(p.postal || q.ZIPCode || '')}" placeholder="62704" />
                        </div>
                    </div>
                    <button class="btn retry-btn" type="button">Retry USPS</button>
                </div>
            `;
        } else {
            slabEl.innerHTML = `<div class="error-header">⚠️ ${escapeHTML(errorText)}</div>`;
        }

        setUSPSState(slabEl, 'err');
    }

    function getRetryFieldsFromForm(formEl) {
        const get = (name) => formEl.querySelector(`input[name="${name}"]`)?.value?.trim() || '';
        const streetAddress = [get('number'), get('prefix'), get('name'), get('type'), get('suffix')]
            .filter(Boolean).join(' ');
        return {
            streetAddress,
            city: get('city'),
            state: get('state'),
            ZIPCode: get('postal')
        };
    }

    bulkForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const lines = addrList.value
            .split(/\r?\n/)
            .map(s => s.trim())
            .filter(Boolean);

        cards.innerHTML = "";
        lines.forEach((line, i) => cards.appendChild(makeCard(line, i)));
    });

    bulkClear.addEventListener("click", () => {
        addrList.value = "";
        cards.innerHTML = "";
    });

    cards.addEventListener("click", async (e) => {
        // Handle retry button click
        const retryBtn = e.target.closest(".retry-btn");
        if (retryBtn) {
            const form = retryBtn.closest(".retry-form");
            const idx = form.dataset.idx;
            const slab = document.getElementById(`usps-${idx}`);
            const fields = getRetryFieldsFromForm(form);

            retryBtn.disabled = true;
            retryBtn.textContent = "Retrying...";

            try {
                const data = await uspsRetry(fields);
                if (data.uspsError) {
                    // Still failed
                    slab.innerHTML = `<div class="error-header">⚠️ USPS @${data.uspsError.stage || 'unknown'}: retry failed</div>`;
                    setUSPSState(slab, 'err');
                } else if (data.result) {
                    renderUSPSSuccess(data, slab);
                }
            } catch (err) {
                slab.innerHTML = `<div class="error-header">⚠️ Retry failed: ${escapeHTML(err.message)}</div>`;
                setUSPSState(slab, 'err');
            }
            return;
        }

        // Handle Go button click
        const btn = e.target.closest(".go");
        if (!btn) return;

        const card = btn.closest(".card-line");
        const idx = [...cards.children].indexOf(card);
        const slab = document.getElementById(`usps-${idx}`);
        const address = decodeURIComponent(btn.dataset.addr);

        try {
            await navigator.clipboard.writeText(address);
            const old = btn.textContent;
            btn.textContent = "Copied!";
            setTimeout(() => (btn.textContent = old), 800);
        } catch (err) {
            console.warn("Clipboard copy failed:", err);
        }

        openGoogleMaps(address);
        openUSPSWebsite();
        geocodeAddress(address)
            .then(({ lat, lon }) => {
                openHereWeGoByCoords(lat, lon, 17);
            })
            .catch(() => {
                window.open('https://wego.here.com/', '_blank', 'noopener');
            });

        setUSPSState(slab, '');
        slab.textContent = 'USPS: (pending)';

        try {
            const data = await uspsStandardizeLine(address);

            if (data.uspsError || data.aiError) {
                renderUSPSError(data, slab, idx);
            } else if (data.result) {
                renderUSPSSuccess(data, slab);
            } else {
                slab.textContent = 'USPS: (no result)';
                setUSPSState(slab, 'err');
            }
        } catch (err) {
            slab.textContent = `USPS: (error) ${err.message}`;
            setUSPSState(slab, 'err');
        }
    });
})();
