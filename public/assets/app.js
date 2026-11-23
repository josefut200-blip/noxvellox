/* Noxvellox frontend: navigation, search, age acknowledgement and privacy choices. */
(function(){
  const menu=document.querySelector('[data-menu]'), nav=document.querySelector('[data-nav]');
  menu?.addEventListener('click',()=>{const open=nav?.classList.toggle('is-open');menu.setAttribute('aria-expanded',String(!!open))});
  const form=document.querySelector('[data-search-form]');
  form?.addEventListener('submit',e=>{const value=form.querySelector('input[name=q]')?.value.trim();if(!value){e.preventDefault();form.querySelector('input')?.focus()}});
  const modal=document.querySelector('[data-age-gate]');
  try{if(sessionStorage.getItem('noxvellox-age-confirmed')==='yes')modal?.remove()}catch{}
  const CONSENT_KEY='noxvellox-optional-ads';
  const ANALYTICS_CONSENT_KEY='noxvellox-google-analytics';
  const GA_ID='G-SZY1W9EZ3G';
  const consent=()=>{try{return localStorage.getItem(CONSENT_KEY)||'unset'}catch{return 'unset'}};
  const analyticsConsent=()=>{try{return localStorage.getItem(ANALYTICS_CONSENT_KEY)||'unset'}catch{return 'unset'}};
  const setConsent=value=>{try{localStorage.setItem(CONSENT_KEY,value)}catch{}};
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
  const ageAccepted=()=>!document.querySelector('[data-age-gate]')?.isConnected;
  // Ask for separate, optional analytics consent on the existing age-entry screen.
  const ageChoices=document.querySelector('.age-ad-option');
  if(ageChoices&&!ageChoices.querySelector('[data-age-analytics-opt-in]')){
    const label=document.createElement('label');
    label.className='age-ad-choice';
    label.style.marginTop='12px';
    label.innerHTML='<input type="checkbox" data-age-analytics-opt-in><span><strong>Allow Google Analytics measurement</strong><small>Helps us understand site visits. Google Analytics loads only if you opt in.</small></span>';
    ageChoices.insertBefore(label,ageChoices.querySelector('a'));
    label.querySelector('input').checked=analyticsConsent()==='granted';
  }
  // The legacy age confirmation remains valid; visitors can make an independent analytics choice.
  const confirmAge=()=>{
    const optedIn=document.querySelector('[data-age-ads-opt-in]')?.checked===true;
    const analyticsOptedIn=document.querySelector('[data-age-analytics-opt-in]')?.checked===true;
    setConsent(optedIn?'granted':'denied');
    setAnalyticsConsent(analyticsOptedIn?'granted':'denied');
    try{sessionStorage.setItem('noxvellox-age-confirmed','yes')}catch{}
    modal?.remove();
    document.querySelectorAll('[data-embed-url]').forEach(x=>{if(!x.src)x.src=x.dataset.embedUrl});
    renderAd();
    loadAnalytics();
    removeAnalyticsBanner();
  };
  document.querySelector('[data-age-confirm]')?.addEventListener('click',confirmAge);
  // Keep external playback disabled until age acknowledgement; search metadata remains server-rendered.
  if(!modal || !modal.isConnected){document.querySelectorAll('[data-embed-url]').forEach(x=>{if(!x.src)x.src=x.dataset.embedUrl;})}
  // Consent-first Adsterra Native Banner integration. Never load the external ad script
  // while the adult acknowledgement is visible or without an affirmative opt-in.
  const slot=document.querySelector('[data-native-ad]');
  if(ageAccepted()&&consent()==='unset')setConsent('denied');
  const renderAd=()=>{
    if(!slot)return;
    const c=consent();
    const message=slot.querySelector('[data-ad-message]');
    if(!ageAccepted())return;
    if(c==='denied'){
      if(message)message.textContent='Optional ads are disabled. You can change this in Ad preferences.';
      return;
    }
    if(c!=='granted')return;
    if(slot.dataset.loaded==='yes')return;
    const scriptUrl=slot.dataset.scriptSrc;
    if(scriptUrl!=='https://biomanos.org/21/59eef26524f2edf0d1c3c669286c974c')return;
    slot.dataset.loaded='yes';
    if(message)message.textContent='';
    const s=document.createElement('script');
    s.async=true;
    s.setAttribute('data-cfasync','false');
    s.src=scriptUrl;
    s.addEventListener('error',()=>{if(message)message.textContent='Advertisement is temporarily unavailable.'});
    slot.querySelector('[data-ad-container]')?.before(s);
  };
  let analyticsBanner;
  const removeAnalyticsBanner=()=>{analyticsBanner?.remove();analyticsBanner=null};
  const setAnalyticsChoice=allow=>{
    setAnalyticsConsent(allow?'granted':'denied');
    removeAnalyticsBanner();
    if(allow)loadAnalytics();else location.reload();
  };
  const showAnalyticsBanner=()=>{
    if(!ageAccepted()||analyticsConsent()!=='unset'||document.querySelector('[data-analytics-consent-banner]'))return;
    analyticsBanner=document.createElement('section');
    analyticsBanner.dataset.analyticsConsentBanner='true';
    analyticsBanner.setAttribute('role','region');
    analyticsBanner.setAttribute('aria-label','Cookie and analytics preferences');
    analyticsBanner.style.cssText='position:fixed;z-index:10000;left:16px;right:16px;bottom:16px;max-width:760px;margin:0 auto;padding:16px;background:#17171f;color:#fff;border:1px solid #454552;border-radius:12px;box-shadow:0 8px 32px #0009;font:14px/1.5 Arial,sans-serif;display:flex;flex-wrap:wrap;align-items:center;gap:12px';
    const text=document.createElement('span');
    text.style.flex='1 1 330px';
    text.textContent='Optional Google Analytics helps measure site visits. It stays off unless you allow it. Read the privacy policy for details.';
    const accept=document.createElement('button');
    accept.type='button';accept.textContent='Allow analytics';
    accept.style.cssText='padding:10px 14px;border:0;border-radius:8px;background:#e82f72;color:#fff;font-weight:700;cursor:pointer';
    accept.addEventListener('click',()=>setAnalyticsChoice(true));
    const reject=document.createElement('button');
    reject.type='button';reject.textContent='Reject';
    reject.style.cssText='padding:10px 14px;border:1px solid #777;border-radius:8px;background:transparent;color:#fff;cursor:pointer';
    reject.addEventListener('click',()=>setAnalyticsChoice(false));
    analyticsBanner.append(text,accept,reject);
    document.body.appendChild(analyticsBanner);
  };
  document.addEventListener('click',(event)=>{
    if(event.target.closest('[data-ad-preferences]')){
      const ok=window.confirm('Allow optional Adsterra advertising to load on Noxvellox? Select Cancel to keep ads disabled.');
      setConsent(ok?'granted':'denied');
      if(ok){renderAd()}else{location.reload()}
    }
    if(event.target.closest('[data-analytics-preferences]')){
      const ok=window.confirm('Allow Google Analytics measurement on Noxvellox? Select Cancel to keep analytics disabled.');
      setAnalyticsChoice(ok);
    }
  });
  // Offer a persistent way to change the choice after dismissing the banner.
  const footerLinks=document.querySelector('.footer-links');
  if(footerLinks&&!footerLinks.querySelector('[data-analytics-preferences]')){
    const link=document.createElement('a');
    link.href='#analytics-preferences';
    link.dataset.analyticsPreferences='true';
    link.textContent='Analytics preferences';
    footerLinks.appendChild(link);
  }
  renderAd();
  if(analyticsConsent()==='granted')loadAnalytics();else showAnalyticsBanner();
  document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{const active=document.querySelector('[data-filter].active');active?.classList.remove('active');button.classList.add('active')}));
})();
