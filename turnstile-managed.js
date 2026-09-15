(()=>{
  const api=window.turnstile;
  if(!api||typeof api.render!=='function')return;
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
      retry:'auto',
      'refresh-expired':'auto',
      'error-callback':code=>{
        originalError?.(code);
        const status=document.querySelector('.captcha-status');
        if(status)status.textContent='Ошибка Cloudflare Turnstile: '+String(code||'unknown');
      }
    });
  };
})();
