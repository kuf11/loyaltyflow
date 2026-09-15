import express from 'express';
import {verifyRegistrationCaptcha} from './registration-security.js';
const originalInit=express.application.init;
express.application.init=function(...args){const result=originalInit.apply(this,args);this.set('trust proxy',1);return result};
const loginCaptcha=async(req,res,next)=>{try{if(!await verifyRegistrationCaptcha(req.body?.turnstileToken,req.ip))return res.status(400).json({error:'Проверка безопасности не пройдена. Обновите страницу и попробуйте снова.'});next()}catch(error){console.error(error);res.status(Number(error.status)||500).json({error:error.message||'Не удалось выполнить проверку безопасности'})}};
const originalPost=express.application.post;
express.application.post=function(path,...handlers){
  if(path==='/api/v1/public/:tenant/loyalty/purchase')return originalPost.call(this,path,(req,res)=>res.status(503).json({error:'Оплата временно отключена до подключения проверенной платёжной системы'}));
  if(path==='/api/v1/auth/login'){
    const [rateLimit,...rest]=handlers;
    return originalPost.call(this,path,rateLimit,loginCaptcha,...rest);
  }
  return originalPost.call(this,path,...handlers);
};
