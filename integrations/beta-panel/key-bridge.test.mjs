import {test} from "node:test";
import assert from "node:assert/strict";
import {vyroKeyBridge} from "./key-bridge.mjs";
const id="11111111-1111-4111-8111-111111111111";
const admin={id:"admin",email:"hongkongsubnet@gmail.com",email_confirmed_at:"2026-10-20"};
const req=(action="reveal",auth=true)=>new Request("https://beta.example/v1/vyro/admin/key",{method:"POST",headers:{"Content-Type":"application/json",...(auth?{Authorization:"Bearer user-token",apikey:"public-key"}:{})},body:JSON.stringify({id,action})});
test("key bridge never reveals keys to missing, invalid, anonymous or non-admin sessions",async()=>{
 let called=false;const handlers={revealCode:()=>{called=true;},createShareCode:()=>{called=true;}};
 assert.equal((await vyroKeyBridge(req("reveal",false),{},handlers,()=>{throw Error("Should not fetch");})).status,401);
 assert.equal((await vyroKeyBridge(req(),{},handlers,async()=>new Response(null,{status:401}))).status,401);
 for(const user of [{...admin,email:"client@example.com",user_metadata:{role:"admin"}},{...admin,email_confirmed_at:null},{...admin,is_anonymous:true}]){
  assert.equal((await vyroKeyBridge(req(),{},handlers,async()=>Response.json(user))).status,403);
 }assert.equal(called,false);
});
test("verified administrator reveals only the requested key without creating another one",async()=>{
 let shares=0;
 const response=await vyroKeyBridge(req(),{ADMIN_TOKEN:"must-stay-in-beta"},{
  revealCode:(env,requested)=>{assert.equal(requested,id);assert.equal(env.ADMIN_TOKEN,"must-stay-in-beta");return Response.json({code:"fixture"});},
  createShareCode:()=>{shares++;},
 },async(url,options)=>{assert.equal(url,"https://jqudulynpebvnipwjyhu.supabase.co/auth/v1/user");assert.equal(options.headers.Authorization,"Bearer user-token");assert.equal(options.headers.apikey,"public-key");return Response.json(admin);});
 assert.equal(response.status,200);assert.equal(shares,0);assert.equal(response.headers.get("cache-control"),"no-store, private");
});
test("creating a sharing key requires the explicit share action; invalid requests are rejected",async()=>{
 let shares=0;const handlers={revealCode:()=>{throw Error("Unexpected reveal");},createShareCode:()=>{shares++;return Response.json({code:"fixture"}, {status:201});}};
 assert.equal((await vyroKeyBridge(req("share"),{},handlers,async()=>Response.json(admin))).status,201);
 assert.equal((await vyroKeyBridge(req("delete"),{},handlers,async()=>Response.json(admin))).status,400);
 assert.equal(shares,1);
});
