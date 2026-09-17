// SingulaX browser runtime is loaded by index.html before this file.
const $=id=>document.getElementById(id);

let project={
  name:"MyProject",
  files:{
    "main.sglx":'say("Welcome to SingulaX!")'
  },
  assets:{},
  folders:[]
};

let currentFile="main.sglx";
let runtime=null;
let latestFrame=[];
let paintHandle=0;

const keys=new Set();
const buttons=new Set();

const mouse={
  x:0,
  y:0,
  down:false
};

const touch={
  x:0,
  y:0,
  down:false
};

function save(){
  localStorage.setItem("singulax-project",JSON.stringify(project));
  localStorage.setItem("singulax-current-file",currentFile);
}

function load(){
  try{
    const saved=localStorage.getItem("singulax-project");

    if(saved){
      const parsed=JSON.parse(saved);

      project={
        name:parsed.name||"MyProject",
        files:parsed.files||{},
        assets:parsed.assets||{},
        folders:Array.isArray(parsed.folders)?parsed.folders:[]
      };

      if(!Object.keys(project.files).length){
        project.files["main.sglx"]='say("Welcome to SingulaX!")';
      }
    }
  }catch(e){
    project={
      name:"MyProject",
      files:{
        "main.sglx":'say("Welcome to SingulaX!")'
      },
      assets:{},
      folders:[]
    };
  }

  currentFile=localStorage.getItem("singulax-current-file")||"main.sglx";

  if(!project.files[currentFile]){
    currentFile=Object.keys(project.files)[0]||"main.sglx";
  }
}

function normalizePath(path){
  return String(path||"")
    .replaceAll("\\","/")
    .replace(/^\/+/,"")
    .replace(/\/+/g,"/");
}

function basename(path){
  const parts=normalizePath(path).split("/");
  return parts[parts.length-1]||path;
}

function dirname(path){
  const parts=normalizePath(path).split("/");
  parts.pop();
  return parts.join("/");
}

function ext(path){
  const name=basename(path).toLowerCase();
  const i=name.lastIndexOf(".");
  return i>=0?name.slice(i):"";
}

function uniqueName(base,collection){
  let name=base;
  let n=2;

  while(collection[name]){
    const dot=base.lastIndexOf(".");
    if(dot>0){
      name=base.slice(0,dot)+"_"+n+base.slice(dot);
    }else{
      name=base+"_"+n;
    }
    n++;
  }

  return name;
}

function uniqueFolderName(base){
  let name=base;
  let n=2;

  while(project.folders.includes(name)){
    name=base+"_"+n;
    n++;
  }

  return name;
}

function log(...args){
  const el=$("console");
  if(!el)return;

  const text=args.map(v=>{
    if(typeof v==="string")return v;

    try{
      return JSON.stringify(v);
    }catch{
      return String(v);
    }
  }).join(" ");

  el.textContent+=(el.textContent?"\n":"")+text;
  el.scrollTop=el.scrollHeight;
}

function showError(error){
  const message=error&&error.message?error.message:String(error);

  if($("diagnostics")){
    $("diagnostics").textContent=message;
  }

  log("[error] "+message);
}

function setEditorText(text){
  const editor=$("editor");
  if(!editor)return;

  editor.value=String(text??"");
  updateEditor();
}

function getEditorText(){
  return $("editor")?.value||"";
}

function saveCurrentFile(){
  if(!currentFile)return;

  project.files[currentFile]=getEditorText();
  save();
}

function openFile(path){
  path=normalizePath(path);

  if(!project.files[path])return;

  saveCurrentFile();

  currentFile=path;

  if($("fileTitle")){
    $("fileTitle").textContent=basename(path);
  }

  setEditorText(project.files[path]);
  renderTree();
  save();
}

function createFile(){
  let name=prompt("New SingulaX file name","main.sglx");

  if(!name)return;

  name=normalizePath(name);

  if(!name.endsWith(".sglx")){
    name+=".sglx";
  }

  if(project.files[name]){
    alert("A script with that name already exists.");
    return;
  }

  project.files[name]='say("Welcome to SingulaX!")';

  currentFile=name;

  renderTree();
  openFile(name);
  save();
}

