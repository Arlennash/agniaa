// Scroll reveal: tambah .in sekali saja, lalu berhenti diamati
const revealObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('in');
    observer.unobserve(entry.target);
  });
}, { threshold: 0.15 });

document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

// Modal foto (pakai <dialog>, Escape sudah ditangani browser)
const viewer = document.getElementById('viewer');
const viewerImg = viewer.querySelector('img');
const viewerCaption = viewer.querySelector('p');

document.querySelector('.grid').addEventListener('click', (e) => {
  const thumb = e.target.closest('.thumb');
  if (!thumb) return;

  viewerImg.src = thumb.dataset.full;
  viewerImg.alt = thumb.dataset.caption;
  viewerCaption.textContent = thumb.dataset.caption;
  viewer.showModal();
});

// Klik area gelap di luar kartu untuk menutup
viewer.addEventListener('click', (e) => {
  if (e.target === viewer) viewer.close();
});

// Buka dan tutup surat
const seal = document.querySelector('.seal');
const paper = document.getElementById('isi-surat');

seal.addEventListener('click', () => {
  const isOpen = paper.classList.toggle('open');
  seal.setAttribute('aria-expanded', isOpen);
  seal.textContent = isOpen ? 'Tutup surat' : 'Buka surat';
});

// Selama foto belum diganti, sembunyikan ikon gambar rusak
document.querySelectorAll('.hero-photo img, .grid img').forEach((img) => {
  img.addEventListener('error', () => { img.hidden = true; });
});

// Urutan muncul (dipakai CSS lewat --i) untuk foto galeri dan paragraf surat
document.querySelectorAll('.grid li').forEach((el, i) => el.style.setProperty('--i', i));
document.querySelectorAll('.page p').forEach((el, i) => el.style.setProperty('--i', i));

// Navigasi
const nav = document.querySelector('.nav');
const navLinks = [...nav.querySelectorAll('a')];
let activeLink = navLinks[0];
let isJumping = false;
let jumpCancelled = false;

// Tandai link aktif dan geser indikator kaca ke posisinya
function setActive(link) {
  activeLink = link;
  navLinks.forEach((l) => l.setAttribute('aria-current', l === link));
  nav.style.setProperty('--ind-x', `${link.offsetLeft}px`);
  nav.style.setProperty('--ind-w', `${link.offsetWidth}px`);
}

// Scroll dengan easing. Blur mengikuti kecepatan: makin cepat, makin buram
function scrollToY(targetY, duration = 1100) {
  const startY = window.scrollY;
  const endY = Math.min(targetY, document.documentElement.scrollHeight - innerHeight);

  const startTime = performance.now();
  const ease = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
  let lastY = startY;
  let lastTime = startTime;
  let lastLevel = -1;

  isJumping = true;
  jumpCancelled = false;
  document.body.classList.add('is-jumping');

  function frame(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const y = startY + (endY - startY) * ease(t);
    scrollTo({ top: y, behavior: 'instant' });

    const speed = Math.abs(y - lastY) / Math.max(now - lastTime, 1); // px per ms
    const level = Math.round(Math.min(speed * 0.9, 5)); // dibulatkan supaya blur tidak dihitung ulang tiap frame
    if (level !== lastLevel) {
      document.documentElement.style.setProperty('--motion-blur', `${level}px`);
      lastLevel = level;
    }
    lastY = y;
    lastTime = now;

    if (t < 1 && !jumpCancelled) return requestAnimationFrame(frame);
    document.body.classList.remove('is-jumping');
    isJumping = false;
  }
  requestAnimationFrame(frame);
}

nav.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (!link) return;
  e.preventDefault();

  const target = document.querySelector(link.hash);
  setActive(link);
  scrollToY(link.hash === '#beranda' ? 0 : target.getBoundingClientRect().top + scrollY - 16);
});

// Scroll manual membatalkan animasi yang sedang berjalan
['wheel', 'touchstart'].forEach((type) => {
  addEventListener(type, () => { jumpCancelled = true; }, { passive: true });
});

// Scrollspy: ikuti bagian yang sedang di tengah layar (diabaikan saat animasi jalan)
const spy = new IntersectionObserver((entries) => {
  if (isJumping) return;
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    setActive(navLinks.find((l) => l.hash === `#${entry.target.id}`));
  });
}, { rootMargin: '-45% 0px -50% 0px' });

document.querySelectorAll('#beranda, #kenangan, #video, #surat').forEach((el) => spy.observe(el));

// Ukur ulang indikator setelah font siap dan saat layar berubah ukuran
const refreshIndicator = () => setActive(activeLink);
document.fonts.ready.then(refreshIndicator);
addEventListener('resize', refreshIndicator);

// Carousel foto (mobile): titik penunjuk mengikuti geseran
const track = document.querySelector('.grid');
const dots = document.querySelector('.dots');
const slides = [...track.children];

slides.forEach((slide, i) => {
  const dot = document.createElement('button');
  dot.type = 'button';
  dot.setAttribute('aria-label', `Foto ${i + 1}`);
  dot.addEventListener('click', () => {
    slide.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  });
  dots.append(dot);
});

function updateDots() {
  const mid = track.scrollLeft + track.clientWidth / 2;
  const distance = (slide) => Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - mid);
  const current = slides.indexOf(slides.reduce((a, b) => (distance(a) <= distance(b) ? a : b)));
  [...dots.children].forEach((dot, i) => dot.setAttribute('aria-current', i === current));
}

track.addEventListener('scroll', updateDots, { passive: true });
updateDots();

// Pemutar voice note
const vn = document.querySelector('.vn');
const vnAudio = vn.querySelector('audio');
const vnPlay = vn.querySelector('.vn-play');
const vnWave = vn.querySelector('.vn-wave');
const vnNow = vn.querySelector('.vn-now');
const vnDur = vn.querySelector('.vn-dur');
const mainVideo = document.querySelector('.video video');
const BAR_COUNT = 44;
let lastFilled = -1;
let lastClock = '';

