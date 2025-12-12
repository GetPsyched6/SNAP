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
        "bing-search": {
            id: "bing-search",
            label: "Bing Web Search",
            category: "global",
            type: "search",
            logo: "assets/logos/bing-search.png",
            buildUrl: (addr) => `https://www.bing.com/search?q=${enc(addr)}`
        },
        "duckduckgo-search": {
            id: "duckduckgo-search",
            label: "DuckDuckGo",
            category: "global",
            type: "search",
            logo: "assets/logos/duckduckgo-search.png",
            buildUrl: (addr) => `https://duckduckgo.com/?q=${enc(addr)}`
        },
        "yahoo-search": {
            id: "yahoo-search",
            label: "Yahoo Search",
            category: "global",
            type: "search",
            logo: "assets/logos/yahoo-search.png",
            buildUrl: (addr) => `https://search.yahoo.com/search?p=${enc(addr)}`
        },
        "ecosia-search": {
            id: "ecosia-search",
            label: "Ecosia",
            category: "global",
            type: "search",
            logo: "assets/logos/ecosia-search.png",
            buildUrl: (addr) => `https://www.ecosia.org/search?q=${enc(addr)}`
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
            canPrefill: false,
            buildUrl: () => "https://tools.usps.com/zip-code-lookup.htm?byaddress"
        }
    };

    // =========================================================================
    // COUNTY MAP PROVIDERS
    // =========================================================================
    const COUNTY_MAP_PROVIDERS = {
        "PATHO_ALLEGHENY": {
            key: "PATHO_ALLEGHENY",
            label: "PATHO – Allegheny County",
            countyMatch: "Allegheny",
            kind: "arcgis-experience",
            baseUrl: "https://experience.arcgis.com/experience/68f5e4ae2f5b47b78cefcdf019e154bd/",
            canPrefill: false,
            buildUrl: () => "https://experience.arcgis.com/experience/68f5e4ae2f5b47b78cefcdf019e154bd/"
        },
        "TXSTA_STLOUIS": {
            key: "TXSTA_STLOUIS",
            label: "TXSTA – St. Louis County Maps",
            countyMatch: "St. Louis",
            kind: "static-page",
            baseUrl: "https://stlouiscountymo.gov/st-louis-county-departments/planning/stlco-2050/rfp-resources/maps/",
            canPrefill: false,
            buildUrl: () => "https://stlouiscountymo.gov/st-louis-county-departments/planning/stlco-2050/rfp-resources/maps/"
        },
        "MOEAR_OFALLON": {
            key: "MOEAR_OFALLON",
            label: "MOEAR – St. Charles County",
            countyMatch: "St. Charles",
            kind: "arcgis-experience",
            baseUrl: "https://experience.arcgis.com/experience/7265e8a18aaa43d38643d0ceba127400/",
            canPrefill: false,
            buildUrl: () => "https://experience.arcgis.com/experience/7265e8a18aaa43d38643d0ceba127400/"
        },
        "COMNT_ELPASO": {
            key: "COMNT_ELPASO",
            label: "COMNT – El Paso County",
            countyMatch: "El Paso",
            kind: "spatialest",
            baseUrl: "https://property.spatialest.com/co/elpaso/#/",
            canPrefill: false,
            buildUrl: () => "https://property.spatialest.com/co/elpaso/#/"
        },
        "CAPAL_RIVERSIDE": {
            key: "CAPAL_RIVERSIDE",
            label: "CAPAL – Riverside County",
            countyMatch: "Riverside",
            kind: "custom-property-portal",
            baseUrl: "https://rivcoview.rivcoacr.org/#/Property-Search",
            canPrefill: false,
            buildUrl: () => "https://rivcoview.rivcoacr.org/#/Property-Search"
        },
        "NMGAL_GALLUP": {
            key: "NMGAL_GALLUP",
            label: "NMGAL – City of Gallup (McKinley)",
            countyMatch: "McKinley",
            kind: "arcgis-webappviewer-find",
            baseUrl: "https://cog.maps.arcgis.com/apps/webappviewer/index.html?id=67f6d4da7b284f07996d5c9381a82e05",
            canPrefill: true,
            buildUrl: (shortAddr) => {
                const find = enc(shortAddr ?? "");
                return `https://cog.maps.arcgis.com/apps/webappviewer/index.html?id=67f6d4da7b284f07996d5c9381a82e05&find=${find}`;
            }
        },
        "FLMGR_BROWARD": {
            key: "FLMGR_BROWARD",
            label: "FLMGR – Broward County",
            countyMatch: "Broward",
            kind: "custom-property-portal",
            baseUrl: "https://bcpa.net/RecMenu.asp",
            canPrefill: false,
            buildUrl: () => "https://bcpa.net/RecMenu.asp"
        },
        "ALMOB_MOBILE": {
            key: "ALMOB_MOBILE",
            label: "ALMOB – Mobile County",
            countyMatch: "Mobile",
            kind: "arcgis-webappviewer",
            baseUrl: "https://cityofmobile.maps.arcgis.com/apps/webappviewer/index.html?id=44b3d1ecf57d4daa919a1e40ecca0c02",
            canPrefill: false,
            buildUrl: () => "https://cityofmobile.maps.arcgis.com/apps/webappviewer/index.html?id=44b3d1ecf57d4daa919a1e40ecca0c02"
        }
    };

    // County name to provider key mapping (for auto-detection)
    const COUNTY_TO_PROVIDER = {};
    Object.values(COUNTY_MAP_PROVIDERS).forEach(p => {
        COUNTY_TO_PROVIDER[p.countyMatch.toLowerCase()] = p.key;
    });

    // Get lists of prefillable and non-prefillable county maps
    function getPrefillableCountyMaps() {
        return Object.values(COUNTY_MAP_PROVIDERS).filter(p => p.canPrefill);
    }

    function getNonPrefillableCountyMaps() {
        return Object.values(COUNTY_MAP_PROVIDERS).filter(p => !p.canPrefill);
    }

    // Find county provider by county name
    function findCountyProvider(countyName) {
        if (!countyName) return null;
        const key = COUNTY_TO_PROVIDER[countyName.toLowerCase()];
        return key ? COUNTY_MAP_PROVIDERS[key] : null;
    }

    // Extract short address (street only, no city/state/zip)
    function getShortAddress(fullAddress) {
        if (!fullAddress) return '';
        // Split by comma and take first part
        const parts = fullAddress.split(',');
        return parts[0].trim();
    }

    // Preferred opening order for sites (global first, then regional)
    const SITE_OPEN_ORDER = [
        // Global - in preferred order
        "google-maps",
        "google-search",
        "bing-search",
        "duckduckgo-search",
        "yahoo-search",
        "ecosia-search",
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
        apis: ["usps-api", "here-api"],
        countyMaps: {
            enabled: false,
            autoOpenPrefillable: false,
            autoOpenNonPrefillable: false,
            autoCopyShortAddress: false
        }
    };

    function loadSettings() {
        try {
            const saved = localStorage.getItem("addressVerifierSettings");
            if (saved) {
                const parsed = JSON.parse(saved);
                return {
                    sites: Array.isArray(parsed.sites) ? parsed.sites : DEFAULT_SETTINGS.sites,
                    apis: Array.isArray(parsed.apis) ? parsed.apis : DEFAULT_SETTINGS.apis,
                    countyMaps: {
                        enabled: parsed.countyMaps?.enabled ?? DEFAULT_SETTINGS.countyMaps.enabled,
                        autoOpenPrefillable: parsed.countyMaps?.autoOpenPrefillable ?? DEFAULT_SETTINGS.countyMaps.autoOpenPrefillable,
                        autoOpenNonPrefillable: parsed.countyMaps?.autoOpenNonPrefillable ?? DEFAULT_SETTINGS.countyMaps.autoOpenNonPrefillable,
                        autoCopyShortAddress: parsed.countyMaps?.autoCopyShortAddress ?? DEFAULT_SETTINGS.countyMaps.autoCopyShortAddress
                    }
                };
            }
        } catch { }
        return { ...DEFAULT_SETTINGS, countyMaps: { ...DEFAULT_SETTINGS.countyMaps } };
    }

    function saveSettings(settings) {
        localStorage.setItem("addressVerifierSettings", JSON.stringify(settings));
    }

    let settings = loadSettings();

    // =========================================================================
    // THEME TOGGLE
    // =========================================================================
    const themeToggle = document.getElementById("themeToggle");
    const persistToggle = document.getElementById("persistToggle");
    const body = document.body;

    // Check if persistence is enabled
    const persistEnabled = localStorage.getItem('persistAlt') === 'true';

    // If not persisting, clear session state on load
    if (!persistEnabled) {
        sessionStorage.removeItem('specialMode');
    }

    let savedTheme = localStorage.getItem("theme") || "dark";

    // Only load alt theme if persistence is explicitly enabled
    if (savedTheme === "alt" && !persistEnabled) {
        savedTheme = "dark";
        localStorage.setItem("theme", "dark");
    }

    body.setAttribute("data-theme", savedTheme);
    updateThemeToggle(savedTheme);

    // If alt theme is active (from persistence), show persist toggle
    if (savedTheme === "alt" && persistEnabled) {
        sessionStorage.setItem('specialMode', 'true');
        showPersistToggle();
        updatePersistToggle(true);
        // Update footer text
        const footer = document.querySelector('.app-footer small:first-child');
        if (footer) {
            footer.textContent = 'Made by 💖 Hazeline Nishad 💖';
            footer.classList.add('mode-active');
            footer.style.textShadow = '0 0 10px rgba(245, 169, 184, 0.3)';
        }
    }

    function updateThemeToggle(theme) {
        const icon = themeToggle.querySelector(".theme-toggle-icon");
        const label = themeToggle.querySelector(".theme-toggle-label");
        if (theme === "light") {
            icon.textContent = "☀️";
            label.textContent = "Light";
        } else if (theme === "alt") {
            icon.textContent = "✨";
            label.textContent = "Special Hazeline Mode";
        } else {
            icon.textContent = "🌙";
            label.textContent = "Dark";
        }
    }

    function showPersistToggle() {
        if (persistToggle) {
            persistToggle.style.display = 'flex';
        }
    }

    function hidePersistToggle() {
        if (persistToggle) {
            persistToggle.style.display = 'none';
        }
    }

    function updatePersistToggle(isActive) {
        if (!persistToggle) return;
        const svg = persistToggle.querySelector('svg');
        if (isActive) {
            persistToggle.classList.add('active');
            svg.style.fill = 'currentColor';
        } else {
            persistToggle.classList.remove('active');
            svg.style.fill = 'none';
        }
    }

    themeToggle.addEventListener("click", () => {
        const current = body.getAttribute("data-theme");
        let next;
        const hasExtendedThemes = sessionStorage.getItem('specialMode') === 'true';

        // Cycle through available themes
        if (hasExtendedThemes) {
            if (current === "dark") {
                next = "light";
            } else if (current === "light") {
                next = "alt";
                showPersistToggle();
                updatePersistToggle(localStorage.getItem('persistAlt') === 'true');
            } else {
                // Switching away from alt
                next = "dark";
                hidePersistToggle();

                // If persistence was enabled, disable it
                if (localStorage.getItem('persistAlt') === 'true') {
                    localStorage.removeItem('persistAlt');
                }

                // Restore footer with transition
                const footer = document.querySelector('.app-footer small:first-child');
                if (footer) {
                    footer.style.transition = 'opacity 0.3s ease';
                    footer.style.opacity = '0';
                    setTimeout(() => {
                        footer.textContent = 'Made by Roshin Nishad';
                        footer.classList.remove('mode-active');
                        footer.style.textShadow = '';
                        footer.style.opacity = '1';
                    }, 300);
                }
            }
        } else {
            // Standard theme toggle
            next = current === "dark" ? "light" : "dark";
        }

        body.setAttribute("data-theme", next);
        // Persist theme if enabled or if not alt
        if (next !== "alt" || localStorage.getItem('persistAlt') === 'true') {
            localStorage.setItem("theme", next);
        }
        updateThemeToggle(next);
    });

    // Persist toggle handler
    if (persistToggle) {
        persistToggle.addEventListener("click", () => {
            const isCurrentlyPersisted = localStorage.getItem('persistAlt') === 'true';

            if (isCurrentlyPersisted) {
                // Disable persistence - switch back to dark theme
                localStorage.removeItem('persistAlt');
                localStorage.setItem("theme", "dark");
                sessionStorage.removeItem('specialMode');
                body.setAttribute("data-theme", "dark");
                updateThemeToggle("dark");
                hidePersistToggle();

                // Restore footer with transition
                const footer = document.querySelector('.app-footer small:first-child');
                if (footer) {
                    footer.style.transition = 'opacity 0.3s ease';
                    footer.style.opacity = '0';
                    setTimeout(() => {
                        footer.textContent = 'Made by Roshin Nishad';
                        footer.classList.remove('mode-active');
                        footer.style.textShadow = '';
                        footer.style.opacity = '1';
                    }, 300);
                }
            } else {
                // Enable persistence
                localStorage.setItem('persistAlt', 'true');
                localStorage.setItem("theme", "alt");
                updatePersistToggle(true);
            }
        });
    }

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
    const providersScrollWindow = document.getElementById("providersScrollWindow");
    const providersScrollLeft = document.getElementById("providersScrollLeft");
    const providersScrollRight = document.getElementById("providersScrollRight");

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
    function updateProviderScrollArrows() {
        if (!providersScrollWindow) return;
        const maxScrollLeft = providersScrollWindow.scrollWidth - providersScrollWindow.clientWidth;
        const showLeft = providersScrollWindow.scrollLeft > 8;
        const showRight = maxScrollLeft - providersScrollWindow.scrollLeft > 8;

        if (providersScrollLeft) {
            providersScrollLeft.classList.toggle("visible", showLeft);
        }
        if (providersScrollRight) {
            providersScrollRight.classList.toggle("visible", showRight);
        }
    }

    // Setup scroll button event listeners
    if (providersScrollLeft && providersScrollWindow) {
        providersScrollLeft.addEventListener("click", () => {
            providersScrollWindow.scrollBy({ left: -220, behavior: "smooth" });
        });
    }

    if (providersScrollRight && providersScrollWindow) {
        providersScrollRight.addEventListener("click", () => {
            providersScrollWindow.scrollBy({ left: 220, behavior: "smooth" });
        });
    }

    if (providersScrollWindow) {
        providersScrollWindow.addEventListener("scroll", updateProviderScrollArrows);
    }

    window.addEventListener("resize", updateProviderScrollArrows);

    function renderSelectedProviders() {
        if (!selectedProvidersContainer) return;

        const allProviders = { ...MAP_PROVIDERS, ...SITE_PROVIDERS };
        const enabledSites = settings.sites.filter(id => allProviders[id]);

        const hasCountyMaps = settings.countyMaps.enabled;
        const hasAnything = enabledSites.length > 0 || hasCountyMaps;

        if (!hasAnything) {
            selectedProvidersContainer.innerHTML = '<span class="no-providers">No providers selected</span>';
            if (providersScrollWindow) providersScrollWindow.scrollLeft = 0;
            updateProviderScrollArrows();
            return;
        }

        let html = enabledSites.map(id => {
            const provider = allProviders[id];
            return `<div class="provider-icon" title="${escapeHTML(provider.label)}">
                <img src="${provider.logo}" alt="${escapeHTML(provider.label)}" onerror="this.style.display='none'" />
            </div>`;
        }).join('');

        // Add county maps icon if enabled
        if (hasCountyMaps) {
            html += `<div class="provider-icon provider-icon-emoji" title="County Maps">🗺️</div>`;
        }

        selectedProvidersContainer.innerHTML = html;
        if (providersScrollWindow) providersScrollWindow.scrollLeft = 0;
        updateProviderScrollArrows();
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

        const prefillableList = getPrefillableCountyMaps();
        const nonPrefillableList = getNonPrefillableCountyMaps();
        const allCountyMaps = Object.values(COUNTY_MAP_PROVIDERS);
        const countyMapsDisabled = !settings.countyMaps.enabled;

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
                <h3 class="settings-section-title">County Maps</h3>
                <p class="settings-section-desc">County-level property and GIS maps</p>
                <div class="provider-list">
                    <div class="provider-item">
                        <div class="provider-info">
                            <div class="provider-logo provider-logo-icon">🗺️</div>
                            <span class="provider-name">Allow County Maps</span>
                            <button class="info-btn" data-info="county-maps-info" aria-label="Info">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="16" x2="12" y2="12"></line>
                                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                </svg>
                            </button>
                        </div>
                        <button class="provider-toggle ${settings.countyMaps.enabled ? 'active' : ''}" 
                                data-provider-id="county-maps-enabled"
                                data-provider-type="county-main"
                                aria-pressed="${settings.countyMaps.enabled}">
                            <span class="toggle-track">
                                <span class="toggle-thumb"></span>
                            </span>
                        </button>
                    </div>
                    <div class="info-popup" id="county-maps-info" style="display: none;">
                        <div class="info-popup-content">
                            <h4>Available County Maps</h4>
                            <p>When enabled, a county map card appears for each address result.</p>
                            <div class="info-list-scroll">
                                <ul>
                                    ${allCountyMaps.map(p => `<li><strong>${escapeHTML(p.label)}</strong> – ${p.canPrefill ? '✅ Supports prefill' : '❌ Manual entry'}</li>`).join('')}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="sub-settings ${countyMapsDisabled ? 'disabled' : ''}">
                    <div class="provider-list">
                        <div class="provider-item sub-setting-item">
                            <div class="provider-info">
                                <span class="provider-name">Auto-open prefillable county maps</span>
                                <button class="info-btn" data-info="prefillable-info" aria-label="Info" ${countyMapsDisabled ? 'disabled' : ''}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <line x1="12" y1="16" x2="12" y2="12"></line>
                                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                    </svg>
                                </button>
                            </div>
                            <button class="provider-toggle ${settings.countyMaps.autoOpenPrefillable ? 'active' : ''}" 
                                    data-provider-id="county-auto-prefillable"
                                    data-provider-type="county-sub"
                                    aria-pressed="${settings.countyMaps.autoOpenPrefillable}"
                                    ${countyMapsDisabled ? 'disabled' : ''}>
                                <span class="toggle-track">
                                    <span class="toggle-thumb"></span>
                                </span>
                            </button>
                        </div>
                        <div class="info-popup" id="prefillable-info" style="display: none;">
                            <div class="info-popup-content">
                                <h4>Prefillable County Maps</h4>
                                <p>These maps support automatic address prefilling in the URL:</p>
                                <ul>
                                    ${prefillableList.length > 0 ? prefillableList.map(p => `<li>${escapeHTML(p.label)}</li>`).join('') : '<li>Currently only: City of Gallup (McKinley County)</li>'}
                                </ul>
                            </div>
                        </div>

                        <div class="provider-item sub-setting-item">
                            <div class="provider-info">
                                <span class="provider-name">Auto-open non-prefillable county maps</span>
                                <button class="info-btn" data-info="non-prefillable-info" aria-label="Info" ${countyMapsDisabled ? 'disabled' : ''}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <line x1="12" y1="16" x2="12" y2="12"></line>
                                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                    </svg>
                                </button>
                            </div>
                            <button class="provider-toggle ${settings.countyMaps.autoOpenNonPrefillable ? 'active' : ''}" 
                                    data-provider-id="county-auto-non-prefillable"
                                    data-provider-type="county-sub"
                                    aria-pressed="${settings.countyMaps.autoOpenNonPrefillable}"
                                    ${countyMapsDisabled ? 'disabled' : ''}>
                                <span class="toggle-track">
                                    <span class="toggle-thumb"></span>
                                </span>
                            </button>
                        </div>
                        <div class="info-popup" id="non-prefillable-info" style="display: none;">
                            <div class="info-popup-content">
                                <h4>Non-Prefillable County Maps</h4>
                                <p>These maps require manual address entry:</p>
                                <div class="info-list-scroll">
                                    <ul>
                                        ${nonPrefillableList.map(p => `<li>${escapeHTML(p.label)}</li>`).join('')}
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div class="provider-item sub-setting-item">
                            <div class="provider-info">
                                <span class="provider-name">Auto-copy short address to clipboard</span>
                                <button class="info-btn" data-info="short-addr-info" aria-label="Info" ${countyMapsDisabled ? 'disabled' : ''}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <line x1="12" y1="16" x2="12" y2="12"></line>
                                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                    </svg>
                                </button>
                            </div>
                            <button class="provider-toggle ${settings.countyMaps.autoCopyShortAddress ? 'active' : ''}" 
                                    data-provider-id="county-auto-copy-short"
                                    data-provider-type="county-sub"
                                    aria-pressed="${settings.countyMaps.autoCopyShortAddress}"
                                    ${countyMapsDisabled ? 'disabled' : ''}>
                                <span class="toggle-track">
                                    <span class="toggle-thumb"></span>
                                </span>
                            </button>
                        </div>
                        <div class="info-popup" id="short-addr-info" style="display: none;">
                            <div class="info-popup-content">
                                <h4>Short Address Format</h4>
                                <p>Many county maps only work with "short addresses" – just the street portion without city, state, or ZIP.</p>
                                <p><strong>Example:</strong></p>
                                <ul>
                                    <li>Full: 115 N Andrews Ave, Fort Lauderdale, FL 33301</li>
                                    <li>Short: 115 N Andrews Ave</li>
                                </ul>
                                <p>When enabled, the short address is copied to your clipboard instead of the full address.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="settings-section">
                <h3 class="settings-section-title">Global Sites</h3>
                <p class="settings-section-desc">Major map services available worldwide</p>
                <div class="provider-list">
                    ${globalSites.map(p => {
            const subtext = p.id === "here-site" ? "Does not support address prefilling" : null;
            return renderProviderToggle(p, settings.sites.includes(p.id), "site", subtext);
        }).join('')}
                    ${renderProviderToggle(SITE_PROVIDERS["usps-site"], settings.sites.includes("usps-site"), "site", "Does not support address prefilling")}
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

        // Add info button listeners
        content.querySelectorAll(".info-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const infoId = btn.dataset.info;
                const popup = document.getElementById(infoId);
                if (popup) {
                    const isVisible = popup.style.display !== 'none';
                    // Hide all popups first
                    content.querySelectorAll('.info-popup').forEach(p => p.style.display = 'none');
                    // Toggle this one
                    popup.style.display = isVisible ? 'none' : 'block';
                }
            });
        });
    }

    function renderProviderToggle(provider, enabled, type, subtext = null) {
        const idAttr = provider.id || provider.key;
        return `
            <div class="provider-item">
                <div class="provider-info">
                    <div class="provider-logo">
                        <img src="${provider.logo}" alt="" onerror="this.parentElement.innerHTML='📍'" />
                    </div>
                    <div class="provider-name-wrap">
                        <span class="provider-name">${escapeHTML(provider.label)}</span>
                        ${subtext ? `<span class="provider-subtext">${escapeHTML(subtext)}</span>` : ''}
                    </div>
                </div>
                <button class="provider-toggle ${enabled ? 'active' : ''}" 
                        data-provider-id="${idAttr}" 
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
        } else if (type === "county-main") {
            settings.countyMaps.enabled = !isActive;
            // If disabling, also disable sub-settings
            if (isActive) {
                settings.countyMaps.autoOpenPrefillable = false;
                settings.countyMaps.autoOpenNonPrefillable = false;
                settings.countyMaps.autoCopyShortAddress = false;
            }
            // Re-render to update sub-settings state
            toggle.classList.toggle("active");
            toggle.setAttribute("aria-pressed", !isActive);
            saveSettings(settings);
            renderSelectedProviders();
            renderSettingsModal();
            return;
        } else if (type === "county-sub") {
            if (id === "county-auto-prefillable") {
                settings.countyMaps.autoOpenPrefillable = !isActive;
            } else if (id === "county-auto-non-prefillable") {
                settings.countyMaps.autoOpenNonPrefillable = !isActive;
            } else if (id === "county-auto-copy-short") {
                settings.countyMaps.autoCopyShortAddress = !isActive;
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
        const countyEnabled = settings.countyMaps.enabled;

        wrap.innerHTML = `
            <div class="line-row">
                <span class="addr">${escapeHTML(address)}</span>
                <div class="spacer"></div>
                <button class="btn go" data-addr="${encodeURIComponent(address)}">Go</button>
            </div>
            ${uspsEnabled ? `<div class="usps-slab" id="usps-${idx}">USPS: (pending)</div>` : ''}
            ${hereEnabled ? `<div class="here-slab" id="here-${idx}">HERE: (pending)</div>` : ''}
            ${countyEnabled ? `<div class="county-slab" id="county-${idx}">County: (waiting for HERE data)</div>` : ''}
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

    function renderHERESuccess(data, slabEl, idx, address) {
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

            // Render county card if enabled
            if (settings.countyMaps.enabled) {
                const countySlab = document.getElementById(`county-${idx}`);
                if (countySlab) {
                    // Try normalized response first, fallback to raw response
                    const county = here.address?.county || data?.raw?.items?.[0]?.address?.county || null;
                    renderCountyCard(countySlab, county, address, idx);
                }
            }
        } catch {
            slabEl.textContent = 'HERE: (parse error)';
            setSlabState(slabEl, 'err');
        }
    }

    function renderCountyCard(slabEl, countyName, fullAddress, idx) {
        const shortAddress = getShortAddress(fullAddress);
        const provider = countyName ? findCountyProvider(countyName) : null;
        const allCountyMaps = Object.values(COUNTY_MAP_PROVIDERS);

        if (provider) {
            // County detected - show detected card
            const url = provider.canPrefill ? provider.buildUrl(shortAddress) : provider.buildUrl();

            // Auto-open if enabled
            const shouldAutoOpen = provider.canPrefill
                ? settings.countyMaps.autoOpenPrefillable
                : settings.countyMaps.autoOpenNonPrefillable;

            if (shouldAutoOpen) {
                // Copy short address to clipboard if not prefillable
                if (!provider.canPrefill && settings.countyMaps.autoCopyShortAddress) {
                    navigator.clipboard.writeText(shortAddress).catch(() => { });
                }
                window.open(url, "_blank", "noopener");
            }
            slabEl.innerHTML = `
                <div class="county-result county-detected">
                    <div class="county-header">
                        <span class="county-icon">🗺️</span>
                        <span class="county-title">County Detected: <strong>${escapeHTML(countyName)}</strong></span>
                    </div>
                    <div class="county-action">
                        <span class="county-prompt">Open 
                            <a href="${escapeHTML(url)}" target="_blank" rel="noopener" class="county-link" title="${escapeHTML(url)}">${escapeHTML(provider.label)}</a>?
                        </span>
                        <span class="county-note">${provider.canPrefill ? 'Address will be prefilled' : 'Copies short address to clipboard'}</span>
                    </div>
                    <button class="btn county-go" 
                            data-county-key="${provider.key}" 
                            data-short-addr="${encodeURIComponent(shortAddress)}"
                            data-can-prefill="${provider.canPrefill}">Go</button>
                </div>
            `;
            setSlabState(slabEl, 'ok');
        } else {
            // County not detected - show dropdown
            slabEl.innerHTML = `
                <div class="county-result county-not-detected">
                    <div class="county-header">
                        <span class="county-icon">🗺️</span>
                        <span class="county-title">Unable to detect county</span>
                    </div>
                    <div class="county-action">
                        <span class="county-prompt">Would you like to open a county map?</span>
                        <span class="county-note">Copies short address to clipboard</span>
                    </div>
                    <div class="county-select-row">
                        <select class="county-select" id="county-select-${idx}">
                            <option value="">Select a county...</option>
                            ${allCountyMaps.map(p => `<option value="${p.key}">${escapeHTML(p.label)}</option>`).join('')}
                        </select>
                        <button class="btn county-go-manual" 
                                data-idx="${idx}"
                                data-short-addr="${encodeURIComponent(shortAddress)}">Go</button>
                    </div>
                </div>
            `;
            setSlabState(slabEl, 'warn');
        }
    }

    function renderCountyCardError(slabEl, fullAddress, idx) {
        const shortAddress = getShortAddress(fullAddress);
        const allCountyMaps = Object.values(COUNTY_MAP_PROVIDERS);

        slabEl.innerHTML = `
            <div class="county-result county-not-detected">
                <div class="county-header">
                    <span class="county-icon">🗺️</span>
                    <span class="county-title">County detection unavailable</span>
                </div>
                <div class="county-action">
                    <span class="county-prompt">Would you like to open a county map?</span>
                    <span class="county-note">Copies short address to clipboard</span>
                </div>
                <div class="county-select-row">
                    <select class="county-select" id="county-select-${idx}">
                        <option value="">Select a county...</option>
                        ${allCountyMaps.map(p => `<option value="${p.key}">${escapeHTML(p.label)}</option>`).join('')}
                    </select>
                    <button class="btn county-go-manual" 
                            data-idx="${idx}"
                            data-short-addr="${encodeURIComponent(shortAddress)}">Go</button>
                </div>
            </div>
        `;
        setSlabState(slabEl, 'warn');
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

        // Handle County Go button (detected county)
        const countyGoBtn = e.target.closest(".county-go");
        if (countyGoBtn) {
            const providerKey = countyGoBtn.dataset.countyKey;
            const shortAddr = decodeURIComponent(countyGoBtn.dataset.shortAddr);
            const canPrefill = countyGoBtn.dataset.canPrefill === 'true';
            const provider = COUNTY_MAP_PROVIDERS[providerKey];

            if (provider) {
                // Copy short address to clipboard
                try {
                    await navigator.clipboard.writeText(shortAddr);
                    const old = countyGoBtn.textContent;
                    countyGoBtn.textContent = "Copied!";
                    setTimeout(() => (countyGoBtn.textContent = old), 800);
                } catch (err) {
                    console.warn("Clipboard copy failed:", err);
                }

                // Open the county map
                const url = canPrefill ? provider.buildUrl(shortAddr) : provider.buildUrl();
                window.open(url, "_blank", "noopener");
            }
            return;
        }

        // Handle County Go Manual button (dropdown)
        const countyGoManualBtn = e.target.closest(".county-go-manual");
        if (countyGoManualBtn) {
            const idx = countyGoManualBtn.dataset.idx;
            const shortAddr = decodeURIComponent(countyGoManualBtn.dataset.shortAddr);
            const select = document.getElementById(`county-select-${idx}`);

            if (select && select.value) {
                const provider = COUNTY_MAP_PROVIDERS[select.value];
                if (provider) {
                    // Copy short address to clipboard
                    try {
                        await navigator.clipboard.writeText(shortAddr);
                        const old = countyGoManualBtn.textContent;
                        countyGoManualBtn.textContent = "Copied!";
                        setTimeout(() => (countyGoManualBtn.textContent = old), 800);
                    } catch (err) {
                        console.warn("Clipboard copy failed:", err);
                    }

                    // Open the county map
                    const url = provider.canPrefill ? provider.buildUrl(shortAddr) : provider.buildUrl();
                    window.open(url, "_blank", "noopener");
                }
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
        const shortAddress = getShortAddress(address);

        // Copy to clipboard - use short address if setting is enabled
        const clipboardText = settings.countyMaps.autoCopyShortAddress ? shortAddress : address;
        try {
            await navigator.clipboard.writeText(clipboardText);
            const old = btn.textContent;
            btn.textContent = settings.countyMaps.autoCopyShortAddress ? "Short copied!" : "Copied!";
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
                        // Still try to show county card if enabled
                        if (settings.countyMaps.enabled) {
                            const countySlab = document.getElementById(`county-${idx}`);
                            if (countySlab) {
                                renderCountyCardError(countySlab, address, idx);
                            }
                        }
                    } else if (data.here) {
                        renderHERESuccess(data, hereSlab, idx, address);
                    } else {
                        hereSlab.textContent = 'HERE: (no result)';
                        setSlabState(hereSlab, 'err');
                        // Still try to show county card if enabled
                        if (settings.countyMaps.enabled) {
                            const countySlab = document.getElementById(`county-${idx}`);
                            if (countySlab) {
                                renderCountyCardError(countySlab, address, idx);
                            }
                        }
                    }
                } catch (err) {
                    hereSlab.textContent = `HERE: (error) ${err.message}`;
                    setSlabState(hereSlab, 'err');
                    // Still try to show county card if enabled
                    if (settings.countyMaps.enabled) {
                        const countySlab = document.getElementById(`county-${idx}`);
                        if (countySlab) {
                            renderCountyCardError(countySlab, address, idx);
                        }
                    }
                }
            })();
        } else if (settings.countyMaps.enabled && !settings.apis.includes("here-api")) {
            // HERE API not enabled but county maps is - show manual selection
            const countySlab = document.getElementById(`county-${idx}`);
            if (countySlab) {
                renderCountyCardError(countySlab, address, idx);
            }
        }
    });

    // =========================================================================
    // BRAND INTERACTION
    // =========================================================================
    const brandElement = document.querySelector('.brand');
    let clickCount = 0;
    let clickTimer = null;

    if (brandElement) {
        brandElement.addEventListener('click', () => {
            clickCount++;

            if (clickTimer) {
                clearTimeout(clickTimer);
            }

            clickTimer = setTimeout(() => {
                clickCount = 0;
            }, 500);

            if (clickCount === 3) {
                clickCount = 0;
                clearTimeout(clickTimer);
                activateAltMode();
            }
        });
    }

    function activateAltMode() {
        const footer = document.querySelector('.app-footer small:first-child');
        if (!footer) return;

        if (footer.classList.contains('mode-active')) return;

        createSparkles(footer);

        body.style.transition = 'background 0.8s ease, background-image 0.8s ease';
        body.setAttribute('data-theme', 'alt');

        sessionStorage.setItem('specialMode', 'true');

        footer.classList.add('mode-active');

        footer.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        footer.style.opacity = '0';
        footer.style.transform = 'translateY(-10px)';

        setTimeout(() => {
            footer.textContent = 'Made by 💖 Hazeline Nishad 💖';
            footer.style.transform = 'translateY(10px)';

            setTimeout(() => {
                footer.style.opacity = '1';
                footer.style.transform = 'translateY(0)';

                footer.style.textShadow = '0 0 20px rgba(245, 169, 184, 0.8), 0 0 40px rgba(91, 206, 250, 0.5)';

                setTimeout(() => {
                    footer.style.textShadow = '0 0 10px rgba(245, 169, 184, 0.3)';
                }, 2000);
            }, 50);
        }, 400);

        updateThemeToggle('alt');

        // Show persist toggle and set its initial state
        showPersistToggle();
        updatePersistToggle(localStorage.getItem('persistAlt') === 'true');
    }

    function createSparkles(element) {
        const rect = element.getBoundingClientRect();
        const colors = ['#FFB6C1', '#FFC0CB', '#DDA0DD', '#8AB4F8', '#98D8C8', '#F7DC6F'];

        for (let i = 0; i < 15; i++) {
            const sparkle = document.createElement('div');
            sparkle.className = 'sparkle';
            sparkle.style.cssText = `
                position: fixed;
                left: ${rect.left + rect.width / 2}px;
                top: ${rect.top + rect.height / 2}px;
                width: 8px;
                height: 8px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                border-radius: 50%;
                pointer-events: none;
                z-index: 9999;
                box-shadow: 0 0 10px currentColor;
            `;

            document.body.appendChild(sparkle);

            const angle = (Math.PI * 2 * i) / 15;
            const velocity = 100 + Math.random() * 100;
            const tx = Math.cos(angle) * velocity;
            const ty = Math.sin(angle) * velocity;

            sparkle.animate([
                {
                    transform: 'translate(0, 0) scale(1)',
                    opacity: 1
                },
                {
                    transform: `translate(${tx}px, ${ty}px) scale(0)`,
                    opacity: 0
                }
            ], {
                duration: 800 + Math.random() * 400,
                easing: 'cubic-bezier(0, 0.5, 0.5, 1)'
            }).onfinish = () => sparkle.remove();
        }
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================
    renderSelectedProviders();
})();
