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
  const ANALYTICS_CONSENT_KEY='noxvellox-google-analytics';
  const GA_ID='G-SZY1W9EZ3G';
  const analyticsConsent=()=>{try{return localStorage.getItem(ANALYTICS_CONSENT_KEY)||'unset'}catch{return 'unset'}};
  const setAnalyticsConsent=value=>{try{localStorage.setItem(ANALYTICS_CONSENT_KEY,value)}catch{}};
  const loadAnalytics=()=>{
    if(analyticsConsent()!=='granted'||document.querySelector('[data-google-analytics]'))return;
    window.dataLayer=window.dataLayer||[];
    window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};
    window.gtag('js',new Date());
    window.gtag('config',GA_ID);
    const script=document.createElement('script');
    script.async=true;
    script.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(GA_ID);
    script.dataset.googleAnalytics='true';
    document.head.appendChild(script);
  };
  let cookieBanner=null;
  const removeCookieBanner=()=>{cookieBanner?.remove();cookieBanner=null};
  const saveCookieChoices=(allowAds,allowAnalytics)=>{
    const hadAds=consent()==='granted',hadAnalytics=analyticsConsent()==='granted';
    setConsent(allowAds?'granted':'denied');
    setAnalyticsConsent(allowAnalytics?'granted':'denied');
    removeCookieBanner();
    if(ageAccepted())renderAd();
    if(allowAnalytics)loadAnalytics();
    if((hadAds&&!allowAds)||(hadAnalytics&&!allowAnalytics))location.reload();
  };
  const setAnalyticsChoice=allow=>saveCookieChoices(consent()==='granted',allow);
  const APPROVED_AD_SRC='https://biomanos.org/21/74f36fcf7e2078b6bab492177d48da06';
  const APPROVED_BANNER_320_KEY='6dd3e1d884350123ac32714fb6432fef';
  const APPROVED_BANNER_320_SRC='https://biomanos.org/22/6dd3e1d884350123ac32714fb6432fef';
  const APPROVED_BANNER_160_KEY='b6897723752196577a3b12ae1fa0bb7e';
  const APPROVED_BANNER_160_SRC='https://biomanos.org/22/b6897723752196577a3b12ae1fa0bb7e';
  const APPROVED_BANNER_300_KEY='503779984753b653167ed59860f05642';
  const APPROVED_BANNER_300_SRC='https://biomanos.org/22/503779984753b653167ed59860f05642';
  const APPROVED_SOCIAL_BAR_SRC='';
  const APPROVED_POPUNDER_SRC='';
  const EXOCLICK_BANNER_ZONE_ID='6104372';
  const EXOCLICK_BANNER_SRC='https://a.magsrv.com/ad-provider.js';
  const loadExoClick=()=>{
    if(window.__noxvelloxExoClickPromise)return window.__noxvelloxExoClickPromise;
    const existing=document.getElementById('noxvellox-exoclick-provider');
    window.__noxvelloxExoClickPromise=new Promise((resolve,reject)=>{
      if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return;}
      const script=document.createElement('script');
      script.id='noxvellox-exoclick-provider';
      script.async=true;
      script.type='application/javascript';
      script.src=EXOCLICK_BANNER_SRC;
      script.addEventListener('load',resolve,{once:true});
      script.addEventListener('error',reject,{once:true});
      document.head.appendChild(script);
    });
    return window.__noxvelloxExoClickPromise;
  };
  const loadConsentUnit=(id,src,target=document.head)=>{if(!src||document.getElementById(id))return;const script=document.createElement('script');script.id=id;script.async=true;script.setAttribute('data-cfasync','false');script.src=src;(target||document.body||document.head).append(script)};
  const createInlineBannerSlot=size=>{
    const dimensions=size==='160'?{width:160,height:300}:size==='320'?{width:320,height:50}:size==='300'?{width:300,height:250}:null;
    if(!dimensions)return null;
    const slot=document.createElement('section');
    slot.className='ad-slot banner-ad-slot';
    slot.setAttribute('aria-label','Sponsored advertisement');
    slot.dataset.bannerAd=size;
    slot.dataset.adState='idle';
    slot.style.cssText='grid-column:1/-1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:'+Math.max(84,dimensions.height+34)+'px;padding:12px;margin:8px 0;border:1px solid #49303c;border-radius:12px;background:#121016';
    slot.innerHTML='<div class="ad-label" style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#ff9caf;font-weight:800">Advertisement</div><div data-banner-container style="width:min('+dimensions.width+'px,100%);min-height:'+dimensions.height+'px;display:flex;justify-content:center;overflow:hidden"></div><div data-banner-message class="ad-message" aria-live="polite"></div>';
    return slot;
  };
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
    if(depth===0){
      const jsonEndpoint=endpoint+(endpoint.includes('?')?'&':'?')+'format=json';
      const response=await fetch(jsonEndpoint,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
      if(response.ok){
        const ad=await response.json();
        if(ad?.mediaUrl)return ad;
        if(ad?.ok===false)throw new Error('VAST provider returned no fill');
      }
    }
    const parsed=parseVast(await vastText(endpoint));
    if(!parsed)throw new Error('No playable MediaFile in VAST response');
    if(parsed.mediaUrl)return parsed;
    return resolveVast(parsed.wrapper,depth+1);
  }
  const showOverlay=overlay=>{if(!overlay)return;overlay.hidden=false;overlay.style.display='grid';};
  const hideOverlay=overlay=>{if(!overlay)return;overlay.hidden=true;overlay.style.display='none';};
  function startMidRoll(player){
    if(player?.dataset.midrollEnabled!=='yes')return;
    if(!player||player.dataset.midrollScheduled==='yes'||consent()!=='granted')return;
    const frame=player.querySelector('[data-embed-url]');
    if(!frame)return;
    player.dataset.midrollScheduled='yes';
    const show=()=>{
      if(player.dataset.midrollShown==='yes')return;
      player.dataset.midrollShown='yes';
      const overlay=document.createElement('div');
      overlay.className='mid-roll-overlay';showOverlay(overlay);overlay.setAttribute('role','dialog');overlay.setAttribute('aria-label','Sponsored advertisement');
      overlay.style.cssText='position:absolute;inset:0;z-index:7;display:grid;place-items:center;background:#08070df2;padding:20px';
      overlay.innerHTML='<div class="mid-roll-card" style="width:min(430px,100%);padding:24px;border:1px solid #76505d;border-radius:16px;background:#19151e;text-align:center;box-shadow:0 20px 80px #000b"><div class="ad-label" style="color:#ff9caf;font-size:10px;letter-spacing:.15em;text-transform:uppercase;font-weight:900">Advertisement · Sponsored break</div><div data-mid-roll-container style="min-height:90px;margin:16px 0;border:1px dashed #5b4550;border-radius:10px;display:grid;place-items:center;color:#8d7f89;font-size:10px">Sponsored placement</div><p style="color:#c8bdc6;font-size:12px">Sponsored placement after 15 seconds in the player.</p><button class="button ghost" type="button" data-mid-roll-close>Continue to video</button></div>';
      player.append(overlay);
      const container=overlay.querySelector('[data-mid-roll-container]');
      if(container&&!container.dataset.loaded){container.dataset.loaded='yes';const script=document.createElement('script');script.async=true;script.dataset.cfasync='false';script.src=APPROVED_AD_SRC;container.before(script);}
      overlay.querySelector('[data-mid-roll-close]')?.addEventListener('click',()=>{hideOverlay(overlay);player.dataset.midrollClosed='yes'},{once:true});
      window.setTimeout(()=>{if(overlay.isConnected&&overlay.hidden===false&&container?.childElementCount===0){hideOverlay(overlay);player.dataset.midrollState='no-fill'}},8000);
      // Always release the sponsored break after 15 seconds. Ad networks may
      // inject an iframe or other child nodes without providing a close event.
      window.setTimeout(()=>{if(overlay.isConnected&&overlay.hidden===false){hideOverlay(overlay);player.dataset.midrollState='released'}},15000);
    };
    const arm=()=>{if(player.dataset.midrollTimer==='yes')return;player.dataset.midrollTimer='yes';window.setTimeout(show,15000)};
    if(frame.src)arm();else frame.addEventListener('load',arm,{once:true});
  }
  function startPreRoll(player){
    if(!player||player.dataset.prerollStarted==='yes')return;
    const frame=player.querySelector('[data-embed-url]'),overlay=player.querySelector('[data-pre-roll]');
    if(!frame||!overlay)return;
    if(consent()!=='granted'){loadFrame(frame);player.dataset.prerollFinished='yes';player.dataset.prerollState='consent-not-granted';return;}
    const endpoint=overlay.dataset.vastEndpoint||'';
    const container=overlay.querySelector('[data-preroll-container]');
    const status=overlay.querySelector('[data-pre-roll-status]');
    const finish=()=>{if(player.dataset.prerollFinished==='yes')return;player.dataset.prerollFinished='yes';loadFrame(frame);hideOverlay(overlay);player.dataset.prerollState='finished';startMidRoll(player)};
    if(!endpoint){
      // No authorized VAST tag is configured. Use the approved native placement
      // as a clearly labeled 15-second sponsored break instead of pretending it
      // is a video advertisement.
      player.dataset.prerollStarted='yes';
      player.dataset.prerollState='native-break';
      showOverlay(overlay);
      const source=container?.dataset.scriptSrc||'';
      if(container&&source===APPROVED_AD_SRC&&!container.dataset.loaded){
        container.dataset.loaded='yes';
        const script=document.createElement('script');script.async=true;script.dataset.cfasync='false';script.src=source;container.append(script);
      }
      if(status)status.textContent='Sponsored placement';
      const copy=overlay.querySelector('[data-pre-roll-copy]');
      if(copy)copy.textContent='The video starts after this 15-second sponsored message.';
      const button=overlay.querySelector('[data-pre-roll-continue]');
      let remaining=Math.max(5,Number(overlay.dataset.preRollSeconds)||15);
      const counter=overlay.querySelector('[data-pre-roll-countdown]');
      if(counter)counter.textContent=String(remaining);
      const finishNative=()=>{if(player.dataset.prerollFinished==='yes')return;player.dataset.prerollFinished='yes';loadFrame(frame);hideOverlay(overlay);player.dataset.prerollState='finished';clearInterval(timer);startMidRoll(player)};
      const timer=setInterval(()=>{remaining-=1;if(counter)counter.textContent=String(Math.max(remaining,0));if(remaining<=0)finishNative()},1000);
      button?.addEventListener('click',finishNative,{once:true});
      return;
    }
    player.dataset.prerollStarted='yes';
    showOverlay(overlay);
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
  const loadFrame=frame=>{
    if(!frame||frame.src)return;
    const raw=frame.dataset.embedUrl||'';
    try{const target=new URL(raw,location.href);if(!target.searchParams.has('autoplay'))target.searchParams.set('autoplay','1');frame.src=target.toString()}catch{frame.src=raw}
  };
  function releaseEmbeds(){
    document.querySelectorAll('[data-embed-url]').forEach(frame=>{
      const player=frame.closest('[data-player]');
      if(player?.querySelector('[data-click-play-overlay]')&&player.dataset.clickPlayReleased!=='yes')return;
      if(player?.querySelector('[data-pre-roll]')&&consent()==='granted'&&player.dataset.prerollFinished!=='yes'){startPreRoll(player);return;}
      loadFrame(frame);
      if(player?.querySelector('[data-pre-roll]')){player.dataset.prerollFinished='yes';player.dataset.prerollState='consent-not-granted';}
      if(frame.dataset.errorBound!=='yes'){
        frame.dataset.errorBound='yes';
        frame.addEventListener('error',()=>{
          player?.setAttribute('data-player-state','unavailable');
          const fallback=player?.querySelector('[data-player-fallback]');
          if(fallback)fallback.hidden=false;
        },{once:true});
      }
      startMidRoll(player);
    });
  }
  function setupClickToPlay(){
    document.querySelectorAll('[data-click-play-overlay]').forEach(overlay=>{
      const player=overlay.closest('[data-player]'),button=overlay.querySelector('[data-click-play]');
      if(!player||!button||overlay.dataset.clickPlayBound==='yes')return;
      overlay.dataset.clickPlayBound='yes';
      button.addEventListener('click',()=>{
        player.dataset.clickPlayReleased='yes';
        player.dataset.prerollFinished='yes';
        hideOverlay(overlay);
        releaseEmbeds();
      },{once:true});
    });
  }
  const releaseClickPlay=button=>{
    const overlay=button?.closest?.('[data-click-play-overlay]');
    const player=overlay?.closest?.('[data-player]');
    if(!overlay||!player)return;
    player.dataset.clickPlayReleased='yes';
    player.dataset.prerollFinished='yes';
    hideOverlay(overlay);
    releaseEmbeds();
  };
  const setupVastClickOverlay=()=>{
    document.querySelectorAll('[data-vast-play-overlay]').forEach(overlay=>{
      if(overlay.dataset.vastBound==='yes')return;
      const video=overlay.querySelector('[data-vast-video]');
      const status=overlay.querySelector('[data-vast-status]');
      const skip=overlay.querySelector('[data-vast-skip]');
      const mute=overlay.querySelector('[data-vast-mute]');
      const cta=overlay.querySelector('[data-vast-cta]');
      const domain=overlay.querySelector('[data-vast-domain]');
      const progress=overlay.querySelector('[data-vast-progress-bar]');
      const endpoint=overlay.dataset.vastEndpoint||'';
      const skipAfter=Math.max(3,Number(overlay.dataset.vastSkipSeconds||5));
      if(!video||!skip)return;
      overlay.dataset.vastBound='yes';
      let countdownTimer=0;
      const release=()=>{
        if(overlay.dataset.vastFinished==='yes')return;
        overlay.dataset.vastFinished='yes';
        if(countdownTimer)window.clearInterval(countdownTimer);
        video.pause();
        skip.disabled=true;
        skip.hidden=true;
        if(progress)progress.style.width='100%';
        releaseClickPlay(skip);
      };
      const tick=()=>{
        const elapsed=Math.max(0,Number(video.currentTime||0));
        const duration=Number(video.duration||0);
        if(progress&&duration>0)progress.style.width=Math.min(100,(elapsed/duration)*100)+'%';
        const remaining=Math.ceil(skipAfter-elapsed);
        if(remaining<=0){
          skip.disabled=false;
          skip.textContent='Skip ad';
          skip.style.cursor='pointer';
          skip.style.background='#050505e6';
        }else{
          skip.textContent='Skip in '+remaining;
        }
      };
      skip.addEventListener('click',event=>{
        event.preventDefault();
        if(!skip.disabled)release();
      });
      mute?.addEventListener('click',event=>{
        event.preventDefault();
        event.stopPropagation();
        video.muted=!video.muted;
        mute.textContent=video.muted?'🔇':'🔊';
        mute.setAttribute('aria-label',video.muted?'Unmute advertisement':'Mute advertisement');
      });
      video.addEventListener('timeupdate',tick);
      video.addEventListener('loadedmetadata',tick);
      video.addEventListener('ended',release,{once:true});
      video.addEventListener('error',release,{once:true});
      if(!endpoint){release();return}
      resolveVast(endpoint).then(ad=>{
        if(!ad?.mediaUrl)throw new Error('No playable VAST media');
        video.src=ad.mediaUrl;
        video.muted=true;
        video.playsInline=true;
        video.autoplay=true;
        if(ad.clickUrl){
          cta.href=ad.clickUrl;
          cta.hidden=false;
          try{if(domain)domain.textContent=new URL(ad.clickUrl).hostname.replace(/^www\./,'')}catch{}
        }
        tick();
        countdownTimer=window.setInterval(tick,250);
        video.play().catch(()=>{
          skip.disabled=false;
          skip.textContent='Play ad';
          skip.style.cursor='pointer';
          if(status)status.textContent='Sponsored video';
        });
        if(status)status.textContent='Sponsored video';
      }).catch(()=>{
        release();
      });
    });
  };
  // Delegate the action as a safety net for cached/late-rendered player markup.
  // This keeps the first click deterministic even when the ad network mutates the slot.
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('[data-click-play]');
    if(!button)return;
    event.preventDefault();
    event.stopPropagation();
    releaseClickPlay(button);
  },true);
  setupClickToPlay();
  setupVastClickOverlay();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{setupClickToPlay();setupVastClickOverlay()},{once:true});
  const setupCoverImages=(root=document)=>root.querySelectorAll('[data-cover-image]').forEach(media=>{
    if(media.dataset.coverImageReady==='yes')return;
    media.dataset.coverImageReady='yes';
    const wrap=media.closest('.video-art,.home-video-art,.player');
    const isVideo=media.tagName==='VIDEO';
    const loaded=()=>{const ready=isVideo?media.readyState>=2:media.naturalWidth>0;if(ready){wrap?.classList.add('cover-loaded');wrap?.querySelector('.cover-art-safe')?.remove()}};
    media.addEventListener(isVideo?'loadeddata':'load',loaded,{once:true});
    media.addEventListener('error',()=>{media.remove();wrap?.classList.remove('cover-loaded')},{once:true});
    if(isVideo){media.muted=true;media.play().catch(()=>{});if(media.readyState>=2)loaded()}
    else if(media.complete){if(media.naturalWidth>0)loaded();else media.remove()}
  });
  setupCoverImages();
  const BANNER_IMAGE_FALLBACK='/assets/banner-fallback.svg';
  document.querySelectorAll('[data-category-image]').forEach(img=>{
    const fail=()=>{
      if(img.dataset.bannerFallback==='yes'){img.dataset.imageError='yes';return}
      img.dataset.bannerFallback='yes';
      img.removeAttribute('data-image-error');
      img.removeAttribute('srcset');
      const originalAlt=img.alt||'Noxvellox collection';
      img.alt=originalAlt+' (branded fallback)';
      img.src=BANNER_IMAGE_FALLBACK;
      img.addEventListener('error',()=>{img.dataset.imageError='yes'},{once:true});
    };
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
    try{sessionStorage.setItem('noxvellox-age-confirmed','yes')}catch{}
    modal?.remove();
    releaseEmbeds();
    renderAd();
    showCookieBanner();
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
  const EXOCLICK_VIDEO_SLIDER_ZONE_ID='6104386';
  const EXOCLICK_VIDEO_SLIDER_SRC='https://a.magsrv.com/ad-provider.js';
  const loadVideoSlider=()=>{
    if(!location.pathname.startsWith('/official-watch/'))return;
    if(!ageAccepted()||consent()!=='granted')return;
    const slot=document.querySelector('[data-exoclick-video-slider]'),zone=slot?.dataset.zoneid||'',src=slot?.dataset.src||'';
    if(!slot||zone!==EXOCLICK_VIDEO_SLIDER_ZONE_ID||src!==EXOCLICK_VIDEO_SLIDER_SRC||slot.dataset.loaded==='yes'||slot.dataset.loaded==='loading')return;
    slot.dataset.loaded='loading';
    const activate=()=>{
      window.AdProvider=window.AdProvider||[];
      window.AdProvider.push({serve:{}});
      slot.dataset.loaded='yes';
    };
    if(window.AdProvider){activate();return}
    loadExoClick().then(activate).catch(()=>{slot.dataset.loaded='error'});
  };
  const renderAd=()=>{
    const c=consent();
    if(!ageAccepted())return;
    if(c==='granted'){
      loadConsentUnit('noxvellox-social-bar',APPROVED_SOCIAL_BAR_SRC,document.body);
      let popunderLoaded=false;try{popunderLoaded=sessionStorage.getItem('noxvellox-popunder-loaded')==='yes'}catch{}
      if(!popunderLoaded){loadConsentUnit('noxvellox-popunder',APPROVED_POPUNDER_SRC);try{sessionStorage.setItem('noxvellox-popunder-loaded','yes')}catch{}}
    }
    if(!slots.length){releaseEmbeds();return;}
    slots.forEach(slot=>{
      const message=slot.querySelector('[data-ad-message]');

      const container=slot.querySelector('[data-ad-container]');
      if(c==='denied'){setAdState(slot,'disabled');if(message)message.textContent='Optional ads are disabled.';return;}
      if(c==='granted'){
}
      if(c!=='granted'||slot.dataset.loaded==='yes')return;
      const scriptUrl=slot.dataset.scriptSrc;
      if(scriptUrl!==APPROVED_AD_SRC){setAdState(slot,'blocked-url');return;}
      slot.dataset.loaded='yes';
      setAdState(slot,'loading');
      if(message)message.textContent='';
      if(container)container.id='container-'+APPROVED_AD_SRC.split('/').pop();
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

    const bannerSlots=[...document.querySelectorAll('[data-banner-ad]')];
    const bannerConfigs={
      '320':{key:APPROVED_BANNER_320_KEY,src:APPROVED_BANNER_320_SRC,width:320,height:50},
      '160':{key:APPROVED_BANNER_160_KEY,src:APPROVED_BANNER_160_SRC,width:160,height:300},
      '300':{key:APPROVED_BANNER_300_KEY,src:APPROVED_BANNER_300_SRC,width:300,height:250}
    };
    bannerSlots.forEach(slot=>{
      const message=slot.querySelector('[data-banner-message]');

      if(c==='denied'){
        slot.dataset.adState='disabled';
        if(message)message.textContent='Optional ads are disabled.';
        return;
      }
      if(c!=='granted'||slot.dataset.loaded==='yes')return;
      const config=bannerConfigs[slot.dataset.bannerAd];
      if(!config){slot.dataset.adState='blocked-format';return}
      slot.dataset.loaded='yes';
      slot.dataset.adState='loading';
      if(message)message.textContent='';
      const adOptions={key:config.key,format:'iframe',height:config.height,width:config.width,params:{}};
      window.atOptions=adOptions;
      const options=document.createElement('script');
      options.textContent='window.atOptions='+JSON.stringify(adOptions)+';';
      const script=document.createElement('script');
      script.async=false;
      script.setAttribute('data-cfasync','false');
      script.src=config.src;
      script.addEventListener('load',()=>{
        slot.dataset.adState='loaded';
        window.setTimeout(()=>{if(!slot.querySelector('iframe'))slot.dataset.adState='loaded-no-render'},8000);
      },{once:true});
      script.addEventListener('error',()=>{
        slot.dataset.adState='error';
        if(message)message.textContent='Advertisement is temporarily unavailable.';
      },{once:true});
      const container=slot.querySelector('[data-banner-container]')||slot;
      container.before(options,script);
    });
    const exoSlots=[...document.querySelectorAll('[data-exoclick-banner]')];
    exoSlots.forEach(slot=>{
      if(c==='denied'){slot.hidden=true;slot.dataset.adState='disabled';return;}
      if(c!=='granted'||slot.dataset.loaded==='yes')return;
      slot.hidden=false;
      slot.dataset.loaded='yes';
      slot.dataset.adState='loading';
      loadExoClick().then(()=>{
        window.AdProvider=window.AdProvider||[];
        window.AdProvider.push({serve:{}});
        slot.dataset.adState='loaded';
      }).catch(()=>{slot.dataset.adState='error';});
    });
    loadVideoSlider();
    if(c==='granted')fetch('/api/ad-health',{credentials:'same-origin',cache:'no-store'}).then(r=>r.json()).then(data=>{adHealth.server=data;adHealth.lastChecked=new Date().toISOString()}).catch(()=>{adHealth.server={ok:false,note:'Banner health endpoint unavailable'}});
    releaseEmbeds();
  };
  document.addEventListener('click',(event)=>{
    if(event.target.closest('[data-ad-preferences],[data-cookie-preferences],[data-analytics-preferences]'))showCookieBanner(true);
  });
  const showCookieBanner=(customize=false)=>{
    if(!ageAccepted())return;
    if(consent()!=='unset'&&analyticsConsent()!=='unset'&&!customize)return;
    if(cookieBanner?.isConnected){if(customize)cookieBanner.querySelector('[data-cookie-customize]')?.removeAttribute('hidden');return}
    cookieBanner=document.createElement('div');
    cookieBanner.dataset.cookieConsentBanner='true';
    cookieBanner.setAttribute('role','dialog');
    cookieBanner.setAttribute('aria-modal','true');
    cookieBanner.setAttribute('aria-labelledby','cookie-heading');
    cookieBanner.style.cssText='position:fixed;inset:0;z-index:12000;display:grid;align-items:end;justify-items:center;padding:12px;background:#0008;font:14px/1.5 Arial,sans-serif;color:#fff';
    cookieBanner.innerHTML='<section style="width:min(760px,100%);padding:20px 22px;background:#414141;border:1px solid #666;border-radius:10px;box-shadow:0 8px 32px #000a"><h2 id="cookie-heading" style="margin:0 0 8px;font-size:16px">Cookie preferences</h2><p style="margin:0 0 14px;color:#f1f1f1">We use essential storage to operate this site. With your permission, optional Adsterra ads and Google Analytics may use cookies or similar technologies. You can change your choices later in Cookie preferences. <a href="/privacy" style="color:#9ccfff">Privacy policy</a></p><div data-cookie-actions style="display:flex;justify-content:center;flex-wrap:wrap;gap:10px"><button type="button" data-cookie-accept-all style="padding:12px 18px;border:0;border-radius:5px;background:#249bd8;color:#fff;font-weight:800;cursor:pointer">Accept All Cookies</button><button type="button" data-cookie-essential style="padding:12px 18px;border:1px solid #249bd8;border-radius:5px;background:transparent;color:#fff;font-weight:800;cursor:pointer">Accept Only Essential Cookies</button><button type="button" data-cookie-customize-open style="padding:12px 18px;border:1px solid #777;border-radius:5px;background:transparent;color:#fff;font-weight:800;cursor:pointer">Customize Cookies</button></div><div data-cookie-customize hidden style="margin-top:16px;padding-top:14px;border-top:1px solid #666"><label style="display:flex;gap:10px;align-items:flex-start;margin:10px 0"><input type="checkbox" checked disabled><span><strong>Essential storage</strong><br><small>Required for age confirmation, security and saving your preferences.</small></span></label><label style="display:flex;gap:10px;align-items:flex-start;margin:10px 0"><input type="checkbox" data-cookie-ads><span><strong>Advertising</strong><br><small>Loads Adsterra formats, including banners, Social Bar and Popunder.</small></span></label><label style="display:flex;gap:10px;align-items:flex-start;margin:10px 0"><input type="checkbox" data-cookie-analytics><span><strong>Analytics</strong><br><small>Loads Google Analytics to measure site visits.</small></span></label><div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:14px"><button type="button" data-cookie-save style="padding:11px 18px;border:0;border-radius:5px;background:#249bd8;color:#fff;font-weight:800;cursor:pointer">Save my choices</button><button type="button" data-cookie-back style="padding:11px 18px;border:1px solid #777;border-radius:5px;background:transparent;color:#fff;font-weight:800;cursor:pointer">Back</button></div></div></section>';
    const adsBox=cookieBanner.querySelector('[data-cookie-ads]');
    const analyticsBox=cookieBanner.querySelector('[data-cookie-analytics]');
    if(adsBox)adsBox.checked=consent()==='granted';
    if(analyticsBox)analyticsBox.checked=analyticsConsent()==='granted';
    cookieBanner.querySelector('[data-cookie-accept-all]')?.addEventListener('click',()=>saveCookieChoices(true,true));
    cookieBanner.querySelector('[data-cookie-essential]')?.addEventListener('click',()=>saveCookieChoices(false,false));
    cookieBanner.querySelector('[data-cookie-customize-open]')?.addEventListener('click',()=>{
      cookieBanner.querySelector('[data-cookie-customize]')?.removeAttribute('hidden');
      cookieBanner.querySelector('[data-cookie-customize-open]')?.setAttribute('hidden','hidden');
    });
    cookieBanner.querySelector('[data-cookie-save]')?.addEventListener('click',()=>saveCookieChoices(adsBox?.checked===true,analyticsBox?.checked===true));
    cookieBanner.querySelector('[data-cookie-back]')?.addEventListener('click',()=>{
      cookieBanner.querySelector('[data-cookie-customize]')?.setAttribute('hidden','hidden');
      cookieBanner.querySelector('[data-cookie-customize-open]')?.removeAttribute('hidden');
    });
    document.body.appendChild(cookieBanner);
    if(customize)cookieBanner.querySelector('[data-cookie-customize-open]')?.click();
    cookieBanner.querySelector('[data-cookie-accept-all]')?.focus();
  };
  renderAd();
  if(analyticsConsent()==='granted')loadAnalytics();
  showCookieBanner();
  document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{const active=document.querySelector('[data-filter].active');active?.classList.remove('active');button.classList.add('active')}));

  // Installable app shell and lightweight on-device engagement features.
  // Only internal URLs and titles are stored; no media or third-party data is copied.
  const storageRead=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');return Array.isArray(value)?value:fallback}catch{return fallback}};
  const storageWrite=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
  const historyKey='noxvellox-watch-history',listKey='noxvellox-my-list',autoplayKey='noxvellox-continuous-playback',relatedKey='noxvellox-related-recommendations';
  const normalizeInternalHref=raw=>{try{const target=new URL(raw,location.origin);if(target.origin!==location.origin)return '';target.searchParams.delete('verify');return `${target.pathname}${target.search}`}catch{return ''}};
  const readHistory=()=>{const seen=new Set();return storageRead(historyKey,[]).map(item=>({...item,href:normalizeInternalHref(item.href)})).filter(item=>{if(!item.href||seen.has(item.href))return false;seen.add(item.href);return true})};
  const readList=()=>storageRead(listKey,[]);
  const videoMeta=card=>{const href=normalizeInternalHref(card.getAttribute('href')||'');const title=(card.querySelector('h3')?.textContent||'').trim();return href&&title?{href,title,updatedAt:Date.now()}:null};
  const rememberVideo=meta=>{if(!meta)return;const next=[meta,...readHistory().filter(item=>item.href!==meta.href)].slice(0,20);storageWrite(historyKey,next)};
  const toggleSaved=meta=>{const current=readList();const exists=current.some(item=>item.href===meta.href);storageWrite(listKey,exists?current.filter(item=>item.href!==meta.href):[meta,...current].slice(0,50));return !exists};
  const isSaved=href=>readList().some(item=>item.href===href);
  const makePersonalCard=item=>{const link=document.createElement('a');link.className='personal-card';link.href=item.href;const label=document.createElement('span');label.className='personal-card-kicker';label.textContent='Noxvellox';const title=document.createElement('strong');title.textContent=item.title;const action=document.createElement('span');action.className='personal-card-action';action.textContent='Open video';link.append(label,title,action);link.addEventListener('click',()=>rememberVideo(item));return link};
  const makeRail=(title,items,kicker)=>{if(!items.length)return null;const section=document.createElement('section');section.className='personal-rail wrap';const head=document.createElement('div');head.className='personal-rail-head';const copy=document.createElement('div');const eyebrow=document.createElement('div');eyebrow.className='section-kicker';eyebrow.textContent=kicker;const heading=document.createElement('h2');heading.textContent=title;copy.append(eyebrow,heading);head.append(copy);const grid=document.createElement('div');grid.className='personal-grid';items.slice(0,8).forEach(item=>grid.append(makePersonalCard(item)));section.append(head,grid);return section};
  const renderPersonalRails=()=>{
  const main=document.querySelector('main');
  if(!main)return;
  main.querySelectorAll('[data-personal-rail]').forEach(item=>item.remove());
  if(location.pathname==='/history'){
    const root=document.querySelector('[data-history-root]');
    if(!root)return;
    const history=readHistory();
    if(!history.length){root.innerHTML='<div class="empty"><strong>No videos in your history yet</strong><p>Open a video and it will be saved here on this browser.</p></div>';return}
    const historyRail=makeRail('Continue watching',history,'Watch history');
    if(historyRail){historyRail.dataset.personalRail='yes';root.append(historyRail)}
    return;
  }
  const savedRail=makeRail('My list',readList(),'Saved videos');
  if(savedRail){savedRail.dataset.personalRail='yes';main.append(savedRail)}
};
  const paintSaveButton=(button,meta)=>{const active=isSaved(meta.href);button.textContent=active?'✓':'☆';button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',active?'Remove from my list':'Save to my list')};
  const setupVideoCards=()=>{document.querySelectorAll('a.video-card,a.home-video-card').forEach(card=>{if(card.dataset.engagementReady==='yes')return;const meta=videoMeta(card);if(!meta)return;card.dataset.engagementReady='yes';card.addEventListener('click',()=>rememberVideo(meta));const art=card.querySelector('.video-art,.home-video-art');if(!art)return;const button=document.createElement('button');button.type='button';button.className='video-save';button.dataset.saveVideo='yes';paintSaveButton(button,meta);button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();toggleSaved(meta);paintSaveButton(button,meta);renderPersonalRails()});art.append(button)})};
  const setupWatchHistory=()=>{if(/^\/(?:watch|official-watch)\//.test(location.pathname)){const title=(document.querySelector('.watch-head h1,h1')?.textContent||'').trim();const href=normalizeInternalHref(location.pathname+location.search);if(title&&href)rememberVideo({href,title,updatedAt:Date.now()})}};
  const setupRelatedVideos=()=>{
    const grid=document.querySelector('[data-related-grid]');
    if(!grid)return;
    const candidates=[],seen=new Set();
    const current=normalizeInternalHref(location.pathname+location.search);
    for(const item of grid.querySelectorAll('[data-related-candidate]')){
      const link=item.querySelector('a.video-card');
      const href=normalizeInternalHref(link?.getAttribute('href')||'');
      if(!href||href===current||seen.has(href))continue;
      seen.add(href);candidates.push({item,href});
    }
    if(!candidates.length)return;
    const previous=storageRead(relatedKey,[]).map(normalizeInternalHref).filter(Boolean);
    const recent=new Set(previous);
    const shuffle=items=>{const copy=[...items];for(let index=copy.length-1;index>0;index--){const swap=Math.floor(Math.random()*(index+1));[copy[index],copy[swap]]=[copy[swap],copy[index]]}return copy};
    const fresh=shuffle(candidates.filter(item=>!recent.has(item.href)));
    const selected=fresh.slice(0,4),selectedHrefs=new Set(selected.map(item=>item.href));
    if(selected.length<Math.min(4,candidates.length)){
      for(const item of shuffle(candidates.filter(candidate=>!selectedHrefs.has(candidate.href)))){
        if(selected.length>=Math.min(4,candidates.length))break;
        selected.push(item);selectedHrefs.add(item.href);
      }
    }
    candidates.forEach(item=>{item.item.hidden=!selectedHrefs.has(item.href)});
    storageWrite(relatedKey,[...selected.map(item=>item.href),...previous.filter(href=>!selectedHrefs.has(href))].slice(0,30));
  };
    const setupContinuousPlayback=()=>{const player=document.querySelector('[data-player]');if(!player)return;const related=[...document.querySelectorAll('aside [data-related-candidate]:not([hidden]) a.video-card')].map(link=>normalizeInternalHref(link.getAttribute('href')||'')).filter(Boolean);if(!related.length)return;const wrap=document.createElement('label');wrap.className='continuous-toggle';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=localStorage.getItem(autoplayKey)==='yes';const text=document.createElement('span');text.textContent='Optional continuous playback';wrap.append(checkbox,text);player.parentElement?.insertBefore(wrap,player.nextSibling);checkbox.addEventListener('change',()=>{try{localStorage.setItem(autoplayKey,checkbox.checked?'yes':'no')}catch{}});let nextIndex=0;const goNext=()=>{if(checkbox.checked&&related[nextIndex])location.href=related[nextIndex]};player.querySelectorAll('video').forEach(video=>video.addEventListener('ended',goNext));window.addEventListener('message',event=>{if(!checkbox.checked||event.source!==player.querySelector('iframe')||!event.data)return;const data=typeof event.data==='string'?event.data:event.data.event||event.data.type;if(String(data).toLowerCase().includes('ended'))goNext()})};
  const setupInfiniteVideos=()=>{
    const grid=document.querySelector('[data-infinite-grid]'),pager=document.querySelector('nav[aria-label="Catalog pages"]');
    const homeSource=grid?.dataset.infiniteSource||'';
    if(!grid||(!pager&&!homeSource)||!('IntersectionObserver' in window))return;
    let nextUrl=pager?.querySelector('a[rel="next"]')?.href||homeSource;
    if(!nextUrl)return;
    const status=document.createElement('p');
    status.className='mini infinite-scroll-status';
    status.setAttribute('role','status');
    status.textContent='More videos will load as you scroll.';
    (pager||grid).after(status);
    let loading=false,finished=false;
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))loadNext()},{rootMargin:'700px 0px'});
    observer.observe(status);
    const loadNext=async()=>{
      if(loading||finished)return;
      if(!nextUrl){finished=true;observer.disconnect();status.remove();return}
      loading=true;status.textContent='Loading more videos...';
      try{
        const response=await fetch(nextUrl,{credentials:'same-origin',headers:{accept:'text/html'}});
        if(!response.ok)throw Error('Page request failed');
        const doc=new DOMParser().parseFromString(await response.text(),'text/html');
        const nextGrid=doc.querySelector('[data-infinite-grid]');
        if(!nextGrid)throw Error('Video list not found');
        const seen=new Set([...grid.querySelectorAll('a.video-card,a.home-video-card')].map(card=>new URL(card.getAttribute('href')||'',location.href).pathname));
        const fragment=document.createDocumentFragment();
        let feedCount=grid.querySelectorAll('a.video-card,a.home-video-card').length;
        let banner320Inserted=Boolean(grid.querySelector('[data-banner-ad="320"]'));
        let banner160Inserted=Boolean(grid.querySelector('[data-banner-ad="160"]'));
        let banner300Inserted=Boolean(grid.querySelector('[data-banner-ad="300"]'));
        for(const card of nextGrid.querySelectorAll('a.video-card')){
          const href=card.getAttribute('href');
          const path=href?new URL(href,location.href).pathname:'';
          if(!path||seen.has(path))continue;
          seen.add(path);
          const clone=document.importNode(card,true);
          if(grid.classList.contains('home-video-grid')){
            clone.className='home-video-card';
            const art=clone.querySelector('.video-art');
            if(art){art.classList.remove('video-art');art.classList.add('home-video-art')}
            clone.querySelector('.play')?.remove();
            const meta=clone.querySelector('.video-meta');
            if(meta){meta.classList.remove('video-meta');meta.classList.add('home-video-meta')}
            const source=clone.querySelector('.sub');
            if(source){source.classList.remove('sub');source.classList.add('home-video-source')}
          }
          fragment.append(clone);
          feedCount++;
          if(!banner320Inserted&&feedCount>=24){
            fragment.append(createInlineBannerSlot('320'));
            banner320Inserted=true;
          }
          if(!banner160Inserted&&feedCount>=48){
            fragment.append(createInlineBannerSlot('160'));
            banner160Inserted=true;
          }
          if(!banner300Inserted&&feedCount>=72){
            fragment.append(createInlineBannerSlot('300'));
            banner300Inserted=true;
          }
        }
        grid.append(fragment);
        if(banner320Inserted||banner160Inserted||banner300Inserted)renderAd();
        setupCoverImages(grid);setupVideoCards();
        const nextPager=doc.querySelector('nav[aria-label="Catalog pages"]');
        const nextPageLink=nextPager?.querySelector('a[rel="next"]');
        const currentNext=pager?.querySelector('a[rel="next"]');
        const currentPageLabel=pager?.querySelector('span'),nextPageLabel=nextPager?.querySelector('span');
        if(currentPageLabel&&nextPageLabel)currentPageLabel.textContent=nextPageLabel.textContent;
        if(pager){
          if(nextPageLink&&currentNext)currentNext.href=nextPageLink.href;
          else{
            currentNext?.remove();finished=true;observer.disconnect();
            status.textContent='You have reached the end of the videos.';
          }
        }else if(nextPageLink)nextUrl=nextPageLink.href;
        else{
          nextUrl='';finished=true;observer.disconnect();
          status.textContent='You have reached the end of the videos.';
        }
        if(!finished)status.textContent='Scroll to keep loading videos.';
      }catch{
        finished=true;observer.disconnect();
        status.textContent=pager?'Automatic loading failed. Use the Next page link above.':'Automatic loading failed. Use View all to continue.';
      }finally{loading=false}
    };
  };
  const setupPwa=()=>{const manifest=document.createElement('link');manifest.rel='manifest';manifest.href='/manifest.webmanifest';document.head.append(manifest);if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{});const head=document.querySelector('.head-inner');if(!head)return;const button=document.createElement('button');button.type='button';button.className='install-app';button.hidden=true;button.textContent='Instalar app';button.setAttribute('aria-label','Instalar Noxvellox como aplicativo');const age=head.querySelector('.age-pill');head.insertBefore(button,age||null);let deferred=null;window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferred=event;button.hidden=false});button.addEventListener('click',async()=>{if(!deferred)return;deferred.prompt();await deferred.userChoice;deferred=null;button.hidden=true});window.addEventListener('appinstalled',()=>{button.hidden=true})};
  const refreshStyle=()=>{const link=document.querySelector('link[href*="style.v027.css"]');if(link)link.href='/assets/style.v027.css?ver=0.4.7'};
  refreshStyle();setupPwa();setupVideoCards();setupInfiniteVideos();setupWatchHistory();setupRelatedVideos();setupContinuousPlayback();renderPersonalRails();
})();
