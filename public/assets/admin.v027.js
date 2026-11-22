(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const msg=$('message');
 const message=(t,err=false)=>{if(!msg)return;msg.textContent=t;msg.className=err?'message error':'message'};
 async function request(url,options={}){
   let response;
   try{response=await fetch(url,{credentials:'same-origin',...options});}
   catch(e){throw new Error('Connection error. Check internet access and try again. '+(e.message||''));}
   let data;
   const body=await response.text();
   try{data=body?JSON.parse(body):{};}
   catch{throw new Error('Unexpected server response (HTTP '+response.status+'). Reload the dashboard and try again.');}
   if(!response.ok){
     if(response.status===401)throw new Error('Admin session expired. Sign in again at /admin and retry.');
     if(response.status===403)throw new Error('Security check failed. Refresh /admin, then retry.');
     throw new Error(data.error||'Request failed (HTTP '+response.status+').');
   }
   return data;
 }
 $('login-form')?.addEventListener('submit',async e=>{
   e.preventDefault();const form=new FormData(e.currentTarget);
   try{await request('/api/admin/login',{method:'POST',body:form});location.reload()}
   catch(error){message(error.message,true)}
 });
 $('video-form')?.addEventListener('submit',async e=>{
   e.preventDefault();const form=new FormData(e.currentTarget);
   const uid=String(form.get('stream_uid')||'').trim(),embed=String(form.get('embed_url')||'').trim();
    const duration=Number(form.get('duration_seconds')||0);
    if(!Number.isInteger(duration)||duration<900){message('Only videos with at least 15:00 can be sent for review.',true);return;}
   if(uid&&!/^[a-f0-9]{32}$/i.test(uid)){message('Enter a real Cloudflare Stream UID (32 hexadecimal characters).',true);return;}
   if(Boolean(uid)===Boolean(embed)){message('Provide EITHER an authorized embed URL OR a Cloudflare Stream UID.',true);return;}
   try{await request('/api/admin/videos',{method:'POST',body:form});message('Saved privately for review. No video uploaded or published.');location.reload()}
   catch(error){message(error.message,true)}
 });
 $('hide-broken')?.addEventListener('click',async e=>{
   if(!confirm('HIDE ALL currently published AdultEmbed videos? This is reversible and does not delete records.'))return;
   const b=e.currentTarget;b.disabled=true;message('Hiding reported broken AdultEmbed player listings.');
   try{const data=await request('/api/admin/hide-broken',{method:'POST'});message((data.hidden||0)+' AdultEmbed listings hidden. Reloading.');setTimeout(()=>location.reload(),900)}
   catch(error){b.disabled=false;message(error.message,true);msg?.scrollIntoView?.({block:'center'})}
 });
 $('hide-official-form')?.addEventListener('submit',async e=>{
   e.preventDefault();const form=e.currentTarget;const id=String(new FormData(form).get('id')||'').trim();
   if(!/^[a-z0-9]{8,24}$/i.test(id)){message('Enter a valid provider embed ID',true);return}
   if(!confirm('Hide the official embed '+id+' from the public Noxvellox catalog?'))return;
   try{const data=await request('/api/admin/hide-official',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id})});message((data.hidden?'Hidden official embed '+id:'ID not found or already hidden')+'. Future automatic imports will not unhide it.');}
   catch(err){message(err.message,true)}
 });
  $('sync-official')?.addEventListener('click',async e=>{
   const b=e.currentTarget;b.disabled=true;message('Syncing official webmaster embeds (RSS + three search pages).');
   try{const data=await request('/api/admin/sync-official',{method:'POST'});message(`${data.synced||0} official embed metadata records synchronized. No video files downloaded. View /official-videos.`);}
   catch(error){message(error.message,true)}finally{b.disabled=false}
 });
 $('import-pepper')?.addEventListener('click',async e=>{
   if(!confirm('Copy ALL public XXX Little Pepper titles, descriptions, and source references into the PRIVATE Noxvellox review queue? No videos, ads, passwords or playback rights will be transferred. Nothing will be published.'))return;
   const b=e.currentTarget;b.disabled=true;message('Importing Little Pepper public catalog as PRIVATE metadata.');
   try{
    const data=await request('/api/admin/import-pepper',{method:'POST'});
    message(`${data.received} source titles checked, ${data.added} new PRIVATE candidates, ${data.rejected} rejected; ${data.withoutReliablePlayer} lacked reliable player links. Zero publications. Reloading.`);
    setTimeout(()=>location.reload(),1500);
   }catch(error){b.disabled=false;message(error.message,true);msg?.scrollIntoView?.({block:'center'})}
 });
 document.querySelectorAll('[data-pepper-embed]').forEach(b=>b.addEventListener('click',()=>{
   const row=b.closest('[data-video-row]'),panel=row?.querySelector('[data-pepper-panel]');if(panel){panel.hidden=!panel.hidden;panel.querySelector('input')?.focus();}
 }));
 document.querySelectorAll('[data-pepper-cancel]').forEach(b=>b.addEventListener('click',()=>{
   const row=b.closest('[data-video-row]');if(row)row.querySelector('[data-pepper-panel]').hidden=true;
 }));
 document.querySelectorAll('[data-pepper-save]').forEach(b=>b.addEventListener('click',async()=>{
   const row=b.closest('[data-video-row]');const id=Number(b.dataset.id);
   const input=row?.querySelector('[data-pepper-url]');const embedUrl=(input?.value||'').trim();
   if(!embedUrl.startsWith('https://')){feedback(row,'Enter an HTTPS official provider embed or Pornhub watch link.',true);return;}
   b.disabled=true;feedback(row,'Checking and saving the official embed for private review.');
   try{const data=await request('/api/admin/set-pepper-embed',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id,embedUrl})});
     feedback(row,'Player reference updated. Documentary rights and adult-consent reviews remain required. Reloading.');setTimeout(()=>location.reload(),1200);
   }catch(error){b.disabled=false;feedback(row,error.message,true)}
 }));
 $('import-now')?.addEventListener('click',async e=>{
   const b=e.currentTarget;b.disabled=true;message('Checking configured feed.');
   try{const data=await request('/api/admin/import',{method:'POST'});message(`Import checked: ${data.received||0} received, ${data.added||0} queued for review, ${data.rejected||0} rejected. No content published automatically. Reloading.`);setTimeout(()=>location.reload(),1500)}
   catch(error){b.disabled=false;message(error.message,true);msg?.scrollIntoView?.({block:'center'})}
 });
 const checks={
   review:{
     title:'Documentary review required. Only confirm if you have reviewed evidence for THIS specific video.',
     labels:[
       'I have verified the license or written permission for commercial embedding of this specific video.',
       'I have verified documentary evidence that every participant is an adult and consented to recording and distribution.'
     ],cta:'Save documented review'
   },
   published:{
     title:'Before publishing, verify each requirement. Provider active/complete metadata is not playback proof.',
     labels:[
       'I have verified commercial embedding/distribution rights for this specific video.',
       'I have verified age and consent documentation for every participant.',
       'I personally tested the original player and confirmed the actual video plays (not "Video unavailable").'
     ],cta:'Confirm and publish'
   },
   hidden:{title:'This video will be hidden from the public catalog; it will not be deleted.',labels:[],cta:'Hide video'},
   pending:{title:'Move this hidden, unverified video back into the private review queue.',labels:[],cta:'Return to review'}
 };
 function feedback(row,text,isError=false){
   const el=row?.querySelector('[data-row-message]');if(!el)return;
   el.textContent=text;
   el.classList.toggle('error',isError);
   el.classList.toggle('success',!isError);
   el.scrollIntoView?.({block:'nearest',behavior:'smooth'});
 }
 document.querySelectorAll('[data-check-player]').forEach(button=>button.addEventListener('click',async()=>{
   const row=button.closest('[data-video-row]');
   const id=Number(button.dataset.id);
   const old=button.textContent;
   button.disabled=true;button.textContent='Checking.';
   feedback(row,'Checking the provider page for known errors. This does not play the video.');
   try{
     const data=await request('/api/admin/check-player',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id})});
     if(data.playerUnavailable===true){feedback(row,'BROKEN SOURCE: '+data.note+'. Hide this video; do not publish.',true);}
     else if(data.playerCheckKnown===false){feedback(row,'Not verified: '+data.note+'. Keep private until manual browser test.',true);}
     else{feedback(row,'No explicit player error detected. This DOES NOT prove playback. Test video manually and verify licenses before publishing.');}
   }catch(error){feedback(row,error.message,true)}
   finally{button.disabled=false;button.textContent=old}
 }));
 const allActions='[data-review], [data-set-status]';
 document.querySelectorAll(allActions).forEach(button=>button.addEventListener('click',()=>{
   const row=button.closest('[data-video-row]');if(!row)return;
   const type=button.hasAttribute('data-review')?'review':button.dataset.setStatus;
   const config=checks[type];if(!config){feedback(row,'Unrecognized action. Reload page.',true);return;}
   const panel=row.querySelector('[data-row-panel]');const description=panel.querySelector('[data-panel-description]');
   const holder=panel.querySelector('[data-panel-checks]');const submit=panel.querySelector('[data-confirm-action]');
   const cancel=panel.querySelector('[data-cancel-action]');
   document.querySelectorAll('[data-row-panel]').forEach(p=>{if(p!==panel)p.hidden=true});
   const wasOpen=!panel.hidden&&panel.dataset.action===type;
   panel.hidden=wasOpen;
   if(wasOpen){feedback(row,'Action closed. No changes made.');return;}
   panel.dataset.action=type;panel.dataset.itemId=button.dataset.id;
   description.textContent=config.title;holder.replaceChildren();
   for(const labelText of config.labels){
     const label=document.createElement('label');label.className='row-check';
     const input=document.createElement('input');input.type='checkbox';input.setAttribute('data-required-check','');
     const text=document.createElement('span');text.textContent=labelText;
     label.append(input,text);holder.append(label);
   }
   submit.textContent=config.cta;
   submit.disabled=false;
   cancel.disabled=false;
   feedback(row,'Read the checklist below the button, then confirm.');
   panel.querySelector('input')?.focus?.();
 }));
 document.querySelectorAll('[data-cancel-action]').forEach(button=>button.addEventListener('click',()=>{
   const row=button.closest('[data-video-row]');row.querySelector('[data-row-panel]').hidden=true;
   feedback(row,'Canceled. No changes made.');
 }));
 document.querySelectorAll('[data-confirm-action]').forEach(button=>button.addEventListener('click',async()=>{
   const row=button.closest('[data-video-row]');const panel=row.querySelector('[data-row-panel]');
   const type=panel.dataset.action,id=Number(panel.dataset.itemId);
   const inputs=[...panel.querySelectorAll('[data-required-check]')];
   if(inputs.some(input=>!input.checked)){
     feedback(row,'Nothing was published. You must verify and check every requirement before continuing.',true);
     inputs.find(input=>!input.checked)?.focus?.();return;
   }
   if(!Number.isSafeInteger(id)||id<=0){feedback(row,'Video ID is invalid. Reload the panel.',true);return;}
   const originalText=button.textContent;button.disabled=true;button.textContent=type==='published'?'Publishing.':'Saving.';
   feedback(row,'Processing your request.');
   try{
     const url=type==='review'?'/api/admin/verify':'/api/admin/status';
     const payload=type==='review'?{id,rightsConfirmed:true,adultsVerified:true}:{id,status:type,playbackConfirmed:type==='published'&&inputs.length===3&&inputs.every(input=>input.checked)};
     const data=await request(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
     if(!data.ok)throw new Error('Server did not confirm the update.');
     feedback(row,type==='review'?'Review saved. Next you can click Publish. Reloading.':type==='published'?'Publication confirmed by the server. Reloading.':'Status updated successfully. Reloading.');
     location.hash='video-row-'+id;
     setTimeout(()=>location.reload(),1200);
   }catch(error){button.disabled=false;button.textContent=originalText;feedback(row,error.message,true)}
 }));
 $('logout')?.addEventListener('click',async()=>{
   try{await request('/api/admin/logout',{method:'POST'});location.reload()}
   catch(error){message(error.message,true)}
 });
})();

