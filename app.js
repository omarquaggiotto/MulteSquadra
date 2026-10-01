/* =========================================================
   MulteFC
   APP.JS
   ========================================================= */

const LOCAL_CUSTOMIZATION_PREVIEW = /^(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)$/i.test(location.hostname);
const STORAGE_KEY = LOCAL_CUSTOMIZATION_PREVIEW ? "multesquadra_preview_v1" : "multesquadra_v1";
const THEME_STORAGE_KEY = "multesquadra_theme_v1";
const AUTO_BACKUP_STORAGE_KEY = "multesquadra_auto_backup_v1";
const ADMIN_USERNAME = "admin";
const usernameEmail = value => `${String(value || "").trim().toLowerCase()}@login.multesquadra.app`;
const DEFAULT_TEAM_ID = 0;

const RUNTIME_CONFIG = Object.freeze(window.__MULTE_CONFIG__ || {});
const SUPABASE_URL = String(RUNTIME_CONFIG.supabaseUrl || "");
const SUPABASE_PUBLISHABLE_KEY = String(RUNTIME_CONFIG.supabaseAnonKey || "");
const supabaseClient = !LOCAL_CUSTOMIZATION_PREVIEW && SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY && window.supabase?.createClient
    ? window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        }
    )
    : null;

let authUser = null;
let isAdmin = LOCAL_CUSTOMIZATION_PREVIEW && sessionStorage.getItem("multesquadra_admin_session") === "1";
if (isAdmin) authUser = { local:true };
let cloudReady = false;
let cloudChannel = null;
let cloudSaveTimer = null;
let activeCloudTeamId = "";
let activeCloudRole = "viewer";
let cloudStateVersion = 0;
let modalScrollPosition = 0;
let pendingCalendarImports = { league: null, cup: null };
let pendingTeamLogo = null;



/* =========================================================
   DATI INIZIALI
   ========================================================= */

const defaultState = {

    team: "Multe Squadra",

    teamLogo: "assets/icon.svg",

    season: "2026/27",

    seasonConfig: {
        tuttocampoTeamId: DEFAULT_TEAM_ID,
        teamProfile: null,
        monthlyBase: 5,
        paymentStartMonth: 8,
        paymentEndMonth: 5,
        paymentFrequency: "monthly",
        paymentMode: "due_day",
        paymentDueDay: 15,
        monthOverrides: { "08": 10 },
        calendarSources: [
            { type: "league", name: "Campionato", enabled: true, url: "" },
            { type: "cup", name: "Coppa", enabled: false, dynamic: true, refreshPolicy: "after_match", url: "" }
        ]
    },

    seasonArchives: [],

    theme: "light",

    players: [],

    playerStartMonths: {},

    fines: [],

payments: {},

rules: [

    {
        id: 1,
        category: "Allenamento",
        type: "Ritardo all'allenamento senza aver avvisato almeno un'ora prima il mister",
        amount: 2,
        calculation: "per_minute",
        baseAmount: 2,
        perMinute: 1
    },

    {
        id: 2,
        category: "Allenamento",
        type: "Assenza all'allenamento senza avvisare il mister",
        amount: 10,
        calculation: "fixed"
    },

    {
        id: 3,
        category: "Partita",
        type: "Ritardo rispetto all'orario di convocazione senza aver avvisato almeno un'ora prima il mister",
        amount: 5,
        calculation: "per_minute",
        baseAmount: 5,
        perMinute: 1
    },

    {
        id: 4,
        category: "Partita",
        type: "Assenza alla partita senza avvisare il mister",
        amount: 50,
        calculation: "fixed"
    },

    {
        id: 5,
        category: "Partita",
        type: "Assenza birra post partita",
        amount: 2,
        calculation: "fixed"
    },

    {
        id: 6,
        category: "Materiale",
        type: "Dimenticanza materiale per allenamento/partita",
        amount: 2,
        calculation: "per_piece",
        perPiece: 2
    },

    {
        id: 7,
        category: "Partita",
        type: "Dimenticanza tuta di rappresentanza alla partita",
        amount: 10,
        calculation: "fixed"
    },

    {
        id: 8,
        category: "Partita",
        type: "Dimenticanza documento alla partita",
        amount: 10,
        calculation: "fixed"
    },

    {
        id: 9,
        category: "Materiale",
        type: "Dimenticanza materiale personale per doccia",
        amount: 2,
        calculation: "per_piece",
        perPiece: 2
    },

    {
        id: 10,
        category: "Materiale",
        type: "Dimenticanza materiale in spogliatoio",
        amount: 2,
        calculation: "fixed"
    },

    {
        id: 11,
        category: "Materiale",
        type: "Mancato rispetto del turno di raccolta materiale post allenamento",
        amount: 2,
        calculation: "fixed"
    },

    {
        id: 12,
        category: "Spogliatoio",
        type: "Pisciata in doccia",
        amount: 5,
        calculation: "fixed"
    },

    {
        id: 13,
        category: "Spogliatoio",
        type: "Utilizzo/squillo cellulare durante riunioni",
        amount: 5,
        calculation: "fixed"
    },

    {
        id: 14,
        category: "Partita",
        type: "Pallone calciato fuori dal campo",
        amount: 5,
        calculation: "fixed"
    },

    {
        id: 15,
        category: "Comportamento",
        type: "Mancanza di rispetto verso compagni/mister/dirigenti",
        amount: 15,
        calculation: "fixed"
    },

    {
        id: 16,
        category: "Allenamento",
        type: "Squadra perdente la partitella del giovedì",
        amount: 1,
        calculation: "fixed"
    },

    {
        id: 17,
        category: "Allenamento",
        type: "Torello: 20 passaggi / errore al 19° passaggio",
        amount: 1,
        calculation: "fixed"
    },

    {
        id: 18,
        category: "Partita",
        type: "Ammonizione per protesta e/o reazione",
        amount: 10,
        calculation: "fixed"
    },

    {
        id: 19,
        category: "Partita",
        type: "Espulsione per protesta e/o reazione",
        amount: 20,
        calculation: "fixed"
    },

    {
        id: 20,
        category: "Allenamento",
        type: "Allenamento svolto con svogliatezza/senza impegno",
        amount: 2,
        calculation: "custom_min",
        minAmount: 2
    },

    {
        id: 21,
        category: "Partita",
        type: "Impiego di troppo tempo per farsi la doccia",
        amount: 5,
        calculation: "custom_min",
        minAmount: 5
    },

    {
        id: 22,
        category: "Squadra",
        type: "Mancanza di condivisione compleanni (cibo, birra/bevande)",
        amount: 20,
        calculation: "fixed"
    }

]

};


/* =========================================================
   STATO APP
   ========================================================= */

let state = loadState();
applyImportedCalendar();
applyLocalCupPreview();
let deviceTheme = getDeviceTheme(state.theme);

let currentPage = "home";
let pageBeforeSettings = "home";
let selectedMonth = "all";
let selectedPaymentMonth = "";
let selectedFinePlayer = "all";
let showAllRanking = false;
let showMonthlySummary = false;
let showAllOverduePlayers = false;
let overdueMonthView = "previous";
let fineSearchQuery = "";
let undoSnapshot = null;
let undoTimer = null;
let reloadForServiceWorkerUpdate = false;


/* =========================================================
   STORAGE
   ========================================================= */

