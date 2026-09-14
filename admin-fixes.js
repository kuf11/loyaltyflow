(()=>{
  const token=localStorage.getItem('LF_TOKEN');
  const byId=id=>document.getElementById(id);
  const request=async(url,options={})=>{options.headers={...(options.headers||{}),Authorization:'Bearer '+token};const response=await fetch(url,options),data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||`Ошибка (${response.status})`);return data};
  const link=document.createElement('link');link.rel='stylesheet';link.href='/ui-overrides.css?v=1';document.head.append(link);

  function syncProfile(){
    if(typeof state==='undefined'||!state?.design)return;
    const name=String(state.design.profileName||'').trim(),company=String(state.design.companyName||'').trim();
    if(name&&byId('settingsName'))byId('settingsName').textContent=name;
    if(company&&byId('settingsCompany'))byId('settingsCompany').textContent=company;
    if(company&&byId('companyName'))byId('companyName').textContent=company;
  }

  function installMenuButtonField(){
    const buttonText=byId('buttonText');
    if(!buttonText||byId('menuButtonText'))return;
    const label=document.createElement('label');label.className='field full';label.textContent='Название кнопки меню бота';
    const input=document.createElement('input');input.id='menuButtonText';input.name='menuButtonText';input.maxLength=64;input.placeholder='Открыть приложение';input.value=String(state?.design?.menuButtonText||'Открыть приложение');
    input.addEventListener('input',()=>{state.design.menuButtonText=input.value.trim()});
    label.append(input);buttonText.closest('label')?.after(label);
  }

  async function addClientActions(modal){
    if(modal.dataset.actionsReady)return;modal.dataset.actionsReady='true';
    const telegramId=modal.querySelector('.client-modal-head p')?.textContent.replace(/.*:\s*/,'').trim();
    if(!telegramId)return;
    try{
      const data=await request('/api/v1/owner/loyalty');
      const customer=(data.customers||[]).find(item=>String(item.telegram_id)===telegramId);
      if(!customer)return;
      const body=modal.querySelector('.client-modal-body'),section=document.createElement('section');section.className='client-manage';
      section.innerHTML=`<h3>Управление клиентом</h3><div class="client-manage-row"><input type="number" min="1" inputmode="numeric" placeholder="Количество бонусов" aria-label="Количество бонусов"><button class="btn" data-client-action="credit">Начислить</button><button class="btn" data-client-action="debit">Списать</button><button class="btn danger" data-client-action="block">${customer.blocked?'Разблокировать':'Заблокировать'}</button></div><div class="client-manage-status" aria-live="polite"></div>`;
      body.insertBefore(section,body.querySelector('.client-history-title'));
      section.addEventListener('click',async event=>{const button=event.target.closest('[data-client-action]');if(!button)return;const status=section.querySelector('.client-manage-status'),action=button.dataset.clientAction;button.disabled=true;status.textContent='Сохраняем…';try{if(action==='block'){await request('/api/v1/owner/loyalty/block',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customerId:customer.id,blocked:!customer.blocked})})}else{const amount=Math.abs(Number(section.querySelector('input').value)||0);if(!amount)throw Error('Введите количество бонусов');await request('/api/v1/owner/loyalty/adjust',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customerId:customer.id,amount:action==='debit'?-amount:amount,description:action==='debit'?'Ручное списание':'Ручное начисление'})})}status.textContent='Готово';setTimeout(()=>location.reload(),450)}catch(error){status.textContent=error.message;button.disabled=false}});
    }catch(error){console.error('Client actions unavailable',error)}
  }

  const observer=new MutationObserver(()=>{syncProfile();installMenuButtonField();document.querySelectorAll('.client-modal').forEach(addClientActions)});
  observer.observe(document.body,{childList:true,subtree:true});
  setTimeout(()=>{syncProfile();installMenuButtonField()},0);
})();
