import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pg from 'pg';
import crypto from 'node:crypto';

const {Pool}=pg;
const app=express();
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const port=Number(process.env.PORT||3000);
const slug=process.env.BUSINESS_SLUG||'main';
const syncSecret=process.env.SYNC_SECRET||'';
const appUrl=process.env.PUBLIC_APP_URL||'';
const botToken=process.env.TELEGRAM_BOT_TOKEN||'';
const hash=x=>crypto.createHash('sha256').update(String(x)).digest('hex');
const cors=(req,res,next)=>{const origin=req.get('origin');if(origin)res.set('Access-Control-Allow-Origin',origin);res.set('Access-Control-Allow-Headers','Content-Type');res.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');if(req.method==='OPTIONS')return res.sendStatus(204);next()};
app.use(helmet({contentSecurityPolicy:false}));
app.use(cors);
app.use(express.json({limit:'1mb'}));
app.use(rateLimit({windowMs:60_000,limit:120,standardHeaders:true,legacyHeaders:false}));

const defaultDesign={name:'Моя программа',accent:'#22a77a',header:'#102c28',background:'#eef2f1',card:'#ffffff',text:'#172321',font:'Arial, sans-serif',fontSize:15,titleSize:22,radius:16,spacing:12,glass:true,shadow:true,logo:'',title:'Добро пожаловать!',description:'Получайте вознаграждения за покупки.',qr:true,offers:true,history:true};

async function bootstrap(){if(!syncSecret)throw new Error('SYNC_SECRET is required');await pool.query(`INSERT INTO businesses(slug,name,app_url,sync_secret_hash) VALUES($1,$2,$3,$4) ON CONFLICT(slug) DO UPDATE SET app_url=EXCLUDED.app_url`,[slug,'Моя программа',appUrl,hash(syncSecret)]);await pool.query(`INSERT INTO mini_app_configs(business_id,design) SELECT id,$2::jsonb FROM businesses WHERE slug=$1 ON CONFLICT(business_id) DO NOTHING`,[slug,JSON.stringify(defaultDesign)]);}

app.get('/api/health',async(req,res)=>{try{await pool.query('select 1');res.json({ok:true})}catch{res.status(503).json({ok:false})}});
app.get('/api/v1/public/:slug/config',async(req,res)=>{const q=await pool.query(`SELECT b.slug,b.name,b.bot_username,b.app_url,c.design,c.updated_at FROM businesses b JOIN mini_app_configs c ON c.business_id=b.id WHERE b.slug=$1`,[req.params.slug]);if(!q.rowCount)return res.status(404).json({error:'Business not found'});res.set('Cache-Control','no-store');res.json(q.rows[0])});
app.post('/api/v1/sync/:secret',async(req,res)=>{try{const {design,bot,appUrl:requestedUrl}=req.body||{};if(!design||typeof design!=='object')return res.status(400).json({error:'design is required'});const found=await pool.query('SELECT id,slug FROM businesses WHERE sync_secret_hash=$1',[hash(req.params.secret)]);if(!found.rowCount)return res.status(401).json({error:'Invalid sync secret'});const business=found.rows[0];const safeDesign={...defaultDesign,...design};delete safeDesign.syncUrl;await pool.query('BEGIN');await pool.query(`UPDATE businesses SET name=$1,bot_username=$2,app_url=$3,updated_at=now() WHERE id=$4`,[String(safeDesign.name||'Моя программа').slice(0,100),String(bot||'').replace('@','').slice(0,100),String(requestedUrl||appUrl).slice(0,500),business.id]);await pool.query(`INSERT INTO mini_app_configs(business_id,design,updated_at) VALUES($1,$2::jsonb,now()) ON CONFLICT(business_id) DO UPDATE SET design=EXCLUDED.design,updated_at=now()`,[business.id,JSON.stringify(safeDesign)]);await pool.query('COMMIT');let telegramApplied=false,telegramError=null;if(botToken&&(requestedUrl||appUrl)){const tg=await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({menu_button:{type:'web_app',text:String(safeDesign.name||'Открыть'),web_app:{url:requestedUrl||appUrl}}})});const data=await tg.json();telegramApplied=!!data.ok;if(!data.ok)telegramError=data.description||'Telegram API error'}res.json({ok:true,slug:business.slug,telegramApplied,telegramError,publicConfig:`/api/v1/public/${business.slug}/config`})}catch(e){await pool.query('ROLLBACK').catch(()=>{});console.error(e);res.status(500).json({error:'Internal error'})}});

bootstrap().then(()=>app.listen(port,'0.0.0.0',()=>console.log(`LoyaltyFlow API on ${port}`))).catch(e=>{console.error(e);process.exit(1)});
