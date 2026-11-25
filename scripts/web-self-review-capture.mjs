import { chromium } from '../node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const args=Object.fromEntries(process.argv.slice(2).reduce((a,x,i,v)=>(x.startsWith('--')&&a.push([x.slice(2),v[i+1]]),a),[]));
if(!args.config||!args.out||!args.phase) throw new Error('Usage: node scripts/web-self-review-capture.mjs --config settings.json --out evidence-dir --phase label');
const config=JSON.parse(fs.readFileSync(args.config,'utf8'));
const out=path.resolve(args.out,args.phase); fs.mkdirSync(out,{recursive:true});
const sha=(data)=>crypto.createHash('sha256').update(data).digest('hex');
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const source={head:git('rev-parse','HEAD'),diff_sha256:sha(execFileSync('git',['diff','--binary'])),status:git('status','--short')};
const browser=await chromium.launch({headless:true});
const results=[];
const waitStable=async(page)=>{
  await page.evaluate(async()=>{
    await document.fonts.ready;
    const visible=[...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight});
    await Promise.all(visible.map(async i=>{
      if(!i.complete) await Promise.race([new Promise(r=>{i.addEventListener('load',r,{once:true});i.addEventListener('error',r,{once:true})}),new Promise(r=>setTimeout(r,5000))]);
      if(i.complete) await i.decode().catch(()=>{});
    }));
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  });
  const state=await page.evaluate(async()=>{
    const finite=document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity && a.playState==='running');
    await Promise.race([Promise.allSettled(finite.map(a=>a.finished)),new Promise(r=>setTimeout(r,6000))]);
    return {finiteAnimations:finite.length,unfinishedAnimations:finite.filter(a=>a.playState==='running').length,fonts:document.fonts.status};
  });
  return state;
};
for(const c of config.cases){
 for(const width of config.widths){
  for(const mode of (c.modes||['default'])){
   const id=`${args.phase}-${c.kind}-${c.role}-${width}-${mode}`;
   const page=await browser.newPage({viewport:{width,height:config.height||900},deviceScaleFactor:1,reducedMotion:mode==='reduced'?'reduce':'no-preference'});
   const row={id,url:c.url,kind:c.kind,role:c.role,width,height:config.height||900,mode,captured_at:new Date().toISOString(),source,images:[],errors:[]};
   page.on('pageerror',e=>row.errors.push(e.message));
   try{
    const res=await page.goto(c.url,{waitUntil:'domcontentloaded',timeout:30000});row.status=res?.status();
    row.readiness=await waitStable(page);
    if(c.settleMs) await page.waitForTimeout(c.settleMs);
    row.extraSettleMs=c.settleMs||0;
    row.title=await page.title();row.page_height=await page.evaluate(()=>document.documentElement.scrollHeight);
    for(const [label,fraction] of [['top',0],['middle',.5],['footer',1]]){
      await page.evaluate(f=>window.scrollTo({top:(document.documentElement.scrollHeight-innerHeight)*f,behavior:'instant'}),fraction);
      await page.waitForTimeout(450);const state=await waitStable(page);
      const scrollY=await page.evaluate(()=>window.scrollY);
      const name=`${id}-${label}.png`, file=path.join(out,name);
      await page.screenshot({path:file});row.images.push({name,sha256:sha(fs.readFileSync(file)),scrollY,state});
    }
   }catch(e){row.error=String(e)}
   results.push(row);console.log(id,row.status??'error',row.error??'');await page.close();
  }
 }
}
await browser.close();
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({schema:1,phase:args.phase,config:config,source,results},null,2));
if(results.some(r=>r.error||r.status!==200||r.readiness?.unfinishedAnimations)) process.exitCode=1;
