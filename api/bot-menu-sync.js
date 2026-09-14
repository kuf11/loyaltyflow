import pg from 'pg';
import {decryptSecret} from './security.js';

const {Pool}=pg;
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const jwtSecret=String(process.env.JWT_SECRET||'');
const publicUrl=String(process.env.PUBLIC_APP_URL||'');
const intervalMs=Math.max(300000,Number(process.env.BOT_MENU_SYNC_INTERVAL_MS)||300000);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function appUrl(userId){const origin=new URL(publicUrl).origin;return `${origin}/miniapp.html?tenant=${encodeURIComponent(userId)}`}
async function telegram(token,method,body){const endpoint='https:'+'//api.telegram.org/bot'+token+'/'+method,response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)}),result=await response.json().catch(()=>({}));if(!response.ok||!result.ok)throw Error(result.description||`${method} failed`);return result}

async function synchronize(){
  const users=(await pool.query("select id,bot_token_enc,bot_username,miniapp_design from users where bot_token_enc is not null and bot_token_enc<>''")).rows;
  for(const user of users){
    try{
      const token=decryptSecret(user.bot_token_enc,jwtSecret),url=appUrl(user.id),text=String(user.miniapp_design?.menuButtonText||user.miniapp_design?.name||'Открыть приложение').trim().slice(0,64)||'Открыть приложение',menu_button={type:'web_app',text,web_app:{url}};
      await telegram(token,'setChatMenuButton',{menu_button});
      await telegram(token,'setMyCommands',{commands:[{command:'start',description:text}]});
      const chats=(await pool.query('select telegram_id from loyalty_customers where owner_id=$1 and blocked=false order by updated_at desc limit 1000',[user.id])).rows;
      for(const chat of chats){await telegram(token,'setChatMenuButton',{chat_id:String(chat.telegram_id),menu_button});await sleep(35)}
      console.log('Bot menu synchronized',user.bot_username||user.id,chats.length);
    }catch(error){console.error('Bot menu sync failed',user.bot_username||user.id,error.message)}
  }
}

await synchronize();
setInterval(()=>synchronize().catch(error=>console.error('Bot menu sync cycle failed',error)),intervalMs);
process.on('SIGTERM',async()=>{await pool.end().catch(()=>{});process.exit(0)});
