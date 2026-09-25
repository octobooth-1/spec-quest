import { World, THREE, NPC_POSITIONS } from "./world.js";
import { Sfx } from "./sfx.js";
import { FISH } from "./delights.js";

const $ = (id) => document.getElementById(id);
const sfx = new Sfx();
const ROLE = [{ icon: "⚒", color: "#ff8a3d" }, { icon: "✶", color: "#8a6cff" }, { icon: "➶", color: "#22b8a0" }];
let state, activeNpc, worldKey = "", noticeTimer, submitting = false, typeTimer;
const guides = [
    { id: "welcome-pip", name: "Pip", role: "The pathfinder" },
    { id: "welcome-luma", name: "Luma", role: "The assumption keeper" },
    { id: "welcome-finn", name: "Finn", role: "The possibility scout" },
];
const world = new World($("world"), {
    onTalk: (id) => { sfx.play("talk"); openNpc(id); },
    onPortal: openPortal,
    onError: (message) => { $("world-error").textContent = message; $("world-error").hidden = false; },
    onSound: (name) => sfx.play(name),
    onCoin: (total) => { setShards(total); },
    onDelight: (kind, data) => delight(kind, data),
    promptEl: $("prompt"),
});
let rewardTimer;
function reward({ icon, eyebrow, title, detail = "", tag = "", color = "#7fd8ff", tone = "" }) {
    const r = $("reward"); r.className = `reward ${tone}`; r.hidden = true; void r.offsetWidth;
    $("reward-icon").textContent = icon; $("reward-icon").style.setProperty("--c", color);
    $("reward-eyebrow").textContent = eyebrow; $("reward-title").textContent = title; $("reward-detail").textContent = detail; $("reward-tag").textContent = tag;
    r.hidden = false; clearTimeout(rewardTimer); rewardTimer = setTimeout(() => { r.hidden = true; }, 3600);
}
const hex = (c) => typeof c === "number" ? `#${c.toString(16).padStart(6, "0")}` : c;
function delight(kind, d = {}) {
    if (kind === "sit") {
        const open = (state?.areas[state.currentArea]?.npcs ?? []).filter((n) => !state.decisions[n.id]);
        const q = open[Math.floor(Math.random() * open.length)];
        notify(q ? `🔥 The fire crackles… you wonder: “${q.question}”` : "🔥 The fire crackles. A cosy moment to let the plan settle.");
    } else if (kind === "roast") reward({ icon: d.icon, eyebrow: d.golden ? "PERFECT ROAST" : "CAMPFIRE SNACK", title: d.title, detail: d.detail, tag: d.shards ? `+${d.shards} ✦` : "", color: d.golden ? "#ffd84a" : "#ffb38a", tone: d.golden ? "legendary" : "" });
    else if (kind === "catch") reward({ icon: "🐟", eyebrow: `${d.rarity.toUpperCase()} CATCH${d.isNew ? " · NEW!" : ""}`, title: d.name, detail: `${d.size} cm · caught ${d.count}× · best ${d.best} cm`, tag: d.shards ? `+${d.shards} ✦` : "", color: hex(d.color), tone: d.rarity.toLowerCase() });
    else if (kind === "miss") notify("💨 It got away… press E the moment the bobber dips!");
    else if (kind === "early") notify("🙈 Too early! Wait for the big splash.");
    else if (kind === "stones") notify("🎵 These stones sing! Hop across them 1 → 5.");
    else if (kind === "melody") reward({ icon: "🎶", eyebrow: "SECRET MELODY", title: "The island sings along!", detail: "Everyone joins the dance.", tag: d.shards ? `+${d.shards} ✦` : "", color: "#b99bff", tone: "legendary" });
}
function setShards(total) {
    $("shard-count").textContent = String(total);
    $("shards").classList.remove("pop"); void $("shards").offsetWidth; $("shards").classList.add("pop");
}
setShards(world.shardTotal ?? 0); $("shards").classList.remove("pop");
function notify(message, tone = "") {
    $("notice").textContent = message; $("notice").className = tone; $("notice").hidden = false;
    clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { $("notice").hidden = true; }, 6000);
    if (tone === "error") sfx.play("error");
}
function titleCard(eyebrow, title, subtitle) {
    const card = $("title-card");
    $("title-eyebrow").textContent = eyebrow; $("title-name").textContent = title; $("title-sub").textContent = subtitle;
    card.hidden = false; card.classList.remove("show"); void card.offsetWidth; card.classList.add("show");
    setTimeout(() => { card.classList.remove("show"); card.hidden = true; }, 3800);
}
function show(dialog) { world.blocked = true; world.keys?.clear(); dialog.showModal(); sfx.play("open"); }
document.querySelectorAll("dialog").forEach((dialog) => {
    dialog.querySelector(".close").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => { world.blocked = [...document.querySelectorAll("dialog")].some((d) => d.open); });
    dialog.addEventListener("click", (e) => {
        const r = dialog.getBoundingClientRect();
        if (e.target === dialog && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) dialog.close();
    });
});
async function action(route, input = {}) {
    if (submitting) return false;
    submitting = true;
    const controls = [...document.querySelectorAll("form button, #research-next")];
    controls.forEach((b) => { b.disabled = true; });
    try {
        const res = await fetch(`./${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "The request failed.");
        render(body); return true;
    } catch (error) { notify(error.message, "error"); return false; }
    finally {
        submitting = false; controls.forEach((b) => { b.disabled = false; });
        if (state && activeNpc) renderNpc(false);
    }
}
const complete = (area = state?.areas[state.currentArea]) => !!area?.npcs.length && area.npcs.every((n) => Object.hasOwn(state.decisions, n.id));
function el(tag, text, className) { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n; }
const pad2 = (n) => String(n).padStart(2, "0");

function render(next) {
    if (state && next.revision < state.revision) return;
    const prev = state; state = next;
    const area = state.areas[state.currentArea], npcs = area?.npcs ?? guides, started = state.areas.length > 0, done = complete();
    document.body.classList.toggle("started", started);
    document.body.dataset.theme = area?.theme ?? "meadow";
    $("plan-title").textContent = started ? state.title : "A plan worth exploring";
    $("area-eyebrow").textContent = started ? `${state.finished ? "ADVENTURE COMPLETE" : `WORLD ${state.currentArea + 1}`} · ${state.areas.length} AREAS` : "YOUR ADVENTURE STARTS HERE";
    $("area-name").textContent = area?.name ?? "The Idea Isles";
    $("area-subtitle").textContent = area?.subtitle ?? "Big ideas. Small steps. A few helpful friends.";
    const total = started ? state.areas.reduce((s, a) => s + a.npcs.length, 0) : 0, made = Object.keys(state.decisions).length;
    $("quest-count").textContent = `${pad2(made)} / ${pad2(total)}`;
    $("quest-meter").style.setProperty("--fill", `${total ? made / total * 100 : 0}%`);
    $("quest-hint").textContent = state.finished ? "A specification, shaped by you." : done ? "Decisions collected. The portal is humming!" : "Find the glowing gems. Talk to every companion.";
    const chapters = started ? state.areas : [
        { name: "Find your purpose" }, { name: "Explore the unknown" }, { name: "Choose your approach" }, { name: "Bring it together" },
    ];
    $("area-list").replaceChildren(...chapters.map((ch, i) => {
        const past = started && (i < state.currentArea || state.finished), now = i === state.currentArea && !state.finished;
        const row = el("div", undefined, `chapter ${past ? "done" : now ? "current" : "locked"}`);
        row.append(el("div", past ? "★" : now ? String(i + 1) : "🔒", "chapter-icon"));
        const text = el("span"); text.append(el("strong", ch.name), el("small", past ? "Decisions collected" : now ? (started ? "You are here" : "Start here") : "A path yet to open"));
        row.append(text); return row;
    }));
    $("welcome").hidden = started || !!state.pending;
    $("objective").hidden = !started || !!state.pending;
    $("continue").hidden = !done || state.finished;
    $("objective").classList.toggle("ready", done && !state.finished);
    $("objective-label").textContent = state.finished ? "QUEST COMPLETE" : done ? "AREA CLEARED!" : "CURRENT OBJECTIVE";
    const answered = area?.npcs.filter((n) => state.decisions[n.id]).length ?? 0;
    $("objective-text").textContent = state.finished ? "Your idea has become a specification." : done ? "The portal is open. Step inside!" : `Meet your companions (${answered}/${area?.npcs.length ?? 0})`;
    $("objective-detail").textContent = state.finished ? "Open your journal to read or download the full plan." : done ? "Enter the portal and your agent will research the next area." : area?.goal ?? "";
    $("objective-pips").replaceChildren(...(area?.npcs ?? []).map((n, i) => { const d = el("i", undefined, state.decisions[n.id] ? "on" : ""); d.style.setProperty("--c", ROLE[i % 3].color); return d; }));
    $("pending").hidden = !state.pending;
    $("pending").classList.toggle("error", !!state.lastError);
    $("pending-title").textContent = state.lastError ? "Your companion needs a hand" : state.pending?.kind === "chat" ? "Your companion is thinking…" : "Your companions are building the next world…";
    $("pending-detail").textContent = state.lastError ?? "Research runs in your Copilot conversation. Feel free to keep exploring and hunting shards!";
    $("connection").textContent = state.lastError ? "● Needs attention" : "● Saved";

    const key = `${area?.id ?? "welcome"}:${area?.theme ?? "meadow"}:${npcs.map((n) => n.id).join("|")}`;
    const areaChanged = !!prev && prev.areas.length > 0 && prev.currentArea !== state.currentArea;
    const firstStart = !!prev && !prev.areas.length && started;
    if (key !== worldKey) {
        world.rebuild(area?.theme ?? "meadow", npcs, area?.id ?? "welcome");
        worldKey = key;
        const markers = npcs.map((npc, i) => {
            const b = el("button", undefined, "marker"); b.style.setProperty("--c", ROLE[i % 3].color);
            b.setAttribute("aria-label", `Talk to ${npc.name}, ${npc.role}`);
            const label = el("span", npc.name, "marker-name"); label.append(el("small", npc.role, "marker-role"));
            b.append(el("span", "!", "marker-bubble"), label, el("span", "E", "marker-key"));
            b.addEventListener("click", () => world.walkToNpc(npc.id));
            return { id: npc.id, name: npc.name, kind: "npc", point: new THREE.Vector3(NPC_POSITIONS[i][0], 0, NPC_POSITIONS[i][1]), element: b };
        });
        const portal = el("button", undefined, "marker portal");
        portal.append(el("span", "✧", "marker-bubble"), el("span", "The next world", "marker-name"), el("span", "E", "marker-key"));
        portal.addEventListener("click", () => world.walkToPortal());
        markers.push({ id: "portal", kind: "portal", point: new THREE.Vector3(0, 0, -8.3), element: portal });
        $("markers").replaceChildren(...markers.map((m) => m.element));
        world.setMarkers(markers);
        if (!world.renderer) markers.forEach((m, i) => { m.element.style.left = `${20 + i * 20}%`; m.element.style.top = "45%"; });
        if (areaChanged || firstStart) {
            $("npc-dialog").close(); $("portal-dialog").close();
            world.celebrate("area"); sfx.play("area");
            titleCard(`WORLD ${state.currentArea + 1} OF ${state.areas.length}`, area.name, area.subtitle);
        }
    }
    world.setDecided(Object.keys(state.decisions));
    world.setUnlocked(done && !state.finished || state.finished);
    for (const m of world.markers) {
        const decided = m.kind === "npc" && !!state.decisions[m.id];
        m.element.classList.toggle("done", decided);
        if (m.kind === "npc") m.element.querySelector(".marker-bubble").textContent = decided ? "✓" : "!";
        if (m.kind === "portal") { m.element.classList.toggle("locked", !done); m.element.querySelector(".marker-name").textContent = state.finished ? "Your journal" : done ? "Jump in!" : "The next world"; m.element.setAttribute("aria-label", done ? "Enter the portal" : "Portal locked"); }
    }
    if (prev && started && !areaChanged) {
        const before = Object.keys(prev.decisions).length;
        if (made > before) { world.celebrate("decide"); sfx.play("decide"); }
        if (done && !complete(prev.areas[prev.currentArea]) && prev.currentArea === state.currentArea) {
            setTimeout(() => { world.celebrate("portal"); sfx.play("portal"); notify("✧ Every companion has your answer. The portal is open!", "good"); }, 700);
        }
    }
    if ($("npc-dialog").open) renderNpc(false);
    if ($("journal").open) renderJournal();
    if (state.finished && !prev?.finished && prev) { notify("🏆 Adventure complete! Your researched specification is in the journal.", "good"); sfx.play("portal"); }
    if (state.lastError && state.lastError !== prev?.lastError && !state.pending) notify(state.lastError, "error");
}
function openNpc(id) {
    if (!state?.areas.length) { $("brief").value = state?.brief ?? ""; show($("start-dialog")); return; }
    activeNpc = id; renderNpc(true); setTab("decision"); show($("npc-dialog"));
}
function typewrite(node, text, animate) {
    clearInterval(typeTimer);
    if (!animate || matchMedia("(prefers-reduced-motion: reduce)").matches) { node.textContent = text; return; }
    let i = 0; node.textContent = "";
    typeTimer = setInterval(() => {
        i = Math.min(text.length, i + 2); node.textContent = text.slice(0, i);
        if (i % 12 === 0) sfx.play("tick");
        if (i >= text.length) clearInterval(typeTimer);
    }, 16);
}
function renderNpc(fresh) {
    const area = state.areas[state.currentArea], npc = area?.npcs.find((n) => n.id === activeNpc);
    if (!npc) return;
    const idx = area.npcs.indexOf(npc), role = ROLE[idx % 3];
    $("npc-dialog").style.setProperty("--c", role.color);
    $("npc-name").textContent = npc.name; $("npc-role").textContent = npc.role; $("npc-avatar").textContent = role.icon;
    if (fresh) typewrite($("npc-assumption"), npc.assumption, true);
    else if (!typeTimer || $("npc-assumption").textContent === npc.assumption) $("npc-assumption").textContent = npc.assumption;
    $("npc-rationale").textContent = npc.rationale; $("npc-question").textContent = npc.question;
    $("npc-sources").replaceChildren(...npc.sources.map((s) => {
        const n = el(/^https?:\/\//.test(s.url) ? "a" : "span", `↗ ${s.label}`);
        if (n.tagName === "A") { n.href = s.url; n.target = "_blank"; n.rel = "noopener noreferrer"; } else n.title = s.url;
        return n;
    }));
    const decision = state.decisions[npc.id];
    $("choices").replaceChildren(...npc.choices.map((choice, i) => {
        const b = el("button", undefined, `choice ${decision?.choiceId === choice.id ? "selected" : ""}`);
        b.disabled = !!decision || !!state.pending || submitting;
        b.append(el("span", decision?.choiceId === choice.id ? "✓" : String.fromCharCode(65 + i), "choice-index"));
        const text = el("span"); text.append(el("strong", choice.label), el("small", choice.tradeoff)); b.append(text);
        b.addEventListener("click", async () => { if (await action("decide", { npcId: npc.id, choiceId: choice.id, baseRevision: state.revision })) notify("★ Decision collected! Your journal has been updated.", "good"); });
        return b;
    }));
    $("custom-form").hidden = !!decision;
    $("custom-form").querySelector("button").disabled = !!state.pending || submitting;
    $("decision-saved").hidden = !decision;
    $("decision-saved").textContent = decision ? `✓ Recorded: ${decision.label}. ${complete() ? "Every companion has your answer. Head to the portal!" : "Find your other companions to open the portal."}` : "";
    $("messages").replaceChildren(...state.messages.filter((m) => m.npcId === npc.id).map((m) => el("div", m.text, `message ${m.role}`)));
    if (state.pending?.kind === "chat" && state.pending.npcId === npc.id) $("messages").append(el("div", state.lastError ?? "Researching your question…", "message assistant typing"));
    $("chat-form").querySelector("button").disabled = !!state.pending || submitting;
}
function setTab(tab) {
    $("decision-content").hidden = tab !== "decision"; $("chat-content").hidden = tab !== "chat";
    $("decision-tab").classList.toggle("active", tab === "decision"); $("chat-tab").classList.toggle("active", tab === "chat");
}
function openPortal() {
    if (!state?.areas.length) { notify("Start your adventure to discover what lies beyond the portal."); return; }
    if (state.finished) { renderJournal(); show($("journal")); return; }
    if (state.pending) { notify("Your companions are still researching. Check the request card."); return; }
    if (!complete()) { sfx.play("bump"); notify("The portal is sealed. Make a decision with every companion first!"); return; }
    const last = state.currentArea === state.areas.length - 1;
    $("portal-title").textContent = last ? "Ready to complete your specification?" : "Ready for the next world?";
    $("portal-copy").textContent = last ? "Your agent will fold in the final decisions, check the plan's assumptions, and prepare your complete specification. This does not start implementation." : "Your choices will guide the next part of the specification. Your agent will research their implications before the portal opens.";
    $("research-next").textContent = last ? "Finalize my specification →" : "Jump through & research →";
    show($("portal-dialog"));
}
function renderJournal() {
    const c = $("journal-body"); c.replaceChildren();
    c.append(el("h3", state.title), el("p", state.brief || "Your adventure hasn't begun. Start with an idea."));
    for (const [index, area] of state.areas.entries()) {
        c.append(el("h3", `World ${index + 1} · ${area.name}`));
        for (const npc of area.npcs) {
            const d = state.decisions[npc.id], entry = el("div", undefined, `journal-entry ${d ? "done" : ""}`);
            entry.append(el("strong", npc.question), el("div", d ? `★ ${d.label}` : "Not decided yet"), el("small", d?.tradeoff ?? npc.assumption));
            c.append(entry);
        }
    }
    c.append(el("h3", "The evolving specification"), el("div", state.planText || "Your agent's research will appear here when the adventure begins.", "spec-text"));
    const tr = world.delights.treasures, fishes = Object.entries(tr.fish ?? {});
    c.append(el("h3", "Island treasures"));
    const grid = el("div", undefined, "treasure-grid");
    for (const f of FISH) { const got = tr.fish?.[f.name]; grid.append(el("span", got ? `🐟 ${f.name} ×${got.count} · ${got.best} cm` : `❔ ${f.rarity} fish`, `treasure ${got ? "" : "missing"}`)); }
    grid.append(el("span", `🍡 ${tr.roasts ?? 0} roasts · ${tr.golden ?? 0} golden`, "treasure"), el("span", `🎶 ${tr.melodies ?? 0} melodies`, "treasure"), el("span", `⚽ ${tr.kicks ?? 0} kicks`, "treasure"));
    c.append(grid, el("small", `${fishes.length}/${FISH.length} fish discovered`));
    c.append(el("p", `Revision ${state.revision} · Saved with this session · ${state.finished ? "Complete" : "Draft"} · ✦ ${world.shardTotal ?? 0} shards found`));
}
function syncMute() { $("mute").textContent = sfx.muted ? "🔇" : "🔊"; $("mute").setAttribute("aria-label", sfx.muted ? "Unmute sounds" : "Mute sounds"); }
syncMute();
$("mute").addEventListener("click", () => { sfx.toggle(); syncMute(); });
$("begin").addEventListener("click", () => { $("brief").value = state?.brief ?? ""; show($("start-dialog")); });
$("home").addEventListener("click", (e) => { e.preventDefault(); world.resetCamera?.(); });
$("journal-button").addEventListener("click", () => { if (state) { renderJournal(); show($("journal")); } });
$("decision-tab").addEventListener("click", () => setTab("decision")); $("chat-tab").addEventListener("click", () => setTab("chat"));
$("rotate-left").addEventListener("click", () => world.rotate?.(-.4)); $("rotate-right").addEventListener("click", () => world.rotate?.(.4)); $("camera-reset").addEventListener("click", () => world.resetCamera?.());
$("jump").addEventListener("click", () => world.jump?.());
$("dance").addEventListener("click", () => world.delights.startDance());
$("prompt").addEventListener("click", () => world.interact());
$("continue").addEventListener("click", () => world.walkToPortal());
$("research-next").addEventListener("click", async () => { if (await action("advance")) { $("portal-dialog").close(); world.celebrate("portal"); sfx.play("portal"); } });
$("start-form").addEventListener("submit", async (e) => { e.preventDefault(); if (await action("start", { brief: $("brief").value })) { $("start-dialog").close(); sfx.play("portal"); } });
$("chat-form").addEventListener("submit", async (e) => { e.preventDefault(); if (await action("chat", { npcId: activeNpc, text: $("chat-input").value })) $("chat-input").value = ""; });
$("custom-form").addEventListener("submit", async (e) => { e.preventDefault(); if (await action("decide", { npcId: activeNpc, custom: $("custom").value, baseRevision: state.revision })) { $("custom").value = ""; notify("★ Your own path is recorded.", "good"); } });
$("retry").addEventListener("click", () => action("retry")); $("cancel").addEventListener("click", () => action("cancel"));
window.addEventListener("keydown", (e) => {
    if (world.blocked || /INPUT|TEXTAREA/.test(e.target.tagName) || !state) return;
    if (e.key.toLowerCase() === "j") { renderJournal(); show($("journal")); }
    if (e.key.toLowerCase() === "m") { sfx.toggle(); syncMute(); }
});
try {
    const res = await fetch("./state"); if (!res.ok) throw new Error("The saved plan could not be loaded.");
    render(await res.json());
    const stream = new EventSource("./events");
    stream.onmessage = (e) => { try { render(JSON.parse(e.data)); } catch (error) { notify(`Could not display the plan: ${error.message}`, "error"); } };
    stream.onerror = () => { $("connection").textContent = "● Reconnecting…"; };
    stream.onopen = () => { $("connection").textContent = "● Saved"; };
} catch (error) { notify(error.message, "error"); $("connection").textContent = "● Connection failed"; }
