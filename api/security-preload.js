import express from 'express';
const originalPost=express.application.post;
express.application.post=function(path,...handlers){
  if(path==='/api/v1/public/:tenant/loyalty/purchase'){
    return originalPost.call(this,path,(req,res)=>res.status(503).json({error:'Оплата временно отключена до подключения проверенной платёжной системы'}));
  }
  return originalPost.call(this,path,...handlers);
};
