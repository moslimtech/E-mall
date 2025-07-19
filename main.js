const API_URL = "https://script.google.com/macros/s/AKfycbxkKrHyeEAgSkLz2QHzSgA5w09dIvfFJgDUMkP373f-VVAZmahHalr0GOYojqK41x6E/exec";

let allData = {};
let currentFilters = { city: "", area: "", activity: "" };

async function fetchData() {
  const res = await fetch(API_URL);
  allData = await res.json();
  populateFilters();
  displayPlaces();
}

function populateFilters() {
  const citySelect = document.getElementById("cityFilter");
  const areaSelect = document.getElementById("areaFilter");
  const activitySelect = document.getElementById("activityFilter");

  citySelect.innerHTML = `<option value="">اختر المدينة</option>`;
  allData.cities.forEach(c => {
    citySelect.innerHTML += `<option value="${c.IDالمدينة}">${c.المدينة}</option>`;
  });

  areaSelect.innerHTML = `<option value="">اختر المنطقة</option>`;
  allData.areas.forEach(a => {
    areaSelect.innerHTML += `<option value="${a.IDالمنطقة}">${a.المنطقة}</option>`;
  });

  activitySelect.innerHTML = `<option value="">اختر النشاط</option>`;
  [...new Set(allData.places.map(p => p["معرف نوع النشاط"]))].forEach(act => {
    activitySelect.innerHTML += `<option value="${act}">${act}</option>`;
  });
}

function displayPlaces() {
  const grid = document.getElementById("placesGrid");
  grid.innerHTML = "";

  let filtered = allData.places.filter(p =>
    (!currentFilters.city || p.المدينة == currentFilters.city) &&
    (!currentFilters.area || p.المنطقة == currentFilters.area) &&
    (!currentFilters.activity || p["معرف نوع النشاط"] == currentFilters.activity)
  );

  filtered.forEach(p => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${p["رابط صورة شعار المكان"] || 'default.jpg'}" alt="شعار" />
      <h3>${p["اسم المكان"]}</h3>
      <p>خدمة: ${p["يوجد خدمة توصيل"]}</p>
      <div class="contact-icons">
        <a href="tel:${p["رقم التواصل"]}"><i class="fas fa-phone"></i></a>
        <a href="${p["رابط واتساب"]}" target="_blank"><i class="fab fa-whatsapp"></i></a>
      </div>
      <button onclick="location.href='ads.html?place=${p["معرف المكان"]}'">عرض الإعلانات</button>
    `;
    grid.appendChild(card);
  });
}

document.querySelectorAll(".filter-bar select").forEach(sel => {
  sel.addEventListener("change", e => {
    if (e.target.id === "cityFilter") currentFilters.city = e.target.value;
    if (e.target.id === "areaFilter") currentFilters.area = e.target.value;
    if (e.target.id === "activityFilter") currentFilters.activity = e.target.value;
    displayPlaces();
  });
});

fetchData();
setInterval(fetchData, 30000);