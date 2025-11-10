// public/js/home.js

/* ========== Carousel ========== */
function initCarousel() {
  const el = document.getElementById('carousel');
  if (!el) return;

  const imgs = Array.from(el.querySelectorAll('img'));
  const prev = el.querySelector('.prev');
  const next = el.querySelector('.next');
  const dotsWrap = el.querySelector('.dots');

  if (!imgs.length) return;

  // สร้าง dot ตามจำนวนภาพ
  imgs.forEach((_, i) => {
    const dot = document.createElement('span');
    dot.addEventListener('click', () => { idx = i; show(); restart(); });
    dotsWrap.appendChild(dot);
  });
  const dots = Array.from(dotsWrap.children);

  let idx = 0;
  let timer = null;
  let startX = 0, currentX = 0, dragging = false;
  const INTERVAL = 4000;

  function show() {
    imgs.forEach((im, i) => im.classList.toggle('active', i === idx));
    dots.forEach((d, i)  => d.classList.toggle('active', i === idx));
  }
  function nextSlide() { idx = (idx + 1) % imgs.length; show(); }
  function prevSlide() { idx = (idx - 1 + imgs.length) % imgs.length; show(); }

  function start()  { if (!timer) timer = setInterval(nextSlide, INTERVAL); }
  function stop()   { if (timer) { clearInterval(timer); timer = null; } }
  function restart(){ stop(); start(); }

  // ปุ่มควบคุม
  next?.addEventListener('click', () => { nextSlide(); restart(); });
  prev?.addEventListener('click', () => { prevSlide(); restart(); });

  // Swipe / Drag (มือถือ + เมาส์)
  const onEnd = () => {
    if (!dragging) return; dragging = false;
    const diff = currentX - startX;
    if (Math.abs(diff) > 40) (diff > 0 ? prevSlide() : nextSlide());
    restart();
  };

  el.addEventListener('touchstart',  e => { startX = e.touches[0].clientX; stop(); dragging = true; }, {passive:true});
  el.addEventListener('touchmove',   e => { if (dragging) currentX = e.touches[0].clientX; }, {passive:true});
  el.addEventListener('touchend', onEnd);

  el.addEventListener('mousedown', e => { startX = e.clientX; stop(); dragging = true; });
  el.addEventListener('mousemove', e => { if (dragging) currentX = e.clientX; });
  el.addEventListener('mouseup', onEnd);
  el.addEventListener('mouseleave', () => { dragging = false; });

  // หยุดตอนชี้เมาส์ / ซ่อนแท็บ
  el.addEventListener('mouseenter', stop);
  el.addEventListener('mouseleave', start);
  document.addEventListener('visibilitychange', () => {
    document.hidden ? stop() : start();
  });

  show(); start();
}

/* ========== Our Projects (Portfolio) ========== */

// map รูป fallback ตาม slug ที่มีในฐานข้อมูล (ปรับเพิ่ม/แก้ได้)
const FALLBACK_COVERS = {
  'clinic-queue-system': '/images/BG1.jpg',
  'network-site1':       '/images/network1.jpg',
  'network-site2':       '/images/network.jpg',
  'access-control':      '/images/access_control.jpg'
};
const DEFAULT_COVER = '/images/test3.jpg';

function pickCover(p) {
  // ถ้าใน DB มีฟิลด์ cover (เช่น '/images/xxx.jpg') ใช้เลย
  if (p.cover && typeof p.cover === 'string' && p.cover.trim()) return p.cover;
  // fallback ตาม slug
  if (p.slug && FALLBACK_COVERS[p.slug]) return FALLBACK_COVERS[p.slug];
  // ค่าเริ่มต้น
  return DEFAULT_COVER;
}

async function boot() {
  // Health
  try {
    const h = await fetch('/health').then(r => r.json());
    const el = document.getElementById('status');
    if (el) el.textContent = (h.ok && h.db) ? 'เชื่อมต่อฐานข้อมูลสำเร็จ' : 'เชื่อมต่อฐานข้อมูลไม่สำเร็จ';
  } catch {
    const el = document.getElementById('status');
    if (el) el.textContent = 'ตรวจสุขภาพระบบไม่สำเร็จ';
  }

  // Portfolio → Cards
  try {
    const res = await fetch('/portfolio');
    if (!res.ok) throw new Error(res.status);
    const data = await res.json(); // [{id,title,slug,summary,body,cover,created_at,...}, ...]

    const countEl = document.getElementById('countText');
    const gridEl  = document.getElementById('cardGrid');
    if (!gridEl) return;

    countEl && (countEl.textContent = `ทั้งหมด ${data.length} รายการ`);

    gridEl.innerHTML = data.map(p => {
      const cover = pickCover(p);
      const created = p.created_at ? new Date(p.created_at).toLocaleString() : '-';
      const sum = p.summary || '';
      return `
        <article class="card">
          <img class="cover" src="${cover}" alt="${p.title || ''}"
               onerror="this.src='/images/placeholder.png'">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <div style="font-weight:700">${p.title || '-'}</div>
            <span class="badge">${p.slug || 'no-slug'}</span>
          </div>
          <div class="muted" style="min-height:1.4em">${sum}</div>
          <div class="muted">created: ${created}</div>
        </article>
      `;
    }).join('');
  } catch (e) {
    console.error(e);
    const countEl = document.getElementById('countText');
    const gridEl  = document.getElementById('cardGrid');
    countEl && (countEl.textContent = 'โหลดรายการไม่สำเร็จ');
    gridEl && (gridEl.innerHTML =
      `<div class="badge" style="grid-column:1/-1">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>`);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initCarousel();
  boot();
});
