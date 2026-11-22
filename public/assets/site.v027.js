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
  const vastText=async endpoint=>{
    const response=await fetch(endpoint,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/xml,text/xml,*/*'}});
    if(!response.ok)throw new Error(`VAST request failed (${response.status})`);
    return response.text();
  };
  const parseVast=xmlText=>{
    const doc=new DOMParser().parseFromString(xmlText,'application/xml');
    if(doc.querySelector('parsererror'))return null;
    const media=[...doc.querySelectorAll('MediaFile')].map(node=>({
      url:(node.textContent||'').trim(),
      type:node.getAttribute('type')||'',
      width:Number(node.getAttribute('width')||0),
      height:Number(node.getAttribute('height')||0)
    })).filter(item=>/^https:\/\//i.test(item.url)&&(!item.type||/^video\//i.test(item.type)));
    const chosen=media.find(item=>/video\/(mp4|webm)/i.test(item.type))||media[0];
    const click=(doc.querySelector('ClickThrough')?.textContent||'').trim();
    const wrapper=(doc.querySelector('VASTAdTagURI')?.textContent||'').trim();
    return chosen?{mediaUrl:chosen.url,clickUrl:/^https:\/\//i.test(click)?click:'',wrapper:/^https:\/\//i.test(wrapper)?wrapper:''}:wrapper?{wrapper}:null;
  };
  async function resolveVast(endpoint,depth=0){
    if(depth>2)throw new Error('VAST wrapper limit reached');
    const parsed=parseVast(await vastText(endpoint));
    if(!parsed)throw new Error('No playable MediaFile in VAST response');
    if(parsed.mediaUrl)return parsed;
    return resolveVast(parsed.wrapper,depth+1);
  }
  function startMidRoll(player){
    if(!player||player.dataset.midrollScheduled==='yes'||consent()!=='granted')return;
    const frame=player.querySelector('[data-embed-url]');
    if(!frame)return;
    player.dataset.midrollScheduled='yes';
    const show=()=>{
      if(player.dataset.midrollShown==='yes')return;
      player.dataset.midrollShown='yes';
      const overlay=document.createElement('div');
      overlay.className='mid-roll-overlay';overlay.hidden=false;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-label','Sponsored advertisement');
      overlay.style.cssText='position:absolute;inset:0;z-index:7;display:grid;place-items:center;background:#08070df2;padding:20px';
      overlay.innerHTML='<div class="mid-roll-card" style="width:min(430px,100%);padding:24px;border:1px solid #76505d;border-radius:16px;background:#19151e;text-align:center;box-shadow:0 20px 80px #000b"><div class="ad-label" style="color:#ff9caf;font-size:10px;letter-spacing:.15em;text-transform:uppercase;font-weight:900">Advertisement · Sponsored break</div><div data-mid-roll-container style="min-height:90px;margin:16px 0;border:1px dashed #5b4550;border-radius:10px;display:grid;place-items:center;color:#8d7f89;font-size:10px">Sponsored placement</div><p style="color:#c8bdc6;font-size:12px">Sponsored placement after 15 seconds in the player.</p><button class="button ghost" type="button" data-mid-roll-close>Continue to video</button></div>';
      player.append(overlay);
      const container=overlay.querySelector('[data-mid-roll-container]');
      if(container&&!container.dataset.loaded){container.dataset.loaded='yes';const script=document.createElement('script');script.async=true;script.dataset.cfasync='false';script.src=APPROVED_AD_SRC;container.before(script);}
      overlay.querySelector('[data-mid-roll-close]')?.addEventListener('click',()=>{overlay.hidden=true;player.dataset.midrollClosed='yes'},{once:true});
      window.setTimeout(()=>{if(overlay.isConnected&&overlay.hidden===false&&container?.childElementCount===0){overlay.hidden=true;player.dataset.midrollState='no-fill'}},8000);
    };
    const arm=()=>{if(player.dataset.midrollTimer==='yes')return;player.dataset.midrollTimer='yes';window.setTimeout(show,15000)};
    if(frame.src)arm();else frame.addEventListener('load',arm,{once:true});
  }
  function startPreRoll(player){
    if(!player||player.dataset.prerollStarted==='yes')return;
    const frame=player.querySelector('[data-embed-url]'),overlay=player.querySelector('[data-pre-roll]');
    if(!frame||!overlay)return;
    if(consent()!=='granted'){if(!frame.src)frame.src=frame.dataset.embedUrl;return;}
    const endpoint=overlay.dataset.vastEndpoint||'';
    const container=overlay.querySelector('[data-preroll-container]');
    const status=overlay.querySelector('[data-pre-roll-status]');
    const finish=()=>{if(player.dataset.prerollFinished==='yes')return;player.dataset.prerollFinished='yes';if(!frame.src)frame.src=frame.dataset.embedUrl;overlay.hidden=true;player.dataset.prerollState='finished';startMidRoll(player)};
    if(!endpoint){player.dataset.prerollState='not-configured';finish();return;}
    player.dataset.prerollStarted='yes';
    overlay.hidden=false;
    const media=overlay.querySelector('[data-pre-roll-media]');
    const copy=overlay.querySelector('[data-pre-roll-copy]');
    resolveVast(endpoint).then(ad=>{
      const video=document.createElement('video');
      video.src=ad.mediaUrl;video.controls=true;video.autoplay=true;video.muted=true;video.playsInline=true;video.preload='auto';video.style.cssText='display:block;width:100%;max-height:230px;aspect-ratio:16/9;object-fit:contain;background:#000';
      video.setAttribute('aria-label','Sponsored video advertisement');
      media.hidden=false;media.append(video);container?.setAttribute('hidden','hidden');
      if(status)status.textContent='Sponsored video';
      if(copy)copy.textContent='The video will start when this sponsored message finishes.';
      if(ad.clickUrl)video.addEventListener('click',()=>window.open(ad.clickUrl,'_blank','noopener,noreferrer'));
      video.addEventListener('ended',finish,{once:true});
      video.addEventListener('error',()=>finish(),{once:true});
      video.play().catch(()=>{if(status)status.textContent='Press play to view the sponsored message.'});
    }).catch(()=>{
      player.dataset.prerollState='unavailable';
      if(status)status.textContent='Sponsored video is temporarily unavailable.';
      finish();
    });
  }
  function releaseEmbeds(){
    document.querySelectorAll('[data-embed-url]').forEach(frame=>{
      const player=frame.closest('[data-player]');
      if(player?.querySelector('[data-pre-roll]')&&consent()==='granted'){startPreRoll(player);return;}
      if(!frame.src)frame.src=frame.dataset.embedUrl;
      startMidRoll(player);
    });
  }
  document.querySelectorAll('[data-cover-image]').forEach(media=>{
    const wrap=media.closest('.video-art,.player');
    const isVideo=media.tagName==='VIDEO';
    const loaded=()=>{const ready=isVideo?media.readyState>=2:media.naturalWidth>0;if(ready)wrap?.classList.add('cover-loaded')};
    media.addEventListener(isVideo?'loadeddata':'load',loaded,{once:true});
    media.addEventListener('error',()=>{media.remove();wrap?.classList.remove('cover-loaded')},{once:true});
    if(isVideo){media.muted=true;media.play().catch(()=>{});if(media.readyState>=2)loaded()}
    else if(media.complete){if(media.naturalWidth>0)loaded();else media.remove()}
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
  // Use only server-declared placements. Cloning one native tag into
  // unrelated areas makes the provider load several copies while filling
  // only one, leaving broken empty boxes on the page.
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
