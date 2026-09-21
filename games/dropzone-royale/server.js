import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicFile = path.join(root, "index.html");
const PORT = process.env.PORT || 8080;
const clients = new Map();
const rooms = new Map();

const server = http.createServer((req,res)=>{
  if(req.url === "/" || req.url === "/index.html"){
    res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});
    res.end(fs.readFileSync(publicFile));
    return;
  }
  res.writeHead(404); res.end("Not found");
});

const wss = new WebSocketServer({server});
function broadcast(room,msg,except){
  const raw=JSON.stringify(msg);
  for(const p of room.players.values()) if(p.ws!==except && p.ws.readyState===1) p.ws.send(raw);
}
function makeRoom(){
  const id=Math.random().toString(36).slice(2,7).toUpperCase();
  const room={id,players:new Map()};
  rooms.set(id,room); return room;
}

wss.on("connection",ws=>{
  const id=Math.random().toString(36).slice(2,10);
  let player={id,name:"Player",x:1800,y:1800,hp:100,ammo:30,team:0,ws};
  let room=makeRoom();
  room.players.set(id,player); clients.set(ws,{room,player});
  ws.send(JSON.stringify({type:"welcome",id,match:room.id}));

  ws.on("message",buf=>{
    let m; try{m=JSON.parse(buf)}catch{return}
    if(m.type==="join"){
      player.name=String(m.name||"Player").slice(0,20);
      broadcast(room,{type:"state",players:[player]});
    }
    if(m.type==="input"){
      player.x=Number(m.x)||player.x; player.y=Number(m.y)||player.y;
      player.hp=Math.max(0,Math.min(100,Number(m.hp)||player.hp));
      player.ammo=Math.max(0,Math.min(120,Number(m.ammo)||player.ammo));
      broadcast(room,{type:"state",players:[player]},ws);
    }
  });
  ws.on("close",()=>{
    const c=clients.get(ws); if(!c)return;
    c.room.players.delete(c.player.id); clients.delete(ws);
    if(c.room.players.size===0)rooms.delete(c.room.id);
  });
});

setInterval(()=>{
  for(const room of rooms.values()){
    const players=[...room.players.values()].map(p=>({id:p.id,name:p.name,x:p.x,y:p.y,hp:p.hp,ammo:p.ammo,team:p.team,bot:false}));
    if(players.length) broadcast(room,{type:"state",players});
  }
},100);

server.listen(PORT,()=>console.log(`Dropzone Royale server listening on http://localhost:${PORT}`));