function loadState() {

    try {

        const saved =
            localStorage.getItem(STORAGE_KEY);

        if (saved) {

            const loaded =
                JSON.parse(saved);


            loaded.team =
                typeof loaded.team === "string" &&
                loaded.team.trim()
                    ? loaded.team
                    : defaultState.team;

            loaded.teamLogo = typeof loaded.teamLogo === "string" && (loaded.teamLogo === "assets/icon.svg" || /^data:image\/(png|webp|jpeg);base64,/i.test(loaded.teamLogo) || /^https:\/\/b2-content\.tuttocampo\.it\/Teams\/Original\//i.test(loaded.teamLogo))
                ? loaded.teamLogo
                : defaultState.teamLogo;

            loaded.season =
                typeof loaded.season === "string" &&
                loaded.season.trim()
                    ? loaded.season
                    : defaultState.season;

            const savedSeasonConfig = loaded.seasonConfig && typeof loaded.seasonConfig === "object"
                ? loaded.seasonConfig
                : {};
            loaded.seasonConfig = {
                tuttocampoTeamId: Number(savedSeasonConfig.tuttocampoTeamId) || DEFAULT_TEAM_ID,
                teamProfile: savedSeasonConfig.teamProfile && typeof savedSeasonConfig.teamProfile === "object" ? structuredClone(savedSeasonConfig.teamProfile) : null,
                monthlyBase: Math.max(0, Number(savedSeasonConfig.monthlyBase ?? 5) || 0),
                paymentStartMonth: Math.min(12, Math.max(1, Number(savedSeasonConfig.paymentStartMonth ?? 8) || 8)),
                paymentEndMonth: Math.min(12, Math.max(1, Number(savedSeasonConfig.paymentEndMonth ?? 5) || 5)),
                paymentFrequency: "monthly",
                paymentMode: savedSeasonConfig.paymentMode === "rolling" ? "rolling" : "due_day",
                paymentDueDay: Math.min(28, Math.max(1, Number(savedSeasonConfig.paymentDueDay ?? 15) || 15)),
                monthOverrides: savedSeasonConfig.monthOverrides && typeof savedSeasonConfig.monthOverrides === "object"
                    ? { ...savedSeasonConfig.monthOverrides }
                    : { "08": 10 },
                calendarSources: Array.isArray(savedSeasonConfig.calendarSources)
                    ? savedSeasonConfig.calendarSources.map(source => ({
                        type: source?.type === "cup" ? "cup" : "league",
                        name: String(source?.name || (source?.type === "cup" ? "Coppa" : "Campionato")),
                        enabled: source?.enabled !== false,
                        dynamic: source?.type === "cup" ? source?.dynamic !== false : false,
                        refreshPolicy: source?.type === "cup" ? "after_match" : "weekly",
                        url: typeof source?.url === "string" ? source.url : "",
                        lastCheckedAt: typeof source?.lastCheckedAt === "string" ? source.lastCheckedAt : "",
                        lastResultsCheckedAt: typeof source?.lastResultsCheckedAt === "string" ? source.lastResultsCheckedAt : "",
                        snapshot: source?.snapshot && typeof source.snapshot === "object"
                            ? structuredClone(source.snapshot)
                            : null
                    }))
                    : [
                        { type: "league", name: "Campionato", enabled: true, url: typeof savedSeasonConfig.calendarUrl === "string" ? savedSeasonConfig.calendarUrl : defaultState.seasonConfig.calendarSources[0].url },
                        { type: "cup", name: "Coppa", enabled: false, dynamic: true, refreshPolicy: "after_match", url: "" }
                    ]
            };
            loaded.seasonArchives = Array.isArray(loaded.seasonArchives)
                ? loaded.seasonArchives
                : [];

            loaded.theme =
                loaded.theme === "dark"
                    ? "dark"
                    : "light";

            loaded.players =
                Array.isArray(loaded.players)
                    ? loaded.players.filter(
                        player =>
                            typeof player === "string" &&
                            player.trim()
                    )
                    : structuredClone(defaultState.players);

            const seasonStartYear = Number(loaded.season.slice(0, 4)) || 2026;
            const legacyStartMonth = `${seasonStartYear}-08`;
            const savedStartMonths = loaded.playerStartMonths && typeof loaded.playerStartMonths === "object"
                ? loaded.playerStartMonths
                : {};
            loaded.playerStartMonths = Object.fromEntries(
                loaded.players.map(player => [
                    player,
                    typeof savedStartMonths[player] === "string" && /^\d{4}-\d{2}$/.test(savedStartMonths[player])
                        ? savedStartMonths[player]
                        : legacyStartMonth
                ])
            );

            loaded.rules =
                Array.isArray(loaded.rules) &&
                loaded.rules.length
                    ? loaded.rules
                    : structuredClone(defaultState.rules);

            loaded.payments =
                loaded.payments || {};

            // I campi storici delle multe (compreso "paid") vengono
            // conservati: Pagamenti è la fonte economica attuale, ma
            // il caricamento non deve mai cancellare dati legacy.
            loaded.fines =
                Array.isArray(loaded.fines)
                    ? loaded.fines
                        .filter(fine => fine && typeof fine === "object")
                    : [];

            return loaded;

        }

    } catch (error) {

        console.error(
            "Errore caricamento dati:",
            error
        );

    }


    return structuredClone(defaultState);

}

function saveState() {

    saveLocalState();
    queueCloudSave();

}

function canMutate() {
    return isAdmin && navigator.onLine;
}

function requireOnlineAdmin() {
    if (canMutate()) return true;

    showToast(
        navigator.onLine
            ? "Devi accedere come amministratore."
            : "Offline: l'app è in sola lettura."
    );
    return false;
}

function normalizeIncomingState(raw) {
    const loaded = { ...structuredClone(defaultState), ...(raw && typeof raw === "object" ? structuredClone(raw) : {}) };
    loaded.team = typeof loaded.team === "string" && loaded.team.trim() ? loaded.team : defaultState.team;
    loaded.teamLogo = typeof loaded.teamLogo === "string" && (loaded.teamLogo === "assets/icon.svg" || /^data:image\/(png|webp|jpeg);base64,/i.test(loaded.teamLogo) || /^https:\/\/b2-content\.tuttocampo\.it\/Teams\/Original\//i.test(loaded.teamLogo)) ? loaded.teamLogo : defaultState.teamLogo;
    loaded.season = typeof loaded.season === "string" && loaded.season.trim() ? loaded.season : defaultState.season;
    loaded.theme = loaded.theme === "dark" ? "dark" : "light";
    loaded.players = Array.isArray(loaded.players) ? loaded.players.filter(player => typeof player === "string" && player.trim()) : structuredClone(defaultState.players);
    loaded.rules = Array.isArray(loaded.rules) && loaded.rules.length ? loaded.rules.filter(rule => rule && typeof rule === "object") : structuredClone(defaultState.rules);
    loaded.fines = Array.isArray(loaded.fines) ? loaded.fines.filter(fine => fine && typeof fine === "object") : [];
    loaded.payments = loaded.payments && typeof loaded.payments === "object" && !Array.isArray(loaded.payments) ? loaded.payments : {};
    loaded.seasonArchives = Array.isArray(loaded.seasonArchives) ? loaded.seasonArchives : [];
    const savedConfig = loaded.seasonConfig && typeof loaded.seasonConfig === "object" ? loaded.seasonConfig : {};
    loaded.seasonConfig = {
        tuttocampoTeamId: Number(savedConfig.tuttocampoTeamId) || DEFAULT_TEAM_ID,
        teamProfile: savedConfig.teamProfile && typeof savedConfig.teamProfile === "object" ? structuredClone(savedConfig.teamProfile) : null,
        monthlyBase: Math.max(0, Number(savedConfig.monthlyBase ?? 5) || 0),
        paymentStartMonth: Math.min(12, Math.max(1, Number(savedConfig.paymentStartMonth ?? 8) || 8)),
        paymentEndMonth: Math.min(12, Math.max(1, Number(savedConfig.paymentEndMonth ?? 5) || 5)),
        paymentFrequency: "monthly",
        paymentMode: savedConfig.paymentMode === "rolling" ? "rolling" : "due_day",
        paymentDueDay: Math.min(28, Math.max(1, Number(savedConfig.paymentDueDay ?? 15) || 15)),
        monthOverrides: savedConfig.monthOverrides && typeof savedConfig.monthOverrides === "object" && !Array.isArray(savedConfig.monthOverrides) ? { ...savedConfig.monthOverrides } : { "08": 10 },
        calendarSources: Array.isArray(savedConfig.calendarSources) ? savedConfig.calendarSources.map(source => ({
            type: source?.type === "cup" ? "cup" : "league",
            name: String(source?.name || (source?.type === "cup" ? "Coppa" : "Campionato")),
            enabled: source?.enabled !== false,
            dynamic: source?.type === "cup" ? source?.dynamic !== false : false,
            refreshPolicy: source?.type === "cup" ? "after_match" : "weekly",
            url: typeof source?.url === "string" ? source.url : "",
            lastCheckedAt: typeof source?.lastCheckedAt === "string" ? source.lastCheckedAt : "",
            lastResultsCheckedAt: typeof source?.lastResultsCheckedAt === "string" ? source.lastResultsCheckedAt : "",
            snapshot: source?.snapshot && typeof source.snapshot === "object" ? structuredClone(source.snapshot) : null
        })) : structuredClone(defaultState.seasonConfig.calendarSources)
    };
    const year = Number(loaded.season.slice(0, 4)) || 2026;
    const starts = loaded.playerStartMonths && typeof loaded.playerStartMonths === "object" ? loaded.playerStartMonths : {};
    loaded.playerStartMonths = Object.fromEntries(loaded.players.map(player => [player, typeof starts[player] === "string" && /^\d{4}-\d{2}$/.test(starts[player]) ? starts[player] : `${year}-08`]));
    return loaded;
}

function isValidTuttocampoCalendarUrl(value) {
    try {
        const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
        return url.protocol === "https:" && /^(?:www\.)?tuttocampo\.it$/i.test(url.hostname) &&
            /\/(Calendario|Risultati)\/?$/i.test(url.pathname);
    } catch {
        return false;
    }
}

function validateImportedCalendar(calendar, expectedType) {
    if (!calendar || typeof calendar !== "object") throw new Error("Risposta calendario non valida.");
    if (calendar.type !== expectedType) throw new Error("La competizione ricevuta non corrisponde al campo scelto.");
    if (!Array.isArray(calendar.matches) || calendar.matches.length < 1) throw new Error("Nessuna partita trovata nel link.");
    if (!Array.isArray(calendar.teams) || calendar.teams.length < 2) throw new Error("Squadre del calendario non riconosciute.");
    const teamIds = new Set();
    calendar.teams.forEach(team => {
        const id = Number(team?.id);
        if (!Number.isFinite(id) || !String(team?.name || "").trim() || teamIds.has(id)) throw new Error("Elenco squadre non valido.");
        teamIds.add(id);
        if (id !== getConfiguredTeamId() && team.logo) {
            const logo = new URL(team.logo, location.href);
            if (logo.protocol !== "https:" || !/(^|\.)tuttocampo\.it$/i.test(logo.hostname)) throw new Error("Origine di uno stemma non valida.");
        }
    });
    const seen = new Set();
    calendar.matches.forEach(match => {
        if (!match || !/^\d{4}-\d{2}-\d{2}$/.test(match.date || "") || !/^\d{2}:\d{2}$/.test(match.time || "")) {
            throw new Error("Il calendario contiene una partita senza data o orario valido.");
        }
        if (!Number.isFinite(Number(match.homeId)) || !Number.isFinite(Number(match.awayId)) || match.homeId === match.awayId) {
            throw new Error("Il calendario contiene squadre non valide.");
        }
        if (!teamIds.has(Number(match.homeId)) || !teamIds.has(Number(match.awayId))) throw new Error("Una partita fa riferimento a una squadra mancante.");
        const key = match.key || `${match.date}|${match.time}|${match.homeId}|${match.awayId}`;
        if (seen.has(key)) throw new Error("Il calendario contiene partite duplicate.");
        seen.add(key);
    });
    if (!calendar.matches.some(match => Number(match.homeId) === getConfiguredTeamId() || Number(match.awayId) === getConfiguredTeamId())) {
        throw new Error(`Il link non contiene partite di ${state.team}.`);
    }
    return structuredClone(calendar);
}

async function importCalendarFromLink(type, url) {
    if (!requireOnlineAdmin()) return null;
    if (!isValidTuttocampoCalendarUrl(url)) throw new Error("Inserisci un link Calendario o Risultati di Tuttocampo.");
    let payload;
    if (typeof window.__MULTE_SV_CALENDAR_IMPORT_MOCK__ === "function") {
        payload = await window.__MULTE_SV_CALENDAR_IMPORT_MOCK__({ type, url, teamId: getConfiguredTeamId() });
    } else if (LOCAL_CUSTOMIZATION_PREVIEW) {
        const response = await fetch(`/__team-calendar?teamId=${encodeURIComponent(getConfiguredTeamId())}&type=${encodeURIComponent(type)}&url=${encodeURIComponent(url)}`, { cache:"no-store" });
        payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Importazione non riuscita.");
    } else {
        if (!supabaseClient) throw new Error("Servizio di importazione non disponibile.");
        const { data, error } = await supabaseClient.functions.invoke("import-tuttocampo-calendar", {
            body: { type, url, teamId: getConfiguredTeamId(), appTeamId:activeCloudTeamId }
        });
        if (error) {
            let message = error.message || "Importazione non riuscita.";
            try {
                const details = await error.context?.clone?.().json();
                if (details?.error) message = details.error;
            } catch (_) {}
            throw new Error(message);
        }
        payload = data;
    }
    return validateImportedCalendar(payload?.calendar, type);
}

const MATCH_RESULTS_CHECK_KEY = "multesquadra_match_results_check_v1";
let matchResultsRefreshInFlight = false;

function calendarKickoff(match) {
    const value = new Date(`${match.date}T${match.time}:00`);
    return Number.isNaN(value.getTime()) ? null : value;
}

function sourceNeedsResultRefresh(source, now = Date.now()) {
    if (!source?.enabled || !source.url || !source.snapshot) return false;
    if (!source.lastResultsCheckedAt) return true;
    return (source.snapshot.matches || []).some(match => {
        const kickoff = calendarKickoff(match);
        return kickoff && kickoff.getTime() + 3 * 60 * 60 * 1000 <= now && !/^\d{1,2}-\d{1,2}$/.test(String(match.result || ""));
    });
}

function resultRoundsForSource(source, now = Date.now()) {
    const matches = source.snapshot?.matches || [];
    const rounds = new Set(matches.filter(match => {
        const kickoff = calendarKickoff(match);
        return kickoff && kickoff.getTime() + 3 * 60 * 60 * 1000 <= now && !/^\d{1,2}-\d{1,2}$/.test(String(match.result || ""));
    }).map(match => Number(match.round)).filter(Number.isInteger));
    if (!source.lastResultsCheckedAt) {
        const firstKnown = Math.min(...matches.map(match => Number(match.round)).filter(round => Number.isInteger(round) && round > 0));
        if (Number.isFinite(firstKnown)) for (let round = 1; round < firstKnown; round += 1) rounds.add(round);
    }
    return [...rounds].sort((a, b) => a - b).slice(-10);
}

async function refreshMatchResults({ force = false } = {}) {
    if (matchResultsRefreshInFlight || !navigator.onLine || !supabaseClient) return false;
    const previousCheck = Number(localStorage.getItem(MATCH_RESULTS_CHECK_KEY) || 0);
    if (!force && Date.now() - previousCheck < 30 * 60 * 1000) return false;
    const sources = (state.seasonConfig?.calendarSources || []).filter(source => sourceNeedsResultRefresh(source));
    if (!sources.length) return false;
    matchResultsRefreshInFlight = true;
    localStorage.setItem(MATCH_RESULTS_CHECK_KEY, String(Date.now()));
    let changed = false;
    try {
        for (const source of sources) {
            const rounds = resultRoundsForSource(source);
            if (!rounds.length) continue;
            let payload;
            if (typeof window.__MULTE_SV_RESULTS_IMPORT_MOCK__ === "function") {
                payload = await window.__MULTE_SV_RESULTS_IMPORT_MOCK__({ type: source.type, url: source.url, teamId: getConfiguredTeamId(), mode: "results", rounds });
            } else {
                const response = await supabaseClient.functions.invoke("import-tuttocampo-calendar", {
                    body: { type: source.type, url: source.url, teamId: getConfiguredTeamId(), appTeamId:activeCloudTeamId, mode: "results", rounds }
                });
                if (response.error) continue;
                payload = response.data;
            }
            let calendar;
            try { calendar = validateImportedCalendar(payload?.calendar, source.type); } catch (_) { continue; }
            const completed = calendar.matches.filter(match => {
                const kickoff = calendarKickoff(match);
                return kickoff && kickoff.getTime() + 3 * 60 * 60 * 1000 <= Date.now() && /^\d{1,2}-\d{1,2}$/.test(String(match.result || ""));
            });
            if (completed.length) {
                const completedByKey = new Map(completed.map(match => [match.key || `${match.date}|${match.time}|${match.homeId}|${match.awayId}`, match]));
                source.snapshot.matches = (source.snapshot.matches || []).map(match => {
                    const key = match.key || `${match.date}|${match.time}|${match.homeId}|${match.awayId}`;
                    return completedByKey.has(key) ? { ...match, ...completedByKey.get(key) } : match;
                });
                source.lastResultsCheckedAt = new Date().toISOString();
                saveState();
                changed = true;
            }
        }
        if (changed) render();
        return changed;
    } finally {
        matchResultsRefreshInFlight = false;
    }
}

let sportsRefreshInFlight=false;
function sportsSourceIsDue(source,{force=false,now=new Date()}={}){
    if(force)return true;
    const last=Date.parse(source?.lastCheckedAt||"");
    const weekend=now.getDay()===0||now.getDay()===6;
    const hasResultDue=(source?.snapshot?.matches||[]).some(match=>{const kickoff=calendarKickoff(match);return kickoff&&kickoff.getTime()+3*60*60*1000<=now.getTime()&&!/^\d{1,2}-\d{1,2}$/.test(String(match.result||""));});
    const interval=hasResultDue?60*60*1000:weekend?6*60*60*1000:24*60*60*1000;
    return !Number.isFinite(last)||now.getTime()-last>=interval;
}
async function refreshSportsSources({force=false}={}){
    if(sportsRefreshInFlight||!navigator.onLine||!isAdmin)return{changed:false,updated:0,errors:[]};
    const sources=(state.seasonConfig?.calendarSources||[]).filter(source=>source.enabled&&source.url&&sportsSourceIsDue(source,{force}));
    if(!sources.length)return{changed:false,updated:0,errors:[]};
    sportsRefreshInFlight=true;let updated=0;const errors=[];
    try{
        for(const source of sources){
            try{const calendar=await importCalendarFromLink(source.type,source.url);source.snapshot=calendar;source.lastCheckedAt=new Date().toISOString();source.lastResultsCheckedAt=source.lastCheckedAt;updated+=1;}
            catch(error){errors.push(`${source.name||source.type}: ${error.message||"aggiornamento non disponibile"}`);}
        }
        if(updated){saveState();applyImportedCalendar();render();}
        return{changed:updated>0,updated,errors};
    }finally{sportsRefreshInFlight=false;}
}

function getCombinedImportedCalendar() {
    const sources = (state.seasonConfig?.calendarSources || []).filter(source => source.enabled && source.snapshot);
    if (!sources.length) return null;
    const teams = new Map();
    const matches = new Map();
    const venues = {};
    sources.forEach(source => {
        (source.snapshot.teams || []).forEach(team => teams.set(Number(team.id), team));
        (source.snapshot.matches || []).forEach(match => matches.set(match.key || `${match.date}|${match.time}|${match.homeId}|${match.awayId}`, match));
        Object.assign(venues, source.snapshot.venues || {});
    });
    return {
        teamId: getConfiguredTeamId(),
        season: state.season,
        source: sources.map(source => source.url).join(" | "),
        teams: [...teams.values()],
        matches: [...matches.values()],
        venues
    };
}

function applyImportedCalendar() {
    const calendar = getCombinedImportedCalendar();
    if (calendar) {
        const ownTeam = calendar.teams.find(team => Number(team.id) === getConfiguredTeamId());
        if (ownTeam) ownTeam.logo = getTeamLogo();
        window.MatchCalendar?.setData(calendar);
    } else {
        window.MatchCalendar?.setTeamLogo?.(getTeamLogo());
    }
}

function getRuntimeCalendarSnapshot(type) {
    const calendar = window.MatchCalendar?.getData?.();
    if (!calendar || !Array.isArray(calendar.matches) || !Array.isArray(calendar.teams)) return null;
    const matches = calendar.matches.filter(match => type === "cup"
        ? match.competitionType === "cup"
        : match.competitionType !== "cup");
    if (!matches.length) return null;
    const teamIds = new Set(matches.flatMap(match => [Number(match.homeId), Number(match.awayId)]));
    return {
        ...calendar,
        teams: calendar.teams.filter(team => teamIds.has(Number(team.id))),
        matches: structuredClone(matches),
        venues: structuredClone(calendar.venues || {})
    };
}

function applyLocalCupPreview() {
    return;
}

function getConfiguredTeamId() {
    return Number(state?.seasonConfig?.tuttocampoTeamId) || DEFAULT_TEAM_ID;
}

function getTeamLogo() {
    return state?.teamLogo || "assets/icon.svg";
}

function optimizeTuttocampoLogoUrl(value) {
    try {
        const url = new URL(value);
        if (url.protocol !== "https:") return "";
        if (url.hostname === "b2-content.tuttocampo.it") {
            url.pathname = url.pathname.replace(/\/Teams\/Original\//i, "/Teams/80/");
        }
        return url.href;
    } catch {
        return "";
    }
}

function applyTeamBranding() {
    const logo = getTeamLogo();
    const appName = state?.teamCustomization?.shortName || `Multe ${state?.team || "Squadra"}`;
    document.title = appName;
    document.querySelectorAll("[data-team-logo]").forEach(image => { image.src = logo; image.alt = `Stemma ${state?.team || "squadra"}`; });
    for (const selector of ['link[rel="icon"]', 'link[rel="apple-touch-icon"]']) {
        const icon = document.querySelector(selector);
        if (icon) icon.href = logo;
    }
    const manifest = document.querySelector('link[rel="manifest"]');
    if (manifest) {
        const iconUrl = (() => { try { return new URL(logo, location.href).href; } catch { return new URL("assets/icon.svg", location.href).href; } })();
        const dynamicManifest = {
            name: appName,
            short_name: appName.length > 20 ? state?.team || "Multe Squadra" : appName,
            description: `Gestione multe, quote e pagamenti di ${state?.team || "squadra"}`,
            start_url: "./index.html",
            display: "standalone",
            background_color: "#f4f6f9",
            theme_color: state?.teamCustomization?.primary || "#111827",
            orientation: "portrait",
            lang: "it",
            icons: [{ src: iconUrl, sizes: "any", purpose: "any maskable" }]
        };
        manifest.href = `data:application/manifest+json,${encodeURIComponent(JSON.stringify(dynamicManifest))}`;
    }
    const teamLink = document.querySelector(".team-link");
    if (teamLink) teamLink.href = state?.teamCustomization?.teamLink || state?.seasonConfig?.teamProfile?.teamUrl || "#";
    document.documentElement.style.setProperty("--team-logo-image", `url("${logo.replace(/["\\]/g, "\\$&")}")`);
    window.MatchCalendar?.setTeamLogo?.(logo);
}

function prepareTeamLogo(file) {
    return new Promise((resolve, reject) => {
        if (!file || !/^image\/(png|jpeg|webp)$/i.test(file.type)) return reject(new Error("Usa un’immagine PNG, JPG o WebP."));
        if (file.size > 8 * 1024 * 1024) return reject(new Error("L’immagine supera 8 MB."));
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Impossibile leggere l’immagine."));
        reader.onload = () => {
            const image = new Image();
            image.onerror = () => reject(new Error("Immagine non valida."));
            image.onload = () => {
                if (Math.max(image.naturalWidth, image.naturalHeight) > 12000) return reject(new Error("L’immagine è troppo grande. Usa un file sotto 12000 pixel per lato."));
                const working = document.createElement("canvas");
                const sourceScale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
                working.width = Math.max(1, Math.round(image.naturalWidth * sourceScale));
                working.height = Math.max(1, Math.round(image.naturalHeight * sourceScale));
                const workingContext = working.getContext("2d", { willReadFrequently: true });
                workingContext.drawImage(image, 0, 0, working.width, working.height);
                const pixels = workingContext.getImageData(0, 0, working.width, working.height);
                const data = pixels.data;
                const pixelIndex = (x, y) => (y * working.width + x) * 4;
                const corners = [[0, 0], [working.width - 1, 0], [0, working.height - 1], [working.width - 1, working.height - 1]]
                    .map(([x, y]) => { const index = pixelIndex(x, y); return [data[index], data[index + 1], data[index + 2], data[index + 3]]; });
                const opaqueCorners = corners.filter(color => color[3] > 20);
                const cornerDistance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
                const uniformBackground = opaqueCorners.length >= 3 && opaqueCorners.every(color => cornerDistance(color, opaqueCorners[0]) < 72);
                if (opaqueCorners.length >= 3 && !uniformBackground) return reject(new Error("Lo sfondo è troppo complesso da rimuovere automaticamente. Usa uno stemma PNG o una foto con sfondo uniforme."));
                if (uniformBackground) {
                    const background = [0, 1, 2].map(channel => opaqueCorners.reduce((sum, color) => sum + color[channel], 0) / opaqueCorners.length);
                    const visited = new Uint8Array(working.width * working.height);
                    const queue = [];
                    const enqueue = (x, y) => {
                        if (x < 0 || y < 0 || x >= working.width || y >= working.height) return;
                        const position = y * working.width + x;
                        if (visited[position]) return;
                        const index = position * 4;
                        if (data[index + 3] <= 20 || Math.hypot(data[index] - background[0], data[index + 1] - background[1], data[index + 2] - background[2]) <= 58) {
                            visited[position] = 1;
                            queue.push(position);
                        }
                    };
                    for (let x = 0; x < working.width; x++) { enqueue(x, 0); enqueue(x, working.height - 1); }
                    for (let y = 0; y < working.height; y++) { enqueue(0, y); enqueue(working.width - 1, y); }
                    for (let cursor = 0; cursor < queue.length; cursor++) {
                        const position = queue[cursor];
                        const x = position % working.width, y = Math.floor(position / working.width);
                        data[position * 4 + 3] = 0;
                        enqueue(x - 1, y); enqueue(x + 1, y); enqueue(x, y - 1); enqueue(x, y + 1);
                    }
                    workingContext.putImageData(pixels, 0, 0);
                }
                const cleaned = workingContext.getImageData(0, 0, working.width, working.height).data;
                let minX = working.width, minY = working.height, maxX = -1, maxY = -1;
                for (let y = 0; y < working.height; y++) for (let x = 0; x < working.width; x++) {
                    if (cleaned[pixelIndex(x, y) + 3] > 20) {
                        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
                    }
                }
                if (maxX < minX || maxY < minY) return reject(new Error("Non riesco a distinguere lo stemma dallo sfondo."));
                const canvas = document.createElement("canvas");
                canvas.width = 512; canvas.height = 512;
                const context = canvas.getContext("2d");
                context.clearRect(0, 0, 512, 512);
                const cropWidth = maxX - minX + 1, cropHeight = maxY - minY + 1;
                const scale = Math.min(472 / cropWidth, 472 / cropHeight);
                const width = cropWidth * scale, height = cropHeight * scale;
                context.drawImage(working, minX, minY, cropWidth, cropHeight, (512 - width) / 2, (512 - height) / 2, width, height);
                resolve(canvas.toDataURL("image/webp", 0.92));
            };
            image.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

function saveLocalState() {
    const serializedState = JSON.stringify(state);

    localStorage.setItem(STORAGE_KEY, serializedState);

    // Copia locale silenziosa: non sostituisce il backup scaricabile,
    // ma offre un'ulteriore rete di sicurezza prima delle operazioni manuali.
    localStorage.setItem(
        AUTO_BACKUP_STORAGE_KEY,
        JSON.stringify({ savedAt: new Date().toISOString(), data: state })
    );
}

function offerUndo(message, previousState) {
    undoSnapshot = structuredClone(previousState);
    clearTimeout(undoTimer);

    const toast = document.getElementById("toast");
    toast.innerHTML = `
        <span>${escapeHtml(message)}</span>
        <button id="undoLastOperation" type="button">Annulla</button>
    `;
    toast.classList.add("show", "has-action");

    document.getElementById("undoLastOperation").onclick = () => {
        if (!undoSnapshot || !requireOnlineAdmin()) return;
        state = structuredClone(undoSnapshot);
        undoSnapshot = null;
        clearTimeout(undoTimer);
        saveState();
        render();
        showToast("Operazione annullata.");
    };

    undoTimer = setTimeout(() => {
        undoSnapshot = null;
        toast.classList.remove("show", "has-action");
    }, 6500);
}

function queueCloudSave() {
    if (!supabaseClient || !cloudReady || !activeCloudTeamId || !isAdmin || !navigator.onLine) return;

    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = setTimeout(async () => {
        const { data:newVersion, error } = await supabaseClient.rpc("save_team_state", { p_team_id:activeCloudTeamId, p_expected_version:cloudStateVersion, p_data:state });

        if (error) {
            console.error("Errore salvataggio online:", error);
            showToast("Salvataggio online non riuscito.");
        } else cloudStateVersion = Number(newVersion) || cloudStateVersion + 1;
    }, 250);
}

function applyAccessMode() {
    const canEdit = canMutate();
    document.querySelector(".bottom-navigation")?.classList.toggle("has-add-action",canEdit);

    const offlineIndicator = document.getElementById("offlineIndicator");
    if (offlineIndicator) {
        offlineIndicator.hidden = navigator.onLine;
    }

    document.body.classList.toggle("is-admin", isAdmin);

    const adminControls = [
        "#globalAddFine",
        "#addFine",
        "#addFineEmpty",
        "[data-edit-fine]",
        "[data-delete-fine]",
        "#addRule",
        "[data-edit-rule]",
        "[data-delete-rule]",
        "#addPlayer",
        "[data-delete-player]",
        "#saveSettings",
        "#importData",
        "#resetData",
        "#resetSeason",
        "#resetTotal",
        "[data-fill-payment]"
    ];

    document.querySelectorAll(adminControls.join(",")).forEach(control => {
        control.hidden = !canEdit;
    });

    document.querySelectorAll(".payment-paid-input").forEach(input => {
        input.disabled = !canEdit;
    });
}

function updateAuthButton() {
    const button = document.getElementById("authButton");
    if (!button) return;

    if (!authUser) {
        button.textContent = "Accedi";
    } else if (isAdmin) {
        button.textContent = "Admin";
    } else {
        button.textContent = "Esci";
    }

    button.onclick = openAuthModal;
}

async function refreshAccess() {
    if (!supabaseClient) return;

    const { data: { user } } = await supabaseClient.auth.getUser();
    authUser = user || null;
    isAdmin = false;

    activeCloudTeamId = ""; activeCloudRole = "viewer";
    if (authUser) {
        const preferred=localStorage.getItem("multesquadra_active_team_v1")||"";
        const { data:memberships } = await supabaseClient.from("team_memberships").select("team_id,role").eq("user_id",authUser.id);
        const membership=(memberships||[]).find(item=>item.team_id===preferred)||(memberships||[])[0];
        if(membership){activeCloudTeamId=membership.team_id;activeCloudRole=membership.role;localStorage.setItem("multesquadra_active_team_v1",activeCloudTeamId);isAdmin=["owner","admin"].includes(activeCloudRole);}
    }

    updateAuthButton();
    applyAccessMode();
}

async function loadCloudState() {
    if (!supabaseClient || !activeCloudTeamId) return false;

    const { data, error } = await supabaseClient
        .from("team_app_states")
        .select("data,version")
        .eq("team_id", activeCloudTeamId)
        .maybeSingle();

    if (error) {
        console.error("Errore caricamento online:", error);
        return null;
    }

    if (data?.data && Object.keys(data.data).length) {
        cloudStateVersion=Number(data.version)||1;
        state = normalizeIncomingState(data.data);
        saveLocalState();
        return true;
    }

    return false;
}

async function repairConfiguredTeamIdentity() {
    if (!/^\d+$/.test(String(state?.team || ""))) return false;
    const teamId=Number(state?.seasonConfig?.tuttocampoTeamId || state.team);
    if (!teamId) return false;
    const directory=await fetch("data/team-directory.json",{cache:"no-store"}).then(response=>response.ok?response.json():[]).catch(()=>[]);
    const known=directory.find(team=>Number(team.teamId)===teamId);
    if (!known?.name) return false;
    const oldName=String(state.team),teamUrl=known.teamUrl||state.seasonConfig?.teamProfile?.teamUrl||"";
    state.team=known.name;
    state.teamLogo=known.logo||state.teamLogo;
    state.seasonConfig={...state.seasonConfig,teamProfile:{...(state.seasonConfig?.teamProfile||{}),teamId,name:known.name,league:known.league||state.seasonConfig?.teamProfile?.league||"",logo:known.logo||state.teamLogo,teamUrl,calendarUrl:teamUrl?teamUrl.replace(/\/Scheda\/?$/i,"/Calendario"):state.seasonConfig?.teamProfile?.calendarUrl}};
    state.teamCustomization={...state.teamCustomization,fullName:known.name,shortName:/^Multe\s+\d+$/i.test(String(state.teamCustomization?.shortName||""))?`Multe ${known.name}`:state.teamCustomization?.shortName};
    saveLocalState();
    if(isAdmin&&cloudReady)queueCloudSave();
    console.info(`Nome squadra ripristinato: ${oldName} → ${known.name}`);
    return true;
}

function subscribeToCloud() {
    if (!supabaseClient || !activeCloudTeamId || cloudChannel) return;

    cloudChannel = supabaseClient
        .channel("multefc-state")
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "team_app_states",
                filter: `team_id=eq.${activeCloudTeamId}`
            },
            payload => {
                if (!payload.new?.data) return;
                cloudStateVersion=Number(payload.new.version)||cloudStateVersion;
                state = normalizeIncomingState(payload.new.data);
                saveLocalState();
                render();
                showToast("Dati aggiornati online.");
            }
        )
        .subscribe();
}

async function initializeCloud() {
    if (!supabaseClient) return;

    await refreshAccess();
    if (!authUser || !activeCloudTeamId) {
        location.replace("setup.html");
        return;
    }
    await ensureOnlineDailyBackup();
    const hasCloudState = await loadCloudState();
    cloudReady = hasCloudState !== null;
    await repairConfiguredTeamIdentity();

    if (isAdmin && !hasCloudState) {
        queueCloudSave();
    }

    subscribeToCloud();

    render();
    refreshMatchResults().catch(error => console.warn("Controllo risultati non riuscito", error));
    refreshSportsSources().catch(error => console.warn("Aggiornamento sportivo non riuscito", error));

    supabaseClient.auth.onAuthStateChange(() => {
        setTimeout(async () => {
            await refreshAccess();
            const hasData = await loadCloudState();
            cloudReady = hasData !== null;
            await repairConfiguredTeamIdentity();
            if (isAdmin && !hasData) queueCloudSave();
            render();
        }, 0);
    });
}

async function handleConnectionRestored() {
    if (supabaseClient) {
        const refreshed = await loadCloudState();
        cloudReady = refreshed !== null;
        await repairConfiguredTeamIdentity();
        await refreshAccess();
    }
    render();
    refreshMatchResults({ force: true }).catch(error => console.warn("Controllo risultati non riuscito", error));
    showToast("Connessione ristabilita.");
}

function handleConnectionLost() {
    closeModal();
    render();
    showToast("Sei offline: le modifiche sono bloccate.");
}

function openAuthModal() {
    if (!authUser && !navigator.onLine) {
        showToast("Serve una connessione Internet per accedere.");
        return;
    }

    if (LOCAL_CUSTOMIZATION_PREVIEW && authUser) {
        openModal("Amministratore", `<div class="form"><p class="muted">Hai accesso alle modifiche su questo dispositivo.</p><button class="btn secondary" id="signOutButton" type="button">Esci</button></div>`);
        document.getElementById("signOutButton").onclick = () => { sessionStorage.removeItem("multesquadra_admin_session"); authUser=null; isAdmin=false; closeModal(); render(); updateAuthButton(); applyAccessMode(); showToast("Accesso disconnesso."); };
        return;
    }

    if (authUser) {
        openModal(
            isAdmin ? "Amministratore" : "Accesso",
                            `<div class="form">
                    <p class="muted">${isAdmin ? "Hai accesso alle modifiche su questo dispositivo." : "Sei connesso in sola visualizzazione."}</p>
                    <button class="btn secondary" id="signOutButton" type="button">Esci</button>
                </div>`
        );

        document.getElementById("signOutButton").onclick = async () => {
            await supabaseClient.auth.signOut();
            closeModal();
            showToast("Accesso disconnesso.");
        };
        return;
    }

    openModal(
        "Accesso amministratore",
        `<div class="form">
                <p class="muted">Accedi per modificare. La sessione resta memorizzata su questo dispositivo.</p>
                <div class="field"><label>NOME UTENTE</label><input id="authUsername" type="text" autocomplete="username" placeholder="Nome utente Admin"></div>
                <div class="field"><label>PASSWORD</label><input id="authPassword" type="password" autocomplete="current-password" placeholder="Password"></div>
                <div class="modal-actions">
                    <button class="btn" id="signInButton" type="button">Accedi</button>
                </div>
            </div>`
    );

    const getCredentials = () => ({
        username: document.getElementById("authUsername").value.trim().toLowerCase(),
        password: document.getElementById("authPassword").value
    });

    document.getElementById("signInButton").onclick = async () => {
        const { username, password } = getCredentials();

        if (!/^[a-z0-9._-]{3,32}$/.test(username) || !password) {
            showToast("Credenziali non valide.");
            return;
        }

        if (LOCAL_CUSTOMIZATION_PREVIEW) {
            if (username !== (state.adminUsername || ADMIN_USERNAME)) { showToast("Credenziali non valide."); return; }
            const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
            const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,"0")).join("");
            if (!state.adminPasswordHash || hash !== state.adminPasswordHash) { showToast("Credenziali non valide."); return; }
            sessionStorage.setItem("multesquadra_admin_session","1"); authUser={local:true}; isAdmin=true; closeModal(); render(); updateAuthButton(); applyAccessMode(); showToast("Accesso effettuato."); return;
        }

        const { error } = await supabaseClient.auth.signInWithPassword({
            email: usernameEmail(username),
            password
        });

        if (error) {
            showToast("Credenziali non valide.");
            return;
        }

        closeModal();
        showToast("Accesso effettuato.");
    };
}



/* =========================================================
   UTILITY
   ========================================================= */

function money(value) {

    return new Intl.NumberFormat(
        "it-IT",
        {
            style: "currency",
            currency: "EUR",
            maximumFractionDigits: 0
        }
    ).format(value);

}

function getDeviceTheme(fallback = "light") {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return savedTheme === "dark" || savedTheme === "light"
        ? savedTheme
        : fallback === "dark"
            ? "dark"
            : "light";
}

const PREFERRED_CATEGORY_ORDER = [
    "Allenamento",
    "Partita",
    "Comportamento",
    "Materiale",
    "Spogliatoio",
    "Squadra",
    "Altro"
];

function compareItalian(left, right) {
    return String(left ?? "").localeCompare(
        String(right ?? ""),
        "it",
        { sensitivity: "base" }
    );
}

function getSortedPlayers(players = state.players) {
    return [...players].sort(compareItalian);
}

function getSortedCategories(categories) {
    return [...new Set(categories.filter(Boolean))]
        .sort((left, right) => {
            const leftCustom = Number(state.categorySettings?.[left]?.order);
            const rightCustom = Number(state.categorySettings?.[right]?.order);
            if (Number.isFinite(leftCustom) || Number.isFinite(rightCustom)) {
                if (!Number.isFinite(leftCustom)) return 1;
                if (!Number.isFinite(rightCustom)) return -1;
                if (leftCustom !== rightCustom) return leftCustom - rightCustom;
            }
            const leftIndex = PREFERRED_CATEGORY_ORDER.indexOf(left);
            const rightIndex = PREFERRED_CATEGORY_ORDER.indexOf(right);

            if (leftIndex !== -1 || rightIndex !== -1) {
                if (leftIndex === -1) return 1;
                if (rightIndex === -1) return -1;
                return leftIndex - rightIndex;
            }

            return compareItalian(left, right);
        });
}

function getRuleCalculation(rule) {
    return ["fixed", "per_minute", "per_piece", "custom_min"].includes(
        rule?.calculation
    )
        ? rule.calculation
        : "fixed";
}

function calculateRuleAmount(rule, quantity = 0) {
    const safeQuantity = Number(quantity) || 0;

    if (getRuleCalculation(rule) === "per_minute") {
        return (Number(rule.baseAmount) || 0) +
            safeQuantity * (Number(rule.perMinute) || 0);
    }

    if (getRuleCalculation(rule) === "per_piece") {
        return safeQuantity * (Number(rule.perPiece) || 0);
    }

    return Number(rule?.amount) || 0;
}

function formatRuleAmount(rule) {
    const calculation = getRuleCalculation(rule);

    if (calculation === "per_minute") {
        return `${money(rule.baseAmount)} + ${money(rule.perMinute)}/min`;
    }

    if (calculation === "per_piece") {
        return `${money(rule.perPiece)}/pezzo`;
    }

    if (calculation === "custom_min") {
        return `da ${money(rule.minAmount)}`;
    }

    return money(rule.amount);
}

function getFineCategoryTone(category) {
    const normalized = String(category || "").toLocaleLowerCase("it");

    if (normalized.includes("allenamento")) return "fine-tone-training";
    if (normalized.includes("partita")) return "fine-tone-match";
    if (normalized.includes("materiale")) return "fine-tone-material";
    if (normalized.includes("squadra")) return "fine-tone-team";
    if (normalized.includes("comportamento")) return "fine-tone-behaviour";
    return "fine-tone-default";
}

function getFineCategoryStyle(category) {
    const color = state.categorySettings?.[category]?.color;
    return /^#[0-9a-f]{6}$/i.test(color || "")
        ? ` style="--category-color:${escapeHtml(color)};background:color-mix(in srgb,var(--category-color) 15%,var(--surface));color:var(--category-color)"`
        : "";
}


function formatDate(date) {

    return new Date(
        date + "T12:00:00"
    ).toLocaleDateString(
        "it-IT",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    );

}


function parseFineDate(value) {

    const raw =
        String(value ?? "")
            .trim();

    const italian =
        raw.match(
            /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/
        );

    const iso =
        raw.match(
            /^(\d{4})-(\d{1,2})-(\d{1,2})$/
        );

    const parts =
        italian
            ? {
                year: Number(italian[3]),
                month: Number(italian[2]),
                day: Number(italian[1])
            }
            : iso
                ? {
                    year: Number(iso[1]),
                    month: Number(iso[2]),
                    day: Number(iso[3])
                }
                : null;

    if (!parts) {
        return "";
    }

    const date =
        new Date(
            parts.year,
            parts.month - 1,
            parts.day
        );

    if (
        date.getFullYear() !== parts.year ||
        date.getMonth() !== parts.month - 1 ||
        date.getDate() !== parts.day
    ) {
        return "";
    }

    return [
        parts.year,
        String(parts.month)
            .padStart(2, "0"),
        String(parts.day)
            .padStart(2, "0")
    ].join("-");
}

function generateId() {

    return Date.now() +
        Math.floor(
            Math.random() * 1000
        );

}

function getFineEntryTime(fine) {
    const createdTime = new Date(fine?.createdAt || "").getTime();
    if (Number.isFinite(createdTime) && createdTime > 0) return createdTime;

    const numericId = Number(fine?.id);
    return Number.isFinite(numericId) ? numericId : 0;
}

function sortFinesByDateThenEntry(fines) {
    return [...fines].sort((left, right) =>
        String(right.date || "").localeCompare(String(left.date || "")) ||
        getFineEntryTime(right) - getFineEntryTime(left)
    );
}


function initials(name) {

    return name
        .split(/\s+/)
        .map(word => word[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

}


function escapeHtml(value) {

    return String(value ?? "")
        .replace(
            /[&<>"']/g,
            character => {

                const map = {

                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#039;"

                };

                return map[character];

            }
        );

}


/* =========================================================
   STAGIONE / MESI
   ========================================================= */

function getSeasonStartYear() {

    const match =
        String(state.season)
            .match(/^(\d{4})/);

    if (match) {

        return Number(match[1]);

    }

    return new Date()
        .getFullYear();

}


function getYearForMonth(month) {

    const startYear =
        getSeasonStartYear();

    /*
       Luglio → Dicembre
       = anno di inizio stagione

       Gennaio → Giugno
       = anno successivo
    */

    if (month >= 7) {

        return startYear;

    }

    return startYear + 1;

}


function getMonthName(month) {

    return new Date(
        2000,
        month - 1,
        1
    ).toLocaleDateString(
        "it-IT",
        {
            month: "long"
        }
    );

}


function getSeasonMonths() {

    const months = [];

    for (
        let month = 1;
        month <= 12;
        month++
    ) {

        const year =
            getYearForMonth(month);

        const monthNumber =
            String(month)
                .padStart(2, "0");

        months.push({

            id:
                `${year}-${monthNumber}`,

            label:
                `${getMonthName(month)} ${year}`

        });

    }

    return months;

}

function getPaymentMonths() {
    const startYear = getSeasonStartYear();
    const startMonth = Math.min(12, Math.max(1, Number(state.seasonConfig?.paymentStartMonth ?? 8) || 8));
    const endMonth = Math.min(12, Math.max(1, Number(state.seasonConfig?.paymentEndMonth ?? 5) || 5));
    const months = [];
    let year = startYear;
    let month = startMonth;
    for (let index = 0; index < 12; index++) {
        months.push(`${year}-${String(month).padStart(2, "0")}`);
        if (month === endMonth) break;
        month++;
        if (month === 13) {
            month = 1;
            year++;
        }
    }
    return months;
}

function getPaymentMonthsToDate() {
    const months = getPaymentMonths();
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(
        today.getMonth() + 1
    ).padStart(2, "0")}`;

    if (currentMonth < months[0]) return [];

    const currentIndex = months.indexOf(currentMonth);
    return currentIndex === -1
        ? months
        : months.slice(0, currentIndex + 1);
}

function getRollingPaymentMonth() {
    const months = getPaymentMonths();
    for (const month of months) {
        const summaries = getSortedPlayers().map(player => getPlayerMonthSummary(player, month));
        const active = summaries.filter(summary => summary.total > 0 || summary.paid > 0);
        if (active.some(summary => summary.remaining > 0)) return month;
    }
    return months[months.length - 1];
}

function getDisplayedPaymentMonth() {
    const months = getPaymentMonths();
    return state.seasonConfig?.paymentMode === "rolling"
        ? getRollingPaymentMonth()
        : months.includes(selectedPaymentMonth)
            ? selectedPaymentMonth
            : getDefaultPaymentMonth();
}

function getDefaultPaymentMonth(today = new Date()) {
    const months = getPaymentMonths();
    const previousDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const previousMonth = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}`;
    if (months.includes(previousMonth)) return previousMonth;
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    return [...months].reverse().find(month => month < currentMonth) || months[0];
}

function getHomeDueMonth(today, currentMonth, paymentMonths, view = "previous") {
    if (view === "current") return currentMonth;
    const previousDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const previousMonth = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}`;
    return paymentMonths.includes(previousMonth) ? previousMonth : currentMonth;
}


function getMonthlyBase(monthId) {
    const monthNumber = String(monthId || "").slice(5, 7);
    const override = state.seasonConfig?.monthOverrides?.[monthNumber];
    if (override !== undefined && override !== null && override !== "") {
        return Math.max(0, Number(override) || 0);
    }
    return Math.max(0, Number(state.seasonConfig?.monthlyBase ?? 5) || 0);
}

function getPlayerStartMonth(player) {
    const months = getPaymentMonths();
    const configured = state.playerStartMonths?.[player];
    return months.includes(configured) ? configured : months[0];
}

function getPlayerMonthBase(player, monthId) {
    return monthId < getPlayerStartMonth(player)
        ? 0
        : getMonthlyBase(monthId);
}


function getPlayerMonthFines(
    player,
    monthId
) {
    if (monthId < getPlayerStartMonth(player)) return 0;

    return state.fines
        .filter(fine =>
            fine.player === player &&
            fine.date &&
            fine.date.startsWith(monthId)
        )
        .reduce(
            (total, fine) =>
                total + Number(fine.amount || 0),
            0
        );
}


function getPlayerMonthPayment(
    player,
    monthId
) {
    return Number(
        state.payments?.[monthId]?.[player] || 0
    );
}


function getPlayerArrears(
    player,
    monthId
) {
    const months =
        getPaymentMonths();

    const currentIndex =
        months.indexOf(monthId);

    if (currentIndex <= 0) {
        return 0;
    }

    let arrears = 0;

    for (
        let index = 0;
        index < currentIndex;
        index++
    ) {
        const previousMonth =
            months[index];

        const base =
            getPlayerMonthBase(
                player,
                previousMonth
            );

        const fines =
            getPlayerMonthFines(
                player,
                previousMonth
            );

        const due =
            base +
            fines +
            arrears;

        const paid =
            getPlayerMonthPayment(
                player,
                previousMonth
            );

        // Se paga meno del dovuto,
        // la differenza diventa arretrato.
        //
        // Se paga più del dovuto,
        // l'eccedenza NON viene trasferita.
        arrears =
            Math.max(
                0,
                due - paid
            );
    }

    return arrears;
}


function getPlayerMonthSummary(
    player,
    monthId
) {
    const base =
        getPlayerMonthBase(
            player,
            monthId
        );

    const fines =
        getPlayerMonthFines(
            player,
            monthId
        );

    const arrears =
        getPlayerArrears(
            player,
            monthId
        );

    const total =
        base +
        fines +
        arrears;

    const paid =
        getPlayerMonthPayment(
            player,
            monthId
        );

    const months = getPaymentMonths();
    const monthIndex = months.indexOf(monthId);
    const cumulativeDue = months.slice(0, monthIndex + 1).reduce((sum, month) =>
        sum + getPlayerMonthBase(player, month) + getPlayerMonthFines(player, month), 0);
    const cumulativePaid = months.reduce((sum, month) =>
        sum + getPlayerMonthPayment(player, month), 0);
    const remaining = Math.max(0, cumulativeDue - cumulativePaid);

    const overpayment =
        Math.max(
            0,
            cumulativePaid - cumulativeDue
        );

    return {
        base,
        fines,
        arrears,
        total,
        paid,
        remaining,
        overpayment
    };
}


/* =========================================================
   TEMA
   ========================================================= */

function applyTheme() {

    document.documentElement
        .dataset.theme =
            deviceTheme === "dark"
                ? "dark"
                : "light";

    const button =
        document.getElementById(
            "themeButton"
        );

    if (button) {

        button.textContent =
            deviceTheme === "dark"
                ? "🌙"
                : "☀️";

    }

}


/* =========================================================
   NAVIGAZIONE
   ========================================================= */

function updateNavigation() {

    document
        .querySelectorAll(
            ".nav-button"
        )
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.page ===
                    currentPage
            );

        });


    const titles = {
       home: "Home",
       fines: "Multe",
       payments: "Pagamenti",
       rules: "Multario",
       settings: "Impostazioni"
    };


    document.getElementById(
        "pageTitle"
    ).textContent =
        titles[currentPage];

}


/* =========================================================
   RENDER GENERALE
   ========================================================= */

function render() {

    if (!isAdmin && currentPage === "settings") {
        currentPage = "home";
    }

    applyTheme();

    updateNavigation();


    const app =
        document.getElementById(
            "app"
        );


    if (currentPage === "home") {
    app.innerHTML = renderHome();
   }

   if (currentPage === "fines") {
    app.innerHTML = renderFines();
   }

   if (currentPage === "payments") {
    app.innerHTML = renderPayments();
   }

   if (currentPage === "rules") {
    app.innerHTML = renderRules();
   }

   if (currentPage === "settings") {
    app.innerHTML = `<div class="settings-page">${renderSettings()}</div>`;
   }

    bindPageEvents();
    bindBirthdayEvents();
    bindOnlineHistoryEvents();
    applyAccessMode();
    applyTeamBranding();

}


/* =========================================================
   HOME
   ========================================================= */

function renderHome() {

    /* =====================================================
       CALCOLO STATISTICHE
       ===================================================== */

    const paymentMonths =
        getPaymentMonths();

    const today =
        new Date();

    const realCurrentMonth =
        `${today.getFullYear()}-${String(
            today.getMonth() + 1
        ).padStart(2, "0")}`;

    const currentMonth =
        paymentMonths.includes(realCurrentMonth)
            ? realCurrentMonth
            : realCurrentMonth < paymentMonths[0]
                ? paymentMonths[0]
                : paymentMonths[paymentMonths.length - 1];

    const currentMonthIndex =
        paymentMonths.indexOf(currentMonth);

    const dueMonths =
        paymentMonths.slice(0, currentMonthIndex + 1);

    const totalFines = state.fines
        .filter(fine =>
            fine.date &&
            fine.date.slice(0, 7) <= currentMonth &&
            fine.date.slice(0, 7) >= getPlayerStartMonth(fine.player)
        )
        .reduce(
            (sum, fine) => sum + Number(fine.amount || 0),
            0
        );

    const totalBase = dueMonths.reduce(
        (sum, month) => sum + state.players.reduce(
            (monthTotal, player) => monthTotal + getPlayerMonthBase(player, month),
            0
        ),
        0
    );

    const total =
        totalFines + totalBase;

    const totalPaid = dueMonths.reduce(
        (sum, month) =>
            sum + state.players.reduce(
                (monthTotal, player) =>
                    monthTotal + getPlayerMonthPayment(player, month),
                0
            ),
        0
    );

    const unpaid = Math.max(0, total - totalPaid);

    // La vista resta disponibile anche prima del giorno di scadenza: passando
    // al mese successivo mostra subito il mese precedente.
    const paymentDueDay = Math.min(28, Math.max(1, Number(state.seasonConfig?.paymentDueDay ?? 15) || 15));
    const rollingPayments = state.seasonConfig?.paymentMode === "rolling";
    const overdueMonth = rollingPayments
        ? getRollingPaymentMonth()
        : getHomeDueMonth(today, currentMonth, paymentMonths, overdueMonthView);
    const overduePlayers = overdueMonth && paymentMonths.includes(overdueMonth)
        ? getSortedPlayers().map(player => ({
            player,
            summary: getPlayerMonthSummary(player, overdueMonth)
        })).filter(item => item.summary.remaining > 0)
        : [];
    const overdueMonthLabel = overdueMonth
        ? new Date(`${overdueMonth}-01T12:00:00`).toLocaleDateString(
            "it-IT",
            { month: "long", year: "numeric" }
        )
        : "";

    const paymentPercentage =
        total > 0
            ? Math.round((totalPaid / total) * 100)
            : 0;

    const fineCount = state.fines.length;

    const finedPlayers = new Set(
        state.fines.map(fine => fine.player)
    ).size;

    const averageFine =
        fineCount > 0
            ? totalFines / fineCount
            : 0;

    const highestFine =
        state.fines.length
            ? Math.max(
                ...state.fines.map(
                    fine => Number(fine.amount)
                )
            )
            : 0;


    /* =====================================================
       CLASSIFICA
       ===================================================== */

    const ranking = state.players
        .map(player => {

            const playerFines =
                state.fines.filter(
                    fine => fine.player === player
                );

            const amount =
                playerFines.reduce(
                    (sum, fine) =>
                        sum + Number(fine.amount),
                    0
                );

            return {
                player,
                fines: playerFines.length,
                amount
            };

        })
        .filter(player => player.fines > 0)
        .sort(
            (a, b) =>
                b.amount - a.amount || compareItalian(a.player, b.player)
        );


    const podium =
        ranking.slice(0, 5);


    /* =====================================================
       ULTIME MULTE
       ===================================================== */

    const latest = sortFinesByDateThenEntry(state.fines).slice(0, 5);


    /* =====================================================
       MESE CORRENTE
       ===================================================== */

    const currentMonthFines =
        state.fines.filter(
            fine => fine.date?.slice(0, 7) === currentMonth
        );

    const currentMonthTotal =
        currentMonthFines.reduce(
            (sum, fine) => sum + Number(fine.amount || 0),
            0
        );

    const currentMonthPayment = state.players.reduce(
        (totals, player) => {
            const summary = getPlayerMonthSummary(player, currentMonth);
            totals.due += summary.total;
            totals.paid += summary.paid;
            totals.remaining += summary.remaining;
            return totals;
        },
        { due: 0, paid: 0, remaining: 0 }
    );

    const currentMonthLabel = new Date(`${currentMonth}-01T12:00:00`)
        .toLocaleDateString("it-IT", { month: "long", year: "numeric" });


    /* =====================================================
       PODIO
       ===================================================== */

    const podiumHtml =
        podium.length
            ? podium
                .map((player, index) => {

                    const positions = [
                        "🥇",
                        "🥈",
                        "🥉"
                    ];

                    return `

                        <div class="rank">

                            <div class="rank-number">
                                ${positions[index] || `${index + 1}°`}
                            </div>

                            <button class="avatar player-avatar-button" type="button" data-player-history="${escapeHtml(player.player)}" aria-label="Apri situazione di ${escapeHtml(player.player)}">${playerListPortrait(player.player)}</button>

                            <div
                                style="
                                    flex:1;
                                    min-width:0;
                                "
                            >

                                <div class="row">

                                    <button
                                        class="player-history-link"
                                        type="button"
                                        data-player-history="${escapeHtml(player.player)}"
                                    >
                                        ${escapeHtml(player.player)}
                                    </button>

                                    <strong>
                                        ${money(
                                            player.amount
                                        )}
                                    </strong>

                                </div>

                                <div
                                    class="small muted"
                                    style="
                                        margin-top:4px;
                                    "
                                >
                                    ${player.fines}
                                    ${
                                        player.fines === 1
                                            ? "multa"
                                            : "multe"
                                    }
                                </div>

                            </div>

                        </div>

                    `;

                })
                .join("")
            :
            `
                <div class="empty">
                    Nessuna multa registrata.
                </div>
            `;


    /* =====================================================
       CLASSIFICA COMPLETA
       ===================================================== */

    const rankingHtml =
        ranking.length
            ? ranking.slice(5)
                .map(
                    (player, index) => {

                        const percentage =
                            total > 0
                                ?
                            Math.min(
                                100,
                                (
                                    player.amount /
                                    total
                                ) * 100
                            )
                                :
                            0;

                        return `

                            <div class="rank">

                                <div class="rank-number">
                                    ${index + 6}
                                </div>

                                <button class="avatar player-avatar-button" type="button" data-player-history="${escapeHtml(player.player)}" aria-label="Apri situazione di ${escapeHtml(player.player)}">${playerListPortrait(player.player)}</button>

                                <div
                                    style="
                                        flex:1;
                                        min-width:0;
                                    "
                                >

                                    <div class="row">

                                        <button
                                            class="player-history-link"
                                            type="button"
                                            data-player-history="${escapeHtml(player.player)}"
                                        >
                                            ${escapeHtml(player.player)}
                                        </button>

                                        <strong>
                                            ${money(
                                                player.amount
                                            )}
                                        </strong>

                                    </div>

                                    <div
                                        class="progress"
                                    >

                                        <i
                                            style="
                                                width:
                                                ${percentage}%;
                                            "
                                        ></i>

                                    </div>

                                    <div
                                        class="small muted"
                                        style="
                                            margin-top:5px;
                                        "
                                    >

                                        ${player.fines}
                                        ${
                                            player.fines === 1
                                                ? "multa"
                                                : "multe"
                                        }

                                    </div>

                                </div>

                            </div>

                        `;

                    }
                )
                .join("")
            :
            `
                <div class="empty">
                    Nessuna multa ancora.
                </div>
            `;


    /* =====================================================
       OUTPUT HOME
       ===================================================== */

    return `

        <!-- ================================================
             HERO
             ================================================ -->

        <div id="birthdayBanners">${renderBirthdayBanners()}</div>
        <section class="team-pass" aria-label="Riepilogo economico squadra">
            <div class="team-pass-header">
                <div class="team-pass-crest"><img src="${escapeHtml(getTeamLogo())}" data-team-logo alt="Stemma ${escapeHtml(state.team)}" width="48" height="58"></div>
                <div><span class="team-pass-eyebrow">IL NOSTRO SPOGLIATOIO</span><h2>${escapeHtml(state.team)}</h2><p>Stagione ${escapeHtml(state.season)}</p></div>

            </div>
            <div class="team-pass-total"><span>Totale dovuto <small>Quote + multe</small></span><strong>${money(total)}</strong></div>
            <div class="team-pass-balances">
                <div><span><i class="paid-dot"></i>Versato</span><strong>${money(totalPaid)}</strong></div>
                <div><span><i class="due-dot"></i>Da saldare</span><strong>${money(unpaid)}</strong></div>
            </div>
            <div class="team-pass-progress-label"><span>Incassi</span><strong>${paymentPercentage}%</strong></div>
            <div class="team-pass-progress" role="progressbar" aria-label="Percentuale incassata" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100,Math.max(0,paymentPercentage))}"><i style="width:${Math.min(100,Math.max(0,paymentPercentage))}%"></i></div>
            <div class="team-pass-footer"><span>${fineCount} multe · ${finedPlayers} giocatori multati</span><span>Riepilogo ad oggi</span></div>
        </section>

        ${window.renderNextMatch ? window.renderNextMatch() : ""}

        <section class="home-stat-section">
            <div class="home-stat-heading">
                <span>Questo mese</span>
                <small>${escapeHtml(currentMonthLabel)}</small>
            </div>
            <div class="grid stats">
                <div class="card stat">
                    <div class="stat-label">DOVUTO</div>
                    <div class="stat-value">${money(currentMonthPayment.due)}</div>
                </div>
                <div class="card stat">
                    <div class="stat-label">VERSATO</div>
                    <div class="stat-value" style="color:var(--green)">${money(currentMonthPayment.paid)}</div>
                </div>
                <div class="card stat">
                    <div class="stat-label">DA SALDARE</div>
                    <div class="stat-value" style="color:var(--red)">${money(currentMonthPayment.remaining)}</div>
                </div>
                <div class="card stat">
                    <div class="stat-label">MULTE DEL MESE</div>
                    <div class="stat-value">${money(currentMonthTotal)}</div>
                </div>
            </div>
        </section>


        ${
            overdueMonth
                ? `
                    <div class="card overdue-card">
                        ${!rollingPayments ? `<div class="overdue-month-switch" role="group" aria-label="Mese da visualizzare"><button type="button" data-overdue-month="current" class="${overdueMonthView === "current" ? "is-active" : ""}">Mese corrente</button><button type="button" data-overdue-month="previous" class="${overdueMonthView === "previous" ? "is-active" : ""}">Mese precedente</button></div>` : ""}
                        <div class="payment-due-heading">
                            <div class="payment-due-icon">€</div>
                            <div>
                                <strong>Da saldare</strong>
                                <div class="small muted">${escapeHtml(overdueMonthLabel)} · ${rollingPayments ? "passa al mese successivo quando tutti hanno pagato" : overdueMonthView === "current" ? "situazione del mese corrente" : `scadenza configurata: giorno ${paymentDueDay}`}</div>
                            </div>
                            <span class="payment-due-count">${overduePlayers.length}</span>
                        </div>
                        ${
                            overduePlayers.length
                                ? `
                                    <div class="overdue-list">
                                        ${overduePlayers.slice(0, showAllOverduePlayers ? overduePlayers.length : 5).map(item => `
                                            <div class="overdue-row">
                                                <span>${escapeHtml(item.player)}</span>
                                                <strong>${money(item.summary.remaining)}</strong>
                                            </div>
                                        `).join("")}
                                    </div>
                                    ${overduePlayers.length > 5 ? `<button class="btn secondary overdue-toggle" id="toggleOverduePlayers" type="button">${showAllOverduePlayers ? "Mostra meno" : `Mostra tutti (${overduePlayers.length})`}</button>` : ""}
                                `
                                : `<p class="small muted">Tutti in regola per il mese di riferimento.</p>`
                        }
                    </div>
                `
                : ""
        }


        <!-- ================================================
             BARRA INCASSI
             ================================================ -->

        <div class="section-head home-monthly-heading">
            <div>
                <h2>📅 Andamento mensile</h2>
                <span>Quote, multe e versamenti</span>
            </div>
            <button class="btn secondary" id="toggleMonthlySummary" type="button">
                ${showMonthlySummary ? "Mostra meno" : "Dettagli"}
            </button>
        </div>

        ${
            showMonthlySummary
                ? `
                    <div class="card monthly-summary-list">
                        ${dueMonths.map(month => {
                            const monthTotals = state.players.reduce(
                                (totals, player) => {
                                    const summary = getPlayerMonthSummary(player, month);
                                    totals.due += summary.total;
                                    totals.paid += summary.paid;
                                    totals.remaining += summary.remaining;
                                    return totals;
                                },
                                { due: 0, paid: 0, remaining: 0 }
                            );
                            const label = new Date(`${month}-01T12:00:00`)
                                .toLocaleDateString("it-IT", { month: "long", year: "numeric" });
                            return `
                                <div class="monthly-summary-row">
                                    <strong>${escapeHtml(label)}</strong>
                                    <span>Versato ${money(monthTotals.paid)} di ${money(monthTotals.due)}</span>
                                    <strong class="${monthTotals.remaining > 0 ? "history-due" : "history-ok"}">
                                        ${monthTotals.remaining > 0 ? `${money(monthTotals.remaining)} da saldare` : "✓ Saldato"}
                                    </strong>
                                </div>
                            `;
                        }).join("")}
                    </div>
                `
                : ""
        }


        <!-- ================================================
             CLASSIFICA
             ================================================ -->

        <div class="section-head">

            <h2>
                🏆 Classifica
            </h2>

            <button
                class="btn secondary"
                id="goToFines"
                type="button"
            >
                Vedi multe
            </button>

        </div>


        <div class="card list">

            ${podiumHtml}

        </div>


        ${
            ranking.length > 5
                ?

            `

                <div class="section-head">

                    <h2>
                        📊 Classifica
                    </h2>

                    <button class="btn secondary" id="toggleRanking" type="button">
                        ${showAllRanking ? "Mostra meno" : "Mostra tutti"}
                    </button>

                </div>

                ${
                    showAllRanking
                        ? `<div class="card list">${rankingHtml}</div>`
                        : ""
                }

            `

                :

            ""

        }


        <!-- ================================================
             ULTIME MULTE
             ================================================ -->

        <div class="section-head">

            <h2>
                🕘 Ultime multe
            </h2>

        </div>


        <div class="card list">

            ${
                latest.length
                    ?
                latest
                    .map(renderFineRow)
                    .join("")
                    :
                `
                    <div class="empty">
                        Non ci sono multe.
                    </div>
                `
            }

        </div>

    `;

}

/* =========================================================
   MULTE
   ========================================================= */

function renderFines() {

    const allFines = state.fines || [];
    const now = new Date();
    const currentFineMonth = `${now.getFullYear()}-${String(
        now.getMonth() + 1
    ).padStart(2, "0")}`;
    const previousFineDate = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1
    );
    const previousFineMonth = `${previousFineDate.getFullYear()}-${String(
        previousFineDate.getMonth() + 1
    ).padStart(2, "0")}`;

    const monthNames = [
        "Gennaio",
        "Febbraio",
        "Marzo",
        "Aprile",
        "Maggio",
        "Giugno",
        "Luglio",
        "Agosto",
        "Settembre",
        "Ottobre",
        "Novembre",
        "Dicembre"
    ];


    /* =====================================================
       MESI DELLA STAGIONE
       ===================================================== */

    const seasonStartYear =
        Number(state.season?.slice(0, 4)) ||
        new Date().getFullYear();

    const seasonMonths = [];

    for (let monthIndex = 7; monthIndex <= 11; monthIndex++) {

        const year = seasonStartYear;

        const monthNumber =
            String(monthIndex + 1).padStart(2, "0");

        seasonMonths.push({
            id: `${year}-${monthNumber}`,
            label: `${monthNames[monthIndex]} ${year}`
        });

    }

    for (let monthIndex = 0; monthIndex <= 4; monthIndex++) {

        const year = seasonStartYear + 1;

        const monthNumber =
            String(monthIndex + 1).padStart(2, "0");

        seasonMonths.push({
            id: `${year}-${monthNumber}`,
            label: `${monthNames[monthIndex]} ${year}`
        });

    }


    /* =====================================================
       FILTRO
       ===================================================== */

   let fines = allFines;

if (selectedMonth !== "all") {

    fines = fines.filter(fine =>
        fine.date &&
        fine.date.startsWith(selectedMonth)
    );

}

if (selectedFinePlayer !== "all") {

    fines = fines.filter(fine =>
        fine.player === selectedFinePlayer
    );

}

if (fineSearchQuery.trim()) {
    const query = fineSearchQuery.trim().toLocaleLowerCase("it");
    fines = fines.filter(fine =>
        `${fine.player} ${fine.category} ${fine.type}`
            .toLocaleLowerCase("it")
            .includes(query)
    );
}


    /* =====================================================
       TOTALI
       ===================================================== */

    const total =
        fines.reduce(
            (sum, fine) =>
                sum + Number(fine.amount || 0),
            0
        );

    /* =====================================================
       TITOLO
       ===================================================== */

    const selectedMonthData =
        seasonMonths.find(
            month => month.id === selectedMonth
        );

    const title =
        selectedMonth === "all"
            ? "Tutte le multe"
            : selectedMonthData
                ? selectedMonthData.label
                : "Multe";


    const subtitle =
        fines.length === 0
            ? "Nessuna multa registrata"
            : `${fines.length} ${
                fines.length === 1
                    ? "multa"
                    : "multe"
            } · ${money(total)} totali`;


    /* =====================================================
       ORDINAMENTO
       ===================================================== */

    const sortedFines = sortFinesByDateThenEntry(fines);


    /* =====================================================
       ELENCO MULTE
       ===================================================== */

    const finesHtml =
        sortedFines.length

            ? `

                <div class="list fines-list">

                    ${sortedFines
                        .map(renderFineRow)
                        .join("")}

                </div>

            `

            :

            `

                <div class="card empty-state">

                    <div class="empty-icon">
                        🧾
                    </div>

                    <h3>
                        Nessuna multa
                    </h3>

                    <p>
                        Non ci sono multe registrate per questo periodo.
                    </p>

                    ${
                        isAdmin
                            ? `
                                <button
                                    class="primary-btn"
                                    id="addFineEmpty"
                                >
                                    ＋ Aggiungi multa
                                </button>
                            `
                            : ""
                    }

                </div>

            `;


    /* =====================================================
       OUTPUT
       ===================================================== */

    return `

        <section class="page-context-strip fines-context-strip">

            <div class="fines-context-summary">
                <span class="page-context-label">Riepilogo del periodo</span>
                <strong>${escapeHtml(title)}</strong>
                <span>${subtitle}</span>
            </div>

        </section>


<div class="card fines-filters-card">

    <div class="fines-filters-header">

        <div>

            <strong>
                Filtri
            </strong>

            <span class="muted">
                Personalizza la visualizzazione delle multe
            </span>

        </div>

    </div>

    <div class="fine-quick-filters" aria-label="Filtri rapidi multe">
        <button
            type="button"
            data-fine-period="${currentFineMonth}"
            class="${selectedMonth === currentFineMonth ? "active" : ""}"
        >
            Questo mese
        </button>
        <button
            type="button"
            data-fine-period="${previousFineMonth}"
            class="${selectedMonth === previousFineMonth ? "active" : ""}"
        >
            Mese scorso
        </button>
        <button
            type="button"
            data-fine-period="all"
            class="${selectedMonth === "all" ? "active" : ""}"
        >
            Tutta la stagione
        </button>
    </div>


    <div class="fines-filters-grid">

        <div class="field">

            <label
                for="monthSelect"
                class="form-label"
            >
                📅 Mese
            </label>

            <select
                id="monthSelect"
                class="month-select"
            >

                <option
                    value="all"
                    ${selectedMonth === "all" ? "selected" : ""}
                >
                    Tutte le multe
                </option>

                ${seasonMonths
                    .map(month => `

                        <option
                            value="${month.id}"
                            ${
                                selectedMonth === month.id
                                    ? "selected"
                                    : ""
                            }
                        >
                            ${month.label}
                        </option>

                    `)
                    .join("")}

            </select>

        </div>


        <div class="field">

            <label
                for="finePlayerSelect"
                class="form-label"
            >
                👤 Giocatore
            </label>

            <select
                id="finePlayerSelect"
                class="month-select"
            >

                <option
                    value="all"
                    ${
                        selectedFinePlayer === "all"
                            ? "selected"
                            : ""
                    }
                >
                    Tutti i giocatori
                </option>

                ${getSortedPlayers()
                    .map(player => `

                        <option
                            value="${escapeHtml(player)}"
                            ${
                                selectedFinePlayer === player
                                    ? "selected"
                                    : ""
                            }
                        >
                            ${escapeHtml(player)}
                        </option>

                    `)
                    .join("")}

            </select>

        </div>

        <div class="field fines-search-field">

            <label for="fineSearch" class="form-label">
                🔎 Cerca
            </label>

            <input
                id="fineSearch"
                class="month-select"
                type="search"
                value="${escapeHtml(fineSearchQuery)}"
                placeholder="Giocatore o tipo multa"
                autocomplete="off"
            >

        </div>

    </div>

</div>

        <!-- ================================================
             RIEPILOGO
             ================================================ -->

        <!-- ================================================
     RIEPILOGO
     ================================================ -->

<div class="stats-grid fines-summary">

    <div class="stat-card">

        <span>
            Totale periodo
        </span>

        <strong>
            ${money(total)}
        </strong>

        <small>
            ${fines.length}
            ${fines.length === 1 ? "multa" : "multe"}
        </small>

    </div>


    <div class="stat-card">

        <span>
            Giocatori coinvolti
        </span>

        <strong>
            ${
                new Set(
                    fines.map(
                        fine => fine.player
                    )
                ).size
            }
        </strong>

        <small>
            ${
                new Set(
                    fines.map(
                        fine => fine.player
                    )
                ).size === 1
                    ? "giocatore"
                    : "giocatori"
            }
        </small>

    </div>


</div>

        <!-- ================================================
             ELENCO
             ================================================ -->

        <div class="section-heading">

            <div>

                <h2>
                    Elenco multe
                </h2>

                <span>
                    ${
                        fines.length
                            ? "Più recenti in alto"
                            : "Nessun elemento"
                    }
                </span>

            </div>

        </div>


        ${finesHtml}

    `;
}

function renderPayments() {
    const months =
        getPaymentMonths();

    const rollingPayments = state.seasonConfig?.paymentMode === "rolling";
    const currentMonth = getDisplayedPaymentMonth();

    const monthLabel =
        new Date(
            currentMonth + "-01T12:00:00"
        ).toLocaleDateString(
            "it-IT",
            {
                month: "long",
                year: "numeric"
            }
        );

    let totalDue = 0;
    let totalPaid = 0;
    let totalRemaining = 0;

    const paymentEntries =
        getSortedPlayers().map(player => {
            const summary =
                getPlayerMonthSummary(
                    player,
                    currentMonth
                );

            totalDue += summary.total;
            totalPaid += summary.paid;
            totalRemaining +=
                summary.remaining;

            return { player, summary };
        });

    const rows = paymentEntries
        .map(({ player, summary }) => `
                <div class="payment-row" data-payment-remaining="${summary.remaining}">
                    <button
                        type="button"
                        class="payment-player payment-sticky player-history-trigger"
                        data-player-history="${escapeHtml(player)}"
                        aria-label="Apri situazione di ${escapeHtml(player)}"
                    >
                        <span class="player-avatar">${playerListPortrait(player)}</span>

                        <div>
                            <strong>
                                ${escapeHtml(player)}
                            </strong>

                            ${
                                summary.arrears > 0
                                    ? `
                                        <small class="payment-arrears">
                                            Arretrato:
                                            ${money(summary.arrears)}
                                        </small>
                                    `
                                    : ""
                            }

                            <small class="payment-status ${
                                summary.remaining <= 0
                                    ? "payment-status-ok"
                                    : summary.paid > 0
                                        ? "payment-status-partial"
                                        : "payment-status-due"
                            }">
                                ${
                                    summary.remaining <= 0
                                        ? "✓ Saldato"
                                        : summary.paid > 0
                                            ? "€ Parziale"
                                            : "! Da saldare"
                                }
                            </small>
                        </div>
                    </button>

                    <div class="payment-value payment-paid-cell">
                        <input
                            type="number"
                            class="payment-paid-input"
                            data-payment-player="${escapeHtml(player)}"
                            min="0"
                            step="1"
                            value="${summary.paid}"
                            aria-label="Versato da ${escapeHtml(player)}"
                        >
                        ${summary.remaining > 0 ? `
                            <button
                                type="button"
                                class="payment-fill-button"
                                data-fill-payment="${escapeHtml(player)}"
                                data-fill-payment-value="${summary.paid + summary.remaining}"
                                title="Compila l'importo necessario per saldare"
                                aria-label="Compila il saldo di ${escapeHtml(player)}: ${money(summary.remaining)} rimanenti"
                            >Saldo</button>
                        ` : ""}
                     </div>

                    <div class="
                        payment-value
                        ${
                            summary.remaining > 0
                                ? "payment-remaining"
                                : "payment-ok"
                        }
                    ">
                        ${money(summary.remaining)}
                    </div>

                </div>
            `)
        .join("");

    return `
        <div class="card payment-month-card payment-filter-card">
            <div class="payment-filter-intro">
                <span class="payment-filter-icon" aria-hidden="true">▦</span>
                <div>
                    <span>PERIODO PAGAMENTI</span>
                    <strong>${rollingPayments ? "Il mese avanza quando tutti hanno pagato" : "Scegli il mese da consultare"}</strong>
                </div>
            </div>
            <div class="payment-filter-grid">
                <div class="payment-month-field">
                    <label for="paymentMonthSelect" class="form-label">${rollingPayments ? "Mese corrente automatico" : "Mese selezionato"}</label>
                    <select id="paymentMonthSelect" class="form-input" ${rollingPayments ? "disabled" : ""}>
                ${months
                    .map(month => {
                        const label =
                            new Date(
                                month +
                                "-01T12:00:00"
                            ).toLocaleDateString(
                                "it-IT",
                                {
                                    month: "long",
                                    year: "numeric"
                                }
                            );

                        return `
                            <option
                                value="${month}"
                                ${
                                    month === currentMonth
                                        ? "selected"
                                        : ""
                                }
                            >
                                ${
                                    label
                                        .charAt(0)
                                        .toUpperCase() +
                                    label.slice(1)
                                }
                            </option>
                        `;
                    })
                    .join("")}
                    </select>
                </div>
            </div>
        </div>

        <div class="payment-summary-grid">

            <div class="card payment-summary-card payment-summary-due">
                <span class="payment-summary-icon">€</span>
                <div>
                    <small>Dovuto</small>
                    <strong>${money(totalDue)}</strong>
                </div>
            </div>

            <div class="card payment-summary-card payment-summary-paid">
                <span class="payment-summary-icon">✓</span>
                <div>
                    <small>Versato</small>
                    <strong>${money(totalPaid)}</strong>
                </div>
            </div>

            <div class="card payment-summary-card payment-summary-remaining">
                <span class="payment-summary-icon">!</span>
                <div>
                    <small>Resta</small>
                    <strong>${money(totalRemaining)}</strong>
                </div>
            </div>

        </div>

                <div
            id="paymentsTableExport"
            class="card payments-table-card"
        >

            <div class="payments-table-header">
                <div class="payment-sticky">Giocatore</div>
                <div>Versato</div>
                <div>Rimanente</div>
            </div>

            <div class="payments-table-body">
                ${rows}
            </div>

        </div>

        <section class="card season-report-card">
            <div class="season-report-copy">
                <span class="season-report-kicker">STAGIONE ${escapeHtml(state.season)}</span>
                <h2>Riepilogo squadra</h2>
                <p>Una panoramica compatta oppure tutte le schede dei giocatori.</p>
            </div>
            <div class="season-report-actions">
                <button id="exportSeasonImage" class="btn payment-export-button season-report-button" type="button"><span class="export-button-icon" aria-hidden="true">▦</span><span class="export-button-copy"><strong>Riepilogo compatto</strong><small>Totali di tutta la rosa</small></span><span aria-hidden="true">›</span></button>
                <button id="exportSeasonDetailedImage" class="btn payment-export-button season-report-button" type="button"><span class="export-button-icon" aria-hidden="true">☷</span><span class="export-button-copy"><strong>Schede giocatori</strong><small>Versione dettagliata completa</small></span><span aria-hidden="true">›</span></button>
            </div>
        </section>

        <div class="payment-export-actions payment-month-exports">
            <button id="exportPaymentsImage" class="btn payment-export-button" type="button"><span class="export-button-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4"/></svg></span><span class="export-button-copy"><strong>Tabella completa</strong><small>Tutti i giocatori del mese</small></span><span aria-hidden="true">›</span></button>
            <button id="exportDuePaymentsImage" class="btn payment-export-button" type="button"><span class="export-button-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4"/></svg></span><span class="export-button-copy"><strong>Solo da pagare</strong><small>Esclude chi ha saldato</small></span><span aria-hidden="true">›</span></button>
        </div>
    `;
}

function drawTeamLogoOnCanvas(context, x, y, width, height) {
    const image = [...document.querySelectorAll("[data-team-logo]")]
        .find(candidate => candidate.complete && candidate.naturalWidth > 0);
    if (!image) return false;
    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale, drawHeight = image.naturalHeight * scale;
    context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
    return true;
}

function createPaymentsExportCanvas(mode = "all") {

    const exportMode = mode === "due" ? "due" : "all";
    const month = getDisplayedPaymentMonth();
    const players = getSortedPlayers()
        .map(player => ({
            player,
            summary: getPlayerMonthSummary(player, month)
        }))
        .filter(entry =>
            exportMode !== "due" || entry.summary.remaining > 0
        );

    if (!players.length) {
        return null;
    }

    // Canvas nativo: non dipende dal rendering HTML, quindi resta affidabile
    // anche in Safari e nella PWA installata su iPhone.
    const columns = [300, 145, 165, 135, 135, 165];
    const labels = [
        "Giocatore",
        "Versato",
        "Rimanente",
        "Base",
        "Multe",
        "Totale"
    ];
    const padding = 44;
    const titleHeight = 108;
    const headerHeight = 46;
    const rowHeight = 52;
    const logicalWidth = columns.reduce((total, width) => total + width, 0) + padding * 2;
    const logicalHeight = titleHeight + headerHeight + players.length * rowHeight + padding;
    const pixelRatio = getExportScale(logicalWidth, logicalHeight);
    const canvas = document.createElement("canvas");

    canvas.width = logicalWidth * pixelRatio;
    canvas.height = logicalHeight * pixelRatio;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Memoria insufficiente per generare il PNG");
    context.scale(pixelRatio, pixelRatio);
    context.textBaseline = "middle";

    const monthLabel = new Date(`${month}-01T12:00:00`)
        .toLocaleDateString("it-IT", { month: "long", year: "numeric" });
    const title = `${exportMode === "due" ? "Da pagare" : "Pagamenti"} — ${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}`;
    const tableWidth = columns.reduce((total, width) => total + width, 0);
    const tableLeft = padding;

    context.fillStyle = "#f7f9fc";
    context.fillRect(0, 0, logicalWidth, logicalHeight);

    const hasLogo = drawTeamLogoOnCanvas(context, tableLeft, 25, 54, 54);
    const titleLeft = tableLeft + (hasLogo ? 70 : 0);
    context.fillStyle = "#13213a";
    context.font = "700 27px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    context.fillText(title, titleLeft, 43);
    context.fillStyle = "#5b677a";
    context.font = "500 15px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    context.fillText(
        exportMode === "due"
            ? "Solo i giocatori con un importo ancora da versare"
            : "Riepilogo quote, multe e versamenti",
        titleLeft,
        74
    );

    context.fillStyle = "#203657";
    context.fillRect(tableLeft, titleHeight, tableWidth, headerHeight);
    context.font = "700 14px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    context.fillStyle = "#ffffff";

    let left = tableLeft;
    labels.forEach((label, index) => {
        context.fillText(label, left + 15, titleHeight + headerHeight / 2);
        left += columns[index];
    });

    players.forEach(({ player, summary }, index) => {
        const y = titleHeight + headerHeight + index * rowHeight;
        const isEven = index % 2 === 0;

        context.fillStyle = isEven ? "#ffffff" : "#eef3f9";
        context.fillRect(tableLeft, y, tableWidth, rowHeight);
        context.strokeStyle = "#d7e0ec";
        context.lineWidth = 1;
        context.strokeRect(tableLeft, y, tableWidth, rowHeight);

        const values = [
            player,
            money(summary.paid),
            money(summary.remaining),
            money(summary.base),
            money(summary.fines),
            money(summary.total)
        ];

        left = tableLeft;
        values.forEach((value, columnIndex) => {
            context.font = columnIndex === 0
                ? "650 16px system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
                : "600 16px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
            context.fillStyle = columnIndex === 2 && summary.remaining > 0
                ? "#ba2a31"
                : "#172236";
            context.fillText(String(value), left + 15, y + rowHeight / 2, columns[columnIndex] - 30);
            left += columns[columnIndex];
        });
    });

    return canvas;
}

function exportPaymentsImage(mode = "all") {

    try {
        const exportMode = mode === "due" ? "due" : "all";
        const canvas = createPaymentsExportCanvas(exportMode);

        if (!canvas) {
            showToast("Nessun giocatore da esportare.");
            return;
        }

        const fileName =
            `${exportMode === "due" ? "da-pagare" : "pagamenti"}-${getDisplayedPaymentMonth()}.png`;

        openExportPreview(
            canvas,
            fileName,
            exportMode === "due" ? "Da pagare" : "Pagamenti"
        );
    } catch (error) {
        console.error("Errore esportazione immagine:", error);
        showToast("Errore durante l'esportazione");
    }
}

function openTeamStandings() {
    const source = (state.seasonConfig?.calendarSources || []).find(item => item.enabled !== false && item.type === "league");
    const standings = source?.snapshot?.standings || window.DEFAULT_STANDINGS;
    const rows = Array.isArray(standings?.rows) ? standings.rows : [];
    if (!rows.length) { showToast("Classifica non disponibile."); return; }
    const safeLogo = optimizeTuttocampoLogoUrl;
    const updated = standings.updatedAt ? new Date(standings.updatedAt).toLocaleString("it-IT", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }) : "";
    openModal("Classifica", `
        <div class="team-standings">
            <div class="team-standings-heading"><div><strong>${escapeHtml(standings.competition || "Campionato")}</strong><span>${updated ? `Aggiornata ${escapeHtml(updated)}` : "Ultimo aggiornamento disponibile"}</span></div><span class="team-standings-live"><i></i> Tuttocampo</span></div>
            <div class="team-standings-table"><div class="team-standings-labels"><span>#</span><span>Squadra</span><span>G</span><span>V</span><span>N</span><span>P</span><span>DR</span><span>Pt</span></div>
            <div class="team-standings-list">${rows.map((row,index) => {
                const own = Number(row.id) === getConfiguredTeamId();
                const logo = own ? getTeamLogo() : safeLogo(row.logo);
                const initials = String(row.name || "?").split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join("").toUpperCase();
                const difference = Number(row.goalDifference || 0);
                return `<article class="team-standing-row ${own ? "is-own-team" : ""}"><strong class="team-standing-position">${Number(row.position) || index+1}</strong><div class="team-standing-team"><span>${logo ? `<img src="${escapeHtml(logo)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><b hidden>${escapeHtml(initials)}</b>` : `<b>${escapeHtml(initials)}</b>`}</span><div><strong>${escapeHtml(row.name || "Squadra")}</strong></div></div><span>${Number(row.played)||0}</span><span>${Number(row.won)||0}</span><span>${Number(row.drawn)||0}</span><span>${Number(row.lost)||0}</span><span class="team-standing-difference">${difference>0?"+":""}${difference}</span><strong class="team-standing-points">${Number(row.points)||0}</strong></article>`;
            }).join("")}</div></div>
        </div>`);
    document.querySelector("#modalRoot .modal")?.classList.add("team-standings-modal");
    document.querySelector("#modalRoot .modal-backdrop")?.classList.add("team-calendar-backdrop");
}
window.openTeamStandings = openTeamStandings;
function openTeamCalendar() {
    const calendar = window.MatchCalendar?.getData?.();
    if (!calendar || !Array.isArray(calendar.matches)) {
        showToast("Calendario non disponibile.");
        return;
    }
    const teams = new Map((calendar.teams || []).map(team => [Number(team.id), team]));
    const matches = calendar.matches
        .filter(match => (Number(match.homeId) === getConfiguredTeamId() || Number(match.awayId) === getConfiguredTeamId()) && /^\d{4}-\d{2}-\d{2}$/.test(String(match.date || "")) && /^\d{2}:\d{2}$/.test(String(match.time || "")))
        .map(match => ({ ...match, kickoff: window.MatchCalendar.kickoff(match) }))
        .filter(match => Number.isFinite(match.kickoff))
        .sort((left, right) => left.kickoff - right.kickoff);
    const hasLeague = matches.some(match => match.competitionType !== "cup");
    const hasCup = matches.some(match => match.competitionType === "cup");
    const safeExternalUrl = value => optimizeTuttocampoLogoUrl(value);
    openModal("Calendario partite", `
        <div class="team-calendar">
            <div class="team-calendar-toolbar" role="tablist" aria-label="Filtra calendario">
                <button class="team-calendar-filter active" type="button" data-calendar-filter="upcoming">Prossime</button>
                <button class="team-calendar-filter" type="button" data-calendar-filter="all">Tutte</button>
                ${hasLeague ? `<button class="team-calendar-filter" type="button" data-calendar-filter="league">Campionato</button>` : ""}
                ${hasCup ? `<button class="team-calendar-filter" type="button" data-calendar-filter="cup">Coppa</button>` : ""}
            </div>
            <div id="teamCalendarList" aria-live="polite"></div>
        </div>
    `);
    document.querySelector("#modalRoot .modal")?.classList.add("team-calendar-modal");
    document.querySelector("#modalRoot .modal-backdrop")?.classList.add("team-calendar-backdrop");
    const list = document.getElementById("teamCalendarList");
    const draw = filter => {
        const now = Date.now();
        const filtered = matches.filter(match => filter === "all" || (filter === "upcoming" ? match.kickoff >= now && match.status !== "played" : (match.competitionType === "cup") === (filter === "cup")));
        if (!filtered.length) {
            list.innerHTML = `<div class="team-calendar-empty"><strong>${filter === "upcoming" ? "Nessuna partita in programma" : "Nessuna partita disponibile"}</strong><p>${filter === "upcoming" ? "Il calendario non prevede altre gare." : "Non risultano gare per questo filtro."}</p></div>`;
            return;
        }
        const groups = new Map();
        filtered.forEach(match => {
            const key = match.date.slice(0, 7);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(match);
        });
        list.innerHTML = [...groups.entries()].map(([month, monthMatches]) => {
            const monthLabel = new Date(`${month}-01T12:00:00`).toLocaleDateString("it-IT", { month: "long", year: "numeric" });
            return `<section class="team-calendar-month"><h3>${escapeHtml(monthLabel)}</h3>${monthMatches.map(match => {
                const homeTeam = teams.get(Number(match.homeId)) || {};
                const awayTeam = teams.get(Number(match.awayId)) || {};
                const home = homeTeam.name || "Squadra casa";
                const away = awayTeam.name || "Squadra ospite";
                const opponent = Number(match.homeId) === getConfiguredTeamId() ? away : home;
                const awayMatch = Number(match.awayId) === getConfiguredTeamId();
                const date = new Date(`${match.date}T12:00:00`);
                const venue = match.venue || calendar.venues?.[match.homeId];
                const mapsDestination = awayMatch
                    ? (venue?.address
                        ? `${venue.name || "Campo sportivo"}, ${venue.address}, Italia`
                        : `${match.place && match.place !== "Campo da definire" ? match.place : `Campo sportivo ${home}`}, Italia`)
                    : "";
                const mapsUrl = mapsDestination ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsDestination)}` : "";
                const matchUrl = safeExternalUrl(match.url);
                const played = match.status === "played" || Boolean(match.result);
                const teamBadge = (team, name, ownTeam) => {
                    const logo = ownTeam ? getTeamLogo() : safeExternalUrl(team.logo);
                    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join("").toUpperCase();
                    return `<span class="team-calendar-crest">${logo ? `<img src="${escapeHtml(logo)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><b hidden>${escapeHtml(initials)}</b>` : `<b>${escapeHtml(initials)}</b>`}</span>`;
                };
                return `<article class="team-calendar-match" data-calendar-type="${match.competitionType === "cup" ? "cup" : "league"}">
                    <div class="team-calendar-date"><span>${date.toLocaleDateString("it-IT", { weekday: "short" }).replace(".", "")}</span><strong>${date.getDate()}</strong><small>${date.toLocaleDateString("it-IT", { month: "short" }).replace(".", "")}</small></div>
                    <div class="team-calendar-copy"><small>${match.competitionType === "cup" ? "Coppa" : "Campionato"} · ${awayMatch ? "Trasferta" : "Casa"}</small><div class="team-calendar-teams"><div>${teamBadge(homeTeam, home, Number(match.homeId) === getConfiguredTeamId())}<strong>${escapeHtml(home)}</strong></div><em>VS</em><div>${teamBadge(awayTeam, away, Number(match.awayId) === getConfiguredTeamId())}<strong>${escapeHtml(away)}</strong></div></div><span>${escapeHtml(venue?.address || match.place || venue?.name || (awayMatch ? `Campo di ${home}` : "Campo da definire"))}</span></div>
                    <div class="team-calendar-result"><strong>${played ? escapeHtml(match.result || "—") : escapeHtml(match.time)}</strong><span>${played ? "FINALE" : `${Number(match.round) || "—"}ª G.`}</span></div>
                    ${(mapsUrl || matchUrl) ? `<div class="team-calendar-actions">${mapsUrl ? `<a href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener noreferrer">Apri Maps</a>` : ""}${matchUrl ? `<a href="${escapeHtml(matchUrl)}" target="_blank" rel="noopener noreferrer">Tuttocampo ↗</a>` : ""}</div>` : ""}
                </article>`;
            }).join("")}</section>`;
        }).join("");
    };
    document.querySelectorAll("[data-calendar-filter]").forEach(button => button.onclick = () => {
        document.querySelectorAll("[data-calendar-filter]").forEach(item => item.classList.toggle("active", item === button));
        draw(button.dataset.calendarFilter);
    });
    draw("upcoming");
}
window.openTeamCalendar = openTeamCalendar;

