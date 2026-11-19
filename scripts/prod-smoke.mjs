import { chromium } from "playwright";
const BASE=process.env.BASE ?? "http://127.0.0.1:3100";
const b=await chromium.launch({channel:"chrome",headless:true});
const p=await b.newPage({viewport:{width:1440,height:1000}});
const errors=[]; p.on("console",m=>{if(m.type()==="error") errors.push(m.text())}); p.on("pageerror",e=>errors.push(e.message));
for (const [name,url,waitFor] of [
 ["home","/","Keys change."],
 ["demo","/demo","Identity time machine"],
 ["lab","/lab","scenarios executed"],
 ["challenge","/challenge","Five stages."],
 ["merchant","/merchant","Sawa Market"],
 ["interop","/interop","Verify wallet signature"],
 ["pay","/pay","Pay the person"],
 ["tutorial","/tutorial","Two minutes."],
 ["auth-demo","/auth-demo","Sign in with an identity"],
 ["developers","/developers","Verification is a library call"],
]){
 await p.goto(BASE+url,{waitUntil:"networkidle"});
 await p.getByText(waitFor,{exact:false}).first().waitFor({timeout:20000});
 console.log("ok",name);
}
await p.goto(BASE+"/verify?npub=npub1invalid",{waitUntil:"networkidle"});
await p.waitForTimeout(1000);
console.log("verify invalid rendered");
console.log("errors",errors);
await b.close();
