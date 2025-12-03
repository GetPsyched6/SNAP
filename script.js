(() => {
    "use strict";

    // =========================================================================
    // PROVIDER DEFINITIONS
    // =========================================================================
    const enc = (s) => encodeURIComponent(s ?? "");

    const MAP_PROVIDERS = {
        // GLOBAL PROVIDERS
        "google-maps": {
            id: "google-maps",
            label: "Google Maps",
            category: "global",
            type: "site",
            logo: "assets/logos/google-maps.png",
            buildUrl: (addr) => `https://www.google.com/maps/search/?api=1&query=${enc(addr)}`
        },
        "google-search": {
            id: "google-search",
            label: "Google Search",
            category: "global",
            type: "site",
            logo: "assets/logos/google-search.png",
            buildUrl: (addr) => `https://www.google.com/search?q=${enc(addr)}`
        },
        "bing-maps": {
            id: "bing-maps",
            label: "Bing Maps",
            category: "global",
            type: "site",
            logo: "assets/logos/bing-maps.png",
            buildUrl: (addr) => `https://www.bing.com/maps/default.aspx?where1=${enc(addr)}`
        },
        "apple-maps": {
            id: "apple-maps",
            label: "Apple Maps",
            category: "global",
            type: "site",
            logo: "assets/logos/apple-maps.png",
            buildUrl: (addr) => `https://maps.apple.com/?q=${enc(addr)}`
        },
        "openstreetmap": {
            id: "openstreetmap",
            label: "OpenStreetMap",
            category: "global",
            type: "site",
            logo: "assets/logos/openstreetmap.png",
            buildUrl: (addr) => `https://www.openstreetmap.org/search?query=${enc(addr)}`
        },
        "mapquest": {
            id: "mapquest",
            label: "MapQuest",
            category: "global",
            type: "site",
            logo: "assets/logos/mapquest.png",
            buildUrl: (addr) => `https://www.mapquest.com/search/${enc(addr)}`
        },
        "here-site": {
            id: "here-site",
            label: "HERE WeGo",
            category: "global",
            type: "site",
            needsCoords: true,
            logo: "assets/logos/here.png",
            buildUrl: (addr, coords) => {
                if (coords?.lat && coords?.lon) {
                    return `https://wego.here.com/l/${coords.lat},${coords.lon},18?map=${coords.lat},${coords.lon},18,normal`;
                }
                return "https://wego.here.com/";
            }
        },
        // REGIONAL - CHINA
        "baidu-maps": {
            id: "baidu-maps",
            label: "Baidu Maps",
            category: "regional",
            region: "China",
            type: "site",
            logo: "assets/logos/baidu.png",
            buildUrl: (addr) => `https://map.baidu.com/search/${enc(addr)}/?querytype=s&wd=${enc(addr)}`
        },
        "amap": {
            id: "amap",
            label: "Amap / Gaode",
            category: "regional",
            region: "China",
            type: "site",
            logo: "assets/logos/amap.png",
            buildUrl: (addr) => `https://www.amap.com/search?query=${enc(addr)}`
        },
        // REGIONAL - RUSSIA/CIS
        "yandex-maps": {
            id: "yandex-maps",
            label: "Yandex Maps",
            category: "regional",
            region: "Russia & CIS",
            type: "site",
            logo: "assets/logos/yandex.png",
            buildUrl: (addr) => `https://yandex.com/maps/?mode=search&text=${enc(addr)}`
        },
        // REGIONAL - KOREA
        "naver-maps": {
            id: "naver-maps",
            label: "Naver Maps",
            category: "regional",
            region: "South Korea",
            type: "site",
            logo: "assets/logos/naver.png",
            buildUrl: (addr) => `https://map.naver.com/v5/search/${enc(addr)}`
        },
        "kakao-map": {
            id: "kakao-map",
            label: "KakaoMap",
            category: "regional",
            region: "South Korea",
            type: "site",
            logo: "assets/logos/kakao.png",
            buildUrl: (addr) => `https://map.kakao.com/?q=${enc(addr)}`
        },
        // REGIONAL - EUROPE
        "mapy-cz": {
            id: "mapy-cz",
            label: "Mapy.cz",
            category: "regional",
            region: "Czech Republic & EU",
            type: "site",
            logo: "assets/logos/mapy-cz.png",
            buildUrl: (addr) => `https://mapy.cz/zakladni?q=${enc(addr)}`
        }
    };

    const API_PROVIDERS = {
        "usps-api": {
            id: "usps-api",
            label: "USPS Address Validation",
            logo: "assets/logos/usps.png",
            type: "api"
        },
        "here-api": {
            id: "here-api",
            label: "HERE Geocoding API",
            logo: "assets/logos/here.png",
            type: "api"
        }
    };

    const SITE_PROVIDERS = {
        "usps-site": {
            id: "usps-site",
            label: "USPS ZIP Lookup",
            logo: "assets/logos/usps.png",
            type: "site",
            category: "global",
            buildUrl: () => "https://tools.usps.com/zip-code-lookup.htm?byaddress"
        }
    };

    // Preferred opening order for sites (global first, then regional)
    const SITE_OPEN_ORDER = [
        // Global - in preferred order
        "google-maps",
        "google-search",
        "bing-maps",
        "apple-maps",
        "openstreetmap",
        "mapquest",
        "here-site",
        "usps-site",
        // Regional - any order
        "baidu-maps",
        "amap",
        "yandex-maps",
        "naver-maps",
        "kakao-map",
        "mapy-cz"
    ];

    // =========================================================================
    // SETTINGS MANAGEMENT
    // =========================================================================
    const DEFAULT_SETTINGS = {
        sites: ["google-maps", "here-site", "usps-site"],
        apis: ["usps-api", "here-api"]
    };

    function loadSettings() {
        try {
            const saved = localStorage.getItem("addressVerifierSettings");
            if (saved) {
                const parsed = JSON.parse(saved);
                return {
                    sites: Array.isArray(parsed.sites) ? parsed.sites : DEFAULT_SETTINGS.sites,
                    apis: Array.isArray(parsed.apis) ? parsed.apis : DEFAULT_SETTINGS.apis
                };
            }
        } catch { }
        return { ...DEFAULT_SETTINGS };
    }

    function saveSettings(settings) {
        localStorage.setItem("addressVerifierSettings", JSON.stringify(settings));
    }

    let settings = loadSettings();

    // =========================================================================
    // THEME TOGGLE
    // =========================================================================
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

    // =========================================================================
    // DOM ELEMENTS
    // =========================================================================
    const bulkForm = document.getElementById("bulkForm");
    const bulkClear = document.getElementById("bulkClear");
    const addrList = document.getElementById("addrList");
    const cards = document.getElementById("cards");
    const settingsBtn = document.getElementById("settingsBtn");
    const settingsModal = document.getElementById("settingsModal");
    const settingsClose = document.getElementById("settingsClose");
    const selectedProvidersContainer = document.getElementById("selectedProviders");

    // =========================================================================
    // UTILITY FUNCTIONS
    // =========================================================================
    const escapeHTML = (s) => s.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

    function formatJSON(obj, indent = 0) {
        const spaces = '  '.repeat(indent);
        if (obj === null) return `${spaces}<span class="json-null">null</span>`;
        if (obj === undefined) return `${spaces}<span class="json-null">undefined</span>`;
        if (typeof obj === 'boolean') return `${spaces}<span class="json-bool">${obj}</span>`;
        if (typeof obj === 'number') return `${spaces}<span class="json-num">${obj}</span>`;
        if (typeof obj === 'string') return `${spaces}<span class="json-str">"${escapeHTML(obj)}"</span>`;

        if (Array.isArray(obj)) {
            if (obj.length === 0) return `${spaces}[]`;
            const items = obj.map(item => formatJSON(item, indent + 1)).join(',\n');
            return `${spaces}[\n${items}\n${spaces}]`;
        }

        if (typeof obj === 'object') {
            const keys = Object.keys(obj);
            if (keys.length === 0) return `${spaces}{}`;
            const items = keys.map(key => {
                const val = formatJSON(obj[key], indent + 1);
                return `${'  '.repeat(indent + 1)}<span class="json-key">"${escapeHTML(key)}"</span>: ${val.trim()}`;
            }).join(',\n');
            return `${spaces}{\n${items}\n${spaces}}`;
        }

        return `${spaces}${String(obj)}`;
    }

    // =========================================================================
    // SELECTED PROVIDERS DISPLAY
    // =========================================================================
    function renderSelectedProviders() {
        if (!selectedProvidersContainer) return;

        const allProviders = { ...MAP_PROVIDERS, ...SITE_PROVIDERS };
        const enabledSites = settings.sites.filter(id => allProviders[id]);

        if (enabledSites.length === 0) {
            selectedProvidersContainer.innerHTML = '<span class="no-providers">No providers selected</span>';
            return;
        }

        selectedProvidersContainer.innerHTML = enabledSites.map(id => {
            const provider = allProviders[id];
            return `<div class="provider-icon" title="${escapeHTML(provider.label)}">
                <img src="${provider.logo}" alt="${escapeHTML(provider.label)}" onerror="this.style.display='none'" />
            </div>`;
        }).join('');
    }

    // =========================================================================
    // SETTINGS MODAL
    // =========================================================================
    function openSettingsModal() {
        renderSettingsModal();
        settingsModal.classList.add("open");
        document.body.style.overflow = "hidden";
    }

    function closeSettingsModal() {
        settingsModal.classList.remove("open");
        document.body.style.overflow = "";
    }

    function renderSettingsModal() {
        const content = settingsModal.querySelector(".settings-content");
        if (!content) return;

        // Group providers
        const globalSites = Object.values(MAP_PROVIDERS).filter(p => p.category === "global");
        const regionalByRegion = {};
        Object.values(MAP_PROVIDERS).filter(p => p.category === "regional").forEach(p => {
            if (!regionalByRegion[p.region]) regionalByRegion[p.region] = [];
            regionalByRegion[p.region].push(p);
        });

        let html = `
            <div class="settings-section">
                <h3 class="settings-section-title">APIs</h3>
                <p class="settings-section-desc">Enable address validation APIs</p>
                <div class="provider-list">
                    ${renderProviderToggle(API_PROVIDERS["usps-api"], settings.apis.includes("usps-api"), "api")}
                    ${renderProviderToggle(API_PROVIDERS["here-api"], settings.apis.includes("here-api"), "api")}
                </div>
            </div>

            <div class="settings-section">
                <h3 class="settings-section-title">Global Sites</h3>
                <p class="settings-section-desc">Major map services available worldwide</p>
                <div class="provider-list">
                    ${globalSites.map(p => renderProviderToggle(p, settings.sites.includes(p.id), "site")).join('')}
                    ${renderProviderToggle(SITE_PROVIDERS["usps-site"], settings.sites.includes("usps-site"), "site")}
                </div>
            </div>

            <div class="settings-section">
                <h3 class="settings-section-title">Regional Sites</h3>
                <p class="settings-section-desc">Region-specific map services</p>
                ${Object.entries(regionalByRegion).map(([region, providers]) => `
                    <h4 class="settings-region-title">${escapeHTML(region)}</h4>
                    <div class="provider-list">
                        ${providers.map(p => renderProviderToggle(p, settings.sites.includes(p.id), "site")).join('')}
                    </div>
                `).join('')}
            </div>
        `;

        content.innerHTML = html;

        // Add toggle event listeners
        content.querySelectorAll(".provider-toggle").forEach(toggle => {
            toggle.addEventListener("click", handleToggleClick);
        });
    }

    function renderProviderToggle(provider, enabled, type) {
        return `
            <div class="provider-item">
                <div class="provider-info">
                    <div class="provider-logo">
                        <img src="${provider.logo}" alt="" onerror="this.parentElement.innerHTML='📍'" />
                    </div>
                    <span class="provider-name">${escapeHTML(provider.label)}</span>
                </div>
                <button class="provider-toggle ${enabled ? 'active' : ''}" 
                        data-provider-id="${provider.id}" 
                        data-provider-type="${type}"
                        aria-pressed="${enabled}">
                    <span class="toggle-track">
                        <span class="toggle-thumb"></span>
                    </span>
                </button>
            </div>
        `;
    }

    function handleToggleClick(e) {
        const toggle = e.currentTarget;
        const id = toggle.dataset.providerId;
        const type = toggle.dataset.providerType;
        const isActive = toggle.classList.contains("active");

        if (type === "api") {
            if (isActive) {
                settings.apis = settings.apis.filter(x => x !== id);
            } else {
                settings.apis.push(id);
            }
        } else {
            if (isActive) {
                settings.sites = settings.sites.filter(x => x !== id);
            } else {
                settings.sites.push(id);
            }
        }

        toggle.classList.toggle("active");
        toggle.setAttribute("aria-pressed", !isActive);

        saveSettings(settings);
        renderSelectedProviders();
    }

    if (settingsBtn) {
        settingsBtn.addEventListener("click", openSettingsModal);
    }
    if (settingsClose) {
        settingsClose.addEventListener("click", closeSettingsModal);
    }
    if (settingsModal) {
        settingsModal.addEventListener("click", (e) => {
            if (e.target === settingsModal) closeSettingsModal();
        });
    }

    // Close on Escape
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && settingsModal?.classList.contains("open")) {
            closeSettingsModal();
        }
    });

    // =========================================================================
    // ADDRESS CARD RENDERING
    // =========================================================================
    function makeCard(address, idx) {
        const wrap = document.createElement("div");
        wrap.className = "card-line";

        const uspsEnabled = settings.apis.includes("usps-api");
        const hereEnabled = settings.apis.includes("here-api");

        wrap.innerHTML = `
            <div class="line-row">
                <span class="addr">${escapeHTML(address)}</span>
                <div class="spacer"></div>
                <button class="btn go" data-addr="${encodeURIComponent(address)}">Go</button>
            </div>
            ${uspsEnabled ? `<div class="usps-slab" id="usps-${idx}">USPS: (pending)</div>` : ''}
            ${hereEnabled ? `<div class="here-slab" id="here-${idx}">HERE: (pending)</div>` : ''}
        `;
        return wrap;
    }

    // =========================================================================
    // SLAB STATE MANAGEMENT
    // =========================================================================
    function setSlabState(el, state) {
        if (!el) return;
        el.classList.remove('ok', 'err', 'loading', 'warn');
        if (state) el.classList.add(state);
    }

    function showLoadingState(el, message) {
        if (!el) return;
        el.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <span class="loading-text">${escapeHTML(message)}</span>
            </div>
        `;
        setSlabState(el, 'loading');
    }

    function toggleSlabDetails(slabEl) {
        const detailsEl = slabEl.querySelector('.slab-details');
        if (!detailsEl) return;

        const isExpanded = slabEl.classList.contains('expanded');
        if (isExpanded) {
            slabEl.classList.remove('expanded');
            detailsEl.classList.remove('expanded');
        } else {
            slabEl.classList.add('expanded');
            detailsEl.classList.add('expanded');
        }
    }

    // =========================================================================
    // API CALLS
    // =========================================================================
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE = isLocalhost ? 'http://localhost:5501/api' : '/api';

    async function uspsStandardizeLine(addressLine, onProgress) {
        if (onProgress) onProgress('USPS: Parsing address...');

        const fetchPromise = fetch(`${API_BASE}/usps/standardize-line`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addressLine })
        });

        const uspsStageTimeout = setTimeout(() => {
            if (onProgress) onProgress('USPS: Validating...');
        }, 800);

        const r = await fetchPromise;
        clearTimeout(uspsStageTimeout);

        const text = await r.text();
        return JSON.parse(text);
    }

    async function uspsRetry(fields, onProgress) {
        if (onProgress) onProgress('USPS: Retrying...');

        const r = await fetch(`${API_BASE}/usps/retry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fields)
        });
        const text = await r.text();
        return JSON.parse(text);
    }

    async function hereGeocodeLine(addressLine, onProgress) {
        if (onProgress) onProgress('HERE: Geocoding...');

        const r = await fetch(`${API_BASE}/here/geocode-line`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addressLine })
        });
        const text = await r.text();
        return JSON.parse(text);
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

    // =========================================================================
    // RENDER FUNCTIONS
    // =========================================================================
    function renderUSPSSuccess(payload, slabEl, idx) {
        try {
            const a = payload?.result?.address || {};
            const info = payload?.result?.additionalInfo || {};
            const line1 = [a.streetAddress, a.city, a.state].filter(Boolean).join(', ');
            const zip = [a.ZIPCode, a.ZIPPlus4 ? `-${a.ZIPPlus4}` : ''].join('');
            const dpv = info.DPVConfirmation ?? 'N/A';
            const cr = info.carrierRoute ?? 'N/A';
            const biz = info.business ?? 'N/A';
            const vac = info.vacant ?? 'N/A';

            if (line1 && zip) {
                const detailsData = payload?.result || {};

                slabEl.innerHTML = `
                    <div class="slab-header">
                        <div class="slab-content">
                            <div>USPS: ${escapeHTML(line1)} ${escapeHTML(zip)}</div>
                            <div class="usps-meta">DPV:${dpv} ⋅ CR:${cr} ⋅ Biz:${biz} ⋅ Vacant:${vac}</div>
                        </div>
                        <div class="slab-chevron">
                            <span class="chevron-icon">›</span>
                        </div>
                    </div>
                    <div class="slab-details">
                        <pre class="json-view">${formatJSON(detailsData)}</pre>
                    </div>
                `;
            } else {
                slabEl.innerHTML = `USPS: (no standardized address returned)`;
            }
            setSlabState(slabEl, 'ok');
        } catch {
            slabEl.textContent = 'USPS: (parse error)';
            setSlabState(slabEl, 'err');
        }
    }

    function renderUSPSError(data, slabEl, idx) {
        const errors = [];

        if (data.aiError) {
            errors.push(`AI: ${data.aiError}`);
        }

        if (data.uspsError) {
            let uspsMsg = `USPS @${data.uspsError.stage || 'unknown'}`;
            if (data.uspsError.status) uspsMsg += ` (${data.uspsError.status})`;
            if (data.uspsError.body) {
                try {
                    const parsed = JSON.parse(data.uspsError.body);
                    if (parsed.error?.message) uspsMsg += `: ${parsed.error.message}`;
                    else if (parsed.message) uspsMsg += `: ${parsed.message}`;
                } catch { }
            }
            errors.push(uspsMsg);
        }

        const errorText = errors.join(' ⋅ ') || 'Unknown error';

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
            slabEl.innerHTML = `<div class="error-header">⚠️ USPS: ${escapeHTML(errorText)}</div>`;
        }

        setSlabState(slabEl, 'err');
    }

    function renderHERESuccess(data, slabEl, idx) {
        try {
            const here = data?.here || {};
            const verdict = here.verdict || 'none';
            const reason = here.reason || '';
            const matchLevel = here.matchLevel || 'N/A';
            const queryScore = here.queryScore !== null ? (here.queryScore * 100).toFixed(0) + '%' : 'N/A';
            const label = here.label || '(no label)';
            const pos = here.position || {};
            const lat = pos.lat !== null ? pos.lat.toFixed(6) : 'N/A';
            const lng = pos.lng !== null ? pos.lng.toFixed(6) : 'N/A';

            let verdictClass = '';
            let verdictIcon = '❓';
            let verdictText = '';
            let verdictDesc = '';

            if (verdict === 'exact') {
                verdictClass = 'verdict-exact';
                verdictIcon = '✅';
                verdictText = 'ADDRESS FOUND';
                verdictDesc = 'Exact house number match with high confidence';
            } else if (verdict === 'partial') {
                verdictClass = 'verdict-partial';
                verdictIcon = '⚠️';
                verdictText = 'PARTIAL MATCH';
                // Provide more context based on matchLevel
                if (matchLevel === 'street') {
                    verdictDesc = 'Street found, but house number not confirmed';
                } else if (matchLevel === 'houseNumber') {
                    verdictDesc = 'House number found, but low confidence score';
                } else if (matchLevel === 'locality' || matchLevel === 'administrativeArea') {
                    verdictDesc = `Only matched to ${matchLevel} level, not specific address`;
                } else {
                    verdictDesc = 'Address partially matched, verify manually';
                }
            } else {
                verdictClass = 'verdict-none';
                verdictIcon = '❌';
                verdictText = 'NOT FOUND';
                verdictDesc = 'Address could not be verified in HERE database';
            }

            const detailsData = data?.raw?.items || [];

            slabEl.innerHTML = `
                <div class="here-result ${verdictClass}">
                    <div class="slab-header">
                        <div class="slab-content">
                            <div class="here-verdict">HERE: ${verdictIcon} <strong>${verdictText}</strong></div>
                            <div class="here-desc">${escapeHTML(verdictDesc)}</div>
                            <div class="here-label">${escapeHTML(label)}</div>
                            <div class="here-meta">
                                Match Level: ${escapeHTML(matchLevel)} ⋅ Score: ${escapeHTML(queryScore)} ⋅ Coords: ${escapeHTML(lat)}, ${escapeHTML(lng)}
                            </div>
                        </div>
                        <div class="slab-chevron">
                            <span class="chevron-icon">›</span>
                        </div>
                    </div>
                    <div class="slab-details">
                        <pre class="json-view">${formatJSON(detailsData)}</pre>
                    </div>
                </div>
            `;

            if (verdict === 'exact') {
                setSlabState(slabEl, 'ok');
            } else if (verdict === 'partial') {
                setSlabState(slabEl, 'warn');
            } else {
                setSlabState(slabEl, 'err');
            }
        } catch {
            slabEl.textContent = 'HERE: (parse error)';
            setSlabState(slabEl, 'err');
        }
    }

    function renderHEREError(error, slabEl, idx) {
        slabEl.innerHTML = `<div class="error-header">⚠️ HERE: ${escapeHTML(error)}</div>`;
        setSlabState(slabEl, 'err');
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

    // =========================================================================
    // EVENT HANDLERS
    // =========================================================================
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
        // Handle slab header click for expand/collapse
        const slabHeader = e.target.closest(".slab-header");
        if (slabHeader) {
            const slab = slabHeader.closest(".usps-slab, .here-slab");
            if (slab) {
                toggleSlabDetails(slab);
            }
            return;
        }

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
                const data = await uspsRetry(fields, (msg) => {
                    showLoadingState(slab, msg);
                });
                if (data.uspsError) {
                    slab.innerHTML = `<div class="error-header">⚠️ USPS @${data.uspsError.stage || 'unknown'}: retry failed</div>`;
                    setSlabState(slab, 'err');
                } else if (data.result) {
                    renderUSPSSuccess(data, slab, idx);
                }
            } catch (err) {
                slab.innerHTML = `<div class="error-header">⚠️ Retry failed: ${escapeHTML(err.message)}</div>`;
                setSlabState(slab, 'err');
            }
            return;
        }

        // Handle Go button click
        const btn = e.target.closest(".go");
        if (!btn) return;

        const card = btn.closest(".card-line");
        const idx = [...cards.children].indexOf(card);
        const uspsSlab = document.getElementById(`usps-${idx}`);
        const hereSlab = document.getElementById(`here-${idx}`);
        const address = decodeURIComponent(btn.dataset.addr);

        // Copy to clipboard
        try {
            await navigator.clipboard.writeText(address);
            const old = btn.textContent;
            btn.textContent = "Copied!";
            setTimeout(() => (btn.textContent = old), 800);
        } catch (err) {
            console.warn("Clipboard copy failed:", err);
        }

        // Get coords for providers that need them
        let coords = null;
        try {
            coords = await geocodeAddress(address);
        } catch { }

        // Open enabled site providers in preferred order
        const allSiteProviders = { ...MAP_PROVIDERS, ...SITE_PROVIDERS };
        const enabledSites = settings.sites.filter(id => allSiteProviders[id]);

        // Sort by preferred order
        enabledSites.sort((a, b) => {
            const orderA = SITE_OPEN_ORDER.indexOf(a);
            const orderB = SITE_OPEN_ORDER.indexOf(b);
            // If not in order list, put at end
            const posA = orderA === -1 ? 999 : orderA;
            const posB = orderB === -1 ? 999 : orderB;
            return posA - posB;
        });

        enabledSites.forEach(siteId => {
            const provider = allSiteProviders[siteId];
            if (provider && provider.buildUrl) {
                const url = provider.buildUrl(address, coords);
                window.open(url, "_blank", "noopener");
            }
        });

        // Run enabled API providers
        if (settings.apis.includes("usps-api") && uspsSlab) {
            showLoadingState(uspsSlab, 'USPS: Starting...');
            (async () => {
                try {
                    const data = await uspsStandardizeLine(address, (msg) => {
                        showLoadingState(uspsSlab, msg);
                    });

                    if (data.result && !data.uspsError) {
                        renderUSPSSuccess(data, uspsSlab, idx);
                    } else if (data.uspsError) {
                        renderUSPSError(data, uspsSlab, idx);
                    } else {
                        uspsSlab.textContent = 'USPS: (no result)';
                        setSlabState(uspsSlab, 'err');
                    }
                } catch (err) {
                    uspsSlab.textContent = `USPS: (error) ${err.message}`;
                    setSlabState(uspsSlab, 'err');
                }
            })();
        }

        if (settings.apis.includes("here-api") && hereSlab) {
            showLoadingState(hereSlab, 'HERE: Starting...');
            (async () => {
                try {
                    const data = await hereGeocodeLine(address, (msg) => {
                        showLoadingState(hereSlab, msg);
                    });

                    if (data.error) {
                        renderHEREError(data.error, hereSlab, idx);
                    } else if (data.here) {
                        renderHERESuccess(data, hereSlab, idx);
                    } else {
                        hereSlab.textContent = 'HERE: (no result)';
                        setSlabState(hereSlab, 'err');
                    }
                } catch (err) {
                    hereSlab.textContent = `HERE: (error) ${err.message}`;
                    setSlabState(hereSlab, 'err');
                }
            })();
        }
    });

    // =========================================================================
    // INITIALIZATION
    // =========================================================================
    renderSelectedProviders();
})();
