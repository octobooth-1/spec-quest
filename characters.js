import { THREE } from "./toon.js";

export const ROLE_COLORS = [0xff8a3d, 0x8a6cff, 0x22b8a0];
const SKIN = [0xffd7b0, 0xf2bf94, 0xc98d62, 0xffe2c6];

function face(kit, head, eyeY = .06, cheeks = 0xff8fa3) {
    const eyes = [];
    for (const side of [-1, 1]) {
        const eye = kit.mesh(new THREE.CapsuleGeometry(.055, .09, 4, 8), kit.basic(0x2b2033), head, side * .17, eyeY, .41);
        kit.ball(eye, kit.basic(0xffffff), .018, .04, .04, .022, 1);
        kit.ball(head, kit.basic(cheeks, { transparent: true, opacity: .75 }), side * .29, eyeY - .12, .33, .075, 1).scale.set(1, .6, .4);
        eyes.push(eye);
    }
    const mouth = kit.mesh(new THREE.TorusGeometry(.06, .016, 6, 12, Math.PI), kit.basic(0x2b2033), head, 0, eyeY - .16, .43);
    mouth.rotation.z = Math.PI;
    return eyes;
}

function limb(kit, parent, color, x, y, z, length, radius = .09) {
    const pivot = kit.group(parent, x, y, z);
    kit.mesh(new THREE.CapsuleGeometry(radius, length, 4, 8), color, pivot, 0, -length / 2 - radius * .5, 0, .03);
    return pivot;
}

