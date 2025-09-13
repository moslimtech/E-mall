const API_URL = 'https://script.google.com/macros/s/AKfycbwB0VE5COC0e6NQNKrxQeNRu2Mtt_QuMbVoBrH7tE6Da3X3BP6UxK926bt9fDO0WPU5/exec';

let currentTab = 'places';
let uploadedImages = [];
let uploadedVideos = [];
let editingAdId = null;

// cache of recent uploads
const recentUploads = {};
const THEME_KEY = 'ban_theme';

/* ========== Theme ========== */
function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark');
    const icon = document.getElementById('themeIcon');
    const lbl = document.getElementById('themeLabel');
    if (icon) icon.className = 'fas fa-sun';
    if (lbl) lbl.textContent = 'الوضع النهاري';
  } else {
    document.body.classList.remove('dark');
    const icon = document.getElementById('themeIcon');
    const lbl = document.getElementById('themeLabel');
    if (icon) icon.className = 'fas fa-moon';
    if (lbl) lbl.textContent = 'الوضع الليلي';
  }
  try { localStorage.setItem(THEME_KEY, theme || 'light'); } catch(e){}
}
function toggleTheme() {
  const cur = (localStorage.getItem(THEME_KEY) === 'dark') ? 'dark' : 'light';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
}
function initTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) applyTheme(saved);
    else {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(prefersDark ? 'dark' : 'light');
    }
  } catch (e) { applyTheme('light'); }
}

/* ========== API helpers ========== */
async function apiFetch(url, opts = {}) {
  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch (e) { data = text; }
    return { ok: res.ok, status: res.status, data, raw: text };
  } catch (err) {
    return { ok: false, status: 0, error: err.message || String(err) };
  }
}
async function apiPost(payload) {
  try {
    if (payload instanceof FormData) {
      return await apiFetch(API_URL, { method: 'POST', body: payload });
    }
    if (typeof payload === 'object' && payload !== null) {
      const form = new FormData();
      for (const k of Object.keys(payload)) {
        const v = payload[k];
        if (v !== null && typeof v === 'object') form.append(k, JSON.stringify(v));
        else form.append(k, v === undefined ? '' : v);
      }
      return await apiFetch(API_URL, { method: 'POST', body: form });
    }
    return await apiFetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: String(payload) });
  } catch (err) {
    return { ok: false, status: 0, error: err.message || String(err) };
  }
}

/* ========== Init ========== */
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  initTheme();
  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  setupEventListeners();
  loadLookupsAndPopulate();
  loadPlacesForAds();
  setupAuthUI();
  initMapAutoLocate();
  initMapLinkAutoFill();

  if (typeof updateAdsTabVisibility === 'function') updateAdsTabVisibility();

  const stored = getLoggedPlace();
  if (stored && stored.id) showPlaceStatusBar(stored);
  else hidePlaceStatusBar();
  initPlaceStatusButtons();

  updateActivateButtonState();
});

function initializeApp() {
  const today = new Date().toISOString().split('T')[0];
  const startInput = document.querySelector('input[name="startDate"]');
  const endInput = document.querySelector('input[name="endDate"]');
  if (startInput) startInput.value = today;
  const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
  if (endInput) endInput.value = nextWeek.toISOString().split('T')[0];
}

/* ========== Event listeners ========== */
function setupEventListeners() {
  const placeForm = document.getElementById('placeForm');
  const adForm = document.getElementById('adForm');
  const citySelect = document.querySelector('select[name="city"]');
  if (placeForm) placeForm.addEventListener('submit', handlePlaceSubmit);
  if (adForm) adForm.addEventListener('submit', handleAdSubmit);
  if (citySelect) citySelect.addEventListener('change', updateAreas);

  const activatePackageBtn = document.getElementById('activatePackageBtn');
  if (activatePackageBtn) activatePackageBtn.addEventListener('click', activatePackageFromForm);

  const pkgSelect = document.querySelector('select[name="package"]');
  if (pkgSelect) pkgSelect.addEventListener('change', updateActivateButtonState);
}

/* ========== Lookups & populate ========== */
// async function loadLookupsAndPopulate() {
//   try {
//     const resp = await apiFetch(`${API_URL}?action=getLookups`);
//     if (!resp.ok) { console.warn('getLookups failed', resp); return; }
//     const json = resp.data;
//     const data = (json && json.success && json.data) ? json.data : json;
//     if (!data) return;

//     window.lastLookups = data; // حفظ آخر القوائم

//     const actSelect = document.querySelector('select[name="activityType"]');
//     if (actSelect) {
//       actSelect.innerHTML = '<option value="">اختر نوع النشاط</option>';
//       (data.activities || []).forEach(a => {
//         const opt = document.createElement('option'); opt.value = a.id; opt.textContent = a.name; actSelect.appendChild(opt);
//       });
//     }

//     const citySelect = document.querySelector('select[name="city"]');
//     if (citySelect) {
//       citySelect.innerHTML = '<option value="">اختر المدينة</option>';
//       (data.cities || []).forEach(c => {
//         const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.name; citySelect.appendChild(opt);
//       });
//     }

//     const cityAreaMap = {};
//     (data.areas || []).forEach(a => {
//       const cid = a.raw && (a.raw['ID المدينة'] || a.raw['cityId']) ? String(a.raw['ID المدينة'] || a.raw['cityId']) : '';
//       if (!cityAreaMap[cid]) cityAreaMap[cid] = [];
//       cityAreaMap[cid].push({ id: a.id, name: a.name });
//     });
//     window.cityAreaMap = cityAreaMap;

//     const siteSelects = document.querySelectorAll('select[name="location"]');
//     siteSelects.forEach(s => {
//       s.innerHTML = '<option value="">اختر الموقع</option>';
//       (data.sites || []).forEach(site => {
//         const opt = document.createElement('option'); opt.value = site.id; opt.textContent = site.name; s.appendChild(opt);
//       });
//     });

//     const pkgSelect = document.querySelector('select[name="package"]');
//     if (pkgSelect) {
//       pkgSelect.innerHTML = '<option value="">اختر الباقة</option>';
//       (data.packages || []).forEach(p => {
//         const opt = document.createElement('option');
//         opt.value = p.id;
//         const dur = Number(p.duration || (p.raw && (p.raw['مدة الباقة باليوم'] || p.raw['مدة'])) || 0) || 0;
//         const price = Number(p.price || (p.raw && (p.raw['سعر الباقة'] || p.raw['السعر'])) || 0) || 0;
//         const allowed = Number(p.allowedAds || (p.raw && (p.raw['عدد الاعلانات'] || p.raw['عدد_الاعلانات'])) || 0) || 0;
//         opt.textContent = `${p.name} — المدة: ${dur} يوم · السعر: ${price} · الإعلانات: ${allowed}`;
//         opt.dataset.duration = String(dur);
//         opt.dataset.price = String(price);
//         opt.dataset.allowed = String(allowed);
//         pkgSelect.appendChild(opt);
//       });
//     }

//     const pkgGrid = document.getElementById('packagesGrid');
//     if (pkgGrid) {
//       pkgGrid.innerHTML = '';
//       (data.packages || []).forEach(p => {
//         const div = document.createElement('div'); div.className = 'pkg-card';
//         const h = document.createElement('h3'); h.textContent = p.name;
//         const dur = Number(p.duration || (p.raw && (p.raw['مدة الباقة باليوم'] || p.raw['مدة'])) || 0) || 0;
//         const price = Number(p.price || (p.raw && (p.raw['سعر الباقة'] || p.raw['السعر'])) || 0) || 0;
//         const allowed = Number(p.allowedAds || (p.raw && (p.raw['عدد الاعلانات'] || p.raw['عدد_الاعلانات'])) || 0) || 0;
//         const d = document.createElement('p'); d.textContent = `المدة: ${dur} يوم · السعر: ${price} · الإعلانات: ${allowed}`;
//         const desc = document.createElement('p'); desc.textContent = p.raw && (p.raw['وصف الباقة'] || p.raw['description']) ? (p.raw['وصف الباقة'] || p.raw['description']) : '';
//         const btn = document.createElement('button'); btn.className = 'choose-pkg'; btn.textContent = 'اختر الباقة';
//         btn.onclick = () => choosePackageAPI(p.id);
//         div.appendChild(h); div.appendChild(d); if (desc.textContent) div.appendChild(desc); div.appendChild(btn);
//         pkgGrid.appendChild(div);
//       });
//     }

//     window.availablePaymentMethods = (data.payments || data.paymentsMethods || []).map(pm => ({ id: pm.id || pm.raw && pm.raw['معرف الدفع'], name: pm.name || pm.raw && (pm.raw['طرق الدفع'] || pm.raw['طريقة الدفع']), raw: pm.raw || pm }));
//     const stored = getLoggedPlace();
//     if (stored && stored.raw) {
//       await tryPrefillPlaceForm(stored);
//       if (stored.id) { if (typeof checkAdQuotaAndToggle === 'function') checkAdQuotaAndToggle(stored.id); if (typeof loadAdsForPlace === 'function') loadAdsForPlace(stored.id); }
//     }

//     if (typeof updateAdsTabVisibility === 'function') updateAdsTabVisibility();
//     updateActivateButtonState();
//   } catch (err) {
//     console.error('loadLookupsAndPopulate error', err);
//   }
// }


