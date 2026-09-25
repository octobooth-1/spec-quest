import * as THREE from "./three.module.js";

export { THREE };
export const GROUND = .35;
export const RADIUS = 12.2;

export const THEMES = {
    meadow: {
        skyTop: 0x3e9cff, skyBottom: 0xd6f2ff, grassA: 0x8bd94f, grassB: 0x78cb43, edge: 0x5eab36,
        dirt: [0xd9975a, 0xb97842, 0x925c35], rock: 0xc7b497, path: 0xfde6a6, leaf: [0x5fca4a, 0x94e154, 0x47b43f],
        trunk: 0x925c36, water: 0x4ec6f7, waterDeep: 0x1d8ad0, foam: 0xffffff, flower: [0xff5d7d, 0xffd23f, 0xffffff, 0xa77bff],
        particle: 0xfff6b0, particleKind: "pollen", accent: 0xff6a4d, fire: 0xffa436, cloud: 0xffffff,
        landmark: "windmill", setpiece: "rainbow", flora: "round", critter: "butterfly", camp: "tent",
    },
    grove: {
        skyTop: 0x2b2b75, skyBottom: 0xf6a2c6, grassA: 0x52c7a0, grassB: 0x46b891, edge: 0x2f907a,
        dirt: [0x8f70b8, 0x71599b, 0x55437a], rock: 0xa399d2, path: 0xebe2ff, leaf: [0xff8fd0, 0x8ee7ff, 0xc7a6ff],
        trunk: 0xf5ead6, water: 0x7ae9ff, waterDeep: 0x4b72d6, foam: 0xe8fcff, flower: [0xff8ad8, 0x8affea, 0xfff07a, 0xc3a4ff],
        particle: 0xd9ff7a, particleKind: "fireflies", accent: 0xff7ad0, fire: 0x69d2ff, cloud: 0xf3dcff,
        landmark: "mushroom-house", setpiece: "moon", flora: "mushroom", critter: "moth", camp: "tent",
    },
    forge: {
        skyTop: 0xff8a57, skyBottom: 0xffe7b3, grassA: 0xefc574, grassB: 0xe3b463, edge: 0xc88f45,
        dirt: [0xc8683d, 0xa24e2f, 0x7c3b27], rock: 0xa3705f, path: 0xfff2cc, leaf: [0x4fc06b, 0x7ad65a, 0x39a45a],
        trunk: 0xab733f, water: 0xff7b27, waterDeep: 0xd9361c, foam: 0xffe27a, flower: [0xff5f3d, 0xffc93d, 0xff9ad0, 0xffffff],
        particle: 0xffb347, particleKind: "embers", accent: 0x33b8aa, fire: 0xff7a2a, cloud: 0xfff1dc,
        landmark: "forge", setpiece: "volcano", flora: "palm", critter: "bird", camp: "tent",
    },
    summit: {
        skyTop: 0x5a98ef, skyBottom: 0xecf5ff, grassA: 0xf8fbff, grassB: 0xe9f1fc, edge: 0xcddbee,
        dirt: [0x93a7c8, 0x778bad, 0x5f7193], rock: 0xaebbd3, path: 0xcad8ec, leaf: [0x2f917b, 0x3ba68c, 0x28796b],
        trunk: 0x7c5b46, water: 0xaae8ff, waterDeep: 0x69b6f0, foam: 0xffffff, flower: [0x9bd8ff, 0xffffff, 0xd4b8ff, 0xff9ab8],
        particle: 0xffffff, particleKind: "snow", accent: 0xff5f6d, fire: 0xffa436, cloud: 0xffffff,
        landmark: "observatory", setpiece: "aurora", flora: "pine", critter: "bird", camp: "igloo",
    },
};

export const rng = (seed) => () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
export const css = (hex) => `#${hex.toString(16).padStart(6, "0")}`;

const VERT = `varying vec2 vUv; varying vec3 vP;
void main(){ vUv = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const OUT = "\n#include <colorspace_fragment>\n";

export const SHADERS = {
    sky: `uniform vec3 top; uniform vec3 bottom; varying vec3 vP;
void main(){ float h = clamp(normalize(vP).y * .85 + .38, 0., 1.); gl_FragColor = vec4(mix(bottom, top, pow(h, 1.15)), 1.); ${OUT} }`,
    pond: `uniform float time; uniform vec3 c1; uniform vec3 c2; uniform vec3 foam; varying vec2 vUv;
void main(){ vec2 p = vUv - .5; float r = length(p) * 2.;
 float ring = step(.93, sin(r * 16. - time * 2.4) * .5 + .5) * (1. - r);
 float edge = smoothstep(.8, .9, r); vec3 col = mix(c2, c1, smoothstep(0., .9, r));
 float sp = step(.992, sin(p.x * 70. + time * 1.7) * sin(p.y * 70. - time * 1.3));
 col = mix(col, foam, max(edge, ring * .7)) + sp * .6; gl_FragColor = vec4(col, 1.); ${OUT} }`,
    stream: `uniform float time; uniform vec3 c1; uniform vec3 c2; uniform vec3 foam; uniform float speed; varying vec2 vUv;
void main(){ float s = step(.72, fract(vUv.y * 6. - time * speed + sin(vUv.x * 11. + vUv.y * 4.) * .12));
 float edge = step(.8, abs(vUv.x - .5) * 2.); vec3 col = mix(c1, c2, abs(vUv.x - .5));
 col = mix(col, foam, max(s * .6, edge * .85)); gl_FragColor = vec4(col, 1.); ${OUT} }`,
    fall: `uniform float time; uniform vec3 c1; uniform vec3 c2; uniform vec3 foam; varying vec2 vUv;