function renameFile(oldPath){
  const oldName=basename(oldPath);

  let newName=prompt("Rename script",oldName);

  if(!newName)return;

  newName=basename(newName);

  if(!newName.endsWith(".sglx")){
    newName+=".sglx";
  }

  const folder=dirname(oldPath);
  const newPath=folder?folder+"/"+newName:newName;

  if(newPath!==oldPath&&project.files[newPath]){
    alert("A script with that name already exists.");
    return;
  }

  project.files[newPath]=project.files[oldPath];
  delete project.files[oldPath];

  if(currentFile===oldPath){
    currentFile=newPath;
  }

  renderTree();
  openFile(currentFile);
  save();
}

function deleteFile(path){
  if(!confirm(`Delete "${basename(path)}"?`))return;

  delete project.files[path];

  const remaining=Object.keys(project.files);

  if(!remaining.length){
    project.files["main.sglx"]='say("Welcome to SingulaX!")';
  }

  if(currentFile===path){
    currentFile=Object.keys(project.files)[0];
  }

  renderTree();
  openFile(currentFile);
  save();
}

function moveFile(path){
  if(!project.folders.length){
    alert("Create a folder first.");
    return;
  }

  const choices=["/ Root",...project.folders.map(f=>"/ "+f)];
  const choice=prompt(
    "Move script to:\n\n"+choices.map((v,i)=>`${i+1}. ${v}`).join("\n")+
    "\n\nEnter the number."
  );

  if(choice===null)return;

  const index=Number(choice)-1;

  if(!Number.isInteger(index)||index<0||index>=choices.length){
    alert("Invalid folder.");
    return;
  }

  const folder=index===0?"":project.folders[index-1];
  const newPath=folder?folder+"/"+basename(path):basename(path);

  if(newPath===path)return;

  if(project.files[newPath]){
    alert("A script with that name already exists there.");
    return;
  }

  project.files[newPath]=project.files[path];
  delete project.files[path];

  if(currentFile===path){
    currentFile=newPath;
  }

  renderTree();
  openFile(currentFile);
  save();
}

function renameAsset(oldName){
  const newName=prompt("Rename asset",basename(oldName));

  if(!newName)return;

  const clean=basename(newName);

  if(project.assets[clean]&&clean!==oldName){
    alert("An asset with that name already exists.");
    return;
  }

  project.assets[clean]=project.assets[oldName];
  delete project.assets[oldName];

  renderTree();
  save();
}

function deleteAsset(name){
  if(!confirm(`Delete "${basename(name)}"?`))return;

  delete project.assets[name];

  renderTree();
  save();
}

function moveAsset(name){
  if(!project.folders.length){
    alert("Create a folder first.");
    return;
  }

  alert(
    "Assets are stored by filename in this browser project. " +
    "Folders currently organize scripts and project items visually."
  );
}

function createFolder(){
  let name=prompt("Folder name","NewFolder");

  if(!name)return;

  name=basename(name);

  if(project.folders.includes(name)){
    alert("That folder already exists.");
    return;
  }

  project.folders.push(name);

  renderTree();
  save();
}

function renameFolder(oldName){
  const newName=prompt("Rename folder",oldName);

  if(!newName)return;

  const clean=basename(newName);

  if(!clean||project.folders.includes(clean)){
    alert("That folder name already exists.");
    return;
  }

  const affected={};

  for(const path of Object.keys(project.files)){
    if(path===oldName||path.startsWith(oldName+"/")){
      const newPath=clean+path.slice(oldName.length);
      affected[newPath]=project.files[path];
    }
  }

  for(const path of Object.keys(affected)){
    const oldPath=Object.keys(project.files).find(
      p=>
        (p===oldName||p.startsWith(oldName+"/")) &&
        clean+p.slice(oldName.length)===path
    );

    if(oldPath){
      delete project.files[oldPath];
    }
  }

  Object.assign(project.files,affected);

  const index=project.folders.indexOf(oldName);

  if(index>=0){
    project.folders[index]=clean;
  }

  if(currentFile===oldName||currentFile.startsWith(oldName+"/")){
    currentFile=clean+currentFile.slice(oldName.length);
  }

  renderTree();
  openFile(currentFile);
  save();
}

function deleteFolder(name){
  if(!confirm(`Delete folder "${name}" and everything inside it?`))return;

  for(const path of Object.keys(project.files)){
    if(path===name||path.startsWith(name+"/")){
      delete project.files[path];
    }
  }

  project.folders=project.folders.filter(f=>f!==name);

  const remaining=Object.keys(project.files);

  if(!remaining.length){
    project.files["main.sglx"]='say("Welcome to SingulaX!")';
  }

  if(!project.files[currentFile]){
    currentFile=Object.keys(project.files)[0];
  }

  renderTree();
  openFile(currentFile);
  save();
}

