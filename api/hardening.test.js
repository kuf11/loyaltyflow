import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {signSession,verifySession} from './security.js';
import './security-preload.js';

async function withServer(build,run){const app=express();app.use(express.json());build(app);const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));try{await run(`http://127.0.0.1:${server.address().port}`)}finally{await new Promise(resolve=>server.close(resolve))}}

test('session token carries revocation version',()=>{const token=signSession({id:'u1',email:'a@example.com',session_version:7},'secret',10000,1000);assert.equal(verifySession(token,'secret',1001).sv,7)});
test('unverified purchase route is blocked',()=>withServer(app=>{app.post('/api/v1/public/:tenant/loyalty/purchase',(req,res)=>res.json({unsafe:true}))},async base=>{const response=await fetch(base+'/api/v1/public/demo/loyalty/purchase',{method:'POST'});assert.equal(response.status,503)}));
test('sync secret in URL is rejected',()=>withServer(app=>{app.post('/api/v1/sync/:secret',(req,res)=>res.json({unsafe:true}))},async base=>{const response=await fetch(base+'/api/v1/sync/exposed',{method:'POST'});assert.equal(response.status,410)}));
test('registration rejects invalid server-side fields',()=>withServer(app=>{app.post('/api/v1/auth/register',(req,res,next)=>next(),(req,res)=>res.json({unsafe:true}))},async base=>{const response=await fetch(base+'/api/v1/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({fullName:'x',company:'x',city:'x',email:'bad',phone:'123',age:999,password:'x'.repeat(129)})});assert.equal(response.status,400)}));
