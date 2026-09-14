(()=>{
  const style=document.createElement('style');
  style.textContent=`
    .analytics-panel{margin:14px 0}
    .analytics-head{display:flex;justify-content:space-between;align-items:end;gap:16px;margin-bottom:14px}
    .analytics-head h2{margin:0;font-size:20px}.analytics-head p{margin:4px 0 0;color:#9299a5}
    .analytics-source{color:#9299a5;font-size:12px;text-align:right;max-width:360px}
    .analytics-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
    .analytics-metric{min-height:132px}.analytics-metric span,.analytics-metric small{display:block;color:#9299a5}
    .analytics-metric strong{display:block;margin:16px 0 8px;font-size:27px;line-height:1.05}
    .analytics-details{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:14px;margin-top:14px}
    .segment-list{display:grid;gap:12px;margin-top:18px}.segment-row{display:grid;grid-template-columns:130px 1fr 44px;gap:10px;align-items:center}
    .segment-row span{color:#cbd0d6}.segment-track{height:8px;border-radius:99px;background:#252a31;overflow:hidden}.segment-track i{display:block;height:100%;border-radius:99px;background:#70d7a5}
    .segment-row b{text-align:right}.analytics-guide{display:grid;gap:12px}.analytics-guide div{padding:12px;border:1px solid #252a31;border-radius:10px;background:#111419}
    .analytics-guide b,.analytics-guide small{display:block}.analytics-guide small{margin-top:4px;color:#9299a5}
    @media(max-width:900px){.analytics-grid{grid-template-columns:1fr 1fr}.analytics-details{grid-template-columns:1fr}.analytics-source{text-align:left}}
    @media(max-width:540px){.analytics-head{display:block}.analytics-source{margin-top:8px}.analytics-grid{grid-template-columns:1fr 1fr;gap:9px}.analytics-metric{min-height:116px;padding:15px}.analytics-metric strong{font-size:22px}.segment-row{grid-template-columns:105px 1fr 36px}.customer-top{display:grid!important;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:start}.customer-top>div{min-width:0}.customer-top>div:last-child{text-align:right}.customer-top small{overflow-wrap:anywhere}}
  `;
  document.head.append(style);
  const statsNode=document.querySelector('.loyalty-stats');
  if(!statsNode)return;
  const panel=document.createElement('section');
  panel.id='analyticsPanel';panel.className='analytics-panel';
  panel.innerHTML=`<div class="analytics-head"><div><div class="eyebrow">Аналитика</div><h2>Подробная статистика</h2><p>Продажи, возврат клиентов и состояние бонусной программы.</p></div><div class="analytics-source">Покупки товаров в Telegram и продажи магазина учитываются отдельно.</div></div><div class="analytics-grid" id="analyticsMetrics"></div><div class="analytics-details"><article class="card"><div class="section-title"><div><h2>Сегменты клиентов</h2><p>Упрощённый RFM-анализ по давности и частоте покупок.</p></div></div><div class="segment-list" id="analyticsSegments"></div></article><article class="card"><div class="section-title"><div><h2>Как читать показатели</h2><p>Короткие формулы и назначение.</p></div></div><div class="analytics-guide"><div><b>Покупки в боте</b><small>Заказы товаров, оформленные через корзину Telegram Mini App.</small></div><div><b>Покупки в магазине</b><small>Офлайн-продажи, переданные кассой или POS-интеграцией.</small></div><div><b>Средний чек</b><small>Общая выручка ÷ количество покупок.</small></div><div><b>Повторные клиенты</b><small>Покупатели с двумя и более покупками среди последних 100 операций.</small></div><div><b>RFM-сегменты</b><small>Группировка по давности последней покупки, частоте и сумме трат.</small></div></div></article></div>`;
  statsNode.after(panel);
  const money=value=>Number(value||0).toLocaleString('ru-RU',{maximumFractionDigits:0})+' ₽';
  const number=value=>Number(value||0).toLocaleString('ru-RU',{maximumFractionDigits:1});
  function update(){
    if(typeof state==='undefined')return;
    const customers=Array.isArray(state.customers)?state.customers:[],transactions=Array.isArray(state.transactions)?state.transactions:[],stats=state.stats||{},orders=Number(stats.orders||0),revenue=Number(stats.revenue||0),customerCount=Number(stats.customers||0),now=Date.now(),month=30*86400000;
    const purchases=transactions.filter(row=>row.kind==='purchase'),byCustomer=new Map();
    for(const row of purchases){const key=String(row.telegram_id||row.customer_id||row.username||'');if(!key)continue;const item=byCustomer.get(key)||{count:0,last:0};item.count++;item.last=Math.max(item.last,new Date(row.created_at).getTime()||0);byCustomer.set(key,item)}
    const repeat=[...byCustomer.values()].filter(item=>item.count>=2).length,purchasers=byCustomer.size,repeatRate=purchasers?repeat/purchasers*100:0;
    const activity=new Map();for(const row of transactions){const key=String(row.telegram_id||row.customer_id||row.username||'');const time=new Date(row.created_at).getTime()||0;if(key)activity.set(key,Math.max(activity.get(key)||0,time))}
    const active30=customers.filter(customer=>{const key=String(customer.telegram_id||customer.id||customer.username||'');return now-(activity.get(key)||new Date(customer.created_at).getTime()||0)<=month}).length;
    const outstanding=customers.reduce((sum,customer)=>sum+Number(customer.balance||0),0),debited=transactions.reduce((sum,row)=>sum+(Number(row.bonus_delta)<0?Math.abs(Number(row.bonus_delta)):0),0);
    const metrics=[['Покупки в боте',number(stats.bot_orders),'Заказы товаров Mini App'],['Выручка в боте',money(stats.bot_revenue),'Продажи через Telegram'],['Покупки в магазине',number(stats.store_orders),'Продажи кассы / POS'],['Выручка магазина',money(stats.store_revenue),'Офлайн-продажи'],['Средний чек',money(orders?revenue/orders:0),'Вся выручка ÷ покупки'],['Покупок на клиента',number(customerCount?orders/customerCount:0),'Общая частота покупок'],['Повторные клиенты',number(repeatRate)+'%',repeat+' из '+purchasers+' покупателей'],['Активны 30 дней',number(active30),customerCount?number(active30/customerCount*100)+'% клиентской базы':'Нет данных'],['Бонусов на счетах',number(outstanding),'Текущий обязательный баланс'],['Списано бонусов',number(debited),'По последним 100 операциям']];
    document.getElementById('analyticsMetrics').innerHTML=metrics.map(([label,value,hint])=>`<article class="card analytics-metric"><span>${label}</span><strong>${value}</strong><small>${hint}</small></article>`).join('');
    const groups={'Лояльные':0,'Активные':0,'Под риском':0,'Спящие':0,'Без покупок':0};
    for(const customer of customers){const key=String(customer.telegram_id||customer.id||customer.username||''),purchase=byCustomer.get(key),days=purchase?.last?Math.floor((now-purchase.last)/86400000):Infinity;if(purchase?.count>=3&&days<=30)groups['Лояльные']++;else if(purchase?.count>=1&&days<=30)groups['Активные']++;else if(purchase?.count>=1&&days<=90)groups['Под риском']++;else if(purchase?.count)groups['Спящие']++;else groups['Без покупок']++}
    const total=Math.max(customers.length,1);document.getElementById('analyticsSegments').innerHTML=Object.entries(groups).map(([label,count])=>`<div class="segment-row"><span>${label}</span><div class="segment-track"><i style="width:${Math.round(count/total*100)}%"></i></div><b>${count}</b></div>`).join('');
  }
  const observer=new MutationObserver(()=>requestAnimationFrame(update));
  const customersNode=document.getElementById('customers'),transactionsNode=document.getElementById('transactions'),customersStat=document.getElementById('customersStat');
  for(const node of[customersNode,transactionsNode,customersStat])if(node)observer.observe(node,{childList:true,subtree:true,characterData:true});
  update();
})();
