
const API_URL = "https://script.google.com/macros/s/AKfycbxkKrHyeEAgSkLz2QHzSgA5w09dIvfFJgDUMkP373f-VVAZmahHalr0GOYojqK41x6E/exec";
let places = [], ads = [];

async function fetchData() {
  const res = await fetch(API_URL);
  const data = await res.json();
  places = data.places;
  ads = data.ads;
  populateFilters();
  renderPlaces();
}
function populateFilters() {
  const citySelect = document.getElementById('filterCity');
  const areaSelect = document.getElementById('filterArea');
  const cities = [...new Set(places.map(p => p['المدينة']))];
  citySelect.innerHTML = '<option value="">اختر المدينة</option>' + cities.map(c => `<option value="${c}">${c}</option>`).join('');
  areaSelect.innerHTML = '<option value="">اختر المنطقة</option>';
  citySelect.onchange = () => {
    const city = citySelect.value;
    const filteredAreas = places.filter(p => p['المدينة'] === city).map(p => p['المنطقة']);
    areaSelect.innerHTML = '<option value="">اختر المنطقة</option>' + [...new Set(filteredAreas)].map(a => `<option value="${a}">${a}</option>`).join('');
    renderPlaces();
  };
  areaSelect.onchange = renderPlaces;
}
function renderPlaces() {
  const city = document.getElementById('filterCity').value;
  const area = document.getElementById('filterArea').value;
  const grid = document.getElementById('placesGrid');
  grid.innerHTML = '';
  let filtered = places.filter(p => (!city || p['المدينة'] === city) && (!area || p['المنطقة'] === area));
  filtered.forEach(place => {
    const statusClass = place['حالة المكان الان'] === 'مفتوح الان' ? 'status open' : (place['حالة المكان الان'] === 'مغلق للصلاة' ? 'status prayer' : 'status closed');
    const card = `
      <div class="card">
        <div class="${statusClass}"></div>
        <img src="${place['رابط صورة شعار المكان'] || 'default.jpg'}" alt="شعار">
        <h3>${place['اسم المكان']}</h3>
        <div class="contact-icons">
          ${place['رقم التواصل'] ? `<a href="tel:${place['رقم التواصل']}"><i class="fas fa-phone"></i></a>` : ''}
          ${place['رابط واتساب'] ? `<a href="${place['رابط واتساب']}" target="_blank"><i class="fab fa-whatsapp"></i></a>` : ''}
        </div>
        <a class="btn" href="ads.html?place=${place['معرف المكان']}">عرض الإعلانات</a>
      </div>`;
    grid.innerHTML += card;
  });
}
function renderAds() {
  const urlParams = new URLSearchParams(window.location.search);
  const placeId = urlParams.get('place');
  const adsGrid = document.getElementById('adsGrid');
  if (!adsGrid) return;
  adsGrid.innerHTML = '';
  const placeAds = ads.filter(ad => ad['معرف المكان'] === placeId && ad['حالة الاعلان'] === 'نشط');
  if (placeAds.length === 0) {
    adsGrid.innerHTML = '<p>لا توجد إعلانات نشطة لهذا المكان.</p>';
  } else {
    placeAds.forEach(ad => {
      adsGrid.innerHTML += `
        <div class="card">
          <img src="${ad['رابط الصورة'] || 'default.jpg'}" alt="إعلان">
          <h3>${ad['عنوان العرض'] || ''}</h3>
          <p>${ad['وصف'] || ''}</p>
          ${ad['رابط الفيديو'] ? `<iframe src="${ad['رابط الفيديو']}" width="100%" height="100" frameborder="0"></iframe>` : ''}
          ${ad['رابط يوتيوب'] ? `<a href="${ad['رابط يوتيوب']}" target="_blank">مشاهدة على يوتيوب</a>` : ''}
        </div>`;
    });
  }
}
fetchData();
renderAds();
setInterval(fetchData, 30000);
