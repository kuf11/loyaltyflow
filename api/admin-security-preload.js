import express from 'express';
import pg from 'pg';
import {verifySession} from './security.js';

const {Pool}=pg;
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const jwtSecret=String(process.env.JWT_SECRET||'');
const platformAdmins=new Set(String(process.env.PLATFORM_ADMIN_EMAILS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean));
const originalUse=express.application.use;
let installed=false;

function bearer(req){
  const value=String(req.get('Authorization')||'');
  return /^Bearer\s+/i.test(value)?value.replace(/^Bearer\s+/i,'').trim():'';
}
function denied(user){
  if(!user||user.admin_frozen)return true;
  const status=String(user.status||user.account_status||'').toLowerCase();
  if(['pending_admin','email_pending','blocked','disabled','rejected','frozen'].includes(status))return true;
  const isPlatform=platformAdmins.has(String(user.email||'').toLowerCase());
  return !isPlatform&&user.trial_end&&new Date(user.trial_end).getTime()<Date.now();
}
async function currentAccount(req,res,next){
  if(req.method==='OPTIONS'||!req.path.startsWith('/admin-api/v1/'))return next();
  try{
    const session=verifySession(bearer(req),jwtSecret);
    if(!session)return res.status(401).json({error:'Войдите в аккаунт'});
    const user=(await pool.query('select * from users where id=$1',[session.id])).rows[0];
    if(denied(user))return res.status(403).json({error:'Аккаунт заблокирован, не активирован или срок доступа истёк'});
    req.securityUser=user;
    res.setHeader('Cache-Control','no-store');
    return next();
  }catch(error){
    console.error('Admin authorization check failed',error);
    return res.status(503).json({error:'Не удалось проверить состояние аккаунта'});
  }
}
express.application.use=function(...handlers){
  if(!installed){installed=true;originalUse.call(this,currentAccount);}
  return originalUse.call(this,...handlers);
};
