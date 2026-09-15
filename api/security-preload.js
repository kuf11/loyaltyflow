import express from 'express';
import rateLimit from 'express-rate-limit';
import {verifyRegistrationCaptcha} from './registration-security.js';
import {loginSecurityContext} from './login-security-context.js';
const originalInit=express.application.init;
express.application.init=function(...args){const result=originalInit.apply(this,args);this.set('trust proxy',1);return result};
const loginCaptcha=async(req,res,next)=>{try{if(!await verifyRegistrationCaptcha(req.body?.turnstileToken,req.ip,'login'))return res.status(400).json({error:'Проверка безопасности не пройдена. Обновите страницу и попробуйте снова.'});loginSecurityContext.run(true,()=>next())}catch(error){console.error(error);res.status(Number(error.status)||500).json({error:error.message||'Не удалось выполнить проверку безопасности'})}};
const verifyAccountLimit=rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:true,legacyHeaders:false,skipSuccessfulRequests:true,keyGenerator:req=>String(req.body?.email||'').trim().toLowerCase().slice(0,320)||'missing-email',message:{error:'Слишком много неверных кодов для этого аккаунта. Попробуйте позже.'}});
const originalPost=express.application.post;
express.application.post=function(path,...handlers){
  if(path==='/api/v1/public/:tenant/loyalty/purchase')return originalPost.call(this,path,(req,res)=>res.status(503).json({error:'Оплата временно отключена до подключения проверенной платёжной системы'}));
  if(path==='/api/v1/auth/login'){
    const [rateLimitByIp,...rest]=handlers;
    return originalPost.call(this,path,rateLimitByIp,loginCaptcha,...rest);
  }
  if(path==='/api/v1/auth/verify'){
    const [rateLimitByIp,...rest]=handlers;
    return originalPost.call(this,path,rateLimitByIp,verifyAccountLimit,...rest);
  }
  return originalPost.call(this,path,...handlers);
};