function exportSeasonImage() {
    openSeasonReport(false);
}

function exportSeasonDetailedImage() {
    try {
        const months = getPaymentMonths();
        const today = new Date();
        const todayMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
        const finalIndex = months.includes(todayMonth)
            ? months.indexOf(todayMonth)
            : todayMonth < months[0] ? 0 : months.length - 1;
        const includedMonths = months.slice(0, finalIndex + 1);
        const entries = getSortedPlayers().map(player => {
            const totals = includedMonths.reduce((sum, month) => {
                const summary = getPlayerMonthSummary(player, month);
                sum.base += summary.base;
                sum.fines += summary.fines;
                sum.paid += summary.paid;
                if (summary.total > 0 && summary.remaining <= 0) sum.settled += 1;
                if (summary.total > 0) sum.active += 1;
                return sum;
            }, { base: 0, fines: 0, paid: 0, settled: 0, active: 0 });
            const total = totals.base + totals.fines;
            return { player, ...totals, total, remaining: Math.max(0, total - totals.paid) };
        });

        const width = 1200;
        const padding = 52;
        const gap = 22;
        const columns = 2;
        const cardWidth = (width - padding * 2 - gap) / columns;
        const cardHeight = 178;
        const headerHeight = 154;
        const rows = Math.ceil(entries.length / columns);
        const height = headerHeight + rows * (cardHeight + gap) + padding;
        const canvas = document.createElement("canvas");
        const scale = getExportScale(width, height);
        canvas.width = width * scale;
        canvas.height = height * scale;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Memoria insufficiente per generare il PNG");
        context.scale(scale, scale);
        context.textBaseline = "middle";
        context.fillStyle = "#eef4fb";
        context.fillRect(0, 0, width, height);
        context.fillStyle = "#10233f";
        context.fillRect(0, 0, width, 124);
        drawTeamLogoOnCanvas(context, padding, 24, 76, 76);
        context.fillStyle = "#ffffff";
        context.font = "800 30px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
        context.fillText(`Schede giocatori — ${state.season}`, padding + 94, 43);
        context.fillStyle = "#bcd0e8";
        context.font = "500 15px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
        context.fillText(`${state.team} · aggiornato a ${today.toLocaleDateString("it-IT")}`, padding + 94, 79);

        entries.forEach((entry, index) => {
            const column = index % columns;
            const row = Math.floor(index / columns);
            const x = padding + column * (cardWidth + gap);
            const y = headerHeight + row * (cardHeight + gap);
            context.fillStyle = "#ffffff";
            context.beginPath();
            context.roundRect(x, y, cardWidth, cardHeight, 20);
            context.fill();
            context.fillStyle = entry.remaining > 0 ? "#dc3b45" : "#2f6fdd";
            context.beginPath();
            context.roundRect(x, y, 7, cardHeight, [20, 0, 0, 20]);
            context.fill();
            context.fillStyle = "#13213a";
            context.font = "800 20px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
            context.fillText(entry.player, x + 24, y + 31, cardWidth - 48);
            context.fillStyle = entry.remaining > 0 ? "#b4232c" : "#2458b5";
            context.font = "750 13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
            context.fillText(entry.remaining > 0 ? `DA SALDARE ${money(entry.remaining)}` : "✓ SALDATO", x + 24, y + 59);
            const metrics = [
                ["QUOTE", money(entry.base)], ["MULTE", money(entry.fines)],
                ["VERSATO", money(entry.paid)], ["TOTALE", money(entry.total)]
            ];
            metrics.forEach(([label, value], metricIndex) => {
                const metricX = x + 24 + metricIndex * ((cardWidth - 48) / 4);
                context.fillStyle = "#78869a";
                context.font = "700 10px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
                context.fillText(label, metricX, y + 101);
                context.fillStyle = "#172236";
                context.font = "800 17px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
                context.fillText(value, metricX, y + 126, (cardWidth - 62) / 4);
            });
            context.fillStyle = "#7b8798";
            context.font = "600 12px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
            context.fillText(`${entry.settled}/${entry.active} mensilità saldate`, x + 24, y + 155);
        });

        openExportPreview(
            canvas,
            `schede-giocatori-${state.season.replace(/[^\w-]/g, "-")}.png`,
            "Schede giocatori"
        );
    } catch (error) {
        console.error("Errore export schede stagione:", error);
        showToast("Errore durante l’esportazione delle schede giocatori");
    }
}

