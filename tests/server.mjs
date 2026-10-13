import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.py':'text/plain'};
http.createServer(async(req,res)=>{
  try{let url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(url.startsWith('/microduck_lab/'))url=url.slice('/microduck_lab'.length);if(url.endsWith('/'))url+='index.html';const file=path.resolve(root,'.'+url);if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}const body=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end('Introuvable');}
}).listen(4173,'127.0.0.1',()=>console.log('MICRODUCK LAB : http://127.0.0.1:4173/microduck_lab/lab/'));
