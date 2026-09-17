import express from 'express';
import pg from 'pg';
import {passwordOk,signSession} from './security.js';

const {Pool}=pg;
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const jwtSecret=String(process.env.JWT_SECRET||'');
const originalPost=express.application.post;
const blockedStatuses=new Set(['pending_admin','email_pending','blocked','disabled','rejected','frozen']);
const normalize=value=>String(value??'').trim().toLowerCase();
const isFrozen=value=>value===true||value===1||value==='1'||['true','t','yes','on'].includes(normalize(value));

async function login(req,res){
  try{
    const email=normalize(req.body?.email);
    const user=(await pool.query('select * from users where lower(email)=lower($1) limit 1',[email])).rows[0];
    if(!user||!passwordOk(String(req.body?.password||''),user.password_hash))return res.status(401).json({error:'Неверный email или пароль'});

    const status=normalize(user.status);
    if(isFrozen(user.admin_frozen)||blockedStatuses.has(status))return res.status(403).json({error:'Аккаунт заблокирован или ожидает активации'});

    const trialEnd=user.trial_end?new Date(user.trial_end).getTime():null;
    if(status==='trial'&&trialEnd!==null&&trialEnd<Date.now())return res.status(402).json({error:'Пробный период завершён',price:5000});

    return res.json({
      ok:true,
      token:signSession(user,jwtSecret),
      user:{name:user.full_name,company:user.company,status:user.status,trialEnd:user.trial_end},
      plan:{price:5000,currency:'RUB'}
    });
  }catch(error){
    console.error('[login-access-fix]',error);
    return res.status(500).json({error:'Не удалось выполнить вход'});
  }
}

express.application.post=function(path,...handlers){
  if(path==='/api/v1/auth/login'){
    const [rateLimiter]=handlers;
    return originalPost.call(this,path,rateLimiter,login);
  }
  return originalPost.call(this,path,...handlers);
};
