import { THREE, GROUND, RADIUS } from "./toon.js";
import { LAYOUT } from "./scenery.js";

const STORE = "spec-quest-treasures";
const Y = new THREE.Vector3(0, 1, 0);
const blank = () => ({ fish: {}, roasts: 0, golden: 0, melodies: 0, kicks: 0 });
const load = () => { try { return { ...blank(), ...JSON.parse(localStorage.getItem(STORE) || "{}") }; } catch { return blank(); } };

export const FISH = [
    { name: "Bug Bass", color: 0x6fa8ff, rarity: "Common", w: 40, size: [12, 34] },
    { name: "Merge Minnow", color: 0xffb347, rarity: "Common", w: 40, size: [6, 18] },
    { name: "Backlog Pike", color: 0x7ccf6a, rarity: "Common", w: 32, size: [20, 44] },
    { name: "Spec Salmon", color: 0xff7a8a, rarity: "Uncommon", w: 18, size: [30, 60] },
    { name: "Refactor Ray", color: 0xa27dff, rarity: "Uncommon", w: 15, size: [25, 55] },
    { name: "Golden Roadmap Koi", color: 0xffd23f, rarity: "Rare", w: 6, size: [40, 80], shards: 1 },
    { name: "Scope-Creep Eel", color: 0x33e0c4, rarity: "Legendary", w: 1.6, size: [90, 170], shards: 3 },
];
const LOCAL_FISH = {
    meadow: { name: "Clover Carp", color: 0x8bd94f }, grove: { name: "Moonlit Guppy", color: 0xff8fd0 },
    forge: { name: "Magma Mackerel", color: 0xff5a2a }, summit: { name: "Frost Flounder", color: 0xbfe6ff },
};
export const STONES = [[-1.9, 8.25], [-.85, 8.65], [.2, 8.8], [1.25, 8.65], [2.3, 8.25]];
const STONE_COLORS = [0xff5d7d, 0xffa13d, 0xffd23f, 0x5fd068, 0x3ab0ff];
const BALL_HOME = [2.9, 4.3], BALL_R = .42;
const MALLOW = [[0, 0xfff8ee], [.35, 0xffd27a], [.55, 0xe0913a], [.8, 0x8a4a22], [1, 0x2b2033]];

function mallowColor(k, out) {
    for (let i = 1; i < MALLOW.length; i++) {
        const [a, ca] = MALLOW[i - 1], [b, cb] = MALLOW[i];
        if (k <= b || i === MALLOW.length - 1) return out.set(ca).lerp(new THREE.Color(cb), THREE.MathUtils.clamp((k - a) / (b - a), 0, 1));
    }
    return out;
}

function buildFish(kit, color) {
    const g = new THREE.Group();
    kit.ball(g, color, 0, 0, 0, .26, 2, .03).scale.set(.7, .9, 1.5);
    const tail = kit.cone(g, color, 0, 0, -.5, .24, .3, 4, .03); tail.rotation.x = Math.PI / 2; tail.scale.x = .3;
    const fin = kit.cone(g, color, 0, .24, -.02, .14, .22, 4); fin.scale.x = .3; fin.rotation.x = -.5;
    for (const s of [-1, 1]) { const eye = kit.ball(g, kit.basic(0xffffff), s * .16, .07, .22, .065, 1); kit.ball(eye, kit.basic(0x2b2033), s * .015, 0, .04, .035, 1); }
    kit.ball(g, kit.basic(0xff8fa3), 0, -.07, .36, .045, 1);
    return g;
}

