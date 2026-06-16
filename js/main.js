import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, orderBy, limit, where, serverTimestamp, increment
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { firebaseConfig, COLLECTIONS, SETTINGS_DOC_ID } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const PHONE_REGEX = /^\+7\d{10}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LIKED_KEY = 'college_liked_comments';
const COMMENT_RATE_KEY = 'college_comment_last_time';
const NEWS_LIMIT = 6;

let allNews = [];
let newsShown = 0;
let clientIP = null;

/* ── Utilities ── */

function $(id) { return document.getElementById(id); }

function showToast(message, type = 'success') {
  const toast = $('toast');
  toast.textContent = message;
  toast.className = `toast toast-${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3500);
}

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getLikedComments() {
  try { return JSON.parse(localStorage.getItem(LIKED_KEY) || '[]'); }
  catch { return []; }
}

function setLikedComment(id) {
  const liked = getLikedComments();
  if (!liked.includes(id)) {
    liked.push(id);
    localStorage.setItem(LIKED_KEY, JSON.stringify(liked));
  }
}

function canPostComment() {
  const last = localStorage.getItem(COMMENT_RATE_KEY);
  if (!last) return true;
  return Date.now() - parseInt(last, 10) > 3600000;
}

function markCommentPosted() {
  localStorage.setItem(COMMENT_RATE_KEY, String(Date.now()));
}

async function getClientIP() {
  if (clientIP) return clientIP;
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    clientIP = data.ip;
  } catch {
    clientIP = 'unknown';
  }
  return clientIP;
}

/* ── Navigation ── */

function initNav() {
  const toggle = $('nav-toggle');
  const nav = $('nav');

  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });

  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => nav.classList.remove('open'));
  });

  const sections = document.querySelectorAll('section[id]');
  const navLinks = nav.querySelectorAll('a');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(l => l.classList.remove('active'));
        const active = nav.querySelector(`a[href="#${entry.target.id}"]`);
        if (active) active.classList.add('active');
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  sections.forEach(s => observer.observe(s));
}

/* ── Settings ── */

function getLogoFallbackText(name) {
  if (!name?.trim()) return 'К';
  const cleaned = name.trim().replace(/["«»]/g, '');
  const words = cleaned.split(/\s+/).filter(w => w.length > 1);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return cleaned.slice(0, 2).toUpperCase();
}

function applySiteLogo(logoUrl, collegeName) {
  const img = $('site-logo');
  const fallback = $('logo-fallback');
  if (!img) return;

  if (fallback) {
    fallback.textContent = getLogoFallbackText(collegeName || $('site-name')?.textContent);
  }

  img.onerror = () => {
    img.style.display = 'none';
    fallback?.classList.add('visible');
  };

  img.onload = () => {
    img.style.display = '';
    fallback?.classList.remove('visible');
  };

  const url = logoUrl?.trim();
  if (!url) return;

  img.src = url;
}

function renderAboutText(text) {
  const el = $('about-text');
  if (!el) return;
  if (!text?.trim()) {
    el.innerHTML = '';
    return;
  }
  const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(Boolean);
  el.innerHTML = paragraphs.length
    ? paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('')
    : `<p>${escapeHtml(text)}</p>`;
}

function renderAboutAdvantages(items) {
  const grid = $('about-advantages');
  if (!grid) return;
  grid.innerHTML = '';
  if (!Array.isArray(items) || !items.length) return;

  items.forEach((label, i) => {
    grid.insertAdjacentHTML('beforeend', `
      <div class="stat-card">
        <span class="stat-number">${i + 1}</span>
        <span class="stat-label">${escapeHtml(label)}</span>
      </div>
    `);
  });
}

function renderAboutBlock(id, title, text) {
  const el = $(id);
  if (!el) return;
  if (!text?.trim()) {
    el.innerHTML = '';
    el.classList.add('hidden');
    return;
  }
  el.innerHTML = `
    <h3 class="about-extra-title">${escapeHtml(title)}</h3>
    <div class="about-extra-text">${escapeHtml(text.trim()).replace(/\n/g, '<br>')}</div>
  `;
  el.classList.remove('hidden');
}

async function loadSettings() {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOC_ID));
    if (!snap.exists()) return;
    const s = snap.data();

    if (s.collegeName) {
      $('site-name').textContent = s.collegeName;
      $('hero-title').textContent = s.collegeName;
      $('footer-name').textContent = s.collegeName;
      $('footer-copy-name').textContent = s.collegeName;
      document.title = s.collegeName;
    }
    if (s.tagline) $('hero-tagline').textContent = s.tagline;
    applySiteLogo(s.logoUrl, s.collegeName);

    renderAboutText(s.aboutText);
    renderAboutAdvantages(s.aboutAdvantages);
    renderAboutBlock('about-nutrition', 'Питание', s.aboutNutrition);
    renderAboutBlock('about-extra', 'Дополнительная информация', s.aboutExtra || s.aboutOtherInfo);

    if (s.address) $('footer-address').textContent = s.address;
    if (s.phone) {
      $('footer-phone').textContent = s.phone;
      $('footer-phone').href = `tel:${s.phone.replace(/\D/g, '')}`;
    }
    if (s.email) {
      $('footer-email').textContent = s.email;
      $('footer-email').href = `mailto:${s.email}`;
    }
    if (s.socials) renderSocials(s.socials);
  } catch (e) {
    console.warn('Settings load failed:', e);
  }
}

function renderSocials(socials) {
  const container = $('social-links');
  const labels = { instagram: 'IG', facebook: 'FB', telegram: 'TG', youtube: 'YT', whatsapp: 'WA' };
  container.innerHTML = Object.entries(socials)
    .filter(([, url]) => url)
    .map(([key, url]) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" aria-label="${key}" title="${key}">${labels[key] || key}</a>`)
    .join('');
}

