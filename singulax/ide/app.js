/* Singulax Studio Web Runtime
   Runs .sglx directly in the browser. No Python/server required. */

const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
let files = {'main.sglx': '# Welcome to Singulax\nsay("Hello from Singulax!")\n'};
let current = 'main.sglx', blockMode = false, running = false, stopFlag = false, blocks = [];
let keys = Object.create(null), buttons = Object.create(null), mouse = {x:0,y:0,down:false,clicked:false};
let frame = [], lastTime = performance.now();

const api = {
  say: (...a) => log(a.map(v => format(v)).join(' ')),
  print: (...a) => log(a.map(v => format(v)).join(' ')),
  ask: prompt,
  to_number: v => Number(v),
  to_string: v => String(v),
  len: v => v?.length ?? Object.keys(v||{}).length,
  range: (a,b,step=1) => { const r=[]; if(step===0) return r; if(step>0) for(let i=a;i<b;i+=step) r.push(i); else for(let i=a;i>b;i+=step) r.push(i); return r; },
  min: Math.min, max: Math.max, abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round,
  sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, pi: Math.PI,
  random: Math.random,
  clear_screen: () => { frame=[]; },
  draw_rect: (x,y,w,h,fill='white') => frame.push({type:'rect',x:+x,y:+y,w:+w,h:+h,fill}),
  draw_circle: (x,y,r,fill='white') => frame.push({type:'circle',x:+x,y:+y,r:+r,fill}),
  draw_text: (text,x,y,size=20,fill='white') => frame.push({type:'text',text:format(text),x:+x,y:+y,size:+size,fill}),
  key_down: k => !!keys[k], key_pressed: k => !!keys[k],
  mouse_x: () => mouse.x, mouse_y: () => mouse.y, mouse_down: (b='left') => !!buttons[b], mouse_clicked: (b='left') => !!mouse.clicked[b],
  now: () => performance.now()/1000,
  wait: ms => new Promise(r=>setTimeout(r,ms)),
  to_json: v => JSON.stringify(v), from_json: v => JSON.parse(v),
  assert: (ok,msg='Assertion failed') => { if(!ok) throw new Error(msg); },
  file: { read: p => files[p] ?? '', write: (p,v) => { files[p]=String(v); renderFiles(); } }
};

