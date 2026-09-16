#!/usr/bin/env node
import fs from 'node:fs/promises'; import path from 'node:path'; import {SingulaxRuntime} from '../runtime/sglx.mjs';
const args=process.argv.slice(2); const file=args.find(a=>a.endsWith('.sglx'));
if(!file){console.log('Singulax CLI\nUsage: sglx <file.sglx>\n       sglx --version');process.exit(0)}
const src=await fs.readFile(file,'utf8'); const rt=new SingulaxRuntime({output:s=>console.log(s),input:async p=>{process.stdout.write(p+' ');return new Promise(r=>process.stdin.once('data',d=>r(String(d).trim())))}}); await rt.run(src);
