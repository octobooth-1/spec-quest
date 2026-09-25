import { THREE, GROUND, rng } from "./toon.js";

export function buildParticles(kit, scene, theme, seed) {
    const r = rng(seed + 5), n = theme.particleKind === "snow" ? 360 : 160;
    const pos = new Float32Array(n * 3), meta = [];
    for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 16;
        meta.push({ x: Math.cos(a) * d, y: r() * 12 - 1, z: Math.sin(a) * d, p: r() * 10, s: .4 + r() });
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const size = { pollen: .22, fireflies: .34, embers: .22, snow: .26 }[theme.particleKind];
    const mat = new THREE.PointsMaterial({ color: theme.particle, size, map: kit.dot, transparent: true, depthWrite: false, blending: theme.particleKind === "snow" ? THREE.NormalBlending : THREE.AdditiveBlending });
    const points = new THREE.Points(g, mat); points.frustumCulled = false; scene.add(points);
    return {
        update(t, dt) {
            const kind = theme.particleKind;
            for (let i = 0; i < n; i++) {
                const m = meta[i];
                if (kind === "snow") { m.y -= dt * m.s * 1.1; if (m.y < -2) m.y = 12; }
                else if (kind === "embers") { m.y += dt * m.s * 1.3; if (m.y > 12) m.y = -1; }
                else m.y += Math.sin(t * .6 + m.p) * dt * .25;
                pos[i * 3] = m.x + Math.sin(t * .5 * m.s + m.p) * (kind === "fireflies" ? 1.2 : .6);
                pos[i * 3 + 1] = kind === "pollen" || kind === "fireflies" ? GROUND + .5 + (m.y + 1) / 13 * 5 : m.y;
                pos[i * 3 + 2] = m.z + Math.cos(t * .4 * m.s + m.p) * .6;
            }
            g.attributes.position.needsUpdate = true;
            mat.opacity = kind === "fireflies" ? .65 + Math.sin(t * 3) * .35 : .9;
        },
    };
}

export function buildCritters(kit, root, theme, flowers, seed) {
    const r = rng(seed + 17), list = [];
    const kind = theme.critter;
    const count = kind === "bird" ? 5 : 6;
    for (let i = 0; i < count; i++) {
        const g = new THREE.Group(); root.add(g);
        const wings = [];
        if (kind === "bird") {
            kit.ball(g, 0xffffff, 0, 0, 0, .16, 1).scale.set(.8, .7, 1.4);
            kit.cone(g, 0xffb13d, 0, 0, .24, .05, .14, 4).rotation.x = Math.PI / 2;
            for (const s of [-1, 1]) {
                const w = kit.group(g, s * .08, .03, 0);
                kit.box(w, 0xffffff, s * .22, 0, 0, .42, .03, .2);
                wings.push([w, s]);
            }
        } else {
            const colors = kind === "moth" ? [0xd9ff7a, 0x8affea, 0xffb3f0] : [0xff7aa8, 0xffd23f, 0x7ac7ff, 0xb48cff];
            const c = colors[i % colors.length];
            kit.cyl(g, 0x3b2c47, 0, 0, 0, .025, .025, .22, 5).rotation.x = Math.PI / 2;
            for (const s of [-1, 1]) {
                const w = kit.group(g, 0, 0, 0);
                const wing = kit.mesh(new THREE.CircleGeometry(.16, 10), kit.basic(c, { side: THREE.DoubleSide }), w, s * .15, 0, .03);
                wing.rotation.x = -Math.PI / 2; wing.scale.set(1, 1.3, 1);
                kit.mesh(new THREE.CircleGeometry(.1, 8), kit.basic(c, { side: THREE.DoubleSide }), w, s * .12, 0, -.12).rotation.x = -Math.PI / 2;
                wings.push([w, s]);
            }
        }
        g.traverse((m) => { m.castShadow = false; });
        const home = flowers[Math.floor(r() * flowers.length)]?.position ?? new THREE.Vector3();
        list.push({ g, wings, home: home.clone(), p: r() * 10, rad: kind === "bird" ? 7 + r() * 5 : .8 + r() * 1.2, h: kind === "bird" ? 7 + r() * 4 : 1 + r() * .8 });
    }
    return {
        update(t) {
            for (const c of list) {
                const a = t * (kind === "bird" ? .35 : .8) + c.p;
                const cx = kind === "bird" ? 0 : c.home.x, cz = kind === "bird" ? 0 : c.home.z;
                c.g.position.set(cx + Math.cos(a) * c.rad, c.h + Math.sin(t * 2 + c.p) * .3, cz + Math.sin(a * (kind === "bird" ? 1 : 1.3)) * c.rad);
                c.g.rotation.y = -a + (kind === "bird" ? Math.PI : Math.PI / 2);
                const flap = Math.sin(t * (kind === "bird" ? 9 : 22) + c.p);
                for (const [w, s] of c.wings) w.rotation.z = s * flap * (kind === "bird" ? .5 : 1);
            }
        },
    };
}

export const SHARD_SPOTS = [[-3.4, 7.2, 0], [5.6, .8, 0], [-8.6, 1.4, 0], [1.4, -5.6, 0], [9.6, 1.6, 0], [-2.2, -2.6, 0], [4.7, 6.5, 3.4], [-4.6, -8.2, 0]];