function openSeasonDetailedReport() {
    openSeasonReport(true);
}

function openSeasonReport(includePlayerPages = true) {
    const months = getPaymentMonths();
    const today = new Date();
    const todayMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const finalIndex = months.includes(todayMonth)
        ? months.indexOf(todayMonth)
        : todayMonth < months[0] ? 0 : months.length - 1;
    const includedMonths = months.slice(0, finalIndex + 1);
    const entries = getSortedPlayers().map(player => {
        const totals = includedMonths.reduce((sum, month) => {
            const summary = getPlayerMonthSummary(player, month);
            sum.base += summary.base;
            sum.fines += summary.fines;
            sum.paid += summary.paid;
            return sum;
        }, { base: 0, fines: 0, paid: 0 });
        const total = totals.base + totals.fines;
        const finesList = sortFinesByDateThenEntry((state.fines || []).filter(fine => fine.player === player));
        return { player, ...totals, total, remaining: Math.max(0, total - totals.paid), finesList };
    });
    const teamTotals = entries.reduce((sum, entry) => ({
        base: sum.base + entry.base,
        fines: sum.fines + entry.fines,
        total: sum.total + entry.total,
        paid: sum.paid + entry.paid,
        remaining: sum.remaining + entry.remaining
    }), { base: 0, fines: 0, total: 0, paid: 0, remaining: 0 });
    const totalFinesCount = (state.fines || []).length;
    const pageCount = includePlayerPages ? entries.length + 4 : 4;
    const ranking = [...entries].sort((a, b) => b.fines - a.fines || compareItalian(a.player, b.player));
    const reportHeader = (label = "Riepilogo stagione") => `
        <header class="season-pdf-header">
            <div class="season-pdf-brand"><img src="${escapeHtml(getTeamLogo())}" data-team-logo alt=""><div><strong>Multe <span>Squadra</span></strong><small>${escapeHtml(state.team)}</small></div></div>
            <div><small>${label}</small><strong>${escapeHtml(state.season)}</strong></div>
        </header>`;
    const metric = (label, value, tone) => `<div class="season-pdf-metric ${tone}"><small>${label}</small><strong>${value}</strong></div>`;
    const paymentRows = entries.map((entry, index) => `
        <tr><td>${index + 1}</td><td>${escapeHtml(entry.player)}</td><td>${money(entry.base)}</td><td>${money(entry.fines)}</td><td>${money(entry.total)}</td><td>${money(entry.paid)}</td><td class="${entry.remaining > 0 ? "is-due" : ""}">${money(entry.remaining)}</td></tr>`).join("");
    const rankingRows = ranking.map((entry, index) => `
        <tr><td>${index + 1}</td><td>${escapeHtml(entry.player)}</td><td>${entry.finesList.length}</td><td>${money(entry.fines)}</td></tr>`).join("");
    const monthBars = includedMonths.map(month => {
        const totals = entries.reduce((sum, entry) => {
            const item = getPlayerMonthSummary(entry.player, month);
            sum.base += item.base; sum.fines += item.fines; sum.total += item.total;
            return sum;
        }, { base: 0, fines: 0, total: 0 });
        const max = Math.max(1, ...includedMonths.map(key => entries.reduce((sum, entry) => sum + getPlayerMonthSummary(entry.player, key).total, 0)));
        const label = new Date(`${month}-01T12:00:00`).toLocaleDateString("it-IT", { month: "short" });
        return `<div class="season-chart-column"><div class="season-chart-bars"><i style="height:${Math.max(3, totals.base / max * 100)}%"></i><b style="height:${Math.max(3, totals.fines / max * 100)}%"></b></div><span>${escapeHtml(label)}</span></div>`;
    }).join("");
    const playerPages = entries.map((entry, index) => `
        <section class="season-report-page season-player-page">
            ${reportHeader("Scheda giocatore")}
            <div class="season-player-hero">${playerPortrait(entry.player)}<div><h2>${escapeHtml(entry.player)}</h2><p>${validBirthday(getBirthday(entry.player)) ? `Nato il ${getBirthday(entry.player).split("-").reverse().join("/")}` : escapeHtml(state.team)}</p></div><b>#${index + 1}</b></div>
            <div class="season-player-metrics">
                ${metric("N° multe", entry.finesList.length, "red")}${metric("Totale multe", money(entry.fines), "red")}${metric("Quote", money(entry.base), "green")}${metric("Totale dovuto", money(entry.total), "blue")}${metric("Versato", money(entry.paid), "green")}${metric("Rimanente", money(entry.remaining), entry.remaining > 0 ? "orange" : "green")}
            </div>
            <h3 class="season-report-section-title">Dettaglio multe</h3>
            <table class="season-report-table season-player-fines"><thead><tr><th>Data</th><th>Descrizione</th><th>Categoria</th><th>Importo</th></tr></thead><tbody>
                ${entry.finesList.length ? entry.finesList.map(fine => `<tr><td>${escapeHtml(formatDate(fine.date))}</td><td>${escapeHtml(fine.type || "Multa")}</td><td>${escapeHtml(fine.category || "Altro")}</td><td>${money(fine.amount)}</td></tr>`).join("") : `<tr><td colspan="4">Nessuna multa registrata</td></tr>`}
            </tbody></table>
            <footer>Multe Squadra - ${escapeHtml(state.team)} <span>Pagina ${index + 5} di ${pageCount}</span></footer>
        </section>`).join("");

    openModal(includePlayerPages ? "Riepilogo stagione completo" : "Riepilogo stagione", `
        <div class="season-report-toolbar"><p>${includePlayerPages ? "Anteprima completa" : "Anteprima compatta"}: ${pageCount} pagine</p><button class="btn" id="printSeasonReport" type="button">Salva / stampa PDF</button></div>
        <div class="season-report-document ${includePlayerPages ? "season-report-detailed" : "season-report-compact"}">
            <section class="season-report-page season-cover-page"><img src="${escapeHtml(getTeamLogo())}" data-team-logo alt="Stemma ${escapeHtml(state.team)}"><h1>Multe <span>Squadra</span></h1><h2>${escapeHtml(state.team)}</h2><hr><p>Riepilogo stagione</p><strong>${escapeHtml(state.season)}</strong><small>Stessi amici.<br>Più responsabilità.</small><footer>Generato il ${today.toLocaleDateString("it-IT")} <span>Pagina 1 di ${pageCount}</span></footer></section>
            <section class="season-report-page">${reportHeader()}<h2 class="season-report-section-title">Panoramica generale</h2><div class="season-overview-grid">${metric("Quote", money(teamTotals.base), "green")}${metric("Multe", money(teamTotals.fines), "red")}${metric("Totale dovuto", money(teamTotals.total), "blue")}${metric("Totale versato", money(teamTotals.paid), "green")}${metric("Da incassare", money(teamTotals.remaining), "orange")}${metric("Numero multe", totalFinesCount, "purple")}</div><h2 class="season-report-section-title">Andamento mensile</h2><div class="season-month-chart">${monthBars}</div><footer>Multe Squadra - ${escapeHtml(state.team)} <span>Pagina 2 di ${pageCount}</span></footer></section>
            <section class="season-report-page">${reportHeader()}<h2 class="season-report-section-title">Riepilogo pagamenti</h2><table class="season-report-table"><thead><tr><th>#</th><th>Giocatore</th><th>Quote</th><th>Multe</th><th>Totale</th><th>Versato</th><th>Rimanente</th></tr></thead><tbody>${paymentRows}</tbody><tfoot><tr><th colspan="2">Totale squadra</th><th>${money(teamTotals.base)}</th><th>${money(teamTotals.fines)}</th><th>${money(teamTotals.total)}</th><th>${money(teamTotals.paid)}</th><th>${money(teamTotals.remaining)}</th></tr></tfoot></table><footer>Multe Squadra - ${escapeHtml(state.team)} <span>Pagina 3 di ${pageCount}</span></footer></section>
            <section class="season-report-page">${reportHeader()}<h2 class="season-report-section-title">Classifica generale multe</h2><table class="season-report-table season-ranking-table"><thead><tr><th>#</th><th>Giocatore</th><th>N° multe</th><th>Totale multe</th></tr></thead><tbody>${rankingRows}</tbody></table><footer>Multe Squadra - ${escapeHtml(state.team)} <span>Pagina 4 di ${pageCount}</span></footer></section>
            ${includePlayerPages ? playerPages : ""}
        </div>`);
    document.querySelector("#modalRoot .modal")?.classList.add("season-report-modal");
    document.getElementById("printSeasonReport").onclick = () => window.print();
}

// Bound memory use on mobile, independently of devicePixelRatio.
function getExportScale(width, height) {
    return Math.min(2, Math.sqrt(4000000 / (width * height)), 4096 / width, 4096 / height);
}

let disposeExportPreview = null;

async function openExportPreview(canvas, fileName, title) {
    openModal(
        `${escapeHtml(title)} — anteprima`,
        `<div class="export-preview">
            <p id="exportStatus" class="muted" role="status">Preparazione immagine…</p>
            <div id="exportActions" class="modal-actions" hidden>
                <button class="btn" id="shareExportImage" type="button" hidden>Condividi / Salva</button>
                <a class="btn secondary" id="downloadExportImage">Scarica PNG</a>
                <a class="btn secondary" id="openExportImage" target="_blank" rel="noopener">Apri immagine</a>
            </div>
            <img id="exportPreviewImage" alt="${escapeHtml(title)} esportati" hidden>
            <button class="btn secondary" id="closeExportPreview" type="button">Chiudi</button>
        </div>`
    );
    document.getElementById("closeExportPreview").onclick = closeModal;
    const status = document.getElementById("exportStatus");
    const actions = document.getElementById("exportActions");
    const preview = document.getElementById("exportPreviewImage");
    const shareButton = document.getElementById("shareExportImage");
    const download = document.getElementById("downloadExportImage");
    const open = document.getElementById("openExportImage");
    let imageUrl;
    let disposed = false;
    let sharing = false;
    disposeExportPreview = () => {
        disposed = true;
        preview.removeAttribute("src");
        // Give an initiated download/new tab time to consume the Blob URL.
        if (imageUrl) {
            const releasedUrl = imageUrl;
            setTimeout(() => URL.revokeObjectURL(releasedUrl), 60000);
        }
    };
    try {
        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob(value => value && value.size
                ? resolve(value)
                : reject(new Error("PNG non generato")), "image/png");
        });
        if (disposed || !status.isConnected) return;
        imageUrl = URL.createObjectURL(blob);
        preview.src = imageUrl;
        preview.hidden = false;
        download.href = imageUrl;
        download.download = fileName;
        open.href = imageUrl;
        actions.hidden = false;

        let file = null;
        let canShare = false;
        try {
            file = new File([blob], fileName, { type: "image/png" });
            canShare = typeof navigator.share === "function" &&
                typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
        } catch (_) { /* Download and image preview remain available. */ }
        status.textContent = canShare
            ? "Immagine pronta. Tocca Condividi / Salva: su iPhone scegli Salva immagine oppure Salva su File."
            : "Immagine pronta. Scarica il PNG oppure apri l’immagine; su iPhone tienila premuta per salvarla.";
        shareButton.hidden = !canShare;
        shareButton.onclick = async () => {
            if (sharing || disposed) return;
            sharing = true;
            shareButton.disabled = true;
            try {
                // The file is already prepared: invoke directly in the tap handler.
                // Awaiting canvas/fetch here can lose Safari's user activation.
                await navigator.share({ files: [file] });
            } catch (error) {
                if (error.name !== "AbortError" && !disposed) {
                    status.textContent = "Condivisione non disponibile. Usa Scarica PNG oppure Apri immagine e tienila premuta per salvarla.";
                }
            } finally {
                sharing = false;
                if (!disposed) shareButton.disabled = false;
            }
        };
        preview.onerror = () => {
            status.textContent = "Anteprima non disponibile. Puoi comunque condividere o scaricare il PNG.";
        };
    } catch (error) {
        console.error("Errore preparazione PNG:", error);
        if (!disposed && status.isConnected) {
            status.textContent = "Non è stato possibile creare l’immagine. Chiudi l’anteprima e riprova.";
        }
    } finally {
        // Release the backing store, including when the preview closed mid-encode.
        canvas.width = 1;
        canvas.height = 1;
    }
}


function openPlayerHistoryModal(player) {
    if (!state.players.includes(player)) {
        showToast("Giocatore non trovato.");
        return;
    }

    const months = getPaymentMonthsToDate();
    const playerFines = [...state.fines]
        .filter(fine => fine.player === player)
        .sort((left, right) => String(right.date || "")
            .localeCompare(String(left.date || "")));
    const finesTotal = months.reduce(
        (total, month) => total + getPlayerMonthFines(player, month),
        0
    );
    const baseTotal = months.reduce(
        (total, month) => total + getPlayerMonthBase(player, month),
        0
    );
    const paidTotal = months.reduce(
        (total, month) => total + getPlayerMonthPayment(player, month),
        0
    );
    const dueTotal = baseTotal + finesTotal;
    const remainingTotal = Math.max(0, dueTotal - paidTotal);

    openModal(
        `Scheda giocatore`,
        `
            <div class="player-profile-hero">${playerPortrait(player)}<div><small>${escapeHtml(state.teamCustomization?.fullName || state.team || "Squadra")}</small><h3>${escapeHtml(player)}</h3><p>Stagione ${escapeHtml(state.season)}</p>${validBirthday(getBirthday(player))?'<p>🎂 '+getBirthday(player).split('-').reverse().join('/')+'</p>':''}</div><button class="player-photo-edit-button" id="editSharedPlayerPhoto" type="button" ${navigator.onLine?'':'disabled'} aria-label="Cambia la foto di ${escapeHtml(player)}">📷<span>Cambia foto</span></button></div>
            <div class="player-profile-status">${remainingTotal>0?'Da saldare · '+money(remainingTotal):'✓ Tutto saldato'}</div>
            <div class="player-share-controls"><label for="playerShareMonth">Mese da condividere</label><select id="playerShareMonth">${months.map(m=>`<option value="${m}">${escapeHtml(new Date(m+'-01T12:00:00').toLocaleDateString('it-IT',{month:'long',year:'numeric'}))}</option>`).join('')}</select><button class="btn secondary" id="sharePlayerSummary" type="button">Condividi scheda mensile</button></div><div class="player-history-summary">
                <div><span>Dovuto stagione</span><strong>${money(dueTotal)}</strong></div>
                <div><span>Versato</span><strong>${money(paidTotal)}</strong></div>
                <div><span>Rimanente</span><strong>${money(remainingTotal)}</strong></div>
            </div>

            <section class="player-history-section player-monthly-section">
            <div class="section-head compact-section-head"><span class="history-section-icon" aria-hidden="true">▦</span><div><h3>Situazione mensile</h3><small>Quote, multe e versamenti mese per mese</small></div></div>
            <div class="player-history-list">
                ${months.map(month => {
                    const summary = getPlayerMonthSummary(player, month);
                    const label = new Date(`${month}-01T12:00:00`)
                        .toLocaleDateString("it-IT", { month: "long", year: "numeric" });
                    return `
                        <div class="player-history-row">
                            <div><strong>${escapeHtml(label)}</strong><small>Quote ${money(summary.base)} · multe ${money(summary.fines)}</small></div>
                            <div><small>Versato ${money(summary.paid)}</small><strong class="${summary.remaining > 0 ? "history-due" : "history-ok"}">${summary.remaining > 0 ? `${money(summary.remaining)} da saldare` : "✓ Saldato"}</strong></div>
                        </div>
                    `;
                }).join("")}
            </div>
            </section>

            <section class="player-history-section player-fines-section">
            <div class="section-head compact-section-head"><span class="history-section-icon" aria-hidden="true">!</span><div><h3>Ultime multe</h3><small>${playerFines.length} ${playerFines.length === 1 ? "multa registrata" : "multe registrate"}</small></div></div>
            <div class="player-history-list">
                ${playerFines.length ? playerFines.map(fine => `
                    <div class="player-history-row">
                        <div><strong>${escapeHtml(fine.type)}</strong><small>${formatDate(fine.date)} · ${escapeHtml(fine.category)}</small></div>
                        <strong>${money(fine.amount)}</strong>
                    </div>
                `).join("") : `<p class="muted small">Nessuna multa registrata.</p>`}
            </div>
            </section>
        `
    );
    document.querySelector("#modalRoot .modal")?.classList.add("player-profile-modal");
    const monthSelect=document.getElementById('playerShareMonth');if(months.length)monthSelect.value=months[months.length-1];
    document.getElementById('sharePlayerSummary').onclick=()=>exportPlayerSummary(player,monthSelect.value);
    document.getElementById('editSharedPlayerPhoto').onclick=()=>openSharedPlayerPhotoEditor(player);
}

