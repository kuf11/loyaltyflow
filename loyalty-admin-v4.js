(()=>{
  const css=document.createElement('link');css.rel='stylesheet';css.href='/ui-overrides.css?v=1';document.head.append(css);
  const customers=document.getElementById('customers');
  const card=customers?.closest('.card');
  if(card){card.hidden=true;document.querySelector('.two-col')?.classList.add('rules-only')}
  const intro=document.querySelector('.hero-row p');if(intro)intro.textContent='Правила и история реальных операций.';
})();
