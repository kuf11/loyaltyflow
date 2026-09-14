(()=>{
  const css=document.createElement('link');css.rel='stylesheet';css.href='/ui-overrides.css?v=1';document.head.append(css);
  function closeModal(){document.querySelector('.user-modal')?.remove();document.body.classList.remove('user-modal-open')}
  function openUser(id){
    const user=typeof users!=='undefined'?users.find(item=>String(item.id)===String(id)):null;if(!user)return;
    const modal=document.createElement('section');modal.className='user-modal';
    modal.innerHTML=`<div class="user-modal-panel" role="dialog" aria-modal="true"><header><div><span class="eyebrow">Пользователь</span><h2>${esc(user.full_name)}</h2><p>${esc(user.email)}</p></div><button class="user-modal-close" type="button" aria-label="Закрыть">×</button></header><div class="user-modal-grid"><div><span>Компания</span><b>${esc(user.company||'—')}</b></div><div><span>Телефон</span><b>${esc(user.phone||'—')}</b></div><div><span>Статус</span><b>${esc(state(user))}</b></div><div><span>Тариф</span><b>${esc(user.subscription_status||'trial')}</b></div><div><span>Доступ до</span><b>${date(user.trial_end)}</b></div><div><span>Telegram</span><b>${user.bot_connected?'Подключён':'Не подключён'}</b></div><div><span>Создан</span><b>${date(user.created_at)}</b></div><div><span>ID</span><b>${esc(user.id)}</b></div></div><footer class="user-modal-actions"><button data-modal-action="${user.admin_frozen?'unfreeze':'freeze'}">${user.admin_frozen?'Разморозить':'Заморозить'}</button><button data-modal-action="extend">Продлить</button><button data-modal-action="cancel">Аннулировать</button><button data-modal-action="reset">Сбросить пароль</button><button class="danger" data-modal-action="delete">Удалить</button></footer></div>`;
    document.body.append(modal);document.body.classList.add('user-modal-open');
    modal.querySelector('.user-modal-close').onclick=closeModal;modal.onclick=event=>{if(event.target===modal)closeModal()};
    modal.querySelector('.user-modal-actions').onclick=event=>{const button=event.target.closest('[data-modal-action]');if(!button)return;closeModal();action(id,button.dataset.modalAction)};
    modal.querySelector('.user-modal-close').focus();
  }
  function enhance(){document.querySelectorAll('.user-card').forEach(card=>{card.querySelector('.actions')?.setAttribute('hidden','');if(card.dataset.clickable)return;card.dataset.clickable='true';card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label','Открыть пользователя');card.onclick=()=>openUser(card.dataset.id);card.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openUser(card.dataset.id)}}})}
  new MutationObserver(enhance).observe(document.getElementById('users'),{childList:true,subtree:true});enhance();
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeModal()});
})();
