const API_URL = "https://script.google.com/macros/s/AKfycbxkKrHyeEAgSkLz2QHzSgA5w09dIvfFJgDUMkP373f-VVAZmahHalr0GOYojqK41x6E/exec";

async function fetchAds() {
  const urlParams = new URLSearchParams(window.location.search);
  const placeId = urlParams.get("place");

  const res = await fetch(API_URL);
  const data = await res.json();
  const ads = data.ads.filter(ad => ad["معرف المكان"] === placeId && ad["حالة الاعلان"] === "نشط");

  const container = document.getElementById("adsContainer");
  container.innerHTML = ads.length ? "" : "<p>لا توجد إعلانات نشطة لهذا المكان</p>";

  ads.forEach(ad => {
    const adDiv = document.createElement("div");
    adDiv.className = "ad-card";
    adDiv.innerHTML = `
      <h3>${ad["عنوان العرض"] || "إعلان"}</h3>
      <p>${ad["وصف"] || ""}</p>
      <div>
        ${[ad["رابط الصورة"], ad["رابط صورة2"], ad["رابط صورة3"]].filter(i => i).map(img => `<img src="${img}" onclick="openLightbox('${img}')">`).join("")}
      </div>
      ${ad["رابط الفيديو"] ? `<iframe src="${ad["رابط الفيديو"]}" width="100%" height="200" frameborder="0" allowfullscreen></iframe>` : ""}
      ${ad["رابط يوتيوب"] ? `<a href="${ad["رابط يوتيوب"]}" target="_blank">مشاهدة على يوتيوب</a>` : ""}
    `;
    container.appendChild(adDiv);
  });
}

function openLightbox(url) {
  document.getElementById("lightboxImg").src = url;
  document.getElementById("lightbox").classList.add("active");
}

document.getElementById("lightbox").onclick = () => {
  document.getElementById("lightbox").classList.remove("active");
};

fetchAds();