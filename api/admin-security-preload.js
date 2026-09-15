import express from 'express';
import pg from 'pg';
import {verifySession} from './security.js';
const {Pool}=pg;
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const jwtSecret=String(process.env.JWT_SECRET||'');
const platformAdmins=new Set(String(process.env.PLATFORM_ADMIN_EMAILS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean));
const originalInit=express.application.init,originalUse=express.application.use;
let installed=false;
await pool.query(`create table if not exists platform_admin_audit(id bigserial primary key,actor_id uuid references users(id) on delete set null,actor_email text not null,target text not null,action text not null,http_status int not null,created_at timestamptz not null default now())`).catch(error=>console.error('Admin audit schema failed',error));
function cookieToken(req){const match=String(req.headers.cookie||'').match(/(?:^|;\s*)lf_session=([^;]+)/);try{return match?decodeURIComponent(match[1]):''}catch{return''}}
function bearer(req){const value=String(req.get('Authorization')||'');if(/^Bearer\s+/i.test(value))return value.replace(/^Bearer\s+/i,'').trim();return cookieToken(req)}
function denied(user){if(!user||user.admin_frozen)return true;const status=String(user.status||user.account_status||'').toLowerCase();if(['pending_admin','email_pending','blocked','disabled','rejected','frozen'].includes(status))return true;const isPlatform=platformAdmins.has(String(user.email||'').toLowerCase());return !isPlatform&&user.trial_end&&new Date(user.trial_end).getTime()<Date.now()}
async function currentAccount(req,res,next){if(req.method==='OPTIONS'||!req.path.startsWith('/admin-api/v1/'))return next();try{const session=verifySession(bearer(req),jwtSecret);if(!session)return res.status(401).json({error:'Войдите в аккаунт'});const user=(await pool.query('select * from users where id=$1',[session.id])).rows[0];if(denied(user))return res.status(403).json({error:'Аккаунт заблокирован, не активирован или срок доступа истёк'});req.securityUser=user;res.setHeader('Cache-Control','no-store');if(req.method!=='GET'&&req.path.startsWith('/admin-api/v1/platform/'))res.on('finish',()=>{if(res.statusCode<400)pool.query('insert into platform_admin_audit(actor_id,actor_email,target,action,http_status) values($1,$2,$3,$4,$5)',[user.id,user.email,req.params?.id||'',req.method+' '+req.path,res.statusCode]).catch(error=>console.error('Admin audit write failed',error))});return next()}catch(error){console.error('Admin authorization check failed',error);return res.status(503).json({error:'Не удалось проверить состояние аккаунта'})}}
express.application.init=function(...args){const result=originalInit.apply(this,args);this.set('trust proxy','loopback');this.disable('x-powered-by');return result};
express.application.use=function(...handlers){if(!installed){installed=true;originalUse.call(this,currentAccount)}return originalUse.call(this,...handlers)};