/* ========== Lookups & populate ========== */
async function loadLookupsAndPopulate() {
  try {
    const resp = await apiFetch(`${API_URL}?action=getLookups`);
    if (!resp.ok) { console.warn('getLookups failed', resp); return; }
    const json = resp.data;
    const data = (json && json.success && json.data) ? json.data : json;
    if (!data) return;

    window.lastLookups = data; // حفظ آخر القوائم

    //========== تعبئة القوائم (نشاط / مدينة / منطقة / مواقع) ==========
    const actSelect = document.querySelector('select[name="activityType"]');
    if (actSelect) {
      actSelect.innerHTML = '<option value="">اختر نوع النشاط</option>';
      (data.activities || []).forEach(a => {
        const opt = document.createElement('option'); opt.value = a.id; opt.textContent = a.name; actSelect.appendChild(opt);
      });
    }

    const citySelect = document.querySelector('select[name="city"]');
    if (citySelect) {
      citySelect.innerHTML = '<option value="">اختر المدينة</option>';
      (data.cities || []).forEach(c => {
        const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.name; citySelect.appendChild(opt);
      });
    }

    const cityAreaMap = {};
    (data.areas || []).forEach(a => {
      const cid = a.raw && (a.raw['ID المدينة'] || a.raw['cityId']) ? String(a.raw['ID المدينة'] || a.raw['cityId']) : '';
      if (!cityAreaMap[cid]) cityAreaMap[cid] = [];
      cityAreaMap[cid].push({ id: a.id, name: a.name });
    });
    window.cityAreaMap = cityAreaMap;

    const siteSelects = document.querySelectorAll('select[name="location"]');
    siteSelects.forEach(s => {
      s.innerHTML = '<option value="">اختر الموقع</option>';
      (data.sites || []).forEach(site => {
        const opt = document.createElement('option'); opt.value = site.id; opt.textContent = site.name; s.appendChild(opt);
      });
    });

    //========== تعبئة سيلكت الباقات ==========
    const pkgSelect = document.querySelector('select[name="package"]');
    if (pkgSelect) {
      pkgSelect.innerHTML = '<option value="">اختر الباقة</option>';
      (data.packages || []).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        const dur = Number(p.duration || (p.raw && (p.raw['مدة الباقة باليوم'] || p.raw['مدة'])) || 0) || 0;
        const price = Number(p.price || (p.raw && (p.raw['سعر الباقة'] || p.raw['السعر'])) || 0) || 0;
        const allowed = Number(p.allowedAds || (p.raw && (p.raw['عدد الاعلانات'] || p.raw['عدد_الاعلانات'])) || 0) || 0;
        opt.textContent = `${p.name} — المدة: ${dur} يوم · السعر: ${price} · الإعلانات: ${allowed}`;
        opt.dataset.duration = String(dur);
        opt.dataset.price = String(price);
        opt.dataset.allowed = String(allowed);
        pkgSelect.appendChild(opt);
      });
    }

    //========== إنشاء كروت الباقات ==========
    const pkgGrid = document.getElementById('packagesGrid');
    if (pkgGrid) {
      pkgGrid.innerHTML = '';

      // نجيب الباقة الحالية للمكان (لو المستخدم مسجل دخول)
      const logged = getLoggedPlace();
      const loggedPackageId = logged?.raw?.['الباقة'] || '';

      (data.packages || []).forEach(p => {
        const div = document.createElement('div'); 
        div.className = 'pkg-card';

        const h = document.createElement('h3'); 
        h.textContent = p.name;

        const dur = Number(p.duration || (p.raw && (p.raw['مدة الباقة باليوم'] || p.raw['مدة'])) || 0) || 0;
        const price = Number(p.price || (p.raw && (p.raw['سعر الباقة'] || p.raw['السعر'])) || 0) || 0;
        const allowed = Number(p.allowedAds || (p.raw && (p.raw['عدد الاعلانات'] || p.raw['عدد_الاعلانات'])) || 0) || 0;

        const d = document.createElement('p'); 
        d.textContent = `المدة: ${dur} يوم · السعر: ${price} · الإعلانات: ${allowed}`;

        const desc = document.createElement('p'); 
        desc.textContent = p.raw && (p.raw['وصف الباقة'] || p.raw['description']) 
          ? (p.raw['وصف الباقة'] || p.raw['description']) 
          : '';

        const btn = document.createElement('button'); 
        btn.className = 'choose-pkg'; 
        btn.textContent = 'اختر الباقة';
        btn.onclick = () => choosePackageAPI(p.id);

        // ✅ تعديل: لو دي الباقة المفعلة حالياً
        if (loggedPackageId === String(p.id)) {
          div.classList.add('active-package');
          btn.textContent = 'مفعلة حالياً';
          btn.disabled = true;
        }

        div.appendChild(h); 
        div.appendChild(d); 
        if (desc.textContent) div.appendChild(desc); 
        div.appendChild(btn);
        pkgGrid.appendChild(div);
      });
    }

    //========== باقي الإعدادات ==========
    window.availablePaymentMethods = (data.payments || data.paymentsMethods || []).map(pm => ({
      id: pm.id || pm.raw && pm.raw['معرف الدفع'], 
      name: pm.name || pm.raw && (pm.raw['طرق الدفع'] || pm.raw['طريقة الدفع']), 
      raw: pm.raw || pm
    }));

    const stored = getLoggedPlace();
    if (stored && stored.raw) {
      await tryPrefillPlaceForm(stored);
      if (stored.id) { 
        if (typeof checkAdQuotaAndToggle === 'function') checkAdQuotaAndToggle(stored.id); 
        if (typeof loadAdsForPlace === 'function') loadAdsForPlace(stored.id); 
      }
    }

    if (typeof updateAdsTabVisibility === 'function') updateAdsTabVisibility();
    updateActivateButtonState();
  } catch (err) {
    console.error('loadLookupsAndPopulate error', err);
  }
}

/* ========== City areas ========== */
function updateAreas() {
  const citySelect = document.querySelector('select[name="city"]');
  const areaSelect = document.querySelector('select[name="area"]');
  if (!citySelect || !areaSelect) return;
  areaSelect.innerHTML = '<option value="">اختر المنطقة</option>';
  const selected = citySelect.value;
  if (selected && window.cityAreaMap && window.cityAreaMap[selected]) {
    window.cityAreaMap[selected].forEach(a => {
      const opt = document.createElement('option'); opt.value = a.id; opt.textContent = a.name; areaSelect.appendChild(opt);
    });
  }
}

/* ========== Tabs ========== */
function showTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const target = document.getElementById(tabName + '-tab');
  if (target) target.style.display = 'block';
  const tabEl = document.getElementById('tab-' + tabName);
  if (tabEl) tabEl.classList.add('active');
  currentTab = tabName;
}

/* ========== Previews ========== */
function previewImage(input, previewId) {
  const preview = document.getElementById(previewId);
  if (!preview) return;
  preview.innerHTML = '';
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = e => {
      const img = document.createElement('img'); img.src = e.target.result; img.style.borderRadius = '8px';
      preview.appendChild(img); uploadedImages = [file];
    };
    reader.readAsDataURL(file);
  }
}
function previewMultipleImages(input, previewId) {
  const preview = document.getElementById(previewId);
  if (!preview) return;
  preview.innerHTML = ''; uploadedImages = [];
  if (!input.files) return;
  const files = Array.from(input.files).slice(0, 8);
  if (input.files.length > 8) showError('يمكن تحميل حتى 8 صور كحد أقصى. سيتم أخذ أول 8 صور.');
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = e => {
      const div = document.createElement('div'); div.className = 'preview-image';
      const img = document.createElement('img'); img.src = e.target.result;
      const removeBtn = document.createElement('button'); removeBtn.className = 'remove-image'; removeBtn.innerHTML = '×';
      removeBtn.onclick = () => { div.remove(); uploadedImages = uploadedImages.filter(f => f !== file); };
      div.appendChild(img); div.appendChild(removeBtn); preview.appendChild(div);
      uploadedImages.push(file);
    };
    reader.readAsDataURL(file);
  });
}
function previewVideo(input, previewId) {
  const preview = document.getElementById(previewId);
  if (!preview) return;
  preview.innerHTML = ''; uploadedVideos = [];
  if (input.files && input.files[0]) {
    const file = input.files[0]; const reader = new FileReader();
    reader.onload = e => { const video = document.createElement('video'); video.src = e.target.result; video.controls = true; video.style.width = '100%'; preview.appendChild(video); uploadedVideos = [file]; };
    reader.readAsDataURL(file);
  }
}

/* ========== Upload helper ========== */
async function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { const result = reader.result; const base64 = String(result).split(',')[1] || ''; resolve(base64); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
async function uploadToGoogleDrive(file, folder, placeId = null) {
  if (!API_URL || !API_URL.startsWith('http')) return `https://drive.google.com/file/d/${Math.random().toString(36).substr(2, 9)}/view`;
  const base64 = await readFileAsBase64(file);
  const form = new FormData();
  form.append('action', 'uploadFile');
  form.append('folder', folder);
  form.append('fileName', file.name);
  form.append('mimeType', file.type || 'application/octet-stream');
  form.append('fileData', base64);
  if (placeId) form.append('placeId', placeId);
  const resp = await apiPost(form);
  if (!resp.ok) throw new Error('فشل رفع الملف');
  const data = resp.data;
  const up = (data && data.data) ? data.data : data;
  const fileUrl = (up && (up.fileUrl || up.url)) || (resp && resp.fileUrl) || '';
  if (fileUrl) recentUploads[file.name] = { url: fileUrl, name: file.name };
  if (!fileUrl) throw new Error('تعذر استخراج رابط الملف من استجابة الخادم');
  return fileUrl;
}

/* ========== Place submit ========== */
async function handlePlaceSubmit(ev) {
  ev.preventDefault();
  showLoading(true);
  const submitBtn = document.getElementById('savePlaceBtn');
  const oldHtml = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...'; }
  try {
    const form = ev.target;
    const formData = new FormData(form);
    const placeData = {
      placeName: formData.get('placeName'),
      activityType: formData.get('activityType'),
      city: formData.get('city'),
      area: formData.get('area'),
      location: formData.get('location'),
      detailedAddress: formData.get('detailedAddress'),
      mapLink: formData.get('mapLink'),
      phone: formData.get('phone'),
      whatsappLink: formData.get('whatsappLink'),
      email: formData.get('email'),
      website: formData.get('website'),
      workingHours: formData.get('workingHours'),
      delivery: formData.get('delivery'),
      package: formData.get('package'),
      description: formData.get('description'),
      password: formData.get('password'),
      status: formData.get('status'),
      image: uploadedImages[0] || null
    };

    if (!validateFiles()) { showLoading(false); return; }

    const logged = getLoggedPlace();
    let imageUrl = '';
    if (placeData.image) {
      const placeIdForUpload = (logged && logged.id) ? logged.id : null;
      imageUrl = await uploadToGoogleDrive(placeData.image, 'places', placeIdForUpload);
    }

    const payload = { action: (logged && logged.id) ? 'updatePlace' : 'registerPlace' };
    if (logged && logged.id) payload.placeId = logged.id;
    const setIf = (k, v) => { if (v !== undefined && v !== null && String(v).trim() !== '') payload[k] = v; };
    setIf('name', placeData.placeName);
    setIf('activityId', placeData.activityType);
    setIf('activity', placeData.activityType);
    setIf('activityType', placeData.activityType);
    setIf('city', placeData.city);
    setIf('area', placeData.area);
    setIf('mall', placeData.location);
    setIf('address', placeData.detailedAddress);
    setIf('mapLink', placeData.mapLink);
    setIf('phone', placeData.phone);
    setIf('whatsappLink', placeData.whatsappLink);
    setIf('email', placeData.email);
    setIf('website', placeData.website);
    setIf('hours', placeData.workingHours);
    setIf('delivery', placeData.delivery);
    setIf('description', placeData.description);
    setIf('packageId', placeData.package);
    setIf('password', placeData.password);
    setIf('logoUrl', imageUrl);
    setIf('status', placeData.status);

    const resp = await apiPost(payload);
    if (!resp.ok) throw new Error('فشل في التواصل مع الخادم عند حفظ المكان');
    const data = resp.data;
    if (!data || data.success === false) { const err = data && data.error ? data.error : JSON.stringify(data); throw new Error(err); }

    const returned = (data && data.data) ? data.data : data;
    if (returned.place) { await setLoggedInUI(returned.place); }
    else if (returned.id) {
      const fetched = await fetchPlace(returned.id);
      if (fetched) await setLoggedInUI(fetched);
    } else if (data.data && data.data.place) { await setLoggedInUI(data.data.place); }

    showSuccess('تم حفظ المكان بنجاح!');
    const preview = document.getElementById('placeImagePreview'); if (preview) preview.innerHTML = '';
    uploadedImages = [];
    await loadLookupsAndPopulate();
    loadPlacesForAds();
    const newLogged = getLoggedPlace(); if (newLogged && newLogged.id) { if (typeof checkAdQuotaAndToggle === 'function') checkAdQuotaAndToggle(newLogged.id); if (typeof loadAdsForPlace === 'function') loadAdsForPlace(newLogged.id); }
  } catch (err) {
    console.error('handlePlaceSubmit error', err);
    showError(err.message || 'حدث خطأ أثناء حفظ المكان');
  } finally { showLoading(false); if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = oldHtml || '<i class="fas fa-save"></i> حفظ'; } }
}

