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
        if (!r.ok) {
            let details;
            try { details = JSON.parse(text); } catch { details = { body: text }; }
            throw new Error(`USPS ${r.status}${details.stage ? ` @${details.stage}` : ''}: ${details.body || ''}`);
        }
        return JSON.parse(text);
    }

    function renderUSPSIntoSlab(payload, slabEl) {
        try {
            const a = payload?.result?.address || {};
            const info = payload?.result?.additionalInfo || {};
            const line1 = [a.streetAddress, a.city, a.state].filter(Boolean).join(', ');
            const zip = [a.ZIPCode, a.ZIPPlus4 ? `-${a.ZIPPlus4}` : ''].join('');
            const dpv = info.DPVConfirmation ?? 'N/A';
            const cr = info.carrierRoute ?? 'N/A';
            const biz = info.business ?? 'N/A';
            const vac = info.vacant ?? 'N/A';
            slabEl.textContent =
                line1 && zip
                    ? `USPS: ${line1} ${zip} • DPV:${dpv} • CR:${cr} • Business:${biz} • Vacant:${vac}`
                    : `USPS: (no standardized address returned)`;
            setUSPSState(slabEl, 'ok');
        } catch {
            slabEl.textContent = 'USPS: (parse error)';
            setUSPSState(slabEl, 'err');
        }
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
            renderUSPSIntoSlab(data, slab);
        } catch (err) {
            slab.textContent = `USPS: (error) ${err.message}`;
            setUSPSState(slab, 'err');
        }

    });
})();
