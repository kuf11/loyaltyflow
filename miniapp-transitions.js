(()=>{
  if(typeof render!=='function'||typeof draw!=='function'||typeof view==='undefined'||!document.getElementById('app'))return;
  const appNode=document.getElementById('app');
  const directRender=render;
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let renderedView=view;
  let running=false;
  let queued=false;
  const finish=animation=>animation?.finished?.catch(()=>{})||Promise.resolve();
  render=function(){
    if(reduced||typeof Element==='undefined'||typeof Element.prototype.animate!=='function'||view===renderedView){directRender();renderedView=view;return}
    if(running){queued=true;return}
    const outgoing=appNode.querySelector('.page-in');
    if(!outgoing){directRender();renderedView=view;return}
    running=true;
    queued=false;
    appNode.classList.add('view-transitioning');
    const out=outgoing.animate([{opacity:1,transform:'translate3d(0,0,0) scale(1)'},{opacity:0,transform:'translate3d(-10px,0,0) scale(.992)'}],{duration:120,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
    finish(out).then(()=>{
      queued=false;
      directRender();
      renderedView=view;
      const incoming=appNode.querySelector('.page-in');
      if(!incoming)return;
      const enter=incoming.animate([{opacity:0,transform:'translate3d(14px,0,0) scale(.992)'},{opacity:1,transform:'translate3d(0,0,0) scale(1)'}],{duration:240,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'});
      return finish(enter)
    }).finally(()=>{
      running=false;
      appNode.classList.remove('view-transitioning');
      if(queued){queued=false;render()}
    })
  };
  const style=document.createElement('style');
  style.textContent='#app .page-in{animation:none!important}.view-transitioning .page-in,.view-transitioning .bottom button{pointer-events:none}.view-transitioning .page-in{will-change:opacity,transform}@media(prefers-reduced-motion:reduce){.view-transitioning .page-in{will-change:auto}}';
  document.head.append(style);
})();
