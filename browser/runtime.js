/* SingulaX browser/Node runtime. Dependency-free ES module. */
const sleep=ms=>new Promise(r=>setTimeout(r,Math.max(0,ms)));
function splitArgs(s){const out=[];let start=0,depth=0,quote=null,esc=false;for(let i=0;i<s.length;i++){const c=s[i];if(esc){esc=false;continue}if(c==='\\'&&quote){esc=true;continue}if(quote){if(c===quote)quote=null;continue}if(c==='"'||c==="'"){quote=c;continue}if('([{'.includes(c))depth++;else if(')]}'.includes(c))depth--;else if(c===','&&depth===0){out.push(s.slice(start,i).trim());start=i+1}}if(s.slice(start).trim()||s.trim()==='')out.push(s.slice(start).trim());return out.filter(Boolean)}
function lineError(n,msg,col=1){const e=new Error(`line ${n}, column ${col}: ${msg}`);e.line=n;e.column=col;return e}
function stripDoubleSlashComments(src){
 let out='', inStr=null, esc=false, inComment=false;
 for(let i=0;i<src.length;i++){const c=src[i], n=src[i+1];
  if(inComment){if(c==='/'&&n==='/'){inComment=false;i++;out+='  ';}else if(c==='\n')out+='\n';else out+=' ';continue}
  if(inStr){out+=c;if(esc)esc=false;else if(c==='\\')esc=true;else if(c===inStr)inStr=null;continue}
  if((c==='\"'||c==="'")&& !inComment){inStr=c;out+=c;continue}
  if(c==='/'&&n==='/'){inComment=true;i++;out+='  ';continue}
  out+=c;
 }
 return out;
}
class SingulaxRuntime{
 constructor(host={}){this.host=host;this.env=Object.create(null);this.running=false;this.keys=new Set();this.buttons=new Set();this.mouse={x:0,y:0};this.touch={x:0,y:0,active:false};this.gamepads={};this.clicked=new Set();this.frame=[];this.assets=Object.create(null);this.scopeStack=[];this.output=[];this.clock=0;
  const E=this.env;
  E.say=(...a)=>this.say(a.map(v=>this.format(v)).join(' '));E.print=E.say;E.log=E.say;
  E.input=async p=>this.host.input?this.host.input(String(p??'')):globalThis.prompt?.(String(p??''))??'';
  E.key_down=k=>this.keys.has(String(k));E.key_pressed=k=>{const s=String(k);const v=this.clicked.has('key:'+s);this.clicked.delete('key:'+s);return v};
  E.mouse_down=b=>this.buttons.has(String(b||'left'));E.mouse_clicked=b=>{const s='mouse:'+String(b||'left');const v=this.clicked.has(s);this.clicked.delete(s);return v};E.mouse_x=()=>this.mouse.x;E.mouse_y=()=>this.mouse.y;
  E.touching=()=>this.touch.active;E.touch_x=()=>this.touch.x;E.touch_y=()=>this.touch.y;E.touch_started=()=>this.clicked.has('touch:start');E.touch_ended=()=>this.clicked.has('touch:end');
  E.gamepad_connected=i=>!!this.gamepads[i||0];E.gamepad_button=(i,b)=>!!this.gamepads[i||0]?.buttons?.[b];E.gamepad_axis=(i,a)=>this.gamepads[i||0]?.axes?.[a]||0;
  E.clear_screen=()=>{this.frame=[];this.emitFrame()};
  E.draw_rect=(x,y,w,h,fill='white')=>{this.frame.push({type:'rect',x:+x,y:+y,w:+w,h:+h,fill});this.emitFrame()};
  E.draw_circle=(x,y,r,fill='white')=>{this.frame.push({type:'circle',x:+x,y:+y,r:+r,fill});this.emitFrame()};
  E.draw_text=(text,x,y,size=20,fill='white')=>{this.frame.push({type:'text',text:String(text),x:+x,y:+y,size:+size,fill});this.emitFrame()};
  E.draw_line=(x1,y1,x2,y2,width=2,fill='white')=>{this.frame.push({type:'line',x1:+x1,y1:+y1,x2:+x2,y2:+y2,width:+width,fill});this.emitFrame()};
  E.draw_image=(asset,x,y,w,h)=>{this.frame.push({type:'image',asset:String(asset),x:+x,y:+y,w:+w,h:+h});this.emitFrame()};
  E.draw_cube=(x,y,z,size=1,fill='white')=>{this.frame.push({type:'cube',x:+x,y:+y,z:+z,size:+size,fill});this.emitFrame()};
  E.set_3d=v=>{this.host.mode3d?.(!!v)};
  E.wait=seconds=>sleep((+seconds||0)*1000);E.wait_ms=ms=>sleep(+ms||0);
  E.file_read=async p=>this.host.fileRead?this.host.fileRead(String(p)):'';E.file_write=async(p,c)=>this.host.fileWrite?this.host.fileWrite(String(p),String(c)):false;
  E.asset=(p)=>this.assets[String(p)]??null;E.asset_url=E.asset;
  E.audio={during:p=>!!this.host.audioDuring?.(String(p))};
  E.play_audio=(p,loop=false)=>this.host.playAudio?.(String(p),!!loop);E.stop_audio=p=>this.host.stopAudio?.(p?String(p):null);
  E.to_json=v=>JSON.stringify(v);E.from_json=s=>JSON.parse(s);E.type_of=v=>typeof v;E.exists=v=>v!==undefined&&v!==null;
  E.random=(a=1,b=null)=>{if(b===null){b=a;a=0}return Math.random()*(+b-+a)+ +a};E.random_int=(a=0,b=1)=>Math.floor(E.random(a,b+1));E.random_choice=a=>a?.length?a[Math.floor(Math.random()*a.length)]:null;
  E.abs=Math.abs;E.floor=Math.floor;E.ceil=Math.ceil;E.round=Math.round;E.sqrt=Math.sqrt;E.pow=Math.pow;E.sin=Math.sin;E.cos=Math.cos;E.tan=Math.tan;E.asin=Math.asin;E.acos=Math.acos;E.atan=Math.atan;E.atan2=Math.atan2;E.min=Math.min;E.max=Math.max;E.clamp=(v,a,b)=>Math.min(Math.max(v,a),b);E.lerp=(a,b,t)=>a+(b-a)*t;E.pi=Math.PI;E.e=Math.E;E.tau=Math.PI*2;E.deg=(r)=>r*180/Math.PI;E.rad=(d)=>d*Math.PI/180;
  // Lists and data helpers
  E.list=(...items)=>items; E.push=(list,value)=>{if(!Array.isArray(list)) throw Error('push requires a list'); list.push(value); return list.length}; E.pop=list=>Array.isArray(list)?list.pop():null; E.list_add=E.push; E.list_remove=(list,index)=>Array.isArray(list)?list.splice(Number(index),1)[0]:null; E.list_get=(list,index)=>Array.isArray(list)?list[Number(index)]:null; E.list_set=(list,index,value)=>{if(!Array.isArray(list)) throw Error('list_set requires a list'); list[Number(index)]=value; return value};
  const dataStore=new Map();
  const dataApi=(initial)=>{ const obj={}; if(initial&&typeof initial==='object'&&!Array.isArray(initial)) Object.assign(obj,initial); return obj };
  dataApi.store=(key,value)=>{dataStore.set(String(key),value);return value}; dataApi.find=key=>dataStore.get(String(key)); dataApi.has=key=>dataStore.has(String(key)); dataApi.clear=()=>{dataStore.clear();return true};
  E.data=dataApi;
  E.find=(collection,needle)=>{if(Array.isArray(collection)) return collection.find(v=>typeof needle==='function'?needle(v):v===needle); if(collection&&typeof collection==='object') return Object.keys(collection).find(k=>collection[k]===needle); return null};
  E.get=(target,key,fallback=null)=>{if(target==null)return fallback; const v=target[key]; return v===undefined?fallback:v};
  this.lastAnswer=null; this.lastResult=null;
  E.answer=()=>this.lastAnswer; E.result=v=>{this.lastResult=v;return v};
  E.ask=async(promptText='')=>{const v=await (this.host.input?this.host.input(String(promptText)):Promise.resolve('')); this.lastAnswer=v; return v};
  E.string=v=>String(v);E.number=v=>Number(v);E.boolean=v=>!!v;E.length=v=>v?.length??0;E.concat=(...a)=>a.join('');
  E.time=()=>performance.now()/1000;E.seconds=E.time;
 }
 format(v){if(typeof v==='string')return v;try{return JSON.stringify(v)}catch{return String(v)}}
 say(s){this.output.push(String(s));this.host.output?.(String(s))}
 emitFrame(){this.host.frame?.(this.frame.slice())}
 setInput(i={}){for(const k of i.keys||[])this.keys.add(String(k));for(const k of i.up||[])this.keys.delete(String(k));for(const k of i.pressed||[])this.clicked.add('key:'+String(k));if(i.mouse)this.mouse=i.mouse;for(const b of i.buttons||[])this.buttons.add(String(b));for(const b of i.buttonup||[])this.buttons.delete(String(b));for(const b of i.clicked||[])this.clicked.add('mouse:'+String(b));if(i.touch)this.touch=i.touch;if(i.touchStart)this.clicked.add('touch:start');if(i.touchEnd)this.clicked.add('touch:end');if(i.gamepads)this.gamepads=i.gamepads}
 async run(source,options={}){this.running=true;this.output=[];this.frame=[];try{const program=this.parse(source);return await this.exec(program,this.env)}catch(e){this.host.error?.(e);this.say('Error: '+e.message);throw e}finally{this.running=false}}
 async runProject(project,{entry=null}={}){
  this.running=true;
  this.assets=project.assets||{};
  const names=Object.keys(project.files||{}).filter(n=>n.endsWith('.sglx'));
  const chosen=entry?names.filter(n=>n===entry):names;
  const batches=new Map();
  for(const n of chosen){
    const src=String(project.files[n]??'');
    const clean=stripDoubleSlashComments(src).replace(/\r/g,'');
    const m=clean.match(/^\s*!sequence\s*\(\s*(\d+)\s*\)\s*$/mi);
    const batch=m?Math.max(1,Number(m[1])):1;
    if(!batches.has(batch))batches.set(batch,[]);
    batches.get(batch).push({name:n,source:src});
  }
  const ordered=[...batches.keys()].sort((a,b)=>a-b);
  for(const batch of ordered){
    if(!this.running)break;
    const scripts=batches.get(batch);
    const programs=scripts.map(x=>({name:x.name,program:this.parse(x.source)}));
    for(const item of programs){
      for(const node of item.program){
        if(node.type==='function')this.env[node.name]=async(...args)=>{
          const child=Object.create(this.env);
          node.args.forEach((a,i)=>child[a]=args[i]);
          try{return await this.exec(node.body,child)}
          catch(e){if(e?.__return)return e.value;throw e}
        };
      }
    }
    await Promise.all(programs.map(item=>this.exec(item.program,this.env)));
  }
  return null;
 }
 parse(src){const raw=stripDoubleSlashComments(String(src).replace(/\r/g,'' )).split('\n');const lines=raw.map((s,i)=>({s:s.trim(),n:i+1,raw:s})).filter(x=>x.s&&!x.s.startsWith('#')&&!x.s.startsWith('--'));const root=[];const stack=[root],frames=[];
  for(const l of lines){const s=l.s;let m;
   if(/^!sequence\s*\(\s*\d+\s*\)$/i.test(s))continue;
   if(/^end\b/i.test(s)){if(stack.length===1)throw lineError(l.n,'unexpected end');stack.pop();if(frames.length)frames.pop();continue}
   if(/^(?:else|elseif|otherwise\s+if|otherwise)\b/i.test(s)){const f=frames.at(-1);if(!f||f.type!=='if')throw lineError(l.n,'unexpected else/elseif');stack.pop();let kind='else',cond=null;if(/^(?:elseif|otherwise\s+if)/i.test(s)){kind='elseif';cond=s.replace(/^(?:elseif|otherwise\s+if)\s+/i,'').replace(/\s+then$/i,'').trim()}else if(!/^else\b/i.test(s)&&!/^otherwise\b/i.test(s))throw lineError(l.n,'invalid conditional branch');const b={kind,cond,body:[]};f.branches.push(b);stack.push(b.body);continue}
   if(m=/^if\s+(.+?)\s+then$/i.exec(s)){const n={type:'if',line:l.n,branches:[{kind:'if',cond:m[1],body:[]}]};stack.at(-1).push(n);frames.push(n);stack.push(n.branches[0].body);continue}
   if(m=/^while\s+(.+?)\s+do$/i.exec(s)){const n={type:'while',line:l.n,cond:m[1],body:[]};stack.at(-1).push(n);frames.push(n);stack.push(n.body);continue}
   if(/^forever(?:\s+do)?$/i.test(s)){const n={type:'forever',line:l.n,body:[]};stack.at(-1).push(n);frames.push(n);stack.push(n.body);continue}
   if(m=/^repeat\s*\((.*)\)$/i.exec(s)){const n={type:'repeat',line:l.n,count:m[1],body:[]};stack.at(-1).push(n);frames.push(n);stack.push(n.body);continue}
   if(m=/^repeat\s+(.+?)\s+times$/i.exec(s)){const n={type:'repeat',line:l.n,count:m[1],body:[]};stack.at(-1).push(n);frames.push(n);stack.push(n.body);continue}
   if(m=/^repeat\.until\.statement\s*\((.*)\)$/i.exec(s)){const args=splitArgs(m[1]);if(args.length!==2)throw lineError(l.n,'repeat.until.statement(statement, state) requires exactly 2 arguments');const n={type:'repeatUntilStatement',line:l.n,args,body:[]};stack.at(-1).push(n);frames.push(n);stack.push(n.body);continue}
   if(m=/^repeat\.until\s*\((.*)\)$/i.exec(s)){const args=splitArgs(m[1]);if(args.length!==2)throw lineError(l.n,'repeat.until(task, state) requires exactly 2 arguments');const n={type:'repeatUntil',line:l.n,args,body:[]};stack.at(-1).push(n);frames.push(n);stack.push(n.body);continue}
   if(m=/^wait\.until\s*\((.*)\)$/i.exec(s)){stack.at(-1).push({type:'waitUntil',line:l.n,args:splitArgs(m[1])});continue}
   if(m=/^for\s+([A-Za-z_]\w*)\s*=\s*(.+?)\s+do$/i.exec(s)){const parts=splitArgs(m[2]);if(parts.length<2)throw lineError(l.n,'for requires start and end');const n={type:'for',line:l.n,name:m[1],parts,body:[]};stack.at(-1).push(n);frames.push(n);stack.push(n.body);continue}
   if(m=/^(?:for\s+)?each\s+([A-Za-z_]\w*)\s+in\s+(.+?)\s+do$/i.exec(s)){const n={type:'foreach',line:l.n,name:m[1],expr:m[2],body:[]};stack.at(-1).push(n);frames.push(n);stack.push(n.body);continue}
   if(m=/^(?:function|func)\s+([A-Za-z_]\w*)\s*\((.*?)\)$/i.exec(s)){const n={type:'function',line:l.n,name:m[1],args:splitArgs(m[2]),body:[]};stack.at(-1).push(n);frames.push(n);stack.push(n.body);continue}
   if(/^else\s*$/i.test(s))throw lineError(l.n,'else must follow if');
   stack.at(-1).push({type:'line',s,line:l.n});
  }
  if(stack.length!==1){const f=frames.at(-1);throw lineError(f?.line||lines.at(-1)?.n||1,'missing end')}
  return root;
 }
 expr(text,scope){let s=String(text).trim();s=s.replace(/\btypeof\s*\(/g,'type_of(');s=s.replace(/\btrue\b/gi,'true').replace(/\bfalse\b/gi,'false').replace(/\bnil\b/gi,'null').replace(/~=|!=/g,'!==').replace(/(?<![=!<>])=(?!=)/g,'===').replace(/\band\b/gi,'&&').replace(/\bor\b/gi,'||').replace(/\bnot\b/gi,'!').replace(/\.\./g,'+');s=s.replace(/\b([A-Za-z_]\w*)\s*\{/g,'$1['); // gentle compatibility
  const reserved=new Set(['await','break','case','catch','class','const','continue','debugger','default','delete','do','else','export','extends','finally','for','function','if','import','in','instanceof','let','new','return','super','switch','this','throw','try','typeof','var','void','while','with','yield']);const names=new Set(),pairs=[];for(let o=scope;o&&o!==Object.prototype;o=Object.getPrototypeOf(o))for(const k of Object.keys(o)){if(names.has(k)||! /^[A-Za-z_$][\w$]*$/.test(k)||reserved.has(k))continue;names.add(k);pairs.push([k,scope[k]])}const keys=pairs.map(p=>p[0]),vals=pairs.map(p=>p[1]);try{return Function(...keys,'Math','return ('+s+');')(...vals,Math)}catch(e){if(Object.prototype.hasOwnProperty.call(scope,s))return scope[s];if(/^['"`].*['"`]$/.test(s))return s.slice(1,-1);throw e}}
 evalArgs(s,scope){return splitArgs(s).map(a=>this.expr(a,scope))}
 async line(s,scope,lineNo){let m;
  if(/^break$/i.test(s))throw {__break:true};if(/^continue$/i.test(s))throw {__continue:true};
  if(m=/^(?:local|var|let)\s+([A-Za-z_]\w*)\s*(?:=\s*(.*))?$/i.exec(s)){scope[m[1]]=m[2]===undefined?null:this.expr(m[2],scope);return scope[m[1]]}
  if(m=/^([A-Za-z_]\w*)\s*=\s*ask\s*\((.*)\)$/i.exec(s)){const n=m[1],v=await this.env.ask(...this.evalArgs(m[2],scope));scope[n]=v;this.lastAnswer=v;return v}
  if(m=/^([A-Za-z_]\w*)\s*=\s*(?:result)\s*\((.*)\)$/i.exec(s)){const n=m[1],v=this.env.result(...this.evalArgs(m[2],scope));scope[n]=v;return v}
  if(m=/^([A-Za-z_]\w*)\s*([+\-*/%]?=)\s*(.*)$/i.exec(s)){const n=m[1],op=m[2],v=this.expr(m[3],scope);let owner=scope;while(owner&& !Object.prototype.hasOwnProperty.call(owner,n))owner=Object.getPrototypeOf(owner);owner=owner||scope;if(op==='=')owner[n]=v;else owner[n]=this.expr(`${n} ${op[0]} (${m[3]})`,scope);return owner[n]}
  if(m=/^([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*([+\-*/%]?=)\s*(.*)$/i.exec(s)){const o=scope[m[1]];if(!o)throw lineError(lineNo,'unknown object '+m[1]);const op=m[3],v=this.expr(m[4],scope);if(op==='=')o[m[2]]=v;else o[m[2]]=this.expr(`(${JSON.stringify(o[m[2]])}) ${op[0]} (${m[4]})`,scope);return}
  if(m=/^(?:say|print|log)\s*\((.*)\)$/i.exec(s)){const args=this.evalArgs(m[1],scope);this.env.say(...args);return args.at(-1)}
  if(m=/^return(?:\s+(.+))?$/i.exec(s))throw {__return:true,value:m[1]===undefined?null:this.expr(m[1],scope)};
  if(m=/^wait\s*\((.*)\)$/i.exec(s)){await this.env.wait(this.expr(m[1],scope));return}
  if(m=/^([A-Za-z_]\w*)\s*\((.*)\)$/i.exec(s)){const fn=scope[m[1]]??this.env[m[1]];if(typeof fn!=='function')throw lineError(lineNo,'unknown function '+m[1]);const r=fn(...this.evalArgs(m[2],scope));if(r?.then)return await r;return r}
  if(m=/^([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*\((.*)\)$/i.exec(s)){const o=scope[m[1]]??this.env[m[1]],fn=o?.[m[2]];if(typeof fn!=='function')throw lineError(lineNo,`unknown method ${m[2]}`);const r=fn.apply(o,this.evalArgs(m[3],scope));if(r?.then)return await r;return r}
  try{this.expr(s,scope)}catch(e){throw lineError(lineNo,e.message||'invalid expression')}
 }
 async resolveUntil(args,scope){
  const taskText=String(args[0]??'').trim();
  let value;
  try{ value=this.expr(taskText,scope); }catch{ value=scope[taskText]??taskText; }
  if(typeof value==='function') value=await value();
  else if(value&&typeof value==='object'&&'state' in value) value=value.state;
  return value;
 }
 async resolveUntilStatement(args,scope,lineNo){
  const statement=String(args[0]??'').trim();
  if(!statement) throw lineError(lineNo,'repeat.until.statement requires a statement');
  try{return await this.expr(statement,scope)}catch(exprError){return await this.line(statement,scope,lineNo)}
 }
 matchesState(value,target){
  const t=String(target??'').replace(/^['\"]|['\"]$/g,'');
  if(t.toLowerCase()==='true') return !!value;
  if(t.toLowerCase()==='false') return !value;
  return String(value)===t || value===target || (value===true && t.toLowerCase()==='done');
 }
 async until(args,scope){
  let guard=0;
  while(this.running){
   const value=await this.resolveUntil(args,scope);
   if(this.matchesState(value,args[1])) return value;
   if(++guard>60000) throw Error('until condition exceeded safety limit');
   await sleep(16);
  }
  return null;
 }
 async exec(nodes,scope=this.env){for(const n of nodes){if(!this.running)break;if(n.type==='line'){await this.line(n.s,scope,n.line);this.emitFrame();continue}
   if(n.type==='function'){scope[n.name]=async(...args)=>{const child=Object.create(scope);n.args.forEach((a,i)=>child[a]=args[i]);try{return await this.exec(n.body,child)}catch(e){if(e?.__return)return e.value;throw e}};continue}
   if(n.type==='if'){for(const b of n.branches){if(b.kind==='else'||this.expr(b.cond,scope)){await this.exec(b.body,scope);break} }continue}
   if(n.type==='while'){let guard=0;while(this.running&&this.expr(n.cond,scope)){if(++guard>100000)throw lineError(n.line,'while loop limit exceeded');try{await this.exec(n.body,scope)}catch(e){if(e?.__break)break;if(e?.__continue)continue;throw e}await sleep(0)}continue}
   if(n.type==='forever'){while(this.running){try{await this.exec(n.body,scope)}catch(e){if(e?.__break)break;if(!e?.__continue)throw e}await sleep(16)}continue}
   if(n.type==='repeat'){const c=Math.max(0,Math.floor(Number(this.expr(n.count,scope))||0));for(let i=0;i<c&&this.running;i++){try{await this.exec(n.body,scope)}catch(e){if(e?.__break)break;if(e?.__continue)continue;throw e}await sleep(0)}continue}
   if(n.type==='repeatUntil'){let guard=0;while(this.running){const v=await this.resolveUntil(n.args,scope);if(this.matchesState(v,n.args[1]))break;try{await this.exec(n.body,scope)}catch(e){if(e?.__break)break;if(e?.__continue){}else throw e}if(++guard>60000)throw lineError(n.line,'repeat.until exceeded safety limit');await sleep(16)}continue}
   if(n.type==='repeatUntilStatement'){let guard=0;while(this.running){const v=await this.resolveUntilStatement(n.args,scope,n.line);if(this.matchesState(v,n.args[1]))break;try{await this.exec(n.body,scope)}catch(e){if(e?.__break)break;if(e?.__continue){}else throw e}if(++guard>60000)throw lineError(n.line,'repeat.until.statement exceeded safety limit');await sleep(16)}continue}
   if(n.type==='waitUntil'){await this.until(n.args,scope);continue}
   if(n.type==='for'){let a=Number(this.expr(n.parts[0],scope))||0,b=Number(this.expr(n.parts[1],scope))||0,step=n.parts[2]!==undefined?Number(this.expr(n.parts[2],scope)):(a<=b?1:-1);if(!step)throw lineError(n.line,'for step cannot be zero');for(let i=a;this.running&&(step>0?i<=b:i>=b);i+=step){scope[n.name]=i;try{await this.exec(n.body,scope)}catch(e){if(e?.__break)break;if(e?.__continue)continue;throw e}}continue}
   if(n.type==='foreach'){const v=this.expr(n.expr,scope);for(const item of v??[]){scope[n.name]=item;try{await this.exec(n.body,scope)}catch(e){if(e?.__break)break;if(e?.__continue)continue;throw e}}continue}
  }}
}

// Browser bridge: expose the runtime without requiring an ES module import.
if (typeof globalThis !== "undefined") globalThis.SingulaxRuntime = SingulaxRuntime;
