import pg from 'pg';
import {decryptSecret} from './security.js';
const {Pool}=pg;
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const jwtSecret=String(process.env.JWT_SECRET||'');
const publicUrl=String(process.env.PUBLIC_APP_URL||'');
const intervalMs=Math.max(60000,Number(process.env.BOT_MENU_SYNC_INTERVAL_MS)||300000);
const chatState=new Map();
function appUrl(userId){return new URL('/miniapp.html?tenant='+encodeURIComponent(userId),publicUrl).toString()}
function botKey(user){return String(user.bot_username||'unknown').toLowerCase()}
async function telegram(token,method,body){const response=await fetch('https:'+'//api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)}),result=await response.json().catch(()=>({}));if(!response.ok||!result.ok)throw Error(result.description||method+' failed');return result}
async function customerChats(user){try{return (await pool.query('select telegram_id from loyalty_customers where owner_id=$1 and bot_key=$2 and blocked=false order by updated_at desc limit 1000',[user.id,botKey(user)])).rows.map(row=>String(row.telegram_id)).filter(Boolean)}catch(error){if(error?.code==='42P01')return[];throw error}}
async function synchronizeUser(user){const token=decryptSecret(user.bot_token_enc,jwtSecret),url=appUrl(user.id),text=String(user.miniapp_design?.menuButtonText||user.miniapp_design?.name||'Открыть приложение').trim().slice(0,64)||'Открыть приложение',menu_button={type:'web_app',text,web_app:{url}},signature=text+'\n'+url;await telegram(token,'setChatMenuButton',{menu_button});await telegram(token,'setMyCommands',{commands:[{command:'start',description:text}]});let state=chatState.get(user.id);if(!state||state.signature!==signature){state={signature,chats:new Set()};chatState.set(user.id,state)}for(const chat_id of await customerChats(user)){if(state.chats.has(chat_id))continue;try{await telegram(token,'setChatMenuButton',{chat_id,menu_button});state.chats.add(chat_id)}catch(error){console.error('Bot chat menu sync failed',user.bot_username||user.id,chat_id,error.message)}}console.log('Bot menu synchronized',user.bot_username||user.id,'chats:',state.chats.size)}
async function synchronize(){const users=(await pool.query("select id,bot_token_enc,bot_username,miniapp_design from users where bot_token_enc is not null and bot_token_enc<>''")).rows;for(const user of users){try{await synchronizeUser(user)}catch(error){console.error('Bot menu sync failed',user.bot_username||user.id,error.message)}}}
await synchronize();
setInterval(()=>synchronize().catch(error=>console.error('Bot menu sync cycle failed',error)),intervalMs);
process.on('SIGTERM',async()=>{await pool.end().catch(()=>{});process.exit(0)});
