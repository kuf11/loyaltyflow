(()=>{
  const originalHome=typeof home==='function'?home:null;
  if(originalHome){
    window.home=function(){
      const html=originalHome();
      const label=esc(String(d?.buttonText||'Открыть каталог').trim()||'Открыть каталог');
      return html.replace(/Открыть каталог(?=\s*<span class="icon">)/,label);
    };
  }

  window.toast=function(message){
    document.querySelectorAll('.toast').forEach(node=>node.remove());
    const node=document.createElement('div');
    node.className='toast';
    node.setAttribute('role','alert');
    node.textContent=String(message||'Произошла ошибка');
    document.body.append(node);
    setTimeout(()=>node.remove(),3600);
  };

  function enhanceLogo(){
    const identity=document.querySelector('.top .identity');
    if(!identity||identity.dataset.homeLink)return;
    identity.dataset.homeLink='true';
    identity.tabIndex=0;
    identity.setAttribute('role','link');
    identity.setAttribute('aria-label','На главную');
    const goHome=()=>{ if(typeof setView==='function')setView('home'); else location.href='/'; };
    identity.addEventListener('click',goHome);
    identity.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();goHome()}});
  }
  new MutationObserver(enhanceLogo).observe(document.getElementById('app'),{childList:true,subtree:true});
  enhanceLogo();
})();
