import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store, markdown } from "./store.mjs";
import { startServer } from "./server.mjs";

const areas = () => [
    { id:"purpose",name:"Purpose Meadow",subtitle:"Find the heart of your idea",theme:"meadow",goal:"Choose the first audience.",
        npcs:[{id:"audience",name:"Pip",role:"Pathfinder",assumption:"A narrow audience makes an MVP easier to evaluate.",question:"Who is the first release for?",rationale:"This is a test fixture, not researched advice.",sources:[],choices:[{id:"small",label:"A small pilot group",tradeoff:"Faster feedback, less representative."},{id:"everyone",label:"A public audience",tradeoff:"Broader reach, more operational demands."}]}]},
    { id:"delivery",name:"Delivery Grove",subtitle:"Make the idea real",theme:"grove",goal:"Choose a release approach.",
        npcs:[{id:"release",name:"Luma",role:"Architect",assumption:"A staged release reduces delivery risk.",question:"How should we release?",rationale:"This is a test fixture, not researched advice.",sources:[],choices:[{id:"pilot",label:"Invite-only pilot",tradeoff:"Controlled rollout."},{id:"public",label:"Public launch",tradeoff:"Faster adoption, higher risk."}]}]},
];
async function fixture(t, send = async () => {}) {
    const directory = await mkdtemp(join(tmpdir(),"spec-quest-test-"));
    t.after(() => rm(directory,{recursive:true,force:true}));
    const store=new Store(directory,send);
    await store.ensure("test-plan","Test plan","Test brief");
    return store;
}
async function publish(store, overrides = {}) {
    const state=await store.read("test-plan");
    return store.publish({planId:state.planId,baseRevision:state.revision,requestId:state.pending?.id??null,title:"Test plan",planText:"A test specification.",areas:areas(),...overrides});
}
test("save survives a new store and new panel; export contains decisions",async t=>{
    const store=await fixture(t);
    let state=await publish(store);
    state=await store.decide("test-plan",{npcId:"audience",choiceId:"small",baseRevision:state.revision});
    const restored=new Store(join(store.root,"../.."),async()=>{});
    assert.deepEqual(await restored.read("test-plan"),state);
    assert.match(markdown(state),/Decision: A small pilot group/);
    assert.equal((await store.ensure("test-plan","Don't overwrite")).title,"Test plan");
});
test("research advances only after all decisions and matching publication",async t=>{
    const prompts=[];const store=await fixture(t,async prompt=>prompts.push(prompt));
    await assert.rejects(()=>store.request("test-plan","advance"),{code:"incomplete_area"});
    let state=await store.request("test-plan","start",{brief:"Build an app"});
    assert.equal(state.pending.kind,"start");assert.match(prompts[0],/\[Spec Quest request\]/);
    state=await publish(store);
    await assert.rejects(()=>store.request("test-plan","advance"),{code:"incomplete_area"});
    state=await store.decide("test-plan",{npcId:"audience",choiceId:"small",baseRevision:state.revision});
    state=await store.request("test-plan","advance");
    assert.equal(state.currentArea,0);
    await assert.rejects(()=>publish(store,{requestId:"wrong"}),{code:"request_conflict"});
    state=await publish(store);assert.equal(state.currentArea,1);
    state=await store.decide("test-plan",{npcId:"release",custom:"A private beta",baseRevision:state.revision});
    await store.request("test-plan","advance");state=await publish(store);
    assert.equal(state.finished,true);assert.equal(state.decisions.release.label,"A private beta");
});
test("rejects stale writes, duplicate IDs, and rewriting answered questions",async t=>{
    const store=await fixture(t);let state=await publish(store);
    await assert.rejects(()=>publish(store,{baseRevision:0}),{code:"revision_conflict"});
    const duplicate=areas();duplicate[1].npcs[0].id="audience";
    await assert.rejects(()=>publish(store,{areas:duplicate}),{code:"duplicate_id"});
    state=await store.decide("test-plan",{npcId:"audience",choiceId:"small",baseRevision:state.revision});
    const changed=areas();changed[0].npcs[0].question="Changed";
    await assert.rejects(()=>publish(store,{areas:changed}),{code:"decision_conflict"});
    await store.request("test-plan","advance");
    const added=areas();added[0].npcs.push({...added[1].npcs[0],id:"new"});
    await assert.rejects(()=>publish(store,{areas:added}),{code:"incomplete_area"});
    assert.equal((await store.read("test-plan")).currentArea,0);
});
test("chat, cancel, late replies, explicit research errors, retry",async t=>{
    let fail=false;const store=await fixture(t,async()=>{if(fail)throw new Error("offline");});
    await publish(store);
    let state=await store.request("test-plan","chat",{npcId:"audience",text:"Why?"});
    const requestId=state.pending.id;
    state=await store.reply({planId:"test-plan",requestId,text:"Here is the rationale."});
    assert.equal(state.messages.at(-1).role,"assistant");assert.equal(state.pending,null);
    assert.equal(Object.keys(state.decisions).length,0);
    fail=true;state=await store.request("test-plan","chat",{npcId:"audience",text:"What next?"});
    assert.match(state.lastError,/offline/);
    fail=false;state=await store.retry("test-plan");assert.equal(state.lastError,null);
    state=await store.reply({planId:"test-plan",requestId:state.pending.id,text:"Need source access",error:true});
    assert.equal(state.lastError,"Need source access");
    const late=state.pending.id;
    await store.cancel("test-plan");
    await assert.rejects(()=>store.reply({planId:"test-plan",requestId:late,text:"Too late"}),{code:"request_conflict"});
});
test("serialize concurrent decisions and reject invalid IDs/sources",async t=>{
    const store=await fixture(t);const state=await publish(store);
    const result=await Promise.allSettled([
        store.decide("test-plan",{npcId:"audience",choiceId:"small",baseRevision:state.revision}),
        store.decide("test-plan",{npcId:"audience",choiceId:"everyone",baseRevision:state.revision}),
    ]);
    assert.equal(result.filter(item=>item.status==="fulfilled").length,1);
    assert.throws(()=>store.path("../escape"),TypeError);
    const invalid=areas();invalid[1].npcs[0].sources=[{label:"Bad",url:"javascript:alert(1)"}];
    await assert.rejects(()=>publish(store,{areas:invalid}),{code:"invalid_source"});
    assert.throws(()=>new Store(undefined,async()=>{}),{code:"workspace_missing"});
});
test("loopback HTTP, secret path, origin checks, static modules and export",async t=>{
    const store=await fixture(t);await publish(store);
    const server=await startServer(store,"test-plan");t.after(()=>server.close());
    const url=server.url;
    assert.equal((await fetch(url)).status,200);
    assert.equal((await fetch(`${url}three.module.js`)).status,200);
    assert.equal((await fetch(`${url}state`)).status,200);
    assert.match(await (await fetch(`${url}export`)).text(),/# Test plan/);
    assert.equal((await fetch(new URL("/state",url))).status,404);
    assert.equal((await fetch(`${url}cancel`,{method:"POST",headers:{"Content-Type":"application/json",Origin:"http://evil.invalid"},body:"{}"})).status,400);
    assert.equal((await fetch(`${url}decide`,{method:"POST",headers:{"Content-Type":"application/json"},body:"null"})).status,400);
    const saved=await readFile(store.path("test-plan"),"utf8");assert.equal(JSON.parse(saved).revision,1);
});
