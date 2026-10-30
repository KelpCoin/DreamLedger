'use strict';
// KelpHaven Godot workspace structure audit for Q-swarm, with no game execution.
// Uses the EXISTING game source, not a copied or generated blank Godot project.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const LIMIT=20000;
function inspectGodotWorkspace(dir){
 if(typeof dir!=='string'||!dir.trim())throw Error('KELPHAVEN_PROJECT_PATH_REQUIRED');
 const absolute=path.resolve(dir),base=fs.realpathSync(absolute),config=path.join(base,'project.godot');
 if(!fs.statSync(base).isDirectory()||!fs.existsSync(config)||!fs.statSync(config).isFile())throw Error('KELPHAVEN_PROJECT_GODOT_NOT_FOUND');
 const text=fs.readFileSync(config,'utf8');
 if(text.length>512000)throw Error('KELPHAVEN_PROJECT_FILE_TOO_LARGE');
 const match=text.match(/^\s*run\/main_scene\s*=\s*["']res:\/\/([^"'#\r\n]+)["']/m);
 const mainScene=match?match[1]:null;
 if(mainScene&&(mainScene.includes('..')||mainScene.startsWith('/')||mainScene.includes('\\')))throw Error('KELPHAVEN_INVALID_MAIN_SCENE');
 const scenes=[],scripts=[],otherAssets=[];
 const stack=[base];let scanned=0;
 while(stack.length){
  const cur=stack.pop();
  for(const entry of fs.readdirSync(cur,{withFileTypes:true})){
   if(++scanned>LIMIT)throw Error('KELPHAVEN_MAX_FILES_EXCEEDED');
   if(entry.name==='.godot'||entry.name==='.git'||entry.name==='node_modules')continue;
   const full=path.join(cur,entry.name);
   if(entry.isSymbolicLink())continue;
   if(entry.isDirectory()){stack.push(full);continue;}
   if(!entry.isFile())continue;
   const relative=path.relative(base,full).split(path.sep).join('/');
   if(relative.endsWith('.tscn'))scenes.push(relative);
   else if(relative.endsWith('.gd'))scripts.push(relative);
   else if(relative.endsWith('.tres'))otherAssets.push(relative);
  }
 }
 scenes.sort();scripts.sort();otherAssets.sort();
 const mainSceneExists=Boolean(mainScene)&&fs.existsSync(path.resolve(base,mainScene));
 const report={
  schema:'CUBE/GODOT-WORKSPACE-OBSERVATION/v1',game_id:'kelphaven',
  project_config_sha256:crypto.createHash('sha256').update(text).digest('hex'),
  static_only:true,source_mutations:0,godot_engine_run:false,gameplay_tested:false,
  production_deployed:false,cosmetic_entitlements_verified:false,
  main_scene:mainScene,main_scene_exists:mainSceneExists,
  scene_files:scenes.length,script_files:scripts.length,resource_files:otherAssets.length,
  state:mainSceneExists&&scenes.length&&scripts.length?'SOURCE_PRESENT_GAMEPLAY_UNVERIFIED':'HOLD_INCOMPLETE_GODOT_SOURCE',
  required_next:['RUN_PINNED_GODOT_HEADLESS_IMPORT_IN_SANDBOX','RUN_SCENE_AND_GAMEPLAY_REGRESSIONS','VERIFY_AVATAR_FALLBACK_AND_ENTITLEMENT_ISOLATION','CAPTURE_HASHED_BUILD_PROOF','REQUIRE_OWNER_APPROVAL_BEFORE_RELEASE']
 };
 return report;
}
if(require.main===module){
 try{
  if(process.argv.length!==3)throw Error('usage: node godot-workspace-audit.js <existing_godot_project_directory>');
  process.stdout.write(JSON.stringify(inspectGodotWorkspace(process.argv[2]),null,2)+'\n');
 }catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={inspectGodotWorkspace};