function moveFolder(name){
  alert("Folders are currently top-level project folders.");
}

function makeButton(text,action){
  const button=document.createElement("button");
  button.textContent=text;
  button.onclick=action;
  return button;
}

function renderTree(){
  const tree=$("tree");
  if(!tree)return;

  tree.innerHTML="";

  const scriptsSection=document.createElement("div");
  scriptsSection.className="treeSection";

  const scriptsTitle=document.createElement("div");
  scriptsTitle.className="treeTitle";
  scriptsTitle.textContent="📜 Scripts";
  scriptsSection.appendChild(scriptsTitle);

  const scriptPaths=Object.keys(project.files).sort();

  if(!scriptPaths.length){
    const empty=document.createElement("div");
    empty.className="treeEmpty";
    empty.textContent="No scripts";
    scriptsSection.appendChild(empty);
  }

  for(const path of scriptPaths){
    const row=document.createElement("div");
    row.className="treeRow";

    if(path===currentFile){
      row.classList.add("selected");
    }

    const name=document.createElement("button");
    name.className="treeName";
    name.textContent="📄 "+path;
    name.onclick=()=>openFile(path);

    const actions=document.createElement("span");
    actions.className="treeActions";

    actions.appendChild(makeButton("✎",()=>renameFile(path)));
    actions.appendChild(makeButton("↕",()=>moveFile(path)));
    actions.appendChild(makeButton("×",()=>deleteFile(path)));

    row.appendChild(name);
    row.appendChild(actions);
    scriptsSection.appendChild(row);
  }

  tree.appendChild(scriptsSection);

  const assetsSection=document.createElement("div");
  assetsSection.className="treeSection";

  const assetsTitle=document.createElement("div");
  assetsTitle.className="treeTitle";
  assetsTitle.textContent="🧰 Assets";
  assetsSection.appendChild(assetsTitle);

  const assetNames=Object.keys(project.assets).sort();

  if(!assetNames.length){
    const empty=document.createElement("div");
    empty.className="treeEmpty";
    empty.textContent="No assets";
    assetsSection.appendChild(empty);
  }

  for(const name of assetNames){
    const row=document.createElement("div");
    row.className="treeRow";

    const label=document.createElement("span");
    label.className="treeName";
    label.textContent="📦 "+name;

    const actions=document.createElement("span");
    actions.className="treeActions";

    actions.appendChild(makeButton("✎",()=>renameAsset(name)));
    actions.appendChild(makeButton("↕",()=>moveAsset(name)));
    actions.appendChild(makeButton("×",()=>deleteAsset(name)));

    row.appendChild(label);
    row.appendChild(actions);

    assetsSection.appendChild(row);
  }

  tree.appendChild(assetsSection);

  const foldersSection=document.createElement("div");
  foldersSection.className="treeSection";

  const foldersTitle=document.createElement("div");
  foldersTitle.className="treeTitle";
  foldersTitle.textContent="📁 Folders";
  foldersSection.appendChild(foldersTitle);

  if(!project.folders.length){
    const empty=document.createElement("div");
    empty.className="treeEmpty";
    empty.textContent="No folders";
    foldersSection.appendChild(empty);
  }

  for(const folder of project.folders){
    const row=document.createElement("div");
    row.className="treeRow";

    const label=document.createElement("span");
    label.className="treeName";
    label.textContent="📁 "+folder;

    const actions=document.createElement("span");
    actions.className="treeActions";

    actions.appendChild(makeButton("✎",()=>renameFolder(folder)));
    actions.appendChild(makeButton("↕",()=>moveFolder(folder)));
    actions.appendChild(makeButton("×",()=>deleteFolder(folder)));

    row.appendChild(label);
    row.appendChild(actions);

    foldersSection.appendChild(row);
  }

  tree.appendChild(foldersSection);
}

function updateGutter(){
  const gutter=$("gutter");
  const editor=$("editor");

  if(!gutter||!editor)return;

  const lines=Math.max(1,editor.value.split("\n").length);

  gutter.innerHTML=Array.from(
    {length:lines},
    (_,i)=>`<div>${i+1}</div>`
  ).join("");
}

function updateEditor(){
  updateGutter();
  updateDiagnostics();
  updateSuggestions();
}

