import { THREE, GROUND, RADIUS, rng, css } from "./toon.js";

export const LAYOUT = {
    spawn: [-.3, 5.4], plaza: [0, .4], portal: [0, -8.3], pond: [7.3, -4.4], landmark: [-7.4, -4.6],
    camp: [-6.8, 6.6], pad: [4.7, 6.5], board: [2.1, 1.9], block: [-2.1, 3.3],
};

export function grassTexture(kit, theme) {
    const t = kit.canvasTexture(512, (g, s) => {
        const n = 12, c = s / n;
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g.fillStyle = css((x + y) % 2 ? theme.grassA : theme.grassB); g.fillRect(x * c, y * c, c, c); }
        const r = rng(7);
        g.strokeStyle = "rgba(255,255,255,.28)"; g.lineWidth = 3; g.lineCap = "round";
        for (let i = 0; i < 140; i++) {
            const x = r() * s, y = r() * s;
            g.beginPath(); g.moveTo(x - 4, y + 3); g.lineTo(x - 1, y - 4); g.moveTo(x + 1, y + 3); g.lineTo(x + 4, y - 3); g.stroke();
        }
    });
    t.anisotropy = 4; return t;
}

export function buildIsland(kit, root, theme, seed) {
    const r = rng(seed);
    const colliders = [], animated = [];
    const top = new THREE.Mesh(new THREE.CircleGeometry(RADIUS, 72), new THREE.MeshToonMaterial({ map: grassTexture(kit, theme), gradientMap: kit.tones }));
    top.rotation.x = -Math.PI / 2; top.position.y = GROUND; top.receiveShadow = true; top.name = "ground";
    root.add(top);
    kit.cyl(root, theme.edge, 0, GROUND - .31, 0, RADIUS, RADIUS - .05, .56, 72);
    for (let i = 0; i < 64; i++) {
        const a = i / 64 * Math.PI * 2;
        const bump = kit.ball(root, theme.edge, Math.cos(a) * (RADIUS - .02), GROUND - .5, Math.sin(a) * (RADIUS - .02), .42, 1);
        bump.scale.set(1, .85, 1); bump.castShadow = false;
    }
    const layers = [[RADIUS - .15, RADIUS - .9, 1.5, 0], [RADIUS - .9, RADIUS - 2.6, 1.9, 1], [RADIUS - 2.6, RADIUS - 5.5, 2.3, 2]];
    let y = GROUND - .56;
    for (const [a, b, h, ci] of layers) {
        const layer = kit.cyl(root, theme.dirt[ci], 0, y - h / 2, 0, a, b, h, 14);
        layer.rotation.y = r(); y -= h;
    }
    const under = kit.cone(root, theme.dirt[2], 0, y - 3, 0, RADIUS - 5.5, 6, 12);
    under.rotation.x = Math.PI;
    for (let i = 0; i < 18; i++) {
        const a = r() * Math.PI * 2, d = RADIUS - 1 - r() * 4, rock = kit.ball(root, theme.rock, Math.cos(a) * d, -2.2 - r() * 4, Math.sin(a) * d, .5 + r() * .7, 0);
        rock.rotation.set(r() * 3, r() * 3, r() * 3);
    }
    const hangColor = theme.landmark === "observatory" ? kit.toon(0xcff3ff, { transparent: true, opacity: .9 }) : theme.leaf[2];
    for (let i = 0; i < 26; i++) {
        const a = r() * Math.PI * 2, len = .8 + r() * 2.4;
        const vine = kit.cone(root, hangColor, Math.cos(a) * (RADIUS - .1), GROUND - .6 - len / 2, Math.sin(a) * (RADIUS - .1), .14, len, 6);
        vine.rotation.x = Math.PI;
        if (theme.landmark !== "observatory") kit.ball(vine, theme.flower[i % theme.flower.length], 0, len / 2 - .05, 0, .12, 1);
    }
    return { top, colliders, animated, r };
}