/* =========================================================
   RIGA MULTA
   ========================================================= */

function renderFineRow(fine) {

    return `

        <article class="list-item fine-row-card">

            <div class="fine-row-main">

                <div class="row-left">

                    <button class="avatar player-avatar-button" type="button" data-player-history="${escapeHtml(fine.player)}" aria-label="Apri situazione di ${escapeHtml(fine.player)}">${playerListPortrait(fine.player)}</button>


                    <div class="fine-row-copy">

                        <button
                            class="player-history-link"
                            type="button"
                            data-player-history="${escapeHtml(fine.player)}"
                        >
                            ${escapeHtml(fine.player)}
                        </button>

                        <div class="fine-row-type">
                            ${escapeHtml(fine.type)}
                        </div>

                        <div class="fine-row-meta">
                            <span class="fine-category ${getFineCategoryTone(fine.category)}"${getFineCategoryStyle(fine.category)}>
                                ${escapeHtml(fine.category)}
                            </span>
                            <span class="fine-date">${formatDate(fine.date)}</span>
                        </div>

                    </div>

                </div>


                <div class="fine-row-amount">${money(fine.amount)}</div>

            </div>


            <div class="fine-row-actions">

                <button
                    class="btn secondary"
                    data-edit-fine="${fine.id}"
                    type="button"
                >
                    Modifica
                </button>


                <button
                    class="btn danger"
                    data-delete-fine="${fine.id}"
                    type="button"
                >
                    Elimina
                </button>

            </div>

        </article>

    `;

}


/* =========================================================
   MULTARIO
   ========================================================= */

function renderRules() {

    const groups = {};


    state.rules.forEach(rule => {

        if (!groups[rule.category]) {

            groups[rule.category] = [];

        }

        groups[rule.category].push(rule);

    });


    return `

        <div class="multario-intro">

            <div class="multario-intro-copy">

                <p>
                    <strong>${state.rules.length} ${state.rules.length === 1 ? "regola" : "regole"}</strong><br>
                    Importi e calcoli pronti da usare quando aggiungi una multa.
                </p>

            </div>


            <button
                class="btn"
                id="addRule"
                type="button"
            >
                + Nuova regola
            </button>

        </div>


        ${
            Object.keys(groups).length

                ?

            getSortedCategories(Object.keys(groups))
                .map(
                    category => {
                        const rules = [...groups[category]].sort(
                            (left, right) => compareItalian(left.type, right.type)
                        );

                        return `

                        <section class="multario-category">

                            <div class="multario-category-head">

                                <div>
                                    <span class="multario-category-badge ${getFineCategoryTone(category)}"${getFineCategoryStyle(category)}>
                                        ${escapeHtml(category)}
                                    </span>

                                    <p>${rules.length} ${rules.length === 1 ? "regola" : "regole"}</p>
                                </div>

                            </div>


                        <div class="multario-rules">

                            ${
                                rules
                                    .map(
                                        rule => `

                                            <article
                                                class="rule-row"
                                                data-assign-rule="${rule.id}"
                                                role="button"
                                                tabindex="0"
                                                aria-label="Assegna ${escapeHtml(rule.type)}"
                                            >

                                                <div class="rule-row-copy">

                                                    <strong class="rule-row-title">
                                                        ${escapeHtml(
                                                            rule.type
                                                        )}
                                                    </strong>

                                                    <span class="rule-calculation">
                                                        ${getRuleCalculation(rule) === "per_minute" ? "A minuti" : getRuleCalculation(rule) === "per_piece" ? "A quantità" : getRuleCalculation(rule) === "custom_min" ? "Importo personalizzato" : "Importo fisso"}
                                                    </span>

                                                </div>


                                                <strong class="rule-amount">
                                                    ${formatRuleAmount(rule)}
                                                </strong>


                                                <div class="rule-actions">

                                                    <button
                                                        class="icon-mini"
                                                        data-edit-rule="${rule.id}"
                                                        type="button"
                                                        aria-label="Modifica ${escapeHtml(rule.type)}"
                                                        title="Modifica regola"
                                                    >
                                                        ✏️
                                                    </button>


                                                    <button
                                                        class="icon-mini"
                                                        data-delete-rule="${rule.id}"
                                                        type="button"
                                                        aria-label="Elimina ${escapeHtml(rule.type)}"
                                                        title="Elimina regola"
                                                    >
                                                        🗑️
                                                    </button>

                                                </div>

                                            </article>

                                        `
                                    )
                                    .join("")
                            }

                        </div>

                        </section>

                    `;
                    }
                )
                .join("")

                :

            `
                <div class="card empty">

                    Il multario è vuoto.

                </div>
            `
        }

    `;

}


/* =========================================================
   IMPOSTAZIONI
   ========================================================= */

function openChangeAdminPasswordModal() {
    if (!requireOnlineAdmin() || !authUser || (!supabaseClient && !LOCAL_CUSTOMIZATION_PREVIEW)) return;
    openModal("Cambia password Admin", `
        <div class="form admin-password-form">
            <p class="muted">La modifica riguarda lo stesso account Admin usato dal pulsante Accedi.</p>
            <div class="field"><label for="currentAdminPassword">PASSWORD ATTUALE</label><input id="currentAdminPassword" type="password" autocomplete="current-password"></div>
            <div class="field"><label for="newAdminPassword">NUOVA PASSWORD</label><input id="newAdminPassword" type="password" minlength="8" autocomplete="new-password"></div>
            <div class="field"><label for="confirmAdminPassword">CONFERMA NUOVA PASSWORD</label><input id="confirmAdminPassword" type="password" minlength="8" autocomplete="new-password"></div>
            <div class="modal-actions"><button class="btn secondary" id="cancelAdminPassword" type="button">Annulla</button><button class="btn" id="saveAdminPassword" type="button">Aggiorna password</button></div>
        </div>
    `);
    document.getElementById("cancelAdminPassword").onclick = closeModal;
    document.getElementById("saveAdminPassword").onclick = async () => {
        const currentPassword = document.getElementById("currentAdminPassword").value;
        const nextPassword = document.getElementById("newAdminPassword").value;
        const confirmation = document.getElementById("confirmAdminPassword").value;
        if (!currentPassword) return showToast("Inserisci la password attuale.");
        if (nextPassword.length < 8) return showToast("La nuova password deve avere almeno 8 caratteri.");
        if (nextPassword !== confirmation) return showToast("Le nuove password non coincidono.");
        if (currentPassword === nextPassword) return showToast("Scegli una password diversa da quella attuale.");
        const button = document.getElementById("saveAdminPassword");
        button.disabled = true;
        button.textContent = "Aggiornamento…";
        if (LOCAL_CUSTOMIZATION_PREVIEW) {
            const makeHash = async value => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2,"0")).join("");
            if (await makeHash(currentPassword) !== state.adminPasswordHash) { button.disabled=false; button.textContent="Aggiorna password"; showToast("La password attuale non è corretta."); return; }
            state.adminPasswordHash = await makeHash(nextPassword);
            saveLocalState(); closeModal(); showToast("Password Admin aggiornata."); return;
        }
        const { error: signInError } = await supabaseClient.auth.signInWithPassword({ email: authUser?.email, password: currentPassword });
        if (signInError) {
            button.disabled = false;
            button.textContent = "Aggiorna password";
            showToast("La password attuale non è corretta.");
            return;
        }
        const { error } = await supabaseClient.auth.updateUser({ password: nextPassword });
        if (error) {
            button.disabled = false;
            button.textContent = "Aggiorna password";
            showToast("Cambio password non riuscito.");
            return;
        }
        closeModal();
        showToast("Password Admin aggiornata.");
    };
}

function renderSettings() {

    return `

        ${renderBirthdaySettings()}
        <details class="card team-settings-details">
          <summary><span class="settings-menu-icon" aria-hidden="true">⚙</span><span class="settings-menu-label"><strong>Squadra e stagione</strong><small>Preferenze della squadra</small></span><span class="settings-chevron" aria-hidden="true">⌄</span></summary>
          <p class="small muted">La stagione determina i mesi dei pagamenti e i riepiloghi.</p>
          <div class="form">
            <div class="field"><label for="teamName">Nome squadra</label><input id="teamName" type="text" value="${escapeHtml(state.team)}"></div>
            <div class="field"><label for="season">Stagione</label><input id="season" type="text" value="${escapeHtml(state.season)}" placeholder="2026/27"></div>
            <button class="btn secondary" id="saveSettings" type="button">Salva</button>
          </div>
        </details>

        <!-- DATI -->

        <div class="section-head">

            <h2>
                💾 Dati
            </h2>

        </div>


        <div class="data-management">

            <details class="card data-section settings-collapse"><summary><span class="settings-menu-icon" aria-hidden="true">↥</span><span class="settings-menu-label"><strong>Backup</strong><small>Salva e recupera i tuoi dati</small></span><span class="settings-chevron" aria-hidden="true">⌄</span></summary><div class="data-section-heading"><p>Salva o recupera una copia completa dei dati della squadra.</p></div>

                <div class="data-action-row">
                    <div>
                        <strong>Esporta backup</strong>
                        <div class="small muted">Include impostazioni, giocatori, regole, multe e pagamenti.</div>
                    </div>
                    <button class="btn secondary" id="exportData" type="button">Esporta</button>
                </div>

                <div class="data-action-row">
                    <div>
                        <strong>Importa backup</strong>
                        <div class="small muted">Recupera un file JSON esportato in precedenza.</div>
                    </div>
                    <button class="btn secondary" id="importData" type="button">Importa</button>
                </div>

                <div class="data-action-row">
                    <div>
                        <strong>Backup automatico</strong>
                        <div class="small muted">Copia locale aggiornata a ogni salvataggio, pronta da scaricare.</div>
                    </div>
                    <button class="btn secondary" id="exportAutoBackup" type="button">Esporta copia</button>
                </div>
            </details>

            ${renderOnlineHistorySettings()}

            <details class="card data-section settings-collapse"><summary><span class="settings-menu-icon" aria-hidden="true">▦</span><span class="settings-menu-label"><strong>Gestione stagione</strong><small>Quote, calendario e nuova annata</small></span><span class="settings-chevron" aria-hidden="true">⌄</span></summary><div class="data-section-heading"><p>Configura la quota mensile e prepara la prossima stagione mantenendo giocatori e Multario.</p></div>

                <div class="season-settings-overview">
                    <div><span>Stagione attiva</span><strong>${escapeHtml(state.season)}</strong></div>
                    <div><span>Quota ordinaria</span><strong>${money(state.seasonConfig?.monthlyBase ?? 5)}</strong></div>
                    <div><span>Scadenza multe</span><strong>${state.seasonConfig?.paymentMode === "rolling" ? "Mese corrente automatico" : `Mensile · giorno ${Math.min(28, Math.max(1, Number(state.seasonConfig?.paymentDueDay ?? 15) || 15))}`}</strong></div>
                    <div><span>Archiviate</span><strong>${state.seasonArchives?.length || 0}</strong></div>
                </div>

                <div class="data-action-row">
                    <div>
                        <strong>Configurazione attuale</strong>
                        <div class="small muted">Modifica quote e calendari anche a stagione già iniziata, senza azzerare dati.</div>
                    </div>
                    <button class="btn secondary" id="editSeasonConfig" type="button">Modifica</button>
                </div>

                ${LOCAL_CUSTOMIZATION_PREVIEW ? `<div class="data-action-row team-code-preview-row">
                    <div><strong>Configura con codice Tuttocampo</strong><div class="small muted">Prova locale: rileva automaticamente squadra, stemma e competizioni senza modificare i dati online.</div></div>
                    <div class="team-code-row-actions"><button class="btn secondary" id="refreshAllTeamInfo" type="button">↻ Aggiorna info</button><button class="btn secondary" id="openTeamCodeSetup" type="button">Configura</button></div>
                </div>` : ""}

                <div class="data-action-row">
                    <div>
                        <strong>Nuova stagione</strong>
                        <div class="small muted">Anteprima, quote personalizzabili, calendario e backup prima del passaggio.</div>
                    </div>
                    <button class="btn secondary" id="resetSeason" type="button">Configura</button>
                </div>
            </details>

            <details class="card data-section settings-collapse"><summary><span class="settings-menu-icon" aria-hidden="true">🔐</span><span class="settings-menu-label"><strong>Sicurezza Admin</strong><small>Password dell’account amministratore</small></span><span class="settings-chevron" aria-hidden="true">⌄</span></summary><div class="data-section-heading"><p>Cambia la password dell’account Admin già esistente.</p></div>
                <div class="data-action-row">
                    <div><strong>Cambia password</strong><div class="small muted">Richiede la password attuale e una nuova password di almeno 8 caratteri.</div></div>
                    <button class="btn secondary" id="changeAdminPassword" type="button">Modifica</button>
                </div>
            </details>

            <details class="card data-section settings-collapse data-section-danger"><summary><span class="settings-menu-icon" aria-hidden="true">!</span><span class="settings-menu-label"><strong>Operazioni irreversibili</strong><small>Ripristino e reset dei dati</small></span><span class="settings-chevron" aria-hidden="true">⌄</span></summary><div class="data-section-heading"><p>Usale soltanto se sei sicuro: i backup automatici restano disponibili per sicurezza.</p></div>

                <div class="data-action-row">
                    <div>
                        <strong>Ripristina demo</strong>
                        <div class="small muted">Cancella i dati attuali e torna ai dati di esempio.</div>
                    </div>
                    <button class="btn danger" id="resetData" type="button">Reset demo</button>
                </div>

                <div class="data-action-row">
                    <div>
                        <strong>Reset totale</strong>
                        <div class="small muted">Riporta l'app allo stato iniziale. Richiede la conferma RESET.</div>
                    </div>
                    <button class="btn danger" id="resetTotal" type="button">Reset totale</button>
                </div>
            </details>

        </div>

    `;

}


/* =========================================================
   MODALE GENERICA
   ========================================================= */

function openModal(title, content) {
    if (disposeExportPreview) {
        disposeExportPreview();
        disposeExportPreview = null;
    }


    const root =
        document.getElementById(
            "modalRoot"
        );


    root.innerHTML = `

        <div
            class="modal-backdrop"
            id="modalBackdrop"
        >

            <div class="modal">

                <div class="row">

                    <h2>
                        ${title}
                    </h2>

                    <button
                        class="icon-mini"
                        id="closeModal"
                        type="button"
                    >
                        ×
                    </button>

                </div>


                ${content}

            </div>

        </div>

    `;

    // Blocca il contenuto sottostante senza perdere la posizione di lettura.
    if (!document.body.classList.contains("modal-open")) {
        modalScrollPosition = window.scrollY;
        document.body.style.top = `-${modalScrollPosition}px`;
        document.body.classList.add("modal-open");
    }


    document
        .getElementById(
            "closeModal"
        )
        .onclick = closeModal;


    /* Su iPhone la modale si chiude solo con × o Annulla:        un tocco sui selettori non può più essere intercettato dallo sfondo. */

}


function closeModal() {
    if (disposeExportPreview) {
        disposeExportPreview();
        disposeExportPreview = null;
    }


    document.getElementById(
        "modalRoot"
    ).innerHTML = "";

    if (document.body.classList.contains("modal-open")) {
        document.body.classList.remove("modal-open");
        document.body.style.top = "";
        window.scrollTo(0, modalScrollPosition);
    }

}


/* =========================================================
   MODALE MULTA
   ========================================================= */

function openFineModal(id = null, presetRuleId = null) {

    if (!requireOnlineAdmin()) return;

    const fine = id
        ? state.fines.find(item => item.id === id)
        : null;

    const isEdit = Boolean(fine);


    /* =========================
       CATEGORIE
       ========================= */

    const categories = getSortedCategories(
        state.rules.map(rule => rule.category)
    );


    /* =========================
       MULTA PERSONALIZZATA
       ========================= */

    const CUSTOM_RULE_ID = "custom";


    /* =========================
       REGOLA INIZIALE
       ========================= */

    const initialRule = fine
        ? state.rules.find(
            rule =>
                rule.id === fine.ruleId
        )
        : state.rules.find(rule => String(rule.id) === String(presetRuleId)) || state.rules[0];

    const initialRuleId = fine?.ruleId ?? initialRule?.id ?? null;


    const initialCategory =
        initialRule?.category ||
        categories[0] ||
        "";


    const initialRules =
        state.rules.filter(
            rule =>
                rule.category ===
                initialCategory
        );



    /* =========================
       MODALE
       ========================= */

    openModal(

        isEdit
            ? "Modifica multa"
            : "Nuova multa",

        `

        <div class="form fine-form-refresh"><section class="fine-form-section"><div class="fine-section-title"><span>01</span><h3>A chi la assegni?</h3></div>

            ${
                !isEdit
                    ? `
                        <div class="field">
                            <label>DESTINATARI</label>
                            <select id="fineRecipients">
                                <option value="single" ${presetRuleId ? "" : "selected"}>Un giocatore</option>
                                <option value="multiple" ${presetRuleId ? "selected" : ""}>Più giocatori</option>
                                <option value="team">Tutta la squadra</option>
                            </select>
                        </div>
                    `
                    : ""
            }

            <!-- GIOCATORE -->

<div class="field">

    <label>
        GIOCATORE
    </label>

    <div id="finePlayerContainer">

        <select id="finePlayer">

            ${
                state.players.length
                    ?

                getSortedPlayers()
                    .map(
                        player => `

                            <option
                                value="${escapeHtml(player)}"
                                ${
                                    fine?.player === player
                                        ? "selected"
                                        : ""
                                }
                            >
                                ${escapeHtml(player)}
                            </option>

                        `
                    )
                    .join("")

                    :

                `
                    <option value="">
                        Nessun giocatore
                    </option>
                `
            }

        </select>

    </div>

</div>

            </section><section class="fine-form-section"><div class="fine-section-title"><span>02</span><h3>Per quale motivo?</h3></div><!-- CATEGORIA -->

            <div class="field">

                <label>
                    CATEGORIA
                </label>

                <div class="fine-select-control" id="fineCategoryControl">
<select id="fineCategory">

                    ${
                        categories
                            .map(
                                category => `

                                    <option
                                        value="${escapeHtml(category)}"
                                        ${
                                            category ===
                                            initialCategory
                                                ? "selected"
                                                : ""
                                        }
                                    >
                                        ${escapeHtml(category)}
                                    </option>

                                `
                            )
                            .join("")
                    }

                </select>
                    <button class="fine-select-trigger" id="fineCategoryTrigger" type="button" aria-haspopup="listbox" aria-expanded="false">Seleziona una categoria</button>
                    <div class="fine-select-menu" id="fineCategoryMenu" role="listbox" hidden></div>
                </div>

            </div>


            <!-- TIPO -->

            <div class="field">

                <label>
                    TIPO DI MULTA
                </label>

                <div class="fine-select-control" id="fineRuleControl">
<select id="fineRule">

                    ${
                        initialRules
                            .map(
                                rule => `

                                    <option
                                        value="${rule.id}"
                                        ${
                                            String(initialRuleId) ===
                                            String(rule.id)
                                                ? "selected"
                                                : ""
                                        }
                                    >
                                        ${escapeHtml(rule.type)}
                                        ·
                                        ${formatRuleAmount(rule)}
                                    </option>

                                `
                            )
                            .join("")
                    }

                    <option
                        value="${CUSTOM_RULE_ID}"
                        ${fine?.custom ? "selected" : ""}
                    >
                        ✏️ Multa personalizzata
                    </option>

                </select>
                    <button class="fine-select-trigger" id="fineRuleTrigger" type="button" aria-haspopup="listbox" aria-expanded="false">Seleziona il tipo di multa</button>
                    <div class="fine-select-menu" id="fineRuleMenu" role="listbox" hidden></div>
                </div>

            </div>


            <!-- DESCRIZIONE PERSONALIZZATA -->

            <div
                class="field"
                id="customDescriptionField"
                style="display:none;"
            >

                <label>
                    DESCRIZIONE
                </label>

                <input
                    id="customDescription"
                    type="text"
                    placeholder="Descrizione della multa"
                    value="${
                        fine?.custom
                            ? escapeHtml(
                                fine.type || ""
                            )
                            : ""
                    }"
                >

            </div>


            <!-- QUANTITÀ -->

            <div
                class="field"
                id="quantityField"
                style="display:none;"
            >

                <label id="quantityLabel">
                    QUANTITÀ
                </label>

                <input
                    id="fineQuantity"
                    type="number"
                    min="0"
                    step="1"
                    value="1"
                >

            </div>


            </section><section class="fine-form-section fine-details-section"><div class="fine-section-title"><span>03</span><h3>Data e importo</h3></div><!-- DATA -->

            <div class="field date-field">

                <label>
                    DATA
                </label>

                <div class="date-input-wrapper">

                    <input
                        id="fineDate"
                        type="date"
                        value="${
                            fine?.date ||
                            new Date()
                                .toISOString()
                                .slice(0, 10)
                        }"
                    >

                    <span
                        class="date-value"
                        id="fineDateValue"
                        aria-hidden="true"
                    ></span>

                </div>

                <div class="fine-date-shortcuts" aria-label="Scelte rapide data">
                    <button type="button" data-fine-date-offset="-1">Ieri</button>
                    <button type="button" data-fine-date-offset="0">Oggi</button>
                </div>

            </div>


            <!-- IMPORTO -->

            <div class="field" id="fineAmountField">

                <label>
                    IMPORTO (€)
                </label>

                <input
                    id="fineAmount"
                    type="number"
                    min="0"
                    step="1"
                    value="${
                        fine?.amount ??
                        initialRule?.amount ??
                        0
                    }"
                >

            </div>


            </section><!-- AZIONI -->

            <div class="modal-actions">

                <button
                    class="btn secondary"
                    id="cancelFine"
                    type="button"
                >
                    Annulla
                </button>


                <button
                    class="btn"
                    id="saveFine"
                    type="button"
                >
                    ${
                        isEdit
                            ? "Salva modifiche"
                            : "Aggiungi multa"
                    }
                </button>

            </div>

        </div>

        `

    );


    /* =========================
       ELEMENTI
       ========================= */

    document.querySelector("#modalRoot .modal")?.classList.add("fine-modal-refresh");
    const categorySelect =
        document.getElementById(
            "fineCategory"
        );

    const ruleSelect =
        document.getElementById(
            "fineRule"
        );

    const amountInput =
        document.getElementById(
            "fineAmount"
        );

    const amountField = document.getElementById("fineAmountField");

    const quantityField =
        document.getElementById(
            "quantityField"
        );

    const quantityLabel =
        document.getElementById(
            "quantityLabel"
        );

    const quantityInput =
        document.getElementById(
            "fineQuantity"
        );

    const customDescriptionField =
        document.getElementById(
            "customDescriptionField"
        );

    const customDescription =
        document.getElementById(
            "customDescription"
        );
    const finePlayerContainer =
    document.getElementById(
        "finePlayerContainer"
    );
    const recipientsSelect = document.getElementById("fineRecipients");


    /* Nuova multa generica: nessun valore precompilato.
       Dal Multario, invece, conserva categoria e regola scelte. */
    if (!isEdit && !presetRuleId) {
        const initialPlayerSelect = document.getElementById("finePlayer");

        initialPlayerSelect.insertAdjacentHTML(
            "afterbegin",
            '<option value="">Seleziona un giocatore</option>'
        );
        initialPlayerSelect.value = "";

        categorySelect.insertAdjacentHTML(
            "afterbegin",
            '<option value="">Seleziona una categoria</option>'
        );
        categorySelect.value = "";

        ruleSelect.innerHTML =
            '<option value="">Seleziona prima una categoria</option>';

        document.getElementById("fineDate").value = "";
        amountInput.value = "";
    }


    /* Data nativa con testo allineato e tocchi dei menu isolati. */
    const fineDateInput = document.getElementById("fineDate");
    const fineDateValue = document.getElementById("fineDateValue");

    function updateFineDateValue() {
        if (!fineDateInput.value) {
            fineDateValue.textContent = "Seleziona una data";
            return;
        }

        const [year, month, day] = fineDateInput.value.split("-");
        const label = new Date(
            Number(year),
            Number(month) - 1,
            Number(day)
        ).toLocaleDateString("it-IT", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });

        fineDateValue.textContent = label;
    }

    fineDateInput.addEventListener("input", updateFineDateValue);
    fineDateInput.addEventListener("change", updateFineDateValue);
    document.querySelectorAll("[data-fine-date-offset]").forEach(button => {
        button.addEventListener("click", () => {
            const date = new Date();
            date.setDate(date.getDate() + Number(button.dataset.fineDateOffset || 0));
            fineDateInput.value = [
                date.getFullYear(),
                String(date.getMonth() + 1).padStart(2, "0"),
                String(date.getDate()).padStart(2, "0")
            ].join("-");
            updateFineDateValue();
        });
    });
    updateFineDateValue();


    let refreshRuleMenu = () => {};
    const customFineMenus = [];
    const personalizedRecipientValues = new Map();

    function setupFineMenu(select, trigger, menu) {
        function render() {
            const selected = select.options[select.selectedIndex];
            trigger.textContent = selected
                ? selected.textContent.trim()
                : "Seleziona";

            menu.innerHTML = Array.from(select.options)
                .map(option =>                     `<button type="button" class="fine-select-option${option.value === select.value ? " is-selected" : ""}" data-value="${escapeHtml(option.value)}" role="option" aria-selected="${option.value === select.value}">${escapeHtml(option.textContent.trim())}</button>`                )
                .join("");
        }

        function close() {
            menu.hidden = true;
            trigger.setAttribute("aria-expanded", "false");
        }

        trigger.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            const isOpening = menu.hidden;
            customFineMenus.forEach(item => item.close());
            if (isOpening) {
                menu.hidden = false;
                trigger.setAttribute("aria-expanded", "true");
            }
        });

        menu.addEventListener("click", event => {
            const optionButton = event.target.closest(".fine-select-option");
            if (!optionButton) return;
            event.preventDefault();
            event.stopPropagation();
            select.value = optionButton.dataset.value;
            select.dispatchEvent(new Event("change", { bubbles: true }));
            render();
            close();
        });

        select.addEventListener("change", render);
        customFineMenus.push({ close, render });
        render();
        return { close, render };
    }

    setupFineMenu(
        categorySelect,
        document.getElementById("fineCategoryTrigger"),
        document.getElementById("fineCategoryMenu")
    );

    const ruleMenu = setupFineMenu(
        ruleSelect,
        document.getElementById("fineRuleTrigger"),
        document.getElementById("fineRuleMenu")
    );
    refreshRuleMenu = ruleMenu.render;

    function updatePersonalizedRecipientValues() {
        const container = document.getElementById("recipientVariableValues");
        if (!container) return;
        const rule = state.rules.find(item => String(item.id) === String(ruleSelect.value));
        const calculation = getRuleCalculation(rule);
        if (!rule || !["per_minute", "per_piece", "custom_min"].includes(calculation)) {
            container.innerHTML = "";
            container.hidden = true;
            return;
        }
        const players = Array.from(document.querySelectorAll("[data-fine-recipient]:checked")).map(input => input.value);
        if (!players.length) {
            container.innerHTML = "";
            container.hidden = true;
            return;
        }
        const settings = calculation === "per_minute"
            ? { label: "Minuti", min: 0, value: 0 }
            : calculation === "per_piece"
                ? { label: "Pezzi", min: 1, value: 1 }
                : { label: "Importo €", min: Number(rule.minAmount) || 0, value: Number(rule.minAmount) || 0 };
        container.hidden = false;
        container.innerHTML = `<strong>VALORI PER GIOCATORE</strong>${players.map(player => {
            const key = `${rule.id}|${player}`;
            const value = personalizedRecipientValues.has(key) ? personalizedRecipientValues.get(key) : settings.value;
            const total = calculation === "custom_min" ? Number(value) : calculateRuleAmount(rule, Number(value));
            return `<label class="recipient-value-row"><span>${escapeHtml(player)}</span><small>${settings.label}</small><input type="number" min="${settings.min}" step="${calculation === "custom_min" ? "0.01" : "1"}" value="${value}" data-recipient-value="${escapeHtml(player)}" data-recipient-value-key="${escapeHtml(key)}"><output>${money(total)}</output></label>`;
        }).join("")}`;
        container.querySelectorAll("[data-recipient-value]").forEach(input => {
            input.addEventListener("input", () => {
                personalizedRecipientValues.set(input.dataset.recipientValueKey, input.value);
                const value = Number(input.value);
                input.nextElementSibling.textContent = money(calculation === "custom_min" ? value : calculateRuleAmount(rule, value));
            });
        });
    }

    [categorySelect, ruleSelect, document.getElementById("finePlayer")]
        .filter(Boolean)
        .forEach(select => {
            ["touchstart", "touchend", "click"].forEach(eventName => {
                select.addEventListener(eventName, event => {
                    event.stopPropagation();
                });
            });
        });


    /* =========================
       AGGIORNA INTERFACCIA
       ========================= */

    function updateFineInterface() {

        queueMicrotask(updatePersonalizedRecipientValues);
        amountField.style.display = "";

        const selectedValue =
            ruleSelect.value;
       const selectedRule =
    state.rules.find(
        item =>
            String(item.id) ===
            String(selectedValue)
    );

        /* =========================
           SELEZIONE DESTINATARI
           ========================= */

        const recipientMode = isEdit
            ? "single"
            : recipientsSelect?.value || "single";
        const personalizedMode = recipientMode === "multiple";

        const rememberedPlayer =
            document.getElementById("finePlayer")?.value ||
            finePlayerContainer.dataset.selectedPlayer ||
            fine?.player ||
            "";

        const rememberedPlayers = Array.from(
            document.querySelectorAll("[data-fine-recipient]:checked")
        ).map(input => input.value);

        if (rememberedPlayer) {
            finePlayerContainer.dataset.selectedPlayer = rememberedPlayer;
        }

        if (rememberedPlayers.length) {
            finePlayerContainer.dataset.selectedPlayers = JSON.stringify(rememberedPlayers);
        }

        let selectedPlayers = [];
        try {
            selectedPlayers = JSON.parse(
                finePlayerContainer.dataset.selectedPlayers || "[]"
            );
        } catch (error) {
            selectedPlayers = [];
        }

        if (recipientMode === "team") {
            finePlayerContainer.innerHTML = `
                <div class="recipient-notice" id="teamFinePlayersNotice">
                    👥 La multa sarà assegnata automaticamente a tutti i giocatori della rosa.
                </div>
            `;
        } else if (recipientMode === "multiple") {
            finePlayerContainer.innerHTML = `
                <div class="recipient-actions">
                    <button type="button" data-select-all-recipients>Seleziona tutti</button>
                    <button type="button" data-clear-recipients>Deseleziona</button>
                </div>
                <div class="recipient-list" role="group" aria-label="Giocatori destinatari">
                    ${getSortedPlayers().map(player => `
                        <label class="recipient-option">
                            <input
                                type="checkbox"
                                data-fine-recipient
                                value="${escapeHtml(player)}"
                                ${selectedPlayers.includes(player) ? "checked" : ""}
                            >
                            <span>${escapeHtml(player)}</span>
                        </label>
                    `).join("")}
                </div>
                <div class="recipient-variable-values" id="recipientVariableValues" hidden></div>
                <small class="muted">Seleziona i giocatori a cui applicare la multa.</small>
            `;

            finePlayerContainer.querySelectorAll("[data-fine-recipient]").forEach(input => {
                input.addEventListener("change", updatePersonalizedRecipientValues);
            });

            finePlayerContainer
                .querySelector("[data-select-all-recipients]")
                .addEventListener("click", () => {
                    finePlayerContainer
                        .querySelectorAll("[data-fine-recipient]")
                        .forEach(input => { input.checked = true; });
                    updatePersonalizedRecipientValues();
                });

            finePlayerContainer
                .querySelector("[data-clear-recipients]")
                .addEventListener("click", () => {
                    finePlayerContainer
                        .querySelectorAll("[data-fine-recipient]")
                        .forEach(input => { input.checked = false; });
                    updatePersonalizedRecipientValues();
                });
        } else if (!document.getElementById("finePlayer")) {
            finePlayerContainer.innerHTML = `
                <select id="finePlayer">
                    <option value="">Seleziona un giocatore</option>
                    ${getSortedPlayers().map(player => `
                        <option
                            value="${escapeHtml(player)}"
                            ${rememberedPlayer === player ? "selected" : ""}
                        >${escapeHtml(player)}</option>
                    `).join("")}
                </select>
            `;
        }


        /* =========================
           MULTA PERSONALIZZATA
           ========================= */

        if (
            selectedValue ===
            CUSTOM_RULE_ID
        ) {

            customDescriptionField.style.display =
                "block";

            quantityField.style.display =
                "none";

            amountInput.disabled =
                false;

            amountInput.min =
                "0";

            amountInput.value =
                fine?.custom
                    ? fine.amount
                    : "";

            return;

        }


        customDescriptionField.style.display =
            "none";


        /* =========================
           REGOLA NORMALE
           ========================= */

        const rule =
            state.rules.find(
                item =>
                    String(item.id) ===
                    String(selectedValue)
            );


        if (!rule) {

            quantityField.style.display =
                "none";

            amountInput.disabled =
                false;

            amountInput.value =
                "";

            return;

        }

        /* =========================
           RITARDO AL MINUTO
           ========================= */

        if (
            rule.calculation ===
            "per_minute"
        ) {

            quantityField.style.display = personalizedMode ? "none" : "block";
            if (personalizedMode) amountField.style.display = "none";

            quantityLabel.textContent =
                "MINUTI DI RITARDO";

            quantityInput.min =
                "0";

            quantityInput.step =
                "1";

            quantityInput.value =
                fine?.quantity ??
                0;


            amountInput.disabled =
                true;

            amountInput.value = calculateRuleAmount(
                rule,
                quantityInput.value
            );

            return;

        }


        /* =========================
           IMPORTO PER PEZZO
           ========================= */

        if (
            rule.calculation ===
            "per_piece"
        ) {

            quantityField.style.display = personalizedMode ? "none" : "block";
            if (personalizedMode) amountField.style.display = "none";

            quantityLabel.textContent =
                "NUMERO DI PEZZI";

            quantityInput.min =
                "1";

            quantityInput.step =
                "1";

            quantityInput.value =
                fine?.quantity ??
                1;


            amountInput.disabled =
                true;

            amountInput.value = calculateRuleAmount(
                rule,
                Number(quantityInput.value) || 1
            );

            return;

        }


        /* =========================
           IMPORTO MINIMO
           ========================= */

        if (
            rule.calculation ===
            "custom_min"
        ) {

            quantityField.style.display =
                "none";
            if (personalizedMode) amountField.style.display = "none";

            amountInput.disabled =
                false;

            amountInput.min =
                rule.minAmount;

            amountInput.value =
                fine?.amount ??
                rule.minAmount;

            return;

        }


        /* =========================
           MULTA FISSA
           ========================= */

        quantityField.style.display =
            "none";

        amountInput.disabled =
            true;

        amountInput.min =
            "0";

        amountInput.value =
            rule.amount;

    }


    /* =========================
       AGGIORNA REGOLE
       ========================= */

    function updateRules() {

        const category =
            categorySelect.value;

        const rules = state.rules.filter(
            rule => rule.category === category
        );

        ruleSelect.innerHTML =
            '<option value="">Seleziona il tipo di multa</option>' +
            rules
                .map(
                    rule => `

                        <option
                            value="${rule.id}"
                        >
                            ${escapeHtml(
                                rule.type
                            )}
                            ·
                            ${formatRuleAmount(rule)}
                        </option>

                    `
                )
            .join("") + `
                <option value="${CUSTOM_RULE_ID}">
                    ✏️ Multa personalizzata
                </option>
            `;

        ruleSelect.value = "";

        refreshRuleMenu();
        updateFineInterface();

    }

    /* =========================
       CAMBIO CATEGORIA
       ========================= */

    categorySelect.addEventListener(
        "change",
        updateRules
    );


    /* =========================
       CAMBIO TIPO
       ========================= */

    ruleSelect.addEventListener(
        "change",
        updateFineInterface
    );

    recipientsSelect?.addEventListener("change", updateFineInterface);


    /* =========================
       CAMBIO QUANTITÀ
       ========================= */

    quantityInput.addEventListener(
        "input",
        () => {

            const selectedValue =
                ruleSelect.value;


            const rule =
                state.rules.find(
                    item =>
                        String(item.id) ===
                        String(selectedValue)
                );


            if (!rule) {
                return;
            }


            const quantity =
                Number(
                    quantityInput.value
                ) || 0;


            if (
                rule.calculation ===
                "per_minute"
            ) {

                amountInput.value = calculateRuleAmount(rule, quantity);

            }


            if (
                rule.calculation ===
                "per_piece"
            ) {

                amountInput.value = calculateRuleAmount(rule, quantity);

            }

        }
    );


    /* =========================
       ANNULLA
       ========================= */

    document
        .getElementById(
            "cancelFine"
        )
        .onclick =
            closeModal;


    /* =========================
       SALVA
       ========================= */

    /* =========================
   SALVA
   ========================= */

