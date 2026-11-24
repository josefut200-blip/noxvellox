import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const taxonomy = JSON.parse(readFileSync(resolve(root, 'public/data/taxonomy.json'), 'utf8'));
const worker = readFileSync(resolve(root, 'public/_worker.js'), 'utf8');
const helperStart = worker.indexOf('function introWordCount(value)');
assert.notEqual(helperStart, -1, 'Worker must define category indexing helpers');
const helperEnd = worker.indexOf('async function ensureTaxonomySchema', helperStart);
const helperSource = worker.slice(helperStart, helperEnd < 0 ? worker.length : helperEnd);
const { introWordCount, indexableCategory } = new Function(helperSource + '; return {introWordCount,indexableCategory};')();
const classifierStart=worker.indexOf('function normalizeTaxonomyToken(value){');
const classifierEnd=worker.indexOf('function normalizeLanguage(value,taxonomy){',classifierStart);
const classifierSource=worker.slice(classifierStart,classifierEnd);
const classifier=new Function(classifierSource+'; return {normalizeTaxonomyToken,rawTagList,buildAliasMap,classifyOfficialMetadata};')();
const taxonomyForClassification={...taxonomy,categories,categoryBySlug:Object.fromEntries(categories.map(category=>[category.slug,category]))};
taxonomyForClassification.blockedSet=new Set(taxonomy.blockedTags.map(classifier.normalizeTaxonomyToken));
taxonomyForClassification.categoryAliases=classifier.buildAliasMap(categories);
taxonomyForClassification.formatAliases=classifier.buildAliasMap(taxonomy.formats);
const pageStart = worker.indexOf('function taxonomyCategoryPage({');
const pageEnd = worker.indexOf('\nfunction collectionPage(', pageStart);
assert.notEqual(pageStart, -1, 'Worker must define category page renderer');
const pageSource = worker.slice(pageStart, pageEnd < 0 ? worker.length : pageEnd);
const renderCategory = new Function('shell','esc','card','officialCard','adSlot','taxonomyFilterForm','introWordCount','indexableCategory',
  pageSource + '; return taxonomyCategoryPage;'
) (options => options, value => String(value), video => '<article>' + video.title + '</article>', video => '<official-card>' + video.title + '</official-card>', () => '', () => '<form></form>', introWordCount, indexableCategory);
const categories = taxonomy.groups.flatMap(group => group.categories);
const brazilian = categories.find(category => category.slug === 'brazilian');
test('taxonomy has unique category slugs and 80-120 word English intros', () => {
  assert.equal(categories.length, 56);
  assert.equal(new Set(categories.map(category => category.slug)).size, categories.length);
  for (const category of categories) {
    const words = introWordCount(category.intro_en);
    assert.ok(words >= taxonomy.indexing.minimumIntroWords, category.slug + ' has only ' + words + ' intro words');
    assert.ok(words <= taxonomy.indexing.maximumIntroWords, category.slug + ' has ' + words + ' intro words');
  }
});
test('blocked source tags are never category aliases', () => {
  const aliases = new Set(categories.flatMap(category => category.aliases || []).map(alias => alias.trim().toLowerCase()));
  for (const blocked of taxonomy.blockedTags) assert.equal(aliases.has(blocked.toLowerCase()), false, blocked);
});
test('official tags and title keywords map to categories and separate formats', () => {
  const result=classifier.classifyOfficialMetadata({title:'Amateur POV with Asian MILF',raw_tags:['Big Tits','MILF']},taxonomyForClassification);
  assert.deepEqual(new Set(result.categories),new Set(['amateur','pov','asian','mature-women','busty']));
  const compilation=classifier.classifyOfficialMetadata({title:'Compilation of Amateur POV',raw_tags:[]},taxonomyForClassification);
  assert.ok(compilation.categories.includes('amateur'));
  assert.ok(compilation.categories.includes('pov'));
  assert.ok(compilation.formats.includes('compilation'));
  assert.equal(compilation.categories.includes('compilation'),false);
});
test('blocked and unsupported terms do not create category assignments', () => {
  const blocked=classifier.classifyOfficialMetadata({title:'Step fantasy POV',raw_tags:['POV','Amateur']},taxonomyForClassification);
  assert.equal(blocked.blocked,true);
  assert.deepEqual(blocked.categories,[]);
  const unsupported=classifier.classifyOfficialMetadata({title:'Japanese Massage Creampie',raw_tags:[]},taxonomyForClassification);
  assert.deepEqual(unsupported.categories,[]);
  assert.deepEqual(unsupported.formats,[]);
});
test('category indexability requires 20 videos and a valid intro length', () => {
  assert.equal(taxonomy.indexing.minimumPublishedVideos, 20);
  assert.equal(indexableCategory(brazilian, 19, taxonomy), false);
  assert.equal(indexableCategory(brazilian, 20, taxonomy), true);
  assert.equal(indexableCategory({...brazilian, intro_en: 'short intro'}, 20, taxonomy), false);
  assert.equal(indexableCategory({...brazilian, intro_en: Array(122).fill('word').join(' ')}, 20, taxonomy), false);
});
test('category directory marks an approved 20-video category indexable for the sitemap', async () => {
  const start = worker.indexOf('async function categoryDirectory(db,taxonomy,limit=30){');
  const end = worker.indexOf('\nasync function taxonomyCategoryVideos(', start);
  assert.notEqual(start, -1, 'Worker must define the category directory query');
  assert.notEqual(end, -1, 'Worker category directory boundary must exist');
  const categoryDirectory = new Function('indexableCategory','MIN_VIDEO_DURATION_SECONDS','MIN_OFFICIAL_DURATION_SECONDS', worker.slice(start, end) + '; return categoryDirectory;')(indexableCategory, 900, 60);
  const row = {...brazilian, group_slug:'performers-origin', group_name:'Performers & Origin', count:20};
  let query='';
  const db = {prepare(sql){ query=sql; return {bind(){ return {all:async()=>({results:[row]})}; }}; }};
  const [entry] = await categoryDirectory(db, taxonomy, 500);
  assert.ok(query.includes('official_embed_categories'));
  assert.equal(entry.seo_indexable, true);
  assert.equal(entry.count, 20);
});
test('sitemap adds eligible categories before optional video queries', () => {
  const routeStart = worker.indexOf("if(path==='/sitemap.xml'){");
  const routeEnd = worker.indexOf("if(req.method!=='GET'", routeStart);
  assert.notEqual(routeStart, -1, 'Worker must define the sitemap route');
  const sitemapRoute = worker.slice(routeStart, routeEnd);
  assert.ok(sitemapRoute.indexOf('const categoryPages=await categoryDirectory') < sitemapRoute.indexOf('const published=await db.prepare'));
  assert.ok(sitemapRoute.indexOf('const categoryPages=await categoryDirectory') < sitemapRoute.indexOf('const official=await db.prepare'));
});
test('category renderer shows the 20 cards, index directive, and clean canonical', () => {
  const videos = Array.from({length: 20}, (_, index) => ({title: 'Preview fixture ' + (index + 1)}));
  const page = renderCategory({base:'https://noxvellox.site',url:'https://noxvellox.site/category/brazilian',category:brazilian,videos,total:20,taxonomy,filters:{}});
  assert.equal(page.robots, 'index,follow');
  assert.equal(page.canonical, 'https://noxvellox.site/category/brazilian');
  assert.equal((page.body.match(/<article>/g) || []).length, 20);
  assert.match(page.body, /Preview fixture 20/);
});
test('shallow and filtered category pages stay noindex and canonicalize cleanly', () => {
  const shallow = renderCategory({base:'https://noxvellox.site',url:'https://noxvellox.site/category/brazilian',category:brazilian,videos:[],total:19,taxonomy,filters:{}});
  assert.equal(shallow.robots, 'noindex,follow');
  const filtered = renderCategory({base:'https://noxvellox.site',url:'https://noxvellox.site/category/brazilian?lang=english&res=1080p',category:brazilian,videos:[],total:20,taxonomy,filters:{}});
  assert.equal(filtered.robots, 'noindex,follow');
  assert.equal(filtered.canonical, 'https://noxvellox.site/category/brazilian');
});

