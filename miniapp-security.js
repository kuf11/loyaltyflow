(()=>{
  const bindSafeCategoryHandler=element=>{
    const code=String(element.getAttribute('onclick')||'');
    if(!/^choose\s*\(/.test(code))return;
    const label=String(element.textContent||'').trim();
    const category=/^все$/i.test(label)?'':label;
    element.removeAttribute('onclick');
    element.addEventListener('click',()=>{if(typeof choose==='function')choose(category)});
  };
  const harden=root=>{
    if(!(root instanceof Element)&&root!==document)return;
    const nodes=[];
    if(root instanceof Element)nodes.push(root);
    nodes.push(...root.querySelectorAll('[onclick],[onerror],[onload]'));
    for(const node of nodes){
      if(node.hasAttribute?.('onclick'))bindSafeCategoryHandler(node);
      node.removeAttribute?.('onerror');
      node.removeAttribute?.('onload');
    }
  };
  const app=document.getElementById('app');
  if(!app)return;
  harden(app);
  new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)harden(node)}).observe(app,{childList:true,subtree:true});
})();