function format(v){ if(v===null||v===undefined) return 'nothing'; if(typeof v==='object') return JSON.stringify(v); return String(v); }
function log(s){ $('console').textContent += s + '\n'; $('console').scrollTop=$('console').scrollHeight; }
function clearLog(){ $('console').textContent=''; }
function renderFiles(){
  const fs = $('fileSelect'); fs.innerHTML='';
  Object.keys(files).filter(f=>f.endsWith('.sglx')).forEach(f=>{const o=document.createElement('option');o.value=f;o.textContent=f;fs.appendChild(o)});
  fs.value=current;
  $('tree').innerHTML=Object.keys(files).map(f=>`<div class="treefile ${f===current?'active':''}" data-file="${esc(f)}">${f.endsWith('.sglx')?'📄':'📦'} ${esc(f)}</div>`).join('');
  $('tree').querySelectorAll('[data-file]').forEach(x=>x.onclick=()=>openFile(x.dataset.file));
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function openFile(f){files[current]=editor.value; current=f; editor.value=files[f]??''; renderFiles();}
$('fileSelect').onchange=e=>openFile(e.target.value);
function newFile(){let n=prompt('New file name','script.sglx');if(!n)return;if(!n.endsWith('.sglx'))n+='.sglx';files[n]='';openFile(n)}
function save(){files[current]=editor.value; localStorage.setItem('singulax-project',JSON.stringify({name:$('projectName').value,files})); log('Saved locally.');}
function newProject(){if(!confirm('Create a new project?'))return; files={'main.sglx':'say("Hello, Singulax!")\n'};current='main.sglx';$('projectName').value='MyProject';editor.value=files[current];renderFiles();clearLog();}
function toggleMode(){
  if(!blockMode){ files[current]=editor.value; blocks=parseSimpleBlocks(editor.value); renderBlocks(); }
  else { files[current]=blocksToCode(); editor.value=files[current]; }
  blockMode=!blockMode; $('codePane').hidden=blockMode; $('blocksPane').hidden=!blockMode; $('modeBtn').textContent=blockMode?'Code':'Blocks';
}
function parseSimpleBlocks(code){
  const out=[]; for(const line of code.split(/\r?\n/)){const s=line.trim(); if(!s)continue;
    let m=s.match(/^say\((.*)\)$/); if(m) out.push({type:'say',text:m[1]});
    else if(m=s.match(/^(?:local|let|var)\s+(\w+)\s*=\s*(.*)$/)) out.push({type:'var',name:m[1],value:m[2]});
    else if(m=s.match(/^if\s+(.+)\s+then$/)) out.push({type:'if',cond:m[1],body:'say("yes")'});
    else if(m=s.match(/^while\s+(.+)\s+do$/)) out.push({type:'while',cond:m[1],body:'break'});
    else if(m=s.match(/^forever\s+do$/)) out.push({type:'forever',body:'break'});
    else if(m=s.match(/^for\s+(\w+)\s*=\s*(.+)\s+do$/)) out.push({type:'for',name:m[1],range:m[2],body:'say('+m[1]+')'});
    else out.push({type:'raw',text:s});
  } return out;
}
function addBlock(type){blocks.push({type});renderBlocks();}
function renderBlocks(){
  const box=$('blocks');box.innerHTML='';
  blocks.forEach((b,i)=>{const d=document.createElement('div');d.className='block';
    if(b.type==='say')d.innerHTML=`say <input value="${esc(b.text||'\"Hello!\"')}">`;
    else if(b.type==='var')d.innerHTML=`variable <input value="${esc(b.name||'x')}"> = <input value="${esc(b.value||'0')}">`;
    else if(b.type==='if')d.innerHTML=`if <input value="${esc(b.cond||'true')}"> then <input value="${esc(b.body||'say(\"yes\")')}"> end`;
    else if(b.type==='while')d.innerHTML=`while <input value="${esc(b.cond||'true')}"> do <input value="${esc(b.body||'break')}"> end`;
    else if(b.type==='forever')d.innerHTML=`forever do <input value="${esc(b.body||'break')}"> end`;
    else if(b.type==='for')d.innerHTML=`for <input value="${esc(b.name||'i')}"> = <input value="${esc(b.range||'1, 10')}"> do <input value="${esc(b.body||'say(i)')}"> end`;
    else d.innerHTML=`code <input value="${esc(b.text||'say(\"hello\")')}">`;
    [...d.querySelectorAll('input')].forEach((el,j)=>el.oninput=()=>{if(b.type==='say')b.text=el.value;if(b.type==='var'){if(j===0)b.name=el.value;else b.value=el.value}if(['if','while'].includes(b.type)){if(j===0)b.cond=el.value;else b.body=el.value}if(b.type==='forever')b.body=el.value;if(b.type==='for'){if(j===0)b.name=el.value;else if(j===1)b.range=el.value;else b.body=el.value}if(b.type==='raw')b.text=el.value}); box.appendChild(d); });
}
function blocksToCode(){return blocks.map(b=>{if(b.type==='say')return `say(${b.text||'"Hello!"'})`;if(b.type==='var')return `local ${b.name||'x'} = ${b.value||'0'}`;if(b.type==='if')return `if ${b.cond||'true'} then\n  ${b.body||'say("yes")'}\nend`;if(b.type==='while')return `while ${b.cond||'true'} do\n  ${b.body||'break'}\nend`;if(b.type==='forever')return `forever do\n  ${b.body||'break'}\nend`;if(b.type==='for')return `for ${b.name||'i'} = ${b.range||'1, 10'} do\n  ${b.body||'say('+ (b.name||'i') +')'}\nend`;return b.text||''}).join('\n\n')+'\n';}

const editor=$('editor'); editor.addEventListener('input',()=>files[current]=editor.value);

function preprocess(s){
  s=s.replace(/#.*$/gm,'');
  s=s.replace(/\botherwise\s+if\b/g,'elseif').replace(/\botherwise\b/g,'else');
  s=s.replace(/\bnothing\b/g,'null').replace(/\band\b/g,'&&').replace(/\bor\b/g,'||').replace(/\bnot\b/g,'!').replace(/~=|!=/g,'!==').replace(/([^!<>=])=([^=])/g,'$1===$2');
  s=s.replace(/\^/g,'**').replace(/\/\//g,'/');
  s=s.replace(/(\w+)\.push\((.*?)\)/g,'$1.push($2)');
  return s.trim();
}
function interpolate(str,env){return String(str).replace(/\{([^{}]+)\}/g,(_,e)=>{try{return format(evalExpr(e,env))}catch{return '{'+e+'}'}})}
function evalExpr(expr,env){
  expr=preprocess(expr);
  if(/^"[\s\S]*"$|^'[^']*'$/.test(expr)) { try{return interpolate(JSON.parse(expr.replace(/^'/,"\"").replace(/'$/,"\"")),env)}catch{} }
  const scope=new Proxy({...api,...env},{has:()=>true,get:(t,k)=>k in t?t[k]:undefined,set:(t,k,v)=>{env[k]=v;t[k]=v;return true}});
  return Function('scope','with(scope){ return ('+expr+'); }')(scope);
}

function parseBlock(lines,start=0,ends=new Set()){
  const body=[]; let i=start;
  while(i<lines.length){let s=lines[i].trim(); let low=s.toLowerCase();
    if(ends.has(low.split(/\s+/)[0]) || ends.has(low)) return {body,i,term:low};
    if(/^if\s+.+\s+then$/i.test(s)){let branches=[],cond=s.replace(/^if\s+/i,'').replace(/\s+then$/i,'');let r=parseBlock(lines,i+1,new Set(['elseif','else','end']));branches.push({cond,body:r.body});i=r.i;if(r.term.startsWith('elseif')){while(true){let c=r.term.replace(/^elseif\s+/i,'').replace(/\s+then$/i,'');let rr=parseBlock(lines,i+1,new Set(['elseif','else','end']));branches.push({cond:c,body:rr.body});i=rr.i;r.term=rr.term;if(!r.term.startsWith('elseif'))break;}}if(r.term==='else'){let rr=parseBlock(lines,i+1,new Set(['end']));branches.push({cond:null,body:rr.body});i=rr.i;}body.push({type:'if',branches});i++;continue;}
    let m=s.match(/^while\s+(.+)\s+do$/i);if(m){let r=parseBlock(lines,i+1,new Set(['end']));body.push({type:'while',cond:m[1],body:r.body});i=r.i+1;continue;}
    if(/^forever\s+do$/i.test(s)){let r=parseBlock(lines,i+1,new Set(['end']));body.push({type:'forever',body:r.body});i=r.i+1;continue;}
    m=s.match(/^for\s+(\w+)\s*=\s*(.+?)\s+do$/i);if(m){let r=parseBlock(lines,i+1,new Set(['end']));body.push({type:'for',name:m[1],range:m[2],body:r.body});i=r.i+1;continue;}
    m=s.match(/^repeat\.until\s*\((.*)\)$/i);if(m){let a=splitArgs(m[1]);if(a.length!==2)throw Error('repeat.until(task, state) requires exactly 2 arguments');body.push({type:'repeatUntil',args:a});i++;continue;}
    m=s.match(/^repeat\s+(.+?)\s+times(?:\s+as\s+(\w+))?$/i);if(m){let r=parseBlock(lines,i+1,new Set(['end']));body.push({type:'repeat',count:m[1],name:m[2]||null,body:r.body});i=r.i+1;continue;}
    m=s.match(/^function\s+(\w+)\s*\((.*?)\)$/i);if(m){let r=parseBlock(lines,i+1,new Set(['end']));body.push({type:'function',name:m[1],params:m[2],body:r.body});i=r.i+1;continue;}
    m=s.match(/^local\s+(.+)$/i)||s.match(/^let\s+(.+)$/i)||s.match(/^var\s+(.+)$/i);if(m){body.push({type:'statement',text:m[1],declare:true});i++;continue;}
    body.push({type:'statement',text:s});i++;
  } return {body,i,term:null};
}
function parseProgram(source){const lines=source.split(/\r?\n/);return parseBlock(lines).body;}

function makeEnv(parent=null){return Object.create(parent||null)}
function splitArgs(s){let out=[],cur='',d=0,q=null;for(let i=0;i<s.length;i++){let c=s[i];if(q){cur+=c;if(c===q&&s[i-1]!=='\\')q=null;continue}if(c==='"'||c==="'"){q=c;cur+=c}else if('([{'.includes(c)){d++;cur+=c}else if(')]}'.includes(c)){d--;cur+=c}else if(c===','&&d===0){out.push(cur.trim());cur=''}else cur+=c}if(cur.trim())out.push(cur.trim());return out}
function setAssignment(text,env){
  text=text.trim(); let m=text.match(/^([\w.\[\]]+)\s*(\+=|-=|\*=|\/=|%=|=)\s*([\s\S]+)$/); if(!m) return false;
  const lhs=m[1], op=m[2], rhs=evalExpr(m[3],env); if(/^[A-Za-z_$][\w$]*$/.test(lhs)){let old=env[lhs];env[lhs]=op==='='?rhs:op==='+='?old+rhs:op==='-='?old-rhs:op==='*='?old*rhs:op==='/='?old/rhs:old%rhs;return true;}
  const fn=Function('env','value','op','with(env){ return function(){ '+lhs+' = op==="="?value:op==="+="?('+lhs+'+value):op==="-="?('+lhs+'-value):op==="*="?('+lhs+'*value):op==="/="?('+lhs+'/value):('+lhs+'%value); } }')(env,rhs,op); fn(); return true;
}
async function execute(nodes,env,depth=0){
  if(depth>1000) throw Error('Maximum execution depth exceeded');
  for(const n of nodes){ if(stopFlag) throw new Error('__STOP__');
    if(n.type==='statement'){
      let t=n.text.trim(); if(!t)continue; if(t==='break') throw {kind:'break'}; if(t==='continue') throw {kind:'continue'}; if(/^return\b/.test(t)) throw {kind:'return',value:t.replace(/^return\s*/,'')?evalExpr(t.replace(/^return\s*/,''),env):undefined};
      if(/^raise\b/.test(t)) throw Error(format(evalExpr(t.replace(/^raise\s*/,''),env)));
      if(setAssignment(t,env)) continue;
      let m=t.match(/^use\s+["']([^"']+)["'](?:\s+as\s+(\w+))?/);if(m){let src=files[m[1]]||'';let child=makeEnv(env);await execute(parseProgram(src),child,depth+1);if(m[2])env[m[2]]=child;else Object.assign(env,child);continue;}
      if(/^say\s*\(/.test(t)||/^print\s*\(/.test(t)){const mm=t.match(/^(?:say|print)\s*\((.*)\)$/s);if(mm){const args=splitArgs(mm[1]).map(x=>evalExpr(x,env));api.say(...args);continue;}}
      const mcall=t.match(/^(\w+)\s*\((.*)\)$/s);if(mcall){evalExpr(t,env);continue;}
      const mdecl=t.match(/^(?:local|let|var)\s+(\w+)\s*=\s*([\s\S]+)$/);if(mdecl){env[mdecl[1]]=evalExpr(mdecl[2],env);continue;}
      if(t.startsWith('local ')||t.startsWith('let ')||t.startsWith('var ')){let mm=t.replace(/^(local|let|var)\s+/,'').trim();let parts=splitArgs(mm);for(const p of parts){let q=p.match(/^(\w+)\s*=\s*(.*)$/);if(q)env[q[1]]=evalExpr(q[2],env);else env[p]=null}continue;}
      evalExpr(t,env); continue;
    }
    if(n.type==='function'){const params=splitArgs(n.params).map(x=>x.trim()).filter(Boolean);env[n.name]=(...args)=>{const local=makeEnv(env);params.forEach((p,i)=>{let vari=p.startsWith('...');p=vari?p.slice(3):p;local[p]=vari?args.slice(i):(args[i]!==undefined?args[i]:evalExpr((p.split('=')[1]||'null'),env))});return executeSync(n.body,local);};continue;}
    if(n.type==='if'){let done=false;for(const b of n.branches){if(b.cond===null||evalExpr(b.cond,env)){try{await execute(b.body,env,depth+1)}catch(e){if(e?.kind==='return'||e?.kind==='break'||e?.kind==='continue')throw e;throw e}done=true;break}}continue;}
    if(n.type==='while'){let guard=0;while(evalExpr(n.cond,env)){if(++guard>100000)throw Error('while loop exceeded 100,000 iterations');try{await execute(n.body,env,depth+1)}catch(e){if(e?.kind==='break')break;if(e?.kind==='continue')continue;throw e}await new Promise(r=>setTimeout(r,0));}continue;}
    if(n.type==='forever'){while(!stopFlag){try{await execute(n.body,env,depth+1)}catch(e){if(e?.kind==='break')break;if(e?.kind==='continue'){}else throw e}await new Promise(r=>requestAnimationFrame(r));}continue;}
    if(n.type==='repeatUntil'){let guard=0;while(!stopFlag){let v;try{v=evalExpr(n.args[0],env)}catch{v=env[n.args[0]]??n.args[0]}if(typeof v==='function')v=await v();else if(v&&typeof v==='object'&&'state' in v)v=v.state;let target=String(n.args[1]).replace(/^['\"]|['\"]$/g,'');if(String(v)===target||(v===true&&target.toLowerCase()==='done'))break;if(++guard>60000)throw Error('repeat.until exceeded safety limit');await new Promise(r=>setTimeout(r,16));}continue;}
    if(n.type==='repeat'){let count=Math.floor(evalExpr(n.count,env));for(let i=1;i<=count;i++){if(n.name)env[n.name]=i;try{await execute(n.body,env,depth+1)}catch(e){if(e?.kind==='break')break;if(e?.kind==='continue')continue;throw e}await new Promise(r=>setTimeout(r,0));}continue;}
    if(n.type==='for'){let a=splitArgs(n.range).map(x=>evalExpr(x,env));let start=a[0],end=a[1],step=a[2]??(start<=end?1:-1);for(let v=start;(step>=0?v<=end:v>=end);v+=step){env[n.name]=v;try{await execute(n.body,env,depth+1)}catch(e){if(e?.kind==='break')break;if(e?.kind==='continue')continue;throw e}await new Promise(r=>setTimeout(r,0));}continue;}
  }
}
function executeSync(nodes,env){
  // Functions are intentionally synchronous so normal expressions like add(2,3) work.
  for(const n of nodes){if(n.type==='statement'){let t=n.text.trim();if(t==='break')throw {kind:'break'};if(t==='continue')throw {kind:'continue'};if(/^return\b/.test(t))throw {kind:'return',value:t.replace(/^return\s*/,'')?evalExpr(t.replace(/^return\s*/,''),env):undefined};if(setAssignment(t,env))continue;let m=t.match(/^say\((.*)\)$/s);if(m){api.say(...splitArgs(m[1]).map(x=>evalExpr(x,env)));continue}evalExpr(t,env)}else if(n.type==='function'){env[n.name]=(...args)=>{const l=makeEnv(env);splitArgs(n.params).forEach((p,i)=>{p=p.trim();if(p.startsWith('...'))l[p.slice(3)]=args.slice(i);else l[p.split('=')[0].trim()]=args[i]??(p.includes('=')?evalExpr(p.split('=')[1],env):null)});try{executeSync(n.body,l)}catch(e){if(e?.kind==='return')return e.value;throw e}}}else if(n.type==='if'){for(const b of n.branches)if(b.cond===null||evalExpr(b.cond,env)){executeSync(b.body,env);break}}else if(n.type==='for'){let a=splitArgs(n.range).map(x=>evalExpr(x,env)),step=a[2]??(a[0]<=a[1]?1:-1);for(let v=a[0];step>=0?v<=a[1]:v>=a[1];v+=step){env[n.name]=v;try{executeSync(n.body,env)}catch(e){if(e?.kind==='break')break;if(e?.kind==='continue')continue;throw e}}}}
}

async function run(){save();clearLog();stopFlag=false;running=true;$('runBtn').disabled=true;log('Running '+current+' in the browser...');frame=[];draw();
  const env=makeEnv(); Object.assign(env,api); env.Math=Math;
  try{await execute(parseProgram(files[current]),env);if(!stopFlag)log('[program finished]')}catch(e){if(e?.message==='__STOP__'||stopFlag)log('[stopped]');else log('Runtime error: '+(e?.message||e))}finally{running=false;$('runBtn').disabled=false;draw();}
}
function stopRun(){stopFlag=true}
function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#10131a';ctx.fillRect(0,0,canvas.width,canvas.height);for(const c of frame){ctx.fillStyle=c.fill||'white';if(c.type==='rect')ctx.fillRect(c.x,c.y,c.w,c.h);if(c.type==='circle'){ctx.beginPath();ctx.arc(c.x,c.y,c.r,0,Math.PI*2);ctx.fill()}if(c.type==='text'){ctx.font=c.size+'px sans-serif';ctx.fillText(c.text,c.x,c.y)}}}
function updateMouse(e){const r=canvas.getBoundingClientRect();mouse.x=(e.clientX-r.left)*canvas.width/r.width;mouse.y=(e.clientY-r.top)*canvas.height/r.height}
window.addEventListener('keydown',e=>{keys[e.key]=true;keys[e.code]=true});window.addEventListener('keyup',e=>{keys[e.key]=false;keys[e.code]=false});canvas.addEventListener('pointermove',updateMouse);canvas.addEventListener('pointerdown',e=>{canvas.focus();updateMouse(e);const b=e.button===2?'right':'left';buttons[b]=true;mouse.clicked[b]=true});canvas.addEventListener('pointerup',e=>{buttons[e.button===2?'right':'left']=false});canvas.addEventListener('contextmenu',e=>e.preventDefault());setInterval(()=>{mouse.clicked={}},120);requestAnimationFrame(draw);

function crc32(data){let c=0xffffffff;for(const b of data){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0}
function u16(n){return new Uint8Array([n&255,(n>>>8)&255])} function u32(n){return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255])}
function concat(arrs){let n=arrs.reduce((s,a)=>s+a.length,0),o=new Uint8Array(n),p=0;for(const a of arrs){o.set(a,p);p+=a.length}return o}
function zipCreate(obj){const enc=new TextEncoder(),locals=[],centrals=[];let offset=0;for(const [name,text] of Object.entries(obj)){const nb=enc.encode(name),data=enc.encode(text),crc=crc32(data),local=concat([new Uint8Array([80,75,3,4]),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(nb.length),u16(0),nb,data]);locals.push(local);const cen=concat([new Uint8Array([80,75,1,2]),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(nb.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),nb]);centrals.push(cen);offset+=local.length}const central=concat(centrals),local=concat(locals);return concat([local,central,new Uint8Array([80,75,5,6]),u16(0),u16(0),u16(centrals.length),u16(centrals.length),u32(central.length),u32(local.length),u16(0)])}
async function exportProject(){save();const blob=new Blob([zipCreate(files)],{type:'application/zip'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=($('projectName').value||'SingulaxProject')+'.sglxproj.zip';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function readU16(d,p){return d[p]|d[p+1]<<8} function readU32(d,p){return (d[p]|d[p+1]<<8|d[p+2]<<16|d[p+3]<<24)>>>0}
async function importProject(e){const f=e.target.files[0];if(!f)return;const d=new Uint8Array(await f.arrayBuffer()),dec=new TextDecoder();let p=0,loaded={};while(p+4<d.length){const sig=readU32(d,p);if(sig===0x04034b50){const method=readU16(d,p+8),csize=readU32(d,p+18),nlen=readU16(d,p+26),elen=readU16(d,p+28),name=dec.decode(d.slice(p+30,p+30+nlen));let data=d.slice(p+30+nlen+elen,p+30+nlen+elen+csize);if(method===0)loaded[name]=dec.decode(data);else if(method===8){try{const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));loaded[name]=dec.decode(new Uint8Array(await new Response(stream).arrayBuffer()))}catch(err){log('Could not import compressed entry '+name)}}p+=30+nlen+elen+csize}else if(sig===0x06054b50)break;else p++}if(Object.keys(loaded).length){files=loaded;current=Object.keys(files).find(x=>x.endsWith('.sglx'))||'main.sglx';$('projectName').value=f.name.replace(/\.sglxproj\.zip$/i,'');editor.value=files[current]||'';renderFiles();save();log('Imported project.')}}
function loadLocal(){try{const x=JSON.parse(localStorage.getItem('singulax-project')||'null');if(x?.files){files=x.files;current=Object.keys(files).find(f=>f.endsWith('.sglx'))||'main.sglx';$('projectName').value=x.name||'MyProject';}}catch{}}
loadLocal();renderFiles();editor.value=files[current];
