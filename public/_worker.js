/**
 * NOXVELLOX Cloudflare Pages Advanced Mode Worker
 * Original site implementation, v0.1.0. Assets served by env.ASSETS.
 * An empty site launches safely with demo cards (never fake playable videos).
 * Configure D1 binding DB and secrets before using the admin/import features.
 */
const SITE='Noxvellox';
const PUBLIC_ORIGIN='https://noxvellox.site';
const ADSTERra_NATIVE_ID='74f36fcf7e2078b6bab492177d48da06';
const ADSTERRA_NATIVE_SRC='https://biomanos.org/21/74f36fcf7e2078b6bab492177d48da06';
const ADSTERRA_SOCIAL_BAR_SRC='https://biomanos.org/14/505d9a85cd6b957598b0e25ba1854db8';
const ADSTERRA_POPUNDER_SRC='https://benchform.org/1/02c67b439b4bd019691a72b99d34c0ca';
const EXOCLICK_BANNER_ZONE_ID='6104372';
const EXOCLICK_BANNER_SRC='https://a.magsrv.com/ad-provider.js';
const VERSION='0.3.10';
const MIN_VIDEO_DURATION_SECONDS=15*60;
const MIN_OFFICIAL_DURATION_SECONDS=60;
const EMBED_BLOCKED_OFFICIAL_IDS=new Set(['6937cf5fea785']);
const REMOVED_OFFICIAL_IDS=new Set(['696c7c920140e','6937cf5fea785']);
const prerollVastUrl=env=>{
  for(const key of ['PRE_ROLL_VAST_URL','ADSTERRA_VAST_URL','VAST_URL']){
    const raw=String(env?.[key]||'').trim();
    if(!raw)continue;
    try{const parsed=new URL(raw);if(parsed.protocol==='https:')return parsed.toString()}catch{/* ignore invalid optional configuration */}
  }
  return '';
};
let categories=[];
let VISIBLE_NAV_CATEGORIES=[];
let taxonomyLoadPromise=null;
let taxonomyConfig=null;
let taxonomySchemaPromise=null;
const COLLECTIONS=['featured','trending','new-releases','most-viewed'];
const MIN_INDEXABLE_CATEGORY_VIDEOS=20;
const categoryMeta={
 Featured:{eyebrow:'Editor picks',description:'Hand-picked highlights from verified sources.',cover:'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=82'},
 Trending:{eyebrow:'Trending',description:'The collections visitors are exploring most right now.',cover:'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=82'},
 'New Releases':{eyebrow:'New releases',description:'Recently added metadata from approved publishers.',cover:'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=82'},
 Originals:{eyebrow:'Original collections',description:'Independent releases with clear source attribution.',cover:'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=82'},
 Collections:{eyebrow:'Curated themes',description:'Organized collections built for easy discovery.',cover:'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=82'},
 Interviews:{eyebrow:'Behind the scenes',description:'Conversation, profile and behind-the-scenes formats.',cover:'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1200&q=82'},
 Brazilian:{eyebrow:'Brazilian',description:'Portuguese-language and Brazil-focused collections.',cover:'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=82'},
 Couples:{eyebrow:'Couples',description:'Partner collections from approved and attributed sources.',cover:'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1200&q=82'},
 Solo:{eyebrow:'Solo',description:'Solo performances from verified publishers.',cover:'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=82'},
 Amateur:{eyebrow:'Independent',description:'Amateur collections with source attribution and review.',cover:'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=82'},
 Wellness:{eyebrow:'Wellness',description:'Adult wellness and education-oriented collections.',cover:'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=82'},
  Brazzers:{eyebrow:'Verified channel',description:'Brazzers candidates stay separated and appear publicly only after rights, adult-consent and playback review.',cover:'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=1200&q=82'},
  'Official embeds':{eyebrow:'Publisher feed',description:'Free official embeds grouped by their publisher source and updated from the available feed.',cover:'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=82'}
};
const channels=[
 {slug:'brazzers',name:'Brazzers',category:'Brazzers',eyebrow:'Verified studio channel',description:'A dedicated Brazzers channel for approved listings, with source attribution and review status kept separate from the general catalog.',cover:categoryMeta.Brazzers.cover},
 {slug:'official-embeds',name:'Official embeds',category:'Official embeds',eyebrow:'Provider feed',description:'Free official embeds loaded from the publisher feed. Noxvellox does not download or host the video files.',cover:categoryMeta.Featured.cover},
 {slug:'verified-creators',name:'Verified creators',category:'Featured',eyebrow:'Independent publishers',description:'Manually reviewed titles from creators and publishers with a ready, authorized player.',cover:categoryMeta.Originals.cover}
];
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const safeText=(v,max=220)=>String(v??'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','strict-transport-security':'max-age=31536000; includeSubDomains'}});
const html=(s,status=200,extra={})=>new Response(s,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':extra['cache-control']||'public, max-age=60, s-maxage=300, stale-while-revalidate=60','x-content-type-options':'nosniff','strict-transport-security':'max-age=31536000; includeSubDomains','referrer-policy':'strict-origin-when-cross-origin','x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=()',...extra}});
const xml=s=>new Response(s,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=900, s-maxage=900, stale-while-revalidate=3600','x-content-type-options':'nosniff','strict-transport-security':'max-age=31536000, includeSubDomains'}});
const slugify=s=>safeText(s,150).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90)||`video-${Date.now()}`;
const isHttpsUrl=s=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false}};
const isTransformedPreviewImageUrl=s=>{if(!isHttpsUrl(s))return false;try{const u=new URL(s);return /(^|\.)phncdn\.com$/i.test(u.hostname)&&/\/original_[^/]+\.(?:mov|mp4)\/plain\/.*\/rs:fit:\d+:\d+\/vts:\d+(?:\/|$)/i.test(u.pathname)}catch{return false}};
const isPreviewVideoUrl=s=>{if(!isHttpsUrl(s)||isTransformedPreviewImageUrl(s))return false;try{return /\.(?:mp4|webm|mov)(?:$|[/?#])/i.test(new URL(s).pathname)}catch{return false}};
const previewEmbedHosts=new Set(['pornhub.com','www.pornhub.com','adultembed.com','www.adultembed.com','iframe.videodelivery.net']);
const isPreviewEmbedUrl=s=>{if(!isHttpsUrl(s))return false;try{const u=new URL(s);return previewEmbedHosts.has(u.hostname.toLowerCase())&&!u.username&&!u.password}catch{return false}};
const streamUid=s=>/^[a-f0-9]{32}$/i.test(String(s||'').trim())?String(s).trim().toLowerCase():'';
const streamEmbed=uid=>`https://iframe.videodelivery.net/${uid}`;
const validStreamEmbed=url=>{try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='iframe.videodelivery.net'&&/^\/[a-f0-9]{32}\/?$/i.test(u.pathname)&&!u.search&&!u.hash&&!u.username&&!u.password;}catch{return false}};

const adultGate=()=>`<div class="age-overlay" data-age-gate role="dialog" aria-modal="true" aria-labelledby="age-heading"><div class="age-dialog"><div class="emblem">18+</div><h2 id="age-heading">Adults only</h2><p>Noxvellox is intended exclusively for adults aged 18 or older, or the higher legal age required in your jurisdiction. Confirm that you meet the age requirement before accessing the catalog.</p><button class="button" type="button" data-age-confirm>I am 18+ - Enter site</button><div><a class="exit" href="https://www.google.com/">Exit this site</a></div><p class="mini" style="margin-top:20px">This acknowledgement is not a substitute for identity-based age verification where required by law.</p></div></div>`;
function head({title,description,url,canonical,robots='index,follow',structured='',preview='https://noxvellox.site/assets/og-noxvellox.svg',ogType='website'}){
  const n=esc(title),d=esc(description),c=esc(String(canonical||url).split('?')[0].split('#')[0]);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="rating" content="adult"><meta name="RATING" content="RTA-5042-1996-1400-1577-RTA"><meta name="google-site-verification" content="TnWlco6s3hCXuvvXnL6SylcJ01OBAHl6yvzDzMRj0J4"><meta name="6a97888e-site-verification" content="661f478ed74153a3cdaeae59d5b80e0f"><meta name="msvalidate.01" content="0DC5320416F7A8F505471E6805AF42F2"><meta name="robots" content="${robots}"><title>${n}</title><meta name="description" content="${d}"><link rel="canonical" href="${c}"><meta property="og:type" content="${esc(ogType)}"><meta property="og:title" content="${n}"><meta property="og:description" content="${d}"><meta property="og:url" content="${c}">${preview?`<meta property="og:image" content="${esc(preview)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:type" content="image/svg+xml">`:''}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${n}"><meta name="twitter:description" content="${d}">${preview?`<meta name="twitter:image" content="${esc(preview)}">`:''}<meta name="theme-color" content="#09090d"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="stylesheet" href="/assets/style.v027.css?ver=0.4.11"><link rel="stylesheet" href="/assets/home-dashboard.v029.css?ver=0.4.5"><link rel="stylesheet" href="/assets/channel-page.v031.css?ver=0.4.0">${structured?`<script type="application/ld+json">${JSON.stringify(structured).replace(/</g,'\\u003c')}</script>`:''}</head>`;
}
function shell({body,title,description,base,url,canonical,structured,gate=true,robots,preview,ogType='website'}){
  const navigation=`<nav class="navigation" data-nav aria-label="Main navigation"><a href="/">Home</a><a href="/videos">Videos</a><a href="/categories">Categories</a><a href="/channels">Channels</a><a href="/trending">Trending</a><a href="/most-viewed">Most Viewed</a><a href="/official-videos">Free embeds</a><a href="/about">About</a></nav>`;
  const header=`<header class="site-header"><div class="wrap head-inner"><a href="/" class="logo" aria-label="Noxvellox home">NOX<span>VELLOX</span><small>FREE ADULT ENTERTAINMENT</small></a>${navigation}<form class="search-form" role="search" method="get" action="/search" data-search-form><input name="q" placeholder="Search videos..." aria-label="Search videos" maxlength="80"><button type="submit" aria-label="Search"><svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18"><circle cx="10.8" cy="10.8" r="6.8" fill="none" stroke="currentColor" stroke-width="2"/><path d="m16 16 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></form><span class="age-pill">18+</span><button class="menu-btn" data-menu type="button" aria-label="Toggle navigation" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div></header>`;
  const footer=`<footer class="footer"><div class="wrap"><div class="footer-inner"><a href="/" class="logo">NOX<span>VELLOX</span></a><nav class="footer-links" aria-label="Footer"><a href="/about">About</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/copyright">Copyright &amp; takedown</a><a href="/contact">Contact</a><a href="/admin">Publisher</a><button class="footer-pref" type="button" data-ad-preferences>Cookie preferences</button><a href="/history">Watch history</a></nav></div>${adSlot('footer-banner')}<p class="fineprint">© ${new Date().getUTCFullYear()} Noxvellox. For adults only (18+ or higher local legal age). Independent catalog. Individual media remains the property of its respective rights holders. We accept only authorized sources. Independent providers' official embed feeds are displayed under their published embed permissions; separately imported listings require review. Optional advertising is loaded only after visitor permission.</p></div></footer>`;
  const footerWithBadge=footer;
  const headerWithCta=header.replace('<form class="search-form"','<a href="/videos" style="display:inline-flex;align-items:center;justify-content:center;background:#f24a67;color:#fff;border-radius:8px;padding:9px 13px;font-size:11px;font-weight:900;white-space:nowrap">Explore videos</a><form class="search-form"');
 return `${head({title,description,url,canonical:canonical||PUBLIC_ORIGIN+new URL(url).pathname,structured,robots,preview,ogType})}<body>${headerWithCta}<main>${body}</main>${footer}${gate?adultGate():''}<script defer src="/assets/site.v028.js?ver=0.4.29"></script><!-- legacy compatibility asset: /assets/app.v027.js --></body></html>`;
}
const coverTitle=(title,max=66)=>safeText(title,max).replace(/\s+/g,' ').trim();
const coverSvg=(title,kind='Official embed')=>{
 const label=coverTitle(title), words=label.split(' '), lines=[]; let line='';
 for(const word of words){const next=line?`${line} ${word}`:word;if(next.length>25&&line){lines.push(line);line=word}else line=next}
 if(line)lines.push(line); const shown=lines.slice(0,3);
 const text=shown.map((value,index)=>`<text x="34" y="${178+index*30}" fill="#fff" font-family="Arial,Helvetica,sans-serif" font-size="${index===0?'23':'20'}" font-weight="800">${esc(value)}</text>`).join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#25172d"/><stop offset=".55" stop-color="#5b1f3d"/><stop offset="1" stop-color="#17121f"/></linearGradient><radialGradient id="glow" cx="78%" cy="18%" r="70%"><stop offset="0" stop-color="#f24a67" stop-opacity=".42"/><stop offset="1" stop-color="#f24a67" stop-opacity="0"/></radialGradient></defs><rect width="640" height="400" fill="url(#bg)"/><rect width="640" height="400" fill="url(#glow)"/><path d="M-70 380 310 -20h55L-15 400zm360 20L640 35v80L360 400z" fill="#fff" opacity=".06"/><text x="34" y="46" fill="#ffafbd" font-family="Arial,Helvetica,sans-serif" font-size="16" font-weight="900" letter-spacing="3">NOXVELLOX</text><text x="34" y="78" fill="#fff" opacity=".78" font-family="Arial,Helvetica,sans-serif" font-size="12" font-weight="700" letter-spacing="2">${esc(kind).toUpperCase()}</text><circle cx="548" cy="90" r="38" fill="#161318" fill-opacity=".78" stroke="#fff" stroke-opacity=".48"/><path d="m540 70 30 20-30 20z" fill="#fff"/><text x="34" y="190" fill="#fff" opacity=".86" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="700">Preview image unavailable</text><text x="34" y="352" fill="#fff" opacity=".68" font-family="Arial,Helvetica,sans-serif" font-size="12" letter-spacing="1.5">SOURCE-ATTRIBUTED PREVIEW</text></svg>`;
 return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};
// A missing provider thumbnail must never collapse into an empty-looking card.
// The generated artwork is clearly labelled as a preview and is not presented as an official source image.
const coverMarkup=(poster,title,kind='Video preview',embed='')=>{const source=isPreviewVideoUrl(poster)?`<video src="${esc(poster)}" muted autoplay loop playsinline preload="metadata" data-cover-image aria-label="${esc(title)} preview video"></video>`:isHttpsUrl(poster)&&!isPreviewEmbedUrl(poster)?`<img src="${esc(poster)}" loading="lazy" decoding="async" data-cover-image alt="${esc(title)} preview image">`:'';return source+`<img class="cover-art-safe" src="${coverSvg(title,kind)}" loading="lazy" decoding="async" alt="${esc(title)} preview artwork">`};
const card=(v)=>{const slug=encodeURIComponent(v.slug);const dur=v.duration_seconds?duration(v.duration_seconds):'';const href=v.official?`/official-watch/${slug}`:`/watch/${slug}`;return `<a class="video-card" href="${href}"><div class="video-art">${coverMarkup(v.poster_url,v.title,'Video preview',v.embed_url)}<span class="play" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></span>${dur?`<span class="duration">${dur}</span>`:''}</div><div class="video-meta"><h3>${esc(v.title)}</h3><div class="sub"><strong>${esc(v.category)}</strong>  ·  ${esc(v.provider||'Catalog')}</div></div></a>`;};
const duration=n=>{let x=Math.max(0,Number(n)||0);return `${Math.floor(x/60)}:${String(x%60).padStart(2,'0')}`};
const emptyMarkup=`<div class="empty"><div><strong>New collection coming soon</strong><p>We are curating authorized videos. This launch preview does not contain unlicensed or fabricated video listings.</p></div></div>`;
const categoryChips=(current='')=>'<div class="chip-row"><a class="chip '+(!current?'active':'')+'" href="/videos">All videos</a><a class="chip" href="/categories">Categories</a><a class="chip" href="/featured">Featured</a><a class="chip" href="/trending">Trending</a><a class="chip" href="/new-releases">New Releases</a><a class="chip" href="/most-viewed">Most Viewed</a></div>';
const searchTaxonomy=q=>{const term=String(q||'').trim().toLowerCase();if(!term)return {channels:[],categories:[]};const channels=channelsV2.filter(ch=>[ch.name,ch.slug,ch.category,ch.eyebrow,ch.description].some(value=>String(value||'').toLowerCase().includes(term)));const matchedCategories=categories.filter(category=>String(category).toLowerCase().includes(term));return {channels, categories:matchedCategories};};
const categoryDescriptions={Featured:'Hand-picked catalog highlights.',Trending:'Popular titles being explored now.','New Releases':'Freshly added official metadata.',Originals:'Independent original collections.',Collections:'Curated themes grouped together.',Interviews:'Conversation and behind-the-scenes formats.',Brazilian:'Portuguese-language and Brazil-focused collections.',Couples:'Authorized couple and partner collections.',Solo:'Solo performances from approved sources.',Amateur:'Independent amateur collections with source attribution.',Wellness:'Adult wellness and education-oriented collections.',Brazzers:'Brazzers candidates, shown only after verification.','Official embeds':'Publisher-supplied embeds with source attribution.'};
const categoryCards=()=>`<div class="category-grid">${categories.map(c=>`<a class="category-card" href="/category/${slugify(c)}"><span class="category-card-kicker">Noxvellox collection</span><h2>${esc(c)}</h2><p>${esc(categoryDescriptions[c]||'Browse this curated collection.')}</p><span class="category-card-link">Browse category </span></a>`).join('')}</div>`;
const banner=`<section class="banner"><div><div class="section-kicker">Original curation  ·  Always improving</div><h2>Better browsing. Fewer distractions.</h2><p>Discover collections from authorized sources, with clear credits and accessible reporting.</p></div><a class="button ghost" href="/about">Our approach </a></section>`;
const adSlot=(placement='inline')=>`<section class="ad-slot native-ad-slot ad-slot-${slugify(placement)}${placement==='feed'?' ad-slot-feed':''}" ${placement==='feed'?'style="grid-column:1/-1"':''} aria-label="Sponsored advertisement" data-native-ad data-ad-placement="${esc(placement)}" data-script-src="${ADSTERRA_NATIVE_SRC}"><div class="ad-label">Advertisement</div><div id="container-${ADSTERra_NATIVE_ID}" class="native-banner-container" data-ad-container></div><div class="exoclick-banner-wrap" data-exoclick-banner data-exoclick-zone="${EXOCLICK_BANNER_ZONE_ID}" data-exoclick-src="${EXOCLICK_BANNER_SRC}" aria-label="ExoClick banner" hidden><ins class="eas6a97888e2" data-zoneid="${EXOCLICK_BANNER_ZONE_ID}"></ins></div><div class="ad-message" data-ad-message aria-live="polite"></div></section>`;

// Rich category and channel presentation. Covers are editorial, non-player artwork;
// they never act as video sources. Broken image URLs fall back to the branded visual.
const categoryMetaV2={
 Featured:{eyebrow:'Editor picks',description:'Hand-picked highlights from verified sources.',cover:'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=82'},
 Trending:{eyebrow:'Trending',description:'The collections visitors are exploring most right now.',cover:'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=82'},
 'New Releases':{eyebrow:'New releases',description:'Recently added metadata from approved publishers.',cover:'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=82'},
 Originals:{eyebrow:'Original collections',description:'Independent releases with clear source attribution.',cover:'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=82'},
 Collections:{eyebrow:'Curated themes',description:'Organized collections built for easy discovery.',cover:'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=82'},
 Interviews:{eyebrow:'Behind the scenes',description:'Conversation, profile and behind-the-scenes formats.',cover:'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1200&q=82'},
 Brazilian:{eyebrow:'Brazilian',description:'Portuguese-language and Brazil-focused collections.',cover:'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=82'},
 Couples:{eyebrow:'Couples',description:'Partner collections from approved and attributed sources.',cover:'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1200&q=82'},
 Solo:{eyebrow:'Solo',description:'Solo performances from verified publishers.',cover:'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=82'},
 Amateur:{eyebrow:'Independent',description:'Amateur collections with source attribution and review.',cover:'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=82'},
 Wellness:{eyebrow:'Wellness',description:'Adult wellness and education-oriented collections.',cover:'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=82'},
  Brazzers:{eyebrow:'Verified channel',description:'Brazzers candidates stay separated and appear publicly only after rights, adult-consent and playback review.',cover:'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=1200&q=82'},
  'Official embeds':{eyebrow:'Publisher feed',description:'Free official embeds grouped by their publisher source and updated from the available feed.',cover:'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=82'}
};
const channelsV2=[
 {slug:'brazzers',name:'Brazzers',category:'Brazzers',eyebrow:'Studio channel',description:'A dedicated Brazzers channel for approved listings, with source attribution and review status kept separate from the general catalog.',cover:categoryMetaV2.Brazzers.cover,officialSite:'https://www.brazzers.com/',verified:false,createdAt:''},
 {slug:'official-embeds',name:'Official embeds',category:'Official embeds',eyebrow:'Provider feed',description:'Free official embeds loaded from the publisher feed. Noxvellox does not download or host the video files.',cover:categoryMetaV2.Featured.cover},
 {slug:'verified-creators',name:'Verified creators',category:'Featured',eyebrow:'Independent publishers',description:'Manually reviewed titles from creators and publishers with a ready, authorized player.',cover:categoryMetaV2.Originals.cover}
];
const categoryDescriptionsV2=Object.fromEntries(categories.map(c=>[c,categoryMetaV2[c]?.description||'Browse this curated collection.']));
const categoryHrefV2=c=>`/category/${slugify(c)}`;
const categoryCardsV2=items=>{
 if(!items.length)return '<div class="empty"><strong>Categories are being curated</strong><p>Approved publisher tags will appear here when videos are available.</p></div>';
 const groups=new Map();
 for(const item of items){if(!groups.has(item.group_slug))groups.set(item.group_slug,{name:item.group_name,items:[]});groups.get(item.group_slug).items.push(item)}
 return [...groups.values()].map(group=>'<section class="category-group"><h2>'+esc(group.name)+'</h2><div class="category-grid">'+group.items.map(item=>{
  const meta=categoryMetaV2[item.name]||categoryMetaV2.Collections||{};
  return '<a class="category-card" href="/category/'+encodeURIComponent(item.slug)+'"><div class="category-card-media"><img src="'+esc(meta.cover||'')+'" loading="lazy" decoding="async" data-category-image alt="'+esc(item.name)+' category cover"><div class="category-card-shade"></div><span class="category-card-count">'+Number(item.count).toLocaleString('en-US')+' videos</span></div><div class="category-card-body"><h3>'+esc(item.name)+'</h3><span class="category-card-link">Browse category</span></div></a>'
 }).join('')+'</div></section>').join('');
};
const discoveryModelV2=()=>`<section class="discovery-model"><div class="discovery-model-copy"><div class="section-kicker">Simple discovery</div><h2>Find by interest or by source</h2><p>Categories answer <strong>what</strong> you want to explore. Channels answer <strong>who</strong> publishes it. The two systems stay separate so browsing remains clear.</p></div><div class="discovery-model-grid"><a href="/categories"><span>WHAT</span><strong>Categories</strong><small>Theme, style or niche</small></a><a href="/channels"><span>WHO</span><strong>Channels</strong><small>Studio, publisher or creator</small></a></div></section>`;
const channelCardsV2=()=>`<div class="channel-grid">${channelsV2.map(ch=>`<a class="channel-card" href="/channels/${encodeURIComponent(ch.slug)}"><div class="channel-banner"><img src="${esc(ch.cover)}" loading="lazy" decoding="async" data-category-image alt="${esc(ch.name)} channel cover"><div class="channel-banner-shade"></div></div><div class="channel-card-body"><div class="channel-avatar">${esc(ch.name.slice(0,1))}</div><div><span class="category-card-kicker">${esc(ch.eyebrow)}</span><h2>${esc(ch.name)}</h2><p>${esc(ch.description)}</p></div></div></a>`).join('')}</div>`;
function channelPageV2({base,url,channel,videos=[],official=[]}){
 const items=official.length?official.map(officialCard):videos.map(card);
 const count=official.length||videos.length;
 const stats=channel.slug==='brazzers'?'<span><strong>Verified only</strong><small>publication rule</small></span>':'<span><strong>Curated</strong><small>catalog channel</small></span>';
 const body=`<section class="wrap channel-hero"><div class="channel-hero-media"><img src="${esc(channel.cover)}" data-category-image alt="${esc(channel.name)} channel banner"><div class="channel-hero-shade"></div></div><div class="channel-hero-content"><div class="channel-avatar large">${esc(channel.name.slice(0,1))}</div><div><div class="section-kicker">${esc(channel.eyebrow)}</div><h1>${esc(channel.name)}</h1><p>${esc(channel.description)}</p><div class="channel-actions"><button class="button ghost" type="button" data-follow-channel="${esc(channel.slug)}">Follow channel</button><span class="follow-status" data-follow-status="${esc(channel.slug)}" role="status"></span></div></div><div class="channel-stats">${stats}<span><strong>${count||0}</strong><small>public listings</small></span></div></div></section><section class="wrap channel-layout"><div><div class="channel-tabs"><a class="active" href="/channel/${encodeURIComponent(channel.slug)}">Most recent</a><a href="/categories">Categories</a><a href="/channels">All channels</a></div><div class="section-head"><div><div class="section-kicker">${esc(channel.name)} channel</div><h2>${count?'Published videos':'Awaiting verified publications'}</h2></div></div><div class="video-grid channel-video-grid">${count?items.join(''):`<div class="empty"><strong>No verified public videos yet</strong><p>New candidates remain private until rights, adult consent and playback are checked.</p></div>`}</div></div><aside>${adSlot()}<div class="channel-side-card"><div class="section-kicker">Channel rules</div><h2>Clear separation</h2><p>This channel shows only the records assigned to ${esc(channel.name)}. Candidates from external feeds are never mixed into another category.</p><a class="button ghost" href="/about">Read our approach</a></div></aside></section>`;
 return shell({title:`${channel.name} channel | Noxvellox`,description:channel.description,base,url,body});
}

function channelPageV3({base,url,channel,videos=[],official=[]}){
 const items=(official.length?official.map(officialCard):videos.map(card)).slice(0,40);
 const count=items.length;
 const isBrazzers=channel.slug==='brazzers';
 const source=isBrazzers?'https://pt.pornhub.com/channels/brazzers':'';
 const sourceBlock=source?`<div class="channel-source"><span class="section-kicker">Official source</span><p>External source kept as a reference. Noxvellox publishes only records that pass its own rights, consent and playback checks.</p><a class="button ghost" href="${source}" target="_blank" rel="noopener noreferrer">Open official source</a></div>`:'';
 const stats=`<span><strong>${count}</strong><small>public videos</small></span><span><strong>-</strong><small>followers</small></span><span><strong>-</strong><small>total views</small></span><span><strong>${isBrazzers?'Verified only':'Curated'}</strong><small>publication rule</small></span>`;
 const firstUrl=official.length&&official[0]?.id?'/official-watch/'+encodeURIComponent(official[0].id):(!official.length&&videos[0]?.slug?'/watch/'+encodeURIComponent(videos[0].slug):'/channel/'+encodeURIComponent(channel.slug));
 const body=`<section class="wrap channel-hero channel-style channel-brand-${esc(channel.slug)}"><div class="channel-hero-media"><img src="${esc(channel.cover)}" data-category-image alt="${esc(channel.name)} channel banner"><div class="channel-hero-shade"></div><div class="channel-banner-label">NOXVELLOX CHANNEL</div></div><div class="channel-hero-content"><div class="channel-identity"><div class="channel-avatar large">${esc(channel.name.slice(0,1))}</div><div class="channel-identity-main"><div class="section-kicker">${esc(channel.eyebrow)}</div><h1>${esc(channel.name)}</h1><p>${esc(channel.description)}</p><div class="channel-identity-actions"><button class="button ghost" type="button" data-follow-channel="${esc(channel.slug)}">Follow channel</button><span class="follow-status" data-follow-status="${esc(channel.slug)}" role="status"></span></div></div></div><div class="channel-stats">${stats}</div></div></section><section class="wrap channel-main"><aside class="channel-about"><div class="section-kicker">About this channel</div><h2>${esc(channel.name)}</h2><p>${esc(channel.description)}</p><p class="channel-policy">Only approved, attributed and playable listings appear in the public feed. Review candidates remain private until verification is complete.</p>${sourceBlock}${adSlot()}</aside><div class="channel-feed"><div class="channel-feed-head"><div><div class="section-kicker">${esc(channel.name)} collection</div><h2>Videos from ${esc(channel.name)}</h2></div><a class="channel-play-all" href="${firstUrl}">Play all <span aria-hidden="true">▶</span></a></div><nav class="channel-feed-tabs" aria-label="Channel sorting"><a class="active" href="/channel/${encodeURIComponent(channel.slug)}">Most recent</a><a href="/channel/${encodeURIComponent(channel.slug)}?sort=popular">Most viewed</a><a href="/channel/${encodeURIComponent(channel.slug)}?sort=rating">Best rated</a></nav><div class="video-grid channel-video-grid">${count?items.join(''):`<div class="empty"><strong>No verified public videos yet</strong><p>New candidates stay private until rights, adult consent and playback checks are complete.</p></div>`}</div></div></section>`;
 return shell({title:`${channel.name} channel | Noxvellox`,description:channel.description,base,url,body});
}

async function countChannelVideosV4(db,channel,q=''){
 if(!db)return 0;
 try{
  const params=['published'];
  let where='status = ?';
  if(channel.category==='Brazzers'){where+=" AND (lower(category)=lower(?) OR lower(provider)=?)";params.push(channel.category,'adultembed')}
  else if(channel.category){where+=' AND lower(category)=lower(?)';params.push(channel.category)}
  if(q){where+=" AND (title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')";const match=`%${q.replace(/[\\%_]/g,'\\$&')}%`;params.push(match,match)}
  const row=await db.prepare(`SELECT COUNT(*) AS total FROM videos WHERE ${where}`).bind(...params).first();
  return Number(row?.total||0);
 }catch{return 0}
}
const channelDateV4=value=>value?safeText(String(value).slice(0,10),10):'Date not recorded';
const channelVideoCardV4=(v,{official=false,channelName='Brazzers'}={})=>{const id=official?v.id:v.slug;const href=official?`/official-watch/${encodeURIComponent(id)}`:`/watch/${encodeURIComponent(id)}`;const source=official?'Official embed':channelName;return `<a class="video-card channel-video-card-v4" data-channel-video href="${href}"><div class="video-art">${coverMarkup(v.poster_url,v.title,official?'Official preview':'Channel preview',v.embed_url)}<span class="play" aria-hidden="true">▶</span>${v.duration_seconds?`<span class="duration">${duration(v.duration_seconds)}</span>`:''}</div><div class="video-meta"><h3>${esc(v.title)}</h3><div class="sub"><strong>${esc(source)}</strong>  ·  ${esc(channelDateV4(v.published_at))}</div><div class="channel-video-facts">Views not recorded</div></div></a>`};
function channelPageV4({base,url,canonicalUrl,channel,videos=[],official=[],total=0,page=1,limit=20,q='',sort='recent'}){
 const isBrazzers=channel.slug==='brazzers';
 const primaryPath=`/channels/${encodeURIComponent(channel.slug)}`;
 const queryUrl=({nextSort=sort,nextQ=q,nextPage=1}={})=>{const params=new URLSearchParams();if(nextQ)params.set('q',nextQ);if(nextSort&&nextSort!=='recent')params.set('sort',nextSort);if(nextPage>1)params.set('page',String(nextPage));const query=params.toString();return primaryPath+(query?`?${query}`:'')};
 const items=official.length?official.map(v=>channelVideoCardV4(v,{official:true,channelName:channel.name})):videos.map(v=>channelVideoCardV4(v,{channelName:channel.name}));
 const hasItems=items.length>0;
 const firstUrl=official.length&&official[0]?.id?`/official-watch/${encodeURIComponent(official[0].id)}`:videos[0]?.slug?`/watch/${encodeURIComponent(videos[0].slug)}`:primaryPath;
 const pages=Math.max(1,Math.ceil(total/limit));
 const stats=`<span><strong>${total}</strong><small>published videos</small></span><span><strong>Not tracked</strong><small>followers</small></span><span><strong>Not recorded</strong><small>total views</small></span><span><strong>Not ranked</strong><small>internal position</small></span>`;
 const sourceLink=channel.officialSite?`<p class="channel-detail"><strong>Official website</strong><br><a href="${esc(channel.officialSite)}" target="_blank" rel="noopener noreferrer">${esc(channel.officialSite.replace(/^https?:\/\//,''))}</a></p>`:'';
 const verify=channel.verified?'<span class="channel-verified-badge" title="Verified channel">V Verified</span>':'<span class="channel-unverified-note">Verification not claimed</span>';
 const sourceBlock=isBrazzers?`<div class="channel-source"><span class="section-kicker">Source reference</span><p>The official source is linked for reference. Only authorized, playable records are published in the Noxvellox feed.</p><a class="button ghost" href="https://www.brazzers.com/" target="_blank" rel="noopener noreferrer">Visit official website</a></div>`:'';
 const pagination=pages>1?`<nav class="channel-pagination" aria-label="Channel pages">${page>1?`<a class="button ghost" href="${queryUrl({nextPage:page-1})}">Previous</a>`:''}<span>Page ${page} of ${pages}  ·  ${total} videos</span>${page<pages?`<a class="button ghost" href="${queryUrl({nextPage:page+1})}">Next</a>`:''}</nav>`:'';
 const tabs=[['recent','Most recent'],['popular','Most viewed'],['rating','Best rated']].map(([value,label])=>`<a class="${sort===value?'active':''}" aria-current="${sort===value?'page':'false'}" href="${queryUrl({nextSort:value,nextPage:1})}">${label}</a>`).join('');
 const empty=q?`<div class="empty"><strong>No matching public videos</strong><p>Try another title or clear the channel search. Private candidates are not shown.</p></div>`:`<div class="empty"><strong>No verified public videos yet</strong><p>New candidates remain private until rights, adult consent and playback checks are complete.</p></div>`;
 const body=`<section class="wrap channel-hero channel-style channel-brand-${esc(channel.slug)}"><div class="channel-hero-media"><img src="${esc(channel.cover)}" data-category-image alt="${esc(channel.name)} editorial channel cover"><div class="channel-hero-shade"></div><div class="channel-banner-label">NOXVELLOX CHANNEL  ·  EDITORIAL COVER</div></div><div class="channel-hero-content"><div class="channel-identity"><div class="channel-avatar large" aria-label="${esc(channel.name)} channel mark">${esc(channel.name.slice(0,1))}</div><div class="channel-identity-main"><div class="section-kicker">${esc(channel.eyebrow)} ${verify}</div><h1>${esc(channel.name)}</h1><p>${esc(channel.description)}</p><div class="channel-identity-actions"><button class="button ghost" type="button" data-follow-channel="${esc(channel.slug)}">Subscribe</button><span class="follow-status" data-follow-status="${esc(channel.slug)}" role="status"></span></div></div></div><div class="channel-stats">${stats}</div></div></section><section class="wrap channel-main"><aside class="channel-about"><div class="section-kicker">About this channel</div><h2>${esc(channel.name)}</h2><p>${esc(channel.description)}</p><p class="channel-detail"><strong>Type</strong><br>Adult content producer listing</p>${sourceLink}<p class="channel-detail"><strong>Channel created</strong><br>${esc(channel.createdAt||'Not recorded')}</p><p class="channel-policy">Noxvellox shows only approved, attributed and playable listings. No public statistics or verification badges are invented.</p>${sourceBlock}${adSlot()}</aside><div class="channel-feed"><div class="channel-feed-head"><div><div class="section-kicker">${esc(channel.name)} collection</div><h2>Videos from ${esc(channel.name)}</h2><p class="channel-feed-count">${q?`Results for "${esc(q)}"  ·  `:''}${total} public videos</p></div><a class="channel-play-all" href="${firstUrl}">Play all <span aria-hidden="true">▶</span></a></div><form class="channel-search" action="${primaryPath}" method="get"><label for="channel-query">Search this channel</label><div><input id="channel-query" name="q" value="${esc(q)}" placeholder="Search titles in this channel" maxlength="80"><input type="hidden" name="sort" value="${esc(sort)}"><button class="button" type="submit">Search</button></div></form><nav class="channel-feed-tabs" aria-label="Channel sorting">${tabs}<a class="channel-all-tab" href="${primaryPath}">All videos</a></nav><div class="video-grid channel-video-grid">${hasItems?items.join(''):empty}</div>${pagination}</div></section>`;
 const structured={'@context':'https://schema.org','@graph':[{'@type':'WebPage','@id':`${canonicalUrl}#page`,url:canonicalUrl,name:'Brazzers - Videos and Channel | Noxvellox',description:'Editorial Brazzers channel page on Noxvellox, with authorized public videos and real catalog data.'},{'@type':'BreadcrumbList',itemListElement:[{ '@type':'ListItem',position:1,name:'Home',item:base+'/'},{ '@type':'ListItem',position:2,name:'Channels',item:base+'/channels'},{ '@type':'ListItem',position:3,name:channel.name,item:canonicalUrl}]}]};
 const followSlug=JSON.stringify(channel.slug);
 const followScript=`<script>(()=>{const slug=${followSlug},button=document.querySelector('[data-follow-channel="'+slug+'"]'),status=document.querySelector('[data-follow-status="'+slug+'"]');if(!button)return;const key='noxvellox-followed-channels';let memoryFollowed=false;const read=()=>{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return memoryFollowed?[slug]:[]}};const write=value=>{memoryFollowed=value.includes(slug);try{localStorage.setItem(key,JSON.stringify(value))}catch{}};const paint=()=>{const active=read().includes(slug);button.textContent=active?'Following channel':'Subscribe';button.setAttribute('aria-pressed',String(active));if(status)status.textContent=active?'Saved on this device':''};paint();button.addEventListener('click',()=>{const current=read(),index=current.indexOf(slug);if(index>=0)current.splice(index,1);else current.push(slug);write(current);paint()})})();</script>`;
 return shell({title:'Brazzers - Videos and Channel | Noxvellox',description:'Brazzers channel on Noxvellox: authorized public videos, channel information and catalog updates.',base,url,canonical:canonicalUrl,body:body+followScript,structured});
}

// Free, read-only, provider-published embed feed. Unlike admin uploads, this is an
// official webmaster embed RSS and requires no per-title manual publishing step.
// No videos are downloaded or stored. Only current RSS entries are displayed.
const OFFICIAL_RSS='https://www.pornhub.com/video/webmasterss';
const OFFICIAL_ORIGIN='https://www.pornhub.com';
// Temporary last-known-good OFFICIAL webmaster RSS metadata, checked 2026-11-22.
// Do not treat this as live availability or an assurance of playback or licensing of separate content.
 // Signed thumbnail URLs are NOT stored because they expire.
const OFFICIAL_SNAPSHOT_OBSERVED='2026-11-22T04:40:00.000Z';
const OFFICIAL_SNAPSHOT=[{"id":"6b01c8e7a798e","title":"A Hot Slut Seduced Me and I Filled Her Pretty Face With A Ton Of Cum","duration_seconds":977},{"id":"6affe099cedbb","title":"Littledemons Rubs Wet Pussy Clip 2","duration_seconds":307},{"id":"6af25914723cc","title":"Rubbing My Pussy In Skirt N Thong Clip 13","duration_seconds":76},{"id":"6ab545767cfca","title":"Caught Red-Handed in the Woods While Hubby Took a Leak-Hi to Husband","duration_seconds":78},{"id":"6ab8f1da99235","title":"#232 Hi to Husband","duration_seconds":32},{"id":"6aabc7066d5dd","title":"No Hands, Just Eye Contact - EYES CONTACT - XXL TSHIRT - POV","duration_seconds":49},{"id":"6b0260092fc09","title":"Big tits press forward as she bends over the vacuum","duration_seconds":15},{"id":"6b02601621267","title":"I'll smile when you fuck me and cry with happiness","duration_seconds":37},{"id":"6b0260091e65a","title":"Big tits press against the shirt as she leans forward","duration_seconds":12},{"id":"6b025fe8cc9ed","title":"Wondering if you like me taking off clothes","duration_seconds":68},{"id":"6b025fe5207bf","title":"Would u take me from behind?","duration_seconds":30},{"id":"6b025fd9c2d09","title":"would u fuck me ?","duration_seconds":25}];
function officialSnapshot(){
 const age=Date.now()-Date.parse(OFFICIAL_SNAPSHOT_OBSERVED);
 // Fail closed after 7 days: this snapshot cannot become an indefinite fake live catalog.
 if(!Number.isFinite(age)||age<0||age>7*24*60*60*1000)return [];
 return OFFICIAL_SNAPSHOT.filter(v=>Number(v.duration_seconds)>=MIN_OFFICIAL_DURATION_SECONDS).map(v=>({...v,poster_url:'',source_url:OFFICIAL_ORIGIN+'/view_video.php?viewkey='+v.id,embed_url:OFFICIAL_ORIGIN+'/embed/'+v.id,from_snapshot:true}));
}

function rssField(item,tag){
 const match=item.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+tag+'>','i'));
 let v=match?match[1].trim():'';
 v=v.replace(/^<!\[CDATA\[/,'').replace(/\]\]>$/,'');
 return v.replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&#(\d+);/g,(_,n)=>{const code=Number(n);return code>31&&code<127?String.fromCodePoint(code):''});
}
function officialPoster(value){try{const u=new URL(String(value||''));if(u.protocol==='https:'&&(u.hostname==='phncdn.com'||u.hostname.endsWith('.phncdn.com')))return u.href}catch{}return ''}
function parseOfficialRSS(xmlText){
 const xml=String(xmlText||''); if(xml.length>350000||!/\<rss\b/i.test(xml)||!/<channel>/i.test(xml))return [];
 const out=[],seen=new Set();
 for(const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)){
  if(out.length>=48)break;
  const entry=m[1];
  const title=safeText(rssField(entry,'title'),150),link=rssField(entry,'link');
  const match=link.match(/^https:\/\/(?:www\.)?pornhub\.com\/view_video\.php\?viewkey=([a-zA-Z0-9]{8,24})(?:&.*)?$/);
  if(!title||!match)continue;
  const id=match[1];if(seen.has(id))continue;
  seen.add(id);
  const poster=rssField(entry,'thumb')||entry.match(/<(?:media:)?thumbnail\b[^>]*\burl=["']([^"']+)["']/i)?.[1]||'';
  const validPoster=officialPoster(poster);
  const rawDuration=Number(rssField(entry,'duration'));
  if(!Number.isInteger(rawDuration)||rawDuration<MIN_OFFICIAL_DURATION_SECONDS||rawDuration>=60000)continue;
  out.push({id,title,poster_url:validPoster,source_url:OFFICIAL_ORIGIN+'/view_video.php?viewkey='+id,embed_url:OFFICIAL_ORIGIN+'/embed/'+id,duration_seconds:rawDuration});
 }
 return out;
}
// The provider RSS can block Cloudflare egress or redirect based on location.
// Return a sanitized diagnosis instead of silently turning all network errors into an empty array.
async function retrieveOfficialFeed({force=false}={}){
 const cache=(typeof caches!=='undefined'&&caches.default)?caches.default:null;
 const key=new Request('https://noxvellox.site/__internal/rss-official-cache-026');
 if(!force&&cache){
  try{const cached=await cache.match(key);if(cached){const entries=parseOfficialRSS(await cached.text());if(entries.length)return {entries,reason:'cached_live_rss',httpStatus:200};}}
  catch{/* Nonfatal cache miss */}
 }
 try{
  const response=await fetch(OFFICIAL_RSS,{
   redirect:'follow',
   headers:{accept:'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.6'},
   signal:AbortSignal.timeout(8000)
  });
  // A provider redirect may be followed only if it ENDS on the original provider.
  if(response.url){const dest=new URL(response.url);if(dest.protocol!=='https:'||!['www.pornhub.com','pornhub.com'].includes(dest.hostname))return {entries:[],reason:'redirect_outside_official_domain',httpStatus:response.status}}
  if(!response.ok)return {entries:[],reason:'upstream_http_error',httpStatus:response.status};
  const size=Number(response.headers.get('content-length')||0);
  if(size>350000)return {entries:[],reason:'feed_too_large',httpStatus:response.status};
  const content=await response.text();
  if(content.length>350000)return {entries:[],reason:'feed_too_large',httpStatus:response.status};
  const entries=parseOfficialRSS(content);
  if(!entries.length)return {entries:[],reason:'rss_invalid_or_empty',httpStatus:response.status};
  if(cache){try{await cache.put(key,new Response(content,{headers:{'content-type':'application/rss+xml','cache-control':'public, max-age=900'}}))}catch{/* Do not fail on cache errors */}}
  return {entries,reason:'live_rss',httpStatus:response.status};
 }catch(e){
  return {entries:[],reason:e?.name==='TimeoutError'?'upstream_timeout':'network_or_provider_restriction',httpStatus:null};
 }
}
async function officialFeed(){
 const live=await retrieveOfficialFeed();
 return live.entries.length?live.entries:officialSnapshot();
}
// GitHub Actions publishes this metadata file into the Pages asset bundle.
// When it is valid, public pages use it as the source of truth and never make
// a live provider request from Cloudflare. A missing/invalid asset preserves
// the legacy fallback for local tests and older deployments.
async function loadLocalOfficialFeed(env,req){
 try{
  if(!env?.ASSETS?.fetch)return null;
  const assetUrl=new URL('/data/videos.json',req.url);
  const [response,manualResponse]=await Promise.all([env.ASSETS.fetch(new Request(assetUrl)),env.ASSETS.fetch(new Request(new URL('/data/manual-official-videos.json',req.url)))]);
  const payload=response.ok?await response.json():null;
  const manualPayload=manualResponse.ok?await manualResponse.json():null;
  const entries=[...(Array.isArray(payload)?payload:(Array.isArray(payload?.entries)?payload.entries:[])),...(Array.isArray(manualPayload?.entries)?manualPayload.entries:[])];
  const normalized=entries.filter(item=>item&&/^[a-z0-9]{8,24}$/i.test(String(item.id||''))&&String(item.title||'').trim()&&isHttpsUrl(item.source_url)&&isHttpsUrl(item.embed_url)).map(item=>({...item,source_url:String(item.source_url),embed_url:String(item.embed_url),poster_url:isHttpsUrl(item.poster_url)?String(item.poster_url):(isPreviewEmbedUrl(item.embed_url)?String(item.embed_url):'')}));
  const eligible=normalized.filter(item=>Number.isInteger(Number(item.duration_seconds))&&Number(item.duration_seconds)>=MIN_OFFICIAL_DURATION_SECONDS);
  return await hydrateOfficialPosters(eligible);
 }catch{return null}
}
const posterExpiry=value=>{
 try{
  const url=new URL(String(value||''));
  const direct=Number(url.searchParams.get('exp')||url.searchParams.get('validto')||0);
  const edge=url.searchParams.get('hdnea')||'';
  const signed=edge.match(/(?:^|~)exp=(\d+)(?:~|$)/);
  return direct||Number(signed?.[1]||0);
 }catch{return 0}
};
const posterExpiresSoon=value=>{
 if(!String(value||'').trim())return true;
 const expiry=posterExpiry(value);
 return expiry>0&&expiry<=Math.floor(Date.now()/1000)+300;
};
async function officialPagePoster(id){
 if(!/^[a-z0-9]{8,24}$/i.test(String(id||'')))return '';
 const cache=(typeof caches!=='undefined'&&caches.default)?caches.default:null;
 const key=new Request('https://noxvellox.site/__internal/official-poster-027/'+encodeURIComponent(id));
 if(cache){try{const cached=await cache.match(key);if(cached){const url=(await cached.text()).trim();if(officialPoster(url)&&!posterExpiresSoon(url))return url}}catch{/* Ignore thumbnail cache misses */}}
 try{
  const response=await fetch(OFFICIAL_ORIGIN+'/view_video.php?viewkey='+encodeURIComponent(id),{redirect:'follow',headers:{accept:'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8','accept-language':'en-US,en;q=0.9','user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36','referer':OFFICIAL_ORIGIN+'/'},signal:AbortSignal.timeout(8000)});
  if(response.url){const dest=new URL(response.url);if(dest.protocol!=='https:'||!['www.pornhub.com','pornhub.com'].includes(dest.hostname))return ''}
  if(!response.ok)return '';
  const size=Number(response.headers.get('content-length')||0);if(size>3000000)return '';
  const html=await response.text();if(html.length>3000000)return '';
  const candidates=[];
  for(const match of html.matchAll(/<meta\b[^>]*>/gi)){
   const tag=match[0];
   if(!/\b(?:property|name)=['"](?:og:image|twitter:image)['"]/i.test(tag))continue;
   const content=tag.match(/\bcontent=['"]([^'"]+)['"]/i)?.[1]?.replace(/&amp;/gi,'&');
   if(officialPoster(content)&&!candidates.includes(content))candidates.push(content);
  }
  candidates.sort((a,b)=>(posterExpiry(b)||Number.MAX_SAFE_INTEGER)-(posterExpiry(a)||Number.MAX_SAFE_INTEGER));
  const poster=candidates.find(value=>!posterExpiresSoon(value))||'';
  if(poster&&cache){try{await cache.put(key,new Response(poster,{headers:{'content-type':'text/plain; charset=utf-8','cache-control':'public, max-age=86400'}}))}catch{/* Do not fail on cache errors */}}
  return poster;
 }catch{return ''}
}
async function hydrateOfficialPosters(entries,db=null){
 const list=Array.isArray(entries)?entries:[];
 if(!list.some(item=>posterExpiresSoon(item?.poster_url)))return list;
 const live=await retrieveOfficialFeed();
 const posters=new Map((live.entries||[]).map(item=>[String(item.id),item.poster_url||'']));
 const refreshed=list.map(item=>{
  if(!posterExpiresSoon(item?.poster_url))return item;
  const candidate=posters.get(String(item.id))||'';
  return {...item,poster_url:officialPoster(candidate)&&!posterExpiresSoon(candidate)?candidate:''};
 });
 const unresolved=refreshed.map((item,index)=>({item,index})).filter(({item})=>!item.poster_url).slice(0,24);
 const pagePosters=await Promise.all(unresolved.map(({item})=>officialPagePoster(item.id)));
 for(let i=0;i<unresolved.length;i++)if(pagePosters[i])refreshed[unresolved[i].index]={...refreshed[unresolved[i].index],poster_url:pagePosters[i]};
 if(db){
  const updates=refreshed.filter((item,index)=>item.poster_url!==list[index]?.poster_url&&item.poster_url);
  if(updates.length)try{await db.batch(updates.map(item=>db.prepare('UPDATE official_embeds SET poster_url=? WHERE id=?').bind(item.poster_url,item.id)))}catch{/* Keep serving refreshed links for this request even if persistence fails */}
 }
 return refreshed;
}
// D1 retains public metadata from the provider's webmaster embed feed between
// scheduled syncs. The official feed remains the fallback if D1 is unavailable.
// Importing metadata never downloads the media itself.
const OFFICIAL_PAGE_SIZE=24;
function officialPageNumber(value){const n=Number(value);return Number.isInteger(n)&&n>=1?Math.min(n,1000):1}
async function officialCatalog(db,{page=1,limit=OFFICIAL_PAGE_SIZE,q='',localEntries=null}={}){
 const offset=(page-1)*limit;
 if(db){try{
  const query=String(q||'').trim();
  const match=query?`%${query.replace(/[\\%_]/g,'\\$&')}%`:'';
  const where=query?" AND title LIKE ? ESCAPE '\\'":'';
  const [rows,count]=await Promise.all([
    db.prepare(`SELECT id,title,poster_url,duration_seconds FROM official_embeds WHERE visibility='active' AND id NOT IN ('696c7c920140e','6937cf5fea785')${where} AND duration_seconds >= ${MIN_OFFICIAL_DURATION_SECONDS} ORDER BY CASE WHEN poster_url<>'' THEN 0 ELSE 1 END,first_seen_at DESC,id DESC LIMIT ? OFFSET ?`).bind(...(query?[match,limit,offset]:[limit,offset])).all(),
   db.prepare(`SELECT count(*) AS total FROM official_embeds WHERE visibility='active' AND id NOT IN ('696c7c920140e','6937cf5fea785')${where} AND duration_seconds >= ${MIN_OFFICIAL_DURATION_SECONDS}`).bind(...(query?[match]:[])).first()
  ]);
   const entries=await hydrateOfficialPosters((rows.results||[]).map(v=>({...v,source_url:OFFICIAL_ORIGIN+'/view_video.php?viewkey='+v.id,embed_url:OFFICIAL_ORIGIN+'/embed/'+v.id})),db);
  if(count?.total>0){
   const known=new Set(entries.map(item=>String(item.id)));
   const queryText=String(q||'').trim().toLowerCase();
   const manual=Array.isArray(localEntries)?localEntries.filter(item=>!known.has(String(item.id))&&(!queryText||String(item.title||'').toLowerCase().includes(queryText))):[];
   const databaseTotal=Number(count.total);
   const manualOffset=Math.max(0,offset-databaseTotal);
   const manualLimit=offset>=databaseTotal?limit:Math.max(0,limit-entries.length);
   const manualPage=manual.slice(manualOffset,manualOffset+manualLimit);
   return {entries:[...entries,...manualPage],total:databaseTotal+manual.length,persisted:true};
  }
 }catch{/* table not initialized yet; use only the live RSS */}}
 if(Array.isArray(localEntries)){
  const query=String(q||'').trim().toLowerCase();
  const eligible=localEntries.filter(item=>!REMOVED_OFFICIAL_IDS.has(String(item.id))&&Number(item.duration_seconds)>=MIN_OFFICIAL_DURATION_SECONDS);
  const filtered=query?eligible.filter(item=>String(item.title||'').toLowerCase().includes(query)):eligible;
  return {entries:filtered.slice(offset,offset+limit),total:filtered.length,persisted:false,local:true};
 }
 const live=await officialFeed();
 const query=String(q||'').trim().toLowerCase();
 const eligible=live.filter(item=>!REMOVED_OFFICIAL_IDS.has(String(item.id)));
 const filtered=query?eligible.filter(item=>String(item.title||'').toLowerCase().includes(query)):eligible;
 return {entries:filtered.slice(offset,offset+limit),total:filtered.length,persisted:false};
}
function officialCategory(id){return 'Official embeds'}
async function officialForCategory(db,category,localEntries=null){if(category!=='Official embeds')return [];return (await officialCatalog(db,{page:1,limit:500,localEntries})).entries}
async function officialById(db,id,localEntries=null){
 if(REMOVED_OFFICIAL_IDS.has(String(id)))return null;
 if(!/^[a-z0-9]{8,24}$/i.test(String(id)))return null;
 if(db){try{
   const row=await db.prepare(`SELECT id,title,poster_url,duration_seconds FROM official_embeds WHERE id=? AND id NOT IN ('696c7c920140e','6937cf5fea785') AND visibility='active' AND duration_seconds >= ${MIN_OFFICIAL_DURATION_SECONDS}`).bind(id).first();
   if(row){const hydrated=(await hydrateOfficialPosters([row],db))[0];return {...hydrated,source_url:OFFICIAL_ORIGIN+'/view_video.php?viewkey='+row.id,embed_url:OFFICIAL_ORIGIN+'/embed/'+row.id};}
 }catch{/* fallback to RSS */}}
 if(Array.isArray(localEntries)){
     return localEntries.find(item=>item.id===id)||null;
 }
 return (await officialFeed()).find(v=>v.id===id)||null;
}
// One-click official webmaster import for administrators. Unlike the
// separately imported Little Pepper/Brazzers metadata, official embeds in the
// provider webmaster program are allowed as automatic feed listings.
async function syncOfficialOnDemand(db){
 if(!db)throw Error('D1 database not configured');
 const records=new Map();
 const live=await retrieveOfficialFeed({force:true});
 for(const v of live.entries)records.set(v.id,{id:v.id,title:v.title,poster_url:v.poster_url||'',duration_seconds:v.duration_seconds||0});
  for(let page=1;page<=6;page++){
  const addr='https://www.pornhub.com/webmasters/search?search=amateur&page='+page;
  try{
   const response=await fetch(addr,{redirect:'follow',headers:{accept:'application/json'},signal:AbortSignal.timeout(8000)});
   if(response.url){const u=new URL(response.url);if(u.protocol!=='https:'||!['www.pornhub.com','pornhub.com'].includes(u.hostname))throw Error('Invalid official search redirect')}
   if(!response.ok)throw Error('Provider HTTP '+response.status);
   const text=await response.text();if(text.length>500000)throw Error('Invalid provider data size');
   const parsed=JSON.parse(text);if(!Array.isArray(parsed.videos))throw Error('Invalid provider search data');
   for(const row of parsed.videos.slice(0,50)){
    const id=String(row.video_id||''),title=safeText(row.title||'',160);
    const uri=String(row.url||'');
    if(!/^[a-z0-9]{8,24}$/i.test(id)||!title||!uri.startsWith(OFFICIAL_ORIGIN+'/view_video.php?viewkey='+id))continue;
    const dur=String(row.duration||'');let seconds=Number(dur);
    if(/^\d+:\d\d(?::\d\d)?$/.test(dur))seconds=dur.split(':').map(Number).reduce((n,v)=>n*60+v,0);
    const poster=officialPoster(row.poster_url||row.default_thumb||row.thumb||row.thumbnail||row.image||'');
     if(!Number.isInteger(seconds)||seconds<MIN_OFFICIAL_DURATION_SECONDS||seconds>=60000)continue;
     records.set(id,{id,title,poster_url:poster,duration_seconds:seconds});
   }
  }catch(e){console.warn('Webmaster search temporarily unavailable',page,String(e.message||e).slice(0,90));break}
 }
 if(!records.size)throw Error('Official provider is temporarily unavailable; no unverified data imported');
 await db.prepare("CREATE TABLE IF NOT EXISTS official_embeds (id TEXT PRIMARY KEY,title TEXT NOT NULL,poster_url TEXT NOT NULL DEFAULT '',duration_seconds INTEGER NOT NULL DEFAULT 0,source TEXT NOT NULL DEFAULT 'pornhub_webmaster',visibility TEXT NOT NULL DEFAULT 'active',first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),last_seen_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
 const all=[...records.values()];
 for(let i=0;i<all.length;i+=20){await db.batch(all.slice(i,i+20).map(v=>db.prepare("INSERT INTO official_embeds (id,title,poster_url,duration_seconds,source) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,poster_url=CASE WHEN excluded.poster_url<>'' THEN excluded.poster_url ELSE official_embeds.poster_url END,duration_seconds=excluded.duration_seconds,last_seen_at=datetime('now')").bind(v.id,v.title,v.poster_url||'',v.duration_seconds,'pornhub_official_webmaster')))}
 return {ok:true,synced:all.length,automaticallyAvailable:true,noVideoFilesCopied:true};
}
const officialCard=v=>`<a class="video-card" href="/official-watch/${encodeURIComponent(v.id)}"><div class="video-art">${coverMarkup(v.poster_url,v.title,'Free official embed',v.embed_url)}<span class="play" aria-hidden="true">▶</span>${v.duration_seconds?`<span class="duration">${duration(v.duration_seconds)}</span>`:''}</div><div class="video-meta"><h3>${esc(v.title)}</h3><div class="sub"><strong>Official embed</strong>  ·  Pornhub</div></div></a>`;
const officialGrid=(items,heading='Videos from official provider feed')=>`<section class="section wrap"><div class="section-head"><div><div class="section-kicker">No video files hosted here  ·  Free authorized embeds</div><h2>${esc(heading)}</h2></div><a class="section-link" href="/official-videos">View official feed ?</a></div><div class="video-grid">${items.length?items.map(officialCard).join(''):'<div class="empty"><strong>Official provider feed temporarily unavailable</strong><p>Please check the provider or try again later. No placeholder videos will be invented.</p></div>'}</div>${items[0]?.from_snapshot?'<p class="mini"><strong>Dated contingency:</strong> official RSS metadata last observed November 22, 2026; playback is not confirmed and listings can change.</p>':''}<p class="mini">Embedded directly from the original provider under its webmaster embed terms. Availability may depend on region and may change. No files are downloaded or redistributed by Noxvellox.</p></section>`;
function officialWatch({base,url,video,related=[],env={}}){
  const embedBlocked=EMBED_BLOCKED_OFFICIAL_IDS.has(String(video.id));
  const v={title:video.title,category:'Official embeds',poster_url:video.poster_url,embed_url:embedBlocked?'':video.embed_url,source_url:embedBlocked?`https://cn.pornhub.com/view_video.php?viewkey=${encodeURIComponent(video.id)}`:video.source_url,provider:'',duration_seconds:video.duration_seconds,description:'Video hosted and streamed by the original platform.',official:true,embed_blocked:embedBlocked,slug:video.id,published_at:null};
  return watchPage({url,base,v,related:related.map(item=>({slug:item.id,title:item.title,poster_url:item.poster_url,duration_seconds:item.duration_seconds,category:'Free official embed',provider:'',official:true})),env:{...env,ALLOWED_EMBED_HOSTS:'www.pornhub.com'}});
}

const publicRecord=(v)=>v&&v.status==='published';
async function listVideos(db,{q='',category='',offset=0,limit=20,sort='recent'}={}){
  if(!db)return [];
  const p=['published'];let where='status = ?';
  if(q){where+=' AND (title LIKE ? ESCAPE \'\\\' OR description LIKE ? ESCAPE \'\\\' OR category LIKE ? ESCAPE \'\\\' OR provider LIKE ? ESCAPE \'\\\' OR source_id LIKE ? ESCAPE \'\\\')';const match=`%${q.replace(/[\\%_]/g,'\\$&')}%`;p.push(match,match,match,match,match)}
  if(category==='Brazzers'){where+=" AND (lower(category)=lower(?) OR lower(provider)=?)";p.push(category,'adultembed')}
  else if(category){where+=' AND lower(category)=lower(?)';p.push(category)}
  p.push(limit,offset);
  const orderBy=sort==='popular'?'created_at DESC,id DESC':'published_at DESC,id DESC';
  const res=await db.prepare(`SELECT id,slug,title,description,category,poster_url,embed_url,source_url,provider,duration_seconds,status,published_at FROM videos WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).bind(...p).all();
  return (res.results||[]).filter(video=>Number(video.duration_seconds)>=MIN_VIDEO_DURATION_SECONDS);
}
const rotateRelated=(items,currentId,limit=30)=>{
 const unique=new Map();
 for(const item of Array.isArray(items)?items:[]){
  const id=String(item?.slug||item?.id||'');
  if(!id||id===String(currentId)||unique.has(id))continue;
  unique.set(id,item);
 }
 const pool=[...unique.values()];
 for(let index=pool.length-1;index>0;index--){
  const swap=Math.floor(Math.random()*(index+1));
  [pool[index],pool[swap]]=[pool[swap],pool[index]];
 }
 return pool.slice(0,limit);
};
const asD1=db=>db&&typeof db.prepare==='function'?db:null;
async function loadTaxonomy(env,req){
 if(taxonomyLoadPromise)return taxonomyLoadPromise;
 taxonomyLoadPromise=(async()=>{
  const response=await env.ASSETS.fetch(new URL('/data/taxonomy.json',req.url));
  if(!response.ok)throw new Error('Taxonomy configuration unavailable');
  const data=await response.json();
  if(data?.version!==1||!Array.isArray(data.groups))throw new Error('Taxonomy configuration is invalid');
  data.categories=data.groups.flatMap(group=>(group.categories||[]).map(item=>({...item,group_slug:group.slug,group_name:group.name})));
  data.categoryBySlug=Object.fromEntries(data.categories.map(item=>[item.slug,item]));
  taxonomyConfig=data;
  data.blockedSet=new Set((data.blockedTags||[]).map(normalizeTaxonomyToken));
  data.categoryAliases=buildAliasMap(data.categories);
  data.formatAliases=buildAliasMap(data.formats||[]);
  data.orientationAliases=buildAliasMap(data.orientations||[]);
  data.languageAliases=buildAliasMap(data.languages||[]);
  categories=data.categories.map(item=>item.name);
  VISIBLE_NAV_CATEGORIES=data.categories.slice(0,6).map(item=>item.name);
  return data;
 })().catch(error=>{taxonomyLoadPromise=null;throw error});
 return taxonomyLoadPromise;
}
function normalizeTaxonomyToken(value){
 return String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
function rawTagList(value){
 const values=Array.isArray(value)?value:(typeof value==='string'?value.split(/[;,|]/):[]);
 return [...new Set(values.map(item=>{
  if(item&&typeof item==='object')return String(item.slug||item.name||item.label||item.tag||'');
  return String(item??'');
 }).map(item=>item.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,80)).filter(Boolean))].slice(0,80);
}
function hasBlockedTags(tags,taxonomy){
 const blocked=taxonomy?.blockedSet||new Set();
 return rawTagList(tags).some(tag=>{
  const normalized=normalizeTaxonomyToken(tag);
  if(!normalized)return false;
  const tokens=normalized.split(' ');
  return [...blocked].some(term=>normalized===term||tokens.includes(term));
 });
}
function buildAliasMap(items){
 const map=new Map();
 for(const item of items||[]){
  for(const alias of [item.slug,item.name,...(item.aliases||[])]){
   const key=normalizeTaxonomyToken(alias);
   if(key&&!map.has(key))map.set(key,item.slug);
  }
 }
 return map;
}
function safeRawTags(tags,taxonomy){
 return rawTagList(tags).filter(tag=>!hasBlockedTags([tag],taxonomy));
}
function mapRawTags(tags,aliasMap,taxonomy){
 return [...new Set(safeRawTags(tags,taxonomy).map(tag=>aliasMap.get(normalizeTaxonomyToken(tag))).filter(Boolean))];
}
function normalizeLanguage(value,taxonomy){
 return (taxonomy?.languageAliases||new Map()).get(normalizeTaxonomyToken(value))||'';
}
function normalizeResolution(value,taxonomy){
 const normalized=normalizeTaxonomyToken(value).replace(/\s+/g,'');
 const canonical=normalized==='2160p'?'4k':normalized;
 const allowed=new Set(taxonomy?.technical?.resolutions||[]);
 return allowed.has(canonical)?canonical:'';
}
function normalizeFrameRate(value,taxonomy){
 const n=Number(String(value??'').match(/\d{2,3}/)?.[0]);
 return (taxonomy?.technical?.frameRates||[]).includes(n)?n:null;
}
function introWordCount(value){return String(value||'').trim().split(/\s+/).filter(Boolean).length}
function indexableCategory(category,count,taxonomy){
 const words=introWordCount(category?.intro_en);
 return Number(count)>=Number(taxonomy?.indexing?.minimumPublishedVideos||MIN_INDEXABLE_CATEGORY_VIDEOS)&&
  words>=Number(taxonomy?.indexing?.minimumIntroWords||80)&&words<=Number(taxonomy?.indexing?.maximumIntroWords||120);
}
async function ensureTaxonomySchema(db,taxonomy){
 if(!db)return false;
 if(taxonomySchemaPromise)return taxonomySchemaPromise;
 taxonomySchemaPromise=(async()=>{
  const statements=[
   "CREATE TABLE IF NOT EXISTS taxonomy_categories (slug TEXT PRIMARY KEY,name TEXT NOT NULL,group_slug TEXT NOT NULL,group_name TEXT NOT NULL,intro_en TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL DEFAULT (datetime('now')))",
   "CREATE TABLE IF NOT EXISTS video_categories (video_id INTEGER NOT NULL,category_slug TEXT NOT NULL,PRIMARY KEY(video_id,category_slug),FOREIGN KEY(video_id) REFERENCES videos(id) ON DELETE CASCADE,FOREIGN KEY(category_slug) REFERENCES taxonomy_categories(slug) ON DELETE CASCADE)",
   "CREATE INDEX IF NOT EXISTS idx_video_categories_slug ON video_categories(category_slug,video_id)",
   "CREATE TABLE IF NOT EXISTS video_metadata (video_id INTEGER PRIMARY KEY,channel_id TEXT NOT NULL DEFAULT '',studio TEXT NOT NULL DEFAULT '',resolution TEXT NOT NULL DEFAULT '',frame_rate INTEGER,language TEXT NOT NULL DEFAULT '',orientation TEXT NOT NULL DEFAULT '',raw_tags_json TEXT NOT NULL DEFAULT '[]',featured INTEGER NOT NULL DEFAULT 0,FOREIGN KEY(video_id) REFERENCES videos(id) ON DELETE CASCADE)",
   "CREATE INDEX IF NOT EXISTS idx_video_metadata_filters ON video_metadata(language,resolution,frame_rate,orientation)",
   "CREATE INDEX IF NOT EXISTS idx_video_metadata_channel ON video_metadata(channel_id,studio)",
   "CREATE TABLE IF NOT EXISTS video_formats (video_id INTEGER NOT NULL,format_slug TEXT NOT NULL,PRIMARY KEY(video_id,format_slug),FOREIGN KEY(video_id) REFERENCES videos(id) ON DELETE CASCADE)",
   "CREATE INDEX IF NOT EXISTS idx_video_formats_slug ON video_formats(format_slug,video_id)",
   "CREATE TABLE IF NOT EXISTS video_views (id INTEGER PRIMARY KEY AUTOINCREMENT,video_id INTEGER NOT NULL,viewed_at TEXT NOT NULL DEFAULT (datetime('now')),FOREIGN KEY(video_id) REFERENCES videos(id) ON DELETE CASCADE)",
   "CREATE INDEX IF NOT EXISTS idx_video_views_video_date ON video_views(video_id,viewed_at)",
   "CREATE TABLE IF NOT EXISTS taxonomy_migrations (version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL DEFAULT (datetime('now')))"
  ];
  for(const statement of statements)await db.prepare(statement).run();
  for(const category of taxonomy.categories){
   await db.prepare("INSERT INTO taxonomy_categories (slug,name,group_slug,group_name,intro_en) VALUES (?,?,?,?,?) ON CONFLICT(slug) DO UPDATE SET name=excluded.name,group_slug=excluded.group_slug,group_name=excluded.group_name,intro_en=CASE WHEN trim(excluded.intro_en)<>'' THEN excluded.intro_en ELSE taxonomy_categories.intro_en END,updated_at=datetime('now')")
    .bind(category.slug,category.name,category.group_slug,category.group_name,String(category.intro_en||'')).run();
  }
  await db.prepare("INSERT OR IGNORE INTO video_metadata (video_id,channel_id,studio) SELECT id,CASE WHEN lower(provider)='adultembed' THEN 'brazzers' ELSE '' END,CASE WHEN lower(provider)='adultembed' THEN 'brazzers' ELSE '' END FROM videos").run();
  const applied=await db.prepare("SELECT version FROM taxonomy_migrations WHERE version=1").first();
  if(!applied){
   for(const category of taxonomy.categories){
    const aliases=[category.slug,category.name,...(category.aliases||[])].map(normalizeTaxonomyToken).filter(Boolean);
    if(!aliases.length)continue;
    const placeholders=aliases.map(()=>'?').join(',');
    await db.prepare("INSERT OR IGNORE INTO video_categories (video_id,category_slug) SELECT id,? FROM videos WHERE lower(trim(category)) IN ("+placeholders+")")
     .bind(category.slug,...aliases).run();
   }
   for(const format of taxonomy.formats||[]){
    const aliases=[format.slug,format.name,...(format.aliases||[])].map(normalizeTaxonomyToken).filter(Boolean);
    if(!aliases.length)continue;
    const placeholders=aliases.map(()=>'?').join(',');
    await db.prepare("INSERT OR IGNORE INTO video_formats (video_id,format_slug) SELECT id,? FROM videos WHERE lower(trim(category)) IN ("+placeholders+")")
     .bind(format.slug,...aliases).run();
   }
   await db.prepare("UPDATE video_metadata SET channel_id='brazzers',studio='brazzers' WHERE video_id IN (SELECT id FROM videos WHERE lower(trim(category))='brazzers' OR lower(provider)='adultembed')").run();
   await db.prepare("INSERT OR IGNORE INTO taxonomy_migrations(version) VALUES (1)").run();
  }
  return true;
 })().catch(error=>{taxonomySchemaPromise=null;throw error});
 return taxonomySchemaPromise;
}
async function categoryDirectory(db,taxonomy,limit=30){
 if(!db)return [];
 const result=await db.prepare("SELECT tc.slug,tc.name,tc.group_slug,tc.group_name,tc.intro_en,COUNT(DISTINCT v.id) AS count FROM taxonomy_categories tc JOIN video_categories vc ON vc.category_slug=tc.slug JOIN videos v ON v.id=vc.video_id WHERE v.status='published' AND v.rights_confirmed=1 AND v.adults_verified=1 AND v.duration_seconds>=? AND v.poster_url<>'' AND v.embed_url<>'' GROUP BY tc.slug,tc.name,tc.group_slug,tc.group_name,tc.intro_en ORDER BY count DESC,tc.name COLLATE NOCASE ASC LIMIT ?")
  .bind(MIN_VIDEO_DURATION_SECONDS,Math.max(1,Math.min(500,limit))).all();
 return (result.results||[]).map(row=>({...row,count:Number(row.count||0),seo_indexable:indexableCategory(row,row.count,taxonomy)}));
}
async function taxonomyCategoryVideos(db,category,{filters={},limit=40,offset=0}={}){
 if(!db||!category)return [];
 const params=[category.slug,'published',1,1,MIN_VIDEO_DURATION_SECONDS];
 let where="vc.category_slug=? AND v.status=? AND v.rights_confirmed=? AND v.adults_verified=? AND v.duration_seconds>=? AND v.poster_url<>'' AND v.embed_url<>''";
 if(filters.language){where+=" AND vm.language=?";params.push(filters.language)}
 if(filters.resolution){where+=" AND vm.resolution=?";params.push(filters.resolution)}
 if(filters.frame_rate){where+=" AND vm.frame_rate=?";params.push(filters.frame_rate)}
 if(filters.orientation){where+=" AND vm.orientation=?";params.push(filters.orientation)}
 if(filters.format){where+=" AND EXISTS (SELECT 1 FROM video_formats vf WHERE vf.video_id=v.id AND vf.format_slug=?)";params.push(filters.format)}
 params.push(limit,offset);
 const result=await db.prepare("SELECT v.id,v.slug,v.title,v.description,v.category,v.poster_url,v.embed_url,v.source_url,v.provider,v.duration_seconds,v.status,v.published_at FROM videos v JOIN video_categories vc ON vc.video_id=v.id LEFT JOIN video_metadata vm ON vm.video_id=v.id WHERE "+where+" ORDER BY v.published_at DESC,v.id DESC LIMIT ? OFFSET ?").bind(...params).all();
 return result.results||[];
}
async function countTaxonomyCategoryVideos(db,category,filters={}){
 if(!db||!category)return 0;
 const params=[category.slug,'published',1,1,MIN_VIDEO_DURATION_SECONDS];
 let where="vc.category_slug=? AND v.status=? AND v.rights_confirmed=? AND v.adults_verified=? AND v.duration_seconds>=? AND v.poster_url<>'' AND v.embed_url<>''";
 if(filters.language){where+=" AND vm.language=?";params.push(filters.language)}
 if(filters.resolution){where+=" AND vm.resolution=?";params.push(filters.resolution)}
 if(filters.frame_rate){where+=" AND vm.frame_rate=?";params.push(filters.frame_rate)}
 if(filters.orientation){where+=" AND vm.orientation=?";params.push(filters.orientation)}
 if(filters.format){where+=" AND EXISTS (SELECT 1 FROM video_formats vf WHERE vf.video_id=v.id AND vf.format_slug=?)";params.push(filters.format)}
 const row=await db.prepare("SELECT COUNT(DISTINCT v.id) AS total FROM videos v JOIN video_categories vc ON vc.video_id=v.id LEFT JOIN video_metadata vm ON vm.video_id=v.id WHERE "+where).bind(...params).first();
 return Number(row?.total||0);
}
async function collectionVideos(db,collection,limit=40){
 if(!db)return [];
 const params=['published',1,1,MIN_VIDEO_DURATION_SECONDS];
 let order="v.published_at DESC,v.id DESC",where="v.status=? AND v.rights_confirmed=? AND v.adults_verified=? AND v.duration_seconds>=? AND v.poster_url<>'' AND v.embed_url<>''";
 if(collection==='featured')where+=" AND vm.featured=1";
 if(collection==='trending')order="(SELECT COUNT(*) FROM video_views vv WHERE vv.video_id=v.id AND vv.viewed_at>=datetime('now','-7 days')) DESC,v.published_at DESC";
 if(collection==='most-viewed')order="(SELECT COUNT(*) FROM video_views vv WHERE vv.video_id=v.id) DESC,v.published_at DESC";
 const result=await db.prepare("SELECT v.id,v.slug,v.title,v.description,v.category,v.poster_url,v.embed_url,v.source_url,v.provider,v.duration_seconds,v.status,v.published_at FROM videos v LEFT JOIN video_metadata vm ON vm.video_id=v.id WHERE "+where+" ORDER BY "+order+" LIMIT ?")
  .bind(...params,limit).all();
 return result.results||[];
}
async function collectionCounts(db,collection){
 if(!db)return 0;
 const where=collection==='featured'?" AND vm.featured=1":'';
 const order=collection==='trending'?" AND vv.viewed_at>=datetime('now','-7 days)":'';
 const row=await db.prepare("SELECT COUNT(DISTINCT v.id) AS total FROM videos v LEFT JOIN video_metadata vm ON vm.video_id=v.id LEFT JOIN video_views vv ON vv.video_id=v.id WHERE v.status='published' AND v.rights_confirmed=1 AND v.adults_verified=1 AND v.duration_seconds>=? AND v.poster_url<>'' AND v.embed_url<>''"+where+order)
  .bind(MIN_VIDEO_DURATION_SECONDS).first();
 return Number(row?.total||0);
}

function channelDisplayName(value){
 return String(value||'').split(/[-_\s]+/).filter(Boolean).map(part=>part.length<=3?part.toUpperCase():part[0].toUpperCase()+part.slice(1)).join(' ')||'Publisher channel';
}
async function channelDirectory(db,limit=100){
 if(!db)return [];
 const result=await db.prepare("SELECT source.slug,MAX(source.studio) AS studio,COUNT(DISTINCT source.video_id) AS count FROM (SELECT vm.channel_id AS slug,vm.studio AS studio,v.id AS video_id FROM video_metadata vm JOIN videos v ON v.id=vm.video_id WHERE vm.channel_id<>'' AND v.status='published' AND v.rights_confirmed=1 AND v.adults_verified=1 AND v.duration_seconds>=? AND v.poster_url<>'' AND v.embed_url<>'' UNION ALL SELECT vm.studio AS slug,vm.studio AS studio,v.id AS video_id FROM video_metadata vm JOIN videos v ON v.id=vm.video_id WHERE vm.studio<>'' AND vm.studio<>vm.channel_id AND v.status='published' AND v.rights_confirmed=1 AND v.adults_verified=1 AND v.duration_seconds>=? AND v.poster_url<>'' AND v.embed_url<>'') source GROUP BY source.slug ORDER BY count DESC,source.slug ASC LIMIT ?")
  .bind(MIN_VIDEO_DURATION_SECONDS,MIN_VIDEO_DURATION_SECONDS,Math.max(1,Math.min(500,limit))).all();
 return (result.results||[]).map(row=>({slug:String(row.slug||''),name:channelDisplayName(row.studio||row.slug),count:Number(row.count||0)})).filter(row=>row.slug);
}
async function taxonomyChannelVideos(db,slug,{limit=40,offset=0,q='',sort='recent'}={}){
 if(!db||!slug)return [];
 const params=[slug,slug,'published',1,1,MIN_VIDEO_DURATION_SECONDS];
 let where="(vm.channel_id=? OR vm.studio=?) AND v.status=? AND v.rights_confirmed=? AND v.adults_verified=? AND v.duration_seconds>=? AND v.poster_url<>'' AND v.embed_url<>''";
 if(q){where+=" AND (v.title LIKE ? OR v.description LIKE ?)";const match=`%${q}%`;params.push(match,match)}
 let order="v.published_at DESC,v.id DESC";
 if(sort==='popular')order="(SELECT COUNT(*) FROM video_views vv WHERE vv.video_id=v.id) DESC,v.published_at DESC,v.id DESC";
 params.push(limit,offset);
 const result=await db.prepare("SELECT v.id,v.slug,v.title,v.description,v.category,v.poster_url,v.embed_url,v.source_url,v.provider,v.duration_seconds,v.status,v.published_at FROM videos v JOIN video_metadata vm ON vm.video_id=v.id WHERE "+where+" ORDER BY "+order+" LIMIT ? OFFSET ?").bind(...params).all();
 return result.results||[];
}
async function countTaxonomyChannelVideos(db,slug,q=''){
 if(!db||!slug)return 0;
 const params=[slug,slug,'published',1,1,MIN_VIDEO_DURATION_SECONDS];
 let where="(vm.channel_id=? OR vm.studio=?) AND v.status=? AND v.rights_confirmed=? AND v.adults_verified=? AND v.duration_seconds>=? AND v.poster_url<>'' AND v.embed_url<>''";
 if(q){where+=" AND (v.title LIKE ? OR v.description LIKE ?)";const match=`%${q}%`;params.push(match,match)}
 const row=await db.prepare("SELECT COUNT(DISTINCT v.id) AS total FROM videos v JOIN video_metadata vm ON vm.video_id=v.id WHERE "+where).bind(...params).first();
 return Number(row?.total||0);
}
function taxonomyChannelPage({base,url,channel,videos,total,q='',sort='recent'}){
 const canonical=base+'/channels/'+encodeURIComponent(channel.slug);
 const filtered=url.searchParams.toString().length>0;
 const canIndex=Number(total)>=MIN_INDEXABLE_CATEGORY_VIDEOS&&!filtered;
 const cards=videos.length?videos.map(card).join(''):'<div class="empty"><strong>No approved videos for this channel yet</strong><p>Only published videos with approved rights and verified adult participation appear here.</p></div>';
 const body='<section class="wrap page-head"><div class="section-kicker"><a href="/channels">Channels</a></div><h1>'+esc(channel.name)+' Videos</h1><p>Approved publisher listings from '+esc(channel.name)+' on Noxvellox.</p><p>'+Number(total).toLocaleString('en-US')+' approved videos</p></section><section class="wrap"><form class="taxonomy-filters" method="get" action=""><label>Search this channel<input name="q" value="'+esc(q)+'" maxlength="80" placeholder="Search titles"></label><label>Sort<select name="sort"><option value="recent"'+(sort==='recent'?' selected':'')+'>Most recent</option><option value="popular"'+(sort==='popular'?' selected':'')+'>Most viewed</option></select></label><button class="button" type="submit">Apply</button></form><div class="video-grid">'+cards+'</div>'+adSlot()+'</section>';
 return shell({base,url:url.href,title:channel.name+' Videos | Noxvellox',description:'Browse approved videos from '+channel.name+' on Noxvellox.',canonical,robots:canIndex?'index,follow':'noindex,follow',body});
}
function publishedArticle(v,base){const url=v.official?`${base}/official-watch/${encodeURIComponent(v.slug)}`:`${base}/watch/${encodeURIComponent(v.slug)}`;return { '@context':'https://schema.org','@type':'VideoObject',name:v.title,description:v.description||v.title,thumbnailUrl:isHttpsUrl(v.poster_url)?v.poster_url:undefined,embedUrl:isHttpsUrl(v.embed_url)?v.embed_url:undefined,uploadDate:v.published_at?`${v.published_at.replace(' ','T')}Z`:undefined,duration:v.duration_seconds?`PT${Math.floor(v.duration_seconds/60)}M${v.duration_seconds%60}S`:undefined,isFamilyFriendly:false,isAccessibleForFree:true,url};}
function homePage({base,url,videos,official=[]}){
  const hero=`<section class="wrap hero"><div class="hero-copy"><div class="eyebrow">A new world after dark</div><h1>Stay curious.<br><em>Explore more.</em></h1><p>Discover a thoughtfully organized adults-only video catalog featuring authorized content, fresh collections, and effortless navigation.</p><div class="actions"><a class="button" href="/videos">Explore videos </a><a class="button ghost" href="/categories">Browse categories</a></div><div class="meta-strip"><span>Adults only</span><span>Curated collections</span><span>Independent catalog</span></div></div><div class="hero-art" aria-hidden="true"><div class="hero-mark">N<small>18+</small></div></div></section>`;
  const cats=`<section class="section wrap"><div class="section-head"><div><div class="section-kicker">Find your favorite</div><h2>Explore categories</h2></div><a href="/categories" class="section-link">See all categories ?</a></div>${categoryChips()}</section>`;
  const latest=`<section class="section wrap"><div class="section-head"><div><div class="section-kicker">Curated for you</div><h2>Latest releases</h2></div><a href="/videos" class="section-link">View all videos ?</a></div><div class="video-grid">${videos.length?videos.map(card).join(''):emptyMarkup}</div></section>`;
  const structured={'@context':'https://schema.org','@type':'WebSite',name:SITE,url:base,inLanguage:'en-US',description:'Noxvellox is an independent adults-only video catalog featuring authorized third-party content and organized collections.'};
  return shell({title:'Noxvellox | Discover Free Adult Video Collections',description:'Explore Noxvellox, a free adults-only video catalog with curated categories, new releases and authorized video content.',body:hero+cats+(videos.length?latest:officialGrid(official.slice(0,12),'Latest official free embeds'))+`<div class="wrap">${adSlot()}${banner}</div>`,base,url,structured});
}
const homeDisplayTitle=v=>normalizeImportedTitle(v?.title)||safeText(v?.title||'Untitled video',140)||'Untitled video';
const homeCardV3=(v,isOfficial=false)=>{const slug=encodeURIComponent(v.slug||v.id||'');const title=homeDisplayTitle(v);const href=isOfficial||v.official?`/official-watch/${slug}`:`/watch/${slug}`;return `<a class="home-video-card" href="${href}"><div class="home-video-art">${coverMarkup(v.poster_url,title,'Video preview',v.embed_url)}<span class="home-quality">HD</span>${v.duration_seconds?`<span class="duration">${duration(v.duration_seconds)}</span>`:''}</div><div class="home-video-meta"><h3>${esc(title)}</h3><div class="home-video-source">${esc(isOfficial?'Official embed':(v.category||'Noxvellox collection'))}</div></div></a>`};
const homeChannelCardV3=ch=>`<a class="home-channel-card" href="/channels/${encodeURIComponent(ch.slug)}"><div class="home-channel-avatar">${esc(ch.name.slice(0,1))}</div><div class="home-channel-copy"><strong>${esc(ch.name)}</strong><span>${esc(ch.eyebrow)}</span><small>${ch.category==='Brazzers'?'Verified listings only':'Curated channel'}</small></div><span class="home-channel-arrow" aria-hidden="true">></span></a>`;
function homePageV3({base,url,videos,official=[],partners,categoryList=[]}){
 const recent=[...videos.map(v=>({...v,__official:false})),...official.map(v=>({...v,__official:true}))].slice(0,8);

 const categoryTiles=categoryList.slice(0,12).map(c=>{const meta=categoryMetaV2[c.name]||categoryMetaV2.Collections||{};return '<a class="home-category-card" href="/category/'+encodeURIComponent(c.slug)+'"><div class="home-category-art"><img src="'+esc(meta.cover||'')+'" loading="lazy" decoding="async" data-category-image alt="'+esc(c.name)+' category cover"><div class="home-category-shade"></div><span class="home-category-icon" aria-hidden="true">✦</span></div><div class="home-category-copy"><strong>'+esc(c.name)+'</strong><br><small>'+Number(c.count).toLocaleString('en-US')+' videos</small></div></a>'}).join('')||'<div class="empty"><strong>No published categories yet</strong><p>Categories appear after approved videos include publisher-supplied tags.</p></div>';
 const channelTiles=partners.slice(0,6).map(partnerTile).join('');
 const recentMarkup=recent.length?recent.map(v=>homeCardV3(v,v.__official===true)).join(''):`<div class="empty"><strong>No recent public videos yet</strong><p>Approved listings will appear here automatically.</p></div>`;
 const sidebar=`<aside class="home-sidebar"><div class="home-sidebar-brand"><span class="home-sidebar-mark">N</span><strong>NOXVELLOX</strong></div><nav aria-label="Quick navigation"><a class="active" href="/"><span></span>Home</a><a href="/videos"><span aria-hidden="true">▶</span>Videos</a><a href="/categories"><span aria-hidden="true">▦</span>Categories</a><a href="/channels"><span aria-hidden="true">♙</span>Channels</a><a href="/channels"><span aria-hidden="true">♡</span>Following</a></nav><div class="home-sidebar-rule"></div><div class="home-sidebar-label">Explore</div><nav aria-label="Explore navigation"><a href="/trending"><span aria-hidden="true">↗</span>Trending</a><a href="/new-releases"><span aria-hidden="true">✦</span>New releases</a><a href="/most-viewed"><span aria-hidden="true">◉</span>Most viewed</a><a href="/about"><span aria-hidden="true">✉</span>Support</a></nav></aside>`;
 const body=`<div class="home-dashboard"><div class="home-dashboard-layout">${sidebar}<div class="home-dashboard-main">${partnerCarousel(partners)}<section class="home-dashboard-columns home-dashboard-columns-single" style="grid-template-columns:minmax(0,1fr)"><div class="home-dashboard-content"><section class="home-dashboard-section"><div class="home-section-heading"><div><span class="home-section-icon" aria-hidden="true">▦</span><div><h2>Categories</h2><p>Browse the site's main topics and collections.</p></div></div><a href="/categories">View all <span>></span></a></div><div class="home-category-grid">${categoryTiles}</div></section><section class="home-dashboard-section"><div class="home-section-heading"><div><span class="home-section-icon pink" aria-hidden="true">♙</span><div><h2>Channels</h2><p>Follow publishers and collections organized by source.</p></div></div><a href="/channels">View all <span>></span></a></div><div class="nv-channel-grid">${channelTiles}</div></section><section class="home-dashboard-section"><div class="home-section-heading"><div><span class="home-section-icon" aria-hidden="true">▶</span><div><h2>Recent videos</h2><p>Browse the latest available releases.</p></div></div><a href="/videos">View all <span>></span></a></div><div class="home-video-grid" data-infinite-grid data-infinite-source="/videos">${recentMarkup}${adSlot('feed')}</div></section></div></section></div></div></div>`;
 const structured={'@context':'https://schema.org','@type':'WebSite',name:SITE,url:base,inLanguage:'en',description:'Noxvellox is an independent adult video catalog organized by categories and channels.'};
 return shell({title:'Noxvellox | Discover Free Adult Video Collections | Explore your way',description:'Explore adult videos by category and channel on Noxvellox.',body,base,url,structured});
}
function officialPagination({page,total}){
 const maxPages=Math.max(1,Math.ceil(total/OFFICIAL_PAGE_SIZE));
 if(maxPages<=1)return '';
 const prev=page>1?`<a class="button ghost" href="/official-videos?page=${page-1}"> Previous</a>`:'';
 const next=page<maxPages?`<a class="button ghost" href="/official-videos?page=${page+1}">Next page </a>`:'';
 return `<nav class="wrap" aria-label="Official catalog pages" style="display:flex;justify-content:center;align-items:center;gap:12px;padding:20px"><span>Page ${page} of ${maxPages}  ·  ${total} saved official embeds</span>${prev}${next}</nav>`;
}
function catalogPagination({page,total,path='/videos',label='videos'}){
  const maxPages=Math.max(1,Math.ceil(Number(total||0)/OFFICIAL_PAGE_SIZE));
  if(maxPages<=1)return '';
  const prev=page>1?`<a class="button ghost" href="${path}?page=${page-1}" rel="prev">Previous</a>`:'';
  const next=page<maxPages?`<a class="button ghost" href="${path}?page=${page+1}" rel="next">Next page</a>`:'';
  return `<nav class="wrap" aria-label="Catalog pages" style="display:flex;justify-content:center;align-items:center;gap:12px;padding:20px;flex-wrap:wrap"><span>Page ${page} of ${maxPages} - ${total} ${esc(label)}</span>${prev}${next}</nav>`;
}
async function countPublishedVideos(db){
  if(!db)return 0;
  try{
    const row=await db.prepare("SELECT COUNT(*) AS total FROM videos WHERE status='published'").first();
    return Number(row?.total||0);
  }catch{return 0}
}
function listPage({url,base,videos,official=[],title='All videos',subtitle='Browse our collection of authorized videos.',category='',officialPagination='',page=1,infinite=false,robots=''}){
  const pageNumber=Math.max(1,Number(page)||1),pageSuffix=pageNumber>1?` - Page ${pageNumber}`:'',metaDescription=pageNumber>1?`${subtitle} Page ${pageNumber} of the catalog.`:subtitle;
  const feedItems=videos.length?videos.map(card):official.map(officialCard);
  const renderedFeed=infinite&&feedItems.length>12?`${feedItems.slice(0,12).join('')}${adSlot('feed')}${feedItems.slice(12).join('')}`:feedItems.join('');
  const body=`<section class="wrap page-head"><div class="section-kicker">Noxvellox library</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></section><section class="wrap">${categoryChips(category)}<div class="section" style="margin-top:25px"><div class="video-grid"${infinite?' data-infinite-grid':''}>${renderedFeed||(title==='Free Official Embeds'?'<div class="empty"><strong>Official provider feed temporarily unavailable</strong><p>Please try later. No placeholder videos or unverified embeds will be published.</p></div>':emptyMarkup)}</div>${official.length?(official[0]?.from_snapshot?'<p class="mini"><strong>Contingency catalog:</strong> last observed in the provider official RSS on November 22, 2026. This is NOT a live availability check. Entries may have been removed; playback and rights remain subject to provider policy. No video files are hosted here.</p>':'<p class="mini">Free embeds from the official platform RSS. Video files are not stored on Noxvellox; some content may be region-restricted.</p>'):''}</div>${officialPagination}${infinite?'':adSlot()}</section>`;
  return shell({title:`${title}${pageSuffix} | Noxvellox`,description:metaDescription,base,url,body,robots:robots||(pageNumber>10?'noindex,follow':undefined)});
}
function taxonomyFilters(url,taxonomy){
 const raw={language:url.searchParams.get('lang'),resolution:url.searchParams.get('res'),frameRate:url.searchParams.get('fps'),format:url.searchParams.get('format'),orientation:url.searchParams.get('orientation')};
 const filters={};
 const language=normalizeLanguage(raw.language,taxonomy);if(language)filters.language=language;
 const resolution=normalizeResolution(raw.resolution,taxonomy);if(resolution)filters.resolution=resolution;
 const frameRate=normalizeFrameRate(raw.frameRate,taxonomy);if(frameRate)filters.frame_rate=frameRate;
 const format=(taxonomy.formatAliases||new Map()).get(normalizeTaxonomyToken(raw.format));if(format)filters.format=format;
 const orientation=(taxonomy.orientationAliases||new Map()).get(normalizeTaxonomyToken(raw.orientation));if(orientation)filters.orientation=orientation;
 return filters;
}
function taxonomyFilterForm(taxonomy,filters){
 const select=(name,label,items,selected)=>'<label>'+label+'<select name="'+name+'"><option value="">All</option>'+items.map(item=>{const value=item.slug||item.value;return '<option value="'+esc(value)+'"'+(String(selected||'')===String(value)?' selected':'')+'>'+esc(item.name)+'</option>'}).join('')+'</select></label>';
 const resolutions=(taxonomy.technical?.resolutions||[]).map(value=>({value,name:value.toUpperCase()}));
 const frameRates=(taxonomy.technical?.frameRates||[]).map(value=>({value:String(value),name:String(value)+' FPS'}));
 return '<form class="taxonomy-filters" method="get" action=""><label>Language<select name="lang"><option value="">All</option>'+(taxonomy.languages||[]).map(item=>'<option value="'+esc(item.slug)+'"'+(filters.language===item.slug?' selected':'')+'>'+esc(item.name)+'</option>').join('')+'</select></label>'+
  select('res','Resolution',resolutions,filters.resolution)+
  select('fps','Frame rate',frameRates,filters.frame_rate)+
  '<label>Format<select name="format"><option value="">All</option>'+(taxonomy.formats||[]).map(item=>'<option value="'+esc(item.slug)+'"'+(filters.format===item.slug?' selected':'')+'>'+esc(item.name)+'</option>').join('')+'</select></label>'+
  '<label>Orientation<select name="orientation"><option value="">All</option>'+(taxonomy.orientations||[]).map(item=>'<option value="'+esc(item.slug)+'"'+(filters.orientation===item.slug?' selected':'')+'>'+esc(item.name)+'</option>').join('')+'</select></label>'+
  '<button class="button" type="submit">Apply filters</button></form>';
}
function taxonomyCategoryPage({base,url,category,videos,total,taxonomy,filters}){
 const filtered=url.searchParams.toString().length>0;
 const words=introWordCount(category.intro_en);
 const canIndex=indexableCategory(category,total,taxonomy)&&!filtered;
 const intro=canIndex?'<p class="category-intro">'+esc(category.intro_en)+'</p>':'<p class="category-intro">This collection is being curated. Only approved videos with publisher-supplied category tags are shown.</p>';
 const cards=videos.length?videos.map(card).join(''):'<div class="empty"><strong>No videos match this category yet</strong><p>Try another filter or browse all categories.</p><a class="button ghost" href="/categories">Browse categories</a></div>';
 const description=canIndex?String(category.intro_en).replace(/\s+/g,' ').slice(0,155):'Browse approved videos in the '+category.name+' category on Noxvellox.';
 const title=category.name+' Videos | Noxvellox';
 const body='<section class="wrap page-head"><div class="section-kicker"><a href="/categories">Categories</a> / '+esc(category.group_name)+'</div><h1>'+esc(category.name)+' Videos</h1>'+intro+'<p>'+Number(total).toLocaleString('en-US')+' approved videos</p></section>'+
  '<section class="wrap">'+taxonomyFilterForm(taxonomy,filters)+'<div class="video-grid">'+cards+'</div>'+adSlot()+'</section>';
 return shell({base,url,title,description,canonical:base+'/category/'+encodeURIComponent(category.slug),robots:canIndex?'index,follow':'noindex,follow',body});
}
function collectionPage({base,url,collection,videos,total}){
 const meta={
  featured:{name:'Featured',description:'Editorially selected videos approved for the Noxvellox catalog.'},
  trending:{name:'Trending',description:'Videos with the most views during the last seven days.'},
  'new-releases':{name:'New Releases',description:'Recently published videos with verified metadata.'},
  'most-viewed':{name:'Most Viewed',description:'Videos ranked by recorded views.'}
 }[collection];
 const cards=videos.length?videos.map(card).join(''):'<div class="empty"><strong>No videos in this collection yet</strong><p>This list updates from published catalog data.</p></div>';
 const body='<section class="wrap page-head"><div class="section-kicker">Noxvellox collections</div><h1>'+esc(meta.name)+'</h1><p>'+esc(meta.description)+'</p><p>'+Number(total).toLocaleString('en-US')+' videos</p></section><section class="wrap"><div class="video-grid">'+cards+'</div>'+adSlot()+'</section>';
 return shell({base,url,title:meta.name+' | Noxvellox',description:meta.description,robots:'noindex,follow',body});
}
function searchPage({url,base,q,videos,official=[],channels=[],matchedCategories=[]}){
 const cards=[...videos.map(card),...official.map(officialCard)];
 const taxonomy=(channels.length||matchedCategories.length)?`<section class="search-discovery" aria-label="Related channels and categories"><div class="search-discovery-head"><div><div class="section-kicker">Explore by source or interest</div><h2>Related results</h2></div></div><div class="search-entity-grid">${channels.map(ch=>`<a class="search-entity" href="/channels/${encodeURIComponent(ch.slug)}"><span>Channel</span><strong>${esc(ch.name)}</strong><small>${esc(ch.eyebrow||'Curated channel')}</small></a>`).join('')}${matchedCategories.map(category=>`<a class="search-entity" href="/category/${slugify(category)}"><span>Category</span><strong>${esc(category)}</strong><small>${esc(categoryDescriptions[category]||'Browse this collection')}</small></a>`).join('')}</div></section>`:'';
 const body=`<section class="wrap page-head"><div class="section-kicker">Noxvellox search</div><h1>Search: ${esc(q||'Videos')}</h1><p>Results across published videos, official embeds, channels and categories.</p></section><section class="wrap">${taxonomy}<div class="section" style="margin-top:25px"><div class="video-grid">${cards.length?cards.join(''):`<div class="empty"><strong>No matching videos found</strong><p>Try another title, performer, channel or category name.</p></div>`}</div>${official.length?'<p class="mini">Official embeds are linked to the original provider; no video files are hosted by Noxvellox.</p>':''}</div>${adSlot()}</section>`;
  return shell({title:`Search: ${q||'Videos'} | Noxvellox`,description:`Search Noxvellox videos and official embeds for ${q||'videos'}.`,base,url,body,robots:'noindex,follow'});
}
function watchPage({url,base,v,related,relatedCard=card,env}){
  const embed=allowedEmbed(v.embed_url,env);
  const poster=isHttpsUrl(v.poster_url)?v.poster_url:'';
  const legacyPreRoll=embed?`<div class="pre-roll-overlay" data-pre-roll data-pre-roll-seconds="15" hidden><div class="pre-roll-card"><div class="ad-label">Advertisement  ·  Pre-roll</div><div class="pre-roll-container" data-preroll-container data-script-src="${ADSTERRA_NATIVE_SRC}"></div><p>Sponsored message. Video unlocks in <strong data-pre-roll-countdown>15</strong>s.</p><button class="button ghost" type="button" data-pre-roll-continue disabled>Continue to video</button></div></div>`:'';
  const vast=embed?prerollVastUrl(env):'';
  const EXOCLICK_VIDEO_SLIDER_ZONE_ID='6104386';
  const EXOCLICK_VIDEO_SLIDER_SRC='https://a.magsrv.com/ad-provider.js';
  const sliderMarkup=v.official?'<div data-exoclick-video-slider data-zoneid="'+EXOCLICK_VIDEO_SLIDER_ZONE_ID+'" data-src="'+EXOCLICK_VIDEO_SLIDER_SRC+'" aria-hidden="true"><ins class="eas6a97888e31" data-zoneid="'+EXOCLICK_VIDEO_SLIDER_ZONE_ID+'"></ins></div>':'';
  const clickPlayOverlay=v.official&&embed?'<div class="click-play-overlay" data-click-play-overlay data-vast-play-overlay data-vast-endpoint="'+(vast?'/api/pre-roll-vast':'')+'" data-vast-skip-seconds="5" role="dialog" aria-label="Video advertisement before playback" style="position:absolute;inset:0;z-index:9;overflow:hidden;background:#000">'+
    '<div class="vast-instream-stage" style="position:absolute;inset:0;background:#000">'+
      '<video data-vast-video muted playsinline preload="auto" aria-label="Sponsored video advertisement" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000"></video>'+
      '<div style="position:absolute;top:12px;left:12px;z-index:3;padding:6px 9px;border-radius:3px;background:#0009;color:#fff;font:700 10px/1.1 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase">Advertisement</div>'+
      '<a data-vast-cta hidden href="#" target="_blank" rel="noopener noreferrer" style="position:absolute;right:0;bottom:58px;z-index:4;display:flex;flex-direction:column;gap:3px;min-width:135px;padding:12px 15px;background:#080808d9;color:#fff;text-decoration:none;font:700 14px/1.1 Arial,sans-serif"><span>↗ Visit now!</span><small data-vast-domain style="color:#ffca28;font-size:11px;font-weight:600">Sponsored</small></a>'+
      '<button type="button" data-vast-mute aria-label="Unmute advertisement" style="position:absolute;left:12px;bottom:13px;z-index:4;width:34px;height:34px;border:0;border-radius:50%;background:#000b;color:#fff;font-size:17px;cursor:pointer">🔇</button>'+
      '<button class="vast-skip-button" type="button" data-vast-skip data-click-play disabled style="position:absolute;right:12px;bottom:12px;z-index:4;min-width:118px;min-height:38px;padding:8px 13px;border:0;border-radius:3px;background:#050505cc;color:#fff;font:700 13px/1 Arial,sans-serif;cursor:not-allowed">Skip in 5</button>'+
      '<div data-vast-progress style="position:absolute;right:0;bottom:0;left:0;z-index:4;height:3px;background:#ffffff45"><span data-vast-progress-bar style="display:block;width:0;height:100%;background:#ffd400"></span></div>'+
      '<p data-vast-status aria-live="polite" style="position:absolute;top:12px;right:12px;z-index:3;margin:0;color:#fff;font:11px/1 Arial,sans-serif;text-shadow:0 1px 2px #000">'+(vast?'Loading video advertisement...':'Video ad is not configured yet.')+'</p>'+
    '</div>'+
  '</div>': '';
  const midRoll=embed?`<div class="mid-roll-overlay" data-mid-roll hidden><div class="mid-roll-card"><div class="ad-label">Advertisement  ·  Sponsored break</div><div class="mid-roll-container" data-mid-roll-container data-script-src="${ADSTERRA_NATIVE_SRC}"></div><p>Sponsored placement after 15 seconds in the player.</p><button class="button ghost" type="button" data-mid-roll-close>Continue to video</button></div></div>`:'';
  const preRoll=!v.official&&embed&&vast?`<div class="pre-roll-overlay" data-pre-roll data-vast-endpoint="${vast?'/api/pre-roll-vast':''}" hidden><div class="pre-roll-card"><div class="ad-label">Advertisement  ·  Video pre-roll</div><div class="pre-roll-media" data-pre-roll-media hidden></div><div class="pre-roll-container" data-preroll-container><span data-pre-roll-status>${vast?'Loading sponsored video...':'Video pre-roll is not configured yet.'}</span></div><p data-pre-roll-copy>${vast?'The video will start after the sponsored message.':'The video starts normally while the video-ad tag is being configured.'}</p><button class="button ghost" type="button" data-pre-roll-continue hidden>Continue to video</button></div></div>`:'';
  const player=`<div class="player ${embed&&vast?'has-pre-roll':''}" data-player>${coverMarkup(poster,v.title,'Video preview')}${clickPlayOverlay}${sliderMarkup}${embed?`<iframe data-embed-url="${esc(embed)}" loading="lazy" title="${esc(v.title)} video player" allow="autoplay; fullscreen *; encrypted-media; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen webkitallowfullscreen mozallowfullscreen></iframe>`:`<div class="notice" style="z-index:2">${v.embed_blocked?'This provider does not allow this video to play on other sites.':'Embedded playback is not enabled for this source.'} <a href="${esc(v.source_url)}" target="_blank" rel="noopener noreferrer">${v.embed_blocked?'Watch on original provider':'View original source'} →</a></div>`}${embed?'<button class="player-fullscreen" data-player-fullscreen type="button" aria-label="Fullscreen" title="Fullscreen">⛶</button>':''}${embed?`<div class="player-source-fallback" data-player-fallback hidden role="status" style="position:absolute;left:16px;right:16px;bottom:16px;z-index:8;padding:12px 14px;border:1px solid #76505d;border-radius:12px;background:#151019f2;color:#efe7ec;font-size:12px"><strong>Official source unavailable</strong><p style="margin:5px 0 8px;color:#c8bdc6">The provider did not allow playback at this time.</p><a href="${esc(v.source_url)}" target="_blank" rel="noopener noreferrer">Open official source</a></div>`:''}${preRoll}</div>`;
  const desc=v.description?`<p>${esc(v.description)}</p>`:'<p>Video details and original-source information.</p>';
  const body=`<section class="wrap page-head" style="padding-bottom:10px"><div class="section-kicker">Noxvellox / ${esc(v.category)}</div></section><section class="wrap watch-layout"><div>${player}<div class="watch-head"><h1>${esc(v.title)}</h1><div class="detail-row">${esc(v.category)}${v.duration_seconds?`  ·  ${duration(v.duration_seconds)}`:''}  ·  Provider: ${esc(v.provider)}</div>${desc}<div class="notice player-help"><strong>Playback not working?</strong> ${v.embed_blocked?'The original provider limits this video to playback on its own site. Use the button in the player to open it there.':v.provider==='cloudflare-stream'?'This video uses a separately hosted Cloudflare Stream player. If unavailable, check encoding readiness, delivery permissions and billing in your Stream dashboard.':'This video is hosted by an independent provider. If it says "Video unavailable", playback cannot be fixed here. Report the broken listing to the publisher; do not click suspicious third-party ads.'}</div><p class="mini">Source: <a href="${esc(v.source_url)}" target="_blank" rel="noopener noreferrer">Original provider ?</a></p></div>${adSlot()}</div><aside><div class="section-head"><div><div class="section-kicker">Keep exploring</div><h2 style="font-size:24px">Related videos</h2></div></div><div class="video-grid" data-related-grid style="grid-template-columns:1fr">${related.length?related.map((item,index)=>`<div data-related-candidate${index>=4?' hidden':''}>${card(item)}</div>`).join(''):emptyMarkup}</div></aside></section>`;
  const canMark=Boolean(embed&&v.published_at&&isHttpsUrl(v.poster_url)&&Number(v.duration_seconds)>0);
  const viewTracker=v.official?'':'<script>document.addEventListener("DOMContentLoaded",function(){const slug='+JSON.stringify(String(v.slug||''))+';const key="noxvellox-view:"+slug;const record=function(){try{if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,"yes")}catch{}fetch("/api/record-view",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({slug:slug}),keepalive:true}).catch(function(){})};const gate=document.querySelector("[data-age-gate]");if(gate){gate.querySelector("[data-age-confirm]")?.addEventListener("click",record,{once:true})}else record()},{once:true})</script>';
  return shell({title:`${v.title} | Noxvellox`,description:(v.official?`Official video listing: ${v.title}. Check the original provider for playback availability.`:(v.description||`${v.title}. Watch authorized content with source attribution on Noxvellox.`)).slice(0,160),base,url,body:body+viewTracker,preview:poster,structured:canMark?publishedArticle(v,base):undefined,ogType:'video.other'});
}
function staticPage({name,url,base,contact}){
  let title='',content='',cta='/videos',ctaLabel='Explore videos';
  switch(name){
    case 'about':title='About Noxvellox';content=`<p>Noxvellox is an independent, adults-only catalog for browsing legal and authorized video content. We organize collections and direct visitors to original rights holders or authorized embedded players.</p><h2>Our publishing approach</h2><p>Only sources with permission to embed or distribute content are eligible for publication. Imported records remain subject to source, rights, adult-participation and playback review. We do not claim ownership of third-party videos and do not host files that belong to external providers.</p><h2>Transparent experience</h2><p>Our goal is straightforward navigation, clear source attribution, readable reporting and a safe experience for adults. External players may change or become unavailable because the original provider controls them.</p>`;break;
    case 'privacy':title='Privacy notice';content=`<p>Noxvellox is an independent adults-only catalog. This notice explains the limited data used to operate the site, remember choices and load optional analytics and advertising.</p><h2>Necessary storage</h2><p>We use session storage to remember the age acknowledgement and local storage to remember analytics, optional advertising and channel-follow choices on this browser. Publisher access may use strictly necessary authentication cookies. The age acknowledgement is not a substitute for identity-based age verification where local law requires it.</p><h2>Optional Google Analytics</h2><p>Google Analytics measurement is off unless you choose to allow it through the entry-screen choice or the analytics consent banner. If allowed, Google may receive page-view, browser, device and interaction information to measure site use under Google's own privacy terms. If you decline, the analytics script is not loaded.</p><h2>Optional third-party advertising</h2><p>Advertising is off by default. If you choose <strong>Allow optional advertisements</strong>, Adsterra and its delivery partners may receive device, browser, approximate location and interaction information needed to serve or measure an advertisement. Their processing is governed by their own notices. If you decline, the catalog remains available and the advertising script is not loaded.</p><h2>Catalog view counts</h2><p>After a visitor confirms playback, Noxvellox records the video ID and event time to calculate popularity lists. This counter record does not contain a Noxvellox account or browser identifier.</p><h2>Your choices</h2><p>Use <strong>Analytics preferences</strong> and <strong>Ad preferences</strong> in the footer to change these choices on this browser. Withdrawing consent stops future optional loads; it cannot erase information already processed by a third party. You can also clear browser storage or use browser privacy controls.</p><h2>Copyright and safety</h2><p>We do not request intimate images, passwords, payment data or identity documents in an initial report. Reports involving minors, non-consensual material or unlawful content are prioritized for review and may be disabled while investigated.</p><h2>Contact</h2><p>For privacy requests, use the <a href="/contact">Contact page</a>.</p>`;break;
    case 'terms':title='Terms of use';content=`<p>Noxvellox is intended exclusively for adults aged 18 or older, or the higher age required by local law. Do not access the service where adult content is prohibited.</p><h2>Authorized use</h2><p>Visitors may browse public catalog pages and follow links or embeds only for lawful personal use. Do not scrape, copy, redistribute, bypass access controls, upload material, or submit a source unless you have the required rights and verified adult participation.</p><h2>Safety and reporting</h2><p>We do not permit material involving minors, non-consensual intimate content, exploitation, threats or unlawful activity. A listing may be hidden while a rights, safety, consent or availability report is reviewed.</p><h2>Sources and records</h2><p>Noxvellox is a catalog and embed service, not the producer of third-party media. It does not claim ownership of material supplied by an external publisher. For any original material published by the operator, legally required age, identity and consent records must be maintained by the responsible producer or record custodian. Third-party providers remain responsible for their own records and compliance.</p><h2>Availability and advertising</h2><p>External players can change, restrict regions or become unavailable. Optional advertising is loaded only after the visitor chooses to allow it. External providers control their own accounts, subscriptions and payment systems.</p><h2>Contact</h2><p>For copyright, privacy, safety or technical reports, use the <a href="/contact">Contact page</a>.</p>`;break;
    case 'copyright':title='Copyright & content removal';cta='/contact';ctaLabel='Report content';content=`<p>We respect intellectual property and do not permit unauthorized material, non-consensual intimate content, or material involving minors.</p><h2>Report a listing</h2><p>Submit the exact Noxvellox URL, the original source URL, a short description of the issue, your relationship to the material and a reliable way to contact you. Do not send intimate images, passwords, payment details or identity documents in an initial report.</p><p>${contact?`Send reports to <a href="mailto:${esc(contact)}">${esc(contact)}</a>.`:'Use the <a href="/contact">Contact page</a>. A dedicated legal/takedown email must be configured before full-scale monetization.'}</p><h2>Response</h2><p>Reports are reviewed promptly. Listings may be disabled while the source, rights and consent status are checked. Where a formal legal notice is required, submit the information required by applicable law and identify the rights holder or authorized representative.</p>`;break;
    case 'contact':title='Contact';cta='/copyright';ctaLabel='Copyright & takedown';content=`<p>Welcome to the Noxvellox contact desk. We receive clear, specific messages about authorized embeds, accessibility, privacy, copyright, safety and technical issues. Please identify the exact page or video so the request can be reviewed without unnecessary delay.</p><h2>Copyright and content removal</h2><p>If you represent a rights holder or believe that a listing should not be displayed, provide the exact Noxvellox URL, original source URL, a short explanation, your relationship to the material and a reliable reply address. Do not send copies of protected files or intimate images in an initial message. A precise report allows the catalog team to check source status, rights signals, consent requirements and playback, then remove or disable a listing when it no longer meets our publication rules.</p><h2>Privacy and safety</h2><p>For privacy questions, age-safety concerns or reports involving non-consensual or unlawful material, mark the subject clearly and provide only the minimum information needed. Never send passwords, payment details or identity documents. Reports involving minors or immediate safety risks should be identified as urgent and may be disabled while investigated.</p><h2>Technical support</h2><p>For a broken thumbnail, unavailable official player, incorrect title or page that does not load, include your device, browser, approximate time, affected URL and whether the issue occurs on another network. Screenshots are optional. Requests about subscriptions, billing or creator accounts belonging to an external provider must be directed to that provider because Noxvellox does not control those accounts or payment systems.</p><h2>Contact details</h2><p>${contact?`Email: <a href="mailto:${esc(contact)}">${esc(contact)}</a>`:'Use the Contact page link in the footer while the operator configures a dedicated support address before full-scale monetization.'}</p><p>Messages are reviewed in order. We aim to acknowledge actionable reports promptly, although requests requiring verification with an original provider or rights holder can take longer. Send one request per issue and use a descriptive subject.</p>`;break;
    default:return null;
  }
  const finalContent=name==='privacy'?`${content}<p class="mini">Configured advertising delivery host: biomanos.org. Provider policies and applicable consent requirements still apply.</p>`:name==='contact'?`${content}<p class="mini">Include the affected URL and a concise subject so the team can reproduce the issue and document the review outcome.</p>`:content;
  return shell({title:`${title} | Noxvellox`,description:`${title} and important information about the Noxvellox adults-only video catalog.`,url,base,gate:false,body:`<section class="wrap page-head"><div class="section-kicker">Information</div><h1>${esc(title)}</h1><div class="page-actions"><a class="button" href="${cta}">${ctaLabel}</a></div></section><article class="wrap readable">${finalContent}</article>`});
}
// Only official Pornhub player/watch URLs from these exact owned domains are normalized.
// No broad *.pornhub.com or random domain wildcard is added to the approval list.
const OFFICIAL_PORNHUB_HOSTS=new Set(['pornhub.com','www.pornhub.com','pt.pornhub.com','es.pornhub.com','de.pornhub.com','fr.pornhub.com','it.pornhub.com']);
function officialEmbed(value){
 if(!isHttpsUrl(value))return '';
 try{
  const u=new URL(value);
  if(!OFFICIAL_PORNHUB_HOSTS.has(u.hostname.toLowerCase())||u.port)return '';
  let key='';
  const match=u.pathname.match(/^\/embed\/([a-zA-Z0-9]{8,24})\/?$/);
  if(match)key=match[1];
  else if(u.pathname==='/view_video.php')key=u.searchParams.get('viewkey')||'';
  if(!/^[a-zA-Z0-9]{8,24}$/.test(key))return '';
  return 'https://www.pornhub.com/embed/'+key;
 }catch{return ''}
}
function allowedEmbed(value,env){
 if(!isHttpsUrl(value))return '';
 const official=officialEmbed(value);
 if(official)return official; // Official provider published a free embed option for webmaster sites.
 const u=new URL(value),host=u.hostname.toLowerCase();
 // Do not let a misconfigured generic suffix allow arbitrary Pornhub paths or hosts.
 if(host==='pornhub.com'||host.endsWith('.pornhub.com'))return '';
 const hosts=String(env.ALLOWED_EMBED_HOSTS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 if(host==='iframe.videodelivery.net'&&!validStreamEmbed(value))return '';
 return hosts.some(h=>host===h||host.endsWith('.'+h))?value:'';
}
function licensedEmbedError(value,env){
 if(!isHttpsUrl(value))return 'Only HTTPS iframe URLs are accepted. Check the link.';
 const host=new URL(value).hostname.toLowerCase();
 if(host==='pornhub.com'||host.endsWith('.pornhub.com'))return 'This is not a recognized Pornhub embed or watch link. Paste https://www.pornhub.com/embed/VIDEO_ID or the official view_video.php?viewkey=VIDEO_ID link. An RSS feed entry can be used automatically at /official-videos.';
 if(host==='www.eporner.com'||host.endsWith('.eporner.com'))return 'Eporner is not an approved embed host. Its availability on another site is not a license; use a separately authorized player or the official free-embed feed.';
 const safeHost=host.slice(0,160);
 return 'The embed hostname ('+safeHost+') is not approved in ALLOWED_EMBED_HOSTS. Only the official Pornhub embed and separately verified, authorized hosts may be attached.';
}
function feedConfigured(env){
 try{
  if(!isHttpsUrl(env.VIDEO_FEED_URL||''))return false;
  const host=new URL(env.VIDEO_FEED_URL).hostname.toLowerCase();
  const feedHosts=String(env.ALLOWED_FEED_HOSTS||'').split(',').map(v=>v.trim().toLowerCase());
  return feedHosts.includes(host)&&String(env.ALLOWED_EMBED_HOSTS||'').trim().length>0;
 }catch{return false}
}
// Provider health checks are metadata-only. A failed network check never changes an existing record.
async function checkAdultEmbedStatus(sourceId){
  const id=String(sourceId||'');
  if(!/^\d{1,15}$/.test(id))return {known:false,active:false,reason:'Invalid provider video ID'};
  try{
    const resp=await fetch(`https://adultembed.com/api/v1/videos/${id}/status?format=json`,{
      headers:{accept:'application/json','X-Site-URL':'https://noxvellox.site/'},
      redirect:'manual',signal:AbortSignal.timeout(9000)
    });
    if((resp.status>=300&&resp.status<400)||resp.type==='opaqueredirect')return {known:false,active:false,reason:'Provider redirect blocked for safety'};
    if(!resp.ok)return {known:false,active:false,reason:`Provider returned HTTP ${resp.status}`};
    const data=await resp.json();
    if(Number(data.id)!==Number(id)||typeof data.active!=='boolean')return {known:false,active:false,reason:'Malformed provider response'};
    return {known:true,active:data.active,complete:data.complete===true};
  }catch{return {known:false,active:false,reason:'Provider health check unavailable'};}
}
// Read-only provider-origin diagnostics: active/complete API flags are not playback proof.
// Never follow cross-host redirects; never fetch a user-supplied URL.
async function checkAdultEmbedPlayerPage(sourceId){
 const id=String(sourceId||'');
 if(!/^\d{1,15}$/.test(id))return {known:false,unavailable:false,reason:'Invalid provider ID'};
 try{
  const response=await fetch(`https://adultembed.com/player/embed/${id}/`,{
   headers:{accept:'text/html','X-Site-URL':'https://noxvellox.site/'},
   redirect:'manual',signal:AbortSignal.timeout(9000)
  });
  if((response.status>=300&&response.status<400)||response.type==='opaqueredirect')return {known:false,unavailable:false,reason:'Player URL redirects; playback unverified'};
  if(!response.ok)return {known:true,unavailable:true,reason:`Player source returned HTTP ${response.status}`};
  const size=Number(response.headers.get('content-length')||0);
  if(size>250000)return {known:false,unavailable:false,reason:'Player page too large to inspect'};
  const body=(await response.text()).slice(0,250001);
  if(body.length>250000)return {known:false,unavailable:false,reason:'Player page too large to inspect'};
  // Provider itself displays this error for many entries marked active=true.
  if(/video\s+unavailable/i.test(body))return {known:true,unavailable:true,reason:'Original provider player reports Video unavailable'};
  if(/content\s+(removed|not\s+found)/i.test(body))return {known:true,unavailable:true,reason:'Provider page reports removed content'};
  if(!/\<\s*(html|!doctype\s+html)/i.test(body))return {known:false,unavailable:false,reason:'Unexpected player page response'};
  return {known:true,unavailable:false,reason:'No explicit error detected, but actual playback is not proven'};
 }catch{return {known:false,unavailable:false,reason:'Player page unavailable or blocked; cannot establish playback'};}
}
async function getVideo(db,slug){if(!db)return null;return db.prepare(`SELECT * FROM videos WHERE slug=? AND status='published' AND duration_seconds >= ${MIN_VIDEO_DURATION_SECONDS} LIMIT 1`).bind(slug).first()}
function notFound({base,url}){return shell({title:'Page not found | Noxvellox',description:'This page is not available.',base,url,robots:'noindex,follow',gate:false,body:'<section class="wrap page-head"><h1>Page not found</h1><p>This listing may have been removed or the URL changed.</p><p><a class="button" href="/">Return home </a></p></section>'})}
const authHeaderToken=req=>{const s=req.headers.get('authorization')||'';return s.startsWith('Bearer ')?s.slice(7):''};
const adminSecretsReady=env=>typeof env?.ADMIN_PASSWORD==='string'&&env.ADMIN_PASSWORD.trim().length>=16&&typeof env?.SESSION_SECRET==='string'&&env.SESSION_SECRET.trim().length>=32;
const secureCompare=async(a,b)=>{if(!a||!b)return false;const [x,y]=await Promise.all([crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(a))),crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(b)))]);const aa=new Uint8Array(x),bb=new Uint8Array(y);let diff=0;for(let i=0;i<aa.length;i++)diff|=aa[i]^bb[i];return diff===0};
const sign=async(s,key)=>{const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(String(key)),{name:'HMAC',hash:'SHA-256'},false,['sign']);const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',material,new TextEncoder().encode(s)));return Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join('')};
async function session(req,env){if(!adminSecretsReady(env))return false;const c=(req.headers.get('cookie')||'').match(/(?:^|;\s*)nox_admin=([^;]+)/);if(!c)return false;const [expiry,sig]=decodeURIComponent(c[1]).split('.');if(!/^\d{13}$/.test(expiry)||Number(expiry)<Date.now()||Number(expiry)>Date.now()+13*3600e3)return false;return secureCompare(sig,await sign(`admin|${expiry}`,env.SESSION_SECRET))}
const sameOrigin=req=>{const origin=req.headers.get('origin');return !!origin&&origin===new URL(req.url).origin;};
function adminBody({logged,videos,db,feedReady}){
  if(!logged)return `<section class="wrap page-head"><h1>Publisher login</h1><p>Administrator access only.</p></section><section class="wrap"><div class="admin-panel" style="max-width:450px"><form id="login-form"><div class="form-row"><label for="password">Administrator password</label><input type="password" id="password" name="password" class="field" required autocomplete="current-password"></div><button class="button" type="submit">Sign in</button></form><p id="message" class="message"></p></div></section>`;
  const rows=videos.length?videos.map(v=>{
    const verified=!!v.rights_confirmed&&!!v.adults_verified;
    const action=v.status==='published'
      ? `<button type="button" data-id="${Number(v.id)}" data-set-status="hidden">Hide</button>`
      : v.status==='hidden'&&!verified
      ? `<button type="button" data-id="${Number(v.id)}" data-set-status="pending">Return to review</button>`
      : verified
      ? `<button type="button" data-id="${Number(v.id)}" data-set-status="published">Publish</button>`
      : v.status==='pending'
      ? `<button type="button" data-id="${Number(v.id)}" data-review>Confirm review</button>`
      : '<span class="mini">Hidden - return to review first</span>';
    return `<tr id="video-row-${Number(v.id)}" data-video-row>
      <td>${esc(v.title)}<div class="mini">${esc(v.provider)}</div></td>
      <td><span class="status">${esc(v.status)}</span></td>
      <td>${verified?'Reviewed':'Unverified - review source'} <a href="${esc(v.source_url)}" rel="noopener noreferrer" target="_blank">Source ?</a></td>
      <td>${action}${v.provider==='adultembed'?` <button type="button" data-check-player data-id="${Number(v.id)}">Check player</button>`:''}${v.provider==='xxx-little-pepper'?` <button type="button" data-pepper-embed data-id="${Number(v.id)}">Set licensed player</button><div class="row-action-panel" data-pepper-panel hidden><label>Authorized iframe player URL <input type="url" class="field" data-pepper-url placeholder="https://www.pornhub.com/embed/VIDEO_ID" maxlength="1500" aria-label="Official licensed player URL"></label><p class="mini">Official Pornhub player or watch links are converted to the correct embed automatically. Other sources need prior approval in ALLOWED_EMBED_HOSTS. This action does not publish the video; rights and participant checks remain necessary.</p><button type="button" data-pepper-save data-id="${Number(v.id)}">Save licensed player</button> <button type="button" data-pepper-cancel>Cancel</button></div>`:''}<div class="row-action-panel" data-row-panel hidden><p data-panel-description></p><div data-panel-checks></div><div class="row-actions"><button type="button" class="button" data-confirm-action>Continue</button><button type="button" class="button ghost" data-cancel-action>Cancel</button></div></div><p class="row-action-feedback" data-row-message role="status" aria-live="polite"></p></td>
    </tr>`;
  }).join(''):'<tr><td colspan="4">No videos yet. Set up a licensed source or add a verified item.</td></tr>';
  return `<section class="wrap page-head"><div class="section-kicker">Publisher area</div><h1>Control center</h1><p>Content import, rights review and publishing. New imports are always held for approval.</p><button class="button ghost" id="logout">Log out</button></section><div class="wrap"><div class="admin-panel"><h2>System status</h2><p><a class="button ghost" href="/official-videos" target="_blank" rel="noopener noreferrer">Open automatic official embeds ?</a></p><div class="status-band">D1: ${db?'connected':'NOT CONNECTED'}  ·  Import feed: ${feedReady?'configured':'not configured'}  ·  Ads: Native Banner configured (consent required)</div><p class="helper">This is a separate project. The official feed at /official-videos needs no per-item publish action. Only public video METADATA may be copied from XXX Little Pepper when you explicitly import it: no advertising scripts, passwords, signed MP4 links, cookies or videos are copied. Brazzers studio listings are imported as private metadata candidates only. No download or publication rights are implied; official licenses and participant records must be verified before publishing.</p><button class="button ghost" id="import-pepper" type="button">Import all XXX Little Pepper titles for PRIVATE review</button> <button class="button ghost" id="sync-official" type="button">Import 100+ official embeds now</button><form id="hide-official-form" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0"><label class="mini">Official embed ID to remove: <input class="field" name="id" pattern="[a-zA-Z0-9]{8,24}" maxlength="24" required placeholder="Provider video ID"></label><button class="button ghost" type="submit">Hide removed embed</button></form> <span class="mini">Uses only official webmaster RSS/search metadata (up to 3 pages  ·  30 plus RSS). New releases synchronize every two hours after the free Cron Worker is deployed; no per-video approval for the provider&#39;s official feed.</span><br><br> <span class="mini">64 titles currently in the source catalog; unavailable or temporary playback links will NOT be copied as playable videos.</span><br><br><button class="button ghost" id="import-now" ${feedReady?'':'disabled'}>Import Brazzers candidates for review ?</button> <button class="button ghost" id="hide-broken" type="button">Hide all published AdultEmbed videos with broken players</button><p class="helper">Provider active/complete flags do not guarantee playback. Use Check player to detect known provider errors, then personally test the actual video and verify commercial permission and adult-consent documentation. No deletion or changes to other providers.</p><p id="message" class="message"></p></div><div class="admin-panel"><h2>Add a ready, licensed video</h2><p class="helper">Video delivery is separate from Pages and D1. First upload your own authorized source file to a video platform such as Cloudflare Stream (separately priced), wait for encoding, and test the player. Then register its UID below. We do not import, transcode or copy third-party films. Public access requires individual rights, participant and playback verification.</p><form id="video-form"><div class="form-grid"><div class="form-row"><label>Video title<input class="field" name="title" maxlength="140" required></label></div><div class="form-row"><label>Publisher channel ID<input class="field" name="channel_id" maxlength="80" placeholder="e.g. brazzers"></label></div><div class="form-row"><label>Studio or publisher<input class="field" name="studio" maxlength="80"></label></div><div class="form-row"><label>Publisher tags<input class="field" name="raw_tags" maxlength="800" placeholder="Comma-separated exact source tags"></label></div><div class="form-row"><label>Language<input class="field" name="language" maxlength="40" placeholder="English or en"></label></div><div class="form-row"><label>Formats<input class="field" name="formats" maxlength="300" placeholder="Compilation, Virtual Reality"></label></div><div class="form-row"><label>Resolution<input class="field" name="resolution" maxlength="16" placeholder="1080p or 4K"></label></div><div class="form-row"><label>Frame rate<input class="field" name="frame_rate" type="number" min="24" max="120" step="1" placeholder="60"></label></div><div class="form-row"><label>Orientation<input class="field" name="orientation" maxlength="32" placeholder="Heterosexual, Gay, Sapphic"></label></div><div class="form-row"><label><input type="checkbox" name="featured" value="yes"> Feature this video on the homepage</label></div><div class="form-row"><label>Original source URL<input class="field" type="url" name="source_url" placeholder="https://source.example/video" required></label></div><div class="form-row"><label>Authorized embed URL (alternative to Stream UID)<input class="field" type="url" name="embed_url" placeholder="https://approved-source.example/embed/id"></label></div><div class="form-row"><label>Cloudflare Stream video UID (32 hex characters, optional)<input class="field" name="stream_uid" pattern="[a-fA-F0-9]{32}" minlength="32" maxlength="32" inputmode="text" placeholder="Only after uploading a video you own or may distribute"></label><p class="mini">Use ONE method: licensed embed URL, or Cloudflare Stream UID of a ready video. The latter lets Stream handle adaptive HLS/DASH and CDN delivery. A UID is not a video file; obtain it from a separately authorized Stream account. Stream can incur charges and is NOT activated by this package.</p></div><div class="form-row"><label>Poster image URL<input class="field" type="url" name="poster_url" placeholder="https://approved-source.example/poster.jpg"></label></div><div class="form-row"><label>Duration in seconds<input class="field" type="number" name="duration_seconds" min="0" max="100000"></label></div></div><div class="form-row"><label>Description<textarea name="description" rows="3" maxlength="1600"></textarea></label></div><div class="form-row"><label><input type="checkbox" name="rights_confirmed" value="yes" required> I have verified the rights to embed/distribute this video.</label></div><div class="form-row"><label><input type="checkbox" name="adults_verified" value="yes" required> I have verified that every participant is an adult and content is consensual and lawful.</label></div><button class="button" type="submit">Save for review</button></form></div><div class="admin-panel"><h2>Content moderation queue</h2><p class="helper">Click an action to open its confirmation checklist. Results and errors appear beneath that video. Check player detects known external errors but does NOT prove real playback. Imported listings need verified commercial rights, adult-consent records and an actual browser playback test.</p><div style="overflow-x:auto"><table class="admin-table"><thead><tr><th>Title</th><th>Status</th><th>Rights</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div></div></div>`;
}
async function adminPage({db,env,url,req,base}){
 const configured=adminSecretsReady(env);
 const logged=configured&&await session(req,env);
 const videos=logged&&db?(await db.prepare('SELECT id,title,status,provider,source_url,rights_confirmed,adults_verified FROM videos ORDER BY id DESC LIMIT 200').all()).results||[]:[];
 const body=!configured?'<section class="wrap page-head"><h1>Publisher dashboard unavailable</h1><p>Administrator secrets are not configured. Access is blocked until ADMIN_PASSWORD and SESSION_SECRET are saved as production secrets.</p></section>':adminBody({logged,videos,db,feedReady:feedConfigured(env)})+(logged?'<div class="wrap"><p class="notice"><strong>Active filter:</strong> only videos with a minimum duration of 15:00 can be reviewed and published. Entries without reliable duration, authorized artwork, or an authorized player remain private.</p></div>':'');
  return shell({base,url,gate:false,robots:'noindex,nofollow',title:'Publisher dashboard | Noxvellox',description:'Private content management console.',body:`${body}<script defer src="/assets/admin.v027.js?ver=0.4.2"></script>`});
}
function normalizeImportedTitle(raw){
 const original=safeText(raw,140).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,'').replace(/\s+/g,' ').trim();
 if(!original)return '';
 const promotional=/^(?:watch|download|free|hot|new|official|full|now|video)[\s!|:_-]+/i;
 const cleaned=original.replace(promotional,'').replace(/[!?|*_~]+/g,' ').replace(/\s+/g,' ').trim();
 if(!cleaned)return '';
 const letters=cleaned.replace(/[^A-Za-zÀ-ÿ]/g,'');
 const shouldTitle=letters.length>8&&letters===letters.toUpperCase();
 return shouldTitle?cleaned.toLowerCase().replace(/(^|[\s-])([a-zà-ÿ])/g,(_,p,c)=>p+c.toUpperCase()):cleaned;
}
function extractMetadataValue(item,keys){
 for(const key of keys){const value=item?.[key];if(value!==undefined&&value!==null&&String(value).trim())return value}
 return '';
}
async function persistVideoTaxonomy(db,videoId,item,taxonomy){
 const raw=safeRawTags([...rawTagList(item.raw_tags),...rawTagList(item.tags),...rawTagList(item.categories),...rawTagList(item.category),...rawTagList(item.keywords),...rawTagList(item.tag)],taxonomy);
 const categorySlugs=mapRawTags(raw,taxonomy.categoryAliases,taxonomy);
 const formatValues=[...rawTagList(item.formats),...rawTagList(item.format),...raw];
 const formatSlugs=[...new Set(mapRawTags(formatValues,taxonomy.formatAliases,taxonomy))];
 const directLanguage=extractMetadataValue(item,['language','lang','audio_language','audioLanguage','locale']);
 let language=normalizeLanguage(typeof directLanguage==='object'?(directLanguage.code||directLanguage.name||''):directLanguage,taxonomy);
 if(!language)for(const tag of raw){language=normalizeLanguage(tag,taxonomy);if(language)break}
 const rawResolution=extractMetadataValue(item,['resolution','max_resolution','maxResolution','video_quality','quality']);
 let resolution=normalizeResolution(rawResolution,taxonomy);
 if(!resolution)for(const tag of raw){resolution=normalizeResolution(tag,taxonomy);if(resolution)break}
 const rawFps=extractMetadataValue(item,['frame_rate','frameRate','fps']);
 let frameRate=normalizeFrameRate(rawFps,taxonomy);
 if(!frameRate)for(const tag of raw){const match=String(tag).match(/^(\d{2,3})\s*(?:fps|frames per second)$/i);if(match){frameRate=normalizeFrameRate(match[1],taxonomy);if(frameRate)break}}
 const rawOrientation=extractMetadataValue(item,['orientation','sexual_orientation','sexualOrientation']);
 let orientation=(taxonomy.orientationAliases||new Map()).get(normalizeTaxonomyToken(rawOrientation))||'';
 if(!orientation)for(const tag of raw){orientation=(taxonomy.orientationAliases||new Map()).get(normalizeTaxonomyToken(tag))||'';if(orientation)break}
 const studioValue=item.studio&&typeof item.studio==='object'?(item.studio.slug||item.studio.name||''):item.studio;
 const channelId=normalizeTaxonomyToken(extractMetadataValue(item,['channel_id','channelId','channel_slug','channelSlug'])||studioValue).replace(/\s+/g,'-').slice(0,80);
 const studio=normalizeTaxonomyToken(studioValue).replace(/\s+/g,'-').slice(0,80);
 const featured=item.featured===true||item.featured==='true'||item.featured==='yes'||item.featured==='on';
 await db.prepare("INSERT INTO video_metadata (video_id,channel_id,studio,resolution,frame_rate,language,orientation,raw_tags_json,featured) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(video_id) DO UPDATE SET channel_id=excluded.channel_id,studio=excluded.studio,resolution=excluded.resolution,frame_rate=excluded.frame_rate,language=excluded.language,orientation=excluded.orientation,raw_tags_json=excluded.raw_tags_json,featured=excluded.featured")
  .bind(videoId,channelId,studio,resolution,frameRate,language,orientation,JSON.stringify(raw),featured?1:0).run();
 await db.prepare("DELETE FROM video_categories WHERE video_id=?").bind(videoId).run();
 await db.prepare("DELETE FROM video_formats WHERE video_id=?").bind(videoId).run();
 for(const categorySlug of categorySlugs)await db.prepare("INSERT OR IGNORE INTO video_categories (video_id,category_slug) VALUES (?,?)").bind(videoId,categorySlug).run();
 for(const formatSlug of formatSlugs)await db.prepare("INSERT OR IGNORE INTO video_formats (video_id,format_slug) VALUES (?,?)").bind(videoId,formatSlug).run();
 return {categorySlugs,formatSlugs,rawTags:raw};
}
async function addVideo(db,item,{fromFeed=false}={}){
 const title=normalizeImportedTitle(item.title),description=safeText(item.description,1600)||(title+'. Authorized metadata from '+safeText(item.provider||'the original publisher',80)+'.');
 const uid=streamUid(item.stream_uid||item.streamUid);
 if((item.stream_uid||item.streamUid)&&!uid)throw Error('Cloudflare Stream UID must be exactly 32 hexadecimal characters, from a ready licensed video.');
 if(uid&&(item.embed_url||item.embedUrl))throw Error('Choose one player method: Stream UID or licensed embed URL, not both.');
 const embed_url=uid?streamEmbed(uid):String(item.embed_url||item.embedUrl||'');
 const source_url=String(item.source_url||item.sourceUrl||'')|| (uid?embed_url:'');
 const poster_url=String(item.poster_url||item.posterUrl||'')|| (uid?'https://videodelivery.net/'+uid+'/thumbnails/thumbnail.jpg?time=1s':'');
 if(title.length<3||!isHttpsUrl(source_url)||!isHttpsUrl(embed_url)||poster_url&&!isHttpsUrl(poster_url))throw Error('Required: title and a valid HTTPS original source and licensed embed (or Stream UID).');
 if(uid&&!validStreamEmbed(embed_url))throw Error('Invalid Cloudflare Stream player URL.');
 const taxonomy=taxonomyConfig;
 const raw=safeRawTags([...rawTagList(item.raw_tags),...rawTagList(item.tags),...rawTagList(item.categories),...rawTagList(item.category),...rawTagList(item.keywords),...rawTagList(item.tag)],taxonomy);
 const categorySlugs=mapRawTags(raw,taxonomy?.categoryAliases||new Map(),taxonomy);
 const legacyCategory=categorySlugs.length?taxonomy.categoryBySlug[categorySlugs[0]].name:'Uncategorized';
 const rights=item.rights_confirmed===true||item.rights_confirmed==='yes'||item.rightsConfirmed===true;
 const adults=item.adults_verified===true||item.adults_verified==='yes'||item.adultsVerified===true;
 const provider=uid?'cloudflare-stream':safeText(item.provider|| (fromFeed?'authorized-feed':'manual'),50);
 const source_id=uid||safeText(item.source_id||item.sourceId||'',100);
 if(source_id){const duplicate=await db.prepare('SELECT id FROM videos WHERE provider=? AND source_id=? LIMIT 1').bind(provider,source_id).first();if(duplicate)return false;}
 const slug=slugify(item.slug||title)+(uid?'-'+uid.slice(0,12):(fromFeed&&source_id?'-'+slugify(source_id).slice(0,20):''));
 const duration=Math.max(0,Math.min(100000,parseInt(item.duration_seconds||item.durationSeconds||0,10)||0));
 const record=[slug,title,description,legacyCategory,poster_url,embed_url,source_url,source_id,provider,duration,rights?1:0,adults?1:0];
 const result=await db.prepare("INSERT OR IGNORE INTO videos (slug,title,description,category,poster_url,embed_url,source_url,source_id,provider,duration_seconds,rights_confirmed,adults_verified,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'pending')").bind(...record).run();
 if(!(result.meta?.changes||0))return false;
 const row=await db.prepare('SELECT id FROM videos WHERE slug=? LIMIT 1').bind(slug).first();
 if(row?.id!==undefined)await persistVideoTaxonomy(db,Number(row.id),item,taxonomy);
 return true;
}
function normalizeAdultEmbed(v){
 if(!v||!Number.isSafeInteger(Number(v.id))||Number(v.id)<=0)return null;
 const studioSlug=String(typeof v.studio==='object'?(v.studio?.slug||''):(v.studio||'')).trim().toLowerCase();
 if(studioSlug!=='brazzers')return null;
 const embedUrl='https://adultembed.com/player/embed/'+Number(v.id)+'/';
 const durationValue=Number(v.duration_seconds||0);
 const durationSeconds=Number.isFinite(durationValue)&&durationValue>0?Math.floor(durationValue):0;
 const rightsConfirmed=v.rightsConfirmed===true||v.rights_confirmed===true;
 const adultsVerified=v.adultsVerified===true||v.adults_verified===true;
 const rawTags=[...rawTagList(v.tags||v.raw_tags||v.categories||v.keywords||[]),...rawTagList(v.tag||[])];
 return {
  sourceId:String(v.id),provider:'adultembed',title:String(v.title||''),
  description:String(v.description||''),category:'Brazzers',channel_id:'brazzers',studio:'brazzers',
  raw_tags:rawTags,language:v.language||v.lang||v.locale||'',formats:v.formats||[],
  resolution:v.resolution||v.max_resolution||v.quality||'',frame_rate:v.frame_rate||v.fps||null,
  orientation:v.orientation||'',
  sourceUrl:embedUrl,embedUrl,posterUrl:String(v.poster||v.thumbnail||v.thumb||''),durationSeconds,
  rightsConfirmed,adultsVerified
 };
}