document
    .getElementById(
        "saveFine"
    )
    .onclick = () => {

        const previousState = structuredClone(state);

        const singlePlayerSelect =
            document.getElementById(
                "finePlayer"
            );

        const player =
            singlePlayerSelect
                ? singlePlayerSelect.value
                : "";

        const recipientMode = isEdit
            ? "single"
            : recipientsSelect?.value || "single";

        const selectedPlayers = recipientMode === "team"
            ? getSortedPlayers()
            : recipientMode === "multiple"
                ? Array.from(
                    document.querySelectorAll("[data-fine-recipient]:checked")
                ).map(input => input.value)
                : [player].filter(Boolean);

        const date =
            parseFineDate(
                document
                    .getElementById(
                        "fineDate"
                    )
                    .value
            );

        const selectedRule =
            ruleSelect.value;

        const rule =
            state.rules.find(
                item =>
                    String(item.id) ===
                    String(selectedRule)
            );

        /* =========================
           MULTA PERSONALIZZATA
           ========================= */

        if (
            selectedRule ===
            CUSTOM_RULE_ID
        ) {

            const description =
                customDescription.value.trim();

            const customAmount =
                Number(
                    amountInput.value
                );

            if (
                (isEdit ? !player : selectedPlayers.length === 0) ||
                !date ||
                !description ||
                !Number.isFinite(
                    customAmount
                ) ||
                customAmount < 0
            ) {

                showToast(
                    "Controlla i dati inseriti."
                );

                return;
            }


            if (isEdit) {

                fine.player =
                    player;

                fine.category =
                    "Personalizzata";

                fine.type =
                    description;

                fine.ruleId =
                    null;

                fine.custom =
                    true;

                fine.quantity =
                    null;

                fine.date =
                    date;

                fine.amount =
                    customAmount;

            } else {

                selectedPlayers.forEach(playerName => {
                    state.fines.push({
                        id: generateId(),
                        date,
                        player: playerName,
                        category: recipientMode === "team" ? "Squadra" : "Personalizzata",
                        type: description,
                        ruleId: null,
                        custom: true,
                        team: recipientMode === "team",
                        createdAt: new Date().toISOString(),
                        quantity: null,
                        amount: customAmount
                    });
                });

            }


            saveState();

            closeModal();

            render();

            offerUndo(
                isEdit
                    ? "Multa modificata"
                    : selectedPlayers.length > 1
                        ? `${selectedPlayers.length} multe aggiunte`
                        : "Multa aggiunta",
                previousState
            );

            return;
        }

        /* =========================
           REGOLA NORMALE
           ========================= */

        const ruleId =
            Number(
                selectedRule
            );


        if (
            (isEdit ? !player : selectedPlayers.length === 0) ||
            !rule ||
            !date
        ) {

            showToast(
                "Controlla i dati inseriti."
            );

            return;
        }


        let amount =
            Number(
                amountInput.value
            );

        const personalizedValues = new Map(
            Array.from(document.querySelectorAll("[data-recipient-value]"))
                .map(input => [input.dataset.recipientValue, Number(input.value)])
        );
        const usesPersonalizedValues = !isEdit && recipientMode === "multiple" &&
            ["per_minute", "per_piece", "custom_min"].includes(getRuleCalculation(rule));

        if (usesPersonalizedValues && selectedPlayers.some(playerName => {
            const value = personalizedValues.get(playerName);
            if (!Number.isFinite(value)) return true;
            if (getRuleCalculation(rule) === "per_piece") return value < 1;
            if (getRuleCalculation(rule) === "custom_min") return value < (Number(rule.minAmount) || 0);
            return value < 0;
        })) {
            showToast("Controlla i valori inseriti per ogni giocatore.");
            return;
        }

        let quantity =
            null;


        /* =========================
           CALCOLO AL MINUTO
           ========================= */

        if (
            rule.calculation ===
            "per_minute"
        ) {

            quantity =
                Number(
                    quantityInput.value
                ) || 0;

            amount = calculateRuleAmount(rule, quantity);
        }


        /* =========================
           CALCOLO PER PEZZO
           ========================= */

        if (
            rule.calculation ===
            "per_piece"
        ) {

            quantity =
                Number(
                    quantityInput.value
                ) || 0;


            if (
                quantity < 1
            ) {

                showToast(
                    "Inserisci almeno 1 pezzo."
                );

                return;
            }


            amount = calculateRuleAmount(rule, quantity);
        }


        /* =========================
           IMPORTO MINIMO
           ========================= */

        if (
            rule.calculation ===
            "custom_min"
        ) {

            if (
                amount <
                rule.minAmount
            ) {

                showToast(
                    `L'importo minimo è ${money(
                        rule.minAmount
                    )}.`
                );

                return;
            }
        }


        if (
            !Number.isFinite(
                amount
            ) ||
            amount < 0
        ) {

            showToast(
                "Controlla l'importo."
            );

            return;
        }


        /* =========================
           MODIFICA
           ========================= */

        if (isEdit) {

            fine.player =
                player;

            fine.ruleId =
                ruleId;

            fine.category =
                rule.category;

            fine.type =
                rule.type;

            fine.date =
                date;

            fine.amount =
                amount;

            fine.quantity =
                quantity;

            fine.custom =
                false;

        }


        /* =========================
           NUOVA MULTA
           ========================= */

        else {

            selectedPlayers.forEach(playerName => {
                const personalValue = personalizedValues.get(playerName);
                const personalQuantity = usesPersonalizedValues && ["per_minute", "per_piece"].includes(getRuleCalculation(rule))
                    ? personalValue
                    : quantity;
                const personalAmount = usesPersonalizedValues
                    ? getRuleCalculation(rule) === "custom_min"
                        ? personalValue
                        : calculateRuleAmount(rule, personalValue)
                    : amount;
                state.fines.push({
                    id: generateId(),
                    date,
                    player: playerName,
                    category: rule.category,
                    type: rule.type,
                    ruleId,
                    quantity: personalQuantity,
                    custom: false,
                    team: recipientMode === "team",
                    createdAt: new Date().toISOString(),
                    amount: personalAmount
                });
            });

        }


        saveState();

        closeModal();

        render();

        offerUndo(
            isEdit
                ? "Multa modificata"
            : selectedPlayers.length > 1
                ? `${selectedPlayers.length} multe aggiunte`
                : "Multa aggiunta",
            previousState
        );

    };


    /* =========================
       INIZIALIZZAZIONE
       ========================= */

    updateFineInterface();

}

/* =========================================================
   MODALE REGOLA
   ========================================================= */

function openRuleModal(id = null) {

    if (!requireOnlineAdmin()) return;

    const rule = id
        ? state.rules.find(item => item.id === id)
        : null;
    const calculation = getRuleCalculation(rule);
    const existingCategories = getSortedCategories(
        state.rules.map(item => item.category)
    );
    const newCategoryValue = "__new_category__";
    const initialCategoryValue = rule?.category || existingCategories[0] || newCategoryValue;

    openModal(
        id ? "Modifica regola" : "Nuova regola",
        `
            <div class="form rule-form-refresh">
                <section class="rule-form-section">
                <div class="fine-section-title"><span>01</span><h3>Descrivi la regola</h3></div>
                <div class="field">
                    <label>CATEGORIA</label>
                    <select id="ruleCategorySelect">
                        ${existingCategories.map(category => `
                            <option value="${escapeHtml(category)}"
                                ${category === initialCategoryValue ? "selected" : ""}>
                                ${escapeHtml(category)}
                            </option>
                        `).join("")}
                        <option value="${newCategoryValue}"
                            ${initialCategoryValue === newCategoryValue ? "selected" : ""}>
                            + Nuova categoria…
                        </option>
                    </select>
                </div>

                <div class="field" id="ruleNewCategoryField" hidden>
                    <label>NOME NUOVA CATEGORIA</label>
                    <input id="ruleNewCategory" type="text"
                        placeholder="Es. Allenamento" autocomplete="off">
                </div>

                <div class="field">
                    <label>TIPOLOGIA</label>
                    <input id="ruleType" type="text"
                        value="${escapeHtml(rule?.type || "")}"
                        placeholder="Es. Ritardo allenamento">
                </div>
                </section>

                <section class="rule-form-section rule-calculation-section">
                <div class="fine-section-title"><span>02</span><h3>Imposta il calcolo</h3></div>
                <div class="field">
                    <label>TIPO DI CALCOLO</label>
                    <select id="ruleCalculation">
                        <option value="fixed" ${calculation === "fixed" ? "selected" : ""}>Importo fisso</option>
                        <option value="per_minute" ${calculation === "per_minute" ? "selected" : ""}>Importo × minuti</option>
                        <option value="per_piece" ${calculation === "per_piece" ? "selected" : ""}>Importo × quantità</option>
                        <option value="custom_min" ${calculation === "custom_min" ? "selected" : ""}>Importo libero con minimo</option>
                    </select>
                </div>

                <div class="field" id="ruleFixedField">
                    <label>IMPORTO FISSO (€)</label>
                    <input id="ruleAmount" type="number" min="0" step="0.01"
                        value="${rule?.amount ?? 5}">
                </div>

                <div class="field" id="ruleMinuteBaseField">
                    <label>IMPORTO BASE (€)</label>
                    <input id="ruleBaseAmount" type="number" min="0" step="0.01"
                        value="${rule?.baseAmount ?? rule?.amount ?? 0}">
                </div>

                <div class="field" id="ruleMinuteRateField">
                    <label>IMPORTO PER MINUTO (€)</label>
                    <input id="rulePerMinute" type="number" min="0" step="0.01"
                        value="${rule?.perMinute ?? 1}">
                </div>

                <div class="field" id="rulePieceField">
                    <label>IMPORTO PER PEZZO (€)</label>
                    <input id="rulePerPiece" type="number" min="0" step="0.01"
                        value="${rule?.perPiece ?? rule?.amount ?? 1}">
                </div>

                <div class="field" id="ruleMinimumField">
                    <label>IMPORTO MINIMO (€)</label>
                    <input id="ruleMinimum" type="number" min="0" step="0.01"
                        value="${rule?.minAmount ?? rule?.amount ?? 0}">
                </div>
                </section>

                <div class="modal-actions">
                    <button class="btn secondary" id="cancelRule" type="button">Annulla</button>
                    <button class="btn" id="saveRule" type="button">Salva</button>
                </div>
            </div>
        `
    );
    document.querySelector("#modalRoot .modal")?.classList.add("rule-modal-refresh");

    const categorySelect = document.getElementById("ruleCategorySelect");
    const newCategoryField = document.getElementById("ruleNewCategoryField");
    const newCategoryInput = document.getElementById("ruleNewCategory");
    const calculationSelect = document.getElementById("ruleCalculation");
    const calculationFields = {
        fixed: ["ruleFixedField"],
        per_minute: ["ruleMinuteBaseField", "ruleMinuteRateField"],
        per_piece: ["rulePieceField"],
        custom_min: ["ruleMinimumField"]
    };

    function updateRuleCalculationFields() {
        Object.entries(calculationFields).forEach(([key, ids]) => {
            ids.forEach(fieldId => {
                document.getElementById(fieldId).hidden = key !== calculationSelect.value;
            });
        });
    }

    calculationSelect.addEventListener("change", updateRuleCalculationFields);
    updateRuleCalculationFields();

    function updateNewCategoryField() {
        const creatingCategory = categorySelect.value === newCategoryValue;
        newCategoryField.hidden = !creatingCategory;
        if (creatingCategory) newCategoryInput.focus();
    }

    categorySelect.addEventListener("change", updateNewCategoryField);
    updateNewCategoryField();
    document.getElementById("cancelRule").onclick = closeModal;

    document.getElementById("saveRule").onclick = () => {
        const category = categorySelect.value === newCategoryValue
            ? newCategoryInput.value.trim()
            : categorySelect.value.trim();
        const type = document.getElementById("ruleType").value.trim();
        const selectedCalculation = calculationSelect.value;
        const values = {
            amount: Number(document.getElementById("ruleAmount").value),
            baseAmount: Number(document.getElementById("ruleBaseAmount").value),
            perMinute: Number(document.getElementById("rulePerMinute").value),
            perPiece: Number(document.getElementById("rulePerPiece").value),
            minAmount: Number(document.getElementById("ruleMinimum").value)
        };

        if (!category || !type) {
            showToast("Compila categoria e tipologia.");
            return;
        }

        const requiredValues = selectedCalculation === "fixed"
            ? [values.amount]
            : selectedCalculation === "per_minute"
                ? [values.baseAmount, values.perMinute]
                : selectedCalculation === "per_piece"
                    ? [values.perPiece]
                    : [values.minAmount];

        if (requiredValues.some(value => !Number.isFinite(value) || value < 0)) {
            showToast("Inserisci importi validi.");
            return;
        }

        // Mantiene eventuali campi legacy o estensioni future della regola.
        const newRule = {
            ...(rule || {}),
            id: id || generateId(),
            category,
            type,
            calculation: selectedCalculation
        };

        if (selectedCalculation === "fixed") {
            newRule.amount = values.amount;
        } else if (selectedCalculation === "per_minute") {
            newRule.baseAmount = values.baseAmount;
            newRule.perMinute = values.perMinute;
            newRule.amount = values.baseAmount;
        } else if (selectedCalculation === "per_piece") {
            newRule.perPiece = values.perPiece;
            newRule.amount = values.perPiece;
        } else {
            newRule.minAmount = values.minAmount;
            newRule.amount = values.minAmount;
        }

        if (id) {
            const index = state.rules.findIndex(item => item.id === id);
            if (index === -1) {
                showToast("Regola non trovata.");
                return;
            }
            state.rules[index] = newRule;
        } else {
            state.rules.push(newRule);
        }

        saveState();
        closeModal();
        render();
        showToast("Regola salvata");
    };

}


/* =========================================================
   MODALE GIOCATORE
   ========================================================= */

function openPlayerModal() {

    if (!requireOnlineAdmin()) return;

    const playerStartOptions = getPaymentMonths();
    const currentMonth = birthdayToday().slice(0, 7);
    const defaultStartMonth = playerStartOptions.includes(currentMonth)
        ? currentMonth
        : playerStartOptions[0];
    let pendingPhoto = "";
    let photoBusy = false;

    openModal(

        "Nuovo giocatore",

        `

        <div class="form">

            <div class="photo-editor">
                <div class="photo-editor-preview" id="newPlayerPhotoPreview">${playerPortrait("Nuovo giocatore", "")}</div>
                <div class="photo-editor-actions">
                    <label class="btn secondary photo-upload-button" for="newPlayerPhotoFile">Scegli foto</label>
                    <input id="newPlayerPhotoFile" class="photo-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif">
                    <button class="btn secondary" id="removeNewPlayerPhoto" type="button" disabled>Rimuovi</button>
                </div>
                <span class="small muted" id="newPlayerPhotoStatus">Puoi aggiungere e centrare subito la foto del giocatore.</span>
            </div>

            <div class="photo-crop-controls" id="photoCropControls" hidden>
                <canvas id="photoCropCanvas" width="320" height="320" aria-label="Anteprima ritaglio foto"></canvas>
                <label for="photoCropZoom">Zoom</label><input id="photoCropZoom" type="range" min="1" max="3" step="0.01" value="1">
                <label for="photoCropX">Spostamento orizzontale</label><input id="photoCropX" type="range" min="-100" max="100" step="1" value="0">
                <label for="photoCropY">Spostamento verticale</label><input id="photoCropY" type="range" min="-100" max="100" step="1" value="0">
            </div>

            <div class="field">

                <label>
                    NOME
                </label>

                <input
                    id="playerName"
                    type="text"
                    placeholder="Nome giocatore"
                >

            </div>


            <div class="field"><label for="playerBirthDate">DATA DI NASCITA (facoltativa)</label><input id="playerBirthDate" type="date" min="1900-01-01" max="${birthdayToday()}"></div>

            <div class="field">
                <label for="playerStartMonth">CONTEGGIA QUOTE E MULTE DA</label>
                <select id="playerStartMonth">
                    ${playerStartOptions.map(month => `
                        <option value="${month}" ${month === defaultStartMonth ? "selected" : ""}>
                            ${escapeHtml(new Date(`${month}-01T12:00:00`).toLocaleDateString("it-IT", { month: "long", year: "numeric" }))}
                        </option>
                    `).join("")}
                </select>
                <span class="small muted">I mesi precedenti non genereranno quote o arretrati.</span>
            </div>
            <div class="modal-actions">

                <button
                    class="btn secondary"
                    id="cancelPlayer"
                    type="button"
                >
                    Annulla
                </button>


                <button
                    class="btn"
                    id="savePlayer"
                    type="button"
                >
                    Aggiungi
                </button>

            </div>

        </div>

        `

    );

    document.querySelector("#modalRoot .modal")?.classList.add("player-create-modal");


    const photoInput = document.getElementById("newPlayerPhotoFile");
    const photoPreview = document.getElementById("newPlayerPhotoPreview");
    const photoStatus = document.getElementById("newPlayerPhotoStatus");
    const removePhoto = document.getElementById("removeNewPlayerPhoto");
    const savePlayer = document.getElementById("savePlayer");

    photoInput.onchange = async () => {
        const file = photoInput.files?.[0];
        if (!file || !requireOnlineAdmin()) return;
        photoBusy = true;
        savePlayer.disabled = true;
        photoStatus.textContent = "Preparazione foto…";
        try {
            const result = await preparePlayerPhoto(file, data => {
                pendingPhoto = data;
                photoPreview.innerHTML = playerPortrait("Nuovo giocatore", data);
            });
            pendingPhoto = result;
            photoPreview.innerHTML = playerPortrait("Nuovo giocatore", result);
            removePhoto.disabled = false;
            photoStatus.textContent = "Foto pronta. Premi Aggiungi per salvare tutto insieme.";
        } catch (error) {
            photoStatus.textContent = error?.message || "Impossibile preparare la foto.";
        } finally {
            photoBusy = false;
            savePlayer.disabled = false;
        }
    };

    removePhoto.onclick = () => {
        pendingPhoto = "";
        photoInput.value = "";
        photoPreview.innerHTML = playerPortrait("Nuovo giocatore", "");
        removePhoto.disabled = true;
        photoStatus.textContent = "Puoi aggiungere e centrare subito la foto del giocatore.";
        document.getElementById("photoCropControls").hidden = true;
    };


    document
        .getElementById(
            "cancelPlayer"
        )
        .onclick = closeModal;


    document
        .getElementById(
            "savePlayer"
        )
        .onclick = () => {
            if (!requireOnlineAdmin()) return;
            if (photoBusy) return showToast("Attendi la preparazione della foto.");
            const birthDate = document.getElementById("playerBirthDate").value;
            const startMonth = document.getElementById("playerStartMonth").value;
            if (birthDate && !validBirthday(birthDate)) return showToast("Inserisci una data di nascita valida.");
            if (!playerStartOptions.includes(startMonth)) return showToast("Seleziona una mensilità valida.");

            const name =
                document
                    .getElementById(
                        "playerName"
                    )
                    .value
                    .trim();


            if (!name) {

                showToast(
                    "Inserisci il nome."
                );

                return;

            }


            if (
                state.players.includes(
                    name
                )
            ) {

                showToast(
                    "Giocatore già presente."
                );

                return;

            }


            const previousState = structuredClone(state);

            state.players.push(
                name
            );


            state.playerStartMonths = {
                ...(state.playerStartMonths || {}),
                [name]: startMonth
            };


            if (pendingPhoto) {
                state.playerPhotos = {
                    ...(state.playerPhotos || {}),
                    [name]: pendingPhoto
                };
            }

            if (birthDate) setBirthday(name, birthDate);
            try {
                saveState();
            } catch (error) {
                state = previousState;
                showToast("Spazio insufficiente: il giocatore non è stato aggiunto.");
                return;
            }

            closeModal();

            render();

            showToast(
                "Giocatore aggiunto"
            );

        };

}


/* =========================================================
   EVENTI PAGINA
   ========================================================= */

