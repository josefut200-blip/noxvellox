Warning: truncated output (original token count: 49428)
Total output lines: 1640

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
const xml=s=>new Response(s,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=60, s-maxage=60, stale-while-revalidate=60','x-content-type-options':'nosniff','strict-transport-security':'max-age=31536000, includeSubDomains'}});
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
  const footer=`<footer class="footer"><div class="wrap"><div class="footer-inner"><a href="/" class="logo">NOX<span>VELLOX</span></a><nav class="footer-links" aria-label="Footer"><a href="/about">About</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/copyright">Copyright &amp; takedown</a><a href="/contact">Contact</a><a href="/admin">Publisher</a><button class="footer-pref" type="button" data-ad-preferences>Cookie preferences</button><a href="/history">Watch history</a></nav></div>${adSlot('footer-banner')}<p class="fineprint">� ${new Date().getUTCFullYear()} Noxvellox. For adults only (18+ or higher local legal age). Independent catalog. Individual media remains the property of its respective rights holders. We accept only authorized sources. Independent providers' official embed feeds are displayed under their published embed permissions; separately imported listings require review. Optional advertising is loaded only after visitor permission.</p></div></footer>`;
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
const card=(v)=>{const slug=encodeURIComponent(v.slug);const dur=v.duration_seconds?duration(v.duration_seconds):'';const href=v.official?`/official-watch/${slug}`:`/watch/${slug}`;return `<a class="video-card" href="${href}"><div class="video-art">${coverMarkup(v.poster_url,v.title,'Video preview',v.embed_url)}<span class="play" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></span>${dur?`<span class="duration">${dur}</span>`:''}</div><div class="video-meta"><h3>${esc(v.title)}</h3><div class="sub"><strong>${esc(v.category)}</strong>  �  ${esc(v.provider||'Catalog')}</div></div></a>`;};
const duration=n=>{let x=Math.max(0,Number(n)||0);return `${Math.floor(x/60)}:${String(x%60).padStart(2,'0')}`};
const emptyMarkup=`<div class="empty"><div><strong>New collection coming soon</strong><p>We are curating authorized videos. This launch preview does not contain unlicensed or fabricated video listings.</p></div></div>`;
const categoryChips=(current='')=>'<div class="chip-row"><a class="chip '+(!current?'active':'')+'" href="/videos">All videos</a><a class="chip" href="/categories">Categories</a><a class="chip" href="/featured">Featured</a><a class="chip" href="/trending">Trending</a><a class="chip" href="/new-releases">New Releases</a><a class="chip" href="/most-viewed">Most Viewed</a></div>';
const searchTaxonomy=q=>{const term=String(q||'').trim().toLowerCase();if(!term)return {channels:[],categories:[]};const channels=channelsV2.filter(ch=>[ch.name,ch.slug,ch.category,ch.eyebrow,ch.description].some(value=>String(value||'').toLowerCase().includes(term)));const matchedCategories=categories.filter(category=>String(category).toLowerCase().includes(term));return {channels, categories:matchedCategories};};
const categoryDescriptions={Featured:'Hand-picked catalog highlights.',Trending:'Popular titles being explored now.','New Releases':'Freshly added official metadata.',Originals:'Independent original collections.',Collections:'Curated themes grouped together.',Interviews:'Conversation and behind-the-scenes formats.',Brazilian:'Portuguese-language and Brazil-focused collections.',Couples:'Authorized couple and partner collections.',Solo:'Solo performances from approved sources.',Amateur:'Independent amateur collections with source attribution.',Wellness:'Adult wellness and education-oriented collections.',Brazzers:'Brazzers candidates, shown only after verification.','Official embeds':'Publisher-supplied embeds with source attribution.'};
const categoryCards=()=>`<div class="category-grid">${categories.map(c=>`<a class="category-card" href="/category/${slugify(c)}"><span class="category-card-kicker">Noxvellox collection</span><h2>${esc(c)}</h2><p>${esc(categoryDescriptions[c]||'Browse this curated collection.')}</p><span class="category-card-link">Browse category </span></a>`).join('')}</div>`;
const banner=`<section class="banner"><div><div class="section-kicker">Original curation  �  Always improving</div><h2>Better browsing. Fewer distractions.</h2><p>Discover collections from authorized sources, with clear credits and accessible reporting.</p></div><a class="button ghost" href="/about">Our approach </a></section>`;
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
 const body=`<section class="wrap channel-hero channel-style channel-brand-${esc(channel.slug)}"><div class="channel-hero-media"><img src="${esc(channel.cover)}" data-category-image alt="${esc(channel.name)} channel banner"><div class="channel-hero-shade"></div><div class="channel-banner-label">NOXVELLOX CHANNEL</div></div><div class="channel-hero-content"><div class="channel-identity"><div class="channel-avatar large">${esc(channel.name.slice(0,1))}</div><div class="channel-identity-main"><div class="section-kicker">${esc(channel.eyebrow)}</div><h1>${esc(channel.name)}</h1><p>${esc(channel.description)}</p><div class="channel-identity-actions"><button class="button ghost" type="button" data-follow-channel="${esc(channel.slug)}">Follow channel</button><span class="follow-status" data-follow-status="${esc(channel.slug)}" role="status"></span></div></div></div><div class="channel-stats">${stats}</div></div></section><section class="wrap channel-main"><aside class="channel-about"><div class="section-kicker">About this channel</div><h2>${esc(channel.name)}</h2><p>${esc(channel.description)}</p><p class="channel-policy">Only approved, attributed and playable listings appear in the public feed. Review candidates remain private until verification is complete.</p>${sourceBlock}${adSlot()}</aside><div class="channel-feed"><div class="channel-feed-head"><div><div class="section-kicker">${esc(channel.name)} collection</div><h2>Videos from ${esc(channel.name)}</h2></div><a class="channel-play-all" href="${firstUrl}">Play all <span aria-hidden="true">?</span></a></div><nav class="channel-feed-tabs" aria-label="Channel sorting"><a class="active" href="/channel/${encodeURIComponent(channel.slug)}">Most recent</a><a href="/channel/${encodeURIComponent(channel.slug)}?sort=popular">Most viewed</a><a href="/channel/${encodeURIComponent(channel.slug)}?sort=rating">Best rated</a></nav><div class="video-grid channel-video-grid">${count?items.join(''):`<div class="empty"><strong>No verified public videos yet</strong><p>New candidates stay private until rights, adult consent and playback checks are complete.</p></div>`}</div></div></section>`;
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
const channelVideoCardV4=(v,{official=false,channelName='Brazzers'}={})=>{const id=official?v.id:v.slug;const href=official?`/official-watch/${encodeURIComponent(id)}`:`/watch/${encodeURIComponent(id)}`;const source=official?'Official embed':channelName;return `<a class="video-card channel-video-card-v4" data-channel-video href="${href}"><div class="video-art">${coverMarkup(v.poster_url,v.title,official?'Official preview':'Channel preview',v.embed_url)}<span class="play" aria-hidden="true">?</span>${v.duration_seconds?`<span class="duration">${duration(v.duration_seconds)}</span>`:''}</div><div class="video-meta"><h3>${esc(v.title)}</h3><div class="sub"><strong>${esc(source)}</strong>  �  ${esc(channelDateV4(v.published_at))}</div><div class="channel-video-facts">Views not recorded</div></div></a>`};
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
 const pagination=pages>1?`<nav class="channel-pagination" aria-label="Channel pages">${page>1?`<a class="button ghost" href="${queryUrl({nextPage:page-1})}">Previous</a>`:''}<span>Page ${page} of ${pages}  �  ${total} videos</span>${page<pages?`<a class="button ghost" href="${queryUrl({nextPage:page+1})}">Next</a>`:''}</nav>`:'';
 const tabs=[['recent','Most recent'],['popular','Most viewed'],['rating','Best rated']].map(([value,label])=>`<a class="${sort===value?'active':''}" aria-current="${sort===value?'page':'false'}" href="${queryUrl({nextSort:value,nextPage:1})}">${label}</a>`).join('');
 const empty=q?`<div class="empty"><strong>No matching public videos</strong><p>Try another title or clear the channel search. Private candidates are not shown.</p></div>`:`<div class="empty"><strong>No verified public videos yet</strong><p>New candidates remain private until rights, adult consent and playback checks are complete.</p></div>`;
 const body=`<section class="wrap channel-hero channel-style channel-brand-${esc(channel.slug)}"><div class="channel-hero-media"><img src="${esc(channel.cover)}" data-category-image alt="${esc(channel.name)} editorial channel cover"><div class="channel-hero-shade"></div><div class="channel-banner-label">NOXVELLOX CHANNEL  �  EDITORIAL COVER</div></div><div class="channel-hero-content"><div class="channel-identity"><div class="channel-avatar large" aria-label="${esc(channel.name)} channel mark">${esc(channel.name.slice(0,1))}</div><div class="channel-identity-main"><div class="section-kicker">${esc(channel.eyebrow)} ${verify}</div><h1>${esc(channel.name)}</h1><p>${esc(channel.description)}</p><div class="channel-identity-actions"><button class="button ghost" type="button" data-follow-channel="${esc(channel.slug)}">Subscribe</button><span class="follow-status" data-follow-status="${esc(channel.slug)}" role="status"></span></div></div></div><div class="channel-stats">${stats}</div></div></section><section class="wrap channel-main"><aside class="channel-about"><div class="section-kicker">About this channel</div><h2>${esc(channel.name)}</h2><p>${esc(channel.description)}</p><p class="channel-detail"><strong>Type</strong><br>Adult content producer listing</p>${sourceLink}<p class="channel-detail"><strong>Channel created</strong><br>${esc(channel.createdAt||'Not recorded')}</p><p class="channel-policy">Noxvellox shows only approved, attributed and playable listings. No public statistics or verification badges are invented.</p>${sourceBlock}${adSlot()}</aside><div class="channel-feed"><div class="channel-feed-head"><div><div class="section-kicker">${esc(channel.name)} collection</div><h2>Videos from ${esc(channel.name)}</h2><p class="channel-feed-count">${q?`Results for "${esc(q)}"  �  `:''}${total} public videos</p></div><a class="channel-play-all" href="${firstUrl}">Play all <span aria-hidden="true">?</span></a></div><form class="channel-search" action="${primaryPath}" method="get"><label for="channel-query">Search this channel</label><div><input id="channel-query" name="q" value="${esc(q)}" placeholder="Search titles in this channel" maxlength="80"><input type="hidden" name="sort" value="${esc(sort)}"><button class="button" type="submit">Search</button></div></form><nav class="channel-feed-tabs" aria-label="Channel sorting">${tabs}<a class="channel-all-tab" href="${primaryPath}">All videos</a></nav><div class="video-grid channel-video-grid">${hasItems?items.join(''):empty}</div>${pagination}</div></section>`;
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
 return expiry>0&&expiry<=…24428 tokens truncated…tle Pepper public API redirected; import stopped.');
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
    '<strong>'+esc(partner.name)+'</strong><span aria-hidden="true">></span></a>';
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
    '<strong>'+esc(first.name)+'</strong></a><div class="nv-controls" hidden><button type="button" data-prev aria-label="Previous channel"><</button>'+
    '<button type="button" data-pause>Pause</button><button type="button" data-next aria-label="Next channel">></button></div>'+
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
    '<nav class="partner-nav"><a href="'+partnerPath(partner)+'"> '+esc(partner.name)+'</a></nav>'+
    '<a class="partner-original" href="'+esc(source)+'">'+thumb+'<strong>Watch on Pornhub ?</strong></a>'+
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
    return '<a class="partner-clip" href="'+esc(v.href)+'"><span class="partner-thumb"><span aria-hidden="true">?</span>'+
      image(preview.thumbnail || v.poster_url)+(durationLabel ? '<small>'+esc(durationLabel)+'</small>' : '')+
      '</span><strong>'+esc(v.title)+'</strong><small>'+esc(preview.channel || partner.name)+'</small></a>';
  };
  const stats = Object.entries(profile.stats || {}).filter(([k,v]) => ['subscribers','videos','views'].includes(k) && /^\d{1,16}$/.test(v))
    .map(([label,value]) => Number(value).toLocaleString('en-US')+' '+label).join(' � ');
  const items = [...videos.values()];
  const grid = list => '<div class="partner-clips">'+list.map(clip).join('')+'</div>';
  const strip = (label, link) => '<header class="partner-strip"><h2>'+label+'</h2><a href="'+esc(link)+'">View all ?</a></header>';
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
    '<a href="'+esc(partner.url)+'">Publisher profile on Pornhub ?</a></section>'+tiles('Photos','photos','/photos')+
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
         const categoryPages=await categoryDirectory(db,taxonomy,500);
         for(const category of categoryPages)if(category.seo_indexable)entries.push({pathname:'/category/'+encodeURIComponent(category.slug),lastmod:''});
         const published=await db.prepare("SELECT slug,title,description,category,poster_url,embed_url,duration_seconds,published_at FROM videos WHERE status='published' AND slug IS NOT NULL AND slug<>'' AND rights_confirmed=1 AND adults_verified=1 AND poster_url<>'' AND embed_url<>'' AND duration_seconds >= ${MIN_VIDEO_DURATION_SECONDS} ORDER BY published_at DESC,id DESC LIMIT 5000").all();
         const official=await db.prepare("SELECT id,title,poster_url,duration_seconds,last_seen_at FROM official_embeds WHERE visibility='active' AND id IS NOT NULL AND id<>'' AND id NOT IN ('696c7c920140e','6937cf5fea785') AND poster_url<>'' AND duration_seconds >= ${MIN_OFFICIAL_DURATION_SECONDS} ORDER BY last_seen_at DESC,id DESC LIMIT 5000").all();

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
    const dynamicGrid=dynamicChannels.length?'<section class="wrap"><h2>Publisher channels</h2><div class="nv-channel-grid">'+dynamicChannels.map(channel=>'<a class="nv-channel" href="/channels/'+encodeURIComponent(channel.slug)+'"><b aria-hidden="true">'+esc(channel.name.slice(0,2))+'</b><strong>'+esc(channel.name)+'</strong><small>'+channel.count.toLocaleString('en-US')+' approved videos</small><span aria-hidden="true">></span></a>').join('')+'</div></section>':'';
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
 async fetch(req,env){try{const requestUrl=new URL(req.url);if(requestUrl.hostname==='noxvellox.pages.dev')return Response.redirect(`https://noxvellox.site${requestUrl.pathname}${requestUrl.search}`,301);return await route(req,env)}catch(e){console.error('Noxvellox request error',e);return html('<!doctype html><title>Temporarily unavailable</title><h1>Service temporarily unavailable</h1><p>Please try again.</p>',503)}}
};


