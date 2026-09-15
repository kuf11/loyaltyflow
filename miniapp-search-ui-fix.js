(()=>{
  const style=document.createElement('style');
  style.textContent=`
    .welcome + .section-head {
      display:grid !important;
      grid-template-columns:minmax(0,1fr) auto;
      align-items:center !important;
      gap:8px;
      min-height:40px;
      margin-top:32px;
    }
    .welcome + .section-head h2 {
      min-width:0;
      height:auto;
      margin:0;
      font-size:clamp(20px,5.4vw,24px);
      line-height:1.08;
      letter-spacing:-.035em;
      white-space:nowrap;
    }
    .welcome + .section-head > button {
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:6px;
      width:auto;
      height:36px;
      min-height:36px;
      padding:0 7px;
      border:0;
      border-radius:9px;
      background:transparent;
      color:#dfe3e8;
      box-shadow:none;
      font-size:14px;
      font-weight:700;
      line-height:1;
      white-space:nowrap;
    }
    .welcome + .section-head > button::after {
      content:"→";
      color:#9aa2ad;
      font-size:18px;
      line-height:1;
      transition:transform .16s ease;
    }
    .welcome + .section-head > button:active {
      transform:scale(.97);
      background:#171b20;
    }
    .welcome + .section-head > button:active::after { transform:translateX(2px); }
    @media (max-width:360px) {
      .welcome + .section-head { gap:5px; min-height:36px; }
      .welcome + .section-head h2 { font-size:19px; letter-spacing:-.045em; }
      .welcome + .section-head > button {
        height:34px;
        min-height:34px;
        padding:0 4px;
        font-size:13px;
        gap:4px;
      }
      .welcome + .section-head > button::after { font-size:17px; }
    }
    .catalog-search { position:relative; margin:14px 0 10px; }
    .catalog-search .search { margin:0; padding-right:44px; }
    .search-clear { position:absolute; top:50%; right:8px; width:34px; height:34px; transform:translateY(-50%); border:0; border-radius:50%; background:var(--card); color:var(--muted); font-size:20px; }
    .search-clear[hidden] { display:none; }
    .search-summary { min-height:20px; margin:8px 2px 12px; color:var(--muted); font-size:12px; }
    .search-empty { grid-column:1/-1; padding:42px 20px; text-align:center; color:var(--muted); }
    .search-empty b { display:block; margin-bottom:6px; color:var(--text); font-size:18px; }
  `;
  document.head.append(style);

  const normalize=value=>String(value??'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/gi,' ').trim();
  const matchedProducts=()=>{
    const terms=normalize(query).split(' ').filter(Boolean);
    return products.filter(product=>(category==='Все'||product.category===category)&&(!terms.length||terms.every(term=>normalize([product.name,product.category,product.price].join(' ')).includes(term))));
  };

  filtered=()=>{
    const list=matchedProducts();
    return list.length?grid(list):'<div class="catalog"><div class="search-empty"><b>Ничего не найдено</b><span>Попробуйте изменить запрос или выбрать другую категорию.</span></div></div>';
  };

  catalogPage=()=>{
    const cats=['Все',...new Set(products.map(product=>product.category).filter(Boolean))];
    return '<main class="page-in"><div class="section-head"><h1>Каталог</h1></div><div class="catalog-search"><input id="search" class="search" value="'+esc(query)+'" placeholder="Название, категория или цена" autocomplete="off"><button id="searchClear" class="search-clear" type="button" '+(query?'':'hidden')+' aria-label="Очистить поиск">×</button></div><div id="searchSummary" class="search-summary"></div><div class="chips">'+cats.map(item=>'<button class="chip '+(item===category?'on':'')+'" type="button" data-category="'+esc(item)+'">'+esc(item)+'</button>').join('')+'</div><div id="products">'+filtered()+'</div></main>';
  };

  function updateSearchResults(){
    const list=matchedProducts(),target=document.getElementById('products'),summary=document.getElementById('searchSummary'),clear=document.getElementById('searchClear');
    if(target)target.innerHTML=list.length?grid(list):'<div class="catalog"><div class="search-empty"><b>Ничего не найдено</b><span>Попробуйте изменить запрос или выбрать другую категорию.</span></div></div>';
    if(summary)summary.textContent=query.trim()?`Найдено: ${list.length}`:`Товаров в категории: ${list.length}`;
    if(clear)clear.hidden=!query;
  }

  draw=()=>{
    app.innerHTML=header()+(view==='home'?home():view==='qr'?qrPage():view==='catalog'?catalogPage():cartPage())+nav();
    if(view==='home'&&document.getElementById('homeQr')&&window.QRCode)new QRCode('homeQr',{text:'loyaltyflow:'+tenant+':'+client,width:96,height:96});
    if(view==='qr'&&window.QRCode)new QRCode('fullQr',{text:'loyaltyflow:'+tenant+':'+client,width:230,height:230});
    if(view==='catalog'){
      const input=document.getElementById('search');
      input?.addEventListener('input',event=>{query=event.target.value;updateSearchResults()});
      document.getElementById('searchClear')?.addEventListener('click',()=>{query='';input.value='';input.focus();updateSearchResults()});
      document.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{category=button.dataset.category;render()}));
      updateSearchResults();
    }
  };
  render();
})();