function bindPageEvents() {

    /* =========================
       NAVIGAZIONE
       ========================= */

    document
        .querySelectorAll(
            ".nav-button"
        )
        .forEach(button => {

            button.onclick = () => {

                if (button.dataset.page === "settings" && currentPage === "settings") {
                    currentPage = pageBeforeSettings;
                    render();
                    return;
                }

                if (button.dataset.page === "settings" && !isAdmin) {
                    showToast("Per aprire Impostazioni devi accedere come amministratore.");
                    return;
                }

                if (button.dataset.page === "settings" && !navigator.onLine) {
                    showToast("Le impostazioni si modificano solo online.");
                    return;
                }

                if (button.dataset.page === "settings") pageBeforeSettings = currentPage;
                currentPage = button.dataset.page;

                render();

            };

        });


/* =========================
   MESI
   ========================= */

document
    .getElementById("monthSelect")
    ?.addEventListener("change", event => {

        selectedMonth =
            event.target.value;

        render();

    });

document
    .querySelectorAll("[data-fine-period]")
    .forEach(button => {
        button.addEventListener("click", () => {
            selectedMonth = button.dataset.finePeriod;
            render();
        });
    });


/* =========================
   GIOCATORE MULTE
   ========================= */

document
    .getElementById("finePlayerSelect")
    ?.addEventListener(
        "change",
        event => {

            selectedFinePlayer =
                event.target.value;

            render();

        }
    );


document
    .getElementById("fineSearch")
    ?.addEventListener("input", event => {
        fineSearchQuery = event.target.value;
        render();
        requestAnimationFrame(() => {
            const input = document.getElementById("fineSearch");
            input?.focus();
            input?.setSelectionRange(fineSearchQuery.length, fineSearchQuery.length);
        });
    });


/* =========================
   MESE PAGAMENTI
   ========================= */

    document
       .getElementById("paymentMonthSelect")
       ?.addEventListener("change", event => {

           selectedPaymentMonth =
            event.target.value;

           render();

    });

    /* =========================
       NUOVA MULTA
       ========================= */

    document
        .getElementById(
            "addFine"
        )
        ?.addEventListener(
            "click",
            () =>
                openFineModal()
        );

    document
        .getElementById("globalAddFine")
        .onclick = openFineModal;


    document
        .getElementById(
            "addFineEmpty"
        )
        ?.addEventListener(
            "click",
            () =>
                openFineModal()
        );


    /* =========================
       HOME → MULTE
       ========================= */

    document
        .getElementById(
            "goToFines"
        )
        ?.addEventListener(
            "click",
            () => {

                currentPage =
                    "fines";

                render();

            }
        );

    document
        .getElementById("toggleRanking")
        ?.addEventListener("click", () => {
            showAllRanking = !showAllRanking;
            render();
        });

    document
        .getElementById("toggleMonthlySummary")
        ?.addEventListener("click", () => {
            showMonthlySummary = !showMonthlySummary;
            render();
        });

    document
        .getElementById("toggleOverduePlayers")
        ?.addEventListener("click", () => {
            showAllOverduePlayers = !showAllOverduePlayers;
            render();
        });

    document.querySelectorAll("[data-overdue-month]").forEach(button => {
        button.addEventListener("click", () => {
            overdueMonthView = button.dataset.overdueMonth === "current" ? "current" : "previous";
            showAllOverduePlayers = false;
            render();
        });
    });




    /* =========================
       MODIFICA MULTA
       ========================= */

    document
        .querySelectorAll(
            "[data-edit-fine]"
        )
        .forEach(button => {

            button.onclick = () => {

                openFineModal(
                    Number(
                        button.dataset
                            .editFine
                    )
                );

            };

        });


    /* =========================
       ELIMINA MULTA
       ========================= */

    document
        .querySelectorAll(
            "[data-delete-fine]"
        )
        .forEach(button => {

            button.onclick = () => {

                if (!requireOnlineAdmin()) return;

                const id =
                    Number(
                        button.dataset
                            .deleteFine
                    );


                if (
                    !confirm(
                        "Eliminare questa multa?"
                    )
                ) {

                    return;

                }

                const previousState = structuredClone(state);

                state.fines =
                    state.fines.filter(
                        fine =>
                            fine.id !== id
                    );


                saveState();

                render();

                offerUndo("Multa eliminata", previousState);

            };

        });


    /* =========================
       NUOVA REGOLA
       ========================= */

    document
        .getElementById(
            "addRule"
        )
        ?.addEventListener(
            "click",
            () =>
                openRuleModal()
        );


    /* =========================
       ASSEGNA DAL MULTARIO
       ========================= */

    document
        .querySelectorAll("[data-assign-rule]")
        .forEach(row => {
            const assign = event => {
                if (event.target.closest("[data-edit-rule], [data-delete-rule]")) return;
                if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
                event.preventDefault();
                openFineModal(null, row.dataset.assignRule);
            };
            row.addEventListener("click", assign);
            row.addEventListener("keydown", assign);
        });


    /* =========================
       MODIFICA REGOLA
       ========================= */

    document
        .querySelectorAll(
            "[data-edit-rule]"
        )
        .forEach(button => {

            button.onclick = () => {

                openRuleModal(
                    Number(
                        button.dataset
                            .editRule
                    )
                );

            };

        });


    /* =========================
       ELIMINA REGOLA
       ========================= */

    document
        .querySelectorAll(
            "[data-delete-rule]"
        )
        .forEach(button => {

            button.onclick = () => {

                if (!requireOnlineAdmin()) return;

                const id =
                    Number(
                        button.dataset
                            .deleteRule
                    );


                if (
                    !confirm(
                        "Eliminare questa regola?"
                    )
                ) {

                    return;

                }


                state.rules =
                    state.rules.filter(
                        rule =>
                            rule.id !== id
                    );


                saveState();

                render();

                showToast(
                    "Regola eliminata"
                );

            };

        });


    /* =========================
       GIOCATORE
       ========================= */

    document
        .getElementById(
            "addPlayer"
        )
        ?.addEventListener(
            "click",
            openPlayerModal
        );


    /* =========================
       ELIMINA GIOCATORE
       ========================= */

    document
        .querySelectorAll(
            "[data-delete-player]"
        )
        .forEach(button => {

            button.onclick = () => {

                if (!requireOnlineAdmin()) return;

                const player = button.dataset.deletePlayer;
                const index = state.players.indexOf(player);


                if (!player || index < 0) {

                    return;

                }


                if (
                    !confirm(
                        `Rimuovere ${player} dalla rosa?`
                    )
                ) {

                    return;

                }


                state.players.splice(
                    index,
                    1
                );


                saveState();

                render();

            };

        });

   document
   .getElementById("exportPaymentsImage")
    ?.addEventListener(
        "click",
        () => exportPaymentsImage("all")
    );

   document
    .getElementById("exportDuePaymentsImage")
    ?.addEventListener(
        "click",
        () => exportPaymentsImage("due")
    );

   document
    .getElementById("exportSeasonImage")
    ?.addEventListener(
        "click",
        exportSeasonImage
    );

   document
    .getElementById("exportSeasonDetailedImage")
    ?.addEventListener(
        "click",
        openSeasonDetailedReport
    );

    document
        .querySelectorAll("[data-player-history]")
        .forEach(button => {
            button.onclick = () => openPlayerHistoryModal(
                button.dataset.playerHistory
            );
        });
    /* =========================
       SALVA IMPOSTAZIONI
       ========================= */

    document
        .getElementById(
            "saveSettings"
        )
        ?.addEventListener(
            "click",
            () => {

                if (!requireOnlineAdmin()) return;

                const team =
                    document
                        .getElementById(
                            "teamName"
                        )
                        .value
                        .trim();


                const season =
                    document
                        .getElementById(
                            "season"
                        )
                        .value
                        .trim();


                state.team =
                    team ||
                    "Multe FC";


                state.season =
                    season ||
                    "2026/27";


                saveState();

                render();

                showToast(
                    "Impostazioni salvate"
                );

            }
        );


    /* =========================
       BACKUP
       ========================= */

    document
        .getElementById(
            "exportData"
        )
        ?.addEventListener(
            "click",
            exportBackup
        );

    document
        .getElementById("exportAutoBackup")
        ?.addEventListener("click", exportAutomaticBackup);


    /* =========================
       IMPORT
       ========================= */

    document
        .getElementById(
            "importData"
        )
        ?.addEventListener(
            "click",
            () => {

                document
                    .getElementById(
                        "importFile"
                    )
                    .click();

            }
        );


    /* =========================
       RESET
       ========================= */

    document
        .getElementById(
            "resetData"
        )
        ?.addEventListener(
            "click",
            resetData
        );

    document
        .getElementById("resetSeason")
        ?.addEventListener("click", resetSeason);

    document
        .getElementById("editSeasonConfig")
        ?.addEventListener("click", () => openSeasonSetupModal(true));
    document
        .getElementById("openTeamCodeSetup")
        ?.addEventListener("click", openTeamCodeSetupModal);
    document
        .getElementById("refreshAllTeamInfo")
        ?.addEventListener("click", openGeneralTeamRefreshModal);

    document
        .getElementById("changeAdminPassword")
        ?.addEventListener("click", openChangeAdminPasswordModal);

    document
        .getElementById("resetTotal")
        ?.addEventListener("click", resetTotal);
/* =========================
   PAGAMENTI
   ========================= */

document
    .querySelectorAll(
        "[data-payment-player]"
    )
    .forEach(input => {

        input.addEventListener(
            "change",
            event => {

                if (!requireOnlineAdmin()) {
                    render();
                    return;
                }

                const previousState = structuredClone(state);

                const player =
                    event.target.dataset
                        .paymentPlayer;

                const month = getDisplayedPaymentMonth();

                const amount =
                    Math.max(
                        0,
                        Number(
                            event.target.value
                        ) || 0
                    );

                if (
                    !state.payments
                ) {
                    state.payments = {};
                }

                if (
                    !state.payments[month]
                ) {
                    state.payments[month] = {};
                }

                state.payments[month][player] =
                    amount;

                saveState();

                render();

                offerUndo("Pagamento aggiornato", previousState);

            }
        );

    });

document
    .querySelectorAll("[data-fill-payment]")
    .forEach(button => {
        button.addEventListener("click", () => {
            if (!requireOnlineAdmin()) return;
            const player = button.dataset.fillPayment;
            const input = [...document.querySelectorAll("[data-payment-player]")]
                .find(candidate => candidate.dataset.paymentPlayer === player);
            if (!input) return;
            input.value = button.dataset.fillPaymentValue || "0";
            input.focus();
            input.select();
        });
    });
}


/* =========================================================
   BACKUP EXPORT
   ========================================================= */

function exportBackup() {

    downloadBackup("multefc-backup");
    showToast("Backup esportato");

}

function exportAutomaticBackup() {
    try {
        const storedBackup = JSON.parse(
            localStorage.getItem(AUTO_BACKUP_STORAGE_KEY) || "null"
        );
        downloadBackup("multefc-backup-automatico", storedBackup?.data || state);
        showToast("Copia automatica esportata");
    } catch (error) {
        console.error("Errore backup automatico:", error);
        showToast("Backup automatico non disponibile");
    }
}

function downloadBackup(prefix, backupState = state) {

    const data =
        JSON.stringify(
            {
                ...structuredClone(backupState),
                _backupMetadata: {
                    app: "Multe Squadra",
                    format: 2,
                    exportedAt: new Date().toISOString()
                }
            },
            null,
            2
        );


    const blob =
        new Blob(
            [data],
            {
                type:
                    "application/json"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );


    link.href = url;


    link.download =
        `${prefix}-${new Date()
            .toISOString()
            .slice(0, 10)}.json`;


    document.body.appendChild(
        link
    );


    link.click();


    link.remove();


    URL.revokeObjectURL(
        url
    );

}


/* =========================================================
   BACKUP IMPORT
   ========================================================= */

function validateBackupState(imported) {
    if (!imported || typeof imported !== "object" || Array.isArray(imported)) throw new Error("Il file non contiene un backup valido.");
    if (!Array.isArray(imported.players) || !Array.isArray(imported.fines) || !Array.isArray(imported.rules)) throw new Error("Nel backup mancano giocatori, multe o regole.");
    if (imported.players.length > 1000 || imported.fines.length > 200000 || imported.rules.length > 5000) throw new Error("Il backup supera i limiti di sicurezza.");
    if (imported.players.some(player => typeof player !== "string" || !player.trim())) throw new Error("Il backup contiene un giocatore non valido.");
    if (imported.fines.some(fine => !fine || typeof fine !== "object" || Array.isArray(fine))) throw new Error("Il backup contiene una multa non valida.");
    if (imported.rules.some(rule => !rule || typeof rule !== "object" || Array.isArray(rule))) throw new Error("Il backup contiene una regola non valida.");
    if (imported.payments !== undefined && (!imported.payments || typeof imported.payments !== "object" || Array.isArray(imported.payments))) throw new Error("La sezione pagamenti non è valida.");
    if (imported.teamLogo !== undefined && !(imported.teamLogo === "assets/icon.svg" || /^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/i.test(imported.teamLogo) || /^https:\/\/b2-content\.tuttocampo\.it\/Teams\/Original\//i.test(imported.teamLogo))) throw new Error("Lo stemma nel backup non è valido.");
    return true;
}

function commitImportedBackup(imported) {
    validateBackupState(imported);
    const previousSerialized = localStorage.getItem(STORAGE_KEY);
    const previousState = structuredClone(state);
    try {
        const normalized = normalizeIncomingState(imported);
        validateBackupState(normalized);
        const normalizedSerialized = JSON.stringify(normalized);
        localStorage.setItem(AUTO_BACKUP_STORAGE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), reason: "before_import", data: previousState }));
        localStorage.setItem(STORAGE_KEY, normalizedSerialized);
        state = normalized;
        queueCloudSave();
        applyImportedCalendar();
        deviceTheme = getDeviceTheme(state.theme);
        selectedPaymentMonth = getPaymentMonths()[0];
        render();
        return true;
    } catch (error) {
        state = previousState;
        if (previousSerialized === null) localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, previousSerialized);
        throw error;
    }
}

document
    .getElementById(
        "importFile"
    )
    .addEventListener(
    "change",
    event => {

        if (!requireOnlineAdmin()) {
            event.target.value = "";
            return;
        }

            const file = event.target.files[0];


            if (!file) {

                return;

            }


            if (file.size > 25 * 1024 * 1024) {
                showToast("Il backup supera 25 MB.");
                event.target.value = "";
                return;
            }

            const reader = new FileReader();


            reader.onload = () => {

                try {

                    const imported =
                        JSON.parse(
                            reader.result
                        );


                    commitImportedBackup(imported);

                    showToast(
                        "Backup importato"
                    );

                } catch (error) {

                    console.error(
                        error
                    );

                    showToast(error.message || "Backup non valido");

                }

            };


            reader.onerror = () => showToast("Impossibile leggere il backup.");
            reader.readAsText(file);


            event.target.value = "";

        }
    );


/* =========================================================
   RESET
   ========================================================= */

function getSuggestedNextSeason() {
    const nextStart = getSeasonStartYear() + 1;
    return `${nextStart}/${String(nextStart + 1).slice(-2)}`;
}

async function resolveTuttocampoTeamCode(teamId) {
    const normalized = String(teamId || "").trim();
    if (!/^\d{3,10}$/.test(normalized)) throw new Error("Inserisci un codice Tuttocampo valido.");
    if (LOCAL_CUSTOMIZATION_PREVIEW) {
        const response = await fetch(`/__team-profile?teamId=${encodeURIComponent(normalized)}`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Squadra non trovata su Tuttocampo.");
        return payload.profile;
    }
    if (!supabaseClient) throw new Error("Servizio di configurazione non disponibile.");
    const { data, error } = await supabaseClient.functions.invoke("import-tuttocampo-calendar", {
        body: { mode: "profile", teamId: Number(normalized), appTeamId:activeCloudTeamId }
    });
    if (error) throw new Error(error.message || "Squadra non trovata su Tuttocampo.");
    return data?.profile;
}

function applyVerifiedTeamProfile(profile) {
    if (!profile || !Number(profile.teamId) || !/^https:\/\/www\.tuttocampo\.it\//i.test(profile.teamUrl || "") || !/^https:\/\/www\.tuttocampo\.it\//i.test(profile.calendarUrl || "")) {
        throw new Error("Il profilo squadra non contiene collegamenti verificati.");
    }
    const currentConfig = state.seasonConfig || {};
    const currentSources = Array.isArray(currentConfig.calendarSources) ? currentConfig.calendarSources : [];
    const currentLeague = currentSources.find(source => source?.type === "league") || {};
    const preservedSources = currentSources.filter(source => source?.type !== "league");
    state.seasonConfig = {
        ...currentConfig,
        tuttocampoTeamId: Number(profile.teamId),
        teamProfile: structuredClone(profile),
        calendarSources: [
            { ...currentLeague, type:"league", name:currentLeague.name || "Campionato", enabled:currentLeague.enabled !== false, url:profile.calendarUrl },
            ...preservedSources
        ]
    };
    state.teamCustomization = { ...(state.teamCustomization || {}), teamLink:profile.teamUrl };
}

function normalizeRosterPersonName(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, " ").trim().toLocaleLowerCase("it");
}

function mergeSelectedRosterMembers(members, startMonth) {
    const existingByName = new Map(state.players.map(name => [normalizeRosterPersonName(name), name]));
    for (const member of members) {
        const name = String(member?.name || "").trim();
        const key = normalizeRosterPersonName(name);
        if (!name || !key || existingByName.has(key)) continue;
        state.players.push(name);
        existingByName.set(key, name);
        state.playerStartMonths = { ...(state.playerStartMonths || {}), [name]:startMonth };
        if (/^\d{4}-\d{2}-\d{2}$/.test(member.birthDate || "")) state.playerBirthDates = { ...(state.playerBirthDates || {}), [name]:member.birthDate };
        if (/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(member.photoData || "")) state.playerPhotos = { ...(state.playerPhotos || {}), [name]:member.photoData };
    }
    state.players = getSortedPlayers(state.players);
}

async function resolveTuttocampoRoster(teamId) {
    if (LOCAL_CUSTOMIZATION_PREVIEW) {
        const response = await fetch(`/__team-roster?teamId=${encodeURIComponent(teamId)}`, { cache:"no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Rosa non disponibile.");
        return payload;
    }
    const { data, error } = await supabaseClient.functions.invoke("import-tuttocampo-calendar", { body:{ mode:"roster", teamId:Number(teamId), appTeamId:activeCloudTeamId, teamUrl:state.seasonConfig?.teamProfile?.teamUrl || "" } });
    if (error) throw new Error(error.message || "Rosa non disponibile.");
    return data;
}

async function fetchRosterPhotoData(photoUrl) {
    if (!LOCAL_CUSTOMIZATION_PREVIEW || !photoUrl) return "";
    const response = await fetch(`/__team-photo?url=${encodeURIComponent(photoUrl)}`, { cache:"no-store" });
    if (!response.ok) return "";
    const blob = await response.blob();
    const image = await createImageBitmap(blob);
    const size = 480;
    const canvas = document.createElement("canvas"); canvas.width = size; canvas.height = size;
    const context = canvas.getContext("2d");
    const scale = Math.max(size / image.width, size / image.height);
    const width = image.width * scale, height = image.height * scale;
    context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
    image.close?.();
    return canvas.toDataURL("image/jpeg", .86);
}

function openTeamCodeSetupModal() {
    if (!LOCAL_CUSTOMIZATION_PREVIEW) return;
    const currentCode = state.seasonConfig?.tuttocampoTeamId || "";
    openModal("Configura da Tuttocampo", `
        <div class="team-code-setup">
            <section class="team-code-hero"><span>PROVA LOCALE</span><h3>Un solo codice per tutta la squadra</h3><p>La ricerca prepara nome, stemma, pagina ufficiale e campionato. Le coppe già configurate restano al sicuro finché non vengono riconosciute con certezza. Nessun dato viene salvato online.</p></section>
            <label class="team-code-input"><span>CODICE SQUADRA TUTTOCAMPO</span><div><input id="tuttocampoTeamCode" inputmode="numeric" autocomplete="off" value="${escapeHtml(String(currentCode))}" placeholder="es. 1199590"><button class="btn" id="resolveTeamCode" type="button">Rileva squadra</button></div><small>È il numero presente nell’indirizzo della pagina della squadra.</small></label>
            <div id="teamCodeResult" class="team-code-result"><p>Inserisci il codice e controlla l’anteprima prima di applicare la configurazione.</p></div>
            <div class="modal-actions"><button class="btn secondary" id="cancelTeamCodeSetup" type="button">Chiudi</button><button class="btn" id="stageTeamCodeSetup" type="button" disabled>Usa nella prova locale</button></div>
        </div>
    `);
    document.querySelector("#modalRoot .modal")?.classList.add("team-code-setup-modal");
    const input = document.getElementById("tuttocampoTeamCode");
    const resolveButton = document.getElementById("resolveTeamCode");
    const applyButton = document.getElementById("stageTeamCodeSetup");
    const result = document.getElementById("teamCodeResult");
    let resolvedProfile = null;
    const resolve = async () => {
        resolveButton.disabled = true;
        applyButton.disabled = true;
        resolvedProfile = null;
        result.className = "team-code-result is-loading";
        result.innerHTML = "<p>Ricerca della squadra e delle competizioni…</p>";
        try {
            resolvedProfile = await resolveTuttocampoTeamCode(input.value);
            const sources = Array.isArray(resolvedProfile.competitions) ? resolvedProfile.competitions : [];
            result.className = "team-code-result is-ready";
            result.innerHTML = `<div class="team-code-identity"><img src="${escapeHtml(resolvedProfile.logo)}" alt=""><div><small>SQUADRA TROVATA</small><strong>${escapeHtml(resolvedProfile.name)}</strong><span>Codice ${escapeHtml(String(resolvedProfile.teamId))}</span></div></div><div class="team-code-detected"><div><span>Pagina squadra</span><strong>Collegata</strong></div><div><span>Campionato</span><strong>${escapeHtml(resolvedProfile.league || "Rilevato")}</strong></div><div><span>Calendario</span><strong>Pronto</strong></div><div><span>Coppe rilevate</span><strong>${sources.filter(source => source.type === "cup").length}</strong></div></div><details><summary>Collegamenti rilevati</summary>${sources.map(source => `<p><b>${escapeHtml(source.name)}</b><small>${escapeHtml(source.url)}</small></p>`).join("") || "<p>Nessuna competizione aggiuntiva rilevata.</p>"}</details><p class="team-code-safe-note">Questa anteprima non modifica rosa, multe, pagamenti, Multario o password.</p>`;
            applyButton.disabled = false;
        } catch (error) {
            result.className = "team-code-result is-error";
            result.innerHTML = `<strong>Configurazione non trovata</strong><p>${escapeHtml(error.message || "Controllo non riuscito.")}</p>`;
        } finally {
            resolveButton.disabled = false;
        }
    };
    resolveButton.onclick = resolve;
    input.addEventListener("keydown", event => { if (event.key === "Enter") resolve(); });
    input.addEventListener("input", () => { applyButton.disabled = true; resolvedProfile = null; });
    document.getElementById("cancelTeamCodeSetup").onclick = closeModal;
    applyButton.onclick = () => {
        if (!resolvedProfile) return;
        sessionStorage.setItem("multesquadra_team_profile_preview_v1", JSON.stringify(resolvedProfile));
        applyVerifiedTeamProfile(resolvedProfile);
        saveLocalState();
        result.insertAdjacentHTML("beforeend", `<p class="team-code-staged">✓ Configurazione preparata soltanto per questa prova locale.</p>`);
        applyButton.disabled = true;
        applyButton.textContent = "Preparata";
    };
}

async function openGeneralTeamRefreshModal() {
    if (!LOCAL_CUSTOMIZATION_PREVIEW) {
        if(!requireOnlineAdmin())return;
        openModal("Aggiorna tutte le info",`<div class="team-refresh-panel"><div class="team-refresh-heading"><span class="team-refresh-spinner">↻</span><div><strong>Controllo completo in corso</strong><small>Calendario, risultati, classifica e coppe</small></div></div><div id="teamRefreshChecks" class="team-refresh-checks"><p>Collegamento a Tuttocampo…</p></div><div class="modal-actions"><button class="btn secondary" id="closeTeamRefresh" type="button">Chiudi</button></div></div>`);
        document.getElementById("closeTeamRefresh").onclick=closeModal;
        const checks=document.getElementById("teamRefreshChecks");
        const result=await refreshSportsSources({force:true});
        checks.innerHTML=result.updated?`<div class="team-refresh-check is-ok"><i>✓</i><span><strong>${result.updated} competizioni aggiornate</strong><small>Partite, risultati e classifica salvati.</small></span></div>`:"";
        if(result.errors.length)checks.insertAdjacentHTML("beforeend",result.errors.map(error=>`<div class="team-refresh-check is-warning"><i>!</i><span><strong>Aggiornamento parziale</strong><small>${escapeHtml(error)}</small></span></div>`).join(""));
        if(!result.updated&&!result.errors.length)checks.innerHTML=`<div class="team-refresh-check is-ok"><i>✓</i><span><strong>Informazioni già aggiornate</strong><small>Nessuna modifica necessaria.</small></span></div>`;
        return;
    }
    const staged = JSON.parse(sessionStorage.getItem("multesquadra_team_profile_preview_v1") || "null");
    const teamId = staged?.teamId || state.seasonConfig?.tuttocampoTeamId || DEFAULT_TEAM_ID;
    openModal("Aggiorna tutte le info", `
        <div class="team-refresh-panel">
            <div class="team-refresh-heading"><span class="team-refresh-spinner">↻</span><div><strong>Controllo completo in corso</strong><small>Codice Tuttocampo ${escapeHtml(String(teamId))}</small></div></div>
            <div id="teamRefreshChecks" class="team-refresh-checks"><p>Collegamento a Tuttocampo…</p></div>
            <p class="team-code-safe-note">Il controllo prepara una nuova versione delle informazioni. Non modifica rosa, multe, quote o pagamenti.</p>
            <div class="modal-actions"><button class="btn secondary" id="closeTeamRefresh" type="button">Chiudi</button><button class="btn" id="stageTeamRefresh" type="button" disabled>Applica aggiornamento locale</button></div>
        </div>
    `);
    const checks = document.getElementById("teamRefreshChecks");
    const apply = document.getElementById("stageTeamRefresh");
    document.getElementById("closeTeamRefresh").onclick = closeModal;
    try {
        const response = await fetch(`/__team-profile?teamId=${encodeURIComponent(teamId)}&refresh=1`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Controllo non riuscito.");
        const report = payload.report || {};
        const rows = [
            ["Profilo squadra", report.profile], ["Stemma", report.logo], ["Calendario campionato", report.calendar],
            ["Prossima partita", report.nextMatch], ["Risultati", report.results], ["Classifica", report.standings], ["Coppe", report.cups]
        ];
        checks.innerHTML = rows.map(([label,item]) => `<div class="team-refresh-check ${item?.ok ? "is-ok" : "is-warning"}"><i>${item?.ok ? "✓" : "!"}</i><span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(item?.detail || "Da verificare")}</small></span></div>`).join("");
        document.querySelector(".team-refresh-heading strong").textContent = "Controllo completato";
        document.querySelector(".team-refresh-spinner").textContent = "✓";
        apply.disabled = false;
        apply.onclick = () => {
            sessionStorage.setItem("multesquadra_team_refresh_preview_v1", JSON.stringify(payload));
            apply.disabled = true; apply.textContent = "Aggiornato nella prova";
            showToast("Informazioni aggiornate soltanto nella versione locale.");
        };
    } catch (error) {
        checks.innerHTML = `<div class="team-refresh-check is-warning"><i>!</i><span><strong>Controllo interrotto</strong><small>${escapeHtml(error.message || "Riprova più tardi.")}</small></span></div>`;
        document.querySelector(".team-refresh-heading strong").textContent = "Aggiornamento non completato";
        document.querySelector(".team-refresh-spinner").textContent = "!";
    }
}

function openSeasonSetupModal(editCurrent = false) {
    if (!requireOnlineAdmin()) return;

    const nextSeason = editCurrent ? state.season : getSuggestedNextSeason();
    const monthLabels = [
        ["08", "Agosto"], ["09", "Settembre"], ["10", "Ottobre"],
        ["11", "Novembre"], ["12", "Dicembre"], ["01", "Gennaio"],
        ["02", "Febbraio"], ["03", "Marzo"], ["04", "Aprile"], ["05", "Maggio"],
        ["06", "Giugno"], ["07", "Luglio"]
    ];
    const base = Math.max(0, Number(state.seasonConfig?.monthlyBase ?? 5) || 0);
    const paymentStartMonth = Number(state.seasonConfig?.paymentStartMonth ?? 8);
    const paymentEndMonth = Number(state.seasonConfig?.paymentEndMonth ?? 5);
    const paymentMode = state.seasonConfig?.paymentMode === "rolling" ? "rolling" : "due_day";
    const paymentDueDay = Math.min(28, Math.max(1, Number(state.seasonConfig?.paymentDueDay ?? 15) || 15));
    const feeMode = state.teamCustomization?.feeMode || "monthly";
    const entryFee = Math.max(0, Number(state.teamCustomization?.entryFee) || 0);
    let pendingRosterCandidates = [];
    const calendarMonthOptions = Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        return `<option value="${month}">${getMonthName(month)}</option>`;
    }).join("");

    openModal(editCurrent ? "Modifica stagione" : "Prepara nuova stagione", `
        <div class="season-setup">
            <section class="season-setup-hero">
                <span>${editCurrent ? "CONFIGURAZIONE ATTUALE" : "PASSAGGIO GUIDATO"}</span>
                <h3>${editCurrent ? `<strong id="seasonPreviewLabel">${escapeHtml(state.season)}</strong>` : `${escapeHtml(state.season)} <b aria-hidden="true">→</b> <strong id="seasonPreviewLabel">${escapeHtml(nextSeason)}</strong>`}</h3>
                <p>${editCurrent ? "Quote e calendari possono essere aggiornati senza modificare multe o pagamenti." : "La stagione attuale verrà archiviata. Giocatori e Multario resteranno disponibili."}</p>
            </section>

            <section class="season-setup-section">
                <div class="season-setup-title"><span>01</span><div><h3>Nuova annata</h3><p>Imposta stagione e collegamento al calendario.</p></div></div>
                <div class="season-setup-grid">
                    <div class="field"><label for="newSeasonName">STAGIONE</label><input id="newSeasonName" type="text" value="${escapeHtml(nextSeason)}" placeholder="2027/28" inputmode="numeric" ${editCurrent ? "readonly" : ""}></div>
                    <div class="field"><label for="newSeasonFeeMode">TIPO DI QUOTA</label><select id="newSeasonFeeMode"><option value="none" ${feeMode === "none" ? "selected" : ""}>Nessuna quota</option><option value="monthly" ${feeMode === "monthly" ? "selected" : ""}>Solo quota mensile</option><option value="entry" ${feeMode === "entry" ? "selected" : ""}>Solo quota d’ingresso</option><option value="monthly_entry" ${feeMode === "monthly_entry" ? "selected" : ""}>Quota d’ingresso, poi mensile</option></select></div>
                    <div class="field"><label for="newSeasonBase">QUOTA MENSILE ORDINARIA (€)</label><input id="newSeasonBase" type="number" min="0" step="0.5" value="${base}"></div>
                    <div class="field"><label for="newSeasonEntryFee">QUOTA DEL PRIMO MESE / INGRESSO (€)</label><input id="newSeasonEntryFee" type="number" min="0" step="0.5" value="${entryFee}"><small>È l’unica quota del primo mese assegnato: non si somma alla quota mensile.</small></div>
                    <div class="field"><label for="newSeasonStartMonth">PRIMO MESE DI PAGAMENTO</label><select id="newSeasonStartMonth">${calendarMonthOptions}</select></div>
                    <div class="field"><label for="newSeasonEndMonth">ULTIMO MESE DI PAGAMENTO</label><select id="newSeasonEndMonth">${calendarMonthOptions}</select></div>
                    <div class="field"><label for="newSeasonPaymentMode">GESTIONE PAGAMENTO MULTE</label><select id="newSeasonPaymentMode"><option value="due_day" ${paymentMode === "due_day" ? "selected" : ""}>Scadenza mensile</option><option value="rolling" ${paymentMode === "rolling" ? "selected" : ""}>Mese corrente automatico</option></select><small>Con Mese corrente si passa al successivo solo quando tutti hanno saldato.</small></div>
                    <div class="field" id="newSeasonPaymentDueDayField"><label for="newSeasonPaymentDueDay">DAL GIORNO DEL MESE SUCCESSIVO</label><input id="newSeasonPaymentDueDay" type="number" min="1" max="28" step="1" value="${paymentDueDay}" inputmode="numeric"><small>Usato soltanto con Scadenza mensile.</small></div>
                </div>
                <div class="season-logo-editor">
                    <img id="seasonTeamLogoPreview" src="${escapeHtml(getTeamLogo())}" alt="Anteprima stemma squadra">
                    <div><strong>Stemma della squadra</strong><small>Viene adattato senza deformazioni e usato automaticamente in tutta l’app.</small><div class="season-logo-actions"><label class="btn secondary" for="newSeasonTeamLogo">Carica nuovo stemma</label><button class="btn secondary" id="restoreDefaultTeamLogo" type="button">Ripristina originale</button></div><input id="newSeasonTeamLogo" type="file" accept="image/png,image/jpeg,image/webp" hidden></div>
                </div>
                <div class="season-calendar-sources">
                    <div class="field season-calendar-field"><label for="newSeasonLeagueCalendar">CALENDARIO CAMPIONATO</label><div class="season-calendar-input"><input id="newSeasonLeagueCalendar" type="url" value="${escapeHtml(state.seasonConfig?.calendarSources?.find(source => source.type === "league")?.url || "")}" placeholder="https://www.tuttocampo.it/.../Calendario"><button class="btn secondary calendar-import-button" data-import-calendar="league" type="button">Verifica link</button></div><div class="calendar-import-result" data-import-result="league"></div></div>
                    <label class="season-source-toggle"><input id="newSeasonCupEnabled" type="checkbox" ${state.seasonConfig?.calendarSources?.find(source => source.type === "cup")?.enabled ? "checked" : ""}><span><strong>Aggiungi Coppa</strong><small>Competizione dinamica: dopo ogni gara verrà cercato automaticamente il turno successivo.</small></span></label>
                    <div class="field season-calendar-field" id="newSeasonCupField"><label for="newSeasonCupCalendar">CALENDARIO COPPA</label><div class="season-calendar-input"><input id="newSeasonCupCalendar" type="url" value="${escapeHtml(state.seasonConfig?.calendarSources?.find(source => source.type === "cup")?.url || "")}" placeholder="https://www.tuttocampo.it/.../Risultati"><button class="btn secondary calendar-import-button" data-import-calendar="cup" type="button">Verifica link</button></div><div class="calendar-import-result" data-import-result="cup"></div></div>
                </div>
            </section>

            ${editCurrent ? "" : `<section class="season-setup-section season-roster-import">
                <div class="season-setup-title"><span>02</span><div><h3>Rosa della nuova stagione</h3><p>Importazione facoltativa da Tuttocampo, con scelta persona per persona.</p></div></div>
                <div class="season-roster-toolbar"><div><strong>Giocatori e staff</strong><small>Le persone già presenti mantengono nome personalizzato, foto, compleanno e storico.</small></div><button class="btn secondary" id="loadSeasonRoster" type="button">Importa da Tuttocampo</button></div>
                <div id="seasonRosterResult" class="season-roster-result"><p>Nessuna modifica alla rosa finché non selezioni e avvii la nuova stagione.</p></div>
            </section>`}

            <section class="season-setup-section">
                <div class="season-setup-title"><span>${editCurrent ? "02" : "03"}</span><div><h3>Quote mensili mese per mese</h3><p>Valgono dal mese successivo all’ingresso. Nel primo mese si applica soltanto la quota indicata sopra.</p></div></div>
                <div class="season-month-rates">
                    ${monthLabels.map(([number, label]) => {
                        const configured = state.seasonConfig?.monthOverrides?.[number];
                        const value = configured !== undefined ? configured : base;
                        return `<label><span>${label}</span><span class="season-rate-input"><input data-season-rate="${number}" type="number" min="0" step="0.5" value="${value}"><b>€</b></span></label>`;
                    }).join("")}
                </div>
            </section>

            <section class="season-setup-section season-change-summary">
                <div class="season-setup-title"><span>${editCurrent ? "03" : "04"}</span><div><h3>Cosa succede</h3><p>Controlla l’operazione prima di confermare.</p></div></div>
                <div class="season-change-list">
                    <div><i>✓</i><span><strong>${state.players.length} giocatori mantenuti</strong><small>Date e foto saranno conservate; nella nuova stagione il mese di partenza sarà quello scelto sopra.</small></span></div>
                    <div><i>✓</i><span><strong>${state.rules.length} regole mantenute</strong><small>Il Multario non verrà modificato.</small></span></div>
                    ${editCurrent
                        ? `<div><i>✓</i><span><strong>Dati stagionali invariati</strong><small>${state.fines.length} multe e tutti i pagamenti attuali rimarranno intatti.</small></span></div>`
                        : `<div><i>↥</i><span><strong>Backup e archivio automatici</strong><small>${state.fines.length} multe e tutti i pagamenti della stagione ${escapeHtml(state.season)} resteranno recuperabili.</small></span></div><div class="is-reset"><i>0</i><span><strong>Nuovi dati stagionali vuoti</strong><small>La nuova stagione partirà senza multe e pagamenti.</small></span></div>`}
                </div>
            </section>

            <label class="season-confirm"><input id="confirmSeasonSetup" type="checkbox"><span>Ho controllato stagione, quote e calendari.</span></label>
            <div class="modal-actions"><button class="btn secondary" id="cancelSeasonSetup" type="button">Annulla</button><button class="btn" id="applySeasonSetup" type="button" disabled>${editCurrent ? "Salva configurazione" : "Avvia nuova stagione"}</button></div>
        </div>
    `);

    document.querySelector("#modalRoot .modal")?.classList.add("season-setup-modal");
    const seasonInput = document.getElementById("newSeasonName");
    const baseInput = document.getElementById("newSeasonBase");
    const confirmInput = document.getElementById("confirmSeasonSetup");
    const applyButton = document.getElementById("applySeasonSetup");
    const cupEnabledInput = document.getElementById("newSeasonCupEnabled");
    const cupField = document.getElementById("newSeasonCupField");
    const startMonthInput = document.getElementById("newSeasonStartMonth");
    const endMonthInput = document.getElementById("newSeasonEndMonth");
    const paymentModeInput = document.getElementById("newSeasonPaymentMode");
    const paymentDueDayInput = document.getElementById("newSeasonPaymentDueDay");
    const paymentDueDayField = document.getElementById("newSeasonPaymentDueDayField");
    pendingCalendarImports = { league: null, cup: null };
    pendingTeamLogo = getTeamLogo();
    startMonthInput.value = String(paymentStartMonth);
    endMonthInput.value = String(paymentEndMonth);
    const updatePaymentMode = () => { paymentDueDayField.hidden = paymentModeInput.value === "rolling"; };
    paymentModeInput.addEventListener("change", updatePaymentMode);
    updatePaymentMode();
    const updatePreview = () => {
        document.getElementById("seasonPreviewLabel").textContent = seasonInput.value.trim() || "—";
    };
    seasonInput.addEventListener("input", updatePreview);
    const updateCupVisibility = () => { cupField.hidden = !cupEnabledInput.checked; };
    cupEnabledInput.addEventListener("change", updateCupVisibility);
    updateCupVisibility();
    baseInput.addEventListener("change", () => {
        const previousBase = base;
        const nextBase = Math.max(0, Number(baseInput.value) || 0);
        document.querySelectorAll("[data-season-rate]").forEach(input => {
            if (Number(input.value) === previousBase) input.value = nextBase;
        });
    });
    confirmInput.addEventListener("change", () => { applyButton.disabled = !confirmInput.checked; });
    document.getElementById("newSeasonTeamLogo").addEventListener("change", async event => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            pendingTeamLogo = await prepareTeamLogo(file);
            document.getElementById("seasonTeamLogoPreview").src = pendingTeamLogo;
            showToast("Nuovo stemma pronto. Salva per applicarlo.");
        } catch (error) {
            event.target.value = "";
            showToast(error.message || "Immagine non valida.");
        }
    });
    document.getElementById("restoreDefaultTeamLogo").onclick = () => {
        pendingTeamLogo = "assets/icon.svg";
        document.getElementById("seasonTeamLogoPreview").src = pendingTeamLogo;
        document.getElementById("newSeasonTeamLogo").value = "";
        showToast("Stemma originale pronto. Salva per applicarlo.");
    };
    const rosterButton = document.getElementById("loadSeasonRoster");
    if (rosterButton) rosterButton.onclick = async () => {
        const result = document.getElementById("seasonRosterResult");
        const teamId = Number(state.seasonConfig?.tuttocampoTeamId) || DEFAULT_TEAM_ID;
        rosterButton.disabled = true; rosterButton.textContent = "Lettura…";
        result.className = "season-roster-result is-loading"; result.innerHTML = "<p>Controllo della rosa e dello staff in corso…</p>";
        try {
            const roster = await resolveTuttocampoRoster(teamId);
            pendingRosterCandidates = Array.isArray(roster.members) ? roster.members : [];
            const existing = new Set(state.players.map(normalizeRosterPersonName));
            if (!pendingRosterCandidates.length) {
                const warning = (roster.warnings || []).join(" ") || "Nessuna persona pubblicata nella rosa Tuttocampo.";
                result.className = "season-roster-result is-warning";
                result.innerHTML = `<strong>Rosa non importata</strong><p>${escapeHtml(warning)}</p><small>I giocatori attuali e tutte le loro personalizzazioni restano invariati.</small>`;
                return;
            }
            result.className = "season-roster-result is-ready";
            result.innerHTML = `<div class="season-roster-summary"><strong>${pendingRosterCandidates.length} persone trovate</strong><button class="btn secondary" id="selectNewRosterMembers" type="button">Seleziona nuovi</button></div><div class="season-roster-list">${pendingRosterCandidates.map((member,index) => {
                const alreadyPresent = existing.has(normalizeRosterPersonName(member.name));
                return `<label class="season-roster-person ${alreadyPresent ? "is-existing" : ""}"><input type="checkbox" data-roster-index="${index}" ${alreadyPresent ? "checked disabled" : ""}><span class="season-roster-photo">${member.photoUrl ? `<img src="${escapeHtml(member.photoUrl)}" alt="">` : escapeHtml(initials(member.name))}</span><span><strong>${escapeHtml(member.name)}</strong><small>${alreadyPresent ? "Già presente · dati conservati" : [member.kind === "staff" ? "Staff" : "Giocatore", member.birthDate ? member.birthDate.split("-").reverse().join("/") : ""].filter(Boolean).join(" · ")}</small></span></label>`;
            }).join("")}</div>${(roster.warnings || []).length ? `<p class="season-roster-warning">${escapeHtml(roster.warnings.join(" "))}</p>` : ""}`;
            document.getElementById("selectNewRosterMembers").onclick = () => result.querySelectorAll("[data-roster-index]:not(:disabled)").forEach(input => { input.checked = true; });
        } catch (error) {
            pendingRosterCandidates = [];
            result.className = "season-roster-result is-warning"; result.innerHTML = `<strong>Controllo non riuscito</strong><p>${escapeHtml(error.message || "Riprova più tardi.")}</p>`;
        } finally { rosterButton.disabled = false; rosterButton.textContent = "Importa da Tuttocampo"; }
    };
    document.querySelectorAll("[data-import-calendar]").forEach(button => {
        button.onclick = async () => {
            const type = button.dataset.importCalendar;
            const input = document.getElementById(type === "cup" ? "newSeasonCupCalendar" : "newSeasonLeagueCalendar");
            const result = document.querySelector(`[data-import-result="${type}"]`);
            button.disabled = true;
            button.textContent = "Controllo…";
            result.className = "calendar-import-result is-loading";
            result.textContent = "Lettura del calendario in corso…";
            try {
                const calendar = await importCalendarFromLink(type, input.value.trim());
                pendingCalendarImports[type] = { url: input.value.trim(), snapshot: calendar };
                const future = calendar.matches.filter(match => new Date(`${match.date}T${match.time}:00`).getTime() > Date.now()).length;
                result.className = "calendar-import-result is-valid";
                result.innerHTML = `<strong>✓ ${calendar.competition ? escapeHtml(calendar.competition) : (type === "cup" ? "Coppa" : "Campionato")}</strong><span>${calendar.matches.length} partite trovate · ${future} ancora da giocare</span><small>Anteprima verificata. Verrà salvata solo confermando la stagione.</small>`;
            } catch (error) {
                pendingCalendarImports[type] = null;
                result.className = "calendar-import-result is-error";
                result.innerHTML = `<strong>Link non importato</strong><span>${escapeHtml(error.message || "Controllo non riuscito.")}</span><small>Il calendario già salvato non è stato modificato.</small>`;
            } finally {
                button.disabled = false;
                button.textContent = "Verifica link";
            }
        };
    });
    ["league", "cup"].forEach(type => {
        const input = document.getElementById(type === "cup" ? "newSeasonCupCalendar" : "newSeasonLeagueCalendar");
        input.addEventListener("input", () => { pendingCalendarImports[type] = null; });
    });
    document.getElementById("cancelSeasonSetup").onclick = closeModal;
    applyButton.onclick = async () => {
        if (!requireOnlineAdmin()) return;
        const season = seasonInput.value.trim();
        if (!/^\d{4}\/\d{2}$/.test(season)) {
            showToast("Inserisci la stagione nel formato 2027/28.");
            return;
        }
        const leagueUrl = document.getElementById("newSeasonLeagueCalendar").value.trim();
        const cupUrl = document.getElementById("newSeasonCupCalendar").value.trim();
        if (!isValidTuttocampoCalendarUrl(leagueUrl) || (cupEnabledInput.checked && !isValidTuttocampoCalendarUrl(cupUrl))) {
            showToast("Inserisci link Calendario/Risultati validi di Tuttocampo.");
            return;
        }
        const existingLeague = state.seasonConfig?.calendarSources?.find(source => source.type === "league");
        const existingCup = state.seasonConfig?.calendarSources?.find(source => source.type === "cup");
        const leagueSnapshot = pendingCalendarImports.league?.url === leagueUrl
            ? pendingCalendarImports.league.snapshot
            : (existingLeague?.url === leagueUrl
                ? (existingLeague.snapshot || (editCurrent ? getRuntimeCalendarSnapshot("league") : null))
                : null);
        const cupSnapshot = pendingCalendarImports.cup?.url === cupUrl
            ? pendingCalendarImports.cup.snapshot
            : (existingCup?.url === cupUrl ? existingCup.snapshot : null);
        if (!leagueSnapshot || (cupEnabledInput.checked && !cupSnapshot)) {
            showToast("Verifica i link dei calendari prima di salvare.");
            return;
        }
        const selectedRosterMembers = editCurrent ? [] : [...document.querySelectorAll("[data-roster-index]:checked:not(:disabled)")].map(input => pendingRosterCandidates[Number(input.dataset.rosterIndex)]).filter(Boolean);
        if (selectedRosterMembers.length) {
            applyButton.disabled = true; applyButton.textContent = "Preparo la rosa…";
            await Promise.all(selectedRosterMembers.map(async member => { if (member.photoUrl) member.photoData = await fetchRosterPhotoData(member.photoUrl).catch(() => ""); }));
        }
        const monthlyBase = Math.max(0, Number(baseInput.value) || 0);
        state.teamCustomization = { ...(state.teamCustomization || {}), feeMode: document.getElementById("newSeasonFeeMode").value, entryFee: Math.max(0, Number(document.getElementById("newSeasonEntryFee").value) || 0), feesEnabled: document.getElementById("newSeasonFeeMode").value !== "none" };
        const paymentStartMonth = Number(startMonthInput.value);
        const paymentEndMonth = Number(endMonthInput.value);
        const paymentFrequency = "monthly";
        const paymentMode = paymentModeInput.value === "rolling" ? "rolling" : "due_day";
        const paymentDueDay = Math.min(28, Math.max(1, Number(paymentDueDayInput.value) || 15));
        const monthOverrides = {};
        document.querySelectorAll("[data-season-rate]").forEach(input => {
            const amount = Math.max(0, Number(input.value) || 0);
            if (amount !== monthlyBase) monthOverrides[input.dataset.seasonRate] = amount;
        });
        if (editCurrent) {
            state.season = season;
            state.teamLogo = pendingTeamLogo || getTeamLogo();
            state.seasonConfig = {
                tuttocampoTeamId: Number(state.seasonConfig?.tuttocampoTeamId) || DEFAULT_TEAM_ID,
                teamProfile: state.seasonConfig?.teamProfile ? structuredClone(state.seasonConfig.teamProfile) : null,
                monthlyBase,
                paymentStartMonth,
                paymentEndMonth,
                paymentFrequency,
                paymentMode,
                paymentDueDay,
                monthOverrides,
                calendarSources: [
                    { type: "league", name: "Campionato", enabled: true, url: leagueUrl, snapshot: leagueSnapshot, lastCheckedAt: new Date().toISOString() },
                    { type: "cup", name: "Coppa", enabled: cupEnabledInput.checked, dynamic: true, refreshPolicy: "after_match", url: cupEnabledInput.checked ? cupUrl : "", snapshot: cupEnabledInput.checked ? cupSnapshot : null, lastCheckedAt: cupEnabledInput.checked ? new Date().toISOString() : "" }
                ]
            };
            saveState();
            closeModal();
            applyImportedCalendar();
            render();
            showToast("Configurazione stagione aggiornata.");
            return;
        }

        downloadBackup("multefc-backup-prima-nuova-stagione");
        const archive = {
            season: state.season,
            closedAt: new Date().toISOString(),
            fines: structuredClone(state.fines),
            payments: structuredClone(state.payments),
            seasonConfig: structuredClone(state.seasonConfig || {})
        };
        const startYear = Number(season.slice(0, 4));
        state = {
            ...state,
            season,
            teamLogo: pendingTeamLogo || getTeamLogo(),
            seasonConfig: {
                tuttocampoTeamId: Number(state.seasonConfig?.tuttocampoTeamId) || DEFAULT_TEAM_ID,
                teamProfile: state.seasonConfig?.teamProfile ? structuredClone(state.seasonConfig.teamProfile) : null,
                monthlyBase,
                paymentStartMonth,
                paymentEndMonth,
                paymentFrequency,
                paymentMode,
                paymentDueDay,
                monthOverrides,
                calendarSources: [
                    { type: "league", name: "Campionato", enabled: true, url: leagueUrl, snapshot: leagueSnapshot, lastCheckedAt: new Date().toISOString() },
                    { type: "cup", name: "Coppa", enabled: cupEnabledInput.checked, dynamic: true, refreshPolicy: "after_match", url: cupEnabledInput.checked ? cupUrl : "", snapshot: cupEnabledInput.checked ? cupSnapshot : null, lastCheckedAt: cupEnabledInput.checked ? new Date().toISOString() : "" }
                ]
            },
            seasonArchives: [...(state.seasonArchives || []), archive],
            playerStartMonths: Object.fromEntries(state.players.map(player => [player, `${startYear}-${String(paymentStartMonth).padStart(2, "0")}`])),
            fines: [],
            payments: {}
        };
        mergeSelectedRosterMembers(selectedRosterMembers, `${startYear}-${String(paymentStartMonth).padStart(2, "0")}`);
        selectedPaymentMonth = `${startYear}-${String(paymentStartMonth).padStart(2, "0")}`;
        saveState();
        applyImportedCalendar();
        closeModal();
        render();
        showToast(`Stagione ${season} avviata. Backup scaricato.`);
    };
}