function updateDiagnostics(){
  const diagnostics=$("diagnostics");
  const count=$("diagCount");

  if(!diagnostics)return;

  const text=getEditorText();

  const issues=[];

  if(/\botherwise\b/i.test(text)){
    issues.push("SingulaX does not use 'otherwise'. Use 'else' or 'elseif'.");
  }

  if(/^\s*#/m.test(text)){
    issues.push("SingulaX comments use // ... //, not #.");
  }

  if(count){
    count.textContent=issues.length?`${issues.length} issue${issues.length===1?"":"s"}`:"";
  }

  diagnostics.textContent=issues.join("\n");
}

function updateSuggestions(){
  const box=$("suggestions");

  if(!box)return;

  const editor=$("editor");

  if(!editor){
    box.hidden=true;
    return;
  }

  const value=editor.value;
  const cursor=editor.selectionStart;

  const before=value.slice(0,cursor);
  const match=before.match(/[A-Za-z_][A-Za-z0-9_]*$/);

  if(!match){
    box.hidden=true;
    return;
  }

  const prefix=match[0].toLowerCase();

  const words=[
    "say",
    "local",
    "if",
    "then",
    "elseif",
    "else",
    "end",
    "while",
    "forever",
    "for",
    "function",
    "return",
    "repeat",
    "wait",
    "random",
    "list",
    "push",
    "pop",
    "list_add",
    "list_remove",
    "list_get",
    "list_set",
    "data",
    "ask",
    "answer",
    "result",
    "get",
    "find",
    "draw_rect",
    "draw_circle",
    "draw_text",
    "draw_sprite"
  ];

  const results=words.filter(word=>word.startsWith(prefix));

  if(!results.length){
    box.hidden=true;
    return;
  }

  box.innerHTML="";

  results.slice(0,8).forEach(word=>{
    const button=document.createElement("button");
    button.textContent=word;

    button.onclick=()=>{
      const start=cursor-prefix.length;

      editor.value=
        editor.value.slice(0,start)+
        word+
        editor.value.slice(cursor);

      editor.selectionStart=editor.selectionEnd=start+word.length;

      updateEditor();
      editor.focus();
    };

    box.appendChild(button);
  });

  const rect=editor.getBoundingClientRect();

  box.style.left=`${Math.max(0,rect.left)}px`;
  box.style.top=`${Math.min(window.innerHeight-180,rect.top+60)}px`;

  box.hidden=false;
}

function drawFrame(frame){
  latestFrame=Array.isArray(frame)?frame:[];

  paintCanvas(latestFrame);
}

function paintCanvas(frame){
  const canvas=$("game");

  if(!canvas)return;

  const ctx=canvas.getContext("2d");

  ctx.clearRect(0,0,canvas.width,canvas.height);

  for(const item of frame||[]){
    if(!item||typeof item!=="object")continue;

    try{
      if(item.type==="rect"){
        ctx.fillStyle=item.color||"#fff";

        ctx.fillRect(
          Number(item.x)||0,
          Number(item.y)||0,
          Number(item.width??item.w)||0,
          Number(item.height??item.h)||0
        );
      }

      if(item.type==="circle"){
        ctx.fillStyle=item.color||"#fff";

        ctx.beginPath();

        ctx.arc(
          Number(item.x)||0,
          Number(item.y)||0,
          Number(item.radius??item.r)||10,
          0,
          Math.PI*2
        );

        ctx.fill();
      }

      if(item.type==="text"){
        ctx.fillStyle=item.color||"#fff";
        ctx.font=item.font||"20px sans-serif";

        ctx.fillText(
          String(item.text??""),
          Number(item.x)||0,
          Number(item.y)||0
        );
      }

      if(item.type==="image"&&item.image){
        ctx.drawImage(
          item.image,
          Number(item.x)||0,
          Number(item.y)||0,
          Number(item.width||item.image.width),
          Number(item.height||item.image.height)
        );
      }
    }catch{}
  }
}

