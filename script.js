document.addEventListener('DOMContentLoaded', () => {
    const jsonUrl = 'https://script.google.com/macros/s/AKfycbxkKrHyeEAgSkLz2QHzSgA5w09dIvfFJgDUMkP373f-VVAZmahHalr0GOYojqK41x6E/exec';
    const placesContainer = document.getElementById('places-container');
    const placeDetailsContainer = document.getElementById('place-details-container');
    const placeDetailName = document.getElementById('place-detail-name');
    const placeDetailInfo = document.getElementById('place-detail-info');
    const adsContainer = document.getElementById('ads-container');
    const backButton = document.getElementById('back-button');

    let allData = null; // لتخزين البيانات التي تم جلبها مرة واحدة

    // دالة للتحقق مما إذا كان الإعلان نشطًا (بناءً على حالة الاعلان فقط)
    function isAdCurrentlyActive(ad) {
        const isActive = ad['حالة الاعلان'] === 'نشط';
        console.log(`Checking Ad ID: ${ad['معرف الإعلان']} - Status: "${ad['حالة الاعلان']}" - Is Active: ${isActive}`);
        return isActive;
    }

    async function fetchData() {
        try {
            const response = await fetch(jsonUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            allData = await response.json();
            console.log('Fetched Data:', allData); // لعرض جميع البيانات التي تم جلبها
            displayPlaces(allData.places, allData.ads);
        } catch (error) {
            console.error('حدث خطأ أثناء جلب البيانات:', error);
            placesContainer.innerHTML = '<p>عذرًا، لم نتمكن من تحميل البيانات. يرجى المحاولة مرة أخرى لاحقًا.</p>';
        }
    }

    function getStatusClass(status) {
        switch (status) {
            case 'مفتوح الان':
                return 'status-open';
            case 'مغلق للصلاة':
                return 'status-prayer';
            case 'مغلق':
                return 'status-closed';
            default:
                return '';
        }
    }

    // دالة hasAds لتشمل التحقق من الحالة فقط
    function hasAds(placeId, ads) {
        return ads.some(ad => ad['معرف المكان'] === placeId && isAdCurrentlyActive(ad));
    }

    function displayPlaces(places, ads) {
        placesContainer.innerHTML = ''; // مسح أي محتوى سابق

        places.forEach(place => {
            const card = document.createElement('div');
            card.className = 'place-card';
            card.setAttribute('data-place-id', place['معرف المكان']);

            const statusClass = getStatusClass(place['حالة المكان الان']);
            if (statusClass) {
                const statusIndicator = document.createElement('div');
                statusIndicator.className = `status-indicator ${statusClass}`;
                card.appendChild(statusIndicator);
            }

            if (hasAds(place['معرف المكان'], ads)) {
                const adBadge = document.createElement('span');
                adBadge.className = 'ad-badge';
                adBadge.innerHTML = '<i class="fas fa-bullhorn"></i> عروض'; // أيقونة بوق + نص اختياري
                card.appendChild(adBadge);
            }

            const img = document.createElement('img');
            img.className = 'logo';
            img.src = place['رابط صورة شعار المكان'] || 'https://via.placeholder.com/100?text=No+Logo'; // صورة افتراضية
            img.alt = `شعار ${place['اسم المكان']}`;
            card.appendChild(img);

            const name = document.createElement('h3');
            name.textContent = place['اسم المكان'];
            card.appendChild(name);

            const status = document.createElement('p');
            status.textContent = `الحالة: ${place['حالة المكان الان']}`;
            card.appendChild(status);

            card.addEventListener('click', () => showPlaceDetails(place));
            placesContainer.appendChild(card);
        });
    }

    function showPlaceDetails(place) {
        placesContainer.classList.add('hidden');
        placeDetailsContainer.classList.remove('hidden');

        placeDetailName.textContent = place['اسم المكان'];
        placeDetailInfo.innerHTML = `
            <p><strong>رقم التواصل:</strong> ${place['رقم التواصل'] || 'غير متوفر'}</p>
            <p><strong>البريد الإلكتروني:</strong> ${place['الإيميل'] || 'غير متوفر'}</p>
            <p><strong>المكان:</strong> ${getPlaceLocationName(place['المكان'])} - الدور: ${place['الدور'] || 'غير متوفر'}</p>
            <p><strong>المدينة:</strong> ${getCityName(place['المدينة'])}</p>
            <p><strong>المنطقة:</strong> ${getAreaName(place['المنطقة'])}</p>
            <p><strong>خدمة التوصيل:</strong> ${place['يوجد خدمة توصيل'] || 'غير محدد'}</p>
            ${place['رابط واتساب'] ? `<p><a href="${place['رابط واتساب']}" target="_blank"><i class="fab fa-whatsapp"></i> تواصل</a></p>` : ''}
            ${place['الموقع'] ? `<p><a href="https://www.google.com/maps/search/?api=1&query=${place['الموقع']}" target="_blank"><i class="fas fa-map-marked-alt"></i> الموقع</a></p>` : ''}
        `;

        displayAdsForPlace(place['معرف المكان']);
    }

    function displayAdsForPlace(placeId) {
        adsContainer.innerHTML = '';
        const relevantAds = allData.ads.filter(ad => ad['معرف المكان'] === placeId && isAdCurrentlyActive(ad));

        console.log(`Displaying ads for Place ID: ${placeId}`);
        console.log(`Found ${relevantAds.length} active ads for this place.`);

        if (relevantAds.length === 0) {
            adsContainer.innerHTML = '<p>لا توجد إعلانات نشطة لهذا المكان حاليًا.</p>';
            return;
        }

        relevantAds.forEach(ad => {
            const adCard = document.createElement('div');
            adCard.className = 'ad-card';

            const adTitle = document.createElement('h4');
            adTitle.textContent = ad['عنوان العرض'] || 'إعلان بدون عنوان';
            adCard.appendChild(adTitle);

            if (ad['وصف']) {
                const adDescription = document.createElement('p');
                adDescription.textContent = ad['وصف'];
                adCard.appendChild(adDescription);
            }

            const mediaContainer = document.createElement('div');
            mediaContainer.className = 'ad-media-container';

            // عرض الصور الرئيسية
            if (ad['رابط الصورة']) {
                const img = document.createElement('img');
                img.src = ad['رابط الصورة'];
                img.alt = `صورة الإعلان ${ad['عنوان العرض'] || ''}`;
                mediaContainer.appendChild(img);
            }
            // عرض الفيديو الرئيسي
            if (ad['رابط الفيديو']) {
                const video = document.createElement('video');
                video.controls = true;
                video.src = ad['رابط الفيديو'];
                mediaContainer.appendChild(video);
            }
            // عرض فيديو يوتيوب
            if (ad['رابط يوتيوب']) { // تأكد من اسم الحقل الصحيح في JSON
                const youtubeUrl = ad['رابط يوتيوب'];
                const videoIdMatch = youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
                if (videoIdMatch && videoIdMatch[1] && videoIdMatch[1] !== '0') {
                    const videoId = videoIdMatch[1];
                    const iframe = document.createElement('iframe');
                    iframe.width = "100%";
                    iframe.height = "315";
                    iframe.src = `https://www.youtube.com/embed/${videoId}`; // رابط يوتيوب القياسي للتضمين
                    iframe.frameBorder = "0";
                    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
                    iframe.allowFullscreen = true;
                    mediaContainer.appendChild(iframe);
                    console.log(`YouTube video embedded for Ad ID: ${ad['معرف الإعلان']} with Video ID: ${videoId}`);
                } else {
                    console.warn(`Invalid YouTube URL or Video ID for Ad ID: ${ad['معرف الإعلان']}: ${youtubeUrl}`);
                }
            }


            // إضافة صور إضافية إذا وجدت (صورة2 إلى صورة8)
            for (let i = 2; i <= 8; i++) {
                const imgKey = `رابط صورة${i}`;
                if (ad[imgKey]) {
                    const img = document.createElement('img');
                    img.src = ad[imgKey];
                    img.alt = `صورة إعلان إضافية ${i}`;
                    mediaContainer.appendChild(img);
                }
            }

            if (mediaContainer.children.length > 0) {
                adCard.appendChild(mediaContainer);
            }

            // حاوية للروابط (لتحسين التنسيق المتجاوب)
            const adLinksContainer = document.createElement('div');
            adLinksContainer.className = 'ad-links';

            // روابط إضافية (باستخدام الأيقونات)
            if (ad['رابط واتساب']) {
                const whatsappLink = document.createElement('a');
                whatsappLink.href = ad['رابط واتساب'];
                whatsappLink.target = '_blank';
                whatsappLink.innerHTML = '<i class="fab fa-whatsapp"></i> واتساب';
                whatsappLink.classList.add('whatsapp-link');
                adLinksContainer.appendChild(whatsappLink);
            }
            if (ad['البريد الالكتروني']) {
                const emailLink = document.createElement('a');
                emailLink.href = `mailto:${ad['البريد الالكتروني']}`;
                emailLink.innerHTML = '<i class="fas fa-envelope"></i> بريد إلكتروني';
                emailLink.classList.add('email-link');
                adLinksContainer.appendChild(emailLink);
            }
            
            // أضف حاوية الروابط إلى بطاقة الإعلان فقط إذا كان هناك روابط
            if (adLinksContainer.children.length > 0) {
                adCard.appendChild(adLinksContainer);
            }

            adsContainer.appendChild(adCard);
        });
    }

    function getCityName(cityId) {
        const city = allData.cities.find(c => c['IDالمدينة'] === cityId);
        return city ? city['المدينة'] : 'غير معروفة';
    }

    function getAreaName(areaId) {
        const area = allData.areas.find(a => a['IDالمنطقة'] === areaId);
        return area ? area['المنطقة'] : 'غير معروفة';
    }

    function getPlaceLocationName(locationId) {
        const location = allData.locations.find(l => l['idالمكان'] === locationId);
        return location ? location['المكان'] : 'غير معروف';
    }

    backButton.addEventListener('click', () => {
        placeDetailsContainer.classList.add('hidden');
        placesContainer.classList.remove('hidden');
    });

    // جلب البيانات عند تحميل الصفحة
    fetchData();
});
