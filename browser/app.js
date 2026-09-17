// SingulaX browser runtime is loaded by index.html before this file.
const $=id=>document.getElementById(id), editor=$('editor'), consoleEl=$('console'), canvas=$('game');
let project={name:'MyProject',files:{'main.sglx':'# Welcome to SingulaX\nlocal score = 0\nforever do\n  clear_screen()\n  draw_text("Score: " .. score, 24, 38, 24, "white")\n  if key_down("ArrowRight") then\n    score += 1\n  end\n  wait(0.016)\nend\n'},assets:{},settings:{theme:'midnight',fontSize:15,autosave:true}};
let current='main.sglx',mode='code',runtime=null,blocks=[];const keys=new Set(),buttons=new Set();let mouse={x:0,y:0},touch={x:0,y:0,active:false};
const keywords=['if','then','elseif','else','end','while','do','forever','for','each','in','repeat','times','repeat.until','repeat.until.statement','wait','wait.until','ask','answer','result','get','find','list','push','pop','data','data.store','data.find','function','local','var','let','return','break','continue'];
const builtins=['say','print','input','random','random_int','random_choice','abs','floor','ceil','round','sqrt','pow','sin','cos','tan','min','max','clamp','lerp','length','to_json','from_json','draw_rect','draw_circle','draw_line','draw_text','draw_image','draw_cube','clear_screen','key_down','key_pressed','mouse_down','mouse_clicked','mouse_x','mouse_y','touching','touch_x','touch_y','gamepad_connected','gamepad_button','gamepad_axis','asset','asset_url','play_audio','stop_audio','ask','answer','result','get','find','list','push','pop'];
function log(s){consoleEl.textContent+=(consoleEl.textContent?'\n':'')+s;consoleEl.scrollTop=consoleEl.scrollHeight}
function esc(s=''){return String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;')}
function save(){project.files[current]=editor.value;project.name=$('projectName').value||'MyProject';project.settings={theme:$('theme')?.value||project.settings.theme,fontSize:+($('fontSize')?.value||project.settings.fontSize),autosave:$('autosave')?.checked??project.settings.autosave};localStorage.setItem('singulax-project',JSON.stringify(project));if(project.settings.autosave)log('Saved locally.')}
function renderTree(){const paths=Object.keys(project.files).sort(),folders=new Set();for(const f of paths){const parts=f.split('/');for(let i=1;i<parts.length;i++)folders.add(parts.slice(0,i).join('/'))}const fh=f=>`<div class="folder" style="padding-left:${8+f.split('/').length*12}px"><span>📁 ${esc(f.split('/').at(-1))}</span><button class="mini" data-new-in-folder="${encodeURIComponent(f)}">＋</button><button class="mini" data-rename-folder="${encodeURIComponent(f)}">✎</button><button class="mini" data-delete-folder="${encodeURIComponent(f)}">×</button></div>`;const ff=f=>{const d=f.split('/').length-1,n=f.split('/').at(-1);return `<div class="treeitem ${f===current?'active':''}" style="padding-left:${8+d*18}px"><button class="name" data-file="${encodeURIComponent(f)}">📄 ${esc(n)}</button><button class="mini" data-move="${encodeURIComponent(f)}">↗</button><button class="mini" data-rename="${encodeURIComponent(f)}">✎</button><button class="mini" data-delete="${encodeURIComponent(f)}">×</button></div>`};const aa=Object.keys(project.assets).map(a=>`<div class="treeitem"><button class="name" data-asset="${encodeURIComponent(a)}">🧩 ${esc(a)}</button><button class="mini" data-rename-asset="${encodeURIComponent(a)}">✎</button><button class="mini" data-delete-asset="${encodeURIComponent(a)}">×</button></div>`).join('');$('tree').innerHTML='<b>Scripts</b>'+[...folders].sort().map(fh).join('')+paths.map(ff).join('')+'<hr><b>Assets</b>'+aa}
function render(){renderTree();$('projectName').value=project.name;editor.value=project.files[current]??'';$('fileTitle').textContent=current;applySettings();diagnose()}
function openFile(f){project.files[current]=editor.value;current=f;render()}
$('tree').onclick=e=>{const d=e.target.dataset;if(d.file){openFile(decodeURIComponent(d.file));return}if(d.rename){const old=decodeURIComponent(d.rename),base=old.split('/').at(-1),n=prompt('Rename script',base);if(n&&n!==base){const to=old.includes('/')?old.slice(0,old.lastIndexOf('/')+1)+n:n;project.files[to]=project.files[old];delete project.files[old];if(current===old)current=to;render();save()}}if(d.delete){const f=decodeURIComponent(d.delete);if(Object.keys(project.files).length===1)return alert('Keep at least one script.');if(confirm('Delete '+f+'?')){delete project.files[f];if(current===f)current=Object.keys(project.files)[0];render();save()}}if(d.move){const f=decodeURIComponent(d.move),folder=prompt('Move script into folder (blank for root)','');if(folder!==null){const clean=folder.trim().replace(/^\/+|\/+$/g,''),name=f.split('/').at(-1),to=clean?clean+'/'+name:name;if(to!==f){project.files[to]=project.files[f];delete project.files[f];if(current===f)current=to;render();save()}}}if(d.newInFolder){const folder=decodeURIComponent(d.newInFolder),n=prompt('New script name','script.sglx');if(n){let to=folder+'/'+n;if(!to.endsWith('.sglx'))to+='.sglx';project.files[to]='';openFile(to);save()}}if(d.renameFolder){const old=decodeURIComponent(d.renameFolder),base=old.split('/').at(-1),n=prompt('Rename folder',base);if(n&&n!==base){const parent=old.includes('/')?old.slice(0,old.lastIndexOf('/')+1):'',to=parent+n;for(const k of Object.keys(project.files))if(k===old||k.startsWith(old+'/')){project.files[to+k.slice(old.length)]=project.files[k];delete project.files[k]}if(current===old||current.startsWith(old+'/'))current=to+current.slice(old.length);render();save()}}if(d.deleteFolder){const f=decodeURIComponent(d.deleteFolder);if(confirm('Delete folder and its scripts: '+f+'?')){for(const k of Object.keys(project.files))if(k===f||k.startsWith(f+'/'))delete project.files[k];current=Object.keys(project.files)[0]||'main.sglx';render();save()}}if(d.asset){previewAsset(decodeURIComponent(d.asset))}if(d.renameAsset){const old=decodeURIComponent(d.renameAsset),n=prompt('Rename asset',old);if(n&&n!==old){project.assets[n]=project.assets[old];delete project.assets[old];render();save()}}if(d.deleteAsset){const a=decodeURIComponent(d.deleteAsset);if(confirm('Delete '+a+'?')){delete project.assets[a];render();save()}}};
$('saveBtn').onclick=save;$('clearConsole').onclick=()=>consoleEl.textContent='';$('newFileBtn').onclick=()=>{let n=prompt('File name','script.sglx');if(!n)return;if(!/\.[\w-]+$/.test(n))n+='.sglx';if(n.endsWith('.sglx')===false)alert('Scripts should use .sglx');project.files[n]='';openFile(n);save()};
$('newFolderBtn').onclick=()=>{const n=prompt('Folder name','scripts');if(!n)return;const f=n.trim().replace(/^\/+|\/+$/g,'');if(!f)return;const path=f+'/main.sglx';project.files[path]??='';current=path;render();save()};
$('newBtn').onclick=()=>{if(confirm('Create a new project?')){project={name:'MyProject',files:{'main.sglx':'say("Hello from SingulaX!")\n'},assets:{},settings:{...project.settings}};current='main.sglx';render();save()}};
let latestFrame=[],paintHandle=0;
function draw(frame=[]){latestFrame=frame.slice()}
function paintFrame(){if(paintHandle)cancelAnimationFrame(paintHandle);const tick=()=>{if(!runtime){paintHandle=0;return}paintCanvas(latestFrame);paintHandle=requestAnimationFrame(tick)};paintHandle=requestAnimationFrame(tick)}
function paintCanvas(frame=[]){const c=canvas,ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#05060a';ctx.fillRect(0,0,c.width,c.height);for(const x of frame){ctx.fillStyle=x.fill||'white';ctx.strokeStyle=x.fill||'white';if(x.type==='rect')ctx.fillRect(x.x,x.y,x.w,x.h);if(x.type==='circle'){ctx.beginPath();ctx.arc(x.x,x.y,x.r,0,Math.PI*2);ctx.fill()}if(x.type==='line'){ctx.lineWidth=x.width||2;ctx.beginPath();ctx.moveTo(x.x1,x.y1);ctx.lineTo(x.x2,x.y2);ctx.stroke()}if(x.type==='text'){ctx.font=(x.size||20)+'px sans-serif';ctx.fillText(x.text,x.x,x.y)}if(x.type==='cube')drawCube(ctx,x);if(x.type==='image'){const url=project.assets[x.asset];if(url){paintCanvas.images??=new Map();let im=paintCanvas.images.get(url);if(!im){im=new Image();im.src=url;paintCanvas.images.set(url,im)}if(im.complete)ctx.drawImage(im,x.x,x.y,x.w||im.width,x.h||im.height)}}}}
function drawCube(ctx,x){const s=70*(x.size||1),cx=400+x.x*60,cy=240-x.z*40-x.y*60;ctx.beginPath();ctx.moveTo(cx-s,cy-s);ctx.lineTo(cx,cy-s*.55);ctx.lineTo(cx+s,cy-s);ctx.lineTo(cx+s,cy);ctx.lineTo(cx,cy+s*.45);ctx.lineTo(cx-s,cy);ctx.closePath();ctx.strokeStyle=x.fill||'#7cf';ctx.stroke();ctx.beginPath();ctx.moveTo(cx-s,cy);ctx.lineTo(cx,cy+s*.45);ctx.lineTo(cx+s,cy);ctx.stroke()}
async function run(){save();stop();consoleEl.textContent='';$('diagnostics').textContent='';latestFrame=[];runtime=new SingulaxRuntime({output:log,frame:draw,input:async p=>{log(p);return await new Promise(resolve=>{window._inputResolve=resolve;$('stdin').focus()})},fileRead:async p=>project.files[p]??project.assets[p]??'',fileWrite:async(p,c)=>{project.files[p]=String(c);renderTree();save();return true},playAudio:p=>playAudio(p),mode3d:v=>{$('previewMode').value=v?'3d':'2d'}});runtime.setInput({keys:[...keys],buttons:[...buttons],mouse,touch,gamepads:readGamepads()});paintFrame();try{await runtime.runProject(project);paintCanvas(latestFrame);log('[finished]');if(paintHandle)cancelAnimationFrame(paintHandle);paintHandle=0;runtime=null}catch(e){showError(e);if(paintHandle)cancelAnimationFrame(paintHandle);paintHandle=0;runtime=null}}
function stop(){if(runtime){runtime.running=false;runtime=null;if(paintHandle)cancelAnimationFrame(paintHandle);paintHandle=0;paintCanvas(latestFrame);log('[stopped]')}}

// Wire the Studio controls to the runtime.
$('runBtn').addEventListener('click',run);
$('stopBtn').addEventListener('click',stop);

$('stdin').addEventListener('keydown',e=>{if(e.key==='Enter'&&window._inputResolve){const v=e.target.value;e.target.value='';const r=window._inputResolve;window._inputResolve=null;r(v)}});
window.addEventListener('keydown',e=>{keys.add(e.key);runtime?.setInput({keys:[...keys],buttons:[...buttons],mouse,touch,gamepads:readGamepads()})});
window.addEventListener('keyup',e=>{keys.delete(e.key);runtime?.setInput({keys:[...keys],buttons:[...buttons],mouse,touch,gamepads:readGamepads()})});
canvas.addEventListener('mousemove',e=>{const r=canvas.getBoundingClientRect();mouse={x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};runtime?.setInput({keys:[...keys],buttons:[...buttons],mouse,touch,gamepads:readGamepads()})});
canvas.addEventListener('mousedown',()=>{mouse.down=true;runtime?.setInput({keys:[...keys],buttons:[...buttons],mouse,touch,gamepads:readGamepads()})});
window.addEventListener('mouseup',()=>{mouse.down=false;runtime?.setInput({keys:[...keys],buttons:[...buttons],mouse,touch,gamepads:readGamepads()})});
canvas.addEventListener('touchstart',e=>{const t=e.touches[0],r=canvas.getBoundingClientRect();touch={x:(t.clientX-r.left)*canvas.width/r.width,y:(t.clientY-r.top)*canvas.height/r.height,active:true};runtime?.setInput({keys:[...keys],buttons:[...buttons],mouse,touch,gamepads:readGamepads()})},{passive:true});
canvas.addEventListener('touchmove',e=>{const t=e.touches[0],r=canvas.getBoundingClientRect();touch={x:(t.clientX-r.left)*canvas.width/r.width,y:(t.clientY-r.top)*canvas.height/r.height,active:true};runtime?.setInput({keys:[...keys],buttons:[...buttons],mouse,touch,gamepads:readGamepads()})},{passive:true});
canvas.addEventListener('touchend',()=>{touch.active=false;runtime?.setInput({keys:[...keys],buttons:[...buttons],mouse,touch,gamepads:readGamepads()})},{passive:true});
function readGamepads(){return [...navigator.getGamepads?.()||[]].filter(Boolean).map(g=>({id:g.id,buttons:g.buttons.map(b=>b.pressed),axes:[...g.axes]}))}
$('importBtn').onclick=()=>$('fileInput').click();
$('fileInput').onchange=async e=>{for(const f of e.target.files){if(f.type.startsWith('image/')||f.type.startsWith('audio/')||f.type.startsWith('video/')){project.assets[f.name]=await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(f)});}else{project.files[f.name]=await f.text()}}render();save();e.target.value=''};
function exportProject(){const choice=prompt('Export format:\n1 = SingulaX project (.sglxproj)\n2 = Single script (.sglx)\n3 = Standalone HTML game\n4 = Project JSON backup','1');if(choice==='1'){download(JSON.stringify(project,null,2),project.name+'.sglxproj','application/json')}else if(choice==='2'){download(project.files[current]||'',current,'text/plain')}else if(choice==='3'){const code=project.files[current]||'';const html=`<!doctype html><meta charset="utf-8"><title>${esc(project.name)}</title><style>body{margin:0;background:#000}canvas{width:100vw;height:100vh}</style><canvas id="c" width="800" height="450"></canvas><script type="module">${standaloneRuntime()}<\/script>`;download(html,project.name+'.html','text/html')}else download(JSON.stringify({format:'singulax-project',version:1,project},null,2),project.name+'.json','application/json')}
function download(data,name,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function standaloneRuntime(){return `// Standalone export keeps this project self-contained. Open it from a web server for module features.\nconsole.log(${JSON.stringify(project.name)});`}
$('exportBtn').onclick=exportProject;
function diagnose(){const src=editor.value,ds=[];const clean=src.replace(/\/\/[\s\S]*?\/\//g,m=>m.split('\n').map(()=>'').join('\n'));const lines=clean.split(/\r?\n/);let depth=0;for(let i=0;i<lines.length;i++){const s=lines[i].trim();if(!s||s.startsWith('#')||s.startsWith('--'))continue;if(/^(if|while|forever|repeat\s*(?:\(|.+\s+times)|for\s+.+\s+do|function\s+)/i.test(s))depth++;if(/^end\b/i.test(s)){depth--;if(depth<0){ds.push({line:i+1,msg:'Unexpected end'});depth=0}}if(/^(elseif|else)\b/i.test(s)&&depth===0)ds.push({line:i+1,msg:'Unexpected else/elseif'});if(/^(if|elseif)\b/i.test(s)&&!/(then)$/i.test(s))ds.push({line:i+1,msg:'Conditional needs then'});if(/^while\b/i.test(s)&&!/(do)$/i.test(s))ds.push({line:i+1,msg:'while needs do'});if(/^repeat\s*\(/i.test(s)&&!/\)$/i.test(s))ds.push({line:i+1,msg:'repeat needs closing )'});if(/^repeat\.until(?:\.statement)?\s*\(/i.test(s)&&!/\)$/i.test(s))ds.push({line:i+1,msg:'repeat.until needs closing )'});if(/^repeat\s+.+$/i.test(s)&&!/^repeat\.until/i.test(s)&&!/times$/i.test(s)&&!/^repeat\s*\(/i.test(s))ds.push({line:i+1,msg:'repeat needs times or repeat(count)'});if(/^(wait|random|random_int|draw_rect|draw_circle|draw_text)\b/i.test(s)&&!s.includes('('))ds.push({line:i+1,msg:'Function call needs parentheses'})}if(depth>0)ds.push({line:lines.length,msg:`Missing ${depth} end${depth>1?'s':''}`});$('diagnostics').innerHTML=ds.length?ds.map(d=>`<div>● Line ${d.line}: ${esc(d.msg)}</div>`).join(''):'<span class="diagOk">✓ No basic syntax errors detected</span>';$('diagCount').textContent=ds.length?`⚠ ${ds.length}`:'✓';$('gutter').innerHTML=lines.map((_,i)=>`<div>${i+1}</div>`).join('');return ds}
function showError(e){const m=String(e.message||e),match=m.match(/line\s+(\d+)(?:, column\s+(\d+))?/i);$('diagnostics').innerHTML=`<div>● ${esc(m)}</div>`;if(match){const line=+match[1],lines=editor.value.split(/\r?\n/);let pos=0;for(let i=0;i<line-1;i++)pos+=lines[i].length+1;editor.focus();editor.setSelectionRange(pos,pos+lines[line-1]?.length||0)}}
editor.addEventListener('input', () => {
  if (project.settings.autosave) {
    project.files[current] = editor.value;
    localStorage.setItem('singulax-project', JSON.stringify(project));
  }
  diagnose();
  showCompletions();
});
editor.addEventListener('scroll', () => { $('gutter').scrollTop = editor.scrollTop; });
editor.addEventListener('keydown', e => {
  if (e.key === 'Tab') {
    if (!$('suggestions').hidden) { acceptCompletion(); e.preventDefault(); return; }
    e.preventDefault();
    const a = editor.selectionStart, b = editor.selectionEnd;
    editor.setRangeText('  ', a, b, 'end');
    return;
  }
  if (e.key === 'Enter') {
    if (!$('suggestions').hidden) { acceptCompletion(); e.preventDefault(); return; }
    setTimeout(diagnose, 0);
  }
  if (e.key === 'ArrowDown' && !$('suggestions').hidden) { moveCompletion(1); e.preventDefault(); }
  if (e.key === 'ArrowUp' && !$('suggestions').hidden) { moveCompletion(-1); e.preventDefault(); }
  if (e.key === 'Escape') hideCompletions();
  if ((e.ctrlKey || e.metaKey) && e.code === 'Space') { e.preventDefault(); showCompletions(true); }
});
$('settingsBtn').onclick = () => $('settings').showModal();
$('closeSettings').onclick = () => { $('settings').close(); applySettings(); save(); };
$('theme').onchange = applySettings;
$('fontSize').oninput = applySettings;
$('autosave').onchange = save;
function applySettings() {
  const st = project.settings || {};
  document.documentElement.style.setProperty('--code-size', (st.fontSize || 15) + 'px');
  document.body.dataset.theme = $('theme')?.value || st.theme || 'midnight';
}
let completionItems = [], completionIndex = 0;
function completionContext() {
  const before = editor.value.slice(0, editor.selectionStart);
  const word = (before.match(/[A-Za-z_]\w*$/) || [''])[0];
  const member = before.match(/([A-Za-z_]\w*)\.([A-Za-z_]\w*)$/);
  return { word, member };
}
function showCompletions(force = false) {
  const { word, member } = completionContext();
  if (!force && !word && !member) { hideCompletions(); return; }
  const snippets = {
    if: 'if condition then\n  \nend',
    elseif: 'elseif condition then',
    while: 'while condition do\n  \nend',
    forever: 'forever do\n  \nend',
    for: 'for i = 1, 10 do\n  \nend',
    function: 'function name()\n  \nend',
    repeat: 'repeat(10)\n  \nend',
    'repeat.until': 'repeat.until(task(), done)\n  \nend',
    'repeat.until.statement': 'repeat.until.statement(condition, true)\n  \nend',
    wait: 'wait(1)',
    'wait.until': 'wait.until(task, done)'
  };
  let pool = [];
  if (member) {
    const q = member[2].toLowerCase();
    pool = ['state','value','length','x','y','z','health','position','ready','done','starts','during','update','destroy','play','stop']
      .filter(x => x.startsWith(q));
  } else {
    const names = [...new Set([...keywords, ...builtins, ...Object.keys(project.files).map(x => x.replace(/\.sglx$/, '')), ...Object.keys(project.assets)])];
    pool = names.filter(x => x.toLowerCase().startsWith(word.toLowerCase()));
    if (snippets[word.toLowerCase()]) pool = [word.toLowerCase(), ...pool.filter(x => x.toLowerCase() !== word.toLowerCase())];
  }
  completionItems = pool.slice(0, 12);
  completionIndex = 0;
  const box = $('suggestions');
  if (!completionItems.length) { hideCompletions(); return; }
  box.hidden = false;
  box.innerHTML = completionItems.map((x, i) =>
    `<button class="completion ${i === 0 ? 'selected' : ''}" data-sug-index="${i}"><b>${esc(x)}</b></button>`
  ).join('');
  box.onclick = e => {
    const b = e.target.closest('[data-sug-index]');
    if (!b) return;
    completionIndex = Number(b.dataset.sugIndex);
    acceptCompletion();
  };
  positionCompletions();
}
function positionCompletions() {
  const box = $('suggestions');
  box.style.left = '58px';
  box.style.top = '36px';
}
function acceptCompletion() {
  if (!completionItems.length) return;
  const { word, member } = completionContext();
  const end = editor.selectionStart;
  const prefixLength = member ? member[2].length : word.length;
  const chosen = completionItems[completionIndex];
  const snippets = {if:'if condition then\n  \nend',while:'while condition do\n  \nend',forever:'forever do\n  \nend',for:'for i = 1, 10 do\n  \nend',function:'function name()\n  \nend',repeat:'repeat(10)\n  \nend','repeat.until':'repeat.until(task(), done)\n  \nend','repeat.until.statement':'repeat.until.statement(condition, true)\n  \nend',wait:'wait(1)','wait.until':'wait.until(task, done)'};
  editor.setRangeText(snippets[chosen] || chosen, end - prefixLength, end, 'end');
  hideCompletions();
  editor.focus();
  diagnose();
}
function moveCompletion(delta) {
  if (!completionItems.length) return;
  completionIndex = (completionIndex + delta + completionItems.length) % completionItems.length;
  document.querySelectorAll('.completion').forEach((b, i) => b.classList.toggle('selected', i === completionIndex));
}
function hideCompletions() { $('suggestions').hidden = true; completionItems = []; }
async function previewAsset(name){const url=project.assets[name];if(url?.startsWith('data:image/')){const w=window.open();w.document.write(`<img src="${url}" style="max-width:100%">`)}else if(url?.startsWith('data:audio/')){const w=window.open();w.document.write(`<audio controls autoplay src="${url}"></audio>`)}else if(url?.startsWith('data:video/')){const w=window.open();w.document.write(`<video controls autoplay style="max-width:100%" src="${url}"></video>`)}else alert(name)}
function playAudio(name){const u=project.assets[name]||name;if(u){const a=new Audio(u);a.play().catch(()=>{})}}

// Studio workspace tabs and multitasking
const studioTabs = ['code','console','preview'];
function setStudioTab(name){
  studioTabs.forEach(n=>{const el=$('window-'+n); if(el) el.classList.toggle('active-window', n===name); const b=$('tab-'+n); if(b)b.classList.toggle('active',n===name);});
  document.body.dataset.focusPanel=name;
}
function initStudioTabs(){
  studioTabs.forEach(n=>$('tab-'+n)?.addEventListener('click',()=>setStudioTab(n)));
  $('multitaskBtn')?.addEventListener('click',()=>document.body.classList.toggle('multitask'));
  $('resetLayoutBtn')?.addEventListener('click',()=>{document.body.classList.remove('multitask');setStudioTab('code');});
  setStudioTab('code');
}
initStudioTabs();

const old=localStorage.getItem('singulax-project');if(old)try{project=JSON.parse(old);current=Object.keys(project.files)[0]||'main.sglx'}catch{}
$('theme').value=project.settings?.theme||'midnight';
$('fontSize').value=project.settings?.fontSize||15;
$('autosave').checked=project.settings?.autosave!==false;
render();
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
