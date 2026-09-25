import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { isDeepStrictEqual } from "node:util";
import { validate, idSchema, publishSchema, replySchema } from "./schema.mjs";

export class QuestError extends Error {
    constructor(code, message) { super(message); this.code = code; }
}
const fail = (code, message) => { throw new QuestError(code, message); };
const clone = (value) => structuredClone(value);
export const isComplete = (state, area = state.areas[state.currentArea]) =>
    Boolean(area?.npcs.length) && area.npcs.every((npc) => Object.hasOwn(state.decisions, npc.id));

export function markdown(state) {
    const lines = [`# ${state.title}`, "", state.brief, "", "## Evolving specification", "", state.planText || "Research has not been published yet.", "", "## Decision ledger", ""];
    for (const area of state.areas) {
        lines.push(`### ${area.name}`, "", area.goal, "");
        for (const npc of area.npcs) {
            const decision = state.decisions[npc.id];
            lines.push(`**${npc.question}**`, `- Assumption: ${npc.assumption}`,
                `- ${decision ? `Decision: ${decision.label}\n- Consequence: ${decision.tradeoff}` : "Status: awaiting your decision"}`,
                ...npc.sources.map((source) => `- Source: ${source.label} (${source.url})`), "");
        }
    }
    lines.push(`Revision: ${state.revision}. ${state.finished ? "All areas completed." : "Draft; unresolved decisions remain."}`);
    return lines.join("\n");
}

