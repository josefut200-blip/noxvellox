(() => {
  for (const root of document.querySelectorAll('[data-channel-carousel]')) {
    if (root.dataset.ready) continue;
    const slides = JSON.parse(root.querySelector('script').textContent);
    if (slides.length < 2) continue;
    root.dataset.ready = 'yes';
    const link = root.querySelector('.nv-slide');
    const title = link.querySelector('strong');
    const controls = root.querySelector('.nv-controls');
    const pause = controls.querySelector('[data-pause]');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let paused = reduced.matches;
    let index = 0;
    let request = 0;
    let timer;
    const failed = new Set();

    function nextIndex(from, step) {
      let candidate = from;
      for (let count = 0; count < slides.length; count++) {
        candidate = (candidate + step + slides.length) % slides.length;
        if (!failed.has(candidate)) return candidate;
      }
      return index;
    }
    function advance(step) {
      const token = ++request;
      function show(candidate) {
        if (candidate === index) return;
        const slide = slides[candidate];
        const img = new Image();
        img.alt = '';
        img.onload = () => {
          if (request !== token) return;
          link.querySelector('img').replaceWith(img);
          title.textContent = slide.name;
          link.href = slide.href;
          index = candidate;
        };
        img.onerror = () => {
          if (request !== token) return;
          failed.add(candidate);
          show(nextIndex(candidate,step));
        };
        img.src = slide.cover;
      }
      show(nextIndex(index,step));
    }
    function schedule() {
      clearInterval(timer);
      pause.textContent = paused ? 'Play' : 'Pause';
      pause.setAttribute('aria-label',paused ? 'Start banner rotation' : 'Pause banner rotation');
      if (!paused && !document.hidden) timer = setInterval(()=>advance(1),4000);
    }
    controls.hidden = false;
    pause.onclick = () => { paused = !paused; request++; schedule(); };
    controls.querySelector('[data-prev]').onclick = () => { advance(-1); schedule(); };
    controls.querySelector('[data-next]').onclick = () => { advance(1); schedule(); };
    link.addEventListener('focus',()=>{paused=true;request++;schedule()});
    document.addEventListener('visibilitychange',schedule);
    reduced.addEventListener('change',()=>{paused=reduced.matches; schedule()});
    schedule();
  }
})();