function resetSeason() {
    openSeasonSetupModal();
}

function resetTotal() {
    if (!requireOnlineAdmin()) return;

    const code = prompt(
        "Operazione irreversibile. Verrà scaricato un backup automatico.\n\nDigita RESET per continuare:"
    );

    if (code !== "RESET") {
        showToast("Reset totale annullato.");
        return;
    }

    downloadBackup("multefc-backup-prima-reset-totale");
    state = structuredClone(defaultState);
    saveState();
    render();
    showToast("Reset totale eseguito. Backup scaricato.");
}

function resetData() {

    if (!requireOnlineAdmin()) return;

    const confirmed =
        confirm(
            "Sei sicuro?\n\n" +
            "Tutti i dati attuali " +
            "verranno sostituiti " +
            "dai dati demo."
        );


    if (!confirmed) {

        return;

    }

    downloadBackup("multefc-backup-prima-ripristino-demo");


    state =
        structuredClone(
            defaultState
        );


    saveState();

    render();

    showToast(
        "Dati ripristinati"
    );

}


/* =========================================================
   TOAST
   ========================================================= */

function showToast(message) {

    const toast =
        document.getElementById(
            "toast"
        );

    clearTimeout(undoTimer);
    toast.classList.remove("has-action");

    toast.textContent =
        message;


    toast.classList.add(
        "show"
    );


    setTimeout(
        () => {

            toast.classList.remove(
                "show"
            );

        },
        2200
    );

}

function showAppUpdateNotice(registration) {
    if (!registration?.waiting || document.getElementById("appUpdateNotice")) return;

    const notice = document.createElement("div");
    notice.id = "appUpdateNotice";
    notice.className = "app-update-notice";
    notice.setAttribute("role", "status");
    notice.innerHTML = `
        <div><strong>Nuova versione disponibile</strong><span>Aggiorna quando sei pronto.</span></div>
        <button type="button" id="applyAppUpdate">Aggiorna</button>
    `;
    document.body.appendChild(notice);
    document.getElementById("applyAppUpdate").onclick = () => {
        notice.querySelector("button").disabled = true;
        reloadForServiceWorkerUpdate = true;
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
    };
}

function watchServiceWorkerUpdate(registration) {
    if (registration.waiting && navigator.serviceWorker.controller) {
        showAppUpdateNotice(registration);
    }

    registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
                showAppUpdateNotice(registration);
            }
        });
    });
}


/* =========================================================
   TEMA
   ========================================================= */

document
    .getElementById(
        "themeButton"
    )
    .addEventListener(
        "click",
        () => {

            deviceTheme =
                deviceTheme === "dark"
                    ? "light"
                    : "dark";

            localStorage.setItem(THEME_STORAGE_KEY, deviceTheme);

            applyTheme();

        }
    );


/* =========================================================
   AVVIO
   ========================================================= */

render();
updateAuthButton();
applyAccessMode();
window.addEventListener("online", handleConnectionRestored);
window.addEventListener("offline", handleConnectionLost);
initializeCloud();
setInterval(() => refreshMatchResults().catch(() => {}), 60 * 60 * 1000);
setInterval(() => refreshSportsSources().catch(() => {}), 60 * 60 * 1000);
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { refreshMatchResults().catch(() => {}); refreshSportsSources().catch(() => {}); }
});
if ("serviceWorker" in navigator && !LOCAL_CUSTOMIZATION_PREVIEW) {
    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("./service-worker.js")
            .then(registration => {
                console.log("MulteFC: Service Worker attivo");
                watchServiceWorkerUpdate(registration);
                registration.update().catch(() => {});
            })
            .catch(error => {
                console.error("MulteFC: errore Service Worker", error);
            });
    });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!reloadForServiceWorkerUpdate) return;
        reloadForServiceWorkerUpdate = false;
        window.location.reload();
    });
}

if ("serviceWorker" in navigator && LOCAL_CUSTOMIZATION_PREVIEW) {
    navigator.serviceWorker.getRegistrations().then(registrations => registrations.forEach(registration => registration.unregister())).catch(() => {});
}


/* Export Pagamenti coordinato con colori, stemma e foto squadra. */
const createPaymentsExportCanvasBase = createPaymentsExportCanvas;
createPaymentsExportCanvas = function(mode = "all") {
 const base=createPaymentsExportCanvasBase(mode); if(!base)return null;
 const m=getDisplayedPaymentMonth(), due=mode==="due";
 const list=getSortedPlayers().map(function(p){return {player:p,summary:getPlayerMonthSummary(p,m)}}).filter(function(e){return !due||e.summary.remaining>0});
 const scale=base.width/1133, canvas=document.createElement("canvas"); canvas.width=Math.round(698*scale); canvas.height=base.height;
 const c=canvas.getContext("2d"); c.drawImage(base,0,0,canvas.width,base.height,0,0,canvas.width,base.height); c.scale(scale,scale); c.textBaseline="middle";
 const css=getComputedStyle(document.documentElement), primary=state.teamCustomization?.primary||css.getPropertyValue("--primary").trim()||"#2563eb", accent=state.teamCustomization?.accent||css.getPropertyValue("--preview-accent").trim()||"#60a5fa";
 c.fillStyle="#f7f9fc";c.fillRect(44,82,610,24);c.fillStyle="#5b677a";c.font="500 15px system-ui,sans-serif";c.fillText(due?"Solo i giocatori con un importo ancora da versare":"Situazione dei versamenti del mese selezionato",114,74);
 c.fillStyle=primary;c.fillRect(44,108,610,46);c.fillStyle=accent;c.fillRect(44,108,7,46);c.fillStyle="#fff";c.font="700 14px system-ui,sans-serif";c.fillText("Giocatore",59,131);c.fillText("Versato",359,131);c.fillText("Rimanente",504,131);
 const photos=Array.from(document.querySelectorAll("[data-player-history] img.player-list-photo"));
 list.forEach(function(e,i){const y=154+i*52;c.fillStyle=i%2?"#eef3f9":"#fff";c.fillRect(44,y,300,52);c.strokeStyle="#d7e0ec";c.strokeRect(44,y,300,52);const img=photos.find(function(n){return n.closest("[data-player-history]")?.getAttribute("data-player-history")===e.player&&n.complete&&n.naturalWidth});const x=57,s=36,r=18;c.save();c.beginPath();c.arc(x+r,y+26,r,0,Math.PI*2);c.clip();if(img){const k=Math.max(s/img.naturalWidth,s/img.naturalHeight),w=img.naturalWidth*k,h=img.naturalHeight*k;c.drawImage(img,x+(s-w)/2,y+8+(s-h)/2,w,h)}else{c.fillStyle=accent;c.fillRect(x,y+8,s,s);c.fillStyle="#fff";c.font="800 13px system-ui,sans-serif";c.textAlign="center";c.fillText(initials(e.player),x+r,y+27)}c.restore();c.textAlign="left";c.fillStyle="#172236";c.font="650 16px system-ui,sans-serif";c.fillText(e.player,104,y+26,225);c.fillStyle=e.summary.remaining>0?"#ba2a31":"#16835b";c.font="600 16px system-ui,sans-serif";c.fillText(e.summary.remaining>0?money(e.summary.remaining):money(0)+"  ✓ Saldato",504,y+26,135)});
 return canvas;
};


/* Precarica tutte le foto prima di comporre il PNG, anche fuori schermo. */
const exportPaymentsImageWithVisiblePortraits = exportPaymentsImage;
exportPaymentsImage = async function(mode = "all") {
 const holder=document.createElement("div");holder.hidden=true;document.body.appendChild(holder);
 const images=getSortedPlayers().map(function(player){const src=typeof getPlayerPhoto==="function"?getPlayerPhoto(player):"";if(!src)return Promise.resolve();const wrap=document.createElement("span");wrap.setAttribute("data-player-history",player);const img=document.createElement("img");img.className="player-list-photo";img.src=src;wrap.appendChild(img);holder.appendChild(wrap);return new Promise(function(done){if(img.complete)return done();img.onload=done;img.onerror=done})});
 try{await Promise.all(images);return exportPaymentsImageWithVisiblePortraits(mode)}finally{holder.remove()}
};


/* Mantiene nell'export solo Giocatore, Versato e Rimanente. */
const createPaymentsExportCanvasVisibleColumns = createPaymentsExportCanvas;
createPaymentsExportCanvas = function(mode = "all") {
 const canvas=createPaymentsExportCanvasVisibleColumns(mode);if(!canvas)return null;const scale=canvas.width/698,c=canvas.getContext("2d");c.fillStyle="#f7f9fc";c.fillRect(655*scale,108*scale,43*scale,canvas.height-108*scale);return canvas;
};


/* Export pagamenti definitivo: solo Giocatore, Versato e Rimanente. */
createPaymentsExportCanvas = function(mode = "all") {
 const due=mode==="due", month=getDisplayedPaymentMonth();
 const rows=getSortedPlayers().map(player=>({player,summary:getPlayerMonthSummary(player,month)})).filter(row=>!due||row.summary.remaining>0);
 if(!rows.length)return null;
 const cols=[400,170,200], pad=36, top=104, head=46, rowH=54, tableW=cols.reduce((a,b)=>a+b,0), w=tableW+pad*2, h=top+head+rows.length*rowH+pad;
 const ratio=typeof getExportScale==="function"?getExportScale(w,h):Math.min(window.devicePixelRatio||1,2), canvas=document.createElement("canvas");
 canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);const c=canvas.getContext("2d");if(!c)return null;c.scale(ratio,ratio);c.textBaseline="middle";
 const css=getComputedStyle(document.documentElement), primary=state.teamCustomization?.primary||css.getPropertyValue("--primary").trim()||"#2563eb", accent=state.teamCustomization?.accent||css.getPropertyValue("--preview-accent").trim()||"#60a5fa";
 c.fillStyle="#f7f9fc";c.fillRect(0,0,w,h);
 const logo=[...document.querySelectorAll("[data-team-logo],.team-link img")].find(img=>img.complete&&img.naturalWidth);let titleX=pad;
 if(logo){const s=Math.min(52/logo.naturalWidth,52/logo.naturalHeight),dw=logo.naturalWidth*s,dh=logo.naturalHeight*s;c.drawImage(logo,pad+(52-dw)/2,22+(52-dh)/2,dw,dh);titleX=pad+68;}
 const label=new Date(month+"-01T12:00:00").toLocaleDateString("it-IT",{month:"long",year:"numeric"});
 c.fillStyle="#13213a";c.font="700 27px system-ui,sans-serif";c.fillText((due?"Da pagare":"Pagamenti")+" — "+label.charAt(0).toUpperCase()+label.slice(1),titleX,40);
 c.fillStyle="#5b677a";c.font="500 14px system-ui,sans-serif";c.fillText(due?"Solo chi deve ancora versare":"Situazione dei versamenti del mese",titleX,70);
 c.fillStyle=primary;c.fillRect(pad,top,tableW,head);c.fillStyle=accent;c.fillRect(pad,top,7,head);c.fillStyle="#fff";c.font="700 14px system-ui,sans-serif";
 let x=pad;["Giocatore","Versato","Rimanente"].forEach((v,i)=>{c.fillText(v,x+14,top+head/2);x+=cols[i]});
 const photos=[...document.querySelectorAll("[data-player-history] img.player-list-photo")];
 rows.forEach((entry,i)=>{const y=top+head+i*rowH;c.fillStyle=i%2?"#eef3f9":"#fff";c.fillRect(pad,y,tableW,rowH);c.strokeStyle="#d7e0ec";c.strokeRect(pad,y,tableW,rowH);
    const img=photos.find(n=>n.closest("[data-player-history]")?.getAttribute("data-player-history")===entry.player&&n.complete&&n.naturalWidth),size=36,px=pad+12,py=y+9;c.save();c.beginPath();c.arc(px+18,py+18,18,0,Math.PI*2);c.clip();if(img&&img.complete&&img.naturalWidth){const s=Math.max(size/img.naturalWidth,size/img.naturalHeight),dw=img.naturalWidth*s,dh=img.naturalHeight*s;c.drawImage(img,px+(size-dw)/2,py+(size-dh)/2,dw,dh)}else{c.fillStyle=accent;c.fillRect(px,py,size,size);c.fillStyle="#fff";c.font="800 12px system-ui,sans-serif";c.textAlign="center";c.fillText(initials(entry.player),px+18,py+19)}c.restore();c.textAlign="left";
  c.font="650 15px system-ui,sans-serif";c.fillStyle="#172236";c.fillText(entry.player,pad+58,y+rowH/2,cols[0]-72);
  c.font="600 15px system-ui,sans-serif";c.fillText(money(entry.summary.paid),pad+cols[0]+14,y+rowH/2);
  c.fillStyle=entry.summary.remaining>0?"#ba2a31":"#16835b";c.fillText(entry.summary.remaining>0?money(entry.summary.remaining):money(0)+"  ✓ Saldato",pad+cols[0]+cols[1]+14,y+rowH/2);
 });return canvas;
};

/* Aggiorna subito il rimanente durante l’inserimento del versato. */
document.addEventListener("input", event => {
 const input=event.target.closest?.("[data-payment-player]");if(!input)return;
 const player=input.dataset.paymentPlayer,month=getDisplayedPaymentMonth(),summary=getPlayerMonthSummary(player,month),paid=Math.max(0,Number(input.value)||0),remaining=Math.max(0,summary.remaining-(paid-summary.paid)),row=input.closest(".payment-row"),remainingCell=row?.querySelector(".payment-remaining,.payment-ok"),status=row?.querySelector(".payment-status");
 if(row)row.dataset.paymentRemaining=String(remaining);
 if(remainingCell){remainingCell.textContent=money(remaining);remainingCell.classList.toggle("payment-remaining",remaining>0);remainingCell.classList.toggle("payment-ok",remaining<=0)}
 if(status){status.className="payment-status "+(remaining<=0?"payment-status-ok":paid>0?"payment-status-partial":"payment-status-due");status.textContent=remaining<=0?"✓ Saldato":paid>0?"€ Parziale":"! Da saldare"}
});
document.addEventListener("click",event=>{const button=event.target.closest?.("[data-fill-payment]");if(!button)return;const input=button.closest(".payment-row")?.querySelector("[data-payment-player]");queueMicrotask(()=>input?.dispatchEvent(new Event("change",{bubbles:true}))) });