/* ========== Ad submit ========== */
async function handleAdSubmit(ev) {
  ev.preventDefault();
  showLoading(true);
  try {
    const form = ev.target;
    const fd = new FormData(form);
    const adData = {
      placeId: fd.get('placeId'),
      adType: fd.get('adType'),
      adTitle: fd.get('adTitle'),
      coupon: fd.get('coupon'),
      adDescription: fd.get('adDescription'),
      startDate: fd.get('startDate'),
      endDate: fd.get('endDate'),
      adStatus: fd.get('adStatus'),
      adActiveStatus: fd.get('adActiveStatus'),
      images: uploadedImages,
      video: uploadedVideos[0] || null
    };

    if (!validateFiles()) { showLoading(false); return; }

    const imageUrls = [];
    for (let i = 0; i < Math.min(adData.images.length, 8); i++) {
      const file = adData.images[i];
      const url = await uploadToGoogleDrive(file, 'ads');
      imageUrls.push({ name: file.name, url });
    }
    let videoUrl = '';
    if (adData.video) videoUrl = await uploadToGoogleDrive(adData.video, 'ads');

    imageUrls.forEach(i => { recentUploads[i.name] = { url: i.url, name: i.name }; });

    const logged = getLoggedPlace();
    const placeIdToSend = (adData.placeId && adData.placeId !== '') ? adData.placeId : (logged && logged.id ? logged.id : '');

    const payloadBase = {
      placeId: placeIdToSend,
      adType: adData.adType,
      adTitle: adData.adTitle,
      adDescription: adData.adDescription,
      startDate: adData.startDate,
      endDate: adData.endDate,
      coupon: adData.coupon || '',
      imageFiles: JSON.stringify(imageUrls.map(i => i.name || '')),
      imageUrls: JSON.stringify(imageUrls.map(i => i.url || '')),
      videoFile: adData.video ? (adData.video.name || '') : '',
      videoUrl: videoUrl || '',
      adStatus: adData.adStatus || '',
      adActiveStatus: adData.adActiveStatus || ''
    };

    if (editingAdId) {
      const resp = await apiPost({ action: 'updateAd', adId: editingAdId, ...payloadBase });
      if (!resp.ok) throw new Error('فشل تحديث الإعلان');
      const data = resp.data;
      if (data && data.success === false) throw new Error(data.error || 'فشل تحديث الإعلان');
      showSuccess('تم تحديث الإعلان');
      if (typeof loadAdsForPlace === 'function') await loadAdsForPlace(placeIdToSend);
      editingAdId = null;
      const submitBtn = document.querySelector('#adForm button[type="submit"]'); if (submitBtn) submitBtn.textContent = 'حفظ الإعلان';
    } else {
      const resp = await apiPost({ action: 'addAd', ...payloadBase });
      if (!resp.ok) throw new Error('فشل حفظ الإعلان');
      const data = resp.data;
      if (data && data.success === false) throw new Error(data.error || 'فشل حفظ الإعلان');

      const returned = (data && data.data) ? data.data : data;
      const newAdTemp = {
        id: (returned && returned.id) ? returned.id : ('tmp_' + Date.now()),
        placeId: placeIdToSend,
        type: adData.adType,
        title: adData.adTitle,
        description: adData.adDescription,
        startDate: adData.startDate,
        endDate: adData.endDate,
        status: adData.adStatus || adData.adActiveStatus || '',
        images: imageUrls.map(i => ({ name: i.name, url: i.url })),
        videoUrl: videoUrl || ''
      };
      showSuccess('تم حفظ الإعلان');
      prependAdToList(newAdTemp);
    }

    ev.target.reset();
    const ip = document.getElementById('adImagesPreview'); if (ip) ip.innerHTML = '';
    const vp = document.getElementById('adVideoPreview'); if (vp) vp.innerHTML = '';
    uploadedImages = []; uploadedVideos = [];

    if (placeIdToSend) {
      if (typeof checkAdQuotaAndToggle === 'function') await checkAdQuotaAndToggle(placeIdToSend);
      if (typeof loadAdsForPlace === 'function') await loadAdsForPlace(placeIdToSend);
    }
  } catch (err) {
    console.error('handleAdSubmit error', err);
    showError(err.message || 'حدث خطأ أثناء حفظ الإعلان');
  } finally { showLoading(false); }
}

/* ========== Ads list/render ========== */
async function loadPlacesForAds() {
  const placeSelects = document.querySelectorAll('select[name="placeId"]');
  placeSelects.forEach(ps => { ps.innerHTML = '<option value="">اختر المكان</option>'; });
  const resp = await apiFetch(`${API_URL}?action=places`);
  if (!resp.ok) { updateAdsTabVisibilitySafely(); return; }
  const json = resp.data;
  let places = [];
  if (json && json.success && json.data && Array.isArray(json.data.places)) places = json.data.places;
  else if (json && Array.isArray(json.places)) places = json.places;
  else if (Array.isArray(json)) places = json;
  else if (json && json.data && Array.isArray(json.data)) places = json.data;
  else places = [];

  places.forEach(p => {
    placeSelects.forEach(ps => {
      const opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.name; ps.appendChild(opt);
    });
  });

  const logged = getLoggedPlace();
  if (logged && logged.id) {
    placeSelects.forEach(ps => { ps.value = logged.id; ps.disabled = true; });
    const tabAds = document.getElementById('tab-ads');
    if (tabAds) tabAds.style.display = 'block';
    if (typeof loadAdsForPlace === 'function') loadAdsForPlace(logged.id);
  } else {
    placeSelects.forEach(ps => { ps.disabled = false; });
    const tabAds = document.getElementById('tab-ads');
    if (tabAds) tabAds.style.display = 'none';
  }

  updateAdsTabVisibilitySafely();
}
function updateAdsTabVisibilitySafely() { if (typeof updateAdsTabVisibility === 'function') updateAdsTabVisibility(); }

async function loadAdsForPlace(placeId) {
  if (!placeId) return;
  try {
    const resp = await apiFetch(`${API_URL}?action=ads&placeId=${encodeURIComponent(placeId)}`);
    if (!resp.ok) { console.warn('loadAdsForPlace failed', resp); return; }
    const json = resp.data;
    const ads = (json && json.success && json.data && json.data.ads) ? json.data.ads : (json && json.ads) ? json.ads : (json && json.data && json.data) ? json.data : [];
    renderAdsList(Array.isArray(ads) ? ads : []);
  } catch (err) { console.error('loadAdsForPlace error', err); }
}

function renderAdsList(ads) {
  let c = document.getElementById('adsListContainer');
  if (!c) return;
  c.innerHTML = '';
  if (!ads || ads.length === 0) { c.innerHTML = '<p>لا توجد إعلانات حالياً لهذا المحل.</p>'; return; }
  ads.forEach(ad => {
    const card = document.createElement('div'); card.className = 'ad-card';
    const h = document.createElement('h4'); h.textContent = ad.title || '(بدون عنوان)';
    const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = `${ad.startDate || ''} — ${ad.endDate || ''} · الحالة: ${ad.status || ''}`;
    const p = document.createElement('p'); p.textContent = ad.description || '';
    card.appendChild(h); card.appendChild(meta); card.appendChild(p);

    if (ad.images && ad.images.length > 0) {
      const imgs = document.createElement('div'); imgs.className = 'ad-images';
      const imagesArr = Array.isArray(ad.images) ? ad.images : (ad.images && typeof ad.images === 'string' ? JSON.parse(ad.images) : []);
      imagesArr.forEach(im => {
        let url = '', name = '';
        if (im && typeof im === 'object') { url = im.url || ''; name = im.name || ''; }
        else if (typeof im === 'string') { name = im; url = ''; }
        if (!url && name && recentUploads[name]) url = recentUploads[name].url;
        if (url) { const img = document.createElement('img'); img.src = url; img.alt = name || ''; imgs.appendChild(img); }
        else if (name) { const wrap = document.createElement('div'); wrap.className = 'img-placeholder-file'; wrap.textContent = name; imgs.appendChild(wrap); }
        else { const wrap = document.createElement('div'); wrap.className = 'img-placeholder-file'; wrap.textContent = 'لا توجد صورة'; imgs.appendChild(wrap); }
      });
      card.appendChild(imgs);
    }

    const actions = document.createElement('div'); actions.className = 'ad-actions';
    const editBtn = document.createElement('button'); editBtn.className = 'edit-btn'; editBtn.textContent = 'تعديل'; editBtn.onclick = () => startEditAd(ad);
    const delBtn = document.createElement('button'); delBtn.className = 'delete-btn'; delBtn.textContent = 'حذف'; delBtn.onclick = () => deleteAdConfirm(ad.id);
    actions.appendChild(editBtn); actions.appendChild(delBtn);
    card.appendChild(actions);
    c.appendChild(card);
  });
}

function prependAdToList(ad) {
  const container = document.getElementById('adsListContainer');
  if (!container) return;
  const card = document.createElement('div'); card.className = 'ad-card';
  const h = document.createElement('h4'); h.textContent = ad.title || '(بدون عنوان)';
  const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = `${ad.startDate || ''} — ${ad.endDate || ''} · الحالة: ${ad.status || ''}`;
  const p = document.createElement('p'); p.textContent = ad.description || '';
  card.appendChild(h); card.appendChild(meta); card.appendChild(p);

  if (ad.images && ad.images.length > 0) {
    const imgs = document.createElement('div'); imgs.className = 'ad-images';
    ad.images.forEach(im => {
      const url = im && im.url ? im.url : '';
      const name = im && im.name ? im.name : '';
      if (url) {
        const img = document.createElement('img'); img.src = url; img.alt = name || '';
        imgs.appendChild(img);
      } else if (name) {
        const wrap = document.createElement('div'); wrap.className = 'img-placeholder-file'; wrap.textContent = name; imgs.appendChild(wrap);
      }
    });
    card.appendChild(imgs);
  }

  const actions = document.createElement('div'); actions.className = 'ad-actions';
  const editBtn = document.createElement('button'); editBtn.className = 'edit-btn'; editBtn.textContent = 'تعديل'; editBtn.onclick = () => startEditAd(ad);
  const delBtn = document.createElement('button'); delBtn.className = 'delete-btn'; delBtn.textContent = 'حذف'; delBtn.onclick = () => deleteAdConfirm(ad.id);
  actions.appendChild(editBtn); actions.appendChild(delBtn);
  card.appendChild(actions);
  container.insertBefore(card, container.firstChild);
}

