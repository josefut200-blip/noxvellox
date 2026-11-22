(function(){
 const $=id=>document.getElementById(id);const msg=$('message');const message=(t,err=false)=>{if(!msg)return;msg.textContent=t;msg.className=err?'message error':'message'};
 $('login-form')?.addEventListener('submit',async(e)=>{e.preventDefault();const form=new FormData(e.currentTarget);try{const r=await fetch('/api/admin/login',{method:'POST',body:form,credentials:'same-origin'});if(!r.ok)throw new Error((await r.json()).error||'Login failed');location.reload()}catch(e){message(e.message,true)}});
 $('video-form')?.addEventListener('submit',async(e)=>{e.preventDefault();const form=new FormData(e.currentTarget);try{const r=await fetch('/api/admin/videos',{method:'POST',body:form,credentials:'same-origin'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Save failed');message('Saved for review.');location.reload()}catch(e){message(e.message,true)}});
 $('hide-broken')?.addEventListener('click',async()=>{
  if(!confirm('HIDE ALL currently published AdultEmbed videos? You reported that these external players do not work. This is reversible, does not delete records, and does not affect any other provider.'))return;
  message('Hiding reported broken AdultEmbed player listings…');
  try{const r=await fetch('/api/admin/hide-broken',{method:'POST',credentials:'same-origin'});
    const j=await r.json();if(!r.ok)throw Error(j.error||'Hide failed');
    message(`${j.hidden||0} AdultEmbed listings hidden without deleting records. Reloading…`);
    setTimeout(()=>location.reload(),1100);
  }catch(e){message(e.message,true)}
 });
 $('import-now')?.addEventListener('click',async()=>{message('Checking configured feed…');try{const r=await fetch('/api/admin/import',{method:'POST',credentials:'same-origin'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Import failed');message(`Import checked: ${j.received||0} received, ${j.added||0} queued for review, ${j.rejected||0} rejected. No content published automatically. Reloading…`);setTimeout(()=>location.reload(),2200)}catch(e){message(e.message,true)}});
 document.querySelectorAll('[data-set-status]').forEach(b=>b.addEventListener('click',async()=>{const id=b.dataset.id,status=b.dataset.setStatus;let playbackConfirmed=false;if(status==='published'&&b.closest('tr')?.textContent?.toLowerCase().includes('adultembed')){if(!confirm('Did you personally open the actual video, confirm it plays without Video unavailable, and verify commercial distribution rights? The provider API status alone is insufficient.'))return;playbackConfirmed=true;}try{const r=await fetch('/api/admin/status',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id,status,playbackConfirmed}),credentials:'same-origin'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Update failed');location.reload()}catch(e){message(e.message,true)}}));
 document.querySelectorAll('[data-review]').forEach(b=>b.addEventListener('click',async()=>{
  const id=Number(b.dataset.id);
  if(!confirm('Have you personally verified that this individual video is authorized for commercial embedding and the source is permitted?'))return;
  if(!confirm('Have you personally verified the age and consent of ALL participants, with suitable documentary evidence?'))return;
  try{const r=await fetch('/api/admin/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id,rightsConfirmed:true,adultsVerified:true}),credentials:'same-origin'});
  const j=await r.json();if(!r.ok)throw Error(j.error||'Review failed');location.reload();}catch(e){message(e.message,true)}
 }));
 $('logout')?.addEventListener('click',async()=>{await fetch('/api/admin/logout',{method:'POST',credentials:'same-origin'});location.reload()});
})();
