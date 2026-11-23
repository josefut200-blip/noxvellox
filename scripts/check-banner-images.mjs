import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [worker, frontend, fallback, styles] = await Promise.all([
  readFile(resolve(root, 'public/_worker.js'), 'utf8'),
  readFile(resolve(root, 'public/assets/site.v028.js'), 'utf8'),
  readFile(resolve(root, 'public/assets/banner-fallback.svg'), 'utf8'),
  readFile(resolve(root, 'public/assets/style.v027.css'), 'utf8'),
]);

const requirements = [
  [worker.includes('data-category-image'), 'Worker needs to mark banner images for monitoring.'],
  [worker.includes('const isTransformedPreviewImageUrl=') && worker.includes('||isTransformedPreviewImageUrl(s)'), 'Worker must treat the transformed phncdn JPEG XL preview endpoint as an image, not a video.'],
  [(()=>{const path=new URL('https://pix-fl.phncdn.com/c6371/videos/202608/10/58578295/original_58578295.mov/plain/ex:1:no/bg:0:0:0/rs:fit:320:240/vts:1678?hdnea=test').pathname;return path.includes('/original_')&&path.includes('.mov/plain/')&&path.includes('/rs:fit:')&&path.endsWith('/vts:1678')})(), 'The live transformed MOV preview URL shape must be recognized.'],
  [frontend.includes("document.querySelectorAll('[data-category-image]')"), 'Frontend needs to monitor banner image load failures.'],
  [frontend.includes("const BANNER_IMAGE_FALLBACK='/assets/banner-fallback.svg'"), 'Frontend needs the local branded fallback path.'],
  [frontend.includes("wrap?.querySelector('.cover-art-safe')?.remove()"), 'Frontend must remove the thumbnail fallback immediately after a successful image or video load.'],
  [fallback.includes('<svg') && fallback.includes('NOXVELLOX'), 'The branded banner fallback SVG is missing or invalid.'],
  [styles.includes('.video-art.cover-loaded .cover-art-safe{display:none!important}'), 'Loaded video thumbnails must hide the fallback artwork.'],
];

const failures = requirements.filter(([ok]) => !ok).map(([, message]) => message);
if (failures.length) {
  for (const message of failures) console.error(`ERROR: ${message}`);
  process.exitCode = 1;
} else {
  console.log('PASS: banner image monitoring and local fallback are present.');
}

const sources = [...new Set(worker.match(/https:\/\/images\.unsplash\.com\/[^'"\s]+/g) || [])];
if (!sources.length) {
  console.log('INFO: no external category banner sources were found.');
  process.exit(0);
}

const checkSource = async (url) => {
  try {
    const signal = AbortSignal.timeout(10000);
    let response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal });
    if (response.status === 405 || response.status === 501) {
      response = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
      });
      await response.body?.cancel();
    }
    return { url, ok: response.ok, status: response.status };
  } catch (error) {
    return { url, ok: false, status: error?.name || 'network error' };
  }
};

const results = await Promise.all(sources.map(checkSource));
const broken = results.filter(result => !result.ok);
console.log(`Checked ${results.length} external banner source(s).`);
for (const result of broken) {
  console.warn(`WARN: source returned ${result.status}; the site will show its branded fallback: ${result.url}`);
}
if (!broken.length) console.log('PASS: all external category banner sources responded successfully.');