void main(){ float s = step(.62, fract(vUv.y * 9. + time * 2.6 + sin(vUv.x * 17.) * .18));
 float edge = step(.78, abs(vUv.x - .5) * 2.); vec3 col = mix(c1, c2, 1. - vUv.y);
 col = mix(col, foam, max(s * .55, edge * .7)); float a = smoothstep(0., .45, vUv.y);
 gl_FragColor = vec4(col, a * .95); ${OUT} }`,
    portal: `uniform float time; uniform float on; uniform vec3 a; uniform vec3 b; varying vec3 vP;
void main(){ vec2 p = vec2(vP.x, vP.y - 1.55) / 1.45; float r = length(p); float ang = atan(p.y, p.x);
 float sw = sin(ang * 5. + r * 11. - time * (1.2 + on * 3.5));
 vec3 col = mix(a, b, sw * .5 + .5); col = mix(col, vec3(1.), smoothstep(.55, 0., r) * (.25 + on * .6));
 float stars = step(.985, fract(sin(dot(floor(p * 18. + time * on), vec2(12.9, 78.2))) * 43758.5)) * on;
 gl_FragColor = vec4(col + stars, mix(.42, .94, on)); ${OUT} }`,
    aurora: `uniform float time; varying vec2 vUv;
void main(){ float w = sin(vUv.x * 7. + time * .35 + sin(vUv.x * 2.3 + time * .2) * 2.2) * .5 + .5;
 float fade = smoothstep(0., .35, vUv.y) * smoothstep(1., .45, vUv.y);
 vec3 col = mix(vec3(.2, 1., .62), vec3(.72, .38, 1.), vUv.y + w * .25);
 gl_FragColor = vec4(col, fade * (.25 + w * .5)); ${OUT} }`,
};

export class Kit {
    constructor() {
        const tones = new THREE.DataTexture(new Uint8Array([120, 195, 255]), 3, 1, THREE.RedFormat);
        tones.minFilter = tones.magFilter = THREE.NearestFilter; tones.needsUpdate = true;
        this.tones = tones;
        this.cache = new Map();
        this.time = { value: 0 };
        this.outlineMat = new THREE.MeshBasicMaterial({ color: 0x3b2c47, side: THREE.BackSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 4 });
        this.dot = this.canvasTexture(64, (g, s) => {
            const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
            r.addColorStop(0, "#fff"); r.addColorStop(.4, "rgba(255,255,255,.9)"); r.addColorStop(1, "rgba(255,255,255,0)");
            g.fillStyle = r; g.fillRect(0, 0, s, s);
        });
    }
    canvasTexture(size, draw) {
        const c = document.createElement("canvas"); c.width = c.height = size;
        draw(c.getContext("2d"), size);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    }
    toon(color, extra = {}) {
        const key = `t${color}:${JSON.stringify(extra)}`;
        if (!this.cache.has(key)) this.cache.set(key, new THREE.MeshToonMaterial({ color, gradientMap: this.tones, ...extra }));
        return this.cache.get(key);
    }
    basic(color, extra = {}) {
        const key = `b${color}:${JSON.stringify(extra)}`;
        if (!this.cache.has(key)) this.cache.set(key, new THREE.MeshBasicMaterial({ color, ...extra }));
        return this.cache.get(key);
    }
    shader(name, uniforms = {}, extra = {}) {
        return new THREE.ShaderMaterial({ uniforms: { time: this.time, ...uniforms }, vertexShader: VERT, fragmentShader: SHADERS[name], ...extra });
    }
    mesh(geometry, material, parent, x = 0, y = 0, z = 0, outline = 0) {
        const m = new THREE.Mesh(geometry, typeof material === "number" ? this.toon(material) : material);
        m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
        if (outline) this.outline(m, outline === true ? .05 : outline);
        parent.add(m); return m;
    }
    outline(mesh, thickness = .05) {
        mesh.geometry.computeBoundingSphere();
        const o = new THREE.Mesh(mesh.geometry, this.outlineMat);
        o.scale.setScalar(1 + thickness / Math.max(.05, mesh.geometry.boundingSphere.radius));
        o.position.copy(mesh.geometry.boundingSphere.center).multiplyScalar(-(o.scale.x - 1));
        o.raycast = () => {};
        mesh.add(o); return o;
    }
    ball(p, c, x, y, z, r = 1, detail = 2, outline = 0) { return this.mesh(new THREE.IcosahedronGeometry(r, detail), c, p, x, y, z, outline); }
    box(p, c, x, y, z, w, h, d, outline = 0) { return this.mesh(new THREE.BoxGeometry(w, h, d), c, p, x, y, z, outline); }
    cyl(p, c, x, y, z, top, bottom, h, seg = 12, outline = 0) { return this.mesh(new THREE.CylinderGeometry(top, bottom, h, seg), c, p, x, y, z, outline); }
    cone(p, c, x, y, z, r, h, seg = 12, outline = 0) { return this.mesh(new THREE.ConeGeometry(r, h, seg), c, p, x, y, z, outline); }
    star(outer = .34, inner = .15, depth = .1) {
        const s = new THREE.Shape();
        for (let i = 0; i < 10; i++) {
            const a = i / 10 * Math.PI * 2 + Math.PI / 2, r = i % 2 ? inner : outer;
            i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: .03, bevelSize: .03, bevelSegments: 2 });
        g.center(); return g;
    }
    group(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
}