export function buildPaths(kit, root, theme, r) {
    const { spawn, plaza, portal } = LAYOUT;
    const stone = (x, z, s) => {
        const m = kit.cyl(root, theme.path, x, GROUND + .02, z, s, s * 1.05, .08, 9);
        m.rotation.y = r() * 3; m.scale.z = .75 + r() * .3; m.castShadow = false;
    };
    const line = (a, b, step = .95) => {
        const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.floor(d / step);
        for (let i = 1; i < n; i++) {
            const t = i / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, w = Math.sin(t * Math.PI * 2) * .25;
            stone(x + w, z, .34 + r() * .08);
        }
    };
    const plazaRing = kit.cyl(root, theme.path, plaza[0], GROUND + .01, plaza[1], 2.2, 2.25, .06, 40);
    plazaRing.castShadow = false;
    kit.cyl(root, theme.rock, plaza[0], GROUND + .03, plaza[1], 1.25, 1.3, .06, 36).castShadow = false;
    const emblem = kit.mesh(kit.star(.9, .42, .05), kit.toon(theme.accent), root, plaza[0], GROUND + .09, plaza[1]);
    emblem.rotation.x = -Math.PI / 2; emblem.castShadow = false;
    line(spawn, plaza); line(plaza, portal);
    return { stone, line };
}

