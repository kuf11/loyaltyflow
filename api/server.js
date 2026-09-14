import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pg from 'pg';
import crypto from 'node:crypto';

const {Pool}=pg;
const app=express();
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const port=Number(process.env.PORT||3000);
const baseAppUrl=process.env.PUBLIC_APP_URL||'';
const syncSecret=process.env.SYNC_SECRET||'';
const globalBotToken=process.env.TELEGRAM_BOT_TOKEN||'';
const adminKey=process.env.ADMIN_KEY||'';
const jwtSecret=process.env.JWT_SECRET||'';
const devCode=process.env.ALLOW_DEV_EMAIL_CODE==='true';
const hash=x=>crypto.createHash('sha256').update(String(x)).digest('hex');
const b64=x=>Buffer.from(x).toString('base64url');
const passwordHash=p=>{const salt=crypto.randomBytes(16).toString('hex');return salt+':'+crypto.scryptSync(p,salt,64).toString('hex')};
const passwordOk=(p,h)=>{try{const [salt,value]=h.split(':');return crypto.timingSafeEqual(Buffer.from(value,'hex'),crypto.scryptSync(p,salt,64))}catch{return false}};
const sign=u=>{const body=b64(JSON.stringify({id:u.id,email:u.email,exp:Date.now()+86400000}));return body+'.'+b64(crypto.createHmac('sha256',jwtSecret).update(body).digest())};
const verify=token=>{try{const [body,sig]=token.split('.');const expected=b64(crypto.createHmac('sha256',jwtSecret).update(body).digest());if(!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;const data=JSON.parse(Buffer.from(body,'base64url'));return data.exp>Date.now()?data:null}catch{return null}};
const cryptKey=()=>crypto.createHash('sha256').update(jwtSecret).digest();
const encrypt=text=>{const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',cryptKey(),iv),data=Buffer.concat([cipher.update(text,'utf8'),cipher.final()]);return [iv.toString('hex'),cipher.getAuthTag().toString('hex'),data.toString('hex')].join(':')};
const decrypt=value=>{const [iv,tag,data]=value.split(':'),dec=crypto.createDecipheriv('aes-256-gcm',cryptKey(),Buffer.from(iv,'hex'));dec.setAuthTag(Buffer.from(tag,'hex'));return Buffer.concat([dec.update(Buffer.from(data,'hex')),dec.final()]).toString()};

app.use(helmet({contentSecurityPolicy:false}));
app.use((req,res,next)=>{const origin=req.get('origin');if(origin)res.set('Access-Control-Allow-Origin',origin);res.set('Access-Control-Allow-Headers','Content-Type,Authorization,X-Admin-Key');res.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');if(req.method==='OPTIONS')return res.sendStatus(204);next()});
app.use(express.json({limit:'2mb'}));
app.use(rateLimit({windowMs:60000,limit:120,standardHeaders:true,legacyHeaders:false}));

const defaultDesign={name:'Моя программа',accent:'#22a77a',header:'#102c28',background:'#eef2f1',card:'#ffffff',text:'#172321',font:'Arial, sans-serif',fontSize:15,titleSize:24,radius:18,spacing:14,glass:true,shadow:true,logo:'',title:'Добро пожаловать!',description:'Получайте вознаграждения за покупки.',qr:true,offers:true,history:true,profile:true,balanceLabel:'Ваш баланс',buttonText:'Показать QR-код'};

async function bootstrap(){
  if(!syncSecret||!adminKey||!jwtSecret)throw new Error('Required secrets are missing');
  await pool.query(`CREATE TABLE IF NOT EXISTS users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),full_name text NOT NULL,company text NOT NULL,age int NOT NULL,city text NOT NULL,email text UNIQUE NOT NULL,phone text NOT NULL,password_hash text NOT NULL,status text NOT NULL DEFAULT 'email_pending',trial_start timestamptz,trial_end timestamptz,subscription_status text NOT NULL DEFAULT 'none',created_at timestamptz NOT NULL DEFAULT now())`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bot_token_enc text`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bot_username text`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS miniapp_design jsonb`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS miniapp_updated_at timestamptz`);
  await pool.query(`CREATE TABLE IF NOT EXISTS verification_codes(user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,code_hash text NOT NULL,expires_at timestamptz NOT NULL)`);
  await pool.query(`INSERT INTO businesses(slug,name,app_url,sync_secret_hash) VALUES('main','Моя программа',$1,$2) ON CONFLICT(slug) DO UPDATE SET app_url=EXCLUDED.app_url`,[baseAppUrl,hash(syncSecret)]);
  await pool.query(`INSERT INTO mini_app_configs(business_id,design) SELECT id,$1::jsonb FROM businesses WHERE slug='main' ON CONFLICT(business_id) DO NOTHING`,[JSON.stringify(defaultDesign)]);
}

async function sendCode(email,code){const key=process.env.RESEND_API_KEY;if(!key)return false;const url='https:'+'//api.resend.com/emails';const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.EMAIL_FROM||'LoyaltyFlow <onboarding@resend.dev>',to:[email],subject:'Код регистрации LoyaltyFlow',html:'<h2>Код подтверждения</h2><p style="font-size:28px"><b>'+code+'</b></p><p>Код действует 15 минут.</p>'})});return response.ok}
const auth=async(req,res,next)=>{const data=verify(String(req.get('Authorization')||'').replace(/^Bearer\s+/i,''));if(!data)return res.status(401).json({error:'Войдите в аккаунт'});const user=(await pool.query('select * from users where id=$1',[data.id])).rows[0];if(!user)return res.status(401).json({error:'Аккаунт не найден'});if(user.status==='pending_admin'||user.status==='email_pending')return res.status(403).json({error:'Доступ ещё не одобрен'});if(user.status==='trial'&&new Date(user.trial_end)<new Date())return res.status(402).json({error:'Пробный период завершён',price:5000});req.user=user;next()};

