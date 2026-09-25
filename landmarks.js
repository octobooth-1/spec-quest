import { THREE, GROUND, rng } from "./toon.js";
import { LAYOUT } from "./scenery.js";

export function buildPortal(kit, root, theme) {
    const [x, z] = LAYOUT.portal;
    const g = kit.group(root, x, GROUND, z);
    kit.cyl(g, theme.rock, 0, .12, 0, 2.3, 2.5, .24, 20, .04);
    kit.cyl(g, theme.path, 0, .27, 0, 1.9, 2, .08, 20);
    const arch = new THREE.Group(); g.add(arch);
    for (let i = 0; i <= 10; i++) {
        const a = Math.PI * i / 10, block = kit.box(arch, i % 2 ? theme.rock : theme.path, Math.cos(a) * 1.72, 1.55 + Math.sin(a) * 1.72, 0, .62, .5, .7, .04);
        block.rotation.z = a;
        if (i < 1 || i > 9) block.scale.y = 1.2;
    }
    for (const side of [-1, 1]) kit.box(arch, theme.rock, side * 1.72, .8, 0, .66, 1.3, .74, .04);
    const key = kit.mesh(kit.star(.36, .17, .12), kit.toon(0xffd84a, { emissive: 0x6b4a00 }), arch, 0, 3.35, .32, .03);
    const u = { on: { value: 0 }, a: { value: new THREE.Color(0x6a5cff) }, b: { value: new THREE.Color(0x5ff0ff) } };
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.45, 48).translate(0, 1.55, 0), kit.shader("portal", u, { transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    disc.position.z = .02; g.add(disc);
    const bottom = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.55).translate(0, .78, 0), disc.material);
    bottom.position.z = .02; g.add(bottom);
    const beam = kit.cyl(g, kit.basic(0x9ef6ff, { transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 9, 0, 1.2, 1.8, 18, 24);
    beam.castShadow = false;
    const runes = kit.group(g, 0, 1.6, 0), runeMeshes = [];
    for (let i = 0; i < 6; i++) {
        const rune = kit.mesh(new THREE.OctahedronGeometry(.18, 0), kit.basic([0xff7ad0, 0xffe45c, 0x5ff0ff][i % 3]), runes, 0, 0, 0);
        runeMeshes.push(rune);
    }
    const light = new THREE.PointLight(0x7fe9ff, 0, 9, 1.6); light.position.set(0, 1.8, 1.2); g.add(light);
    for (let i = 0; i < 5; i++) kit.box(root, theme.trunk, x + (i % 2 ? .05 : -.05), GROUND + .05, z - 2.8 - i * .55, 1.6, .1, .42, .02).rotation.y = (i % 2 - .5) * .08;
    let on = 0;
    return {
        collider: [{ x: x - 1.72, z, r: .5 }, { x: x + 1.72, z, r: .5 }],
        set unlocked(value) { this.target = value ? 1 : 0; },
        target: 0,
        update(t, dt) {
            on += (this.target - on) * Math.min(1, dt * 2.5);
            u.on.value = on;
            beam.material.opacity = on * (.18 + Math.sin(t * 3) * .05);
            light.intensity = on * 14;
            runes.visible = on > .02;
            runeMeshes.forEach((m, i) => {
                const a = t * 1.3 + i / 6 * Math.PI * 2;
                m.position.set(Math.cos(a) * 2.25, Math.sin(a * 2) * .3 + Math.sin(a) * 1.9, Math.sin(a) * .35);
                m.rotation.set(t * 2, t * 3, 0); m.scale.setScalar(on);
            });
            key.rotation.y = t * (1 + on * 3);
            key.position.y = 3.35 + Math.sin(t * 2) * .06;
        },
    };
}

export function buildCamp(kit, root, theme) {
    const [x, z] = LAYOUT.camp;
    const g = kit.group(root, x, GROUND, z);
    if (theme.camp === "igloo") {
        const dome = kit.mesh(new THREE.SphereGeometry(1.4, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0xf2f8ff, g, 0, 0, 0, .05);
        for (let i = 1; i < 4; i++) kit.mesh(new THREE.TorusGeometry(Math.cos(i * .38) * 1.41, .025, 4, 30), kit.basic(0xbfd3ea), g, 0, Math.sin(i * .38) * 1.41, 0).rotation.x = Math.PI / 2;
        const door = kit.mesh(new THREE.CylinderGeometry(.5, .5, 1, 14, 1, false, 0, Math.PI), 0xf2f8ff, g, 0, .45, 1.15, .04);
        door.rotation.set(Math.PI / 2, 0, 0);
        void dome;
    } else {
        const tent = kit.cone(g, theme.accent, 0, 1, 0, 1.4, 2, 4, .05);
        tent.rotation.y = Math.PI / 4;
        const flap = kit.cone(g, 0x3b2c47, 0, .5, .72, .45, 1, 3);
        flap.rotation.y = Math.PI;
        kit.cyl(g, theme.trunk, 0, 2.15, 0, .04, .04, .5, 5);
        const flag = kit.mesh(new THREE.PlaneGeometry(.45, .28).translate(.22, 0, 0), kit.toon(0xffd84a, { side: THREE.DoubleSide }), g, 0, 2.28, 0);
        g.userData.flag = flag;
    }
    const fx = 2.1, fz = -.6;
    for (let i = 0; i < 8; i++) kit.ball(g, theme.rock, fx + Math.cos(i * .79) * .55, .1, fz + Math.sin(i * .79) * .55, .16, 0);
    for (let i = 0; i < 3; i++) {
        const log = kit.cyl(g, theme.trunk, fx, .14, fz, .08, .08, .8, 7, .02);
        log.rotation.set(Math.PI / 2, i * 1.05, 0); log.rotation.order = "YXZ";
    }
    const flames = [0xff5a2a, theme.fire, 0xffe45c].map((c, i) => kit.cone(g, kit.basic(c), fx, .45 + i * .06, fz, .34 - i * .09, .9 - i * .2, 7));
    const light = new THREE.PointLight(theme.fire, 8, 7, 1.8); light.position.set(fx, 1, fz); g.add(light);
    const seats = [[fx - .45, fz + 1.25], [fx + 1.2, fz + .5]];
    for (const [lx, lz] of seats) kit.cyl(g, theme.trunk, lx, .2, lz, .3, .32, .4, 10, .03);
    return {
        fire: { x: x + fx, z: z + fz }, seats: seats.map(([lx, lz]) => ({ x: x + lx, z: z + lz })),
        colliders: [{ x, z, r: 1.45 }, { x: x + fx, z: z + fz, r: .6 }],
        update(t) {
            flames.forEach((f, i) => { f.scale.set(1 + Math.sin(t * 9 + i) * .1, 1 + Math.sin(t * 13 + i * 2) * .18, 1); f.rotation.y = t * (1 + i); });
            light.intensity = 7 + Math.sin(t * 17) * 1.2 + Math.sin(t * 7) * .8;
            if (g.userData.flag) g.userData.flag.rotation.y = Math.sin(t * 3) * .35;
        },
    };
}

export function buildBoard(kit, root, theme) {
    const [x, z] = LAYOUT.board;
    const g = kit.group(root, x, GROUND, z); g.rotation.y = -.5;
    for (const side of [-1, 1]) kit.cyl(g, theme.trunk, side * .7, .8, 0, .07, .08, 1.6, 6, .03);
    kit.box(g, 0xd9a066, 0, 1.25, 0, 1.7, .95, .1, .04);
    kit.box(g, theme.accent, 0, 1.85, 0, 1.9, .16, .14, .03);
    const notes = [0xffffff, 0xfff1a8, 0xffd0e6, 0xcff4ff].map((c, i) => {
        const n = kit.box(g, c, -.5 + i * .34, 1.22 + (i % 2) * .12, .07, .28, .34, .01);
        n.rotation.z = (i - 1.5) * .12; return n;
    });
    return { collider: { x, z, r: .7 }, update(t) { notes.forEach((n, i) => { n.rotation.z = (i - 1.5) * .12 + Math.sin(t * 2 + i) * .04; }); } };
}

export function buildPad(kit, root, theme) {
    const [x, z] = LAYOUT.pad;
    const g = kit.group(root, x, GROUND, z);
    kit.cyl(g, theme.rock, 0, .1, 0, .8, .9, .2, 18, .04);
    const top = kit.cyl(g, 0xff4d8d, 0, .3, 0, .72, .72, .16, 18, .03);
    const ring = kit.mesh(new THREE.TorusGeometry(.5, .06, 6, 20), kit.basic(0xffffff), top, 0, .09, 0);
    ring.rotation.x = Math.PI / 2;
    let squash = 0;
    return {
        x, z, radius: .85,
        boing() { squash = 1; },
        update(t, dt) { squash = Math.max(0, squash - dt * 3); top.scale.y = 1 - Math.sin(squash * Math.PI * 3) * squash * .6; ring.rotation.z = t; },
    };
}

export function buildBlock(kit, root) {
    const [x, z] = LAYOUT.block;
    const g = kit.group(root, x, GROUND + 3.3, z);
    const cube = kit.box(g, 0xffc629, 0, 0, 0, .8, .8, .8, .04);
    const marks = [];
    for (let i = 0; i < 4; i++) {
        const m = kit.mesh(kit.star(.22, .1, .03), kit.basic(0xffffff), cube, 0, 0, 0);
        m.rotation.y = i * Math.PI / 2; m.translateZ(.41); marks.push(m);
    }
    let bump = 0, hits = 0;
    return {
        x, z, bottom: GROUND + 2.9, group: g,
        get spent() { return hits >= 3; },
        hit() {
            if (hits >= 3) return false;
            hits++; bump = 1;
            if (hits >= 3) { cube.material = kit.toon(0xb2865a); marks.forEach((m) => { m.visible = false; }); }
            return true;
        },
        update(t, dt) { bump = Math.max(0, bump - dt * 5); g.position.y = GROUND + 3.3 + Math.sin(bump * Math.PI) * .35; cube.rotation.y = hits >= 3 ? 0 : Math.sin(t * 1.5) * .15; },
    };
}

export function buildLandmark(kit, root, theme) {
    const [x, z] = LAYOUT.landmark;
    const g = kit.group(root, x, GROUND, z); g.rotation.y = .7;
    const spin = [];
    const door = (y, zz) => { kit.mesh(new THREE.CircleGeometry(.36, 14, 0, Math.PI).translate(0, .3, 0), kit.toon(0x7a4a2a), g, 0, y, zz); kit.box(g, 0x7a4a2a, 0, y + .15, zz, .72, .3, .02); };
    if (theme.landmark === "windmill") {
        kit.cyl(g, 0xfff4dc, 0, 1.6, 0, .8, 1.15, 3.2, 12, .05);
        kit.cone(g, theme.accent, 0, 3.75, 0, 1.1, 1.2, 12, .05);
        door(0, 1.1);
        const hub = kit.group(g, 0, 3, 1.05); spin.push([hub, "z", 1]);
        kit.ball(hub, 0x7a4a2a, 0, 0, 0, .18, 1);
        for (let i = 0; i < 4; i++) {
            const blade = kit.group(hub, 0, 0, 0); blade.rotation.z = i * Math.PI / 2;
            kit.box(blade, theme.trunk, 0, 1.1, 0, .08, 2.1, .06);
            kit.box(blade, 0xffffff, .22, 1.3, 0, .38, 1.5, .03, .02);
        }
    } else if (theme.landmark === "mushroom-house") {
        kit.cyl(g, 0xfff3dc, 0, 1.2, 0, .95, 1.2, 2.4, 16, .05);
        const cap = kit.ball(g, 0xff5fa8, 0, 2.7, 0, 1.8, 2, .07); cap.scale.y = .62;
        for (let i = 0; i < 8; i++) { const s = kit.ball(g, kit.toon(0xffffff), Math.cos(i * .8) * 1.3, 3.05 - (i % 2) * .25, Math.sin(i * .8) * 1.3, .26, 1); s.scale.y = .5; }
        door(0, 1.15);
        for (const side of [-1, 1]) kit.ball(g, kit.basic(0xfff27a), side * .6, 1.55, .95, .2, 1).scale.z = .3;
        kit.cyl(g, 0x9a8ad0, 0, 3.7, .6, .1, .12, .9, 8).rotation.x = .2;
    } else if (theme.landmark === "forge") {
        kit.box(g, 0xe7b988, 0, 1, 0, 2.4, 2, 2, .05);
        const roof = kit.cone(g, 0xc04a2c, 0, 2.6, 0, 1.9, 1.3, 4, .05); roof.rotation.y = Math.PI / 4;
        kit.box(g, theme.rock, .75, 3, -.3, .5, 1.5, .5, .04);
        door(0, 1.02);
        kit.box(g, 0x5c5f78, 1.6, .5, 1.2, .8, .3, .45, .03); kit.box(g, 0x5c5f78, 1.6, .25, 1.2, .35, .4, .3);
        kit.box(g, kit.basic(0xffa436), -.6, 1.1, 1.01, .5, .5, .02);
        const puffs = [];
        for (let i = 0; i < 4; i++) puffs.push(kit.ball(g, kit.basic(0xfff1e1, { transparent: true, opacity: .8 }), .75, 4, -.3, .35, 1));
        spin.push([null, "smoke", puffs]);
    } else {
        kit.cyl(g, 0xeef3ff, 0, 1.2, 0, 1.25, 1.35, 2.4, 18, .05);
        const dome = kit.mesh(new THREE.SphereGeometry(1.3, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0x6b7fd8, g, 0, 2.4, 0, .05);
        const scope = kit.group(dome, 0, .7, 0); spin.push([dome, "y", .2]);
        kit.cyl(scope, 0xffc629, 0, .3, .5, .2, .28, 1.5, 12, .03).rotation.x = .9;
        door(0, 1.3);
        kit.mesh(kit.star(.3, .14, .05), kit.basic(0xffe45c), g, 0, 4.1, 0);
    }
    return {
        collider: { x, z, r: 1.6 },
        update(t) {
            for (const [m, axis, v] of spin) {
                if (axis === "smoke") v.forEach((p, i) => { const k = (t * .35 + i / v.length) % 1; p.position.set(.75 + k * .8, 3.7 + k * 2.2, -.3); p.scale.setScalar(.5 + k * 1.3); p.material.opacity = .8 * (1 - k); });
                else m.rotation[axis] = t * v;
            }
        },
    };
}

export function buildSky(kit, scene, theme, seed) {
    const r = rng(seed + 99), animated = [];
    const sky = new THREE.Mesh(new THREE.SphereGeometry(140, 32, 16), kit.shader("sky", { top: { value: new THREE.Color(theme.skyTop) }, bottom: { value: new THREE.Color(theme.skyBottom) } }, { side: THREE.BackSide, depthWrite: false }));
    scene.add(sky);
    const cloudMat = kit.toon(theme.cloud, { emissive: theme.cloud, emissiveIntensity: .35 });
    const cloud = (x, y, z, s) => {
        const c = kit.group(scene, x, y, z); c.scale.setScalar(s);
        for (let i = 0; i < 5; i++) kit.mesh(new THREE.IcosahedronGeometry(1, 1), cloudMat, c, (i - 2) * .9, Math.sin(i * 1.3) * .25 + (i % 2) * .3, (r() - .5) * .8).scale.setScalar(.8 + (2 - Math.abs(i - 2)) * .35);
        c.traverse((m) => { m.castShadow = false; });
        return c;
    };
    const drifting = [];
    for (let i = 0; i < 9; i++) { const a = r() * Math.PI * 2, d = 22 + r() * 22; drifting.push({ c: cloud(Math.cos(a) * d, 4 + r() * 12, Math.sin(a) * d, 1.3 + r() * 1.6), a, d, s: .01 + r() * .02 }); }
    for (let i = 0; i < 30; i++) { const a = i / 30 * Math.PI * 2 + r(), d = 18 + r() * 40; cloud(Math.cos(a) * d, -15 - r() * 4, Math.sin(a) * d, 3 + r() * 3); }
    for (let i = 0; i < 4; i++) {
        const a = i * 1.6 + 1, d = 30 + r() * 12, isle = kit.group(scene, Math.cos(a) * d, -2 + r() * 8, Math.sin(a) * d);
        kit.cyl(isle, theme.grassA, 0, 0, 0, 2.4, 2.2, .5, 12);
        kit.cone(isle, theme.dirt[1], 0, -1.9, 0, 2.2, 3.4, 10).rotation.x = Math.PI;
        kit.ball(isle, theme.leaf[i % 3], .5, 1.2, 0, 1, 1); kit.cyl(isle, theme.trunk, .5, .5, 0, .15, .2, .8, 6);
        drifting.push({ isle, base: isle.position.y, p: r() * 6 });
    }
    if (theme.setpiece === "rainbow") {
        const bow = kit.group(scene, -6, -16, -44);
        [0xff5d5d, 0xffa13d, 0xffe14d, 0x6ee06a, 0x4dc3ff, 0x9a7bff].forEach((c, i) => kit.mesh(new THREE.TorusGeometry(22 - i * 1.1, .56, 6, 60, Math.PI), kit.basic(c, { transparent: true, opacity: .55 }), bow, 0, 0, 0));
    } else if (theme.setpiece === "moon") {
        kit.ball(scene, kit.basic(0xfff6d8), 20, 32, -60, 6, 3);
        kit.ball(scene, kit.basic(0xffe9a8, { transparent: true, opacity: .18 }), 20, 32, -61, 9.5, 3);
        const pts = new Float32Array(900);
        for (let i = 0; i < 300; i++) { const a = r() * Math.PI * 2, e = .15 + r() * 1.1; pts.set([Math.cos(a) * Math.cos(e) * 120, Math.sin(e) * 120, Math.sin(a) * Math.cos(e) * 120], i * 3); }
        const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pts, 3));
        const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.3, map: kit.dot, transparent: true, depthWrite: false }));
        scene.add(stars); animated.push((t) => { stars.material.opacity = .7 + Math.sin(t * 2) * .3; });
    } else if (theme.setpiece === "volcano") {
        const v = kit.group(scene, 26, -8, -44);
        kit.cone(v, theme.dirt[2], 0, 6, 0, 9, 14, 10);
        kit.cyl(v, kit.basic(0xff7b27), 0, 12.8, 0, 2, 2.2, .4, 10);
        const puffs = []; for (let i = 0; i < 6; i++) puffs.push(kit.ball(v, kit.basic(0xffe2c4, { transparent: true, opacity: .8 }), 0, 14, 0, 1.2, 1));
        animated.push((t) => puffs.forEach((p, i) => { const k = (t * .12 + i / 6) % 1; p.position.set(Math.sin(k * 4 + i) * 2, 13 + k * 14, 0); p.scale.setScalar(1 + k * 3); p.material.opacity = .85 * (1 - k); }));
    } else {
        const aurora = new THREE.Mesh(new THREE.CylinderGeometry(70, 70, 34, 48, 1, true, -1.2, 2.4), kit.shader("aurora", {}, { transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
        aurora.position.y = 28; aurora.rotation.y = Math.PI; scene.add(aurora);
    }
    animated.push((t) => drifting.forEach((d) => {
        if (d.c) { d.a += d.s * .016; d.c.position.x = Math.cos(d.a) * d.d; d.c.position.z = Math.sin(d.a) * d.d; }
        else d.isle.position.y = d.base + Math.sin(t * .5 + d.p) * .6;
    }));
    return { update: (t) => animated.forEach((f) => f(t)) };
}