function startEditAd(ad) {
  try {
    editingAdId = ad.id || null;
    const form = document.getElementById('adForm');
    if (!form) return;
    form.querySelector('select[name="placeId"]').value = ad.placeId || '';
    form.querySelector('select[name="adType"]').value = ad.type || '';
    form.querySelector('input[name="adTitle"]').value = ad.title || '';
    form.querySelector('input[name="coupon"]').value = ad.coupon || '';
    form.querySelector('textarea[name="adDescription"]').value = ad.description || '';
    form.querySelector('input[name="startDate"]').value = ad.startDate || '';
    form.querySelector('input[name="endDate"]').value = ad.endDate || '';
    form.querySelector('select[name="adActiveStatus"]').value = ad.adActiveStatus || ad.status || '';
    form.querySelector('select[name="adStatus"]').value = ad.adStatus || ad.status || '';

    const ip = document.getElementById('adImagesPreview');
    if (ip) {
      ip.innerHTML = '';
      if (ad.images && ad.images.length) {
        (Array.isArray(ad.images) ? ad.images : (ad.images && typeof ad.images === 'string' ? JSON.parse(ad.images) : [])).forEach(im => {
          const url = im && im.url ? im.url : (typeof im === 'string' ? im : '');
          const name = im && im.name ? im.name : (typeof im === 'string' ? im : '');
          const div = document.createElement('div'); div.className = 'preview-image';
          if (url) {
            const img = document.createElement('img'); img.src = url; img.style.width='100%'; img.style.height='90px'; img.style.objectFit='cover'; div.appendChild(img);
          } else if (name && recentUploads[name]) {
            const img = document.createElement('img'); img.src = recentUploads[name].url; img.style.width='100%'; img.style.height='90px'; img.style.objectFit='cover'; div.appendChild(img);
          } else if (name) {
            const placeholder = document.createElement('div'); placeholder.className = 'img-placeholder-file'; placeholder.textContent = name; div.appendChild(placeholder);
          }
          ip.appendChild(div);
        });
      }
    }
    const vp = document.getElementById('adVideoPreview');
    if (vp) {
      vp.innerHTML = '';
      if (ad.videoUrl) {
        const video = document.createElement('video'); video.src = ad.videoUrl; video.controls = true; video.style.width='100%'; vp.appendChild(video);
      }
    }
    const submitBtn = document.querySelector('#adForm button[type="submit"]'); if (submitBtn) submitBtn.textContent = 'تحديث الإعلان';
    showTab('ads');
  } catch (e) { console.error('startEditAd failed', e); }
}

async function deleteAdConfirm(adId) {
  if (!confirm('هل أنت متأكد من حذف هذا الإعلان؟ لا يمكن التراجع.')) return;
  try {
    const payload = { action: 'deleteAd', adId: adId };
    const resp = await apiPost(payload);
    if (!resp.ok) { throw new Error('فشل حذف الإعلان'); }
    const data = resp.data;
    if (data && data.success === false) throw new Error(data.error || 'فشل حذف الإعلان');
    showSuccess('تم حذف الإعلان');
    const logged = getLoggedPlace();
    if (logged && logged.id) { if (typeof checkAdQuotaAndToggle === 'function') checkAdQuotaAndToggle(logged.id); if (typeof loadAdsForPlace === 'function') loadAdsForPlace(logged.id); }
  } catch (err) { console.error('deleteAd error', err); showError(err.message || 'خطأ أثناء حذف الإعلان'); }
}

/* ========== Quota & UI toggles ========== */
async function checkAdQuotaAndToggle(placeId) {
  try {
    if (!placeId) { const tabAds = document.getElementById('tab-ads'); if (tabAds) tabAds.style.display = 'none'; return; }
    const resp = await apiFetch(`${API_URL}?action=remainingAds&placeId=${encodeURIComponent(placeId)}`);
    if (!resp.ok) { toggleAdFormAllowed(false, 'تعذر التحقق من الباقة'); return; }
    const data = resp.data && resp.data.data ? resp.data.data : resp.data;
    const remaining = Number((data && data.remaining) || 0);
    const allowed = Number((data && data.allowed) || 0);
    const used = Number((data && data.used) || 0);
    showAdQuotaMessage(`الإعلانات: الكل ${allowed} · المستخدمة ${used} · المتبقي ${remaining}`);
    toggleAdFormAllowed(remaining > 0, remaining > 0 ? '' : 'استنفدت حصة الإعلانات');
  } catch (err) { console.error('checkAdQuotaAndToggle', err); toggleAdFormAllowed(false, 'خطأ أثناء التحقق'); }
}
function toggleAdFormAllowed(allowed, message) {
  const adForm = document.getElementById('adForm');
  if (!adForm) return;
  const submitBtn = adForm.querySelector('button[type="submit"]');
  if (submitBtn) { submitBtn.disabled = !allowed; submitBtn.style.opacity = allowed ? '1' : '0.6'; submitBtn.title = allowed ? '' : (message || 'غير مسموح'); }
  let adNotice = document.getElementById('adQuotaNotice');
  if (!adNotice) {
    const container = document.getElementById('ads-tab');
    if (container) { adNotice = document.createElement('div'); adNotice.id = 'adQuotaNotice'; adNotice.style.background = '#fff3cd'; adNotice.style.color = '#856404'; adNotice.style.padding='10px'; adNotice.style.borderRadius='6px'; adNotice.style.marginTop='12px'; container.insertBefore(adNotice, container.firstChild.nextSibling); }
  }
  if (adNotice) { adNotice.textContent = message || ''; adNotice.style.display = message ? 'block' : 'none'; }
}
function showAdQuotaMessage(text) { let el = document.getElementById('adQuotaSummary'); if (!el) { const container = document.getElementById('ads-tab'); if (!container) return; el = document.createElement('p'); el.id = 'adQuotaSummary'; el.style.marginTop = '8px'; el.style.color = '#333'; container.insertBefore(el, container.firstChild.nextSibling); } el.textContent = text || ''; }

function updateAdsTabVisibility() {
  const adsTab = document.getElementById('tab-ads');
  const logged = getLoggedPlace();
  if (!adsTab) return;
  if (logged && logged.id) { adsTab.style.display = 'block'; }
  else {
    adsTab.style.display = 'none';
    const activeTab = document.querySelector('.tab.active');
    if (!activeTab || activeTab.id === 'tab-ads') { const placesTabEl = document.getElementById('tab-places'); if (placesTabEl) { placesTabEl.classList.add('active'); showTab('places'); } }
  }
}

/* ========== fetch place ========== */
async function fetchPlace(placeId) {
  if (!API_URL || !API_URL.startsWith('http')) return null;
  const payload = { action: 'getDashboard', placeId: placeId };
  const resp = await apiPost(payload);
  if (!resp.ok) return null;
  const data = resp.data;
  if (!data || data.success === false) return null;
  return (data.data && data.data.place) ? data.data.place : null;
}

/* ========== Auth & session ========== */
function setupAuthUI() {
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const loginModal = document.getElementById('loginModal');
  const loginCancel = document.getElementById('loginCancel');
  const loginForm = document.getElementById('loginForm');
  if (loginBtn) loginBtn.addEventListener('click', () => { if (loginModal) loginModal.style.display = 'flex'; });
  if (loginCancel) loginCancel.addEventListener('click', () => { if (loginModal) loginModal.style.display = 'none'; });
  if (loginModal) loginModal.addEventListener('click', ev => { if (ev.target === loginModal) loginModal.style.display = 'none'; });
  if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  const stored = getLoggedPlace();
  if (stored) setLoggedInUI(stored);
  if (typeof updateAdsTabVisibility === 'function') updateAdsTabVisibility();
  updateActivateButtonState();
}

