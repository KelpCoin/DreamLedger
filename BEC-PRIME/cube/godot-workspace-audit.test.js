'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {inspectGodotWorkspace}=require('./godot-workspace-audit');
function fixture(t,mainScene='res://scenes/main.tscn'){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'kelphaven-audit-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,'scenes'));
 fs.mkdirSync(path.join(root,'scripts'));
 fs.writeFileSync(path.join(root,'project.godot'),'config_version=5\n[application]\nrun/main_scene="'+mainScene+'"\n');
 fs.writeFileSync(path.join(root,'scenes','main.tscn'),'[gd_scene load_steps=2 format=3]\n');
 fs.writeFileSync(path.join(root,'scripts','player.gd'),'extends CharacterBody2D\n');
 return root;
}
test('observes Godot workspace but does not claim gameplay ready',t=>{
 const root=fixture(t),a=inspectGodotWorkspace(root),b=inspectGodotWorkspace(root);
 assert.deepEqual(a,b);
 assert.equal(a.game_id,'kelphaven');
 assert.equal(a.main_scene_exists,true);
 assert.equal(a.scene_files,1);
 assert.equal(a.script_files,1);
 assert.equal(a.state,'SOURCE_PRESENT_GAMEPLAY_UNVERIFIED');
 assert.equal(a.godot_engine_run,false);
 assert.equal(a.cosmetic_entitlements_verified,false);
 assert.equal(a.source_mutations,0);
});
test('missing scene never passes readiness gate',t=>{
 const root=fixture(t,'res://scenes/unknown.tscn');
 assert.equal(inspectGodotWorkspace(root).state,'HOLD_INCOMPLETE_GODOT_SOURCE');
});
test('invalid main scene traversal blocked',t=>{
 const root=fixture(t,'res://../private.tscn');
 assert.throws(()=>inspectGodotWorkspace(root),/INVALID_MAIN_SCENE/);
});
test('no project config fails closed',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'kelphaven-none-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 assert.throws(()=>inspectGodotWorkspace(root),/PROJECT_GODOT_NOT_FOUND/);
});
test('no generated game or network operations',()=>{
 const source=fs.readFileSync(path.join(__dirname,'godot-workspace-audit.js'),'utf8');
 assert.doesNotMatch(source,/\bhttps?:\/\/|child_process|spawnSync|execSync|execFileSync|fetch\(/);
});
