import express from 'express';
import pg from 'pg';

const {Pool}=pg;
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const marker='auth-state-v1';
const originalInit=express.application.init;

function normalizedStatus(value){return String(value??'').trim().toLowerCase()}
function frozen(value){return value===true||value===1||value==='1'||normalizedStatus(value)==='true'||normalizedStatus(value)==='t'}

express.application.init=function(...args){
  const result=originalInit.apply(this,args);
  this.use((req,res,next)=>{
    res.setHeader('X-LoyaltyFlow-Runtime',marker);
    if(req.path==='/api/v1/auth/login'){
      const email=String(req.body?.email||'').trim().toLowerCase();
      res.once('finish',async()=>{
        try{
          const diagnostic=(await pool.query(`select current_database() database_name,id,status,admin_frozen,subscription_status,trial_end,now() database_now from users where email=$1`,[email])).rows[0];
          console.info('[auth-runtime]',JSON.stringify({
            marker,
            responseStatus:res.statusCode,
            host:String(req.get('host')||''),
            forwardedFor:Boolean(req.get('x-forwarded-for')),
            userFound:Boolean(diagnostic),
            ...(diagnostic?{
              database:diagnostic.database_name,
              userId:diagnostic.id,
              status:normalizedStatus(diagnostic.status),
              adminFrozen:frozen(diagnostic.admin_frozen),
              subscriptionStatus:normalizedStatus(diagnostic.subscription_status),
              trialExpired:Boolean(diagnostic.trial_end&&new Date(diagnostic.trial_end).getTime()<new Date(diagnostic.database_now).getTime()),
              trialEnd:diagnostic.trial_end
            }:{})
          }));
        }catch(error){
          console.error('[auth-runtime]',JSON.stringify({marker,responseStatus:res.statusCode,diagnosticError:String(error?.message||error)}));
        }
      });
    }
    next();
  });
  return result;
};

console.info('[runtime]',marker);
