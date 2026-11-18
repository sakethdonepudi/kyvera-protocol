import { chromium } from "playwright";
const b=await chromium.launch({channel:"chrome",headless:true});
const p=await b.newPage({viewport:{width:1440,height:1000}});
const errors=[]; p.on("console",m=>{if(m.type()==="error") errors.push(m.text())}); p.on("pageerror",e=>errors.push(e.message));
for (const [name,url,waitFor] of [
 ["home","/","Keys change."],
 ["demo","/demo","Identity time machine"],
 ["lab","/lab","scenarios executed"],
 ["interop","/interop","Verify wallet signature"],
 ["pay","/pay","Pay the person"],
 ["developers","/developers","Verification is a library call"],
]){
 await p.goto("http://127.0.0.1:3100"+url,{waitUntil:"networkidle"});
 await p.getByText(waitFor,{exact:false}).first().waitFor({timeout:20000});
 console.log("ok",name);
}
await p.goto("http://127.0.0.1:3100/verify?npub=npub1invalid",{waitUntil:"networkidle"});
await p.waitForTimeout(1000);
console.log("verify invalid rendered");
console.log("errors",errors);
await b.close();
