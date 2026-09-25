const KEY = "spec-quest-muted";
const read = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };

// Tiny chiptune synth: every sound is generated, so there are no audio assets to load.
export class Sfx {
    constructor() { this.muted = read(); this.ctx = null; }
    ensure() {
        if (!this.ctx) {
            const Context = window.AudioContext || window.webkitAudioContext;
            if (!Context) return null;
            this.ctx = new Context();
            this.master = this.ctx.createGain();
            this.master.gain.value = .16;
            this.master.connect(this.ctx.destination);
        }
        if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
        return this.ctx;
    }
    tone(freq, start, duration, type = "square", volume = .5, slide = 0) {
        const c = this.ctx, osc = c.createOscillator(), gain = c.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, start);
        if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), start + duration);
        gain.gain.setValueAtTime(.0001, start);
        gain.gain.exponentialRampToValueAtTime(volume, start + .012);
        gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
        osc.connect(gain).connect(this.master);
        osc.start(start); osc.stop(start + duration + .03);
    }
    play(name) {
        if (this.muted) return;
        const c = this.ensure();
        if (!c) return;
        const t = c.currentTime;
        if (name.startsWith("note:")) { const f = [523, 587, 659, 784, 880][Number(name.slice(5))] ?? 523; this.tone(f, t, .32, "triangle", .45); this.tone(f * 2, t, .12, "sine", .12); return; }
        switch (name) {
            case "melody": [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, t + i * .1, i === 6 ? .5 : .12, "square", .28)); break;
            case "cast": this.tone(900, t, .28, "sine", .18, .25); break;
            case "plop": this.tone(420, t, .12, "sine", .45, .4); this.tone(900, t + .04, .05, "sine", .15); break;
            case "bite": this.tone(1200, t, .06, "square", .3); this.tone(1500, t + .08, .06, "square", .3); this.tone(1800, t + .16, .08, "square", .3); break;
            case "splash": for (let i = 0; i < 6; i++) this.tone(300 + Math.random() * 900, t + i * .02, .08, "triangle", .15, .5); break;
            case "catch": [659, 784, 988, 1319].forEach((f, i) => this.tone(f, t + i * .08, i === 3 ? .4 : .1, "square", .3)); break;
            case "miss": this.tone(440, t, .18, "triangle", .35, .7); this.tone(330, t + .18, .32, "triangle", .35, .7); break;
            case "munch": [0, 1, 2].forEach((i) => this.tone(140 + Math.random() * 60, t + i * .09, .05, "square", .2, .6)); break;
            case "sit": this.tone(220, t, .15, "sine", .35, .7); this.tone(330, t + .12, .25, "triangle", .2); break;
            case "boop": this.tone(260, t, .1, "sine", .5, 1.8); this.tone(520, t + .05, .08, "triangle", .2); break;
            case "dance": [392, 494, 587, 494, 392, 587].forEach((f, i) => this.tone(f, t + i * .11, .09, "square", .22)); break;
            case "coin": this.tone(988, t, .07, "square", .4); this.tone(1319, t + .065, .28, "square", .4); break;
            case "jump": this.tone(300, t, .2, "square", .25, 2.4); break;
            case "boing": this.tone(180, t, .35, "sine", .5, 3.2); this.tone(360, t + .05, .3, "triangle", .2, 2.2); break;
            case "tick": this.tone(900 + Math.random() * 300, t, .025, "square", .08); break;
            case "land": this.tone(140, t, .07, "triangle", .3, .5); break;
            case "bump": this.tone(170, t, .12, "triangle", .55, .6); this.tone(620, t + .06, .12, "square", .25); break;
            case "talk": [0, 1, 2].forEach((i) => this.tone(560 + i * 140, t + i * .055, .07, "triangle", .35)); break;
            case "open": this.tone(700, t, .07, "sine", .35); this.tone(1050, t + .055, .12, "sine", .3); break;
            case "decide": [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * .09, .24, "square", .3)); this.tone(1568, t + .38, .45, "triangle", .3); break;
            case "portal": [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, t + i * .075, .4, "triangle", .35)); break;
            case "area": [523, 784, 659, 1047].forEach((f, i) => this.tone(f, t + i * .13, .3, "square", .28)); this.tone(1319, t + .55, .6, "triangle", .3); break;
            case "error": this.tone(220, t, .15, "sawtooth", .2, .7); this.tone(165, t + .12, .22, "sawtooth", .2, .7); break;
        }
    }
    toggle() {
        this.muted = !this.muted;
        try { localStorage.setItem(KEY, this.muted ? "1" : "0"); } catch { /* storage may be unavailable in embedded views */ }
        if (!this.muted) this.play("open");
        return this.muted;
    }
}
