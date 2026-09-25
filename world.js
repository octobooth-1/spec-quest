import { THREE, Kit, THEMES, GROUND, RADIUS } from "./toon.js";
import { buildCharacter, animateCharacter, ROLE_COLORS } from "./characters.js";
import { LAYOUT, buildIsland, buildPaths, buildWater, buildFlora } from "./scenery.js";
import { buildPortal, buildCamp, buildBoard, buildPad, buildBlock, buildLandmark, buildSky } from "./landmarks.js";
import { buildParticles, buildCritters, buildShards, Effects, SHARD_SPOTS } from "./effects.js";
import { Delights } from "./delights.js";

export const NPC_POSITIONS = [[-5.1, 2.1], [3.2, -3.4], [6.2, 3.6]];
export { THREE };
const clamp = THREE.MathUtils.clamp;
const SHARD_KEY = "spec-quest-shards";

export class World {
    constructor(canvas, { onTalk, onPortal, onError, onSound = () => {}, onCoin = () => {}, onDelight = () => {}, promptEl = null }) {
        Object.assign(this, { canvas, onTalk, onPortal, onSound, onCoin, onDelight, promptEl });
        this.blocked = false; this.keys = new Set(); this.markers = []; this.npcs = [];
        this.cameraAngle = .42; this.zoom = 1; this.pitch = .83;
        this.vel = new THREE.Vector3(); this.vy = 0; this.grounded = true; this.target = null; this.arrival = null;
        this.focus = new THREE.Vector3(0, 1.4, 0);
        this.collected = new Map(); this.shardTotal = Number(localStorage.getItem(SHARD_KEY) || 0);
        this.decided = new Set(); this.shake = 0; this.dropIn = 0;
        this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
        this.clock = new THREE.Clock(); this.ray = new THREE.Raycaster(); this.mouse = new THREE.Vector2();
        try {
            this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
            this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
            this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.NoToneMapping;
        } catch (error) { this.renderer = null; onError(`The 3D world could not start: ${error.message}. You can still use the quest journal and companion buttons.`); return; }
        canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); onError("The graphics context was lost. Reload the canvas to restore the world; your decisions are saved."); });
        this.kit = new Kit();
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(36, 1, .1, 400);
        this.hemi = new THREE.HemisphereLight(0xffffff, 0xb7a6d8, 1.6); this.scene.add(this.hemi);
        this.sun = new THREE.DirectionalLight(0xfff1d6, 2.6); this.sun.position.set(-14, 26, 12); this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(2048, 2048); Object.assign(this.sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 });
        this.sun.shadow.bias = -.0012; this.sun.shadow.normalBias = .08; this.scene.add(this.sun);
        this.effects = new Effects(this.kit, this.scene);
        this.player = buildCharacter(this.kit, "hero"); this.player.position.set(LAYOUT.spawn[0], GROUND, LAYOUT.spawn[1]); this.scene.add(this.player);
        this.blob = new THREE.Mesh(new THREE.CircleGeometry(.55, 24), new THREE.MeshBasicMaterial({ color: 0x2b2033, transparent: true, opacity: .28, depthWrite: false }));
        this.blob.rotation.x = -Math.PI / 2; this.scene.add(this.blob);
        this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND);
        this.delights = new Delights(this);
        this.rebuild("meadow", [], "welcome");
        const resize = () => {
            const { width, height } = canvas.getBoundingClientRect();
            this.renderer.setSize(width, height, false); this.camera.aspect = width / Math.max(1, height); this.camera.updateProjectionMatrix();
        };
        new ResizeObserver(resize).observe(canvas); resize();
        this.bindInput();
        this.renderer.setAnimationLoop(() => this.frame());
    }
    bindInput() {
        const c = this.canvas;
        c.addEventListener("pointerdown", (e) => { this.down = { x: e.clientX, y: e.clientY, a: this.cameraAngle, drag: false }; c.setPointerCapture(e.pointerId); });
        c.addEventListener("pointermove", (e) => {
            if (!this.down || this.blocked) return;
            const dx = e.clientX - this.down.x;
            if (Math.abs(dx) > 8) this.down.drag = true;
            if (this.down.drag) this.cameraAngle = this.down.a - dx * .006;
        });
        c.addEventListener("pointerup", (e) => {
            const d = this.down; this.down = null;
            if (this.blocked || !d || d.drag) return;
            this.delights.cancel();
            const rect = c.getBoundingClientRect();
            this.mouse.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
            this.ray.setFromCamera(this.mouse, this.camera);
            const hitNpc = this.ray.intersectObjects(this.npcs.map((n) => n.mesh), true)[0];
            if (hitNpc) { let o = hitNpc.object; while (o && !o.userData.npcId) o = o.parent; if (o) { this.walkToNpc(o.userData.npcId); return; } }
            const hit = new THREE.Vector3();
            if (this.ray.ray.intersectPlane(this.ground, hit) && Math.hypot(hit.x, hit.z) < RADIUS - .9) {
                this.target = hit; this.arrival = null; this.effects.ring(hit, 0xffffff, 1.2);
            }
            c.focus();
        });
        c.addEventListener("wheel", (e) => { if (this.blocked) return; e.preventDefault(); this.zoom = clamp(this.zoom + e.deltaY * .0006, .65, 1.35); }, { passive: false });
        window.addEventListener("keydown", (e) => {
            if (this.blocked || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName)) return;
            const k = e.key.toLowerCase();
            if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", "e", " "].includes(k)) e.preventDefault();
            this.keys.add(k);
            if (k === " " && !e.repeat) this.jump();
            if (k === "e" && !e.repeat) this.interact();
            if (k === "q") this.rotate(-.35);
            if (k === "x" && !e.repeat) this.delights.startDance();
        });
        window.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
        window.addEventListener("blur", () => this.keys.clear());
    }
    jump(power = 9) {
        if (!this.grounded || this.blocked) return;
        this.delights.cancel();
        this.vy = power; this.grounded = false; this.onSound(power > 10 ? "boing" : "jump");
        this.effects.dust(this.player.position, 5);
    }
    interactable() {
        const p = this.player.position, list = [];
        for (const m of this.markers) if (m.kind === "npc") list.push({ d: p.distanceTo(m.point) / 3.6, label: `Talk to ${m.name ?? "friend"}`, run: () => this.onTalk(m.id) });
        list.push({ d: Math.hypot(p.x - LAYOUT.portal[0], p.z - LAYOUT.portal[1]) / 3.6, label: "Check the portal", run: () => this.onPortal() });
        list.push(...this.delights.candidates(p));
        return list.filter((c) => c.d < 1).sort((a, b) => a.d - b.d)[0] ?? null;
    }
    interact() {
        if (this.blocked) return;
        if (this.delights.activity) { this.delights.press(); return; }
        this.interactable()?.run();
    }
    addShards(n) {
        this.shardTotal += n; localStorage.setItem(SHARD_KEY, String(this.shardTotal));
        this.onCoin(this.shardTotal);
    }
    dispose(obj) {
        obj.traverse((m) => { m.geometry?.dispose(); if (m.material?.map && m.material.map !== this.kit.dot) m.material.map.dispose(); });
    }
    rebuild(themeName, npcs, areaKey = "welcome") {
        if (!this.renderer) return;
        const theme = THEMES[themeName] ?? THEMES.meadow;
        const seed = [...areaKey].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7);
        if (this.root) { this.scene.remove(this.root); this.dispose(this.root); }
        this.effects.clear();
        const root = this.root = new THREE.Group(); this.scene.add(root);
        this.theme = theme; this.areaKey = areaKey;
        this.scene.fog = new THREE.Fog(theme.skyBottom, 60, 160);
        this.hemi.color.set(0xffffff); this.hemi.groundColor.set(theme.dirt[0]);
        this.sun.color.set(theme.landmark === "mushroom-house" ? 0xe7d6ff : 0xfff1d6);
        const updates = [];
        const add = (x) => { if (x?.update) updates.push(x.update.bind(x)); return x; };
        add(buildSky(this.kit, root, theme, seed));
        const island = buildIsland(this.kit, root, theme, seed);
        const paths = buildPaths(this.kit, root, theme, island.r);
        const water = add(buildWater(this.kit, root, theme));
        this.portal = add(buildPortal(this.kit, root, theme));
        const camp = add(buildCamp(this.kit, root, theme));
        const board = add(buildBoard(this.kit, root, theme));
        this.pad = add(buildPad(this.kit, root, theme));
        this.block = add(buildBlock(this.kit, root));
        const landmark = add(buildLandmark(this.kit, root, theme));
        this.delights.build(root, themeName in THEMES ? themeName : "meadow", theme, camp, areaKey);
        this.colliders = [water.collider, ...this.portal.collider, ...camp.colliders, board.collider, landmark.collider];
        const reserved = [[LAYOUT.spawn[0], LAYOUT.spawn[1], 1.4], [LAYOUT.plaza[0], LAYOUT.plaza[1], 2.6], [0, -5.5, 1.2], [0, -3, 1], [...LAYOUT.portal, 3.2], [...LAYOUT.pond, 3], [...LAYOUT.camp, 3.2], [...LAYOUT.board, 1.3], [...LAYOUT.pad, 1.4], [...LAYOUT.landmark, 2.4], [...LAYOUT.block, 1], [10.6, -3.6, 1.4], ...NPC_POSITIONS.map(([x, z]) => [x, z, 2]), ...SHARD_SPOTS.map(([x, z]) => [x, z, .7]), ...this.delights.reserved()];
        this.npcs = npcs.slice(0, 3).map((npc, i) => {
            const [x, z] = NPC_POSITIONS[i];
            paths.line(LAYOUT.plaza, [x * .8, z * .8]);
            const pedestal = this.kit.cyl(root, this.theme.path, x, GROUND + .04, z, 1.05, 1.1, .1, 20); pedestal.castShadow = false;
            const mesh = buildCharacter(this.kit, "npc", i); mesh.position.set(x, GROUND, z); mesh.rotation.y = Math.atan2(-x, 4 - z);
            mesh.scale.setScalar(1.08); mesh.userData.npcId = npc.id; root.add(mesh);
            const gem = this.kit.mesh(new THREE.OctahedronGeometry(.26, 0), this.kit.toon(ROLE_COLORS[i], { emissive: ROLE_COLORS[i], emissiveIntensity: .45 }), root, x, GROUND + 3, z, .03);
            this.colliders.push({ x, z, r: .7 });
            return { id: npc.id, mesh, gem, i };
        });
        const flora = add(buildFlora(this.kit, root, theme, island.r, reserved));
        this.colliders.push(...flora.colliders);
        add(buildParticles(this.kit, root, theme, seed));
        add(buildCritters(this.kit, root, theme, flora.flowers, seed));
        if (!this.collected.has(areaKey)) this.collected.set(areaKey, new Set());
        this.shards = add(buildShards(this.kit, root, this.collected.get(areaKey)));
        this.updates = updates;
        this.setDecided([...this.decided]);
    }
    setUnlocked(value) { if (this.portal) this.portal.unlocked = value; }
    setDecided(ids) {
        this.decided = new Set(ids);
        for (const n of this.npcs ?? []) n.gem.material = this.kit.toon(this.decided.has(n.id) ? 0x5fdc6a : ROLE_COLORS[n.i], { emissive: this.decided.has(n.id) ? 0x2f9e3a : ROLE_COLORS[n.i], emissiveIntensity: .45 });
    }
    setMarkers(markers) { this.markers = markers; }
    rotate(d) { this.cameraAngle += d; }
    resetCamera() { this.cameraAngle = .42; this.zoom = 1; }
    walkToNpc(id) {
        if (!this.renderer) { this.onTalk(id); return; }
        const n = this.npcs.find((x) => x.id === id); if (!n) return;
        const p = n.mesh.position, dir = new THREE.Vector3(-p.x, 0, -p.z).normalize();
        this.target = new THREE.Vector3(p.x + dir.x * 1.6, GROUND, p.z + dir.z * 1.6); this.arrival = () => this.onTalk(id);
    }
    walkToPortal() {
        if (!this.renderer) { this.onPortal(); return; }
        this.target = new THREE.Vector3(LAYOUT.portal[0], GROUND, LAYOUT.portal[1] + 2.4); this.arrival = () => this.onPortal();
    }
    celebrate(kind) {
        if (!this.renderer) return;
        const p = this.player.position.clone(); p.y += 1.6;
        if (kind === "decide") { this.effects.burst(p, { count: 60 }); this.effects.sparkle(p, 0xfff3a8, 18); this.shake = .25; }
        if (kind === "portal") { const q = new THREE.Vector3(LAYOUT.portal[0], GROUND, LAYOUT.portal[1]); for (let i = 0; i < 3; i++) setTimeout(() => this.effects.ring(q, [0x5ff0ff, 0xff7ad0, 0xffe45c][i], 5), i * 180); this.effects.burst(q.setY(2), { count: 70, up: 9 }); this.shake = .4; }
        if (kind === "area") { this.player.position.set(LAYOUT.spawn[0], GROUND + 9, LAYOUT.spawn[1]); this.grounded = false; this.vy = 0; this.dropIn = 1; this.target = null; }
    }
    collect(s) {
        s.m.visible = false; this.collected.get(this.areaKey).add(s.i);
        this.shardTotal++; localStorage.setItem(SHARD_KEY, String(this.shardTotal));
        this.effects.sparkle(s.m.position, 0xffe45c, 16); this.effects.ring(s.m.position.clone().setY(GROUND), 0xffe45c, 1.6);
        this.onSound("coin"); this.onCoin(this.shardTotal);
    }
    frame() {
        if (document.hidden) { this.clock.getDelta(); return; }
        const dt = Math.min(this.clock.getDelta(), .05), t = this.clock.elapsedTime, p = this.player.position;
        this.kit.time.value = t;
        const move = new THREE.Vector3();
        if (!this.blocked) {
            const x = (this.keys.has("d") || this.keys.has("arrowright") ? 1 : 0) - (this.keys.has("a") || this.keys.has("arrowleft") ? 1 : 0);
            const z = (this.keys.has("s") || this.keys.has("arrowdown") ? 1 : 0) - (this.keys.has("w") || this.keys.has("arrowup") ? 1 : 0);
            if (x || z) { this.delights.cancel(); this.delights.dance = 0; }
            if (this.delights.activity) { /* the activity anchors the player */ }
            else if (x || z) { move.set(x, 0, z).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraAngle); this.target = null; this.arrival = null; }
            else if (this.target) {
                move.subVectors(this.target, p).setY(0);
                if (move.length() < .2) { this.target = null; const a = this.arrival; this.arrival = null; move.set(0, 0, 0); a?.(); }
                else move.normalize();
            }
        }
        this.vel.lerp(move.multiplyScalar(5.6), Math.min(1, dt * (move.lengthSq() ? 10 : 7)));
        const speed = this.vel.length();
        if (speed > .05) {
            const next = p.clone().addScaledVector(this.vel, dt);
            for (const c of this.colliders) {
                const dx = next.x - c.x, dz = next.z - c.z, d = Math.hypot(dx, dz), min = c.r + .45;
                if (d < min && d > 1e-4) { next.x = c.x + dx / d * min; next.z = c.z + dz / d * min; }
            }
            const r = Math.hypot(next.x, next.z);
            if (r > RADIUS - .9) next.multiplyScalar((RADIUS - .9) / r);
            p.x = next.x; p.z = next.z;
            const want = Math.atan2(this.vel.x, this.vel.z);
            let d = want - this.player.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
            this.player.rotation.y += d * Math.min(1, dt * 14);
            if (this.grounded && Math.random() < dt * 6) this.effects.dust(p, 1);
        }
        if (!this.grounded) {
            this.vy -= (this.dropIn ? 20 : 28) * dt; p.y += this.vy * dt;
            if (this.vy > 0 && this.block && !this.block.spent && Math.hypot(p.x - this.block.x, p.z - this.block.z) < .75 && p.y + 2 > this.block.bottom) {
                this.vy = -1; p.y = this.block.bottom - 2;
                if (this.block.hit()) { const s = this.block.group.position.clone(); s.y += .8; this.effects.sparkle(s, 0xffe45c, 20); this.shardTotal++; localStorage.setItem(SHARD_KEY, String(this.shardTotal)); this.onSound("coin"); this.onCoin(this.shardTotal); }
                else this.onSound("bump");
            }
            if (p.y <= GROUND) {
                p.y = GROUND; this.grounded = true;
                const hard = this.vy < -12; this.vy = 0;
                if (this.pad && Math.hypot(p.x - this.pad.x, p.z - this.pad.z) < this.pad.radius && !this.dropIn) { this.pad.boing(); this.grounded = true; this.jump(13.5); }
                else { this.onSound("land"); this.effects.dust(p, hard ? 14 : 6); if (hard) { this.shake = .35; this.effects.ring(p, 0xffffff, 2.5); } this.dropIn = 0; }
            }
        } else if (this.pad && Math.hypot(p.x - this.pad.x, p.z - this.pad.z) < this.pad.radius && !this.blocked) { this.pad.boing(); this.jump(13.5); }
        for (const s of this.shards?.shards ?? []) if (s.m.visible && Math.hypot(p.x - s.m.position.x, p.y + 1 - s.m.position.y, p.z - s.m.position.z) < 1) this.collect(s);
        const nearestNpc = this.npcs.reduce((best, n) => { const d = n.mesh.position.distanceTo(p); return d < best.d ? { n, d } : best; }, { n: null, d: 1e9 });
        this.canTalk = nearestNpc.d < 3.6 || Math.hypot(p.x - LAYOUT.portal[0], p.z - LAYOUT.portal[1]) < 3.6;
        this.delights.update(t, dt);
        const party = this.delights.party > 0, dancing = this.delights.dance > 0;
        animateCharacter(this.player, t, { moving: this.grounded && speed > .6, airborne: !this.grounded, reduced: this.reduced, pose: this.delights.pose, dance: dancing || party });
        for (const n of this.npcs) {
            const d = n.mesh.position.distanceTo(p);
            const grooving = party || (dancing && d < 8);
            animateCharacter(n.mesh, t, { wave: !grooving && d < 4.2 && !this.decided.has(n.id), talkTo: d < 6 && !grooving ? p : null, reduced: this.reduced, seed: n.i * 2.3, dance: grooving });
            n.gem.position.y = GROUND + 3.05 + Math.sin(t * 2.5 + n.i) * .15; n.gem.rotation.y = t * 1.8;
            n.gem.scale.setScalar(this.decided.has(n.id) ? .8 : 1 + Math.sin(t * 5) * .08);
        }
        if (!this.reduced) this.updates.forEach((u) => u(t, dt));
        else { this.portal.update(t, dt); this.shards.update(0); }
        this.effects.update(dt);
        this.blob.position.set(p.x, GROUND + .03, p.z);
        const h = p.y - GROUND; this.blob.scale.setScalar(clamp(1 - h * .08, .45, 1)); this.blob.material.opacity = clamp(.3 - h * .02, .08, .3);
        const look = this.delights.look;
        const narrow = this.camera.aspect < 1.05, dist = (narrow ? 34 : 29) * this.zoom * (look ? .62 : 1);
        const want = look ?? new THREE.Vector3(p.x * .45, 1.2 + Math.max(0, h) * .3, p.z * .4 + (narrow ? 0 : .6));
        this.focus.lerp(want, Math.min(1, dt * 3));
        const cam = new THREE.Vector3(Math.sin(this.cameraAngle) * dist, dist * this.pitch, Math.cos(this.cameraAngle) * dist).add(this.focus);
        this.camera.position.lerp(cam, Math.min(1, dt * 5));
        if (this.shake > 0 && !this.reduced) { this.shake = Math.max(0, this.shake - dt); this.camera.position.x += (Math.random() - .5) * this.shake; this.camera.position.y += (Math.random() - .5) * this.shake; }
        this.camera.lookAt(this.focus);
        this.camera.updateMatrixWorld();
        const w = this.canvas.clientWidth, hh = this.canvas.clientHeight;
        for (const m of this.markers) {
            const q = m.point.clone(); q.y = m.kind === "portal" ? 4.6 : 3.9; q.project(this.camera);
            m.element.style.left = `${(q.x * .5 + .5) * w}px`; m.element.style.top = `${(-q.y * .5 + .5) * hh}px`;
            m.element.style.visibility = q.z < 1 && Math.abs(q.x) < 1.1 && Math.abs(q.y) < 1.1 ? "visible" : "hidden";
            m.element.classList.toggle("near", m.kind === "npc" ? m.point.distanceTo(p) < 3.6 : Math.hypot(p.x - LAYOUT.portal[0], p.z - LAYOUT.portal[1]) < 3.6);
        }
        this.updatePrompt(w, hh);
        this.renderer.render(this.scene, this.camera);
    }
    updatePrompt(w, h) {
        if (!this.promptEl) return;
        const label = this.blocked ? null : this.delights.activity ? this.delights.hint() : this.interactable()?.label ?? null;
        if (label !== this.promptLabel) {
            this.promptLabel = label; this.promptEl.hidden = !label;
            if (label) { this.promptEl.querySelector("span").textContent = label; this.promptEl.classList.toggle("urgent", /REEL|Golden|fire!/.test(label)); }
        }
        if (!label) return;
        const q = this.player.position.clone(); q.y += 3.1; q.project(this.camera);
        this.promptEl.style.left = `${(q.x * .5 + .5) * w}px`; this.promptEl.style.top = `${(-q.y * .5 + .5) * h}px`;
    }
}
