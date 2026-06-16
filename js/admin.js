import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  getStorage, ref, uploadBytes, getDownloadURL, deleteObject
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';
import { firebaseConfig, COLLECTIONS, SETTINGS_DOC_ID } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let storage = null;
try { storage = getStorage(app); } catch { /* Storage unavailable */ }

let applicationsData = [];
let specsData = [];

function $(id) { return document.getElementById(id); }

function showToast(msg, type = 'success') {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast toast-${type} show`;
  setTimeout(() => t.classList.remove('show'), 3500);
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/* ── Auth ── */

onAuthStateChanged(auth, user => {
  if (user) {
    $('login-screen').style.display = 'none';
    $('dashboard').classList.add('visible');
    loadAllData();
  } else {
    $('login-screen').style.display = 'flex';
    $('dashboard').classList.remove('visible');
  }
});

$('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  $('login-error').classList.remove('visible');
  try {
    await signInWithEmailAndPassword(auth, $('login-email').value, $('login-password').value);
  } catch {
    $('login-error').classList.add('visible');
  }
});

$('logout-btn').addEventListener('click', () => signOut(auth));

/* ── Panel Navigation ── */

document.querySelectorAll('.admin-nav button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.admin-nav button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $(`panel-${btn.dataset.panel}`).classList.add('active');
  });
});

/* ── Modal ── */

function openModal(title, html) {
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = html;
  $('modal').classList.add('open');
}

function closeModal() { $('modal').classList.remove('open'); }

$('modal-close').addEventListener('click', closeModal);
$('modal').addEventListener('click', e => { if (e.target === $('modal')) closeModal(); });

/* ── Settings ── */

async function loadSettings() {
  const snap = await getDoc(doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOC_ID));
  if (!snap.exists()) return;
  const s = snap.data();
  $('set-name').value = s.collegeName || '';
  $('set-tagline').value = s.tagline || '';
  $('set-about').value = s.aboutText || '';
  $('set-advantages').value = Array.isArray(s.aboutAdvantages)
    ? s.aboutAdvantages.join('\n')
    : (s.aboutAdvantages || '');
  $('set-nutrition').value = s.aboutNutrition || '';
  $('set-other-info').value = s.aboutOtherInfo || '';
  $('set-logo').value = s.logoUrl || '';
  $('set-address').value = s.address || '';
  $('set-phone').value = s.phone || '';
  $('set-email').value = s.email || '';
  if (s.socials) {
    $('set-instagram').value = s.socials.instagram || '';
    $('set-facebook').value = s.socials.facebook || '';
    $('set-telegram').value = s.socials.telegram || '';
    $('set-youtube').value = s.socials.youtube || '';
  }
}

$('settings-form').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await setDoc(doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOC_ID), {
      collegeName: $('set-name').value.trim(),
      tagline: $('set-tagline').value.trim(),
      aboutText: $('set-about').value.trim(),
      aboutAdvantages: $('set-advantages').value
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean),
      aboutNutrition: $('set-nutrition').value.trim(),
      aboutOtherInfo: $('set-other-info').value.trim(),
      logoUrl: $('set-logo').value.trim(),
      address: $('set-address').value.trim(),
      phone: $('set-phone').value.trim(),
      email: $('set-email').value.trim(),
      socials: {
        instagram: $('set-instagram').value.trim(),
        facebook: $('set-facebook').value.trim(),
        telegram: $('set-telegram').value.trim(),
        youtube: $('set-youtube').value.trim()
      },
      updatedAt: serverTimestamp()
    }, { merge: true });
    showToast('Настройки сохранены');
  } catch (err) {
    showToast('Ошибка сохранения', 'error');
    console.warn(err);
  }
});

/* ── News ── */

async function loadNews() {
  const container = $('news-list');
  try {
    const q = query(collection(db, COLLECTIONS.NEWS), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    if (snap.empty) {
      container.innerHTML = '<p class="empty-state">Новостей нет</p>';
      return;
    }
    container.innerHTML = '';
    snap.forEach(docSnap => {
      const n = docSnap.data();
      const statusClass = n.published ? 'status-published' : 'status-draft';
      const statusText = n.published ? 'Опубликовано' : 'Черновик';
      container.insertAdjacentHTML('beforeend', `
        <div class="admin-list-item">
          <div class="admin-list-info">
            <h4>${escapeHtml(n.title)}</h4>
            <p>${formatDate(n.date)} · <span class="status-badge ${statusClass}">${statusText}</span></p>
          </div>
          <div class="admin-actions">
            <button class="btn btn-secondary btn-sm" data-action="edit-news" data-id="${docSnap.id}">Изменить</button>
            <button class="btn btn-sm ${n.published ? 'btn-outline' : 'btn-success'}" data-action="toggle-news" data-id="${docSnap.id}" data-published="${n.published}">${n.published ? 'Снять' : 'Опубликовать'}</button>
            <button class="btn btn-danger btn-sm" data-action="delete-news" data-id="${docSnap.id}">Удалить</button>
          </div>
        </div>
      `);
    });
    bindNewsActions();
  } catch (e) {
    container.innerHTML = '<p class="empty-state">Ошибка загрузки</p>';
  }
}

function bindNewsActions() {
  $('news-list').querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (btn.dataset.action === 'delete-news') {
        if (!confirm('Удалить эту новость?')) return;
        await deleteDoc(doc(db, COLLECTIONS.NEWS, id));
        showToast('Новость удалена');
        loadNews();
      } else if (btn.dataset.action === 'toggle-news') {
        await updateDoc(doc(db, COLLECTIONS.NEWS, id), { published: btn.dataset.published !== 'true' });
        loadNews();
      } else if (btn.dataset.action === 'edit-news') {
        editNews(id);
      }
    });
  });
}

function newsFormHtml(data = {}) {
  const dateVal = data.date
    ? (data.date.toDate ? data.date.toDate() : new Date(data.date)).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];
  return `
    <form id="news-modal-form">
      <div class="form-group">
        <label>Заголовок</label>
        <input type="text" id="news-title" class="form-control" value="${escapeHtml(data.title || '')}" required>
      </div>
      <div class="form-group">
        <label>Дата</label>
        <input type="date" id="news-date" class="form-control" value="${dateVal}" required>
      </div>
      <div class="form-group">
        <label>Краткий текст (превью)</label>
        <input type="text" id="news-preview" class="form-control" value="${escapeHtml(data.preview || '')}">
      </div>
      <div class="form-group">
        <label>Полный текст</label>
        <textarea id="news-text" class="form-control" rows="5" required>${escapeHtml(data.text || '')}</textarea>
      </div>
      <div class="form-group">
        <label>URL изображения (необязательно)</label>
        <input type="url" id="news-image" class="form-control" value="${escapeHtml(data.imageUrl || '')}">
      </div>
      <div class="form-group">
        <label class="form-check">
          <input type="checkbox" id="news-published" ${data.published !== false ? 'checked' : ''}>
          <span>Опубликовать</span>
        </label>
      </div>
      <button type="submit" class="btn btn-primary">Сохранить</button>
    </form>
  `;
}

async function editNews(id) {
  const snap = await getDoc(doc(db, COLLECTIONS.NEWS, id));
  const data = snap.data();
  openModal('Редактировать новость', newsFormHtml(data));
  $('news-modal-form').addEventListener('submit', async e => {
    e.preventDefault();
    await updateDoc(doc(db, COLLECTIONS.NEWS, id), {
      title: $('news-title').value.trim(),
      date: Timestamp.fromDate(new Date($('news-date').value)),
      preview: $('news-preview').value.trim(),
      text: $('news-text').value.trim(),
      imageUrl: $('news-image').value.trim(),
      published: $('news-published').checked,
      updatedAt: serverTimestamp()
    });
    closeModal();
    showToast('Новость обновлена');
    loadNews();
  });
}

$('add-news-btn').addEventListener('click', () => {
  openModal('Добавить новость', newsFormHtml());
  $('news-modal-form').addEventListener('submit', async e => {
    e.preventDefault();
    await addDoc(collection(db, COLLECTIONS.NEWS), {
      title: $('news-title').value.trim(),
      date: Timestamp.fromDate(new Date($('news-date').value)),
      preview: $('news-preview').value.trim(),
      text: $('news-text').value.trim(),
      imageUrl: $('news-image').value.trim(),
      published: $('news-published').checked,
      createdAt: serverTimestamp()
    });
    closeModal();
    showToast('Новость добавлена');
    loadNews();
  });
});

/* ── Specializations ── */

async function loadSpecs() {
  const container = $('specs-list');
  try {
    const q = query(collection(db, COLLECTIONS.SPECIALIZATIONS), orderBy('order', 'asc'));
    const snap = await getDocs(q);
    specsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!specsData.length) {
      container.innerHTML = '<p class="empty-state">Специальностей нет</p>';
      return;
    }
    container.innerHTML = '';
    specsData.forEach((s, i) => {
      const formLabel = s.studyForm === 'part-time' ? 'Заочная' : 'Очная';
      container.insertAdjacentHTML('beforeend', `
        <div class="admin-list-item">
          <div class="reorder-btns">
            <button data-action="move-up" data-index="${i}" ${i === 0 ? 'disabled' : ''}>&#9650;</button>
            <button data-action="move-down" data-index="${i}" ${i === specsData.length - 1 ? 'disabled' : ''}>&#9660;</button>
          </div>
          <div class="admin-list-info">
            <h4>${escapeHtml(s.name)}</h4>
            <p>${escapeHtml(s.duration || '')} · ${formLabel}</p>
          </div>
          <div class="admin-actions">
            <button class="btn btn-secondary btn-sm" data-action="edit-spec" data-id="${s.id}">Изменить</button>
            <button class="btn btn-danger btn-sm" data-action="delete-spec" data-id="${s.id}">Удалить</button>
          </div>
        </div>
      `);
    });
    bindSpecActions();
  } catch (e) {
    container.innerHTML = '<p class="empty-state">Ошибка загрузки</p>';
  }
}

function bindSpecActions() {
  $('specs-list').querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      if (action === 'delete-spec') {
        if (!confirm('Удалить специальность?')) return;
        await deleteDoc(doc(db, COLLECTIONS.SPECIALIZATIONS, btn.dataset.id));
        showToast('Специальность удалена');
        loadSpecs();
      } else if (action === 'edit-spec') {
        editSpec(btn.dataset.id);
      } else if (action === 'move-up' || action === 'move-down') {
        const i = parseInt(btn.dataset.index);
        const j = action === 'move-up' ? i - 1 : i + 1;
        if (j < 0 || j >= specsData.length) return;
        const orderA = specsData[i].order ?? i;
        const orderB = specsData[j].order ?? j;
        await updateDoc(doc(db, COLLECTIONS.SPECIALIZATIONS, specsData[i].id), { order: orderB });
        await updateDoc(doc(db, COLLECTIONS.SPECIALIZATIONS, specsData[j].id), { order: orderA });
        loadSpecs();
      }
    });
  });
}

function specFormHtml(data = {}) {
  return `
    <form id="spec-modal-form">
      <div class="form-group">
        <label>Название</label>
        <input type="text" id="spec-name" class="form-control" value="${escapeHtml(data.name || '')}" required>
      </div>
      <div class="form-group">
        <label>Краткое описание</label>
        <input type="text" id="spec-short" class="form-control" value="${escapeHtml(data.shortDescription || '')}" required>
      </div>
      <div class="form-group">
        <label>Полное описание</label>
        <textarea id="spec-full" class="form-control" rows="4">${escapeHtml(data.fullDescription || '')}</textarea>
      </div>
      <div class="form-row two-col">
        <div class="form-group">
          <label>Срок обучения</label>
          <input type="text" id="spec-duration" class="form-control" value="${escapeHtml(data.duration || '')}" placeholder="2 года 10 мес.">
        </div>
        <div class="form-group">
          <label>Форма обучения</label>
          <select id="spec-form" class="form-control">
            <option value="full-time" ${data.studyForm !== 'part-time' ? 'selected' : ''}>Очная</option>
            <option value="part-time" ${data.studyForm === 'part-time' ? 'selected' : ''}>Заочная</option>
          </select>
        </div>
      </div>
      <button type="submit" class="btn btn-primary">Сохранить</button>
    </form>
  `;
}

async function editSpec(id) {
  const snap = await getDoc(doc(db, COLLECTIONS.SPECIALIZATIONS, id));
  openModal('Редактировать специальность', specFormHtml(snap.data()));
  $('spec-modal-form').addEventListener('submit', async e => {
    e.preventDefault();
    await updateDoc(doc(db, COLLECTIONS.SPECIALIZATIONS, id), {
      name: $('spec-name').value.trim(),
      shortDescription: $('spec-short').value.trim(),
      fullDescription: $('spec-full').value.trim(),
      duration: $('spec-duration').value.trim(),
      studyForm: $('spec-form').value,
      updatedAt: serverTimestamp()
    });
    closeModal();
    showToast('Специальность обновлена');
    loadSpecs();
  });
}

$('add-spec-btn').addEventListener('click', async () => {
  const count = specsData.length;
  openModal('Добавить специальность', specFormHtml());
  $('spec-modal-form').addEventListener('submit', async e => {
    e.preventDefault();
    await addDoc(collection(db, COLLECTIONS.SPECIALIZATIONS), {
      name: $('spec-name').value.trim(),
      shortDescription: $('spec-short').value.trim(),
      fullDescription: $('spec-full').value.trim(),
      duration: $('spec-duration').value.trim(),
      studyForm: $('spec-form').value,
      order: count,
      createdAt: serverTimestamp()
    });
    closeModal();
    showToast('Специальность добавлена');
    loadSpecs();
  });
});

/* ── Gallery ── */

const MAX_BASE64_LENGTH = 900000;

function compressImage(file, maxWidth = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error('Не удалось сжать изображение'))),
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Не удалось прочитать изображение'));
    };
    img.src = objectUrl;
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function uploadImageToStorage(blob, originalName) {
  const safeName = originalName.replace(/[^\w.-]/g, '_');
  const fileName = `gallery/${Date.now()}_${safeName}.jpg`;
  const storageRef = ref(storage, fileName);
  await uploadBytes(storageRef, blob, { contentType: blob.type || 'image/jpeg' });
  const url = await getDownloadURL(storageRef);
  return { url, storagePath: fileName, source: 'storage' };
}

async function uploadImageAsBase64(blob) {
  const dataUrl = await blobToDataUrl(blob);
  if (dataUrl.length > MAX_BASE64_LENGTH) {
    throw new Error('Файл слишком большой. Включите Firebase Storage или выберите меньшее фото.');
  }
  return { url: dataUrl, storagePath: null, source: 'firestore' };
}

async function uploadImage(file) {
  const compressed = await compressImage(file);

  if (storage && auth.currentUser) {
    try {
      return await uploadImageToStorage(compressed, file.name);
    } catch (err) {
      console.warn('Storage upload failed, using Firestore base64 fallback:', err);
    }
  }

  return uploadImageAsBase64(compressed);
}

async function fetchGalleryDocs() {
  try {
    const q = query(collection(db, COLLECTIONS.GALLERY), orderBy('order', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn('Gallery orderBy failed, loading without sort index:', err);
    const snap = await getDocs(collection(db, COLLECTIONS.GALLERY));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
}

function sortGalleryDocs(items) {
  return items.sort((a, b) => {
    const orderDiff = (a.order ?? 0) - (b.order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    const aTime = a.createdAt?.seconds ?? 0;
    const bTime = b.createdAt?.seconds ?? 0;
    return aTime - bTime;
  });
}

function renderGalleryAdminItem(docId, g) {
  if (!g.url) return null;

  const item = document.createElement('div');
  item.className = 'gallery-admin-item';

  const img = document.createElement('img');
  img.src = g.url;
  img.alt = g.caption || 'Фото галереи';
  img.loading = 'lazy';

  const overlay = document.createElement('div');
  overlay.className = 'overlay';

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'btn btn-danger btn-sm';
  deleteBtn.textContent = 'Удалить';
  deleteBtn.addEventListener('click', async () => {
    if (!confirm('Удалить фото?')) return;
    try {
      if (g.storagePath && storage) {
        try {
          await deleteObject(ref(storage, g.storagePath));
        } catch (err) {
          console.warn('Storage file delete failed:', err);
        }
      }
      await deleteDoc(doc(db, COLLECTIONS.GALLERY, docId));
      showToast('Фото удалено');
      loadGallery();
    } catch (err) {
      showToast('Ошибка удаления', 'error');
      console.warn(err);
    }
  });

  overlay.appendChild(deleteBtn);
  item.appendChild(img);
  item.appendChild(overlay);
  return item;
}

async function loadGallery() {
  const grid = $('gallery-admin-grid');
  try {
    const items = sortGalleryDocs(await fetchGalleryDocs());
    if (!items.length) {
      grid.innerHTML = '<p class="empty-state">Фото нет</p>';
      return;
    }

    grid.innerHTML = '';
    items.forEach(g => {
      const el = renderGalleryAdminItem(g.id, g);
      if (el) grid.appendChild(el);
    });
  } catch (e) {
    grid.innerHTML = '<p class="empty-state">Ошибка загрузки</p>';
    console.warn(e);
  }
}

async function getNextGalleryOrder() {
  const items = await fetchGalleryDocs();
  if (!items.length) return 0;
  return Math.max(...items.map(g => g.order ?? 0)) + 1;
}

$('gallery-upload-form').addEventListener('submit', async e => {
  e.preventDefault();
  const file = $('gallery-file').files[0];
  const submitBtn = e.target.querySelector('button[type="submit"]');

  if (!file) {
    showToast('Выберите файл', 'error');
    return;
  }
  if (!file.type.startsWith('image/')) {
    showToast('Можно загружать только изображения', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Загрузка...';

  try {
    const { url, storagePath, source } = await uploadImage(file);
    const order = await getNextGalleryOrder();

    await addDoc(collection(db, COLLECTIONS.GALLERY), {
      url,
      caption: $('gallery-caption').value.trim(),
      order,
      storagePath: storagePath || null,
      source,
      createdAt: serverTimestamp()
    });

    $('gallery-upload-form').reset();
    showToast(source === 'storage' ? 'Фото загружено в Storage' : 'Фото сохранено');
    await loadGallery();
  } catch (err) {
    showToast(err.message || 'Ошибка загрузки', 'error');
    console.warn(err);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Загрузить';
  }
});

/* ── Applications ── */

async function loadApplications() {
  const tbody = $('applications-body');
  try {
    const q = query(collection(db, COLLECTIONS.APPLICATIONS), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    applicationsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!applicationsData.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Заявок нет</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    applicationsData.forEach(a => {
      const statusClass = a.status === 'reviewed' ? 'status-reviewed' : 'status-new';
      const statusText = a.status === 'reviewed' ? 'Просмотрено' : 'Новая';
      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td>${formatDate(a.createdAt)}</td>
          <td>${escapeHtml(a.name)}</td>
          <td>${escapeHtml(a.phone)}</td>
          <td>${escapeHtml(a.email)}</td>
          <td>${escapeHtml(a.specialty)}</td>
          <td>${escapeHtml(a.message || '—')}</td>
          <td><span class="status-badge ${statusClass}">${statusText}</span></td>
          <td class="admin-actions">
            ${a.status !== 'reviewed' ? `<button class="btn btn-success btn-sm" data-action="review-app" data-id="${a.id}">✓</button>` : ''}
            <button class="btn btn-danger btn-sm" data-action="delete-app" data-id="${a.id}">✕</button>
          </td>
        </tr>
      `);
    });
    tbody.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (btn.dataset.action === 'review-app') {
          await updateDoc(doc(db, COLLECTIONS.APPLICATIONS, btn.dataset.id), { status: 'reviewed' });
          loadApplications();
        } else if (btn.dataset.action === 'delete-app') {
          if (!confirm('Удалить заявку?')) return;
          await deleteDoc(doc(db, COLLECTIONS.APPLICATIONS, btn.dataset.id));
          showToast('Заявка удалена');
          loadApplications();
        }
      });
    });
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Ошибка загрузки</td></tr>';
  }
}