async function run(){
  saveCurrentFile();

  stop();

  const consoleEl=$("console");

  if(consoleEl){
    consoleEl.textContent="";
  }

  if($("diagnostics")){
    $("diagnostics").textContent="";
  }

  latestFrame=[];

  runtime=new SingulaxRuntime({
    output:log,

    frame:drawFrame,

    input:async promptText=>{
      log(promptText);

      return await new Promise(resolve=>{
        window._inputResolve=resolve;

        const input=$("stdin");

        if(input){
          input.focus();
        }
      });
    },

    fileRead:async path=>{
      path=normalizePath(path);

      return project.files[path]??
        project.assets[path]??
        "";
    },

    fileWrite:async(path,content)=>{
      path=normalizePath(path);

      project.files[path]=String(content);

      renderTree();
      save();

      return true;
    },

    playAudio:path=>{
      const asset=project.assets[path];

      if(!asset)return;

      try{
        const audio=new Audio(asset);
        audio.play().catch(()=>{});
      }catch{}
    },

    mode3d:value=>{
      const select=$("previewMode");

      if(select){
        select.value=value?"3d":"2d";
      }
    }
  });

  runtime.setInput({
    keys:[...keys],
    buttons:[...buttons],
    mouse,
    touch,
    gamepads:readGamepads()
  });

  paintFrame(latestFrame);

  try{
    await runtime.runProject(project);

    log("[finished]");

    if(paintHandle){
      cancelAnimationFrame(paintHandle);
    }

    paintHandle=0;
    runtime=null;
  }catch(error){
    showError(error);

    if(paintHandle){
      cancelAnimationFrame(paintHandle);
    }

    paintHandle=0;
    runtime=null;
  }
}

function stop(){
  if(runtime){
    runtime.running=false;
    runtime=null;
  }

  if(paintHandle){
    cancelAnimationFrame(paintHandle);
    paintHandle=0;
  }

  paintCanvas(latestFrame);

  log("[stopped]");
}

function paintFrame(){
  if(paintHandle){
    cancelAnimationFrame(paintHandle);
  }

  const tick=()=>{
    paintCanvas(latestFrame);
    paintHandle=requestAnimationFrame(tick);
  };

  paintHandle=requestAnimationFrame(tick);
}

function readGamepads(){
  try{
    return [...navigator.getGamepads()]
      .filter(Boolean)
      .map(g=>({
        id:g.id,
        index:g.index,
        buttons:g.buttons.map(b=>b.pressed),
        axes:[...g.axes]
      }));
  }catch{
    return [];
  }
}

function exportJSON(){
  saveCurrentFile();

  const blob=new Blob(
    [JSON.stringify(project,null,2)],
    {type:"application/json"}
  );

  downloadBlob(
    blob,
    `${project.name||"SingulaX-project"}.sglxproj`
  );
}

