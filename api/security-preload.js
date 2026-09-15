import express from 'express';

const originalInit=express.application.init;
express.application.init=function(...args){
  const result=originalInit.apply(this,args);
  this.set('trust proxy',1);
  return result;
};

const originalPost=express.application.post;
express.application.post=function(path,...handlers){
  if(path==='/api/v1/public/:tenant/loyalty/purchase'){
    return originalPost.call(this,path,(req,res)=>res.status(503).json({error:'Оплата временно отключена до подключения проверенной платёжной системы'}));
  }
  return originalPost.call(this,path,...handlers);
};