/* ── Specializations ── */

async function loadSpecializations() {
  const grid = $('specs-grid');
  const select = $('apply-spec');
  try {
    const q = query(collection(db, COLLECTIONS.SPECIALIZATIONS), orderBy('order', 'asc'));
    const snap = await getDocs(q);
    if (snap.empty) {
      grid.innerHTML = '<p class="empty-state">Специальности скоро появятся</p>';
      return;
    }

    grid.innerHTML = '';
    select.innerHTML = '<option value="">Выберите специальность</option>';

    snap.forEach(docSnap => {
      const s = docSnap.data();
      const formLabel = s.studyForm === 'part-time' ? 'Заочная' : 'Очная';

      grid.insertAdjacentHTML('beforeend', `
        <div class="card" data-id="${docSnap.id}">
          <div class="card-body">
            <h3 class="card-title">${escapeHtml(s.name)}</h3>
            <div class="card-meta">
              <span class="badge">${escapeHtml(s.duration || '')}</span>
              <span class="badge badge-accent">${formLabel}</span>
            </div>
            <p class="card-text">${escapeHtml(s.shortDescription || '')}</p>
            <div class="card-expand">
              <p class="card-text">${escapeHtml(s.fullDescription || s.shortDescription || '')}</p>
            </div>
            <button class="card-toggle" aria-expanded="false">Подробнее</button>
          </div>
        </div>
      `);

      select.insertAdjacentHTML('beforeend',
        `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`
      );
    });

    grid.querySelectorAll('.card-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.card');
        const expanded = card.classList.toggle('expanded');
        btn.textContent = expanded ? 'Свернуть' : 'Подробнее';
        btn.setAttribute('aria-expanded', expanded);
      });
    });
  } catch (e) {
    grid.innerHTML = '<p class="empty-state">Ошибка загрузки специальностей</p>';
    console.warn(e);
  }
}

/* ── News ── */

function isNewsPublished(item) {
  return item.published === true || item.published === undefined || item.published === null;
}

function getNewsTimestamp(item) {
  if (!item.date) return 0;
  if (item.date.toDate) return item.date.toDate().getTime();
  if (item.date.seconds) return item.date.seconds * 1000;
  return new Date(item.date).getTime();
}

