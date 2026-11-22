/* Noxvellox frontend: navigation, search and age acknowledgement. */
(function(){
  const menu=document.querySelector('[data-menu]'), nav=document.querySelector('[data-nav]');
  menu?.addEventListener('click',()=>{const open=nav?.classList.toggle('is-open');menu.setAttribute('aria-expanded',String(!!open))});
  const form=document.querySelector('[data-search-form]');
  form?.addEventListener('submit',e=>{const value=form.querySelector('input[name=q]')?.value.trim();if(!value){e.preventDefault();form.querySelector('input')?.focus()}});
  document.querySelectorAll('.detail-row').forEach(el=>{if(el.textContent.includes('Provider:')){el.textContent=el.textContent.replace(/\s*[·•]\s*Provider:.*$/,'').trim();if(!el.textContent)el.remove()}});
  document.querySelectorAll('.detail-row').forEach(el=>{if(el.textContent.includes('Provider:')){el.textContent=el.textContent.replace(/Provider:.*$/,'').trim()}});
  document.querySelectorAll('.video-card .sub').forEach(el=>{if(el.textContent.includes('Pornhub'))el.textContent='Free official embed'});
  const modal=document.querySelector('[data-age-gate]');
  try{if(sessionStorage.getItem('noxvellox-age-confirmed')==='yes')modal?.remove()}catch{}
  const CONSENT_KEY='noxvellox-optional-ads';
  const consent=()=>{try{return localStorage.getItem(CONSENT_KEY)||'unset'}catch{return 'unset'}};
  const setConsent=value=>{try{localStorage.setItem(CONSENT_KEY,value)}catch{}};
  const APPROVED_AD_SRC='https://biomanos.org/21/59eef26524f2edf0d1c3c669286c974c';
  function startPreRoll(player){
    if(!player||player.dataset.prerollStarted==='yes')return;
    const frame=player.querySelector('[data-embed-url]'),overlay=player.querySelector('[data-pre-roll]');
    if(!frame||!overlay)return;
    if(consent()!=='granted'){if(!frame.src)frame.src=frame.dataset.embedUrl;return;}
    player.dataset.prerollStarted='yes';
    overlay.hidden=false;
    const container=overlay.querySelector('[data-preroll-container]');
    const source=container?.dataset.scriptSrc||'';
    if(container&&source===APPROVED_AD_SRC&&!container.dataset.loaded){
      container.dataset.loaded='yes';
      const script=document.createElement('script');script.async=true;script.dataset.cfasync='false';script.src=source;container.append(script);
    }
    let remaining=Math.max(5,Number(overlay.dataset.preRollSeconds)||15);
    const counter=overlay.querySelector('[data-pre-roll-countdown]'),button=overlay.querySelector('[data-pre-roll-continue]');
    if(counter)counter.textContent=String(remaining);
    const finish=()=>{if(player.dataset.prerollFinished==='yes')return;player.dataset.prerollFinished='yes';if(!frame.src)frame.src=frame.dataset.embedUrl;overlay.hidden=true;if(button)button.disabled=true;clearInterval(timer)};
    const timer=setInterval(()=>{remaining-=1;if(counter)counter.textContent=String(Math.max(remaining,0));if(remaining<=0){if(button){button.disabled=false;button.textContent='Continue to video';}finish()}},1000);
    button?.addEventListener('click',finish,{once:true});
  }
  function releaseEmbeds(){
    document.querySelectorAll('[data-embed-url]').forEach(frame=>{
      const player=frame.closest('[data-player]');
      if(player?.querySelector('[data-pre-roll]')&&consent()==='granted'){startPreRoll(player);return;}
      if(!frame.src)frame.src=frame.dataset.embedUrl;
    });
  }
  document.querySelectorAll('[data-cover-image]').forEach(img=>{
    const wrap=img.closest('.video-art,.player');
    const loaded=()=>{if(img.naturalWidth>0)wrap?.classList.add('cover-loaded')};
    img.addEventListener('load',loaded,{once:true});
    img.addEventListener('error',()=>{img.remove();wrap?.classList.remove('cover-loaded')},{once:true});
    if(img.complete){if(img.naturalWidth>0)loaded();else img.remove()}
  });
  document.querySelectorAll('[data-category-image]').forEach(img=>{
    const fail=()=>img.dataset.imageError='yes';
    img.addEventListener('error',fail,{once:true});
    if(img.complete&&img.naturalWidth===0)fail();
  });
  const followKey='noxvellox-followed-channels';
  const readFollowed=()=>{try{return JSON.parse(localStorage.getItem(followKey)||'[]')}catch{return[]}};
  const writeFollowed=value=>{try{localStorage.setItem(followKey,JSON.stringify(value))}catch{}};
  document.querySelectorAll('[data-follow-channel]').forEach(button=>{
    const slug=button.dataset.followChannel,status=document.querySelector(`[data-follow-status="${slug}"]`),followed=readFollowed();
    const paint=()=>{const active=readFollowed().includes(slug);button.textContent=active?'Following channel':'Follow channel';button.setAttribute('aria-pressed',String(active));if(status)status.textContent=active?'Saved on this device':''};
    paint();
    button.addEventListener('click',()=>{const current=readFollowed(),index=current.indexOf(slug);if(index>=0)current.splice(index,1);else current.push(slug);writeFollowed(current);paint()});
  });
  // One entry screen, two independent choices. Optional advertising is off by default.
  const confirmAge=()=>{
    const optedIn=document.querySelector('[data-age-ads-opt-in]')?.checked===true;
    setConsent(optedIn?'granted':'denied');
    try{sessionStorage.setItem('noxvellox-age-confirmed','yes')}catch{}
    modal?.remove();
    releaseEmbeds();
    renderAd();
  };
  document.querySelector('[data-age-confirm]')?.addEventListener('click',confirmAge);
  // Keep external playback disabled until age acknowledgement; search metadata remains server-rendered.
  if(!modal || !modal.isConnected)releaseEmbeds();
  // Consent-first Adsterra Native Banner integration. Never load external ad script
  // while the adult acknowledgement is visible or without an affirmative opt-in.
  const ageAccepted=()=>!document.querySelector('[data-age-gate]')?.isConnected;
  const baseSlot=document.querySelector('[data-native-ad]');
  if(baseSlot){
    const targets=[document.querySelector('.page-head'),document.querySelector('aside'),document.querySelector('.footer')].filter(Boolean).slice(0,3);
    targets.forEach((target,index)=>{const clone=baseSlot.cloneNode(true);clone.dataset.adClone=String(index+1);const container=clone.querySelector('[data-ad-container]');if(container)container.id=`${container.id}-extra-${index+1}`;target.append(clone)});
  }
  const slots=[...document.querySelectorAll('[data-native-ad]')];
  const adHealth={slots:[],provider:'Adsterra',consentRequired:true,lastChecked:null};
  window.__noxvelloxAdHealth=adHealth;
  const setAdState=(slot,state)=>{
    slot.dataset.adState=state;
    const index=slots.indexOf(slot);
    if(index>=0)adHealth.slots[index]={index:index+1,state,containerChildren:slot.querySelector('[data-ad-container]')?.childElementCount||0};
    adHealth.lastChecked=new Date().toISOString();
  };
  slots.forEach((slot,index)=>{
    setAdState(slot,'idle');
    const container=slot.querySelector('[data-ad-container]');
    if(!container)return;
    const observer=new MutationObserver(()=>{if(container.childElementCount>0)setAdState(slot,'rendered');});
    observer.observe(container,{childList:true,subtree:true});
    slot.dataset.adObserver='active';
  });
  if(ageAccepted()&&consent()==='unset')setConsent('denied');
  const renderAd=()=>{
    if(!slots.length)return;
    const c=consent();
    if(!ageAccepted())return;
    slots.forEach(slot=>{
      const message=slot.querySelector('[data-ad-message]');
      if(c==='denied'){setAdState(slot,'disabled');if(message)message.textContent='Optional ads are disabled. You can change this in Ad preferences.';return;}
      if(c!=='granted'||slot.dataset.loaded==='yes')return;
      const scriptUrl=slot.dataset.scriptSrc;
      if(scriptUrl!==APPROVED_AD_SRC){setAdState(slot,'blocked-url');return;}
      slot.dataset.loaded='yes';
      setAdState(slot,'loading');
      if(message)message.textContent='';
      const s=document.createElement('script');
      s.async=true;
      s.setAttribute('data-cfasync','false');
      s.src=scriptUrl;
      s.addEventListener('load',()=>{
        setAdState(slot,'loaded');
        window.setTimeout(()=>{if((slot.querySelector('[data-ad-container]')?.childElementCount||0)===0&&slot.dataset.adState==='loaded')setAdState(slot,'loaded-no-render')},8000);
      });
      s.addEventListener('error',()=>{setAdState(slot,'error');if(message)message.textContent='Advertisement is temporarily unavailable.'});
      slot.querySelector('[data-ad-container]')?.before(s);
    });
    if(c==='granted')fetch('/api/ad-health',{credentials:'same-origin',cache:'no-store'}).then(r=>r.json()).then(data=>{adHealth.server=data;adHealth.lastChecked=new Date().toISOString()}).catch(()=>{adHealth.server={ok:false,note:'Banner health endpoint unavailable'}});
    releaseEmbeds();
  };
  document.addEventListener('click',(event)=>{
    if(event.target.closest('[data-ad-preferences]')){
      const ok=window.confirm('Allow optional Adsterra advertising to load on Noxvellox? Select Cancel to keep ads disabled.');
      setConsent(ok?'granted':'denied');
      if(ok){renderAd()}else{location.reload()}
    }
  });
  renderAd();
  document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{const active=document.querySelector('[data-filter].active');active?.classList.remove('active');button.classList.add('active')}));
})();