function downloadBlob(blob,name){
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");

  a.href=url;
  a.download=name;

  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function createZip(){
  saveCurrentFile();

  if(typeof fflate==="undefined"){
    alert(
      "ZIP support needs the fflate library. " +
      "Make sure the ZIP library is loaded before app.js."
    );
    return;
  }

  const files={};

  files["project.sglxproj"]=JSON.stringify(project,null,2);

  for(const path of Object.keys(project.files)){
    files["scripts/"+path]=project.files[path];
  }

  for(const name of Object.keys(project.assets)){
    const asset=project.assets[name];

    if(typeof asset==="string"){
      files["assets/"+name]=asset;
    }
  }

  const zipped=fflate.zipSync(
    Object.fromEntries(
      Object.entries(files).map(([name,value])=>[
        name,
        typeof value==="string"
          ?new TextEncoder().encode(value)
          :value
      ])
    ),
    {level:6}
  );

  downloadBlob(
    new Blob([zipped],{type:"application/zip"}),
    `${project.name||"SingulaX-project"}.zip`
  );
}

async function importProjectFile(file){
  const name=file.name.toLowerCase();

  if(name.endsWith(".zip")){
    await importZip(file);
    return;
  }

  const text=await file.text();

  try{
    const imported=JSON.parse(text);

    if(imported.files){
      project={
        name:imported.name||"MyProject",
        files:imported.files||{},
        assets:imported.assets||{},
        folders:imported.folders||[]
      };

      currentFile=Object.keys(project.files)[0]||"main.sglx";

      renderTree();
      openFile(currentFile);
      save();

      return;
    }
  }catch{}

  if(name.endsWith(".sglx")){
    const fileName=uniqueName(
      file.name,
      project.files
    );

    project.files[fileName]=text;

    currentFile=fileName;

    renderTree();
    openFile(currentFile);
    save();

    return;
  }

  alert("Unsupported project file.");
}

async function importZip(file){
  if(typeof fflate==="undefined"){
    alert(
      "ZIP support needs the fflate library. " +
      "Make sure the ZIP library is loaded before app.js."
    );
    return;
  }

  try{
    const data=new Uint8Array(await file.arrayBuffer());
    const extracted=fflate.unzipSync(data);

    let importedProject=null;

    for(const path of Object.keys(extracted)){
      const clean=normalizePath(path);

      if(clean.endsWith("project.sglxproj")){
        try{
          importedProject=JSON.parse(
            new TextDecoder().decode(extracted[path])
          );
        }catch{}
      }
    }

    if(importedProject&&importedProject.files){
      project={
        name:importedProject.name||file.name.replace(/\.zip$/i,""),
        files:importedProject.files||{},
        assets:importedProject.assets||{},
        folders:importedProject.folders||[]
      };
    }

    for(const originalPath of Object.keys(extracted)){
      const clean=normalizePath(originalPath);

      if(
        clean.endsWith("/")||
        clean.endsWith("project.sglxproj")
      ){
        continue;
      }

      const bytes=extracted[originalPath];

      if(clean.startsWith("scripts/")){
        let path=clean.slice("scripts/".length);

        if(!path.endsWith(".sglx")){
          continue;
        }

        path=uniqueName(path,project.files);

        project.files[path]=
          new TextDecoder().decode(bytes);

        const folder=dirname(path);

        if(folder&&!project.folders.includes(folder)){
          project.folders.push(folder);
        }

        continue;
      }

      if(clean.startsWith("assets/")){
        const assetName=uniqueName(
          basename(clean),
          project.assets
        );

        project.assets[assetName]=
          bytesToDataURL(bytes,guessMime(assetName));

        continue;
      }

      if(clean.endsWith(".sglx")){
        const path=uniqueName(
          basename(clean),
          project.files
        );

        project.files[path]=
          new TextDecoder().decode(bytes);

        continue;
      }

      const assetName=basename(clean);

      if(assetName){
        project.assets[uniqueName(assetName,project.assets)]=
          bytesToDataURL(bytes,guessMime(assetName));
      }
    }

    if(!Object.keys(project.files).length){
      project.files["main.sglx"]=
        'say("Welcome to SingulaX!")';
    }

    currentFile=Object.keys(project.files)[0];

    renderTree();
    openFile(currentFile);
    save();

    log(`[ZIP imported] ${file.name}`);
  }catch(error){
    alert("Could not extract ZIP: "+error.message);
  }
}

function bytesToDataURL(bytes,mime){
  let binary="";

  const chunk=0x8000;

  for(let i=0;i<bytes.length;i+=chunk){
    binary+=String.fromCharCode(
      ...bytes.subarray(i,i+chunk)
    );
  }

  return `data:${mime};base64,${btoa(binary)}`;
}

function guessMime(name){
  const e=ext(name);

  const types={
    ".png":"image/png",
    ".jpg":"image/jpeg",
    ".jpeg":"image/jpeg",
    ".gif":"image/gif",
    ".webp":"image/webp",
    ".svg":"image/svg+xml",
    ".mp3":"audio/mpeg",
    ".wav":"audio/wav",
    ".ogg":"audio/ogg",
    ".m4a":"audio/mp4",
    ".mp4":"video/mp4",
    ".webm":"video/webm",
    ".txt":"text/plain",
    ".md":"text/markdown",
    ".json":"application/json"
  };

  return types[e]||"application/octet-stream";
}

function addAssets(files){
  for(const file of files){
    const reader=new FileReader();

    reader.onload=()=>{
      project.assets[
        uniqueName(file.name,project.assets)
      ]=reader.result;

      renderTree();
      save();
    };

    reader.readAsDataURL(file);
  }
}

function showHelp(){
  let dialog=$("helpDialog");

  if(!dialog){
    dialog=document.createElement("dialog");
    dialog.id="helpDialog";

    dialog.innerHTML=`
      <div class="helpInner">
        <div class="panelHead">
          <h2>SingulaX Examples</h2>
          <button id="closeHelp">Close</button>
        </div>

        <div id="helpExamples"></div>
      </div>
    `;

    document.body.appendChild(dialog);

    $("closeHelp").onclick=()=>{
      dialog.close();
    };
  }

  loadExamples(dialog);
  dialog.showModal();
}

async function loadExamples(dialog){
  const container=dialog.querySelector("#helpExamples");

  if(!container)return;

  container.innerHTML="<p>Loading examples...</p>";

  const names=[
    "01_basics.sglx",
    "02_functions.sglx",
    "03_blueprints.sglx",
    "04_error_handling.sglx",
    "05_modules.sglx",
    "06_todo_app.sglx",
    "07_advanced.sglx",
    "08_control_flow.sglx",
    "09_game_input.sglx",
    "10_singulax_showcase.sglx",
    "11_repeat_until.sglx",
    "geometry.sglx"
  ];

  const results=[];

  for(const name of names){
    try{
      const response=await fetch(
        `../examples/${encodeURIComponent(name)}`
      );

      if(!response.ok)continue;

      let text=await response.text();

      text=normalizeExampleComments(text);
      text=normalizeExampleSyntax(text);

      results.push({
        name,
        text
      });
    }catch{}
  }

  if(!results.length){
    container.innerHTML=
      "<p>Examples could not be loaded. Make sure the examples folder is next to the browser folder.</p>";

    return;
  }

  container.innerHTML="";

  for(const example of results){
    const section=document.createElement("section");
    section.className="helpExample";

    const title=document.createElement("h3");
    title.textContent=example.name;

    const copy=document.createElement("button");
    copy.textContent="Copy";

    copy.onclick=async()=>{
      await navigator.clipboard.writeText(example.text);
      copy.textContent="Copied!";

      setTimeout(()=>{
        copy.textContent="Copy";
      },1000);
    };

    const pre=document.createElement("pre");
    pre.textContent=example.text;

    section.appendChild(title);
    section.appendChild(copy);
    section.appendChild(pre);

    container.appendChild(section);
  }
}

function normalizeExampleComments(text){
  return text
    .split("\n")
    .map(line=>{
      const trimmed=line.trim();

      if(trimmed.startsWith("#")){
        return line.replace(
          /^\s*#\s?/,
          `${line.match(/^\s*/)?.[0]||""}// `
        )+" //";
      }

      const hashIndex=line.indexOf("#");

      if(hashIndex>=0){
        const before=line.slice(0,hashIndex).trimEnd();
        const comment=line.slice(hashIndex+1).trim();

        if(comment){
          return `${before} // ${comment} //`;
        }

        return before;
      }

      return line;
    })
    .join("\n");
}

function normalizeExampleSyntax(text){
  return text
    .replace(/\botherwise\s+if\b/gi,"elseif")
    .replace(/\botherwise\b/gi,"else");
}

function setupInput(){
  window.addEventListener("keydown",event=>{
    keys.add(event.key.toLowerCase());

    if(runtime){
      runtime.setInput({
        keys:[...keys],
        buttons:[...buttons],
        mouse,
        touch,
        gamepads:readGamepads()
      });
    }
  });

  window.addEventListener("keyup",event=>{
    keys.delete(event.key.toLowerCase());

    if(runtime){
      runtime.setInput({
        keys:[...keys],
        buttons:[...buttons],
        mouse,
        touch,
        gamepads:readGamepads()
      });
    }
  });

  const canvas=$("game");

  if(canvas){
    canvas.addEventListener("mousemove",event=>{
      const rect=canvas.getBoundingClientRect();

      mouse.x=
        (event.clientX-rect.left)*
        canvas.width/
        rect.width;

      mouse.y=
        (event.clientY-rect.top)*
        canvas.height/
        rect.height;
    });

    canvas.addEventListener("mousedown",()=>{
      mouse.down=true;
    });

    canvas.addEventListener("mouseup",()=>{
      mouse.down=false;
    });

    canvas.addEventListener("touchstart",event=>{
      touch.down=true;

      const t=event.touches[0];

      if(t){
        const rect=canvas.getBoundingClientRect();

        touch.x=
          (t.clientX-rect.left)*
          canvas.width/
          rect.width;

        touch.y=
          (t.clientY-rect.top)*
          canvas.height/
          rect.height;
      }
    });

    canvas.addEventListener("touchend",()=>{
      touch.down=false;
    });
  }

  document.querySelectorAll("[data-touch]").forEach(button=>{
    const key=button.dataset.touch;

    button.addEventListener("pointerdown",()=>{
      buttons.add(key);
    });

    button.addEventListener("pointerup",()=>{
      buttons.delete(key);
    });

    button.addEventListener("pointerleave",()=>{
      buttons.delete(key);
    });
  });
}

function setupUI(){
  $("runBtn")?.addEventListener("click",run);
  $("stopBtn")?.addEventListener("click",stop);

  $("saveBtn")?.addEventListener("click",()=>{
    saveCurrentFile();
    log("[saved]");
  });

  $("newFileBtn")?.addEventListener("click",createFile);
  $("newFolderBtn")?.addEventListener("click",createFolder);

  $("addAssetBtn")?.addEventListener("click",()=>{
    $("assetFile")?.click();
  });

  $("assetFile")?.addEventListener("change",event=>{
    addAssets(event.target.files);
    event.target.value="";
  });

  $("importBtn")?.addEventListener("click",()=>{
    $("importFile")?.click();
  });

  $("importFile")?.addEventListener("change",async event=>{
    for(const file of event.target.files){
      await importProjectFile(file);
    }

    event.target.value="";
  });

  $("exportBtn")?.addEventListener("click",()=>{
    const choice=prompt(
      "Export project:\n\n"+
      "1 = SingulaX project (.sglxproj)\n"+
      "2 = Full project ZIP\n\n"+
      "Enter 1 or 2."
    );

    if(choice==="2"){
      createZip();
    }else if(choice==="1"){
      exportJSON();
    }
  });

  $("clearConsole")?.addEventListener("click",()=>{
    $("console").textContent="";
  });

  $("projectName")?.addEventListener("input",event=>{
    project.name=event.target.value||"MyProject";
    save();
  });

  $("editor")?.addEventListener("input",()=>{
    project.files[currentFile]=getEditorText();
    updateEditor();

    if($("autosave")?.checked!==false){
      save();
    }
  });

  $("editor")?.addEventListener("keyup",updateSuggestions);
  $("editor")?.addEventListener("click",updateSuggestions);

  $("editor")?.addEventListener("scroll",()=>{
    const gutter=$("gutter");

    if(gutter){
      gutter.scrollTop=$("editor").scrollTop;
    }
  });

  $("newBtn")?.addEventListener("click",()=>{
    project={
      name:"MyProject",
      files:{
        "main.sglx":'say("Welcome to SingulaX!")'
      },
      assets:{},
      folders:[]
    };

    currentFile="main.sglx";

    renderTree();
    openFile(currentFile);
    save();
  });

  $("settingsBtn")?.addEventListener("click",()=>{
    $("settings")?.showModal();
  });

  $("closeSettings")?.addEventListener("click",()=>{
    $("settings")?.close();
  });

  $("theme")?.addEventListener("change",event=>{
    document.body.dataset.theme=event.target.value;
    localStorage.setItem(
      "singulax-theme",
      event.target.value
    );
  });

  $("fontSize")?.addEventListener("input",event=>{
    document.documentElement.style.setProperty(
      "--editor-size",
      `${event.target.value}px`
    );
  });

  $("modeBtn")?.addEventListener("click",()=>{
    const pane=$("blocksPane");
    const editor=$("window-code");

    if(!pane||!editor)return;

    const showing=pane.hidden;

    pane.hidden=!showing;
    editor.hidden=showing;
  });

  $("tab-code")?.addEventListener("click",()=>{
    showWindow("window-code");
  });

  $("tab-console")?.addEventListener("click",()=>{
    showWindow("window-console");
  });

  $("tab-preview")?.addEventListener("click",()=>{
    showWindow("window-preview");
  });

  $("multitaskBtn")?.addEventListener("click",()=>{
    document.body.classList.toggle("multitask");
  });

  $("resetLayoutBtn")?.addEventListener("click",()=>{
    document.body.classList.remove("multitask");

    $("window-code")?.removeAttribute("hidden");
    $("window-console")?.removeAttribute("hidden");
    $("window-preview")?.removeAttribute("hidden");
  });
}

function showWindow(id){
  const ids=[
    "window-code",
    "window-console",
    "window-preview"
  ];

  for(const name of ids){
    const element=$(name);

    if(element){
      element.hidden=name!==id;
    }
  }
}

function setupHelpButton(){
  if($("helpBtn"))return;

  const settings=$("settingsBtn");

  const button=document.createElement("button");
  button.id="helpBtn";
  button.textContent="❔ Help";
  button.onclick=showHelp;

  if(settings&&settings.parentNode){
    settings.parentNode.insertBefore(
      button,
      settings.nextSibling
    );
  }else{
    document.querySelector("header")?.appendChild(button);
  }
}

function loadSettings(){
  const theme=localStorage.getItem("singulax-theme");

  if(theme){
    document.body.dataset.theme=theme;

    if($("theme")){
      $("theme").value=theme;
    }
  }
}

function init(){
  load();

  if($("projectName")){
    $("projectName").value=project.name;
  }

  renderTree();
  openFile(currentFile);

  setupUI();
  setupInput();
  setupHelpButton();
  loadSettings();

  paintFrame(latestFrame);

  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("sw.js?v=7").catch(()=>{});
  }
}

document.addEventListener("DOMContentLoaded",init);
