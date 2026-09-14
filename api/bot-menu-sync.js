import pg from 'pg';
import {decryptSecret} from './security.js';

const {Pool}=pg;
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const jwtSecret=String(process.env.JWT_SECRET||'');
const publicUrl=String(process.env.PUBLIC_APP_URL||'');
const intervalMs=Math.max(300000,Number(process.env.BOT_MENU_SYNC_INTERVAL_MS)||900000);

function appUrl(userId){
  const origin=new URL(publicUrl).origin;
  return `${origin}/miniapp.html?tenant=${encodeURIComponent(userId)}`;
}

async function telegram(token,method,body){
  const endpoint='https:'+'//api.telegram.org/bot'+token+'/'+method;
  const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||!result.ok)throw Error(result.description||`${method} failed`);
  return result;
}

async function synchronize(){
  const users=(await pool.query("select id,bot_token_enc,bot_username from users where bot_token_enc is not null and bot_token_enc<>''")).rows;
  for(const user of users){
    try{
      const token=decryptSecret(user.bot_token_enc,jwtSecret),url=appUrl(user.id);
      await telegram(token,'setChatMenuButton',{menu_button:{type:'web_app',text:'Открыть приложение',web_app:{url}}});
      await telegram(token,'setMyCommands',{commands:[{command:'start',description:'Открыть программу'}]});
      console.log('Bot menu synchronized',user.bot_username||user.id);
    }catch(error){
      console.error('Bot menu sync failed',user.bot_username||user.id,error.message);
    }
  }
}

await synchronize();
setInterval(()=>synchronize().catch(error=>console.error('Bot menu sync cycle failed',error)),intervalMs);
process.on('SIGTERM',async()=>{await pool.end().catch(()=>{});process.exit(0)});
