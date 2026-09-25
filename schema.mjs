export const idSchema = { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$" };
const text = (maxLength = 3000) => ({ type: "string", minLength: 1, maxLength });
const object = (properties, required = Object.keys(properties)) => ({
    type: "object", properties, required, additionalProperties: false,
});
export const openSchema = object({ planId: idSchema, title: text(120), brief: text(12000) }, ["planId"]);
const source = object({ label: text(180), url: text(2000) });
const choice = object({ id: idSchema, label: text(180), tradeoff: text(1200) });
const npc = object({
    id: idSchema, name: text(60), role: text(80), assumption: text(1500),
    question: text(500), rationale: text(2000),
    choices: { type: "array", items: choice, minItems: 2, maxItems: 4 },
    sources: { type: "array", items: source, maxItems: 6 },
});
const area = object({
    id: idSchema, name: text(80), subtitle: text(160),
    theme: { type: "string", enum: ["meadow", "grove", "forge", "summit"] },
    goal: text(1500),
    npcs: { type: "array", items: npc, minItems: 1, maxItems: 3 },
});
export const publishSchema = object({
    planId: idSchema,
    baseRevision: { type: "integer", minimum: 0 },
    requestId: { anyOf: [idSchema, { type: "null" }] },
    title: text(120), planText: text(50000),
    areas: { type: "array", items: area, minItems: 1, maxItems: 6 },
});
export const replySchema = object({
    planId: idSchema, requestId: idSchema, text: text(12000), error: { type: "boolean" },
}, ["planId", "requestId", "text"]);

// The same lightweight validator protects RPC tools, HTTP requests, and disk mutations.
export function validate(schema, value, path = "input") {
    if (schema.anyOf) {
        for (const option of schema.anyOf) {
            try { validate(option, value, path); return; } catch (error) { if (!(error instanceof TypeError)) throw error; }
        }
        throw new TypeError(`${path} has an invalid value.`);
    }
    const type = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
    if (schema.type === "integer" ? !Number.isInteger(value) : schema.type !== type) throw new TypeError(`${path} must be ${schema.type}.`);
    if (schema.enum && !schema.enum.includes(value)) throw new TypeError(`${path} has an unsupported value.`);
    if (type === "string" && ((schema.minLength && value.trim().length < schema.minLength) ||
        value.length > (schema.maxLength ?? Infinity) || (schema.pattern && !new RegExp(schema.pattern).test(value)))) throw new TypeError(`${path} is empty, too long, or malformed.`);
    if (schema.minimum !== undefined && value < schema.minimum) throw new TypeError(`${path} is too small.`);
    if (type === "object") {
        for (const key of schema.required ?? []) if (!(key in value)) throw new TypeError(`${path}.${key} is required.`);
        for (const key of Object.keys(value)) {
            if (!Object.hasOwn(schema.properties, key)) throw new TypeError(`${path}.${key} is not allowed.`);
            validate(schema.properties[key], value[key], `${path}.${key}`);
        }
    }
    if (type === "array") {
        if (value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Infinity)) throw new TypeError(`${path} has the wrong number of items.`);
        value.forEach((entry, index) => validate(schema.items, entry, `${path}[${index}]`));
    }
}
