(()=>{
  const token=localStorage.getItem('LF_TOKEN');
  const text=document.getElementById('buttonText');
  const url=document.getElementById('buttonUrl');
  const preview=document.getElementById('previewButton');
  if(!token||!text||!url)return;

  let fallback='';
  fetch('/api/v1/owner/miniapp',{headers:{Authorization:'Bearer '+token}})
    .then(response=>response.ok?response.json():Promise.reject())
    .then(data=>{
      fallback=String(data.appUrl||'');
      if(fallback){
        url.placeholder='Необязательно — откроется Mini App внутри Telegram';
        syncPreview();
      }
    })
    .catch(()=>{});

  function syncPreview(){
    queueMicrotask(()=>{
      if(preview&&text.value.trim()&&!url.value.trim()&&fallback){
        preview.href=fallback;
        preview.title='Откроет Mini App внутри Telegram';
      }
    });
  }

  text.addEventListener('input',syncPreview);
  url.addEventListener('input',syncPreview);

  const fields=document.querySelector('.button-fields');
  if(!fields||document.getElementById('scheduleType'))return;

  const style=document.createElement('style');
  style.textContent=`
    .schedule-panel{margin-top:14px;padding:16px;border:1px solid #303a43;border-radius:12px;background:#0d1216}
    .schedule-panel>span{display:block;margin-bottom:10px;color:#929da8;font-size:12px}
    .schedule-options{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .schedule-option{min-height:46px;border:1px solid #34404a;border-radius:9px;background:#171e24;color:#dce2e6;font:700 14px/1.2 inherit;cursor:pointer}
    .schedule-option:hover,.schedule-option.active{border-color:var(--green);background:#12221a;color:#fff;box-shadow:0 0 0 3px #6fdda912}
    .schedule-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
    .schedule-field{display:grid;gap:6px;color:#aeb7bf;font-size:12px}
    .schedule-input{width:100%;height:48px;padding:0 12px;border:1px solid #34404a;border-radius:9px;background:#0c1115;color:#fff;font:600 15px inherit;outline:none;color-scheme:dark}
    .schedule-input:focus{border-color:var(--green);box-shadow:0 0 0 3px #6fdda912}
    .schedule-hint{margin:9px 0 0;color:#929da8;font-size:12px}
    @media(max-width:650px){.schedule-fields{grid-template-columns:1fr}.schedule-option,.schedule-input{min-height:48px}}
  `;
  document.head.append(style);

  const box=document.createElement('section');
  box.className='schedule-panel';
  box.innerHTML=`
    <span>Когда отправить · московское время</span>
    <input id="scheduleType" type="hidden" value="now">
    <input id="scheduleDate" type="hidden" value="">
    <div class="schedule-options" role="group" aria-label="Время отправки">
      <button type="button" class="schedule-option active" data-schedule="now" aria-pressed="true">Сейчас</button>
      <button type="button" class="schedule-option" data-schedule="once" aria-pressed="false">Запланировать</button>
    </div>
    <div id="scheduleFields" class="schedule-fields" hidden>
      <label class="schedule-field">Дата<input id="scheduleDay" class="schedule-input" type="date"></label>
      <label class="schedule-field">Время<input id="scheduleTime" class="schedule-input" type="time" step="60" inputmode="numeric"></label>
    </div>
    <p id="scheduleHint" class="schedule-hint" hidden>Введите часы и минуты в формате ЧЧ:ММ.</p>
  `;
  fields.after(box);

  const type=box.querySelector('#scheduleType');
  const dateValue=box.querySelector('#scheduleDate');
  const scheduleFields=box.querySelector('#scheduleFields');
  const hint=box.querySelector('#scheduleHint');
  const day=box.querySelector('#scheduleDay');
  const time=box.querySelector('#scheduleTime');

  const moscowParts=value=>new Intl.DateTimeFormat('en-CA',{
    timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(value).reduce((out,part)=>(out[part.type]=part.value,out),{});
  const suggested=moscowParts(new Date(Date.now()+15*60*1000));
  const today=moscowParts(new Date());
  day.min=`${today.year}-${today.month}-${today.day}`;
  day.value=`${suggested.year}-${suggested.month}-${suggested.day}`;
  time.value=`${suggested.hour}:${suggested.minute}`;

  function syncSchedule(){
    dateValue.value=day.value&&time.value?`${day.value}T${time.value}`:'';
  }

  box.querySelector('.schedule-options').addEventListener('click',event=>{
    const button=event.target.closest('[data-schedule]');
    if(!button)return;
    type.value=button.dataset.schedule;
    box.querySelectorAll('.schedule-option').forEach(option=>{
      const active=option===button;
      option.classList.toggle('active',active);
      option.setAttribute('aria-pressed',String(active));
    });
    const planned=type.value==='once';
    scheduleFields.hidden=!planned;
    hint.hidden=!planned;
    if(planned){syncSchedule();time.focus()}else dateValue.value='';
  });

  day.addEventListener('input',syncSchedule);
  time.addEventListener('input',syncSchedule);
  syncSchedule();
})();