function getLoggedPlace() { try { const raw = localStorage.getItem('khedmatak_place'); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
function setLoggedPlace(obj) { try { localStorage.setItem('khedmatak_place', JSON.stringify(obj)); } catch (e) {} }
function clearLoggedPlace() { localStorage.removeItem('khedmatak_place'); }

async function setLoggedInUI(place) {
  const loginBtn = document.getElementById('loginBtn'); const logoutBtn = document.getElementById('logoutBtn'); const loggedInUser = document.getElementById('loggedInUser');
  if (loginBtn) loginBtn.style.display = 'none'; if (logoutBtn) logoutBtn.style.display = 'inline-block'; if (loggedInUser) { loggedInUser.style.display = 'inline-block'; loggedInUser.textContent = (place && place.name) ? place.name : 'صاحب المحل'; }
  const loginModal = document.getElementById('loginModal'); if (loginModal) loginModal.style.display = 'none';
  setLoggedPlace(place);
  await loadLookupsAndPopulate().catch(()=>{});
  await tryPrefillPlaceForm(place);
  const tabAds = document.getElementById('tab-ads'); if (tabAds) tabAds.style.display = 'block';
  const placeSelects = document.querySelectorAll('select[name="placeId"]'); placeSelects.forEach(ps => { ps.value = place.id; ps.disabled = true; });
  if (typeof updateAdsTabVisibility === 'function') updateAdsTabVisibility();
  if (place.id) { if (typeof checkAdQuotaAndToggle === 'function') checkAdQuotaAndToggle(place.id); if (typeof loadAdsForPlace === 'function') loadAdsForPlace(place.id); }

  try { showPlaceStatusBar(place); } catch (e) { console.warn('could not show status bar', e); }
  updateActivateButtonState();
}

function setLoggedOutUI() {
  const loginBtn = document.getElementById('loginBtn'); const logoutBtn = document.getElementById('logoutBtn'); const loggedInUser = document.getElementById('loggedInUser');
  if (loginBtn) loginBtn.style.display = 'inline-block'; if (logoutBtn) logoutBtn.style.display = 'none'; if (loggedInUser) { loggedInUser.style.display = 'none'; loggedInUser.textContent = ''; }
  clearLoggedPlace();
  hidePlaceStatusBar();
  const tabAds = document.getElementById('tab-ads'); if (tabAds) tabAds.style.display = 'none';
  const placeSelects = document.querySelectorAll('select[name="placeId"]'); placeSelects.forEach(ps => { ps.disabled = false; });
  if (typeof updateAdsTabVisibility === 'function') updateAdsTabVisibility();
  updateActivateButtonState();
}

async function tryPrefillPlaceForm(place) {
  if (!place || !place.raw) return;
  try {
    const raw = place.raw;
    const setInput = (selector, value) => { const el = document.querySelector(selector); if (el && (value !== undefined && value !== null)) el.value = value; };
    setInput('input[name="placeName"]', raw['اسم المكان'] || '');
    setInput('input[name="detailedAddress"]', raw['العنوان التفصيلي'] || '');
    setInput('input[name="mapLink"]', raw['رابط الموقع على الخريطة'] || '');
    setInput('input[name="phone"]', raw['رقم التواصل'] || '');
    setInput('input[name="whatsappLink"]', raw['رابط واتساب'] || '');
    setInput('input[name="email"]', raw['البريد الإلكتروني'] || '');
    setInput('input[name="website"]', raw['الموقع الالكتروني'] || '');
    setInput('input[name="workingHours"]', raw['ساعات العمل'] || '');
    setInput('textarea[name="description"]', raw['وصف مختصر '] || '');
    await setSelectValueWhenReady('select[name="activityType"]', raw['نوع النشاط / الفئة'] || '');
    await setSelectValueWhenReady('select[name="city"]', raw['المدينة'] || '');
    if ((raw['المدينة'] || '') !== '') updateAreas();
    await setSelectValueWhenReady('select[name="area"]', raw['المنطقة'] || '');
    await setSelectValueWhenReady('select[name="location"]', raw['الموقع او المول'] || '');
    await setSelectValueWhenReady('select[name="package"]', raw['الباقة'] || '');
    await setSelectValueWhenReady('select[name="status"]', raw['حالة التسجيل'] || raw['حالة المكان'] || '');
    setInput('input[name="password"]', raw['كلمة المرور'] || '');
    const logoUrl = raw['رابط صورة شعار المكان'] || raw['صورة شعار أو صورة المكان'] || '';
    if (logoUrl) {
      const preview = document.getElementById('placeImagePreview'); if (preview) { preview.innerHTML = ''; const img = document.createElement('img'); img.src = logoUrl; img.style.width='100%'; img.style.height='120px'; img.style.objectFit='cover'; img.style.borderRadius='8px'; preview.appendChild(img); }
    }

    // تحدّيث بطاقة معلومات الباقة في نموذج المكان
    updateInlinePackageInfoCard(place);
  } catch (e) { console.warn('tryPrefillPlaceForm failed', e); }
}

/* ========== select helpers ========== */
function setSelectByValueOrText(selectEl, val) {
  if (!selectEl) return false;
  const str = (val === null || val === undefined) ? '' : String(val).trim();
  if (str === '') return false;
  for (let i = 0; i < selectEl.options.length; i++) { const opt = selectEl.options[i]; if (String(opt.value) === str) { selectEl.value = opt.value; return true; } }
  for (let i = 0; i < selectEl.options.length; i++) { const opt = selectEl.options[i]; if (String(opt.text).trim() === str) { selectEl.value = opt.value; return true; } }
  for (let i = 0; i < selectEl.options.length; i++) { const opt = selectEl.options[i]; if (String(opt.text).toLowerCase().indexOf(str.toLowerCase()) !== -1) { selectEl.value = opt.value; return true; } }
  return false;
}
function setSelectValueWhenReady(selector, val, retries = 12, interval = 200) {
  return new Promise(resolve => {
    if (!selector || val === null || val === undefined || String(val).trim() === '') { resolve(false); return; }
    let attempts = 0;
    const trySet = () => {
      attempts++;
      const sel = (typeof selector === 'string') ? document.querySelector(selector) : selector;
      if (sel) {
        const ok = setSelectByValueOrText(sel, val);
        if (ok) { resolve(true); return; }
      }
      if (attempts >= retries) { resolve(false); return; }
      setTimeout(trySet, interval);
    };
    trySet();
  });
}

/* ========== Small helpers ========== */
function showSuccess(message) { const el = document.getElementById('successAlert'); if (!el) return; el.textContent = message; el.className = 'alert alert-success'; el.style.display = 'block'; setTimeout(()=>el.style.display='none',5000); }
function showError(message) { const el = document.getElementById('errorAlert'); if (!el) return; el.textContent = message; el.className = 'alert alert-error'; el.style.display = 'block'; setTimeout(()=>el.style.display='none',6000); }
function showLoading(show) { const el = document.getElementById('loading'); if (!el) return; el.style.display = show ? 'block' : 'none'; }
function validateFiles() {
  const maxSize = 10 * 1024 * 1024;
  const allowedImageTypes = ['image/jpeg','image/png','image/gif','image/webp'];
  const allowedVideoTypes = ['video/mp4','video/avi','video/mov','video/quicktime'];
  for (let image of uploadedImages) {
    if (image.size > maxSize) { showError('حجم الصورة أكبر من 10MB'); return false; }
    if (!allowedImageTypes.includes(image.type)) { showError('نوع الصورة غير مدعوم'); return false; }
  }
  if (uploadedVideos.length > 0) {
    const v = uploadedVideos[0];
    if (v.size > maxSize * 5) { showError('حجم الفيديو أكبر من 50MB'); return false; }
    if (!allowedVideoTypes.includes(v.type)) { showError('نوع الفيديو غير مدعوم'); return false; }
  }
  return true;
}

/* ========== Login ========== */
async function handleLoginSubmit(ev) {
  ev.preventDefault();
  showLoading(true);
  try {
    const form = ev.target;
    const phoneOrId = form.querySelector('input[name="phoneOrId"]').value.trim();
    const password = form.querySelector('input[name="password"]').value || '';
    if (!phoneOrId || !password) { showError('ادخل رقم/ID وكلمة المرور'); showLoading(false); return; }
    const payload = { action: 'loginPlace', phoneOrId, password };
    const resp = await apiPost(payload);
    if (!resp.ok) { console.error('login failed raw', resp); throw new Error('خطأ في التواصل مع الخادم'); }
    const data = resp.data;
    if (!data || data.success === false) { throw new Error((data && data.error) ? data.error : JSON.stringify(data)); }
    const returned = (data && data.data) ? data.data : data;
    if (returned.place) { await setLoggedInUI(returned.place); showSuccess('تم تسجيل الدخول'); return; }
    if (returned && returned.id && (returned.name || returned['اسم المكان'])) { await setLoggedInUI(returned); showSuccess('تم تسجيل الدخول'); return; }
    throw new Error('استجابة غير متوقعة من الخادم عند تسجيل الدخول');
  } catch (err) {
    console.error('Login error detailed:', err);
    showError(err.message || 'خطأ أثناء الدخول');
  } finally {
    showLoading(false);
  }
}
function handleLogout() { setLoggedOutUI(); showSuccess('تم تسجيل الخروج'); }

/* ========== choose package ========== */
async function choosePackageAPI(packageId) {
  const logged = getLoggedPlace();
  if (!logged || !logged.id) { showError('يجب تسجيل الدخول أولاً'); return; }
  try {
    const payload = { action: 'choosePackage', placeId: logged.id, packageId: packageId };
    const resp = await apiPost(payload);
    if (!resp.ok) { showError('فشل تغيير الباقة'); return; }
    const data = resp.data;
    if (!data || data.success === false) { showError((data && data.error) || 'فشل تغيير الباقة'); return; }

    const returned = (data && data.data) ? data.data : data;
    if (returned && (returned.pending || returned.pending === true)) {
      const paymentId = returned.paymentId || returned.paymentID || returned.id;
      const amount = returned.amount || returned.price || '';
      const currency = returned.currency || 'SAR';
      showPaymentModal({ paymentId, amount, currency, placeId: logged.id });
      const place = getLoggedPlace() || {};
      place.raw = place.raw || {};
      place.raw['الباقة'] = packageId;
      place.raw['حالة الباقة'] = 'قيد الدفع';
      setLoggedPlace(place);
      showSuccess('تم إنشاء طلب دفع. اتبع الإرشادات لإرسال إيصال الدفع.');
    } else {
      showSuccess(returned && returned.message ? returned.message : 'تم تغيير/تفعيل الباقة');
      if (returned && returned.start && returned.end) {
        const place = getLoggedPlace() || {};
        if (!place.raw) place.raw = {};
        place.raw['تاريخ بداية الاشتراك'] = returned.start;
        place.raw['تاريخ نهاية الاشتراك'] = returned.end;
        place.raw['الباقة'] = packageId;
        place.raw['حالة الباقة'] = 'مفعلة';
        if (returned.trialActivated) place.raw['حالة الباقة التجريبية'] = 'true';
        setLoggedPlace(place);
      }
    }
  } catch (err) {
    console.error('choosePackageAPI error', err);
    showError(err.message || 'فشل تغيير الباقة');
  } finally {
    await refreshPackageUIFromDashboard();
    updateActivateButtonState();
  }
}

/* ========== Payment modal ========== */
function showPaymentModal({ paymentId, amount, currency, placeId }) {
  const existing = document.getElementById('pm_modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'pm_modal';
  modal.style = `position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;`;
  modal.innerHTML = `
    <div style="background:#fff;padding:18px;border-radius:10px;max-width:720px;width:95%;direction:rtl;color:#111">
      <h3 style="margin-top:0">معلومات الدفع</h3>
      <p>معرف طلب الدفع: <strong id="pm_paymentId">${escapeHtml(paymentId)}</strong></p>
      <p>المبلغ المطلوب: <strong>${escapeHtml(String(amount))} ${escapeHtml(String(currency))}</strong></p>
      <h4>طرق الدفع المتاحة</h4>
      <div id="pm_methods" style="margin-bottom:8px"></div>
      <label style="display:block;margin-top:8px">ارفق إيصال الدفع (صورة)</label>
      <input type="file" id="pm_receipt" accept="image/*" style="display:block;margin:8px 0" />
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
        <button id="pm_cancel" class="btn btn-secondary">إلغاء</button>
        <button id="pm_send" class="btn btn-primary">أرسل الإيصال</button>
      </div>
      <div id="pm_msg" style="margin-top:10px;color:#333"></div>
    </div>
  `;
  document.body.appendChild(modal);

  const methodsContainer = modal.querySelector('#pm_methods');
  const methods = window.availablePaymentMethods || [];
  if (methods && methods.length) {
    methods.forEach(m => {
      const div = document.createElement('div');
      div.style = 'padding:8px;border-radius:6px;border:1px solid #eee;margin-bottom:6px;background:#fafafa';
      const name = m.name || m['طرق الدفع'] || (m.raw && (m.raw['طرق الدفع'] || m.raw['طريقة الدفع'])) || 'طريقة دفع';
      const id = (m.raw && (m.raw['معرف الدفع'] || m.id)) ? (m.raw['معرف الدفع'] || m.id) : '';
      div.innerHTML = `<strong style="display:block">${escapeHtml(name)}</strong>${id ? `<div style="color:#666;margin-top:4px">تفاصيل: ${escapeHtml(String(id))}</div>` : ''}`;
      methodsContainer.appendChild(div);
    });
  } else {
    methodsContainer.textContent = 'لا توجد طرق دفع معرفة. تواصل مع الإدارة.';
  }

  const inputFile = modal.querySelector('#pm_receipt');
  const btnCancel = modal.querySelector('#pm_cancel');
  const btnSend = modal.querySelector('#pm_send');
  const msg = modal.querySelector('#pm_msg');

  btnCancel.addEventListener('click', () => modal.remove());

  btnSend.addEventListener('click', async () => {
    if (!inputFile.files || inputFile.files.length === 0) {
      msg.textContent = 'الرجاء اختيار صورة الإيصال أولاً';
      return;
    }
    btnSend.disabled = true;
    msg.textContent = 'جاري رفع الإيصال...';

    try {
      const file = inputFile.files[0];
      const base64 = await readFileAsBase64(file);

      const uploadPayload = {
        action: 'uploadMedia',
        fileName: file.name,
        mimeType: file.type,
        fileData: base64,
        placeId: placeId || ''
      };
      const uploadResp = await apiPost(uploadPayload);
      if (!uploadResp.ok) throw new Error('فشل رفع الملف');
      const upData = uploadResp.data && uploadResp.data.data ? uploadResp.data.data : uploadResp.data;
      const fileUrl = (upData && (upData.fileUrl || upData.url)) || uploadResp.fileUrl || (uploadResp.data && uploadResp.data.fileUrl) || '';
      if (!fileUrl) {
        console.warn('upload response', uploadResp);
        throw new Error('لم يتم الحصول على رابط الملف بعد الرفع');
      }

      const updatePayload = {
        action: 'updatePaymentRequest',
        paymentId: paymentId,
        updates: { 'رابط إيصال الدفع': fileUrl, 'receiptUrl': fileUrl, 'الحالة': 'receipt_uploaded', 'ملاحظات': 'تم رفع إيصال من صاحب المحل' }
      };
      const updateResp = await apiPost(updatePayload);
      if (!updateResp.ok) {
        console.warn('updatePaymentRequest failed', updateResp);
        msg.textContent = 'تم رفع الإيصال لكن فشل ربطه بطلب الدفع في النظام.';
        setTimeout(()=> modal.remove(), 2200);
        return;
      }

      msg.textContent = 'تم إرسال الإيصال بنجاح. سيتم التحقق والتفعيل قريبًا.';
      setTimeout(()=> modal.remove(), 1800);
    } catch (err) {
      console.error(err);
      msg.textContent = 'حدث خطأ أثناء الإرسال: ' + (err.message || err);
      btnSend.disabled = false;
    }
  });
}

/* ========== Escape HTML ========== */
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]; });
}

