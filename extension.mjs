import { joinSession, createCanvas, CanvasError } from "@github/copilot-sdk/extension";
import { Store, QuestError } from "./store.mjs";
import { startServer } from "./server.mjs";
import { openSchema, publishSchema, replySchema, idSchema } from "./schema.mjs";

const servers = new Map();
let store;
const guidance = `Spec Quest is the user's preferred interactive planning experience. When the primary task is making a spec or implementation plan (unless the user opts out), research the relevant project and authoritative sources with available tools, then open the spec-quest canvas with a stable, unique planId and the user's brief. Read its state with spec_quest_read, and use spec_quest_publish to turn the plan into 2-4 sequential areas with 1-3 NPC decisions each. No invented evidence: distinguish assumptions from facts, cite sources actually read, explain meaningful tradeoffs, and include measurable acceptance criteria. Use original NPCs and area names, themes meadow/grove/forge/summit. Do not make decisions for the user. Honor decisions already recorded. The canvas is the decision UI; don't also ask the same questions in chat.
For [Spec Quest request] messages: read the named plan. Handle its pending request only. For research requests, research and publish the complete evolved plan with the exact baseRevision and requestId. Preserve area order/IDs and completed NPC content verbatim; evolve only unanswered/future questions. Provide planText as a full usable specification, incorporating recorded decisions, open assumptions, implementation steps, risks, and acceptance criteria. Publishing a pending advance unlocks the next area, but does not implement the plan. For chat requests, answer the specific NPC question using spec_quest_reply, including the requestId. Never claim a publish/reply succeeded without the tool succeeding. On a blocker use spec_quest_reply with error=true to leave an explicit retryable error. Requests are user-initiated; do not send new requests yourself.`;

async function safely(fn) {
    try { return await fn(); }
    catch (error) {
        if (error instanceof QuestError) throw new CanvasError(error.code, error.message);
        throw error;
    }
}

const session = await joinSession({
    hooks: {
        onSessionStart: async () => ({ additionalContext: guidance }),
        onUserPromptSubmitted: async ({ prompt }) => {
            if (prompt.includes("[Spec Quest request]") ||
                /\b(plan|specification|spec)\b/i.test(prompt) &&
                /\b(make|create|design|draft|write|build|plan)\b/i.test(prompt)) {
                return { additionalContext: guidance };
            }
        },
    },
    tools: [
        {
            name: "spec_quest_read",
            description: "Read a session's saved Spec Quest plan, decisions, revision, and pending research/chat request.",
            parameters: { type: "object", properties: { planId: idSchema }, required: ["planId"], additionalProperties: false },
            handler: async ({ planId }) => JSON.stringify(await store.read(planId)),
        },
        {
            name: "spec_quest_publish",
            description: "Publish a researched Spec Quest specification and NPC questions. Read first; pass exact baseRevision and pending requestId. Preserves user decisions.",
            parameters: publishSchema,
            handler: async (input) => JSON.stringify(await store.publish(input)),
        },
        {
            name: "spec_quest_reply",
            description: "Deliver a researched NPC chat answer, or explicitly report a blocked research request using error=true.",
            parameters: replySchema,
            handler: async (input) => JSON.stringify(await store.reply(input)),
        },
    ],
    canvases: [createCanvas({
        id: "spec-quest",
        displayName: "Spec Quest",
        description: "Explore a colourful 3D RPG world, meet NPCs, and make researched specification decisions that unlock new areas.",
        inputSchema: openSchema,
        actions: [
            {
                name: "get_state", description: "Read the saved specification, decisions, and pending agent request.",
                inputSchema: { type: "object", properties: {}, additionalProperties: false },
                handler: (ctx) => safely(() => store.read(servers.get(ctx.instanceId).planId)),
            },
            {
                name: "publish_plan", description: "Publish researched areas and the evolved spec using an exact revision.",
                inputSchema: publishSchema,
                handler: (ctx) => safely(() => {
                    if (servers.get(ctx.instanceId).planId !== ctx.input.planId) throw new QuestError("wrong_plan", "This panel belongs to a different plan.");
                    return store.publish(ctx.input);
                }),
            },
            {
                name: "reply", description: "Answer an NPC chat request or report a research blocker.",
                inputSchema: replySchema,
                handler: (ctx) => safely(() => {
                    if (servers.get(ctx.instanceId).planId !== ctx.input.planId) throw new QuestError("wrong_plan", "This panel belongs to a different plan.");
                    return store.reply(ctx.input);
                }),
            },
        ],
        open: (ctx) => safely(async () => {
            if (!store) throw new QuestError("starting", "Spec Quest is still starting. Retry in a moment.");
            await store.ensure(ctx.input.planId, ctx.input.title, ctx.input.brief);
            let entry = servers.get(ctx.instanceId);
            if (!entry) {
                entry = await startServer(store, ctx.input.planId);
                servers.set(ctx.instanceId, entry);
            }
            return { title: "Spec Quest", url: entry.url, status: "Your plan, one adventure at a time" };
        }),
        onClose: async (ctx) => {
            const entry = servers.get(ctx.instanceId);
            if (entry) {
                servers.delete(ctx.instanceId);
                await entry.close();
            }
        },
    })],
});

store = new Store(session.workspacePath, (prompt) => session.send({ prompt }));