app.get('/api/health',async(_req,res)=>{try{await pool.query('select 1');res.json({ok:true})}catch{res.status(503).json({ok:false})}});
app.post('/api/v1/auth/register',async(req,res)=>{try{let {fullName,company,age,city,email,phone,password}=req.body||{};email=String(email||'').trim().toLowerCase();if(!fullName||!company||!city||!email||!phone||!password||+age<14)return res.status(400).json({error:'Заполните все поля'});if(!/^(?=.*[A-Za-zА-Яа-я])(?=.*\d)(?=.*[#@]).{8,}$/.test(password))return res.status(400).json({error:'Пароль: минимум 8 символов, буква, цифра и # или @'});if((await pool.query('select 1 from users where email=$1',[email])).rowCount)return res.status(409).json({error:'Email уже зарегистрирован'});const user=await pool.query(`insert into users(full_name,company,age,city,email,phone,password_hash) values($1,$2,$3,$4,$5,$6,$7) returning id`,[String(fullName).slice(0,120),String(company).slice(0,120),+age,String(city).slice(0,80),email,String(phone).slice(0,40),passwordHash(password)]),code=String(crypto.randomInt(100000,999999));await pool.query(`insert into verification_codes(user_id,code_hash,expires_at) values($1,$2,now()+interval '15 minutes')`,[user.rows[0].id,hash(code)]);const sent=await sendCode(email,code);res.status(201).json({ok:true,emailSent:sent,message:sent?'Код отправлен на email':'Используется тестовый код',...(devCode&&!sent?{testCode:code}:{})})}catch(error){console.error(error);res.status(500).json({error:'Ошибка регистрации'})}});
app.post('/api/v1/auth/verify',async(req,res)=>{const email=String(req.body?.email||'').toLowerCase(),code=String(req.body?.code||'');const result=await pool.query(`select u.id from users u join verification_codes c on c.user_id=u.id where u.email=$1 and c.code_hash=$2 and c.expires_at>now()`,[email,hash(code)]);if(!result.rowCount)return res.status(400).json({error:'Неверный или просроченный код'});await pool.query(`update users set status='pending_admin' where id=$1`,[result.rows[0].id]);await pool.query('delete from verification_codes where user_id=$1',[result.rows[0].id]);res.json({ok:true,message:'Email подтверждён. Заявка ожидает одобрения.'})});
app.post('/api/v1/auth/login',async(req,res)=>{const email=String(req.body?.email||'').toLowerCase(),user=(await pool.query('select * from users where email=$1',[email])).rows[0];if(!user||!passwordOk(String(req.body?.password||''),user.password_hash))return res.status(401).json({error:'Неверный email или пароль'});if(user.status==='email_pending')return res.status(403).json({error:'Подтвердите email'});if(user.status==='pending_admin')return res.status(403).json({error:'Заявка ожидает одобрения администратора'});if(user.status==='trial'&&new Date(user.trial_end)<new Date())return res.status(402).json({error:'Пробный период завершён',price:5000});res.json({ok:true,token:sign(user),user:{name:user.full_name,company:user.company,status:user.status,trialEnd:user.trial_end},plan:{price:5000,currency:'RUB'}})});
app.get('/api/v1/auth/me',auth,(req,res)=>res.json({id:req.user.id,name:req.user.full_name,company:req.user.company,status:req.user.status,trialEnd:req.user.trial_end}));

const admin=(req,res,next)=>{if(req.get('X-Admin-Key')!==adminKey)return res.status(401).json({error:'Unauthorized'});next()};
app.get('/api/v1/admin/pending',admin,async(_req,res)=>res.json({users:(await pool.query(`select id,full_name,company,age,city,email,phone,created_at from users where status='pending_admin' order by created_at`)).rows}));
app.post('/api/v1/admin/approve/:id',admin,async(req,res)=>{const result=await pool.query(`update users set status='trial',trial_start=now(),trial_end=now()+interval '7 days' where id=$1 and status='pending_admin' returning email,trial_end`,[req.params.id]);if(!result.rowCount)return res.status(404).json({error:'Заявка не найдена'});res.json({ok:true,user:result.rows[0]})});

const userAppUrl=id=>{const origin=baseAppUrl?new URL(baseAppUrl).origin:'';return origin+'/miniapp.html?tenant='+id};
app.get('/api/v1/owner/miniapp',auth,(req,res)=>res.json({design:{...defaultDesign,...(req.user.miniapp_design||{})},connected:Boolean(req.user.bot_token_enc),botUsername:req.user.bot_username||'',appUrl:userAppUrl(req.user.id),updatedAt:req.user.miniapp_updated_at}));
app.post('/api/v1/owner/miniapp',auth,async(req,res)=>{try{const design={...defaultDesign,...(req.body?.design||{})};delete design.botToken;let token=String(req.body?.botToken||'').trim();if(!token&&req.user.bot_token_enc)token=decrypt(req.user.bot_token_enc);if(!token)return res.status(400).json({error:'Введите API-токен Telegram-бота'});const getMeUrl='https:'+'//api.telegram.org/bot'+token+'/getMe';const check=await fetch(getMeUrl),bot=await check.json();if(!bot.ok)return res.status(400).json({error:'Telegram отклонил токен: '+(bot.description||'неверный токен')});const miniUrl=userAppUrl(req.user.id);const menuUrl='https:'+'//api.telegram.org/bot'+token+'/setChatMenuButton';const menuResponse=await fetch(menuUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({menu_button:{type:'web_app',text:String(design.name||'Открыть').slice(0,64),web_app:{url:miniUrl}}})}),menu=await menuResponse.json();if(!menu.ok)return res.status(400).json({error:'Не удалось назначить кнопку: '+(menu.description||'Telegram API')});await pool.query(`update users set bot_token_enc=$1,bot_username=$2,miniapp_design=$3::jsonb,miniapp_updated_at=now() where id=$4`,[encrypt(token),bot.result.username||'',JSON.stringify(design),req.user.id]);res.json({ok:true,connected:true,botUsername:bot.result.username||'',appUrl:miniUrl,message:'Mini App сохранено и подключено к Telegram'})}catch(error){console.error(error);res.status(500).json({error:'Не удалось сохранить Mini App'})}});

app.get('/api/v1/public/:tenant/config',async(req,res)=>{const tenant=req.params.tenant;if(/^[0-9a-f-]{36}$/i.test(tenant)){const user=(await pool.query('select id,company,bot_username,miniapp_design,miniapp_updated_at from users where id=$1',[tenant])).rows[0];if(user&&user.miniapp_design){res.set('Cache-Control','no-store');return res.json({slug:tenant,name:user.company,bot_username:user.bot_username,app_url:userAppUrl(user.id),design:user.miniapp_design,updated_at:user.miniapp_updated_at})}}const result=await pool.query(`SELECT b.slug,b.name,b.bot_username,b.app_url,c.design,c.updated_at FROM businesses b JOIN mini_app_configs c ON c.business_id=b.id WHERE b.slug=$1`,[tenant]);if(!result.rowCount)return res.status(404).json({error:'Business not found'});res.set('Cache-Control','no-store');res.json(result.rows[0])});

app.post('/api/v1/sync/:secret',async(req,res)=>{if(hash(req.params.secret)!==hash(syncSecret))return res.status(401).json({error:'Invalid sync secret'});const design={...defaultDesign,...(req.body?.design||{})};await pool.query(`update mini_app_configs set design=$1::jsonb,updated_at=now() where business_id=(select id from businesses where slug='main')`,[JSON.stringify(design)]);if(globalBotToken){const url='https:'+'//api.telegram.org/bot'+globalBotToken+'/setChatMenuButton';await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({menu_button:{type:'web_app',text:String(design.name||'Открыть'),web_app:{url:baseAppUrl}}})})}res.json({ok:true})});

bootstrap().then(()=>app.listen(port,'0.0.0.0',()=>console.log('LoyaltyFlow API on '+port))).catch(error=>{console.error(error);process.exit(1)});