export function buildCharacter(kit, kind, index = 0) {
    const root = new THREE.Group();
    const body = kit.group(root, 0, 0, 0);
    const main = kind === "hero" ? 0x3ab0ff : ROLE_COLORS[index % 3];
    const skin = kind === "hero" ? SKIN[0] : SKIN[(index + 1) % SKIN.length];
    const legs = [-1, 1].map((side) => limb(kit, body, kind === "hero" ? 0x31467a : 0x4a3a5c, side * .15, .5, 0, .22, .1));
    legs.forEach((leg) => kit.ball(leg, 0x6b3f2a, 0, -.45, .06, .13, 1).scale.set(1, .7, 1.35));
    const torso = kit.mesh(new THREE.CapsuleGeometry(.3, .3, 6, 14), main, body, 0, .82, 0, .04);
    torso.scale.set(1, 1, .9);
    kit.cyl(body, 0x5b3a26, 0, .72, 0, .33, .33, .08, 16);
    kit.box(body, 0xffd84a, 0, .72, .31, .12, .09, .05);
    const arms = [-1, 1].map((side) => {
        const arm = limb(kit, body, main, side * .36, 1.02, 0, .26, .085);
        arm.rotation.z = side * .25;
        kit.ball(arm, skin, 0, -.47, 0, .1, 1);
        return arm;
    });
    const head = kit.group(body, 0, 1.52, 0);
    kit.ball(head, skin, 0, 0, 0, .46, 3, .045).scale.set(1, .95, .95);
    const eyes = face(kit, head);
    const extras = { root, body, head, arms, legs, eyes, main };

    if (kind === "hero") {
        kit.ball(head, 0x8a4b2a, 0, .17, -.05, .44, 2).scale.set(1.04, .72, 1.02);
        kit.ball(head, 0x8a4b2a, .2, .3, .28, .14, 1);
        kit.ball(head, 0x8a4b2a, -.12, .34, .32, .12, 1);
        const sprout = kit.group(head, 0, .52, 0);
        kit.cyl(sprout, 0x3f9e3a, 0, .1, 0, .025, .03, .22, 6);
        for (const side of [-1, 1]) {
            const leaf = kit.ball(sprout, 0x6fdc4a, side * .13, .22, 0, .12, 1, .02);
            leaf.scale.set(1.3, .45, .7); leaf.rotation.z = side * .5;
        }
        extras.sprout = sprout;
        const cape = kit.mesh(new THREE.PlaneGeometry(.62, .72, 1, 4), kit.toon(0xff4d6d, { side: THREE.DoubleSide }), body, 0, .82, -.3);
        cape.geometry.translate(0, -.3, 0); cape.position.y = 1.15;
        extras.cape = cape;
        kit.cone(body, 0xff4d6d, 0, 1.18, -.05, .34, .16, 14).rotation.x = Math.PI;
    } else if (index % 3 === 0) {
        const hat = kit.group(head, 0, .28, 0);
        kit.ball(hat, 0xffc629, 0, 0, 0, .43, 2, .03).scale.set(1, .6, 1);
        kit.cyl(hat, 0xffc629, 0, -.04, .12, .48, .5, .06, 18);
        kit.box(hat, 0xff6b3d, 0, .18, 0, .08, .12, .75);
        kit.ball(head, 0xd3d0e8, 0, -.22, .36, .2, 1).scale.set(1.4, .6, .6);
        const hammer = kit.group(arms[1], 0, -.5, .05);
        kit.cyl(hammer, 0x9a6a3f, 0, .2, 0, .04, .04, .6, 6);
        kit.box(hammer, 0x8e96b3, 0, .5, 0, .34, .18, .18, .025);
        hammer.rotation.x = -1.2;
        extras.prop = hammer;
    } else if (index % 3 === 1) {
        const hat = kit.group(head, 0, .32, -.02);
        kit.cyl(hat, 0x5e3fc9, 0, -.02, 0, .62, .62, .05, 22, .03);
        const tip = kit.cone(hat, 0x7856f0, 0, .42, -.05, .36, .9, 16, .03);
        tip.rotation.x = -.25;
        kit.mesh(kit.star(.13, .06, .04), kit.basic(0xffe45c), hat, .12, .35, .3);
        kit.cone(head, 0xf6f1ff, 0, -.42, .3, .26, .55, 12).rotation.x = Math.PI + .25;
        const staff = kit.group(arms[0], 0, -.48, .06);
        kit.cyl(staff, 0x8e5a36, 0, .1, 0, .04, .05, 1.5, 6);
        const orb = kit.ball(staff, kit.basic(0x9ef3ff), 0, .9, 0, .15, 2);
        kit.ball(orb, kit.basic(0xffffff, { transparent: true, opacity: .35 }), 0, 0, 0, 1.6, 2);
        extras.prop = staff; extras.orb = orb;
    } else {
        const hat = kit.group(head, 0, .3, 0);
        kit.cyl(hat, 0xe9d49a, 0, 0, 0, .7, .7, .05, 22, .03);
        kit.ball(hat, 0xe9d49a, 0, .12, 0, .36, 2, .03).scale.set(1, .6, 1);
        kit.cyl(hat, 0xff6f61, 0, .06, 0, .37, .37, .08, 18);
        kit.mesh(new THREE.TorusGeometry(.13, .035, 6, 12), 0x3b2c47, head, -.17, .06, .43);
        kit.mesh(new THREE.TorusGeometry(.13, .035, 6, 12), 0x3b2c47, head, .17, .06, .43);
        const pack = kit.box(body, 0xb66c3c, 0, .9, -.35, .48, .52, .26, .03);
        kit.cyl(pack, 0xd24f4f, 0, .33, 0, .1, .1, .42, 10).rotation.z = Math.PI / 2;
        const glass = kit.group(arms[1], 0, -.48, .06);
        kit.cyl(glass, 0xc9a13a, 0, .2, 0, .06, .08, .5, 10, .02);
        glass.rotation.x = -1.4;
        extras.prop = glass;
    }
    root.userData = extras;
    return root;
}

