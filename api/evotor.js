import crypto from 'node:crypto';
import {customerCodeSlot,normalizeCustomerCode,unrotateCustomerCode} from './customer-code.js';
import {normalizeRules} from './loyalty.js';

const RESERVATION_TTL_MINUTES=10;
const PHONE=/^\+?[0-9]{10,15}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizePhone=value=>String(value||'').replace(/[^0-9+]/g,'').slice(0,32);
const validMoney=value=>Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=1e8;
const safeInt=value=>Math.max(0,Math.floor(Number(value)||0));
const ownerFromEnv=()=>String(process.env.EVOTOR_OWNER_ID||'').trim();
const configuredToken=()=>String(process.env.EVOTOR_APP_TOKEN||'').trim();

function sameSecret(expected,actual){
  if(!expected||!actual)return false;
  const left=Buffer.from(expected),right=Buffer.from(actual);
  return left.length===right.length&&crypto.timingSafeEqual(left,right);
}

function authorized(req){
  const header=String(req.get('X-Evotor-App-Token')||'');
  const bearer=String(req.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  return sameSecret(configuredToken(),header||bearer);
}

function activeLevel(config,spent){
  return config.levels.reduce((current,item)=>Number(spent)>=Number(item.threshold)?item:current,config.levels[0]);
}

function quoteFor(config,customer,receiptTotal){
  const level=activeLevel(config,customer.total_spent);
  const limitPercent=Math.max(0,Math.min(100,Number(level.redeemLimit)||0));
  const maxDiscount=Math.min(safeInt(customer.balance),Math.floor(Number(receiptTotal)*limitPercent/100));
  return {maxDiscount,redeemLimit:limitPercent,level:{name:level.name,threshold:level.threshold,value:level.value}};
}

function parseQr(value,ownerId,secret){
  const raw=String(value||'').trim();
  const parts=raw.split(':');
  if(parts[0]==='loyaltyflow'&&parts[1]==='v5'&&parts.length>=5){
    if(parts[2]!==ownerId)return null;
    const rotated=normalizeCustomerCode(parts[3]);
    if(!rotated)return null;
    const slot=customerCodeSlot();
    for(const candidate of [slot,slot-1]){
      const code=unrotateCustomerCode(rotated,candidate,secret);
      if(code)return {customerCode:code};
    }
    return null;
  }
  if(parts[0]==='loyaltyflow'&&parts[1]==='v2'&&parts.length>=4&&parts[2]===ownerId&&UUID.test(parts[3])){
    return {customerId:parts[3]};
  }
  const code=normalizeCustomerCode(raw);
  return code?{customerCode:code}:null;
}

async function owner(pool,ownerId){
  return (await pool.query('select id,bot_username,miniapp_design,status from users where id=$1',[ownerId])).rows[0]||null;
}

async function findCustomer(pool,{ownerId,botKey,qr,phone,jwtSecret}){
  if(phone){
    return (await pool.query('select * from loyalty_customers where owner_id=$1 and bot_key=$2 and phone=$3 and phone_verified=true limit 1',[ownerId,botKey,phone])).rows[0]||null;
  }
  const parsed=parseQr(qr,ownerId,jwtSecret);
  if(!parsed)return null;
  if(parsed.customerId)return (await pool.query('select * from loyalty_customers where owner_id=$1 and id=$2 limit 1',[ownerId,parsed.customerId])).rows[0]||null;
  return (await pool.query('select * from loyalty_customers where owner_id=$1 and bot_key=$2 and customer_code=$3 limit 1',[ownerId,botKey,parsed.customerCode])).rows[0]||null;
}

function customerView(customer,quote){
  return {
    id:customer.id,
    firstName:customer.first_name,
    lastName:customer.last_name,
    username:customer.username,
    balance:Number(customer.balance),
    totalSpent:Number(customer.total_spent),
    phoneVerified:Boolean(customer.phone_verified),
    maxDiscount:quote.maxDiscount,
    level:quote.level
  };
}

async function releaseExpired(db,ownerId){
  const expired=(await db.query(`update evotor_discount_reservations set status='released',released_at=now() where owner_id=$1 and status='reserved' and expires_at<=now() returning customer_id,amount`,[ownerId])).rows;
  for(const row of expired)await db.query('update loyalty_customers set balance=balance+$1,updated_at=now() where id=$2',[row.amount,row.customer_id]);
}

export async function ensureEvotorSchema(pool){
  await pool.query(`CREATE TABLE IF NOT EXISTS evotor_discount_reservations(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES loyalty_customers(id) ON DELETE CASCADE,
    request_id text NOT NULL,
    receipt_uuid text NOT NULL,
    amount integer NOT NULL CHECK(amount>0),
    receipt_total numeric(14,2) NOT NULL CHECK(receipt_total>=0),
    status text NOT NULL CHECK(status IN ('reserved','committed','released')),
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    committed_at timestamptz,
    released_at timestamptz,
    UNIQUE(owner_id,request_id)
  )`);
  await pool.query('CREATE INDEX IF NOT EXISTS evotor_discount_reservations_receipt_idx ON evotor_discount_reservations(owner_id,receipt_uuid)');
}

export function registerEvotorRoutes({app,pool,jwtSecret}){
  const guard=(req,res,next)=>{
    if(!configuredToken())return res.status(503).json({error:'Эвотор API не настроен: отсутствует EVOTOR_APP_TOKEN'});
    if(!ownerFromEnv())return res.status(503).json({error:'Эвотор API не настроен: отсутствует EVOTOR_OWNER_ID'});
    if(!authorized(req))return res.status(401).json({error:'Недействительный токен приложения Эвотор'});
    req.evotorOwnerId=ownerFromEnv();
    next();
  };

  app.post('/api/v1/evotor/app/customer',guard,async(req,res)=>{
    try{
      const ownerId=req.evotorOwnerId,user=await owner(pool,ownerId);
      if(!user)return res.status(404).json({error:'Владелец LoyaltyFlow не найден'});
      const qr=String(req.body?.qr||'').trim(),phone=normalizePhone(req.body?.phone||''),receiptTotal=Number(req.body?.receiptTotal);
      if((qr&&phone)||(!qr&&!phone))return res.status(400).json({error:'Передайте QR или номер телефона'});
      if(phone&&!PHONE.test(phone))return res.status(400).json({error:'Некорректный номер телефона'});
      if(!validMoney(receiptTotal))return res.status(400).json({error:'Некорректная сумма чека'});
      const customer=await findCustomer(pool,{ownerId,botKey:String(user.bot_username||'unknown').toLowerCase(),qr,phone,jwtSecret});
      if(!customer)return res.status(404).json({error:'Клиент не найден или номер телефона не подтверждён в Telegram'});
      if(customer.blocked)return res.status(403).json({error:'Клиент заблокирован'});
      const quote=quoteFor(normalizeRules(user.miniapp_design?.loyalty||{}),customer,receiptTotal);
      res.json({ok:true,customer:customerView(customer,quote),quote:{receiptTotal,maxDiscount:quote.maxDiscount,redeemLimit:quote.redeemLimit,level:quote.level}});
    }catch(error){console.error(error);res.status(500).json({error:'Не удалось найти клиента'})}
  });

  app.post('/api/v1/evotor/app/discount/reserve',guard,async(req,res)=>{
    const db=await pool.connect();
    try{
      const ownerId=req.evotorOwnerId,customerId=String(req.body?.customerId||''),receiptUuid=String(req.body?.receiptUuid||'').trim().slice(0,160),requestId=String(req.body?.requestId||receiptUuid).trim().slice(0,160),amount=safeInt(req.body?.amount),receiptTotal=Number(req.body?.receiptTotal);
      if(!UUID.test(customerId)||!receiptUuid||!requestId||!amount||!validMoney(receiptTotal))return res.status(400).json({error:'Некорректные данные резерва'});
      await db.query('begin');
      await releaseExpired(db,ownerId);
      const existing=(await db.query('select * from evotor_discount_reservations where owner_id=$1 and request_id=$2 for update',[ownerId,requestId])).rows[0];
      if(existing){
        if(existing.customer_id!==customerId||existing.receipt_uuid!==receiptUuid||Number(existing.amount)!==amount){await db.query('rollback');return res.status(409).json({error:'Идентификатор операции уже использован для другого резерва'});}
        await db.query('commit');
        if(existing.status==='released')return res.status(409).json({error:'Резерв уже отменён'});
        return res.json({ok:true,reservationId:existing.id,status:existing.status,amount:existing.amount,expiresAt:existing.expires_at,idempotent:true});
      }
      const user=await owner(db,ownerId),customer=(await db.query('select * from loyalty_customers where id=$1 and owner_id=$2 for update',[customerId,ownerId])).rows[0];
      if(!user||!customer){await db.query('rollback');return res.status(404).json({error:'Клиент не найден'})}
      if(customer.blocked){await db.query('rollback');return res.status(403).json({error:'Клиент заблокирован'})}
      const quote=quoteFor(normalizeRules(user.miniapp_design?.loyalty||{}),customer,receiptTotal);
      if(amount>quote.maxDiscount){await db.query('rollback');return res.status(400).json({error:'Сумма списания превышает доступный лимит',maxDiscount:quote.maxDiscount});}
      const updated=(await db.query('update loyalty_customers set balance=balance-$1,updated_at=now() where id=$2 and balance>=$1 returning balance',[amount,customer.id])).rows[0];
      if(!updated){await db.query('rollback');return res.status(409).json({error:'Баланс клиента уже изменился, повторите расчёт'})}
      const reservation=(await db.query(`insert into evotor_discount_reservations(owner_id,customer_id,request_id,receipt_uuid,amount,receipt_total,status,expires_at) values($1,$2,$3,$4,$5,$6,'reserved',now()+interval '${RESERVATION_TTL_MINUTES} minutes') returning id,amount,expires_at`,[ownerId,customer.id,requestId,receiptUuid,amount,receiptTotal])).rows[0];
      await db.query('commit');
      res.json({ok:true,reservationId:reservation.id,status:'reserved',amount:reservation.amount,expiresAt:reservation.expires_at});
    }catch(error){await db.query('rollback').catch(()=>{});console.error(error);res.status(500).json({error:'Не удалось зарезервировать бонусы'})}finally{db.release()}
  });

  app.post('/api/v1/evotor/app/discount/commit',guard,async(req,res)=>{
    const db=await pool.connect();
    try{
      const ownerId=req.evotorOwnerId,reservationId=String(req.body?.reservationId||''),receiptUuid=String(req.body?.receiptUuid||'').trim();
      if(!UUID.test(reservationId)||!receiptUuid)return res.status(400).json({error:'Некорректные данные подтверждения'});
      await db.query('begin');
      const reservation=(await db.query('select * from evotor_discount_reservations where id=$1 and owner_id=$2 for update',[reservationId,ownerId])).rows[0];
      if(!reservation){await db.query('rollback');return res.status(404).json({error:'Резерв не найден'})}
      if(reservation.receipt_uuid!==receiptUuid){await db.query('rollback');return res.status(409).json({error:'Резерв относится к другому чеку'})}
      if(reservation.status==='committed'){await db.query('commit');return res.json({ok:true,status:'committed',idempotent:true})}
      if(reservation.status!=='reserved'){await db.query('rollback');return res.status(409).json({error:'Резерв уже отменён'})}
      if(new Date(reservation.expires_at)<=new Date()){await db.query('update evotor_discount_reservations set status=\'released\',released_at=now() where id=$1',[reservation.id]);await db.query('update loyalty_customers set balance=balance+$1,updated_at=now() where id=$2',[reservation.amount,reservation.customer_id]);await db.query('commit');return res.status(409).json({error:'Срок резерва истёк'})}
      await db.query("update evotor_discount_reservations set status='committed',committed_at=now() where id=$1",[reservation.id]);
      await db.query(`insert into loyalty_transactions(owner_id,bot_key,customer_id,kind,bonus_delta,order_total,description,meta) select r.owner_id,c.bot_key,r.customer_id,'debit',-r.amount,r.receipt_total,'Списание бонусов в Эвотор',jsonb_build_object('source','evotor','reservationId',r.id,'receiptUuid',r.receipt_uuid) from evotor_discount_reservations r join loyalty_customers c on c.id=r.customer_id where r.id=$1`,[reservation.id]);
      await db.query('commit');res.json({ok:true,status:'committed',amount:reservation.amount});
    }catch(error){await db.query('rollback').catch(()=>{});console.error(error);res.status(500).json({error:'Не удалось подтвердить списание'})}finally{db.release()}
  });

  app.post('/api/v1/evotor/app/discount/release',guard,async(req,res)=>{
    const db=await pool.connect();
    try{
      const ownerId=req.evotorOwnerId,reservationId=String(req.body?.reservationId||''),receiptUuid=String(req.body?.receiptUuid||'').trim();
      if(!UUID.test(reservationId)||!receiptUuid)return res.status(400).json({error:'Некорректные данные отмены'});
      await db.query('begin');
      const reservation=(await db.query('select * from evotor_discount_reservations where id=$1 and owner_id=$2 for update',[reservationId,ownerId])).rows[0];
      if(!reservation){await db.query('rollback');return res.status(404).json({error:'Резерв не найден'})}
      if(reservation.receipt_uuid!==receiptUuid){await db.query('rollback');return res.status(409).json({error:'Резерв относится к другому чеку'})}
      if(reservation.status==='released'){await db.query('commit');return res.json({ok:true,status:'released',idempotent:true})}
      if(reservation.status==='committed'){await db.query('rollback');return res.status(409).json({error:'Продажа уже подтверждена'})}
      await db.query("update evotor_discount_reservations set status='released',released_at=now() where id=$1",[reservation.id]);
      await db.query('update loyalty_customers set balance=balance+$1,updated_at=now() where id=$2',[reservation.amount,reservation.customer_id]);
      await db.query('commit');res.json({ok:true,status:'released',amount:reservation.amount});
    }catch(error){await db.query('rollback').catch(()=>{});console.error(error);res.status(500).json({error:'Не удалось отменить резерв'})}finally{db.release()}
  });
}