// XXX Little Pepper transfer imports only public metadata, not paid media, signed URLs, ads or secrets.
const PEPPER_PUBLIC_API='https://xxx-little-pepper.pages.dev/api/public';
const PEPPER_ORIGIN='https://xxx-little-pepper.pages.dev';
function pepperDuration(value){
 const v=String(value||'').trim().toLowerCase();
 const match=v.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
 if(match){const t=match[3]?Number(match[1])*3600+Number(match[2])*60+Number(match[3]):Number(match[1])*60+Number(match[2]);return t<=100000?t:0;}
 const minutes=v.match(/^(\d{1,4})\s*(?:min|minutes?|mins?)$/);
 return minutes&&Number(minutes[1])<=1600?Number(minutes[1])*60:0;
}
function pepperCandidate(m){
 if(!m||typeof m!=='object'||m.published!==true)return null;
 const id=String(m.id??'').trim().toLowerCase();
 if(!/^[a-z0-9][a-z0-9-]{1,84}$/.test(id))return null;
 const title=safeText(m.title||'',140);
 if(title.length<3)return null;
 const sourceUrl=PEPPER_ORIGIN+'/watch/'+encodeURIComponent(id);
 let image=String(m.posterUrl||m.backdropUrl||'').trim();
 if(image.startsWith('/api/image/'))image=PEPPER_ORIGIN+image;
 if(!isHttpsUrl(image))image='';
 return {
  slug:'pepper-'+slugify(id),title,
  description:safeText(m.synopsis||'Imported for private editorial review. Commercial embedding rights and playback have not been verified.',1600),
  category:'Collections',poster_url:image,
  // Important: temporary MP4 links and unrelated media hosts cannot safely transfer.
  // This is a SOURCE REFERENCE, not a working video iframe. Server blocks publishing it.
  embed_url:sourceUrl,source_url:sourceUrl,source_id:id,provider:'xxx-little-pepper',
  duration_seconds:pepperDuration(m.duration),rights_confirmed:0,adults_verified:0
 };
}
async function fetchPepperCatalog(){
 const response=await fetch(PEPPER_PUBLIC_API,{method:'GET',headers:{accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(14000)});
 if(response.status>=300&&response.status<400||response.type==='opaqueredirect')throw Error('Little Pepper public API redirected; import stopped.');
 if(!response.ok)throw Error('Little Pepper public API returned HTTP '+response.status);
 const ct=response.headers.get('content-type')||'';
 if(!/json/i.test(ct))throw Error('Little Pepper did not return JSON.');
 const length=Number(response.headers.get('content-length')||0);
 if(length>1000000)throw Error('Little Pepper catalog exceeded 1 MB limit.');
 const text=await response.text();if(text.length>1000000)throw Error('Little Pepper catalog exceeded 1 MB limit.');
 const data=JSON.parse(text);
 if(!Array.isArray(data?.movies))throw Error('Little Pepper catalog is missing movies array.');
 if(data.movies.length>250)throw Error('Little Pepper catalog exceeded 250 candidates; manual import needed.');
 return data.movies;
}
async function runPepperImport(db){
 const raw=await fetchPepperCatalog();
 let added=0,rejected=0,withoutPlayer=0;
 const stmt=[];
  for(const m of raw){
   const v=pepperCandidate(m);if(!v||v.duration_seconds<MIN_VIDEO_DURATION_SECONDS){rejected++;continue;}
  // User's own public API often omits player URLs. Never assume any title will play.
  if(!isHttpsUrl(m.videoUrl||'')||/[?&]expires=/.test(String(m.videoUrl||'')))withoutPlayer++;
  stmt.push(db.prepare("INSERT OR IGNORE INTO videos (slug,title,description,category,poster_url,embed_url,source_url,source_id,provider,duration_seconds,rights_confirmed,adults_verified,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'pending')")
    .bind(v.slug,v.title,v.description,v.category,v.poster_url,v.embed_url,v.source_url,v.source_id,v.provider,v.duration_seconds,0,0));
 }
 // Cloudflare D1 batch executes in a transaction; the offline test doubles use .run() instead.
 if(typeof db.batch==='function'){
  for(let offset=0;offset<stmt.length;offset+=40){
   const batch=await db.batch(stmt.slice(offset,offset+40));
   for(const r of batch)added+=Number(r.meta?.changes||0);
  }
 }else{
  for(const q of stmt){const r=await q.run();added+=Number(r.meta?.changes||0)}
 }
 await db.prepare('INSERT INTO import_runs(status,received,added,rejected,message) VALUES (?,?,?,?,?)')
 .bind('completed',raw.length,added,rejected,'XXX Little Pepper public metadata only; source links are NOT playable embeds. All entries pending verification.').run();
 return {ok:true,received:raw.length,added,rejected,withoutReliablePlayer:withoutPlayer,pendingOnly:true,publications:0,
  note:'Imported public title metadata, cover references and origin links only. To publish, set a licensed playable embed, verify commercial rights and documentary adult consent, then manually test playback.'};
}
async function runImport(env,db){
 if(!env.VIDEO_FEED_URL||!isHttpsUrl(env.VIDEO_FEED_URL))throw Error('VIDEO_FEED_URL must be an approved HTTPS feed URL.');
 const host=new URL(env.VIDEO_FEED_URL).hostname.toLowerCase();
 const allowed=String(env.ALLOWED_FEED_HOSTS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
 if(!allowed.includes(host))throw Error('Feed host must be explicitly approved in ALLOWED_FEED_HOSTS.');
 const feedPath=new URL(env.VIDEO_FEED_URL).pathname;
 const isAdultEmbed=host==='adultembed.com' && (feedPath==='/api/feeds/videos.json'||feedPath==='/api/v1/search');
 const response=await fetch(env.VIDEO_FEED_URL,{headers:{accept:'application/json',...(isAdultEmbed?{'X-Site-URL':'https://noxvellox.site/'}:{}),...(env.VIDEO_FEED_TOKEN?{authorization:`Bearer ${env.VIDEO_FEED_TOKEN}`}:{})},redirect:'manual',signal:AbortSignal.timeout(12000)});
 if((response.status>=300&&response.status<400)||response.type==='opaqueredirect')throw Error('Feed URL redirects to another location. Use a direct allowlisted HTTPS JSON endpoint; redirect was not followed.');
 if(!response.ok)throw Error(`Feed returned ${response.status}`);
 const length=Number(response.headers.get('content-length')||0);if(length>1000000)throw Error('Feed payload too large');
 const payload=await response.text();if(payload.length>1000000)throw Error('Feed response too large');
 const parsed=JSON.parse(payload);const rawItems=isAdultEmbed?parsed.results:(Array.isArray(parsed)?parsed:parsed.items);
 const items=isAdultEmbed&&Array.isArray(rawItems)?rawItems.map(normalizeAdultEmbed):rawItems;
 if(!Array.isArray(items))throw Error('Feed JSON requires an items array');
 const autoPublishBrazzers=String(env.AUTO_PUBLISH_BRAZZERS||'verified-only')==='verified-only';
 let added=0,rejected=0,autoPublished=0;
 for(const item of items.slice(0,40)){try{
   if(!item||typeof item!=='object'||Number(item.durationSeconds||item.duration_seconds||0)<MIN_VIDEO_DURATION_SECONDS||(!isAdultEmbed&&(!item.rightsConfirmed||!item.adultsVerified))||!allowedEmbed(item.embedUrl||item.embed_url,env)){rejected++;continue}
  if(isAdultEmbed){
    const health=await checkAdultEmbedStatus(item.sourceId);
    if(!health.known||!health.active||!health.complete){rejected++;continue}
  }
  if(await addVideo(db,item,{fromFeed:true})){
   added++;
   // Automatic publication is limited to feed records carrying both explicit
   // rights and adult-participation confirmations. Provider health alone never
   // qualifies a candidate for publication.
   if(autoPublishBrazzers&&isAdultEmbed&&item.provider==='adultembed'&&item.rightsConfirmed===true&&item.adultsVerified===true){
    const player=await checkAdultEmbedPlayerPage(item.sourceId);
    if(player.known&&!player.unavailable){
     const result=await db.prepare("UPDATE videos SET status='published',published_at=COALESCE(published_at,datetime('now')) WHERE provider='adultembed' AND source_id=? AND status='pending' AND rights_confirmed=1 AND adults_verified=1").bind(item.sourceId).run();
     autoPublished+=Number(result.meta?.changes||0);
    }
   }
  }
 }catch{rejected++}}
 await db.prepare('INSERT INTO import_runs(status,received,added,rejected,message) VALUES (?,?,?,?,?)').bind('completed',Math.min(items.length,40),added,rejected,autoPublished?'Verified candidates auto-published after provider health and player checks; others remain pending.':'Candidates remain pending because the feed did not provide both required rights confirmations.').run();
 return {received:Math.min(items.length,40),added,rejected,autoPublished,pendingApproval:autoPublished<added,autoPublishMode:'verified-only'};
}
async function fetchVastXml(url,depth=0,attempt=0){
 if(depth>3)throw new Error('VAST wrapper limit reached');
 try{
  let requestUrl=url;
  if(depth===0){
   try{const parsed=new URL(url);parsed.searchParams.set('cb',Date.now().toString());requestUrl=parsed.toString()}catch{}
  }
  const response=await fetch(requestUrl,{method:'GET',cache:'no-store',headers:{accept:'application/xml,text/xml,*/*'},signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error('VAST upstream returned '+response.status);
  const xml=await response.text();
  // ExoClick can return a VAST Wrapper whose next URL is cross-origin.
  // Resolve wrappers inside the Worker so the browser only requests our same-origin endpoint.
  if(/<MediaFile\b/i.test(xml))return xml;
  const match=xml.match(/<VASTAdTagURI\b[^>]*>\s*([\s\S]*?)\s*<\/VASTAdTagURI>/i);
  const next=match?.[1]?.replace(/^<!\[CDATA\[|\]\]>$/g,'').trim()||'';
  if(!/^https:\/\//i.test(next))return xml;
  return fetchVastXml(next,depth+1,0);
 }catch(error){
  if(attempt<1){
   await new Promise(resolve=>setTimeout(resolve,250));
   return fetchVastXml(url,depth,attempt+1);
  }
  throw error;
 }
}
const extractVastMedia=xml=>{
 const media=String(xml||'').match(/<MediaFile\b[^>]*>[\s\S]*?(?:<!\[CDATA\[)?\s*(https:\/\/[^<\]\s]+)\s*(?:\]\]>)?[\s\S]*?<\/MediaFile>/i);
 const click=String(xml||'').match(/<ClickThrough\b[^>]*>[\s\S]*?(?:<!\[CDATA\[)?\s*(https:\/\/[^<\]\s]+)\s*(?:\]\]>)?[\s\S]*?<\/ClickThrough>/i);
 return media?{mediaUrl:media[1].trim(),clickUrl:click?.[1]?.trim()||''}:null;
};
async function api(req,env,url,db){
 const path=url.pathname;
 if(path==='/api/pre-roll-vast'&&req.method==='GET'){
  const target=prerollVastUrl(env);
  if(!target)return new Response('Video pre-roll is not configured.',{status:404,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  try{
   const xml=await fetchVastXml(target);
   if(url.searchParams.get('format')==='json'){
    const ad=extractVastMedia(xml);
    if(!ad)throw new Error('VAST response has no playable media');
    return json({ok:true,...ad});
   }
   return new Response(xml,{status:200,headers:{'content-type':'application/xml; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
  }catch{
   if(url.searchParams.get('format')==='json')return json({ok:false,reason:'no_fill'});
   return new Response('Video ad provider unavailable.',{status:502,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})
  }
 }
 if(path==='/api/ad-health'&&req.method==='GET'){
  const started=Date.now();
  try{
   const response=await fetch(ADSTERRA_NATIVE_SRC,{method:'GET',signal:AbortSignal.timeout(7000)});
   return json({ok:response.ok,configured:true,provider:'Adsterra',status:response.status,contentType:response.headers.get('content-type')||'',latencyMs:Date.now()-started,consentRequired:true,note:'Server reachability does not replace browser rendering; the client also checks each banner slot.'});
  }catch(e){return json({ok:false,configured:true,provider:'Adsterra',status:0,latencyMs:Date.now()-started,consentRequired:true,note:'Ad provider did not respond. The client will show a temporary-unavailable state.'},502)}
 }
 if(path==='/api/health'&&req.method==='GET')return json({ok:true,brand:SITE,version:VERSION,database:!!db,adsConnected:true,preRollVastConfigured:!!prerollVastUrl(env),importFeedConfigured:feedConfigured(env),freeOfficialFeedEnabled:true});
 if(path==='/api/official-catalog-status'&&req.method==='GET'){
  let total=0,lastAdded=null,mode='rss_fallback';
  if(db){try{
    const r=await db.prepare("SELECT count(*) AS total,max(first_seen_at) AS last_added FROM official_embeds WHERE visibility='active'").first();
    total=r?.total||0;lastAdded=r?.last_added||null;if(total)mode='persistent_d1';
  }catch{/* table may not exist until the first cron sync */}}
  return json({ok:true,version:VERSION,mode,storedOfficialEmbeds:total,lastAdded,scheduledSync:'deploy official-sync worker with cron',noMediaHosted:true});
 }
 if(path==='/api/official-feed-status'&&req.method==='GET'){
  const result=await retrieveOfficialFeed({force:true});
  const snapshot=officialSnapshot();
  return json({ok:true,brand:SITE,version:VERSION,upstreamStatus:result.httpStatus,source:result.entries.length?'live_rss':snapshot.length?'dated_snapshot':'unavailable',reason:result.reason,liveEntries:result.entries.length,snapshotEntries:snapshot.length,snapshotObservedAt:OFFICIAL_SNAPSHOT_OBSERVED,notice:'RSS metadata and an iframe URL do not prove real playback; no downloads or player verification performed.'});
 }
 if(path==='/api/cron/import'&&req.method==='POST'){
   if(!env.IMPORT_KEY||!(await secureCompare(authHeaderToken(req),env.IMPORT_KEY)))return json({error:'Unauthorized'},401);
   if(!db)return json({error:'D1 not configured'},503);
   try{return json(await runImport(env,db))}catch(e){return json({error:String(e.message||e)},422)}
 }
 if(!sameOrigin(req))return json({error:'Invalid origin'},403);
 if(path==='/api/record-view'&&req.method==='POST'){
  if(!db)return json({error:'D1 not configured'},503);
  try{
   const body=await req.json(),slug=String(body?.slug||'').trim();
   if(!/^[a-z0-9][a-z0-9-]{1,100}$/i.test(slug))return json({error:'Invalid video slug'},400);
   const video=await db.prepare("SELECT id FROM videos WHERE slug=? AND status='published' AND rights_confirmed=1 AND adults_verified=1 AND duration_seconds>=? LIMIT 1").bind(slug,MIN_VIDEO_DURATION_SECONDS).first();
   if(!video)return json({error:'Video not available'},404);
   await db.prepare("INSERT INTO video_views (video_id) VALUES (?)").bind(Number(video.id)).run();
   return json({ok:true},201);
  }catch{return json({error:'View could not be recorded'},422)}
 }
 if(path==='/api/admin/login'&&req.method==='POST'){
   if(!adminSecretsReady(env))return json({error:'Admin secrets not configured'},503);
   const form=await req.formData();const password=form.get('password');
   if(typeof password!=='string'||!password.trim())return json({error:'Password is required'},401);
   if(!(await secureCompare(password,env.ADMIN_PASSWORD)))return json({error:'Incorrect password'},401);
   const expiry=String(Date.now()+12*3600000),signature=await sign(`admin|${expiry}`,env.SESSION_SECRET);
   const res=json({ok:true});res.headers.append('set-cookie',`nox_admin=${expiry}.${signature}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`);return res;
 }
 if(path==='/api/admin/logout'&&req.method==='POST'){const res=json({ok:true});res.headers.append('set-cookie','nox_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');return res}
 if(!(await session(req,env)))return json({error:'Unauthorized'},401);
 if(!db)return json({error:'D1 not configured'},503);
 if(path==='/api/admin/hide-official'&&req.method==='POST'){
  try{
   const {id}=await req.json();
   if(!/^[a-z0-9]{8,24}$/i.test(String(id||'')))return json({error:'Invalid official video ID'},400);
   const change=await db.prepare("UPDATE official_embeds SET visibility='hidden' WHERE id=? AND visibility='active'").bind(id).run();
   return json({ok:true,hidden:Number(change.meta?.changes||0)});
  }catch{return json({error:'Official catalog not yet initialized'},422)}
 }
 if(path==='/api/admin/sync-official'&&req.method==='POST'){try{return json(await syncOfficialOnDemand(db))}catch(e){return json({error:safeText(e.message||e,180)},422)}}
 if(path==='/api/admin/import-pepper'&&req.method==='POST'){
   try{return json(await runPepperImport(db))}
   catch(e){return json({error:'Little Pepper private import failed: '+safeText(e.message||e,180)},422)}
 }
 if(path==='/api/admin/set-pepper-embed'&&req.method==='POST'){
  try{
   const data=await req.json(),id=Number(data.id),embedUrl=String(data.embedUrl||'').trim();
   if(!Number.isSafeInteger(id)||id<=0)return json({error:'Invalid video ID'},400);
   const row=await db.prepare('SELECT id,provider,source_url FROM videos WHERE id=? LIMIT 1').bind(id).first();
   if(!row||row.provider!=='xxx-little-pepper')return json({error:'This action only changes imported Little Pepper candidates.'},404);
   if(!isHttpsUrl(embedUrl)||embedUrl.length>1500||embedUrl===row.source_url)return json({error:'Enter the actual HTTPS iframe URL, not the Little Pepper watch/source page.'},422);
   const normalized=allowedEmbed(embedUrl,env);
   if(!normalized)return json({error:licensedEmbedError(embedUrl,env)},422);
   await db.prepare("UPDATE videos SET embed_url=?,rights_confirmed=0,adults_verified=0,status='pending' WHERE id=? AND provider='xxx-little-pepper'").bind(normalized,id).run();
   return json({ok:true,privateReview:true,note:'Saved licensed player URL; rights and participant review must be completed again before publishing.'});
  }catch(e){return json({error:'Could not attach the player URL.'},422)}
 }
 if(path==='/api/admin/check-player'&&req.method==='POST'){
  try{
   const {id}=await req.json();
   if(!Number.isSafeInteger(Number(id))||Number(id)<=0)return json({error:'Invalid video ID'},400);
   const row=await db.prepare('SELECT id,provider,source_id FROM videos WHERE id=? LIMIT 1').bind(Number(id)).first();
   if(!row)return json({error:'Video not found'},404);
   if(row.provider!=='adultembed')return json({error:'This diagnostic is available only for AdultEmbed links.'},422);
   const status=await checkAdultEmbedStatus(row.source_id);
   const player=await checkAdultEmbedPlayerPage(row.source_id);
   return json({ok:true,provider:'adultembed',apiActive:status.known?status.active:null,apiComplete:status.known?status.complete:null,playerUnavailable:player.known?player.unavailable:null,playerCheckKnown:player.known,note:player.reason,actualPlaybackVerified:false,warning:'A player web page can load without the video playing. Manual browser playback and documented publishing rights are still required.'});
  }catch(e){return json({error:'Player diagnostic failed.'},503)}
 }
 if(path==='/api/admin/hide-broken'&&req.method==='POST'){
   // Only the signed-in publisher may hide the reported broken AdultEmbed listings.
   // Reversible and idempotent; licensed videos from other providers remain unchanged.
   try{
     const r=await db.prepare("UPDATE videos SET status='hidden' WHERE status='published' AND provider='adultembed'").run();
     return json({ok:true,hidden:Number(r.meta?.changes||0),preservedOtherProviders:true,deleted:0});
   }catch(e){return json({error:'Could not hide AdultEmbed listings. Database update failed.'},503)}
 }
 if(path==='/api/admin/videos'&&req.method==='POST'){
   try{
     const form=await req.formData();const entry=Object.fromEntries(form.entries());
     const requestedUid=entry.stream_uid?streamUid(entry.stream_uid):'';
     if(entry.stream_uid&&!requestedUid)return json({error:'Cloudflare Stream video UID must contain 32 hexadecimal characters.'},422);
     if(requestedUid&&entry.embed_url)return json({error:'Use Stream UID OR embed URL, not both.'},422);
     const requestedEmbed=requestedUid?streamEmbed(requestedUid):entry.embed_url;
     const normalized=allowedEmbed(requestedEmbed,env);
     if(!normalized)return json({error:licensedEmbedError(requestedEmbed,env)},422);
     if(!requestedUid)entry.embed_url=normalized;
     return json({ok:true,added:await addVideo(db,entry),pendingApproval:true,uploadPerformed:false,note:'Video metadata saved privately. No upload, conversion, encoding or publication occurred.'});
   }catch(e){return json({error:String(e.message||e)},422)}
 }
 if(path==='/api/admin/verify'&&req.method==='POST'){
  try{
   const {id,rightsConfirmed,adultsVerified}=await req.json();
   if(!Number.isSafeInteger(Number(id))||Number(id)<=0||rightsConfirmed!==true||adultsVerified!==true)
     return json({error:'Review requires separate explicit confirmation of rights and adult participation.'},400);
   const row=await db.prepare('SELECT * FROM videos WHERE id=? LIMIT 1').bind(Number(id)).first();
   if(!row)return json({error:'Video not found in this database. Reload the page and try again.'},404);
   if(row.status!=='pending')return json({error:'Video is not pending review. Reload the moderation queue.'},409);
   if(Number(row.duration_seconds)<MIN_VIDEO_DURATION_SECONDS)return json({error:'This video is shorter than the 15:00 minimum and cannot be published.'},422);
   if(row.provider==='xxx-little-pepper'&&row.embed_url===row.source_url)return json({error:'This is only a Little Pepper source reference. Set a separately licensed, tested iframe player URL before review.'},422);
   if(!allowedEmbed(row.embed_url,env))return json({error:'This embed source is not allowlisted in Production. Check ALLOWED_EMBED_HOSTS in wrangler.jsonc and redeploy Noxvellox; review not saved.'},422);
   await db.prepare('UPDATE videos SET rights_confirmed=1,adults_verified=1 WHERE id=? AND status=\'pending\'').bind(Number(id)).run();
   return json({ok:true,reviewed:true,stillPending:true});
  }catch(e){return json({error:String(e.message||e)},422)}
 }
 if(path==='/api/admin/status'&&req.method==='POST'){
  try{
    const {id,status,playbackConfirmed}=await req.json();if(!['published','hidden','pending'].includes(status)||!Number.isInteger(Number(id)))return json({error:'Invalid input'},400);
    if(status==='published'){
      const row=await db.prepare('SELECT * FROM videos WHERE id=? LIMIT 1').bind(Number(id)).first();
      if(!row)return json({error:'Video not found in this database.'},404);
      if(!['pending','hidden'].includes(row.status))return json({error:'Video is not waiting for publication. Refresh the page and check its status.'},409);
      if(Number(row.duration_seconds)<MIN_VIDEO_DURATION_SECONDS)return json({error:'This video is shorter than the 15:00 minimum and cannot be published.'},422);
      if(!row.rights_confirmed||!row.adults_verified)return json({error:'Cannot publish: documented rights and adult verification still missing.'},422);
      if(row.provider==='xxx-little-pepper'&&row.embed_url===row.source_url)return json({error:'Cannot publish a Little Pepper source reference: set and test an authorized iframe embed first.'},422);
      if(row.provider==='xxx-little-pepper'&&playbackConfirmed!==true)return json({error:'Before publishing this imported title, personally verify the licensed iframe actually plays in the browser.'},422);
      if(!allowedEmbed(row.embed_url,env))return json({error:'Cannot publish: embed host not allowlisted in Production. Check ALLOWED_EMBED_HOSTS.'},422);
      if(row.provider==='cloudflare-stream'){
        const parsed=validStreamEmbed(row.embed_url);
        if(!parsed)return json({error:'Cannot publish: invalid Cloudflare Stream video UID / iframe URL.'},422);
        if(playbackConfirmed!==true)return json({error:'Cannot publish: test the encoded Stream player in a browser and confirm it plays. A UID or upload alone is insufficient.'},422);
      }
      if(row.provider==='adultembed'){
        if(playbackConfirmed!==true)return json({error:'Before publishing, personally test that the video actually plays in the browser. Provider API status alone is insufficient.'},422);
        const health=await checkAdultEmbedStatus(row.source_id);
        if(!health.known)return json({error:'Cannot publish: unable to verify source availability. Try again later.'},503);
        if(!health.active||!health.complete)return json({error:'Cannot publish: source player is inactive or incomplete. Choose a working, authorized source.'},422);
        const playerPage=await checkAdultEmbedPlayerPage(row.source_id);
        if(!playerPage.known)return json({error:'Cannot publish: the player could not be checked. '+playerPage.reason+'. Keep this item private.'},503);
        if(playerPage.unavailable)return json({error:'Cannot publish: '+playerPage.reason+'. Hide this item or use a different licensed source.'},422);
        // Absence of an error string is not proof of playback; independent manual test stays mandatory.
      }
    }
    await db.prepare("UPDATE videos SET status=?,published_at=CASE WHEN ?='published' THEN COALESCE(published_at,datetime('now')) ELSE published_at END WHERE id=?").bind(status,status,Number(id)).run();return json({ok:true})
  }catch(e){return json({error:String(e.message||e)},422)}
 }
 if(path==='/api/admin/audit'&&req.method==='POST'){
   // Explicit admin-only cleanup; unavailable provider entries are hidden, never deleted.
   try{
     const result=await db.prepare("SELECT id,source_id FROM videos WHERE status='published' AND provider='adultembed' ORDER BY id DESC LIMIT 40").all();
     const rows=result.results||[];
     let checked=0,hidden=0,unavailable=0,unknown=0;
     for(const row of rows){
       const health=await checkAdultEmbedStatus(row.source_id);
       if(!health.known){unknown++;continue}
       checked++;
       if(!health.active||!health.complete){
         unavailable++;
         const up=await db.prepare("UPDATE videos SET status='hidden' WHERE id=? AND status='published' AND provider='adultembed'").bind(row.id).run();
         hidden+=Number(up.meta?.changes||0);
       }
     }
     return json({ok:true,checked,hidden,unavailable,unknown,remainingIfAny:Math.max(0,rows.length-checked-unknown),note:'Only confirmed unavailable videos were hidden. Rights review remains required.'});
   }catch(e){return json({error:String(e.message||e)},422)}
 }
 if(path==='/api/admin/import'&&req.method==='POST'){try{return json(await runImport(env,db))}catch(e){return json({error:String(e.message||e)},422)}}
 return json({error:'Not found'},404);
}
async function readPartnerDirectory(env, req) {
  const response = await env.ASSETS.fetch(new URL('/data/partners.json', req.url));
  if (!response.ok) throw new Error('Partner directory unavailable');
  return response.json();
}

const partnerPath = partner => '/channels/partners/' + partner.id;

async function partnersWithArt(env, req) {
  const [partners, response] = await Promise.all([
    readPartnerDirectory(env, req),
    env.ASSETS.fetch(new URL('/data/channel-art.json', req.url))
  ]);
  const art = response.ok ? await response.json().catch(()=>({})) : {};
  return partners.map(partner => ({...partner,...art[partner.id]}))
    .sort((a,b)=>a.name.localeCompare(b.name,'en'));
}

function partnerTile(partner) {
  const icon = isHttpsUrl(partner.avatar)
    ? '<img src="'+esc(partner.avatar)+'" loading="lazy" alt="">'
    : '<b aria-hidden="true">'+esc(partner.name.slice(0,2))+'</b>';
  return '<a class="nv-channel" href="'+partnerPath(partner)+'">'+icon+
    '<strong>'+esc(partner.name)+'</strong><span aria-hidden="true">›</span></a>';
}

function partnerCarousel(partners) {
  const slides = partners.filter(p=>isHttpsUrl(p.cover)).map(p=>({name:p.name,cover:p.cover,href:partnerPath(p)}));
  const featured = slides.findIndex(p=>p.name.toLowerCase()==='teamskeet');
  if(featured>0) slides.unshift(...slides.splice(featured,1));
  const css='<link rel="stylesheet" href="/assets/channel-directory.css">';
  if(!slides.length) return css;
  const first=slides[0];
  return css+'<section class="nv-carousel" data-channel-carousel aria-label="Featured channels">'+
    '<a class="nv-slide" href="'+first.href+'"><img src="'+esc(first.cover)+'" alt="" fetchpriority="high">'+
    '<strong>'+esc(first.name)+'</strong></a><div class="nv-controls" hidden><button type="button" data-prev aria-label="Previous channel">‹</button>'+
    '<button type="button" data-pause>Pause</button><button type="button" data-next aria-label="Next channel">›</button></div>'+
    '<script type="application/json">'+JSON.stringify(slides).replace(/</g,'\\u003c')+'</script></section>'+
    '<script defer src="/assets/channel-carousel.js"></script>';
}

async function partnerVideos(env, req, partner, db) {
  const asset = await env.ASSETS.fetch(new URL('/data/partner-videos.json', req.url));
  if (!asset.ok) throw new Error('Partner video list unavailable');
  const snapshot = await asset.json();
  const rows = (snapshot[partner.id] || []).filter(video => !REMOVED_OFFICIAL_IDS.has(video.id));
  if (!db || !rows.length) return rows;
  const params = rows.map(() => '?').join(',');
  const result = await db.prepare('SELECT id,visibility FROM official_embeds WHERE id IN (' + params + ')')
    .bind(...rows.map(video => video.id)).all();
  const states = new Map(result.results.map(row => [row.id,row.visibility]));
  return rows.filter(video => !states.has(video.id) || states.get(video.id) === 'active')
    .map(video => ({...video, catalog:states.get(video.id) === 'active'}));
}

async function partnerWatch({video, partner, url, base, env}) {
  if (video.catalog) return Response.redirect(base + '/official-watch/' + video.id, 302);
  const source = OFFICIAL_ORIGIN + '/view_video.php?viewkey=' + video.id;
  const embed = OFFICIAL_ORIGIN + '/embed/' + video.id;
  if (!EMBED_BLOCKED_OFFICIAL_IDS.has(video.id)) {
    try {
      const api = OFFICIAL_ORIGIN + '/webmasters/video_embed_code?id=' + video.id;
      const response = await fetch(api, {redirect:'error', signal:AbortSignal.timeout(5000),
        headers:{accept:'application/json'}, cf:{cacheTtl:600,cacheEverything:true}});
      const payload = response.ok ? await response.text() : '';
      let code = '';
      if (payload.length < 16384) {
        try {
          code = JSON.parse(payload).embed?.code;
        } catch {
          // Some webmaster responses leave HTML attribute quotes unescaped inside the JSON string.
          const legacy = payload.trim().match(/^\{\s*"embed"\s*:\s*\{\s*"code"\s*:\s*"(<iframe\b[\s\S]*?)"\s*\}\s*\}$/i);
          code = legacy?.[1].replaceAll('\\/', '/') || '';
        }
      }
      const src = typeof code === 'string' && code.match(/<iframe\b[^>]*?\ssrc=["']([^"']+)["']/i)?.[1];
      if (src === embed) {
        return html(officialWatch({base,url,env,video:{...video,embed_url:embed,source_url:source}}));
      }
    } catch { /* The original viewing page stays available when the embed API is offline. */ }
  }
  const thumb = isHttpsUrl(video.poster_url) && new URL(video.poster_url).hostname.endsWith('.phncdn.com')
    ? '<img src="'+esc(video.poster_url)+'" alt="">' : '';
  const body = '<link rel="stylesheet" href="/assets/partner-profile.css"><article class="partner-profile">'+
    '<nav class="partner-nav"><a href="'+partnerPath(partner)+'">← '+esc(partner.name)+'</a></nav>'+
    '<a class="partner-original" href="'+esc(source)+'">'+thumb+'<strong>Watch on Pornhub ↗</strong></a>'+
    '<h1>'+esc(video.title)+'</h1><a href="'+partnerPath(partner)+'#partner-videos">More videos from '+esc(partner.name)+'</a></article>';
  return html(shell({base,url,title:video.title + ' | Noxvellox',description:'View this listing from ' + partner.name,body}));
}

function partnerProfilePage({partner, localFeed, references, profile, base, url}) {
  const name = esc(partner.name);
  const description = 'Browse videos and publisher information for ' + partner.name + ' on Noxvellox.';
  const safeImage = src => isHttpsUrl(src) && new URL(src).hostname.endsWith('.phncdn.com');
  const image = (src, lazy = true) => safeImage(src) ? '<img src="' + esc(src) + '" alt="" ' +
    (lazy ? 'loading="lazy"' : 'fetchpriority="high"') + ' decoding="async">' : '';
  const videos = new Map();
  for (const v of references) videos.set(v.id,{...v,href:partnerPath(partner) + '/video/' + v.id});
  for (const v of localFeed || []) {
    if (v.partner_profile_url === partner.url && !REMOVED_OFFICIAL_IDS.has(v.id))
      videos.set(v.id,{...v,href:'/official-watch/' + encodeURIComponent(v.id)});
  }
  const clip = v => {
    const preview = profile.previews?.[v.id] || {};
    const durationLabel = preview.duration || (v.duration_seconds ? duration(v.duration_seconds) : '');
    return '<a class="partner-clip" href="'+esc(v.href)+'"><span class="partner-thumb"><span aria-hidden="true">▶</span>'+
      image(preview.thumbnail || v.poster_url)+(durationLabel ? '<small>'+esc(durationLabel)+'</small>' : '')+
      '</span><strong>'+esc(v.title)+'</strong><small>'+esc(preview.channel || partner.name)+'</small></a>';
  };
  const stats = Object.entries(profile.stats || {}).filter(([k,v]) => ['subscribers','videos','views'].includes(k) && /^\d{1,16}$/.test(v))
    .map(([label,value]) => Number(value).toLocaleString('en-US')+' '+label).join(' · ');
  const items = [...videos.values()];
  const grid = list => '<div class="partner-clips">'+list.map(clip).join('')+'</div>';
  const strip = (label, link) => '<header class="partner-strip"><h2>'+label+'</h2><a href="'+esc(link)+'">View all ↗</a></header>';
  const tiles = (label, key, path) => {
    const cards = (profile[key] || []).filter(x=>isHttpsUrl(x.url) && new URL(x.url).hostname === 'www.pornhub.com');
    if (!cards.length) return '';
    return '<section class="partner-block" id="partner-'+key+'">'+strip(label,partner.url+path)+
      '<div class="partner-tiles">'+cards.map(x=>'<a class="partner-tile" href="'+esc(x.url)+'">'+image(x.image)+
        '<span>'+esc(x.name)+'</span></a>').join('')+'</div></section>';
  };
  const nav = [['Videos','videos'],['Channels','channels'],['Photos','photos'],['Playlists','playlists']]
    .filter(([,key])=>key==='videos' || profile[key]?.length)
    .map(([label,key])=>'<a href="#partner-'+key+'">'+label+'</a>').join('');
  const body = '<link rel="stylesheet" href="/assets/partner-profile.css"><article class="partner-profile">'+
    '<header class="partner-cover" id="partner-featured">'+image(profile.cover,false)+'<div class="partner-badge">'+
    (image(profile.avatar,false) || esc(partner.name.slice(0,2)))+'</div><div><h1>'+name+'</h1>'+
    (profile.location ? '<p>'+esc(profile.location)+'</p>' : '')+'<p>'+(stats ? esc(stats)+' on Pornhub' : items.length+' videos on Noxvellox')+'</p></div></header>'+
    '<nav class="partner-nav" aria-label="Partner profile"><a href="#partner-featured">Featured</a>'+nav+
    '<button class="partner-follow" type="button" data-follow-channel="partner-'+esc(partner.id)+'" aria-pressed="false">Follow channel</button></nav><div class="partner-columns"><div>'+
    tiles('Channels','channels','/channels')+'<section class="partner-block" id="partner-videos">'+strip('Videos',partner.url+'/videos/public')+
    grid(items.slice(0,6))+(items.length>6 ? '<details class="partner-more"><summary>Load more videos</summary>'+grid(items.slice(6))+'</details>' : '')+
    '</section></div><aside class="partner-side"><section class="partner-block"><h2>About '+name+'</h2><p>'+esc(description)+'</p>'+
    '<a href="'+esc(partner.url)+'">Publisher profile on Pornhub ↗</a></section>'+tiles('Photos','photos','/photos')+
    tiles('Playlists','playlists','/playlists')+'</aside></div>'+adSlot('partner-footer')+'</article>';
  return shell({base,url,title:partner.name+' | Content partners | Noxvellox',description,body});
}

async function route(req,env){
 const url=new URL(req.url),base=PUBLIC_ORIGIN,path=decodeURIComponent(url.pathname).replace(/\/$/,'')||'/',db=asD1(env.DB);
 if(path.startsWith('/assets/')||path==='/favicon.svg'||path==='/data/videos.json'||path==='/data/taxonomy.json')return env.ASSETS.fetch(req);
 const taxonomy=await loadTaxonomy(env,req);let taxonomyReady=false;
 if(db){try{taxonomyReady=await ensureTaxonomySchema(db,taxonomy)}catch(error){console.warn('Taxonomy schema unavailable',String(error.message||error).slice(0,100))}}
 if(path.startsWith('/api/'))return api(req,env,url,db);
 if(path==='/robots.txt'){
   const robots=['User-agent: *','Allow: /','Disallow: /admin','Disallow: /api/','Disallow: /search','Disallow: /*?*page=','Disallow: /*?*sort=','Disallow: /*?*q=',`Sitemap: ${base}/sitemap.xml`].join('\\n')+'\\n';
   return new Response(robots,{headers:{'content-type':'text/plain; charset=utf-8','cache-control':'public, max-age=3600'}});
 }
 if(path==='/sitemap')return Response.redirect(`${base}/sitemap.xml`,301);
 if(path==='/sitemap.xml'){
     // Generate canonical URLs at request time. Search, filters, and shallow
     // category pages are intentionally excluded from this XML document.
     const dateOnly=value=>{const date=String(value||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(date)?date:''};
     const cleanVideoTitle=value=>normalizeImportedTitle(String(value||'')).slice(0,200)||'Official video';
     const cleanVideoDescription=(title,value)=>String(value||'').replace(/\s+/g,' ').trim().slice(0,2048)||`${title}. Video hosted and streamed by the original platform.`;
     const sitemapVideo=(item,title,description,player,durationSeconds)=>({thumbnail:String(item||''),title,description,player,duration:Number(durationSeconds)||0});
     const entries=['/','/videos','/official-videos','/categories','/channels',...channelsV2.map(c=>`/channels/${c.slug}`),'/about','/privacy','/terms','/copyright','/contact'].map(pathname=>({pathname,lastmod:''}));
     try{
       if(db){
         const published=await db.prepare("SELECT slug,title,description,category,poster_url,embed_url,duration_seconds,published_at FROM videos WHERE status='published' AND slug IS NOT NULL AND slug<>'' AND rights_confirmed=1 AND adults_verified=1 AND poster_url<>'' AND embed_url<>'' AND duration_seconds >= ${MIN_VIDEO_DURATION_SECONDS} ORDER BY published_at DESC,id DESC LIMIT 5000").all();
         const official=await db.prepare("SELECT id,title,poster_url,duration_seconds,last_seen_at FROM official_embeds WHERE visibility='active' AND id IS NOT NULL AND id<>'' AND id NOT IN ('696c7c920140e','6937cf5fea785') AND poster_url<>'' AND duration_seconds >= ${MIN_OFFICIAL_DURATION_SECONDS} ORDER BY last_seen_at DESC,id DESC LIMIT 5000").all();
         const categoryPages=await categoryDirectory(db,taxonomy,500);
         for(const category of categoryPages)if(category.seo_indexable)entries.push({pathname:'/category/'+encodeURIComponent(category.slug),lastmod:''});
         for(const channel of await channelDirectory(db,500))if(channel.count>=MIN_INDEXABLE_CATEGORY_VIDEOS)entries.push({pathname:'/channels/'+encodeURIComponent(channel.slug),lastmod:''});
         for(const row of (published.results||[])){
           if(!isHttpsUrl(row.poster_url)||!isHttpsUrl(row.embed_url))continue;
           const title=cleanVideoTitle(row.title);
           entries.push({pathname:`/watch/${encodeURIComponent(row.slug)}`,lastmod:dateOnly(row.published_at),video:sitemapVideo(row.poster_url,title,cleanVideoDescription(title,row.description),row.embed_url,row.duration_seconds)});
         }
         for(const row of (official.results||[])){
           if(!isHttpsUrl(row.poster_url))continue;
           const title=cleanVideoTitle(row.title);
           const player=`${OFFICIAL_ORIGIN}/embed/${encodeURIComponent(row.id)}`;
           entries.push({pathname:`/official-watch/${encodeURIComponent(row.id)}`,lastmod:dateOnly(row.last_seen_at),video:sitemapVideo(row.poster_url,title,cleanVideoDescription(title,''),player,row.duration_seconds)});
         }
       }
       const localFeed=await loadLocalOfficialFeed(env,req);
       if(Array.isArray(localFeed))for(const row of localFeed){
         if(!isHttpsUrl(row.poster_url)||!isHttpsUrl(row.embed_url))continue;
         const title=cleanVideoTitle(row.title);
         entries.push({pathname:`/official-watch/${encodeURIComponent(row.id)}`,lastmod:dateOnly(row.updated_at||row.published_at),video:sitemapVideo(row.poster_url,title,cleanVideoDescription(title,row.description),row.embed_url,row.duration_seconds)});
       }
     }catch(e){console.warn('Sitemap video expansion unavailable',String(e.message||e).slice(0,120))}
     const partners = await readPartnerDirectory(env, req);
     entries.push(...partners.map(partner => ({pathname:partnerPath(partner),lastmod:''})));
     const uniqueEntries=[...new Map(entries.map(entry=>[entry.pathname,entry])).values()];
     const videoXml=entry=>entry.video?`<video:video><video:thumbnail_loc>${esc(entry.video.thumbnail)}</video:thumbnail_loc><video:title>${esc(entry.video.title)}</video:title><video:description>${esc(entry.video.description)}</video:description><video:player_loc allow_embed="yes">${esc(entry.video.player)}</video:player_loc>${entry.video.duration>0?`<video:duration>${Math.floor(entry.video.duration)}</video:duration>`:''}<video:family_friendly>no</video:family_friendly></video:video>`:'';
    return xml(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n${uniqueEntries.map(entry=>`<url><loc>${esc(base+entry.pathname)}</loc>${entry.lastmod?`<lastmod>${entry.lastmod}</lastmod>`:''}${videoXml(entry)}</url>`).join('\n')}\n</urlset>`)
 }
 if(req.method!=='GET'&&req.method!=='HEAD')return new Response('Method not allowed',{status:405});
 if (path.startsWith('/channels/partners/')) {
   const match = path.match(/^\/channels\/partners\/(\d+)(?:\/video\/([a-z0-9]{8,24}))?$/);
   const partners = await readPartnerDirectory(env, req);
   const partner = match && partners.find(entry => entry.id === match[1]);
   if (!partner) return html(notFound({base,url:url.href}),404);
   const references = await partnerVideos(env,req,partner,db);
   const visualAsset = await env.ASSETS.fetch(new URL('/data/partner-profiles/'+partner.id+'.json',req.url));
   const profile = visualAsset.ok ? await visualAsset.json().catch(()=>({})) : {};
   if (match[2]) {
     const video = references.find(entry => entry.id === match[2]);
     if (!video) return html(notFound({base,url:url.href}),404);
     return partnerWatch({video:{...video,poster_url:profile.previews?.[video.id]?.thumbnail || ''},partner,base,url:url.href,env});
   }
   const localFeed = await loadLocalOfficialFeed(env, req);
   return html(partnerProfilePage({partner,localFeed,references,profile,base,url:url.href}));
 }
 let markup;
 const localFeed=await loadLocalOfficialFeed(env,req);
if(path==='/'){const videos=await listVideos(db,{limit:8});const official=(await officialCatalog(db,{limit:12,localEntries:localFeed})).entries;markup=homePageV3({base,url:url.href,videos,official,partners:await partnersWithArt(env,req),categoryList:await categoryDirectory(taxonomyReady?db:null,taxonomy)});}
 else if(path==='/videos'){
   const page=officialPageNumber(url.searchParams.get('page')||1),limit=OFFICIAL_PAGE_SIZE;
   const publishedTotal=await countPublishedVideos(db);
   if(publishedTotal>0){
     const videos=await listVideos(db,{offset:(page-1)*limit,limit});
     markup=listPage({base,url:url.href,videos,official:[],page,infinite:true,officialPagination:catalogPagination({page,total:publishedTotal,path:'/videos',label:'published videos'})});
   }else{
     const results=await officialCatalog(db,{page,limit,localEntries:localFeed});
     markup=listPage({base,url:url.href,videos:[],official:results.entries,page,infinite:true,officialPagination:catalogPagination({page,total:results.total,path:'/videos',label:'official embeds'})});
   }
 }
 else if(path==='/official-videos'){const page=officialPageNumber(url.searchParams.get('page')||1);const results=await officialCatalog(db,{page,localEntries:localFeed});markup=listPage({base,url:url.href,videos:[],official:results.entries,title:'Free Official Embeds',subtitle:'Automatically updated official embeds, saved over time and shown in pages.',page,officialPagination:officialPagination({page,total:results.total})});}
 else if(path.startsWith('/official-watch/')){const id=path.slice('/official-watch/'.length);const video=await officialById(db,id,localFeed);const related=video?rotateRelated((await officialCatalog(db,{page:1,limit:40,localEntries:localFeed})).entries,id,30):[];markup=video?officialWatch({base,url:url.href,video,related,env}):notFound({base,url:url.href});}
 else if(path==='/search'){const q=safeText(url.searchParams.get('q')||'',80);const videos=q?await listVideos(db,{q,limit:40}):[];const official=q?(await officialCatalog(db,{page:1,limit:40,q,localEntries:localFeed})).entries:[];const taxonomy=searchTaxonomy(q);markup=searchPage({base,url:url.href,q,videos,official,channels:taxonomy.channels,matchedCategories:taxonomy.categories})}
  else if(path==='/categories'){const directory=await categoryDirectory(taxonomyReady?db:null,taxonomy,30);markup=shell({base,url:url.href,title:'Browse Video Categories | Noxvellox',description:'Explore approved video categories by performer, body type, act, style and theme.',body:'<section class="wrap page-head"><div class="section-kicker">Discover by interest</div><h1>Categories</h1><p>Browse approved videos by topic. Channels identify the publisher; categories describe the source-provided subject.</p></section><div class="wrap">'+categoryCardsV2(directory)+adSlot()+'</div>'});}
  else if(path==='/channels'){
    const partners=await partnersWithArt(env,req);
    const metadataChannels=await channelDirectory(taxonomyReady?db:null,100);
    const dynamicChannels=metadataChannels.filter(channel=>!channelsV2.some(item=>item.slug===channel.slug));
    const dynamicGrid=dynamicChannels.length?'<section class="wrap"><h2>Publisher channels</h2><div class="nv-channel-grid">'+dynamicChannels.map(channel=>'<a class="nv-channel" href="/channels/'+encodeURIComponent(channel.slug)+'"><b aria-hidden="true">'+esc(channel.name.slice(0,2))+'</b><strong>'+esc(channel.name)+'</strong><small>'+channel.count.toLocaleString('en-US')+' approved videos</small><span aria-hidden="true">›</span></a>').join('')+'</div></section>':'';
    markup=shell({base,url:url.href,title:'Channels | Noxvellox',description:'Browse publisher channels and their approved videos on Noxvellox.',
      body:'<div class="wrap nv-directory" id="partners"><h1>Channels</h1>'+partnerCarousel(partners)+
        '<div class="nv-channel-grid">'+partners.map(partnerTile).join('')+'</div></div>'+dynamicGrid+adSlot()});
  }
  else if(path.startsWith('/channels/')||path.startsWith('/channel/')){
    const prefix=path.startsWith('/channels/')?'/channels/':'/channel/';
    const slug=path.slice(prefix.length).split('/')[0];
    const channel=channelsV2.find(c=>c.slug===slug);
    if(channel){
      const requestedPage=Math.max(1,Math.min(1000,Number(url.searchParams.get('page')||1)));
      const requestedQuery=safeText(url.searchParams.get('q')||'',80);
      const requestedSort=['recent','popular','rating'].includes(url.searchParams.get('sort')||'recent')?(url.searchParams.get('sort')||'recent'):'recent';
      const limit=20,canonicalUrl=`${base}/channels/${encodeURIComponent(channel.slug)}`;
      if(channel.category==='Official embeds'){
        const result=await officialCatalog(db,{page:requestedPage,limit,q:requestedQuery,localEntries:localFeed});
        markup=channelPageV4({base,url:url.href,canonicalUrl,channel,videos:[],official:result.entries,total:Number(result.total||0),page:requestedPage,limit,q:requestedQuery,sort:requestedSort});
      }else{
        const offset=(requestedPage-1)*limit;
        const videos=await listVideos(db,{category:channel.category,q:requestedQuery,offset,limit,sort:requestedSort});
        const total=await countChannelVideosV4(db,channel,requestedQuery);
        markup=channelPageV4({base,url:url.href,canonicalUrl,channel,videos,official:[],total,page:requestedPage,limit,q:requestedQuery,sort:requestedSort});
      }
    }else{
      const dynamicChannel=(await channelDirectory(taxonomyReady?db:null,500)).find(item=>item.slug===slug);
      if(dynamicChannel){
        const requestedQuery=safeText(url.searchParams.get('q')||'',80);
        const requestedSort=url.searchParams.get('sort')==='popular'?'popular':'recent';
        const total=await countTaxonomyChannelVideos(db,slug,requestedQuery);
        const videos=await taxonomyChannelVideos(db,slug,{limit:40,q:requestedQuery,sort:requestedSort});
        markup=taxonomyChannelPage({base,url,channel:dynamicChannel,videos,total,q:requestedQuery,sort:requestedSort});
      }else markup=notFound({base,url:url.href});
    }
  }
  else if(path.startsWith('/category/')){const slug=path.split('/')[2];const legacy={'featured':'/featured','trending':'/trending','new-releases':'/new-releases','most-viewed':'/most-viewed','originals':'/featured','collections':'/categories','interviews':'/channels','wellness':'/categories','brazzers':'/channels/brazzers','official-embeds':'/official-videos'};if(legacy[slug])return Response.redirect(base+legacy[slug],301);const c=taxonomy.categoryBySlug[slug];if(c){const filters=taxonomyFilters(url,taxonomy);const total=await countTaxonomyCategoryVideos(taxonomyReady?db:null,c,filters);const videos=await taxonomyCategoryVideos(taxonomyReady?db:null,c,{filters,limit:40});markup=taxonomyCategoryPage({base,url:url.href,category:c,videos,total,taxonomy,filters})}else markup=notFound({base,url:url.href})}
  else if(path.startsWith('/watch/')){const slug=path.slice(7);const v=await getVideo(db,slug);if(!v){const official=await officialById(db,slug,localFeed);if(official)return Response.redirect(`${base}/official-watch/${encodeURIComponent(slug)}`,301)}const related=v?rotateRelated(await listVideos(db,{category:v.category,limit:30,sort:'popular'}),slug,30):[];markup=v?watchPage({url:url.href,base,v,related,env}):notFound({base,url:url.href})}
 else if(COLLECTIONS.includes(path.slice(1))){const key=path.slice(1);const videos=await collectionVideos(taxonomyReady?db:null,key,40);const total=await collectionCounts(taxonomyReady?db:null,key);markup=collectionPage({base,url:url.href,collection:key,videos,total})}
  else if(path==='/history')markup=shell({base,url:url.href,title:'Watch history | Noxvellox',description:'View your recent videos. Your viewing history is saved only in this browser.',body:`<section class="wrap page-head"><div class="section-kicker">Your library</div><h1>Watch history</h1><p>Recent videos are saved in this browser and shown only here.</p></section><section class="wrap" data-history-root></section>`});
 else if(path==='/admin')markup=await adminPage({db,env,url:url.href,req,base});
 else markup=staticPage({name:path.slice(1),base,url:url.href,contact:env.CONTACT_EMAIL||'contato@noxvellox.site'});
 if(!markup)markup=notFound({base,url:url.href});
  const knownStatic=['/','/videos','/official-videos','/search','/categories','/channels','/featured','/trending','/new-releases','/most-viewed','/admin','/about','/privacy','/terms','/copyright','/contact','/history'];
  const missing=(!knownStatic.includes(path)&&!path.startsWith('/watch/')&&!path.startsWith('/official-watch/')&&!path.startsWith('/category/')&&!path.startsWith('/channel/')&&!path.startsWith('/channels/'))||(path.startsWith('/watch/')&&!(await getVideo(db,path.slice(7))))||(path.startsWith('/official-watch/')&&!(await officialById(db,path.slice('/official-watch/'.length),localFeed)))||(path.startsWith('/category/')&&!taxonomy.categoryBySlug[path.split('/')[2]]&&!['featured','trending','new-releases','most-viewed','originals','collections','interviews','wellness','brazzers','official-embeds'].includes(path.split('/')[2]))||((path.startsWith('/channel/')||path.startsWith('/channels/'))&&!channelsV2.some(c=>c.slug===path.split('/')[2]));
 return html(markup,missing?404:200,path==='/admin'?{'cache-control':'no-store'}:{});
}
export default {
 async fetch(req,env){try{const requestUrl=new URL(req.url);if(requestUrl.hostname==='noxvellox.pages.dev'||requestUrl.hostname.endsWith('.noxvellox.pages.dev'))return Response.redirect(`https://noxvellox.site${requestUrl.pathname}${requestUrl.search}`,301);return await route(req,env)}catch(e){console.error('Noxvellox request error',e);return html('<!doctype html><title>Temporarily unavailable</title><h1>Service temporarily unavailable</h1><p>Please try again.</p>',503)}}
};