export function animateCharacter(c, t, { moving = 0, airborne = false, wave = 0, talkTo = null, reduced = false, seed = 0, pose = null, dance = false }) {
    const u = c.userData;
    const cycle = t * 11;
    u.body.rotation.y = 0;
    if (reduced && !pose) { u.body.position.y = 0; return; }
    const breathe = Math.sin(t * 2.2 + seed) * .025;
    u.body.position.y = moving ? Math.abs(Math.sin(cycle)) * .12 : 0;
    u.body.scale.set(1 - breathe * .5, 1 + breathe, 1 - breathe * .5);
    u.legs.forEach((leg, i) => { leg.rotation.x = airborne ? (i ? -.7 : .5) : moving ? Math.sin(cycle + i * Math.PI) * .7 : 0; });
    u.arms.forEach((arm, i) => {
        const side = i ? 1 : -1;
        if (airborne) { arm.rotation.x = -2.6; arm.rotation.z = side * .35; }
        else if (wave && i === 1) { arm.rotation.x = -.2; arm.rotation.z = 2.5 + Math.sin(t * 12) * .35; }
        else { arm.rotation.x = moving ? Math.sin(cycle + i * Math.PI + Math.PI) * .75 : Math.sin(t * 1.7 + seed + i) * .06; arm.rotation.z = side * .25; }
    });
    u.head.rotation.z = Math.sin(t * 1.3 + seed) * .06;
    u.head.rotation.x = moving ? .08 : Math.sin(t * .9 + seed) * .04;
    const blink = (t + seed * 1.7) % 3.7 < .12 ? .1 : 1;
    u.eyes.forEach((eye) => { eye.scale.y = blink; });
    if (u.sprout) u.sprout.rotation.z = Math.sin(t * 6) * (moving ? .35 : .12);
    if (u.cape) u.cape.rotation.x = .12 + (moving ? .55 + Math.sin(cycle * 1.2) * .12 : Math.sin(t * 2) * .05) + (airborne ? .5 : 0);
    if (u.orb) { u.orb.position.y = .9 + Math.sin(t * 2.5 + seed) * .05; u.orb.rotation.y = t; }
    if (dance && !pose) {
        const b = t * 8 + seed;
        u.body.position.y = Math.abs(Math.sin(b)) * .2; u.body.rotation.y = Math.sin(b * .5) * .7;
        u.arms.forEach((arm, i) => { const side = i ? 1 : -1; arm.rotation.x = 0; arm.rotation.z = side * (1.9 + Math.sin(b + i * Math.PI) * .8); });
        u.legs.forEach((leg, i) => { leg.rotation.x = Math.max(0, Math.sin(b + i * Math.PI)) * -.6; });
        u.head.rotation.z = Math.sin(b) * .22;
    }
    if (pose === "sit") {
        u.body.position.y = -.08; u.body.scale.set(1, 1, 1);
        u.legs.forEach((leg, i) => { leg.rotation.x = -1.3 + (i ? .08 : -.05); });
        u.arms[1].rotation.x = -1.45 + Math.sin(t * 1.5) * .04; u.arms[1].rotation.z = .12;
        u.arms[0].rotation.x = -.55; u.arms[0].rotation.z = -.3;
        u.head.rotation.x = .16;
    } else if (pose === "fish" || pose === "bite") {
        const j = pose === "bite" ? Math.sin(t * 38) * .09 : Math.sin(t * 1.6) * .03;
        u.arms[1].rotation.x = -1 + j; u.arms[1].rotation.z = .1;
        u.arms[0].rotation.x = -.9 + j; u.arms[0].rotation.z = -.45;
        u.legs.forEach((leg) => { leg.rotation.x = 0; });
        u.head.rotation.x = .12;
    } else if (pose === "cheer") {
        u.body.position.y = Math.abs(Math.sin(t * 9)) * .12;
        u.arms.forEach((arm, i) => { arm.rotation.x = -2.9; arm.rotation.z = (i ? 1 : -1) * (.3 + Math.sin(t * 12) * .15); });
    }
    if (u.cape && pose === "sit") u.cape.rotation.x = .05;
    if (talkTo) {
        const want = Math.atan2(talkTo.x - c.position.x, talkTo.z - c.position.z);
        let d = want - c.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
        c.rotation.y += d * .08;
    }
}