// Bentuk gelombang dibuat dari pola sinus, bukan data asli rekaman
for (let i = 0; i < BAR_COUNT; i++) {
  const bar = document.createElement('span');
  const height = 0.3 + 0.7 * Math.abs(Math.sin(i * 0.55) * Math.cos(i * 0.19 + 1));
  bar.style.setProperty('--h', height.toFixed(2));
  bar.style.setProperty('--i', i);
  vnWave.append(bar);
}
const bars = [...vnWave.children];

const formatTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function renderProgress() {
  const ratio = vnAudio.duration ? vnAudio.currentTime / vnAudio.duration : 0;
  const filled = Math.round(ratio * BAR_COUNT);
  if (filled !== lastFilled) {
    bars.forEach((bar, i) => bar.classList.toggle('played', i < filled));
    vnWave.setAttribute('aria-valuenow', Math.round(ratio * 100));
    lastFilled = filled;
  }
  const clock = formatTime(vnAudio.currentTime);
  if (clock !== lastClock) {
    vnNow.textContent = clock;
    lastClock = clock;
  }
}

function seekTo(seconds) {
  if (!vnAudio.duration) return;
  vnAudio.currentTime = Math.min(Math.max(seconds, 0), vnAudio.duration);
  renderProgress();
}

function showDuration() { vnDur.textContent = formatTime(vnAudio.duration); }
vnAudio.addEventListener('loadedmetadata', showDuration);
vnAudio.addEventListener('timeupdate', renderProgress); // cukup ~4x per detik, tanpa loop animasi
if (vnAudio.readyState >= 1) showDuration();

vnPlay.addEventListener('click', () => (vnAudio.paused ? vnAudio.play() : vnAudio.pause()));

function setPlayingUI(isPlaying) {
  vn.classList.toggle('playing', isPlaying);
  vnPlay.setAttribute('aria-pressed', isPlaying);
  vnPlay.setAttribute('aria-label', isPlaying ? 'Jeda rekaman' : 'Putar rekaman');
}

vnAudio.addEventListener('play', () => {
  setPlayingUI(true);
  mainVideo?.pause(); // satu suara saja dalam satu waktu
  renderProgress();
});
vnAudio.addEventListener('pause', () => setPlayingUI(false));

// Selesai satu rekaman: lanjut ke rekaman berikutnya, atau kembali ke awal kalau sudah yang terakhir
vnAudio.addEventListener('ended', () => {
  if (vnCurrent < vnTracks.length - 1) loadVn(vnCurrent + 1, true);
  else seekTo(0);
});
mainVideo?.addEventListener('play', () => vnAudio.pause());

// Seek: ketuk/klik gelombang, atau seret. Tap dipakai agar scroll vertikal tidak ikut menggeser rekaman
const seekFromPointer = (e) => {
  const rect = vnWave.getBoundingClientRect();
  seekTo(((e.clientX - rect.left) / rect.width) * vnAudio.duration);
};
vnWave.addEventListener('click', seekFromPointer);
vnWave.addEventListener('pointerdown', (e) => vnWave.setPointerCapture(e.pointerId));
vnWave.addEventListener('pointermove', (e) => {
  if (vnWave.hasPointerCapture(e.pointerId)) seekFromPointer(e);
});
vnWave.addEventListener('keydown', (e) => {
  const step = { ArrowRight: 5, ArrowLeft: -5 }[e.key];
  if (!step) return;
  e.preventDefault();
  seekTo(vnAudio.currentTime + step);
});

// File rekaman belum ada: nonaktifkan tombol putar
vnAudio.addEventListener('error', () => { vnPlay.disabled = true; });

// Daftar rekaman: satu <audio> dipakai bergantian supaya lanjut otomatis tetap diizinkan di HP
const vnTracks = [...vn.querySelectorAll('.vn-track')];
const vnTitle = vn.querySelector('.vn-title');
const vnSub = vn.querySelector('.vn-sub');
let vnCurrent = 0;

function loadVn(index, autoplay = false) {
  const track = vnTracks[index];
  vnCurrent = index;
  vnAudio.src = track.dataset.src;
  vnTitle.textContent = track.dataset.title;
  vnSub.textContent = track.dataset.sub;
  vnTracks.forEach((t, i) => t.setAttribute('aria-current', i === index));
  vnPlay.disabled = false;
  vnDur.textContent = '0:00';
  setPlayingUI(false);
  renderProgress();
  if (autoplay) vnAudio.play();
}

vnTracks.forEach((track, i) => {
  track.parentElement.style.setProperty('--i', i);
  track.querySelector('.vn-num').innerHTML = `<b>${i + 1}</b><i></i><i></i><i></i>`;
  track.querySelector('.vn-name').textContent = track.dataset.title;

  track.addEventListener('click', () => {
    if (i !== vnCurrent) loadVn(i, true);
    else if (vnAudio.paused) vnAudio.play();
    else vnAudio.pause();
  });

  // Ambil durasi tiap rekaman untuk ditampilkan di daftar
  const probe = new Audio();
  probe.preload = 'metadata';
  probe.src = track.dataset.src;
  probe.addEventListener('loadedmetadata', () => {
    track.querySelector('.vn-len').textContent = formatTime(probe.duration);
  });
});

loadVn(0);

// Blob latar berhenti sebentar selama scroll supaya efek kaca tidak dihitung ganda
let scrollTimer;
addEventListener('scroll', () => {
  document.documentElement.classList.add('is-scrolling');
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => document.documentElement.classList.remove('is-scrolling'), 150);
}, { passive: true });