$('export-csv-btn').addEventListener('click', () => {
  if (!applicationsData.length) { showToast('Нет данных для экспорта', 'error'); return; }
  const headers = ['Дата', 'ФИО', 'Телефон', 'Email', 'Специальность', 'Сообщение', 'Статус'];
  const rows = applicationsData.map(a => [
    formatDate(a.createdAt), a.name, a.phone, a.email, a.specialty, a.message || '', a.status || 'new'
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `zayavki_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
});

/* ── Comments ── */

async function loadCommentsAdmin() {
  const container = $('comments-admin-list');
  try {
    const q = query(collection(db, COLLECTIONS.COMMENTS), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    if (snap.empty) {
      container.innerHTML = '<p class="empty-state">Комментариев нет</p>';
      return;
    }
    container.innerHTML = '';
    snap.forEach(docSnap => {
      const c = docSnap.data();
      container.insertAdjacentHTML('beforeend', `
        <div class="admin-list-item">
          <div class="admin-list-info">
            <h4>${escapeHtml(c.name)} · ♥ ${c.likes || 0}</h4>
            <p>${escapeHtml(c.text)}</p>
            <p style="font-size:.8rem;margin-top:.25rem">${formatDate(c.createdAt)} · IP: ${escapeHtml(c.ip || '—')}</p>
          </div>
          <div class="admin-actions">
            <button class="btn btn-danger btn-sm" data-action="delete-comment" data-id="${docSnap.id}">Удалить</button>
          </div>
        </div>
      `);
    });
    container.querySelectorAll('[data-action="delete-comment"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Удалить комментарий?')) return;
        await deleteDoc(doc(db, COLLECTIONS.COMMENTS, btn.dataset.id));
        showToast('Комментарий удалён');
        loadCommentsAdmin();
      });
    });
  } catch (e) {
    container.innerHTML = '<p class="empty-state">Ошибка загрузки</p>';
  }
}

function loadAllData() {
  loadSettings();
  loadNews();
  loadSpecs();
  loadGallery();
  loadApplications();
  loadCommentsAdmin();
}