async function fetchNewsItems() {
  try {
    const q = query(
      collection(db, COLLECTIONS.NEWS),
      where('published', '==', true),
      orderBy('date', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn('News indexed query failed, loading all and filtering client-side:', err);
    const snap = await getDocs(collection(db, COLLECTIONS.NEWS));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(isNewsPublished)
      .sort((a, b) => getNewsTimestamp(b) - getNewsTimestamp(a));
  }
}

async function loadNews() {
  const grid = $('news-grid');
  try {
    allNews = await fetchNewsItems();
    newsShown = 0;
    renderNews();
  } catch (e) {
    grid.innerHTML = '<p class="empty-state">Ошибка загрузки новостей</p>';
    console.warn(e);
  }
}

function renderNews() {
  const grid = $('news-grid');
  const showMoreWrap = $('news-show-more-wrap');

  if (!allNews.length) {
    grid.innerHTML = '<p class="empty-state">Новостей пока нет</p>';
    showMoreWrap.classList.add('hidden');
    return;
  }

  const toShow = allNews.slice(newsShown, newsShown + NEWS_LIMIT);
  if (newsShown === 0) grid.innerHTML = '';

  toShow.forEach(n => {
    grid.insertAdjacentHTML('beforeend', `
      <article class="card news-card">
        <div class="card-body">
          <time class="news-date">${formatDate(n.date)}</time>
          <h3 class="card-title">${escapeHtml(n.title)}</h3>
          <p class="card-text news-preview">${escapeHtml(n.preview || n.text?.substring(0, 150) || '')}</p>
          <div class="news-full">
            <p class="card-text">${escapeHtml(n.text || '')}</p>
          </div>
        </div>
      </article>
    `);
  });

  newsShown += toShow.length;
  showMoreWrap.classList.toggle('hidden', newsShown >= allNews.length);

  grid.querySelectorAll('.news-card:not([data-bound])').forEach(card => {
    card.setAttribute('data-bound', '1');
    card.querySelector('.card-body').addEventListener('click', () => {
      card.classList.toggle('expanded');
    });
  });
}

$('news-show-more')?.addEventListener('click', renderNews);

/* ── Gallery ── */

async function fetchGalleryItems() {
  try {
    const q = query(collection(db, COLLECTIONS.GALLERY), orderBy('order', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn('Gallery orderBy failed, loading all photos:', err);
    const snap = await getDocs(collection(db, COLLECTIONS.GALLERY));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
}

function sortGalleryItems(items) {
  return items.sort((a, b) => {
    const orderDiff = (a.order ?? 0) - (b.order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    const aTime = a.createdAt?.seconds ?? 0;
    const bTime = b.createdAt?.seconds ?? 0;
    return aTime - bTime;
  });
}

function renderGalleryItem(g) {
  if (!g.url) return null;

  const item = document.createElement('div');
  item.className = 'gallery-item';

  const img = document.createElement('img');
  img.src = g.url;
  img.alt = g.caption || 'Фото колледжа';
  img.loading = 'lazy';
  img.width = 300;
  img.height = 200;

  item.appendChild(img);
  item.addEventListener('click', () => openLightbox(g.url, g.caption || ''));
  return item;
}

async function loadGallery() {
  const grid = $('gallery-grid');
  try {
    const items = sortGalleryItems(await fetchGalleryItems());
    if (!items.length) {
      grid.innerHTML = '<p class="empty-state">Фотографии скоро появятся</p>';
      return;
    }

    grid.innerHTML = '';
    items.forEach(g => {
      const el = renderGalleryItem(g);
      if (el) grid.appendChild(el);
    });
  } catch (e) {
    grid.innerHTML = '<p class="empty-state">Ошибка загрузки галереи</p>';
    console.warn(e);
  }
}

function openLightbox(src, caption) {
  $('lightbox-img').src = src;
  $('lightbox-img').alt = caption;
  $('lightbox-caption').textContent = caption;
  $('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  $('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}

$('lightbox-close').addEventListener('click', closeLightbox);
$('lightbox').addEventListener('click', e => { if (e.target === $('lightbox')) closeLightbox(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

/* ── Comments ── */

function renderCommentItem(docId, c, liked) {
  const isLiked = liked.includes(docId);
  const item = document.createElement('div');
  item.className = 'comment-item';
  item.dataset.id = docId;

  item.innerHTML = `
    <div class="comment-header">
      <span class="comment-author">${escapeHtml(c.name)}</span>
      <time class="comment-date">${formatDate(c.createdAt)}</time>
    </div>
    <p class="comment-text">${escapeHtml(c.text)}</p>
    <div class="comment-actions">
      <button class="like-btn ${isLiked ? 'liked' : ''}" data-id="${docId}" ${isLiked ? 'disabled' : ''}>
        ♥ <span class="like-count">${c.likes || 0}</span>
      </button>
    </div>
  `;

  const likeBtn = item.querySelector('.like-btn:not([disabled])');
  if (likeBtn) {
    likeBtn.addEventListener('click', () => likeComment(docId, likeBtn));
  }
  return item;
}

async function loadComments() {
  const list = $('comments-list');
  try {
    const q = query(collection(db, COLLECTIONS.COMMENTS), orderBy('createdAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    if (snap.empty) {
      list.innerHTML = '<p class="empty-state">Будьте первым, кто оставит отзыв!</p>';
      return;
    }

    const liked = getLikedComments();
    list.innerHTML = '';

    snap.forEach(docSnap => {
      list.appendChild(renderCommentItem(docSnap.id, docSnap.data(), liked));
    });
  } catch (e) {
    list.innerHTML = '<p class="empty-state">Ошибка загрузки комментариев</p>';
    console.warn(e);
  }
}

async function likeComment(id, btn) {
  if (getLikedComments().includes(id)) return;
  try {
    await updateDoc(doc(db, COLLECTIONS.COMMENTS, id), { likes: increment(1) });
    setLikedComment(id);
    btn.classList.add('liked');
    btn.disabled = true;
    const countEl = btn.querySelector('.like-count');
    countEl.textContent = parseInt(countEl.textContent, 10) + 1;
  } catch (e) {
    showToast('Не удалось поставить лайк', 'error');
  }
}

$('comment-form').addEventListener('submit', async e => {
  e.preventDefault();
  const name = $('comment-name').value.trim();
  const text = $('comment-text').value.trim();
  const submitBtn = e.target.querySelector('button[type="submit"]');

  $('comment-name-error').classList.toggle('visible', !name);
  $('comment-text-error').classList.toggle('visible', !text);
  if (!name || !text) return;

  if (!canPostComment()) {
    showToast('Можно оставить только 1 комментарий в час', 'error');
    return;
  }

  submitBtn.disabled = true;

  try {
    const ip = await getClientIP();

    await addDoc(collection(db, COLLECTIONS.COMMENTS), {
      name,
      text,
      ip: ip || 'unknown',
      likes: 0,
      createdAt: serverTimestamp()
    });

    markCommentPosted();
    $('comment-form').reset();
    showToast('Комментарий отправлен!');
    await loadComments();
  } catch (err) {
    showToast('Ошибка отправки комментария', 'error');
    console.warn(err);
  } finally {
    submitBtn.disabled = false;
  }
});

/* ── Application Form ── */

function formatPhoneInput(input) {
  let digits = input.value.replace(/\D/g, '');
  if (digits.startsWith('8')) digits = '7' + digits.slice(1);
  if (!digits.startsWith('7')) digits = '7' + digits;
  digits = digits.slice(0, 11);
  input.value = digits.length ? '+' + digits : '';
}

$('apply-phone').addEventListener('input', function () {
  formatPhoneInput(this);
});

$('apply-form').addEventListener('submit', async e => {
  e.preventDefault();
  let valid = true;

  const name = $('apply-name').value.trim();
  const phone = $('apply-phone').value.trim();
  const email = $('apply-email').value.trim();
  const spec = $('apply-spec').value;
  const message = $('apply-message').value.trim();
  const consent = $('apply-consent').checked;

  $('apply-name-error').classList.toggle('visible', !name);
  $('apply-phone-error').classList.toggle('visible', !PHONE_REGEX.test(phone));
  $('apply-email-error').classList.toggle('visible', !EMAIL_REGEX.test(email));
  $('apply-spec-error').classList.toggle('visible', !spec);
  $('apply-consent-error').classList.toggle('visible', !consent);

  if (!name || !PHONE_REGEX.test(phone) || !EMAIL_REGEX.test(email) || !spec || !consent) {
    valid = false;
  }
  if (!valid) return;

  try {
    await addDoc(collection(db, COLLECTIONS.APPLICATIONS), {
      name, phone, email, specialty: spec, message,
      status: 'new', createdAt: serverTimestamp()
    });

    $('apply-form').classList.add('hidden');
    $('apply-success').classList.add('visible');
    showToast('Заявка успешно отправлена!');
  } catch (err) {
    showToast('Ошибка отправки заявки', 'error');
    console.warn(err);
  }
});

/* ── Init ── */

$('footer-year').textContent = new Date().getFullYear();

initNav();
applySiteLogo('', $('site-name')?.textContent);
loadSettings();
loadSpecializations();
loadNews();
loadGallery();
loadComments();
