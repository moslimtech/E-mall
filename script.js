const API_URL = "https://script.google.com/macros/s/AKfycbxkKrHyeEAgSkLz2QHzSgA5w09dIvfFJgDUMkP373f-VVAZmahHalr0GOYojqK41x6E/exec"
; // رابط Web App من Google Apps Script

let allPlaces = [];
let allAds = [];

const cityFilter = document.getElementById("cityFilter");
const areaFilter = document.getElementById("areaFilter");
const placeFilter = document.getElementById("placeFilter");
const placesGrid = document.getElementById("placesGrid");

// جلب البيانات من الـ API
async function fetchData() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();

    allPlaces = data.places || [];
    allAds = data.ads || [];

    populateFilters();
    renderPlaces();
  } catch (error) {
    console.error("خطأ في جلب البيانات:", error);
  }
}

// تعبئة الفلاتر
function populateFilters() {
  const cities = [...new Set(allPlaces.map(p => p["المدينة"]))];
  cityFilter.innerHTML = `<option value="">اختر المدينة</option>` + cities.map(c => `<option value="${c}">${c}</option>`).join("");
}

cityFilter.addEventListener("change", () => {
  const selectedCity = cityFilter.value;
  const filteredAreas = [...new Set(allPlaces.filter(p => p["المدينة"] === selectedCity).map(p => p["المنطقة"]))];
  areaFilter.innerHTML = `<option value="">اختر المنطقة</option>` + filteredAreas.map(a => `<option value="${a}">${a}</option>`).join("");
  renderPlaces();
});

areaFilter.addEventListener("change", () => {
  const selectedArea = areaFilter.value;
  const filteredPlaces = allPlaces.filter(p => p["المنطقة"] === selectedArea).map(p => p["اسم المكان"]);
  placeFilter.innerHTML = `<option value="">اختر المكان</option>` + filteredPlaces.map(pl => `<option value="${pl}">${pl}</option>`).join("");
  renderPlaces();
});

placeFilter.addEventListener("change", renderPlaces);

// عرض المحلات
function renderPlaces() {
  const selectedCity = cityFilter.value;
  const selectedArea = areaFilter.value;
  const selectedPlace = placeFilter.value;

  const filteredPlaces = allPlaces.filter(p => {
    return (!selectedCity || p["المدينة"] === selectedCity) &&
           (!selectedArea || p["المنطقة"] === selectedArea) &&
           (!selectedPlace || p["اسم المكان"] === selectedPlace);
  });

  placesGrid.innerHTML = "";
  filteredPlaces.forEach(place => {
    const adsForPlace = allAds.filter(ad => ad["معرف المكان"] === place["معرف المكان"] && ad["حالة الاعلان"] === "نشط");
    const hasAd = adsForPlace.length > 0;
    const statusClass = place["حالة المكان الان"] === "مفتوح الان" ? "open" : (place["حالة المكان الان"] === "مغلق للصلاة" ? "prayer" : "closed");

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="status ${statusClass}"></div>
      ${hasAd ? '<div class="badge">عرض</div>' : ''}
      <img src="${place["رابط صورة شعار المكان"] || 'placeholder.jpg'}" alt="شعار">
      <h3>${place["اسم المكان"]}</h3>
      <p>${place["المنطقة"] || "-"}</p>
      <div class="contact-icons">
        <a href="tel:${place["رقم التواصل"]}"><i class="fas fa-phone"></i></a>
        <a href="${place["رابط واتساب"]}" target="_blank"><i class="fab fa-whatsapp"></i></a>
      </div>
      <button onclick="window.location.href='ads.html?place=${place["معرف المكان"]}'">عرض الإعلانات</button>
    `;
    placesGrid.appendChild(card);
  });
}

// تحديث كل 30 ثانية بدون فقدان الفلترة
setInterval(fetchData, 30000);
fetchData();

