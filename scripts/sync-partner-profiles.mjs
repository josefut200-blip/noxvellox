import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';

function extractProfile(html) {
  const decode = value => (value || '').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'").trim();
  const section = id => html.match(new RegExp('<section\\b[^>]*\\bid="'+id+'"[^>]*>([\\s\\S]*?)</section>', 'i'))?.[1] || '';
  const attr = (tag, key) => decode((tag || '').match(new RegExp('\\s'+key+'="([^"]*)"','i'))?.[1]);
  const image = value => /^https:\/\/(?:[\w-]+\.)*phncdn\.com\//i.test(value) ? value : '';
  const official = (tag, type) => {
    const href = attr(tag,'href').replace(/^https:\/\/(?:pt|www)\.pornhub\.com/,'');
    return new RegExp('^/'+type+'/[\\w.-]+/?$').test(href) ? 'https://www.pornhub.com'+href : '';
  };
  const items = block => block.match(/<li\b[^>]*>[\s\S]*?<\/li>/gi) || [];
  const top = section('topProfileHeader');
  if (!top) throw new Error('Missing profile header');
  const portrait = id => image(attr(top.match(new RegExp('<img\\b[^>]*id="'+id+'"[^>]*>','i'))?.[0],'src'));
  const channels = items(section('profileFeaturedVideo')).map(item => {
    const tag = item.match(/class="wtitle">\s*(<a\b[^>]*>)([^<]+)/i);
    return {name:decode(tag?.[2]),url:official(tag?.[1],'channels'),image:image(attr(item.match(/<img\b[^>]*>/i)?.[0],'src'))};
  }).filter(x => x.name && x.url).slice(0,12);
  const photos = items(section('sidebarPhotos')).map(item => ({
    name:decode(item.match(/class="title-album">([^<]+)/)?.[1]),url:official(item.match(/<a\b[^>]*>/)?.[0],'album'),
    image:image(attr(item,'data-bkg'))
  })).filter(x=>x.name && x.url).slice(0,4);
  const playlists = items(section('playlistsSidebar')).map(item => {
    const thumb = item.match(/<img[^>]*class="largeThumb[^"]*"[^>]*>/)?.[0];
    return {name:attr(thumb,'alt'),image:image(attr(thumb,'src')),url:official(item.match(/<a\b[^>]*href="[^"]*\/playlist\/[\d]+"[^>]*>/)?.[0],'playlist')};
  }).filter(x=>x.name && x.url).slice(0,4);
  const previews = {};
  for (const match of html.matchAll(/<li\b[^>]*\bdata-video-vkey="([a-z0-9]{8,24})"[^>]*>([\s\S]*?)<\/li>/gi)) {
    const img = match[2].match(/<img\b[^>]*class="[^"]*js-videoThumb[^"]*"[^>]*>/i)?.[0];
    const thumbnail = image(attr(img,'data-mediumthumb') || attr(img,'src'));
    if (thumbnail) previews[match[1]] = {thumbnail,duration:decode(match[2].match(/<var class="duration">([\d:]+)/)?.[1]),channel:decode(match[2].match(/class="usernameWrap">\s*<a[^>]*>([^<]+)/)?.[1])};
  }
  const counts = [...top.matchAll(/<span class="number">\s*([\d,.\s]+)\s*<\/span>/g)].map(match=>match[1].replace(/\D/g,''));
  const stats = counts.length === 3 ? {subscribers:counts[0],videos:counts[1],views:counts[2]} : {};
  return {stats,cover:portrait('coverPictureDefault'),avatar:portrait('getAvatar'),location:decode(top.match(/class="location">\s*([^<]+)/)?.[1]),channels,photos,playlists,previews};
}

const root = 'public/data';
const destination = root + '/partner-profiles';
await mkdir(destination,{recursive:true});
const partners = JSON.parse(await readFile(root+'/partners.json','utf8'));
const videos = JSON.parse(await readFile(root+'/partner-videos.json','utf8'));
let updated = 0;
for (const partner of partners) {
  try {
    if (!/^\d+$/.test(partner.id)) throw new Error('Invalid publisher ID');
    const source = new URL(partner.url);
    if (source.origin !== 'https://www.pornhub.com' || !/^\/users\/[\w.-]+$/.test(source.pathname)) throw new Error('Invalid profile URL');
    const response = await fetch(source,{redirect:'error',signal:AbortSignal.timeout(9000),headers:{'user-agent':'NoxvelloxDirectory/1.0 (+https://noxvellox.site/contact)'}});
    if (!response.ok) throw new Error('HTTP '+response.status);
    const data = extractProfile(await response.text());
    const ids = new Set((videos[partner.id] || []).map(v=>v.id));
    data.previews = Object.fromEntries(Object.entries(data.previews).filter(([id])=>ids.has(id)));
    const file = destination+'/'+partner.id+'.json';
    await writeFile(file+'.tmp',JSON.stringify(data,null,2)+'\n');
    await rename(file+'.tmp',file);
    updated++;
  } catch (error) {
    console.warn('Keeping previous profile for '+partner.id+': '+error.message);
  }
}
console.log('Updated '+updated+' of '+partners.length+' profile layouts');

const channelArt = {};
for (const {id} of partners) {
  if (!/^\d+$/.test(id)) continue;
  try {
    const {cover,avatar} = JSON.parse(await readFile(destination+'/'+id+'.json','utf8'));
    channelArt[id] = {cover,avatar};
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
if (!Object.keys(channelArt).length) throw new Error('No channel profiles available');
await writeFile(root+'/channel-art.json.tmp',JSON.stringify(channelArt,null,2)+'\n');
await rename(root+'/channel-art.json.tmp',root+'/channel-art.json');
