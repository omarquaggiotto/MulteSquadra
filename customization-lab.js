(function () {
    const isGeneric = true;
    const categoryPalette = ["#16a34a", "#2563eb", "#db2777", "#d97706", "#0891b2", "#7c3aed", "#64748b", "#dc2626", "#0d9488", "#9333ea"];
    const defaults = {
        shortName: "Multe Squadra",
        fullName: state?.team || "Squadra",
        motto: "Stessi amici. Più responsabilità.",
        linkType: "tuttocampo",
        publicUrl: state?.seasonConfig?.teamProfile?.teamUrl || "",
        primary: "#2563eb",
        secondary: "#1d4ed8",
        accent: "#60a5fa",
        colorsCustomized: false,
        currency: "EUR",
        feesEnabled: true,
        feeMode: "monthly",
        entryFee: 0,
        finesEnabled: true,
        exportBirthdays: false,
        exportPhotos: true
    };

    function ensureCustomization() {
        state.teamCustomization = { ...defaults, ...(state.teamCustomization || {}) };
        if (isGS && [["#8b1e2d", "#e8b44f"], ["#2563eb", "#1d4ed8"]].some(([primary, secondary]) => state.teamCustomization.primary === primary && state.teamCustomization.secondary === secondary)) {
            state.teamCustomization.primary = defaults.primary;
            state.teamCustomization.secondary = defaults.secondary;
            state.teamCustomization.accent = defaults.accent;
            state.teamCustomization.colorsCustomized = false;
        }
        if (state.teamCustomization.linkType === "tuttocampo" && !state.teamCustomization.publicUrl) {
            state.teamCustomization.publicUrl = defaults.publicUrl;
        }
        state.memberProfiles = state.memberProfiles && typeof state.memberProfiles === "object" ? state.memberProfiles : {};
        state.categorySettings = state.categorySettings && typeof state.categorySettings === "object" ? state.categorySettings : {};
        state.manualMatches = Array.isArray(state.manualMatches) ? state.manualMatches : [];
        getSortedCategories(state.rules.map(rule => rule.category)).forEach((name, index) => {
            const current = state.categorySettings[name] || {};
            state.categorySettings[name] = {
                color: /^#[0-9a-f]{6}$/i.test(current.color || "") ? current.color : categoryPalette[index % categoryPalette.length],
                order: Number.isFinite(Number(current.order)) ? Number(current.order) : index
            };
        });
        state.rules.forEach((rule, index) => {
            if (!rule.audience) rule.audience = "players";
            if (!Number.isFinite(Number(rule.sortOrder))) rule.sortOrder = index;
        });
        state.players.forEach(name => {
            const memberDefaults = {
                type: "player", role: "", jersey: "", joinedAt: "", active: true,
                paysFees: true, paysFines: true, customMonthlyFee: "", discount: 0
            };
            const current = state.memberProfiles[name] && typeof state.memberProfiles[name] === "object" ? state.memberProfiles[name] : {};
            Object.entries(memberDefaults).forEach(([key, value]) => { if (current[key] === undefined) current[key] = value; });
            state.memberProfiles[name] = current;
        });
    }

    function profile(name) {
        ensureCustomization();
        return state.memberProfiles[name];
    }

    function applyTeamStyle() {
        ensureCustomization();
        const config = state.teamCustomization;
        if (config.colorsCustomized) {
            document.documentElement.style.setProperty("--primary", config.primary);
            document.documentElement.style.setProperty("--primary-dark", config.secondary);
            document.documentElement.style.setProperty("--preview-accent", config.accent);
        } else {
            document.documentElement.style.removeProperty("--primary");
            document.documentElement.style.removeProperty("--primary-dark");
            document.documentElement.style.removeProperty("--preview-accent");
        }
        const title = document.querySelector(".brand-title, .topbar h1");
        if (title && config.shortName) title.textContent = config.shortName;
        document.title = config.shortName || "Multe Squadra";
        const teamId = Number(state.seasonConfig?.tuttocampoTeamId) || 0;
        const iconUrl = teamId ? `/__team-icon?teamId=${teamId}` : getTeamLogo();
        document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]').forEach(link => { link.href = iconUrl; });
        const manifest = document.querySelector('link[rel="manifest"]');
        if (manifest && teamId) manifest.href = `/__team-manifest?teamId=${teamId}&name=${encodeURIComponent(config.shortName || "Multe Squadra")}&color=${encodeURIComponent(config.primary || "#2563eb")}`;
        const teamLink = document.querySelector(".team-link");
        if (teamLink) {
            if (!teamLink.dataset.defaultHref) teamLink.dataset.defaultHref = teamLink.href;
            const selectedUrl = config.publicUrl && /^https:\/\//i.test(config.publicUrl) ? config.publicUrl : teamLink.dataset.defaultHref;
            teamLink.href = selectedUrl;
            const destination = config.linkType === "website" ? "sito ufficiale" : "Tuttocampo";
            teamLink.title = `${config.fullName} · ${destination}`;
            teamLink.setAttribute("aria-label", `${config.fullName} · apri ${destination}`);
        }
    }

    function memberRows() {
        return getSortedPlayers().map(name => {
            const item = profile(name);
            return `<article class="custom-member-row" data-member-row="${escapeHtml(name)}">
                <div class="custom-member-head">${playerPortrait(name)}<div><strong>${escapeHtml(name)}</strong><small>${item.active ? "In rosa" : "Archiviato"} · ${item.type === "staff" ? "Staff" : "Giocatore"}</small></div></div>
                <div class="custom-member-grid">
                    <label>Gruppo<select data-member-field="type"><option value="player" ${item.type === "player" ? "selected" : ""}>Giocatore</option><option value="staff" ${item.type === "staff" ? "selected" : ""}>Staff</option></select></label>
                    <label>Ruolo<input data-member-field="role" value="${escapeHtml(item.role)}" placeholder="Es. Portiere"></label>
                    <label>Numero<input data-member-field="jersey" value="${escapeHtml(item.jersey)}" inputmode="numeric" placeholder="—"></label>
                    <label>Entrato il<input data-member-field="joinedAt" type="date" value="${escapeHtml(item.joinedAt)}"></label>
                    <label>Quota personale<input data-member-field="customMonthlyFee" type="number" min="0" step="0.5" value="${escapeHtml(item.customMonthlyFee)}" placeholder="Standard"></label>
                    <label>Sconto %<input data-member-field="discount" type="number" min="0" max="100" value="${Number(item.discount) || 0}"></label>
                </div>
                <div class="custom-member-toggles"><label><input data-member-field="active" type="checkbox" ${item.active ? "checked" : ""}> In rosa</label><label><input data-member-field="paysFees" type="checkbox" ${item.paysFees ? "checked" : ""}> Paga quote</label><label><input data-member-field="paysFines" type="checkbox" ${item.paysFines ? "checked" : ""}> Riceve multe</label></div>
            </article>`;
        }).join("");
    }

    function ruleRows() {
        return [...state.rules].sort((a,b) => Number(a.sortOrder)-Number(b.sortOrder)).map(rule => `
            <article class="custom-rule-row" data-rule-custom="${rule.id}"><div><strong>${escapeHtml(rule.type)}</strong><small>${escapeHtml(rule.category)} · ${formatRuleAmount(rule)}</small></div>
            <select data-rule-audience><option value="players" ${rule.audience === "players" ? "selected" : ""}>Giocatori</option><option value="staff" ${rule.audience === "staff" ? "selected" : ""}>Staff</option><option value="all" ${rule.audience === "all" ? "selected" : ""}>Tutti</option></select>
            <button class="btn secondary" type="button" data-duplicate-rule>Duplica</button></article>`).join("");
    }

    function categoryRows() {
        return getSortedCategories(state.rules.map(rule => rule.category)).map((name, index) => {
            const setting = state.categorySettings[name];
            const historical = state.fines.filter(fine => fine.category === name).length;
            return `<article class="custom-category-row" data-category-original="${escapeHtml(name)}" data-category-order="${index}">
                <span class="custom-category-swatch" style="--swatch:${escapeHtml(setting.color)}"></span>
                <div><input data-category-name value="${escapeHtml(name)}" aria-label="Nome categoria ${escapeHtml(name)}"><small>${state.rules.filter(rule => rule.category === name).length} regole · ${historical} multe storiche</small></div>
                <input data-category-color type="color" value="${escapeHtml(setting.color)}" aria-label="Colore categoria ${escapeHtml(name)}">
                <div class="custom-category-order"><button type="button" data-category-up aria-label="Sposta ${escapeHtml(name)} in alto">↑</button><button type="button" data-category-down aria-label="Sposta ${escapeHtml(name)} in basso">↓</button></div>
            </article>`;
        }).join("");
    }

    function manualMatchRows() {
        return state.manualMatches.map(match => `<article class="custom-match-row" data-manual-match="${match.id}"><div><strong>${escapeHtml(match.home)} – ${escapeHtml(match.away)}</strong><small>${escapeHtml(match.date)} · ${escapeHtml(match.time)} · ${escapeHtml(match.competition)}</small></div><button class="icon-mini" data-remove-manual-match type="button" aria-label="Rimuovi partita">×</button></article>`).join("") || `<p class="small muted">Nessuna partita manuale inserita.</p>`;
    }

    function openCustomizationLab() {
        if (!requireOnlineAdmin()) return;
        ensureCustomization();
        const c = state.teamCustomization;
        openModal("Personalizza squadra", `<div class="customization-lab">
            <section class="custom-lab-hero"><span>PERSONALIZZAZIONE</span><h3>Configura l’app della squadra</h3><p>Identità e Multario vengono aggiornati mantenendo compatibili tutti i dati esistenti.</p></section>
            <details open><summary><b>01</b><span><strong>Identità</strong><small>Nome, colori e collegamenti</small></span></summary><div class="custom-panel-grid">
                <label>Nome app<input id="customShortName" value="${escapeHtml(c.shortName)}"></label><label>Nome completo<input id="customFullName" value="${escapeHtml(c.fullName)}"></label>
                <label class="wide">Motto<input id="customMotto" value="${escapeHtml(c.motto)}"></label><label>Destinazione icona squadra<select id="customLinkType"><option value="tuttocampo" ${c.linkType === "tuttocampo" ? "selected" : ""}>Pagina Tuttocampo</option><option value="website" ${c.linkType === "website" ? "selected" : ""}>Sito della squadra</option></select></label><label>Link collegato allo stemma<input id="customPublicUrl" type="url" value="${escapeHtml(c.publicUrl)}" placeholder="https://..."></label>
                <label>Colore principale<input id="customPrimary" type="color" value="${c.primary}"></label><label>Colore secondario<input id="customSecondary" type="color" value="${c.secondary}"></label><label>Colore accento<input id="customAccent" type="color" value="${c.accent}"></label>
            </div></details>
            <details><summary><b>02</b><span><strong>Report</strong><small>Contenuti dei riepiloghi esportati</small></span></summary><div class="custom-panel-grid">
                <label class="custom-switch"><input id="customExportPhotos" type="checkbox" ${c.exportPhotos ? "checked" : ""}> Includi le foto</label><label class="custom-switch"><input id="customExportBirthdays" type="checkbox" ${c.exportBirthdays ? "checked" : ""}> Includi i compleanni</label>
            </div></details>
            <details><summary><b>03</b><span><strong>Categorie Multario</strong><small>Colori, nomi e ordine delle categorie</small></span></summary><div class="custom-category-list" id="customCategoryList">${categoryRows()}</div><label class="custom-history-choice"><input id="renameHistoricalCategories" type="checkbox"> Applica le rinomine anche alle multe già registrate</label><p class="small muted custom-panel-note">Lasciando questa opzione disattivata, lo storico conserva il vecchio nome. Nessuna multa viene eliminata.</p></details>
            <details><summary><b>04</b><span><strong>Destinatari Multario</strong><small>Definisci a chi si applica ogni regola</small></span></summary><div class="custom-rule-list">${ruleRows()}</div><div class="custom-inline-actions"><button class="btn secondary" id="exportRulesOnly" type="button">Esporta Multario</button></div></details>
            <div class="modal-actions custom-sticky-actions"><button class="btn secondary" id="cancelCustomization" type="button">Annulla</button><button class="btn" id="saveCustomization" type="button">Salva anteprima</button></div>
        </div>`);
        document.querySelector("#modalRoot .modal")?.classList.add("customization-modal");
        document.getElementById("cancelCustomization").onclick = closeModal;
        ["customPrimary","customSecondary","customAccent"].forEach(id => document.getElementById(id).oninput = () => {
            document.documentElement.style.setProperty(id === "customPrimary" ? "--primary" : id === "customSecondary" ? "--primary-dark" : "--preview-accent", document.getElementById(id).value);
        });
        document.querySelectorAll("[data-duplicate-rule]").forEach(button => button.onclick = () => {
            const id = Number(button.closest("[data-rule-custom]").dataset.ruleCustom);
            const original = state.rules.find(rule => rule.id === id);
            if (!original) return;
            state.rules.push({ ...structuredClone(original), id: generateId(), type: `${original.type} (copia)`, sortOrder: state.rules.length });
            saveState(); closeModal(); openCustomizationLab(); showToast("Regola duplicata.");
        });
        document.getElementById("exportRulesOnly").onclick = () => {
            const blob = new Blob([JSON.stringify({ app: c.shortName, exportedAt: new Date().toISOString(), rules: state.rules }, null, 2)], {type:"application/json"});
            const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `multario-${state.season}.json`; link.click(); URL.revokeObjectURL(link.href);
        };
        const refreshCategoryOrder = () => document.querySelectorAll("[data-category-original]").forEach((row, index) => row.dataset.categoryOrder = index);
        document.querySelectorAll("[data-category-up],[data-category-down]").forEach(button => button.onclick = () => {
            const row = button.closest("[data-category-original]");
            const sibling = button.hasAttribute("data-category-up") ? row.previousElementSibling : row.nextElementSibling;
            if (!sibling) return;
            if (button.hasAttribute("data-category-up")) row.parentElement.insertBefore(row, sibling); else row.parentElement.insertBefore(sibling, row);
            refreshCategoryOrder();
        });
        document.querySelectorAll("[data-category-color]").forEach(input => input.oninput = () => input.closest("[data-category-original]").querySelector(".custom-category-swatch").style.setProperty("--swatch", input.value));
        document.getElementById("saveCustomization").onclick = () => {
            const publicUrl = document.getElementById("customPublicUrl").value.trim();
            if (publicUrl && !/^https:\/\//i.test(publicUrl)) return showToast("Inserisci un link completo che inizi con https://");
            const categoryRows = [...document.querySelectorAll("[data-category-original]")];
            const categoryNames = categoryRows.map(row => row.querySelector("[data-category-name]").value.trim());
            if (categoryNames.some(name => !name)) return showToast("Ogni categoria deve avere un nome.");
            if (new Set(categoryNames.map(name => name.toLocaleLowerCase("it"))).size !== categoryNames.length) return showToast("Due categorie non possono avere lo stesso nome.");
            const renameHistory = document.getElementById("renameHistoricalCategories").checked;
            const nextCategorySettings = {};
            categoryRows.forEach((row, index) => {
                const original = row.dataset.categoryOriginal;
                const next = row.querySelector("[data-category-name]").value.trim();
                const color = row.querySelector("[data-category-color]").value;
                state.rules.forEach(rule => { if (rule.category === original) rule.category = next; });
                if (renameHistory) state.fines.forEach(fine => { if (fine.category === original) fine.category = next; });
                nextCategorySettings[next] = { color, order: index };
            });
            state.categorySettings = nextCategorySettings;
            state.teamCustomization = { ...state.teamCustomization, shortName: document.getElementById("customShortName").value.trim() || defaults.shortName, fullName: document.getElementById("customFullName").value.trim() || defaults.fullName, motto: document.getElementById("customMotto").value.trim(), linkType: document.getElementById("customLinkType").value, publicUrl, primary: document.getElementById("customPrimary").value, secondary: document.getElementById("customSecondary").value, accent: document.getElementById("customAccent").value, colorsCustomized: true, exportPhotos: document.getElementById("customExportPhotos").checked, exportBirthdays: document.getElementById("customExportBirthdays").checked };
            state.team = state.teamCustomization.fullName;
            document.querySelectorAll("[data-rule-custom]").forEach(row => { const rule=state.rules.find(item=>item.id===Number(row.dataset.ruleCustom)); if(rule) rule.audience=row.querySelector("[data-rule-audience]").value; });
            saveState(); closeModal(); render(); showToast("Personalizzazioni salvate.");
        };
    }

    function enhanceSettings() {
        if (currentPage !== "settings" || document.getElementById("openCustomizationLab")) return;
        const page = document.querySelector(".settings-page");
        if (!page) return;
        page.querySelector(".team-settings-details")?.remove();
        page.insertAdjacentHTML("afterbegin", `<section class="card customization-entry"><div><span>ASPETTO</span><h2>Personalizza squadra</h2><p>Nome, colori, collegamento dello stemma e contenuti dei report.</p></div><button class="btn" id="openCustomizationLab" type="button">Configura</button></section>`);
        document.getElementById("openCustomizationLab").onclick = openCustomizationLab;
    }

    ensureCustomization();
    const originalPlayerMonthBase = getPlayerMonthBase;
    getPlayerMonthBase = function (player, monthId) {
        ensureCustomization();
        const config = state.teamCustomization;
        const member = profile(player);
        if (!config.feesEnabled || config.feeMode === "none" || member.active === false || member.paysFees === false || monthId < getPlayerStartMonth(player)) return 0;
        const standardMonthly = member.customMonthlyFee !== "" && member.customMonthlyFee !== null
            ? Math.max(0, Number(member.customMonthlyFee) || 0)
            : originalPlayerMonthBase(player, monthId);
        const monthly = standardMonthly * (1 - Math.min(100, Math.max(0, Number(member.discount) || 0)) / 100);
        const entry = monthId === getPlayerStartMonth(player) ? Math.max(0, Number(config.entryFee) || 0) : 0;
        if (config.feeMode === "entry") return entry;
        if (config.feeMode === "monthly_entry") return monthId === getPlayerStartMonth(player) ? entry : monthly;
        return monthly;
    };
    const originalRender = render;
    render = function () { originalRender(); applyTeamStyle(); enhanceSettings(); };
    applyTeamStyle();
    enhanceSettings();
})();
