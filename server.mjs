import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { markdown, QuestError } from "./store.mjs";

const assets = new Map([
    ["", ["index.html", "text/html; charset=utf-8"]],
    ["style.css", ["style.css", "text/css"]],
    ["ui.js", ["ui.js", "text/javascript"]],
    ["world.js", ["world.js", "text/javascript"]],
    ["three.module.js", ["node_modules/three/build/three.module.js", "text/javascript"]],
    ["three.core.js", ["node_modules/three/build/three.core.js", "text/javascript"]],
]);

export async function startServer(store, planId) {
    const token = randomBytes(24).toString("hex");
    const prefix = `/${token}/`;
    const clients = new Set();
    let origin;
    const json = (res, value, status = 200) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(value));
    };
    const server = createServer(async (req, res) => {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Referrer-Policy", "no-referrer");
        res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'");
        try {
            if (req.headers.host !== new URL(origin).host || !req.url.startsWith(prefix)) {
                res.writeHead(404); res.end("Not found"); return;
            }
            const route = req.url.slice(prefix.length).split("?")[0];
            const asset = assets.get(route) ?? (/^[a-z][a-z0-9-]*\.js$/.test(route) ? [route, "text/javascript"] : null);
            if (req.method === "GET" && asset) {
                const [path, type] = asset;
                let content;
                try { content = await readFile(fileURLToPath(new URL(path, import.meta.url))); }
                catch (error) { if (error.code !== "ENOENT") throw error; res.writeHead(404); res.end("Not found"); return; }
                res.writeHead(200, { "Content-Type": type }); res.end(content); return;
            }
            if (req.method === "GET" && route === "state") return json(res, await store.read(planId));
            if (req.method === "GET" && route === "export") {
                res.writeHead(200, { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${planId}-spec.md"` });
                res.end(markdown(await store.read(planId))); return;
            }
            if (req.method === "GET" && route === "events") {
                res.writeHead(200, { "Content-Type": "text/event-stream", Connection: "keep-alive" });
                res.write(`data: ${JSON.stringify(await store.read(planId))}\n\n`);
                clients.add(res);
                req.on("close", () => clients.delete(res)); return;
            }
            if (req.method !== "POST") { res.writeHead(404); res.end("Not found"); return; }
            if (req.headers.origin && req.headers.origin !== origin) throw new QuestError("forbidden", "Cross-origin requests are not allowed.");
            if (req.headers["content-type"] !== "application/json") throw new QuestError("invalid_request", "JSON is required.");
            let body = "", size = 0;
            for await (const chunk of req) {
                size += chunk.length;
                if (size > 24000) throw new QuestError("too_large", "Request exceeds 24 KB.");
                body += chunk;
            }
            const input = JSON.parse(body);
            if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("A JSON object is required.");
            if (route === "decide") return json(res, await store.decide(planId, input));
            if (["start", "advance", "chat"].includes(route)) return json(res, await store.request(planId, route, input));
            if (route === "retry") return json(res, await store.retry(planId));
            if (route === "cancel") return json(res, await store.cancel(planId));
            res.writeHead(404); res.end("Not found");
        } catch (error) {
            if (res.headersSent) { res.destroy(error); return; }
            json(res, { error: error.message, code: error.code ?? "request_failed" }, error instanceof QuestError || error instanceof TypeError || error instanceof SyntaxError ? 400 : 500);
        }
    });
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    origin = `http://127.0.0.1:${server.address().port}`;
    const broadcast = (state) => { for (const client of clients) client.write(`data: ${JSON.stringify(state)}\n\n`); };
    store.events.on(planId, broadcast);
    const heartbeat = setInterval(() => { for (const client of clients) client.write(": heartbeat\n\n"); }, 15000);
    heartbeat.unref();
    return {
        planId, url: `${origin}${prefix}`,
        close: async () => {
            clearInterval(heartbeat);
            store.events.off(planId, broadcast);
            for (const client of clients) client.end();
            clients.clear();
            server.closeAllConnections();
            await new Promise((resolve) => server.close(resolve));
        },
    };
}