export function buildWater(kit, root, theme) {
    const [px, pz] = LAYOUT.pond;
    const u = { c1: { value: new THREE.Color(theme.water) }, c2: { value: new THREE.Color(theme.waterDeep) }, foam: { value: new THREE.Color(theme.foam) } };
    const pond = new THREE.Mesh(new THREE.CircleGeometry(2, 40), kit.shader("pond", u));
    pond.rotation.x = -Math.PI / 2; pond.position.set(px, GROUND + .04, pz); root.add(pond);
    for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2;
        if (Math.abs(a - .15) < .3) continue;
        const rock = kit.ball(root, theme.rock, px + Math.cos(a) * 2.1, GROUND + .08, pz + Math.sin(a) * 2.1, .32 + (i % 3) * .07, 0, .03);
        rock.scale.y = .6;
    }
    const sx = px + 1.9, ex = RADIUS + .05, len = ex - sx;
    const stream = new THREE.Mesh(new THREE.PlaneGeometry(1, len), kit.shader("stream", { ...u, speed: { value: 1.2 } }));
    stream.rotation.set(-Math.PI / 2, 0, Math.PI / 2 - .12); stream.position.set(sx + len / 2, GROUND + .045, pz + .15 + len * .06);
    root.add(stream);
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 9, 1, 8), kit.shader("fall", u, { transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    fall.position.set(ex + .08, GROUND - 4.4, pz + .15 + len * .12); fall.rotation.y = -Math.PI / 2 + .12;
    root.add(fall);
    const splash = [];
    for (let i = 0; i < 6; i++) {
        const s = kit.ball(root, kit.basic(theme.foam, { transparent: true, opacity: .8 }), fall.position.x + .1, GROUND - 8.6, fall.position.z, .3, 1);
        splash.push(s);
    }
    if (theme.landmark !== "forge") {
        for (const [dx, dz] of [[-.7, .5], [.6, -.8]]) {
            const pad = kit.cyl(root, theme.leaf[0], px + dx, GROUND + .06, pz + dz, .38, .38, .03, 14);
            kit.ball(pad, theme.flower[0], .1, .08, 0, .1, 1);
        }
    }
    return {
        collider: { x: px, z: pz, r: 2.05 },
        update: (t) => splash.forEach((s, i) => {
            const k = (t * .9 + i / splash.length) % 1;
            s.position.y = GROUND - 8.8 + k * 1.2; s.scale.setScalar(.4 + k * 1.1); s.material.opacity = .8 * (1 - k);
        }),
    };
}

function roundTree(kit, g, theme, r) {
    kit.cyl(g, theme.trunk, 0, .75, 0, .16, .26, 1.5, 8, .04);
    const c = theme.leaf[Math.floor(r() * theme.leaf.length)];
    kit.ball(g, c, 0, 2.05, 0, 1.05, 2, .06);
    kit.ball(g, c, .6, 1.7, .25, .65, 2, .05);
    kit.ball(g, c, -.55, 1.8, -.2, .7, 2, .05);
    if (r() > .5) for (let i = 0; i < 3; i++) kit.ball(g, theme.accent, Math.cos(i * 2.1) * .95, 1.8 + i * .2, Math.sin(i * 2.1) * .95, .14, 1);
    return 2.9;
}
function mushroomTree(kit, g, theme, r) {
    kit.cyl(g, theme.trunk, 0, .8, 0, .22, .32, 1.6, 12, .04);
    const cap = kit.ball(g, theme.leaf[Math.floor(r() * 3)], 0, 1.75, 0, 1.1, 2, .06);
    cap.scale.y = .58;
    for (let i = 0; i < 6; i++) {
        const a = i * 1.05 + r(), spot = kit.ball(g, kit.toon(0xffffff), Math.cos(a) * .72, 1.95, Math.sin(a) * .72, .17, 1);
        spot.scale.y = .5;
    }
    const glow = kit.ball(g, kit.basic(theme.particle, { transparent: true, opacity: .25 }), 0, 1.3, 0, .5, 1);
    glow.scale.y = .3;
    return 2.3;
}
function palmTree(kit, g, theme, r) {
    const bend = (r() - .5) * .4;
    for (let i = 0; i < 6; i++) kit.cyl(g, theme.trunk, bend * i * .25, .3 + i * .45, 0, .15, .19, .44, 8, .03).rotation.z = -bend * .4;
    const top = kit.group(g, bend * 1.4, 2.85, 0);
    for (let i = 0; i < 6; i++) {
        const leaf = kit.cone(top, theme.leaf[i % 3], 0, 0, 0, .3, 1.7, 5, .03);
        leaf.geometry.translate(0, .85, 0); leaf.rotation.set(0, i * 1.05, 1.9); leaf.scale.z = .35;
    }
    kit.ball(top, 0x7a4a2a, .15, -.15, .1, .16, 1); kit.ball(top, 0x7a4a2a, -.12, -.18, -.1, .16, 1);
    return 3.2;
}
function pineTree(kit, g, theme, r) {
    kit.cyl(g, theme.trunk, 0, .45, 0, .14, .2, .9, 8, .04);
    for (let i = 0; i < 3; i++) {
        kit.cone(g, theme.leaf[i % 3], 0, 1.2 + i * .62, 0, 1.05 - i * .26, 1.15, 9, .05);
        const snow = kit.cone(g, 0xffffff, 0, 1.52 + i * .62, 0, .62 - i * .17, .5, 9);
        snow.castShadow = false;
    }
    return 3.2;
}

export function buildFlora(kit, root, theme, r, reserved) {
    const kinds = { round: roundTree, mushroom: mushroomTree, palm: palmTree, pine: pineTree };
    const make = kinds[theme.flora];
    const colliders = [];
    const free = (x, z, pad) => reserved.every(([rx, rz, rr]) => Math.hypot(x - rx, z - rz) > rr + pad);
    let placed = 0;
    for (let tries = 0; tries < 400 && placed < 22; tries++) {
        const a = r() * Math.PI * 2, d = 4 + r() * 7.3, x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (!free(x, z, 1.2)) continue;
        reserved.push([x, z, 1.1]);
        const g = kit.group(root, x, GROUND, z);
        const s = .75 + r() * .45; g.scale.setScalar(s); g.rotation.y = r() * 6;
        make(kit, g, theme, r);
        colliders.push({ x, z, r: .55 * s });
        placed++;
    }
    for (let i = 0; i < 26; i++) {
        const a = r() * Math.PI * 2, d = 2.5 + r() * 9, x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (!free(x, z, .4)) continue;
        const bush = kit.group(root, x, GROUND, z);
        const c = theme.leaf[i % 3];
        kit.ball(bush, c, 0, .25, 0, .42, 1, .04); kit.ball(bush, c, .38, .18, .05, .3, 1, .04); kit.ball(bush, c, -.36, .18, 0, .3, 1, .04);
        if (i % 3 === 0) kit.ball(bush, theme.accent, .1, .6, .2, .09, 1);
    }
    const flowers = [];
    for (let i = 0; i < 70; i++) {
        const a = r() * Math.PI * 2, d = 1.5 + r() * 10.2, x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (!free(x, z, .15)) continue;
        const f = kit.group(root, x, GROUND, z);
        kit.cyl(f, theme.leaf[0], 0, .16, 0, .02, .025, .32, 4).castShadow = false;
        const c = theme.flower[i % theme.flower.length];
        for (let p = 0; p < 5; p++) kit.ball(f, c, Math.cos(p * 1.26) * .09, .34, Math.sin(p * 1.26) * .09, .07, 0).castShadow = false;
        kit.ball(f, 0xffe066, 0, .36, 0, .055, 0);
        flowers.push(f);
    }
    return {
        colliders, flowers,
        update: (t) => {
                        flowers.forEach((f, i) => { f.rotation.z = Math.sin(t * 1.3 + i) * .06; });
        },
    };
}
