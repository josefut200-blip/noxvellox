/* Noxvellox frontend: navigation, search and age acknowledgement. */
(function(){
  const menu=document.querySelector('[data-menu]'), nav=document.querySelector('[data-nav]');
  menu?.addEventListener('click',()=>{const open=nav?.classList.toggle('is-open');menu.setAttribute('aria-expanded',String(!!open))});
  const form=document.querySelector('[data-search-form]');
  form?.addEventListener('submit',e=>{const value=form.querySelector('input[name=q]')?.value.trim();if(!value){e.preventDefault();form.querySelector('input')?.focus()}});
  const modal=document.querySelector('[data-age-gate]');
  try{if(sessionStorage.getItem('noxvellox-age-confirmed')==='yes')modal?.remove()}catch{}
  const CONSENT_KEY='noxvellox-optional-ads';
  const consent=()=>{try{return localStorage.getItem(CONSENT_KEY)||'unset'}catch{return 'unset'}};
  const setConsent=value=>{try{localStorage.setItem(CONSENT_KEY,value)}catch{}};
  // One entry screen, two independent choices. Optional advertising is off by default.
  const confirmAge=()=>{
    const optedIn=document.querySelector('[data-age-ads-opt-in]')?.checked===true;
    setConsent(optedIn?'granted':'denied');
    try{sessionStorage.setItem('noxvellox-age-confirmed','yes')}catch{}
    modal?.remove();
    document.querySelectorAll('[data-embed-url]').forEach(x=>{if(!x.src)x.src=x.dataset.embedUrl});
    renderAd();
  };
  document.querySelector('[data-age-confirm]')?.addEventListener('click',confirmAge);
  // Keep external playback disabled until age acknowledgement; search metadata remains server-rendered.
  if(!modal || !modal.isConnected){document.querySelectorAll('[data-embed-url]').forEach(x=>{if(!x.src)x.src=x.dataset.embedUrl;})}
  // Consent-first Adsterra Native Banner integration. Never load external ad script
  // while the adult acknowledgement is visible or without an affirmative opt-in.
  const ageAccepted=()=>!document.querySelector('[data-age-gate]')?.isConnected;
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