/* ========== Add Ad helpers ========== */
function showAddAdForm() {
  editingAdId = null;
  clearAdForm();
  const submitBtn = document.querySelector('#adForm button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'حفظ الإعلان';
  showTab('ads');
  const container = document.getElementById('adFormContainer');
  if (container) { container.style.display = 'block'; setTimeout(() => { container.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80); }
}
function clearAdForm() {
  const form = document.getElementById('adForm');
  if (!form) return;
  try { form.reset(); } catch (e) {}
  uploadedImages = [];
  uploadedVideos = [];
  const ip = document.getElementById('adImagesPreview'); if (ip) ip.innerHTML = '';
  const vp = document.getElementById('adVideoPreview'); if (vp) vp.innerHTML = '';
  editingAdId = null;
}

/* ========== Place status buttons ========== */
function initPlaceStatusButtons() {
  const container = document.getElementById('placeStatusButtons');
  if (!container) return;
  container.querySelectorAll('.status-btn').forEach(btn => {
    const clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
  });
  const buttons = document.querySelectorAll('#placeStatusButtons .status-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', async (ev) => {
      const status = btn.dataset.status;
      if (!status) return;
      await updatePlaceStatus(status, btn);
    });
  });
}

function showPlaceStatusBar(place) {
  const bar = document.getElementById('placeStatusBar');
  const msg = document.getElementById('placeStatusMessage');
  if (!bar) return;
  if (!place || !place.id) {
    bar.style.display = 'none';
    if (msg) msg.textContent = '';
    return;
  }
  bar.style.display = 'block';
  const current = (place.status && String(place.status).trim() !== '') ? place.status
    : (place.raw && (place.raw['حالة المكان'] || place.raw['حالة التسجيل']) ? (place.raw['حالة المكان'] || place.raw['حالة التسجيل']) : '');
  const buttons = document.querySelectorAll('#placeStatusButtons .status-btn');
  buttons.forEach(b => { b.textContent = b.dataset.status || b.textContent; b.classList.toggle('active', b.dataset.status === current); b.disabled = false; });
  if (msg) msg.textContent = current ? `الحالة الحالية: ${current}` : 'الحالة غير محددة';
  initPlaceStatusButtons();
}

function hidePlaceStatusBar() {
  const bar = document.getElementById('placeStatusBar');
  const msg = document.getElementById('placeStatusMessage');
  if (bar) bar.style.display = 'none';
  if (msg) msg.textContent = '';
}

async function updatePlaceStatus(newStatus, btnElement = null) {
  let originalText = null;
  try {
    const logged = getLoggedPlace();
    const placeId = (logged && logged.id) ? logged.id : (logged && logged.placeId) ? logged.placeId : null;
    if (!placeId) throw new Error('لا يوجد مكان مسجّل للدخول');

    const current = (logged && logged.status) ? logged.status : (logged && logged.raw && (logged.raw['حالة المكان'] || logged.raw['حالة التسجيل']) ? (logged.raw['حالة المكان'] || logged.raw['حالة التسجيل']) : '');
    if (String(current) === String(newStatus)) {
      document.querySelectorAll('#placeStatusButtons .status-btn').forEach(b => b.classList.toggle('active', b.dataset.status === newStatus));
      const msg = document.getElementById('placeStatusMessage');
      if (msg) msg.textContent = `الحالة: ${newStatus}`;
      return;
    }

    const buttons = document.querySelectorAll('#placeStatusButtons .status-btn');
    buttons.forEach(b => b.disabled = true);

    if (btnElement) { originalText = btnElement.textContent; btnElement.textContent = 'جاري الحفظ...'; }

    const payload = { action: 'updatePlace', placeId: placeId, status: newStatus };
    const resp = await apiPost(payload);
    if (!resp.ok) throw new Error('فشل في التواصل مع الخادم');
    const data = resp.data;
    if (!data || data.success === false) throw new Error((data && data.error) ? data.error : 'استجابة غير متوقعة');

    const stored = getLoggedPlace() || {};
    stored.status = newStatus;
    if (!stored.raw) stored.raw = {};
    stored.raw['حالة المكان'] = newStatus;
    stored.raw['حالة التسجيل'] = newStatus;
    setLoggedPlace(stored);

    buttons.forEach(b => { b.classList.toggle('active', b.dataset.status === newStatus); b.disabled = false; b.textContent = b.dataset.status || b.textContent; });

    if (btnElement && originalText !== null) btnElement.textContent = btnElement.dataset.status || originalText;
    const msg = document.getElementById('placeStatusMessage'); if (msg) msg.textContent = `تم التحديث إلى: ${newStatus}`;

    showSuccess('تم تحديث حالة المكان');
  } catch (err) {
    console.error('updatePlaceStatus error', err);
    showError(err.message || 'فشل تحديث حالة المكان');
    document.querySelectorAll('#placeStatusButtons .status-btn').forEach(b => { b.disabled = false; b.textContent = b.dataset.status || b.textContent; });
    if (btnElement && originalText !== null) btnElement.textContent = originalText;
  }
}

/* ========== Map helpers ========== */
function parseLatLngFromMapLink(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    url = url.trim();
    let m = url.match(/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    m = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    m = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    m = url.match(/[?&]mlat=(-?\d+\.\d+)&mlon=(-?\d+\.\d+)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    m = url.match(/#map=\d+\/(-?\d+\.\d+)\/(-?\d+\.\d+)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    m = url.match(/(-?\d+\.\d+)[, ]\s*(-?\d+\.\d+)/);
    if (m) { const lat = parseFloat(m[1]), lng = parseFloat(m[2]); if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }; }
    return null;
  } catch (e) { console.warn('parseLatLngFromMapLink error', e); return null; }
}

async function reverseGeocodeNominatim(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&addressdetails=1`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'Khedmatak-App/1.0 (contact@example.com)' } });
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch (e) { console.warn('reverseGeocodeNominatim error', e); return null; }
}

async function autoFillFromMapLink(url) {
  if (!url || String(url).trim() === '') return;
  const coords = parseLatLngFromMapLink(url);
  if (!coords) return;
  const geo = await reverseGeocodeNominatim(coords.lat, coords.lng);
  if (!geo) return;
  const detailed = geo.display_name || '';
  const address = geo.address || {};
  const detailedEl = document.querySelector('input[name="detailedAddress"]');
  if (detailedEl && (!detailedEl.value || detailedEl.value.trim() === '')) detailedEl.value = detailed;
  const cityCandidates = [address.city, address.town, address.village, address.county, address.state];
  const areaCandidates = [address.suburb, address.neighbourhood, address.hamlet, address.village, address.city_district];
  const cityVal = cityCandidates.find(Boolean);
  const areaVal = areaCandidates.find(Boolean);
  if (cityVal) { await setSelectValueWhenReady('select[name="city"]', cityVal); try { updateAreas(); } catch(e){} }
  if (areaVal) { await setSelectValueWhenReady('select[name="area"]', areaVal); }
  const msgEl = document.getElementById('placeStatusMessage'); if (msgEl) msgEl.textContent = `مأخوذ من الخريطة: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
}

/* ========== Auto geolocation ========== */
function initMapLinkAutoFill() {
  const mapInput = document.querySelector('input[name="mapLink"]');
  if (!mapInput) return;
  let timer = null;
  const run = () => { const v = mapInput.value; if (v && v.trim() !== '') autoFillFromMapLink(v.trim()); };
  mapInput.addEventListener('blur', run);
  mapInput.addEventListener('input', () => { if (timer) clearTimeout(timer); timer = setTimeout(run, 900); });
}

function buildGoogleMapsLink(lat, lng) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lat + ',' + lng)}`; }
async function handlePositionAndFill(lat, lng) {
  try {
    const mapEl = document.querySelector('input[name="mapLink"]') || document.getElementById('mapLinkInput');
    if (mapEl) {
      mapEl.value = buildGoogleMapsLink(lat, lng);
      try { mapEl.dispatchEvent(new Event('input', { bubbles: true })); } catch(e){}
      try { mapEl.dispatchEvent(new Event('change', { bubbles: true })); } catch(e){}
    }
    const msgEl = document.getElementById('placeStatusMessage'); if (msgEl) msg.textContent = `الإحداثيات: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    const geo = await reverseGeocodeNominatim(lat, lng);
    if (!geo) return;
    const detailed = geo.display_name || '';
    const address = geo.address || {};
    const detailedEl = document.querySelector('input[name="detailedAddress"]');
    if (detailedEl && (!detailedEl.value || detailedEl.value.trim() === '')) detailedEl.value = detailed;
    const cityCandidates = [address.city, address.town, address.village, address.county, address.state];
    const areaCandidates = [address.suburb, address.neighbourhood, address.hamlet, address.village, address.city_district];
    const cityVal = cityCandidates.find(Boolean);
    if (cityVal) { await setSelectValueWhenReady('select[name="city"]', cityVal); try { updateAreas(); } catch(e){} }
    const areaVal = areaCandidates.find(Boolean);
    if (areaVal) { await setSelectValueWhenReady('select[name="area"]', areaVal); }
  } catch (e) { console.error('handlePositionAndFill error', e); }
}
function requestGeolocationOnce(options = { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
    navigator.geolocation.getCurrentPosition(pos => resolve(pos), err => reject(err), options);
  });
}
async function attemptAutoLocate(showMessages = true) {
  const mapInput = document.querySelector('input[name="mapLink"]') || document.getElementById('mapLinkInput');
  if (mapInput && mapInput.value && mapInput.value.trim() !== '') return;
  try {
    if (showMessages) showSuccess('جاري محاولة تحديد موقعك...');
    const pos = await requestGeolocationOnce();
    const lat = pos.coords.latitude; const lng = pos.coords.longitude;
    await handlePositionAndFill(lat, lng);
    if (showMessages) showSuccess('تم تحديد الموقع وملأ الحقول تلقائياً');
  } catch (err) {
    console.warn('Auto locate failed:', err);
    if (showMessages) showError('تعذر الحصول على الموقع. تأكد من منح الإذن أو اضغط "استخدم موقعي"');
  }
}
function initMapAutoLocate() {
  const btn = document.getElementById('autoLocateBtn');
  if (btn) {
    btn.addEventListener('click', async () => {
      btn.disabled = true; const old = btn.textContent; btn.textContent = 'جاري تحديد الموقع...';
      await attemptAutoLocate(true);
      btn.disabled = false; btn.textContent = old;
    });
  }
  setTimeout(() => { try { attemptAutoLocate(false); } catch(e){} }, 900);
}

