import { chromium } from "playwright";
const b=await chromium.launch({channel:"chrome",headless:true});
const p=await b.newPage({viewport:{width:1200,height:900}});
const errors=[];p.on("pageerror",e=>errors.push(e.message));p.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
for (const [path,text] of [["/demo","Identity time machine"],["/lab","scenarios executed"],["/interop","Verify wallet signature"]]) {
  await p.goto("http://localhost:3000"+path,{waitUntil:"networkidle"});
  await p.getByText(text,{exact:false}).first().waitFor({timeout:20000});
  console.log("offline ok",path);
}
console.log("errors",errors);
await b.close();
