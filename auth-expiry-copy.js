(()=>{
  'use strict';
  const expiryCopy=/(?:Код|Он)\s+действует\s+15\s+минут\.?/giu;
  const cleanText=node=>{
    if(node.nodeType===Node.TEXT_NODE&&expiryCopy.test(node.nodeValue||'')){
      node.nodeValue=(node.nodeValue||'').replace(expiryCopy,'').replace(/\s+([.!?,])/g,'$1').trimStart();
    }
  };
  const clean=root=>{
    if(!root)return;
    cleanText(root);
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    while(walker.nextNode())cleanText(walker.currentNode);
  };
  const start=()=>{
    clean(document.body);
    new MutationObserver(records=>records.forEach(record=>{
      cleanText(record.target);
      record.addedNodes.forEach(clean);
    })).observe(document.body,{subtree:true,childList:true,characterData:true});
  };
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start,{once:true}):start();
})();