/* ========== Countdown helpers (اليوم/الساعة) ========== */
let packageCountdownTimer = null;

function clearPackageCountdown() {
  if (packageCountdownTimer) {
    clearInterval(packageCountdownTimer);
    packageCountdownTimer = null;
  }
  const el = document.getElementById('packageCountdown');
  if (el) el.textContent = '';
}

function startPackageCountdown(endDate) {
  clearPackageCountdown();
  const el = document.getElementById('packageCountdown');
  if (!el || !endDate) return;
  function tick() {
    const now = new Date();
    let diff = endDate.getTime() - now.getTime();
    if (diff <= 0) {
      el.textContent = 'انتهى الاشتراك';
      clearPackageCountdown();
      refreshPackageUIFromDashboard();
      return;
    }
    const dayMs = 1000*60*60*24;
    const hourMs = 1000*60*60;
    const days = Math.floor(diff / dayMs);
    diff -= days * dayMs;
    const hours = Math.floor(diff / hourMs);
    el.textContent = `العدّاد: ${days} يوم و${hours} ساعة`;
  }
  tick();
  packageCountdownTimer = setInterval(tick, 60 * 1000);
}

/* ========== Helpers for dates ========== */
function parseDateISO(d) {
  if (!d) return null;
  try {
    if (d instanceof Date) return d;
    const s = String(d).trim();
    if (!s) return null;
    const parts = s.split('-');
    if (parts.length === 3) {
      const y = Number(parts[0]), m = Number(parts[1]) - 1, day = Number(parts[2]);
      const dt = new Date(y, m, day);
      dt.setHours(23,59,59,999);
      return dt;
    }
    const dt2 = new Date(s);
    return isNaN(dt2.getTime()) ? null : dt2;
  } catch { return null; }
}
function daysBetween(from, to) {
  if (!from || !to) return null;
  const d1 = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const d2 = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  const ms = d2 - d1;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}
function diffDaysHours(from, to) {
  if (!from || !to) return { days: null, hours: null, ms: null };
  let diff = to.getTime() - from.getTime();
  if (diff < 0) diff = 0;
  const dayMs = 1000*60*60*24;
  const hourMs = 1000*60*60;
  const days = Math.floor(diff / dayMs);
  diff -= days * dayMs;
  const hours = Math.floor(diff / hourMs);
  return { days, hours, ms: to.getTime() - from.getTime() };
}

/* ========== Package UI refresh (cards + colored countdown) ========== */
async function refreshPackageUIFromDashboard() {
  try {
    const logged = getLoggedPlace();
    const hint = document.getElementById('activateHint');
    const btn = document.getElementById('activatePackageBtn');

    const card = document.getElementById('currentPackageCard');
    const cardText = document.getElementById('currentPackageText');
    const cardCountdown = document.getElementById('currentPackageCountdown');

    const inlineCard = document.getElementById('packageInfoCard');
    const inlineText = document.getElementById('packageInfoText');
    const inlineCountdown = document.getElementById('packageInfoCountdown');

    if (hint) hint.classList.remove('active','pending','expired');
    [card, inlineCard].forEach(c => { if (c) c.style.display = 'none'; });
    [cardText, inlineText].forEach(t => { if (t) t.textContent = ''; });
    [cardCountdown, inlineCountdown].forEach(cd => { if (cd) { cd.textContent = ''; cd.className = 'package-countdown'; clearInterval(cd && cd._timer); } });

    if (!logged || !logged.id) {
      if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
      return;
    }

    const resp = await apiPost({ action: 'getDashboard', placeId: logged.id });
    if (!resp.ok || !resp.data) return;
    const payload = resp.data.data || resp.data;
    const place = payload.place || null;
    if (!place || !place.raw) return;

    const pkgStatus = String(place.raw['حالة الباقة'] || place.raw['packageStatus'] || '').trim();
    const pkgId = String(place.raw['الباقة'] || place.package || '').trim();
    const startRaw = place.raw['تاريخ بداية الاشتراك'] || place.packageStart || '';
    const endRaw = place.raw['تاريخ نهاية الاشتراك'] || place.packageEnd || '';
    const startDate = parseDateISO(startRaw);
    const endDate = parseDateISO(endRaw);
    const today = new Date();

    // اسم الباقة من lookups إن توفر
    let packageName = '';
    try {
      if (window.lastLookups && Array.isArray(lastLookups.packages)) {
        const f = lastLookups.packages.find(p => String(p.id) === pkgId);
        if (f) packageName = f.name;
      }
    } catch {}

    let remaining = (startDate && endDate) ? daysBetween(today, endDate) : null;
    if (remaining !== null && remaining < 0) remaining = 0;

    function setCountdown(el, end) {
      if (!el || !end) return;
      const update = () => {
        const dh = diffDaysHours(new Date(), end);
        const days = dh.days ?? 0;
        const hours = dh.hours ?? 0;
        el.textContent = `العدّاد: ${days} يوم و${hours} ساعة`;
        el.classList.remove('countdown-ok','countdown-warn','countdown-crit');
        if (dh.ms <= 48*60*60*1000) el.classList.add('countdown-crit');
        else if (dh.ms <= 7*24*60*60*1000) el.classList.add('countdown-warn');
        else el.classList.add('countdown-ok');
      };
      update();
      clearInterval(el._timer);
      el._timer = setInterval(update, 60 * 1000);
    }

    // عرض حسب الحالة
    if (!pkgStatus) {
      clearPackageCountdown();
      if (hint) hint.textContent = 'حالة الباقة: لا يوجد اشتراك';
      if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.textContent = 'تفعيل الاشتراك'; }
      [card, inlineCard].forEach(c => { if (c) c.style.display = 'block'; });
      if (cardText) cardText.textContent = 'باقتك الحالية: لا يوجد اشتراك';
      if (inlineText) inlineText.textContent = 'باقتك الحالية: لا يوجد اشتراك';
      return;
    }

    if (pkgStatus === 'مفعلة') {
      if (btn) { btn.disabled = true; btn.style.opacity = '0.8'; btn.textContent = 'الاشتراك مُفعّل'; }
      let msg = 'حالة الباقة: مفعلة';
      if (startDate && endDate) {
        const sTxt = startDate.toISOString().split('T')[0];
        const eTxt = endDate.toISOString().split('T')[0];
        msg += ` — البداية: ${sTxt} · النهاية: ${eTxt}${remaining !== null ? ` · المتبقي: ${remaining} يوم` : ''}`;
      }
      if (hint) { hint.textContent = msg; hint.classList.add('active'); }

      [card, inlineCard].forEach(c => { if (c) c.style.display = 'block'; });
      const pn = packageName || (pkgId ? `ID ${pkgId}` : 'غير معروفة');
      const eTxt = endDate ? endDate.toISOString().split('T')[0] : '';
      const remTxt = remaining !== null ? ` — المتبقي ${remaining} يوم` : '';
      if (cardText) cardText.textContent = `باقتك الحالية: ${pn}${eTxt ? ` — تنتهي في ${eTxt}` : ''}${remTxt}`;
      if (inlineText) inlineText.textContent = `باقتك الحالية: ${pn}${eTxt ? ` — تنتهي في ${eTxt}` : ''}${remTxt}`;

      if (endDate) {
        // عرض العدّاد في بطاقة تبويب الباقات
        if (cardCountdown) setCountdown(cardCountdown, endDate);
        // عدّاد نصي بجانب الزر القديم
        const daysLeft = daysBetween(today, endDate);
        if (daysLeft !== null && daysLeft <= 30) startPackageCountdown(endDate); else clearPackageCountdown();
        // عدّاد بطاقة النموذج
        if (inlineCountdown) setCountdown(inlineCountdown, endDate);
      }
      return;
    }

    if (pkgStatus === 'قيد الدفع') {
      clearPackageCountdown();
      if (btn) { btn.disabled = true; btn.style.opacity = '0.8'; btn.textContent = 'قيد التحقق من الدفع'; }
      if (hint) { hint.textContent = 'سيتم التأكد من عملية الدفع و التفعيل خلال لحظات'; hint.classList.add('pending'); }
      [card, inlineCard].forEach(c => { if (c) c.style.display = 'block'; });
      const pn = packageName || (pkgId ? `ID ${pkgId}` : 'غير معروفة');
      if (cardText) cardText.textContent = `باقتك الحالية: ${pn} — الحالة: قيد الدفع`;
      if (inlineText) inlineText.textContent = `باقتك الحالية: ${pn} — الحالة: قيد الدفع`;
      return;
    }

    if (pkgStatus === 'منتهية') {
      clearPackageCountdown();
      if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.textContent = 'تجديد الاشتراك'; }
      let msg = 'حالة الباقة: منتهية';
      if (startDate && endDate) {
        const sTxt = startDate.toISOString().split('T')[0];
        const eTxt = endDate.toISOString().split('T')[0];
        msg += ` — البداية: ${sTxt} · النهاية: ${eTxt}`;
      }
      if (hint) { hint.textContent = msg; hint.classList.add('expired'); }
      [card, inlineCard].forEach(c => { if (c) c.style.display = 'block'; });
      const pn = packageName || (pkgId ? `ID ${pkgId}` : 'غير معروفة');
      const eTxt = endDate ? endDate.toISOString().split('T')[0] : '';
      if (cardText) cardText.textContent = `باقتك الحالية: ${pn} — الحالة: منتهية${eTxt ? ` — انتهت في ${eTxt}` : ''}`;
      if (inlineText) inlineText.textContent = `باقتك الحالية: ${pn} — الحالة: منتهية${eTxt ? ` — انتهت في ${eTxt}` : ''}`;
      return;
    }

    // حالات أخرى
    clearPackageCountdown();
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.textContent = (pkgStatus.indexOf('منته') !== -1) ? 'تجديد الاشتراك' : 'تفعيل الاشتراك'; }
    if (hint) hint.textContent = `حالة الباقة: ${pkgStatus}`;
    [card, inlineCard].forEach(c => { if (c) c.style.display = 'block'; });
    const pn = packageName || (pkgId ? `ID ${pkgId}` : 'غير معروفة');
    if (cardText) cardText.textContent = `باقتك الحالية: ${pn} — الحالة: ${pkgStatus}`;
    if (inlineText) inlineText.textContent = `باقتك الحالية: ${pn} — الحالة: ${pkgStatus}`;
  } catch (e) {
    console.warn('refreshPackageUIFromDashboard error', e);
  }
}

