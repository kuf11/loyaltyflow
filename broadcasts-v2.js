(()=>{
  const token=localStorage.getItem('LF_TOKEN'),buttonText=document.getElementById('buttonText'),buttonUrl=document.getElementById('buttonUrl'),send=document.getElementById('sendBroadcast');
  const css=document.createElement('link');css.rel='stylesheet';css.href='/ui-overrides.css?v=1';document.head.append(css);
  let appUrl='';
  fetch('/api/v1/owner/miniapp',{headers:{Authorization:'Bearer '+token}}).then(response=>response.ok?response.json():Promise.reject()).then(data=>{appUrl=String(data.appUrl||'');if(appUrl)buttonUrl.placeholder='По умолчанию: '+appUrl}).catch(()=>{});
  send?.addEventListener('click',()=>{if(buttonText.value.trim()&&!buttonUrl.value.trim()&&appUrl){buttonUrl.value=appUrl;buttonUrl.dispatchEvent(new Event('input',{bubbles:true}))}},true);
})();