export class Store {
    constructor(workspace, send) {
        if (!workspace) fail("workspace_missing", "Spec Quest needs a session workspace to save your decisions.");
        this.root = join(workspace, "files", "spec-quest");
        this.send = send;
        this.events = new EventEmitter();
        this.events.setMaxListeners(100);
        this.locks = new Map();
    }
    path(id) { validate(idSchema, id, "planId"); return join(this.root, `${id}.json`); }
    async locked(id, fn) {
        const previous = this.locks.get(id) ?? Promise.resolve();
        const operation = previous.then(fn, fn);
        const settled = operation.then(() => {}, () => {});
        this.locks.set(id, settled);
        try { return await operation; }
        finally { if (this.locks.get(id) === settled) this.locks.delete(id); }
    }
    async read(id) {
        const path = this.path(id);
        let content;
        try { content = await readFile(path, "utf8"); }
        catch (error) {
            if (error.code === "ENOENT") fail("not_found", `Plan "${id}" does not exist. Open its canvas first.`);
            throw error;
        }
        const state = JSON.parse(content);
        if (state.schemaVersion !== 1 || state.planId !== id) fail("invalid_save", "The saved plan is incompatible or damaged; it has not been overwritten.");
        return state;
    }
    async write(state) {
        await mkdir(this.root, { recursive: true });
        const path = this.path(state.planId);
        const temporary = `${path}.${randomUUID()}.tmp`;
        await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
        await rename(temporary, path);
        this.events.emit(state.planId, clone(state));
        return state;
    }
    ensure(planId, title = "Your next big idea", brief = "") {
        return this.locked(planId, async () => {
            try { return await this.read(planId); }
            catch (error) { if (error.code !== "not_found") throw error; }
            return this.write({
                schemaVersion: 1, planId, title, brief, revision: 0, planText: "",
                areas: [], currentArea: 0, decisions: {}, messages: [], pending: null,
                lastError: null, finished: false, updatedAt: new Date().toISOString(),
            });
        });
    }
    mutate(id, fn) {
        return this.locked(id, async () => {
            const state = await this.read(id);
            await fn(state);
            state.revision++;
            state.updatedAt = new Date().toISOString();
            return this.write(state);
        });
    }
    publish(input) {
        validate(publishSchema, input);
        return this.mutate(input.planId, (state) => {
            if (state.revision !== input.baseRevision) fail("revision_conflict", "The plan changed. Read it again before publishing.");
            if (state.pending && (state.pending.id !== input.requestId || state.pending.kind === "chat")) fail("request_conflict", "This publish does not match the pending research request.");
            if (!state.pending && input.requestId !== null) fail("request_conflict", "This research request is no longer pending.");
            const areaIds = new Set(), npcIds = new Set();
            for (const area of input.areas) {
                if (areaIds.has(area.id)) fail("duplicate_id", "Area IDs must be unique.");
                areaIds.add(area.id);
                for (const npc of area.npcs) {
                    if (npcIds.has(npc.id) || ["__proto__", "constructor", "prototype"].includes(npc.id)) fail("duplicate_id", "NPC IDs must be unique and non-reserved.");
                    npcIds.add(npc.id);
                    if (new Set(npc.choices.map((choice) => choice.id)).size !== npc.choices.length) fail("duplicate_id", "Choice IDs must be unique within an NPC.");
                    for (const source of npc.sources) {
                        if (!/^(https?:\/\/|repo:)/.test(source.url)) fail("invalid_source", "Sources must use http(s) URLs or repo: paths.");
                    }
                }
            }
            for (let i = 0; i < state.areas.length; i++) {
                const old = state.areas[i];
                if (i <= state.currentArea && input.areas[i]?.id !== old.id) fail("area_conflict", "Preserve the order and IDs of visited areas.");
                for (const npc of old.npcs) {
                    if (!Object.hasOwn(state.decisions, npc.id)) continue;
                    const next = input.areas[i]?.npcs.find((item) => item.id === npc.id);
                    if (!next || !isDeepStrictEqual(next, npc)) fail("decision_conflict", "Do not rewrite answered NPCs. Add follow-up questions in a future area.");
                }
            }
            const advance = state.pending?.kind === "advance";
            if (advance && !isComplete(state)) fail("incomplete_area", "Answer every NPC before advancing.");
            state.title = input.title;
            state.planText = input.planText;
            state.areas = clone(input.areas);
            if (advance) {
                if (!isComplete(state)) fail("incomplete_area", "Do not introduce unanswered questions in the area being completed. Put them in the next area.");
                if (state.currentArea + 1 < state.areas.length) state.currentArea++;
                else state.finished = true;
            }
            state.pending = null;
            state.lastError = null;
        });
    }
    decide(id, { npcId, choiceId, custom, baseRevision }) {
        return this.mutate(id, (state) => {
            if (state.revision !== baseRevision) fail("revision_conflict", "The plan changed. Review the refreshed question and try again.");
            if (state.pending) fail("request_pending", "Wait for the current agent response before choosing.");
            if (state.finished) fail("finished", "This adventure is complete.");
            const npc = state.areas[state.currentArea]?.npcs.find((item) => item.id === npcId);
            if (!npc) fail("invalid_npc", "That NPC is not in the current area.");
            if (Object.hasOwn(state.decisions, npcId)) fail("already_answered", "This decision is already recorded.");
            const choice = npc.choices.find((item) => item.id === choiceId);
            if (!choice && !(typeof custom === "string" && custom.trim().length > 0 && custom.length <= 3000)) fail("invalid_choice", "Choose an option or provide a custom answer.");
            state.decisions[npcId] = {
                choiceId: choice?.id ?? "custom", label: choice?.label ?? custom.trim(),
                tradeoff: choice?.tradeoff ?? "Custom decision; implications will be researched before the next area.",
                at: new Date().toISOString(),
            };
        });
    }
    async request(id, kind, { brief, npcId, text } = {}) {
        if (!["start", "advance", "chat"].includes(kind)) fail("invalid_request", "Unknown request type.");
        const state = await this.mutate(id, (state) => {
            if (state.pending) fail("request_pending", "There is already a pending agent request.");
            if (kind === "start") {
                if (state.areas.length) fail("already_started", "This plan already has a world.");
                if (typeof brief !== "string" || !brief.trim() || brief.length > 12000) fail("invalid_brief", "Describe your plan in 1-12000 characters.");
                state.brief = brief.trim();
            }
            if (kind === "advance" && (!isComplete(state) || state.finished)) fail("incomplete_area", "Meet every NPC and decide before continuing.");
            if (kind === "chat") {
                if (typeof text !== "string" || !text.trim() || text.length > 3000) fail("invalid_chat", "Write a question in 1-3000 characters.");
                if (!state.areas[state.currentArea]?.npcs.some((npc) => npc.id === npcId)) fail("invalid_npc", "Choose an NPC in the current area.");
                state.messages.push({ npcId, role: "user", text: text.trim() });
            }
            state.lastError = null;
            state.pending = { id: randomUUID(), kind, npcId: npcId ?? null, text: text?.trim() ?? null, createdAt: new Date().toISOString() };
        });
        return this.deliver(state);
    }
    async deliver(state) {
        const request = state.pending;
        const prompt = `[Spec Quest request] The user requested ${request.kind} for planId=${state.planId}, requestId=${request.id}. Read spec_quest_read first. ${request.kind === "chat" ? "Answer their NPC question via spec_quest_reply." : "Research the brief and recorded decisions, then publish the evolved full specification and NPC areas using spec_quest_publish with the latest revision and this requestId. Preserve answered NPCs exactly. Do not implement code."} On a blocker, use spec_quest_reply with error=true.`;
        try { await this.send(prompt); }
        catch (error) {
            return this.mutate(state.planId, (latest) => {
                if (latest.pending?.id !== request.id) return;
                latest.lastError = `Could not reach the agent: ${error.message}. Your request is saved; use Retry.`;
            });
        }
        return this.read(state.planId);
    }
    async retry(id) {
        const state = await this.mutate(id, (state) => {
            if (!state.pending) fail("no_request", "There is no request to retry.");
            state.lastError = null;
        });
        return this.deliver(state);
    }
    cancel(id) {
        return this.mutate(id, (state) => {
            if (!state.pending) fail("no_request", "There is no request to cancel.");
            state.pending = null;
            state.lastError = "Request cancelled. Any late response will be rejected; your saved decisions are unchanged.";
        });
    }
    reply(input) {
        validate(replySchema, input);
        return this.mutate(input.planId, (state) => {
            if (state.pending?.id !== input.requestId) fail("request_conflict", "That request is no longer pending.");
            if (input.error) { state.lastError = input.text; return; }
            if (state.pending.kind !== "chat") fail("invalid_reply", "Research requests require publish_plan, or an error reply.");
            state.messages.push({ npcId: state.pending.npcId, role: "assistant", text: input.text });
            state.pending = null;
            state.lastError = null;
        });
    }
}
