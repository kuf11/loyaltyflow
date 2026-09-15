(()=>{
  let attempts=0;
  const install=()=>{
    const api=window.turnstile;
    if(!api||typeof api.render!=='function'){
      if(attempts++<1000)setTimeout(install,10);
      return;
    }
    if(api.__loyaltyFlowWrapped)return;
    const originalRender=api.render.bind(api);
    api.render=(target,options={})=>{
      const originalError=options['error-callback'];
      return originalRender(target,{
        ...options,
        theme:'dark',
        appearance:'always',
        execution:'render',
        size:'normal',
        action:'register',
        retry:'never',
        'refresh-expired':'auto',
        'error-callback':code=>{
          originalError?.(code);
          const status=document.querySelector('.captcha-status');
          if(status)status.textContent='Ошибка Cloudflare Turnstile: '+String(code||'unknown');
          console.error('Cloudflare Turnstile error',code);
          return true;
        }
      });
    };
    api.__loyaltyFlowWrapped=true;
  };
  install();
})();