/* ========== تجريبية: لا تُمنع إلا إذا الحالة منتهية ========== */
async function checkIfTrialIsUsed(placeId) {
  try {
    const payload = { action: 'getDashboard', placeId };
    const resp = await apiPost(payload);
    if (!resp.ok) return false;
    const data = resp.data && resp.data.data ? resp.data.data : resp.data;
    const place = data && data.place ? data.place : null;
    if (!place || !place.raw) return false;
    const trialUsed = String(place.raw['حالة الباقة التجريبية']).toLowerCase() === 'true';
    const pkgStatus = String(place.raw['حالة الباقة'] || '').trim();
    // لا نمنع التجريبية إن كانت نشطة الآن. نمنع فقط إذا استخدمت سابقًا وحالتها الحالية منتهية
    if (trialUsed && pkgStatus === 'منتهية') return true;
    return false;
  } catch (e) {
    console.warn('checkIfTrialIsUsed error', e);
    return false;
  }
}

/* ========== تفعيل الباقة من النموذج + حالة الزر أثناء التنفيذ ========== */
async function activatePackageFromForm() {
  const btn = document.getElementById('activatePackageBtn');
  const oldHtml = btn ? btn.innerHTML : '';
  try {
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التفعيل...'; }
    const packageSelect = document.querySelector('select[name="package"]');
    const loggedPlace = getLoggedPlace();

    if (!loggedPlace || !loggedPlace.id) {
      showError('يجب تسجيل الدخول أولاً لتفعيل الباقة');
      return;
    }
    if (!packageSelect || !packageSelect.value) {
      showError('يجب اختيار باقة أولاً من القائمة');
      return;
    }

    const selectedOpt = packageSelect.options[packageSelect.selectedIndex];
    const selPrice = Number(selectedOpt?.dataset?.price || 0);

    if (selPrice === 0) {
      const isTrialBlocked = await checkIfTrialIsUsed(loggedPlace.id);
      if (isTrialBlocked) {
        showError('الباقة التجريبية تم تفعيلها مسبقًا (والاشتراك السابق منتهٍ). لا يمكن تفعيلها مرة أخرى.');
        return;
      }
    }

    await choosePackageAPI(packageSelect.value);
  } catch (e) {
    console.error('activatePackageFromForm error', e);
    showError('تعذر تفعيل الباقة');
  } finally {
    await refreshPackageUIFromDashboard();
    updateActivateButtonState();
    if (btn) { btn.disabled = false; btn.innerHTML = oldHtml || '<i class="fas fa-bolt"></i> تفعيل الاشتراك'; }
  }
}

function updateActivateButtonState() {
  try {
    const btn = document.getElementById('activatePackageBtn');
    const hint = document.getElementById('activateHint');
    const select = document.querySelector('select[name="package"]');
    if (!btn) return;

    const logged = getLoggedPlace();
    const hasLogin = !!(logged && logged.id);
    const hasPackageSelection = !!(select && select.value && String(select.value).trim() !== '');

    if (!hasLogin) {
      btn.disabled = true; btn.style.opacity = '0.6';
      if (hint) { hint.textContent = 'سجّل الدخول أولاً لتفعيل الاشتراك'; hint.classList.remove('active','pending','expired'); }
      clearPackageCountdown();
      return;
    }

    if (!hasPackageSelection) {
      const status = (getLoggedPlace()?.raw?.['حالة الباقة'] || '').trim();
      if (hint) { hint.textContent = 'حالة الباقة: ' + (status || 'لا يوجد اشتراك'); hint.classList.remove('active','pending','expired'); }
      refreshPackageUIFromDashboard();
      return;
    }

    const selectedOpt = select.options[select.selectedIndex];
    const selPrice = Number(selectedOpt?.dataset?.price || 0);
    if (selPrice === 0) {
      checkIfTrialIsUsed(logged.id).then(used => {
        if (used) {
          btn.disabled = true; btn.style.opacity = '0.6';
          if (hint) { hint.textContent = 'لا يمكن تفعيل الباقة التجريبية مرة أخرى بعد انتهائها.'; hint.classList.remove('active','pending','expired'); }
        } else {
          btn.disabled = false; btn.style.opacity = '1';
          if (hint) { hint.textContent = ''; hint.classList.remove('active','pending','expired'); }
        }
        refreshPackageUIFromDashboard();
      }).catch(()=> {
        btn.disabled = false; btn.style.opacity = '1';
        if (hint) { hint.textContent = ''; hint.classList.remove('active','pending','expired'); }
        refreshPackageUIFromDashboard();
      });
      return;
    }

    btn.disabled = false; btn.style.opacity = '1';
    if (hint) { hint.textContent = ''; hint.classList.remove('active','pending','expired'); }
    refreshPackageUIFromDashboard();
  } catch (e) {
    console.warn('updateActivateButtonState error', e);
  }
}

/* ========== Inline package info card in place form ========== */
function updateInlinePackageInfoCard(place) {
  try {
    const card = document.getElementById('packageInfoCard');
    const text = document.getElementById('packageInfoText');
    const countdown = document.getElementById('packageInfoCountdown');
    if (!card || !text || !countdown) return;
    card.style.display = 'none'; text.textContent = ''; countdown.textContent = ''; countdown.className = 'package-countdown'; clearInterval(countdown._timer);

    const raw = place.raw || {};
    const pkgStatus = String(raw['حالة الباقة'] || '').trim();
    const pkgId = String(raw['الباقة'] || '').trim();
    const startRaw = raw['تاريخ بداية الاشتراك'] || '';
    const endRaw = raw['تاريخ نهاية الاشتراك'] || '';
    const startDate = parseDateISO(startRaw);
    const endDate = parseDateISO(endRaw);

    let packageName = '';
    try {
      if (window.lastLookups && Array.isArray(lastLookups.packages)) {
        const f = lastLookups.packages.find(p => String(p.id) === pkgId);
        if (f) packageName = f.name;
      }
    } catch {}

    if (!pkgStatus) {
      card.style.display = 'block';
      text.textContent = 'باقتك الحالية: لا يوجد اشتراك';
      return;
    }

    if (pkgStatus === 'مفعلة') {
      const today = new Date();
      let remaining = (startDate && endDate) ? daysBetween(today, endDate) : null;
      if (remaining !== null && remaining < 0) remaining = 0;
      const pn = packageName || (pkgId ? `ID ${pkgId}` : 'غير معروفة');
      const eTxt = endDate ? endDate.toISOString().split('T')[0] : '';
      text.textContent = `باقتك الحالية: ${pn}${eTxt ? ` — تنتهي في ${eTxt}` : ''}${remaining !== null ? ` — المتبقي ${remaining} يوم` : ''}`;
      card.style.display = 'block';

      if (endDate) {
        const update = () => {
          const dh = diffDaysHours(new Date(), endDate);
          const days = dh.days ?? 0;
          const hours = dh.hours ?? 0;
          countdown.textContent = `العدّاد: ${days} يوم و${hours} ساعة`;
          countdown.classList.remove('countdown-ok','countdown-warn','countdown-crit');
          if (dh.ms <= 48*60*60*1000) countdown.classList.add('countdown-crit');
          else if (dh.ms <= 7*24*60*60*1000) countdown.classList.add('countdown-warn');
          else countdown.classList.add('countdown-ok');
        };
        update();
        clearInterval(countdown._timer);
        countdown._timer = setInterval(update, 60 * 1000);
      }
      return;
    }

    if (pkgStatus === 'قيد الدفع') {
      const pn = packageName || (pkgId ? `ID ${pkgId}` : 'غير معروفة');
      text.textContent = `باقتك الحالية: ${pn} — الحالة: قيد الدفع`;
      card.style.display = 'block';
      return;
    }

    if (pkgStatus === 'منتهية') {
      const pn = packageName || (pkgId ? `ID ${pkgId}` : 'غير معروفة');
      const eTxt = endDate ? endDate.toISOString().split('T')[0] : '';
      text.textContent = `باقتك الحالية: ${pn} — الحالة: منتهية${eTxt ? ` — انتهت في ${eTxt}` : ''}`;
      card.style.display = 'block';
      return;
    }

    // حالات أخرى
    const pn = packageName || (pkgId ? `ID ${pkgId}` : 'غير معروفة');
    text.textContent = `باقتك الحالية: ${pn} — الحالة: ${pkgStatus}`;
    card.style.display = 'block';
  } catch (e) {
    console.warn('updateInlinePackageInfoCard error', e);
  }
}