export function buildShards(kit, root, collected) {
    const geo = kit.star(.34, .15, .12), mat = kit.toon(0xffd84a, { emissive: 0x8a5a00, emissiveIntensity: .6 });
    const shards = SHARD_SPOTS.map(([x, z, h], i) => {
        const m = kit.mesh(geo, mat, root, x, GROUND + .95 + h, z, .03);
        m.visible = !collected.has(i);
        const glow = kit.ball(m, kit.basic(0xfff3a8, { transparent: true, opacity: .25, depthWrite: false }), 0, 0, 0, .5, 1);
        glow.castShadow = false;
        return { m, i, base: GROUND + .95 + h };
    });
    return {
        shards,
        update(t) { for (const s of shards) if (s.m.visible) { s.m.rotation.y = t * 2.4 + s.i; s.m.position.y = s.base + Math.sin(t * 3 + s.i) * .12; } },
    };
}

export class Effects {
    constructor(kit, scene) { this.kit = kit; this.scene = scene; this.items = []; this.puffGeo = new THREE.IcosahedronGeometry(.18, 0); this.bitGeo = new THREE.PlaneGeometry(.16, .1); }
    burst(pos, { count = 40, colors = [0xff5d7d, 0xffd23f, 0x5fd0ff, 0x7be36a, 0xb48cff], speed = 6, up = 7, life = 1.6, size = 1 } = {}) {
        for (let i = 0; i < count; i++) {
            const m = new THREE.Mesh(this.bitGeo, new THREE.MeshBasicMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide, transparent: true }));
            m.position.copy(pos); m.scale.setScalar(size); this.scene.add(m);
            const a = Math.random() * Math.PI * 2, s = speed * (.4 + Math.random() * .6);
            this.items.push({ m, v: new THREE.Vector3(Math.cos(a) * s, up * (.5 + Math.random() * .7), Math.sin(a) * s), life, max: life, spin: new THREE.Vector3(Math.random() * 9, Math.random() * 9, 0), g: 11, drag: 1.6 });
        }
    }
    sparkle(pos, color = 0xfff3a8, count = 14) {
        for (let i = 0; i < count; i++) {
            const m = new THREE.Mesh(this.puffGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
            m.position.copy(pos); this.scene.add(m);
            const a = i / count * Math.PI * 2;
            this.items.push({ m, v: new THREE.Vector3(Math.cos(a) * 3, 2 + Math.random() * 2, Math.sin(a) * 3), life: .7, max: .7, g: 3, drag: 3, shrink: true });
        }
    }
    dust(pos, count = 6) {
        for (let i = 0; i < count; i++) {
            const m = new THREE.Mesh(this.puffGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .85 }));
            m.position.copy(pos); m.position.y += .1; this.scene.add(m);
            const a = Math.random() * Math.PI * 2;
            this.items.push({ m, v: new THREE.Vector3(Math.cos(a) * 1.4, .6 + Math.random() * .6, Math.sin(a) * 1.4), life: .55, max: .55, g: 0, drag: 4, grow: true });
        }
    }
    note(pos, color = 0xffffff, glyph = "♪") {
        this.glyphs ??= new Map();
        if (!this.glyphs.has(glyph)) this.glyphs.set(glyph, this.kit.canvasTexture(64, (g, s) => {
            g.font = `900 ${s * .8}px ui-rounded, system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
            g.lineWidth = 7; g.strokeStyle = "#3b2c47"; g.strokeText(glyph, s / 2, s / 2 + 2); g.fillStyle = "#fff"; g.fillText(glyph, s / 2, s / 2 + 2);
        }));
        const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glyphs.get(glyph), color, transparent: true, depthWrite: false }));
        m.position.copy(pos); m.scale.setScalar(.55); this.scene.add(m);
        this.items.push({ m, v: new THREE.Vector3((Math.random() - .5) * .8, 1.7, (Math.random() - .5) * .8), life: 1.3, max: 1.3, g: 0, drag: .4, sway: Math.random() * 6 });
    }
    ring(pos, color = 0xffffff, radius = 3) {
        const m = new THREE.Mesh(new THREE.RingGeometry(.8, 1, 40), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
        m.rotation.x = -Math.PI / 2; m.position.copy(pos); m.position.y += .12; this.scene.add(m);
        this.items.push({ m, v: new THREE.Vector3(), life: .8, max: .8, g: 0, drag: 0, ring: radius });
    }
    update(dt) {
        this.items = this.items.filter((p) => {
            p.life -= dt;
            if (p.life <= 0) { this.scene.remove(p.m); p.m.material.dispose(); if (p.ring) p.m.geometry.dispose(); return false; }
            const k = p.life / p.max;
            p.v.y -= p.g * dt; p.v.multiplyScalar(Math.max(0, 1 - p.drag * dt));
            p.m.position.addScaledVector(p.v, dt);
            if (p.spin) { p.m.rotation.x += p.spin.x * dt; p.m.rotation.y += p.spin.y * dt; }
            if (p.shrink) p.m.scale.setScalar(k);
            if (p.grow) p.m.scale.setScalar(1 + (1 - k) * 2.5);
            if (p.ring) p.m.scale.setScalar(.2 + (1 - k) * p.ring);
            if (p.sway !== undefined) { p.m.position.x += Math.sin(p.life * 7 + p.sway) * dt * .6; p.m.material.rotation = Math.sin(p.life * 5 + p.sway) * .3; p.m.scale.setScalar(.35 + Math.min(1, (1 - k) * 5) * .25); }
            p.m.material.opacity = Math.min(1, k * 1.6) * (p.grow ? .85 : 1);
            return true;
        });
    }
    clear() { for (const p of this.items) this.scene.remove(p.m); this.items = []; }
}