export class Delights {
    constructor(world) {
        this.w = world; const kit = this.kit = world.kit;
        this.treasures = load(); this.activity = null; this.dance = 0; this.party = 0; this.rewarded = new Set(); this.hinted = false;
        this.melody = []; this.lastStone = null; this.kickCooldown = 0; this.color = new THREE.Color();
        const arm = world.player.userData.arms[1];
        this.stick = kit.group(arm, 0, -.47, .04); this.stick.quaternion.setFromUnitVectors(Y, new THREE.Vector3(0, -.95, .3).normalize());
        kit.cyl(this.stick, 0x9a6a3f, 0, .5, 0, .018, .024, 1, 5);
        this.mallowMat = new THREE.MeshToonMaterial({ color: 0xfff8ee, gradientMap: kit.tones });
        this.mallow = kit.mesh(new THREE.CylinderGeometry(.1, .1, .2, 12), this.mallowMat, this.stick, 0, 1.02, 0, .02);
        this.mallowFlame = kit.cone(this.mallow, kit.basic(0xff7a2a), 0, .2, 0, .09, .28, 6); this.mallowFlame.visible = false;
        this.stick.visible = false;
        this.rod = kit.group(arm, 0, -.47, .04); this.rod.quaternion.setFromUnitVectors(Y, new THREE.Vector3(0, -.5, .87).normalize());
        kit.cyl(this.rod, 0x5b3a26, 0, .9, 0, .016, .035, 1.8, 6);
        kit.cyl(this.rod, 0xff5d7d, 0, .28, .06, .07, .07, .06, 10).rotation.x = Math.PI / 2;
        this.rodTip = new THREE.Vector3(0, 1.8, 0); this.rod.visible = false;
        this.bobber = new THREE.Group(); world.scene.add(this.bobber);
        kit.ball(this.bobber, 0xffffff, 0, 0, 0, .1, 2, .02); kit.ball(this.bobber, 0xff4d6d, 0, .07, 0, .075, 2);
        this.bobber.visible = false;
        this.linePos = new Float32Array(18 * 3);
        const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.BufferAttribute(this.linePos, 3));
        this.line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .85 }));
        this.line.frustumCulled = false; this.line.visible = false; world.scene.add(this.line);
    }
    save() { try { localStorage.setItem(STORE, JSON.stringify(this.treasures)); } catch { /* storage may be blocked in embedded views */ } }
    sound(name) { this.w.onSound(name); }
    emit(kind, data = {}) { this.w.onDelight(kind, data); }
    reserved() { return [...STONES.map(([x, z]) => [x, z, .8]), [BALL_HOME[0], BALL_HOME[1], 1.2]]; }

    build(root, themeName, theme, camp, areaKey) {
        this.cancel(); this.dance = 0; this.party = 0; this.melody = [];
        Object.assign(this, { themeName, theme, camp, areaKey });
        const kit = this.kit;
        this.stones = STONES.map(([x, z], i) => {
            const g = kit.group(root, x, GROUND, z);
            kit.cyl(g, theme.rock, 0, .05, 0, .5, .55, .1, 18).castShadow = false;
            const mat = new THREE.MeshToonMaterial({ color: STONE_COLORS[i], gradientMap: kit.tones, emissive: STONE_COLORS[i], emissiveIntensity: 0 });
            const top = kit.mesh(new THREE.CylinderGeometry(.42, .44, .12, 18), mat, g, 0, .15, 0, .03); top.castShadow = false;
            for (let k = 0; k <= i; k++) {
                const a = k / (i + 1) * Math.PI * 2, rr = i ? .2 : 0;
                kit.ball(top, kit.basic(0xffffff), Math.cos(a) * rr, .07, Math.sin(a) * rr, .055, 1);
            }
            return { g, top, mat, x, z, i, glow: 0 };
        });
        const tex = kit.canvasTexture(256, (g, s) => {
            const cols = ["#ff5d7d", "#ffffff", "#ffd23f", "#ffffff", "#3ab0ff", "#ffffff"];
            cols.forEach((c, i) => { g.fillStyle = c; g.fillRect(i * s / 6, 0, s / 6 + 1, s); });
            g.fillStyle = "#ffffff"; g.fillRect(0, 0, s, s * .1); g.fillRect(0, s * .9, s, s * .1);
        });
        const holder = kit.group(root, BALL_HOME[0], GROUND + BALL_R, BALL_HOME[1]);
        const mesh = kit.mesh(new THREE.SphereGeometry(BALL_R, 24, 16), new THREE.MeshToonMaterial({ map: tex, gradientMap: kit.tones }), holder, 0, 0, 0, .03);
        this.ball = { holder, mesh, pos: holder.position, vel: new THREE.Vector3(), squash: 0 };
    }

    candidates(p) {
        if (!this.w.grounded || !this.camp) return [];
        const list = [], f = this.camp.fire;
        list.push({ d: Math.hypot(p.x - f.x, p.z - f.z) / 2.3, label: "Sit by the fire", run: () => this.sit() });
        list.push({ d: Math.hypot(p.x - LAYOUT.pond[0], p.z - LAYOUT.pond[1]) / 3.4, label: this.themeName === "forge" ? "Fish in the lava?!" : "Go fishing", run: () => this.fish() });
        return list;
    }
    hint() {
        const a = this.activity; if (!a) return null;
        if (a.kind === "sit") {
            if (a.t < .6) return "Settling in…";
            if (!this.mallow.visible) return "Mmm…";
            return a.roast < .3 ? "Roasting… eat" : a.roast < .55 ? "✨ Golden! Eat now" : a.roast < .85 ? "Toasty… eat" : "🔥 It's on fire! Eat";
        }
        return { cast: "Casting…", wait: "Waiting for a bite… (reel in)", bite: "❗ REEL IT IN!", catch: "Wow!", idle: "Cast again" }[a.phase];
    }
    get pose() {
        const a = this.activity;
        if (!a) return null;
        if (a.kind === "sit") return "sit";
        return a.phase === "catch" && a.t > .7 ? "cheer" : a.phase === "bite" ? "bite" : "fish";
    }
    get look() {
        const a = this.activity; if (!a) return null;
        const p = this.w.player.position, o = a.kind === "sit" ? this.camp.fire : { x: LAYOUT.pond[0], z: LAYOUT.pond[1] };
        return new THREE.Vector3((p.x + o.x) / 2, 1, (p.z + o.z) / 2);
    }

    sit() {
        const p = this.w.player.position, f = this.camp.fire;
        const seat = this.camp.seats.reduce((b, s) => Math.hypot(p.x - s.x, p.z - s.z) < Math.hypot(p.x - b.x, p.z - b.z) ? s : b);
        this.activity = { kind: "sit", t: 0, roast: 0, anchor: new THREE.Vector3(seat.x, GROUND, seat.z), face: Math.atan2(f.x - seat.x, f.z - seat.z) };
        this.stick.visible = true; this.mallow.visible = true; this.setRoast(0);
        this.w.target = null; this.w.vel.set(0, 0, 0); this.dance = 0;
        this.sound("sit"); this.emit("sit");
    }
    setRoast(k) { mallowColor(k, this.mallowMat.color); this.mallowFlame.visible = k > .85; this.mallow.scale.setScalar(1 + Math.min(k, .6) * .35); }
    eat() {
        const a = this.activity, k = a.roast;
        const r = k < .3 ? { icon: "☁️", title: "Gooey & pale", detail: "Still marshmallow-white. Patience is a virtue!" }
            : k < .55 ? { icon: "✨", title: "Golden perfection!", detail: "Crispy outside, molten inside. Chef's kiss.", golden: true }
                : k < .85 ? { icon: "🍂", title: "Toasty brown", detail: "A little smoky, still delicious." }
                    : { icon: "🔥", title: "Charcoal crunch!", detail: "It was on fire. You ate it anyway. Brave." };
        this.treasures.roasts++;
        const head = this.w.player.position.clone(); head.y += 2;
        if (r.golden) {
            this.treasures.golden++;
            if (!this.rewarded.has(`roast:${this.areaKey}`)) { this.rewarded.add(`roast:${this.areaKey}`); this.w.addShards(1); r.shards = 1; }
            this.w.effects.sparkle(head, 0xffd27a, 18);
        } else if (k >= .85) this.w.effects.dust(head, 10);
        this.save(); this.sound(r.golden ? "coin" : "munch"); this.emit("roast", r);
        this.mallow.visible = false; a.roast = 0; a.refill = .7;
    }

    fish() {
        const p = this.w.player.position, [px, pz] = LAYOUT.pond;
        const dir = new THREE.Vector3(px - p.x, 0, pz - p.z).normalize();
        this.activity = { kind: "fish", phase: "idle", t: 0, anchor: p.clone().setY(GROUND), face: Math.atan2(dir.x, dir.z), dir };
        this.rod.visible = true; this.w.target = null; this.w.vel.set(0, 0, 0); this.dance = 0;
        this.cast();
    }
    tip() { this.w.player.updateMatrixWorld(true); return this.rod.localToWorld(this.rodTip.clone()); }
    cast() {
        const a = this.activity, [px, pz] = LAYOUT.pond, j = () => (Math.random() - .5) * .8;
        Object.assign(a, { phase: "cast", t: 0, from: this.tip(), spot: new THREE.Vector3(px - a.dir.x * .9 + j(), GROUND + .08, pz - a.dir.z * .9 + j()) });
        this.bobber.visible = true; this.line.visible = true; this.sound("cast");
    }
    reelEmpty(kind) {
        const a = this.activity; a.phase = "idle"; a.t = 0;
        this.bobber.visible = false; this.line.visible = false;
        this.sound("miss"); this.emit(kind);
    }
    pickFish() {
        const local = { ...LOCAL_FISH[this.themeName] ?? LOCAL_FISH.meadow, rarity: "Uncommon", w: 20, size: [18, 48], local: true };
        const pool = [...FISH, local], total = pool.reduce((s, f) => s + f.w, 0);
        let roll = Math.random() * total;
        return pool.find((f) => (roll -= f.w) < 0) ?? pool[0];
    }
    land() {
        const a = this.activity, f = this.pickFish();
        const size = Math.round(f.size[0] + Math.random() * (f.size[1] - f.size[0]));
        const entry = this.treasures.fish[f.name] ?? { count: 0, best: 0, rarity: f.rarity };
        const isNew = entry.count === 0;
        entry.count++; entry.best = Math.max(entry.best, size); entry.rarity = f.rarity;
        this.treasures.fish[f.name] = entry; this.save();
        const mesh = buildFish(this.kit, f.color); mesh.scale.setScalar(.8 + Math.min(1, size / 120) * .6);
        mesh.position.copy(a.spot); this.w.scene.add(mesh);
        Object.assign(a, { phase: "catch", t: 0, fishMesh: mesh, catchInfo: { ...f, size, isNew, count: entry.count, best: entry.best } });
        this.bobber.visible = false;
        this.w.effects.burst(a.spot.clone().setY(GROUND + .3), { count: 18, colors: [this.theme.foam, this.theme.water, 0xffffff], speed: 2.4, up: 6, size: .8 });
        this.w.effects.ring(a.spot, this.theme.foam, 1.8);
        this.sound("splash");
    }

    press() {
        const a = this.activity; if (!a) return;
        if (a.kind === "sit") { if (a.t >= .6 && this.mallow.visible) this.eat(); return; }
        if (a.phase === "idle") this.cast();
        else if (a.phase === "bite") this.land();
        else if (a.phase === "wait") this.reelEmpty("early");
    }
    cancel() {
        const a = this.activity; if (!a) return;
        if (a.fishMesh) { this.w.scene.remove(a.fishMesh); this.w.dispose(a.fishMesh); }
        this.activity = null;
        this.stick.visible = false; this.rod.visible = false; this.bobber.visible = false; this.line.visible = false;
    }
    startDance() {
        if (this.activity) this.cancel();
        if (!this.w.grounded) return;
        this.dance = 2.6; this.noteT = 0; this.sound("dance");
    }

    update(t, dt) {
        const w = this.w, p = w.player.position;
        this.kickCooldown -= dt;
        if (this.dance > 0) {
            this.dance -= dt; this.noteT -= dt;
            if (this.noteT <= 0) { this.noteT = .28; const q = p.clone(); q.y += 2.3; w.effects.note(q, STONE_COLORS[Math.floor(Math.random() * 5)]); }
        }
        if (this.party > 0) this.party -= dt;
        const a = this.activity;
        if (a) {
            p.lerp(a.anchor, Math.min(1, dt * 10));
            let d = a.face - w.player.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); w.player.rotation.y += d * Math.min(1, dt * 10);
            a.t += dt;
            if (a.kind === "sit") this.updateSit(a, t, dt);
            else this.updateFish(a, t, dt);
        }
        this.updateStones(dt);
        this.updateBall(dt);
    }
    updateSit(a, t, dt) {
        if (a.refill > 0) { a.refill -= dt; if (a.refill <= 0) { this.mallow.visible = true; this.mallow.scale.setScalar(.2); } return; }
        if (a.t > .6 && this.mallow.visible) { a.roast = Math.min(1, a.roast + dt * .16); this.setRoast(a.roast); }
        if (Math.random() < dt * 1.5) { const f = this.camp.fire; this.w.effects.note(new THREE.Vector3(f.x + (Math.random() - .5) * .4, GROUND + 1.2, f.z), 0xffb347, "✦"); }
    }
    updateFish(a, t, dt) {
        const tip = this.tip();
        let end = null, sag = .35;
        if (a.phase === "cast") {
            const k = Math.min(1, a.t / .7);
            this.bobber.position.lerpVectors(a.from, a.spot, k); this.bobber.position.y += Math.sin(k * Math.PI) * 1.4;
            if (k >= 1) {
                Object.assign(a, { phase: "wait", t: 0, wait: 1.8 + Math.random() * 3.4, nibble: Math.random() < .6 ? .6 + Math.random() * 1 : -1 });
                this.w.effects.ring(a.spot, this.theme.foam, 1); this.sound("plop");
            }
            end = this.bobber.position; sag = .1;
        } else if (a.phase === "wait") {
            let y = a.spot.y + Math.sin(t * 3) * .025;
            if (a.nibble > 0 && a.t > a.nibble && a.t < a.nibble + .25) { y -= .07; if (!a.nibbled) { a.nibbled = true; this.sound("tick"); this.w.effects.ring(a.spot, this.theme.foam, .6); } }
            this.bobber.position.set(a.spot.x, y, a.spot.z);
            if (a.t > a.wait) { a.phase = "bite"; a.t = 0; this.sound("bite"); this.w.effects.ring(a.spot, 0xffffff, 1.4); }
            end = this.bobber.position;
        } else if (a.phase === "bite") {
            this.bobber.position.set(a.spot.x + Math.sin(t * 40) * .04, a.spot.y - .12 + Math.sin(t * 25) * .04, a.spot.z);
            end = this.bobber.position; sag = 0;
            if (a.t > 1) this.reelEmpty("miss");
        } else if (a.phase === "catch") {
            const m = a.fishMesh, head = this.w.player.position.clone(); head.y += 2.6;
            if (a.t < .7) {
                const k = a.t / .7; m.position.lerpVectors(a.spot, head, k); m.position.y += Math.sin(k * Math.PI) * 1.6; m.rotation.x = k * Math.PI * 2;
                end = m.position; sag = 0;
            } else {
                if (!a.revealed) { a.revealed = true; this.line.visible = false; this.sound("catch"); this.w.effects.sparkle(head, 0xfff3a8, 16); if (a.catchInfo.shards) this.w.addShards(a.catchInfo.shards); this.emit("catch", a.catchInfo); }
                m.position.copy(head); m.position.y += Math.sin(t * 6) * .06; m.rotation.x = 0; m.rotation.y += dt * 3; m.rotation.z = Math.sin(t * 9) * .25;
                if (a.t > 2.1) { this.w.scene.remove(m); this.w.dispose(m); a.fishMesh = null; a.phase = "idle"; a.t = 0; }
            }
        }
        if (end && this.line.visible) {
            const n = 18, dist = tip.distanceTo(end);
            for (let i = 0; i < n; i++) {
                const k = i / (n - 1);
                this.linePos[i * 3] = tip.x + (end.x - tip.x) * k;
                this.linePos[i * 3 + 1] = tip.y + (end.y - tip.y) * k - Math.sin(k * Math.PI) * sag * Math.min(1.5, dist * .25);
                this.linePos[i * 3 + 2] = tip.z + (end.z - tip.z) * k;
            }
            this.line.geometry.attributes.position.needsUpdate = true;
        }
    }
    updateStones(dt) {
        const w = this.w, p = w.player.position;
        let cur = null;
        if (w.grounded) for (const s of this.stones) if (Math.hypot(p.x - s.x, p.z - s.z) < .55) cur = s.i;
        if (cur !== null && cur !== this.lastStone) this.ring(cur);
        this.lastStone = cur;
        for (const s of this.stones) {
            s.glow = Math.max(0, s.glow - dt * 2.2);
            s.mat.emissiveIntensity = s.glow * .7;
            s.top.scale.y = 1 - Math.sin(s.glow * Math.PI) * .45 * s.glow;
            s.top.position.y = .15 + s.glow * .05;
        }
    }
    ring(i) {
        const s = this.stones[i], w = this.w;
        s.glow = 1; this.sound(`note:${i}`);
        w.effects.note(new THREE.Vector3(s.x, GROUND + 1.1, s.z), STONE_COLORS[i]);
        if (!this.hinted) { this.hinted = true; this.emit("stones"); }
        this.melody.push(i); if (this.melody.length > 5) this.melody.shift();
        if (this.melody.join() === "0,1,2,3,4") {
            this.melody = [];
            this.treasures.melodies++; this.save();
            const reward = !this.rewarded.has(`melody:${this.areaKey}`);
            if (reward) { this.rewarded.add(`melody:${this.areaKey}`); w.addShards(1); }
            setTimeout(() => {
                this.sound("melody"); this.party = 3.2;
                w.effects.burst(new THREE.Vector3(.2, GROUND + 1.5, 8.6), { count: 60, colors: STONE_COLORS, up: 9 });
                this.stones.forEach((st, k) => setTimeout(() => { st.glow = 1; w.effects.note(new THREE.Vector3(st.x, GROUND + 1.3, st.z), STONE_COLORS[k]); }, k * 90));
                this.emit("melody", { shards: reward ? 1 : 0 });
            }, 260);
        }
    }
    updateBall(dt) {
        const b = this.ball, w = this.w, P = w.player.position, r = BALL_R;
        if (!b) return;
        b.vel.y -= 22 * dt; b.pos.addScaledVector(b.vel, dt);
        const floor = GROUND + r;
        if (b.pos.y <= floor) {
            b.pos.y = floor;
            if (b.vel.y < -1.6) { b.vel.y *= -.55; b.squash = Math.min(1, -b.vel.y * .12); } else b.vel.y = 0;
            const f = Math.max(0, 1 - dt * 1.2); b.vel.x *= f; b.vel.z *= f;
        }
        const bounce = (nx, nz, restitution) => { const vn = b.vel.x * nx + b.vel.z * nz; if (vn < 0) { b.vel.x -= (1 + restitution) * vn * nx; b.vel.z -= (1 + restitution) * vn * nz; } };
        for (const c of w.colliders) {
            const dx = b.pos.x - c.x, dz = b.pos.z - c.z, d = Math.hypot(dx, dz), min = c.r + r;
            if (d < min && d > 1e-4) { const nx = dx / d, nz = dz / d; b.pos.x = c.x + nx * min; b.pos.z = c.z + nz * min; bounce(nx, nz, .7); }
        }
        const R = Math.hypot(b.pos.x, b.pos.z), lim = RADIUS - .8;
        if (R > lim) { const nx = -b.pos.x / R, nz = -b.pos.z / R; b.pos.x = -nx * lim; b.pos.z = -nz * lim; bounce(nx, nz, .7); }
        const dx = b.pos.x - P.x, dz = b.pos.z - P.z, d = Math.hypot(dx, dz) || 1e-4, nx = dx / d, nz = dz / d;
        if (!w.grounded && w.vy < 0 && d < r + .35 && P.y > b.pos.y && P.y < b.pos.y + r + .45) {
            w.grounded = true; w.vy = 0; w.jump(11.5); b.vel.y = -3; b.squash = 1;
            b.vel.x += nx * 2; b.vel.z += nz * 2; this.kick();
        } else if (d < r + .5 && P.y < b.pos.y + r * .8) {
            b.pos.x = P.x + nx * (r + .5); b.pos.z = P.z + nz * (r + .5);
            const sp = Math.hypot(w.vel.x, w.vel.z), kick = 2.2 + sp * 1.25;
            if (b.vel.x * nx + b.vel.z * nz < kick) { b.vel.x = nx * kick + w.vel.x * .35; b.vel.z = nz * kick + w.vel.z * .35; if (b.pos.y <= floor + .05) b.vel.y = 2 + sp * .7; this.kick(); }
        }
        const hv = Math.hypot(b.vel.x, b.vel.z);
        if (hv > .01) b.mesh.rotateOnWorldAxis(new THREE.Vector3(b.vel.z, 0, -b.vel.x).normalize(), hv * dt / r);
        b.squash = Math.max(0, b.squash - dt * 4);
        b.holder.scale.set(1 + b.squash * .25, 1 - b.squash * .3, 1 + b.squash * .25);
    }
    kick() {
        if (this.kickCooldown > 0) return;
        this.kickCooldown = .3; this.sound("boop"); this.treasures.kicks++;
        if (this.treasures.kicks % 10 === 0) this.save();
    }
}
