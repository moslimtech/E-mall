document.addEventListener('DOMContentLoaded', () => {
    // تسجيل Service Worker لتمكين PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            // المسار الآن يشمل اسم المستودع لـ GitHub Pages Project
            navigator.serviceWorker.register('/e-mall/sw.js')
                .then((reg) => {
                    console.log('Service Worker registered!', reg);
                })
                .catch((err) => {
                    console.error('Service Worker registration failed:', err);
                });
        });
    }

    // تأكد من أن هذا الرابط صحيح ويشير إلى نشرك لـ Google Apps Script
    const jsonUrl = 'https://script.google.com/macros/s/AKfycbxkKrHyeEAgSkLz2QHzSgA5w09dIvfFJDUMkP373f-VVAZmahHalr0GOYojqK41x6E/exec'; // رابطك الصحيح

    // العناصر الرئيسية في DOM
    const placesContainer = document.getElementById('places-container');
    
    // عناصر الفلاتر
    const cityFilter = document.getElementById('city-filter');
    const areaFilter = document.getElementById('area-filter');
    const activityTypeFilter = document.getElementById('activity-type-filter');
    const resetFiltersButton = document.getElementById('reset-filters-button');

    // عناصر الـ Modal الجديدة
    const placeModal = document.getElementById('place-modal');
    const modalPlaceDetailName = document.getElementById('modal-place-detail-name');
    const modalPlaceDetailInfo = document.getElementById('modal-place-detail-info');
    const modalAdsContainer = document.getElementById('modal-ads-container');
    const closeButton = document.querySelector('.close-button');


    let allData = null; // لتخزين جميع البيانات التي تم جلبها من Google Sheet
    let currentPlaceId = null; // لتتبع المكان المعروض حاليا في صفحة التفاصيل (داخل المودال)
    let refreshInterval; // لتخزين مؤشر setInterval

    // دالة للتحقق مما إذا كان الإعلان نشطًا (بناءً على حالة الاعلان فقط)
    function isAdCurrentlyActive(ad) {
        // يمكنك إضافة منطق للتحقق من تاريخ بداية ونهاية الإعلان هنا إذا أردت
        return ad['حالة الاعلان'] === 'نشط';
    }

    // دالة لجلب البيانات من Google Sheet
    async function fetchData() {
        console.log('Fetching data...');
        try {
            const response = await fetch(jsonUrl);
            if (!response.ok) {
                // إذا لم يكن الاستجابة OK (مثل 404, 500)، ألقِ خطأ
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('Fetched Data:', data);
            allData = data; // تحديث البيانات

            // إعادة ملء الفلاتر وعرض الأماكن بعد جلب البيانات الجديدة
            populateFilters();
            filterAndDisplayPlaces();

            // إذا كان المستخدم في صفحة تفاصيل مكان (داخل المودال)، قم بتحديث الإعلانات الخاصة به
            if (placeModal.style.display === 'flex' && currentPlaceId) {
                displayAdsForPlaceInModal(currentPlaceId);
            }

        } catch (error) {
            console.error('حدث خطأ أثناء جلب البيانات:', error);
            placesContainer.innerHTML = '<p class="no-results">عذرًا، لم نتمكن من تحميل البيانات. يرجى المحاولة مرة أخرى لاحقًا.</p>';
            // إيقاف التحديث التلقائي إذا فشل الجلب لمنع طلبات غير ضرورية
            clearInterval(refreshInterval);
        }
    }

    // دالة لملء خيارات الفلاتر
    function populateFilters() {
        // المدن
        const currentCityValue = cityFilter.value; // حفظ القيمة الحالية
        cityFilter.innerHTML = '<option value="">كل المدن</option>';
        if (allData && allData.cities) { // تأكد من أن allData و allData.cities موجودان
            allData.cities.forEach(city => {
                const option = document.createElement('option');
                option.value = city['IDالمدينة'];
                option.textContent = city['المدينة'];
                cityFilter.appendChild(option);
            });
        }
        cityFilter.value = currentCityValue; // استعادة القيمة المحفوظة

        // تحديث المناطق بناءً على المدينة المختارة حالياً
        updateAreaFilter();

        // أنواع الأنشطة
        const currentActivityValue = activityTypeFilter.value; // حفظ القيمة الحالية
        activityTypeFilter.innerHTML = '<option value="">كل الأنشطة</option>';
        if (allData && allData.activityTypes) { // تأكد من أن allData و allData.activityTypes موجودان
            allData.activityTypes.forEach(type => {
                const option = document.createElement('option');
                option.value = type['معرف نوع النشاط'];
                option.textContent = type['اسم نوع النشاط']; // استخدام "اسم نوع النشاط" للعرض
                activityTypeFilter.appendChild(option);
            });
        }
        activityTypeFilter.value = currentActivityValue; // استعادة القيمة المحفوظة
    }

    // دالة لتحديث فلتر المناطق بناءً على المدينة المختارة
    function updateAreaFilter() {
        const selectedCityId = cityFilter.value;
        const currentAreaValue = areaFilter.value; // حفظ القيمة الحالية
        areaFilter.innerHTML = '<option value="">كل المناطق</option>';

        if (selectedCityId && allData && allData.areas) { // تأكد من أن allData و allData.areas موجودان
            const relevantAreas = allData.areas.filter(area => area['IDالمدينة'] == selectedCityId);
            if (relevantAreas && relevantAreas.length > 0) {
                relevantAreas.forEach(area => {
                    const option = document.createElement('option');
                    option.value = area['IDالمنطقة'];
                    option.textContent = area['المنطقة'];
                    areaFilter.appendChild(option);
                });
            }
            areaFilter.disabled = false;
        } else {
            areaFilter.disabled = true; // تعطيل فلتر المناطق إذا لم يتم اختيار مدينة
        }
        areaFilter.value = currentAreaValue; // استعادة القيمة المحفوظة
        // إذا كانت القيمة المحفوظة غير موجودة في الخيارات الجديدة، ستصبح القيمة فارغة
        if (areaFilter.value !== currentAreaValue && areaFilter.options.length > 0) {
            areaFilter.value = ''; // لضمان عدم وجود قيمة غير موجودة
        }
    }

    // دالة لتصفية وعرض الأماكن بناءً على الفلاتر المختارة
    function filterAndDisplayPlaces() {
        if (!allData || !allData.places) { // تأكد أن البيانات الأساسية موجودة
            placesContainer.innerHTML = '<p class="no-results">لا توجد بيانات أماكن لعرضها.</p>';
            return;
        }

        const selectedCityId = cityFilter.value;
        const selectedAreaId = areaFilter.value;
        const selectedActivityTypeId = activityTypeFilter.value;

        let filteredPlaces = allData.places;

        if (selectedCityId) {
            filteredPlaces = filteredPlaces.filter(place => place['المدينة'] == selectedCityId);
        }
        if (selectedAreaId) {
            filteredPlaces = filteredPlaces.filter(place => place['المنطقة'] == selectedAreaId);
        }
        if (selectedActivityTypeId) {
            filteredPlaces = filteredPlaces.filter(place => String(place['معرف نوع النشاط']).trim() == String(selectedActivityTypeId).trim()); // مقارنة مع trim
        }

        displayPlaces(filteredPlaces, allData.ads);
    }

    // دالة لتحديد فئة CSS بناءً على حالة المكان
    function getStatusClass(status) {
        switch (status) {
            case 'مفتوح الان':
                return 'status-open';
            case 'مغلق للصلاة':
                return 'status-prayer';
            case 'مغلق':
                return 'status-closed';
            default:
                return ''; // لا يوجد فئة إذا كانت الحالة غير معروفة
        }
    }

    // دالة للتحقق مما إذا كان المكان لديه إعلانات نشطة
    function hasAds(placeId, ads) {
        if (!ads) return false; // تأكد أن قائمة الإعلانات موجودة
        return ads.some(ad => ad['معرف المكان'] === placeId && isAdCurrentlyActive(ad));
    }

    // دالة لعرض بطاقات الأماكن
    function displayPlaces(places, ads) {
        placesContainer.innerHTML = ''; // مسح أي محتوى سابق

        if (places.length === 0) {
            placesContainer.innerHTML = '<p class="no-results">لا توجد أماكن مطابقة لمعايير البحث.</p>';
            return;
        }

        places.forEach(place => {
            const card = document.createElement('div');
            card.className = 'place-card';
            card.setAttribute('data-place-id', place['معرف المكان']);

            // مؤشر الحالة (مفتوح، مغلق، صلاة)
            const statusClass = getStatusClass(place['حالة المكان الان']);
            if (statusClass) {
                const statusIndicator = document.createElement('div');
                statusIndicator.className = `status-indicator ${statusClass}`;
                card.appendChild(statusIndicator);
            }

            // شارة "يوجد عروض"
            if (hasAds(place['معرف المكان'], ads)) {
                const adBadge = document.createElement('span');
                adBadge.className = 'ad-badge';
                adBadge.innerHTML = '<i class="fas fa-bullhorn"></i> عروض'; // أيقونة بوق + نص اختياري
                card.appendChild(adBadge);
            }

            // شعار المكان
            const img = document.createElement('img');
            img.className = 'logo';
            // استخدام رابط صورة الشعار، أو صورة افتراضية
            // **هام: تأكد أن روابط الصور تبدأ بـ http/https وليست روابط Googleusercontent الداخلية**
            img.src = place['رابط صورة شعار المكان'] && place['رابط صورة شعار المكان'].startsWith('http') ? place['رابط صورة شعار المكان'] : '/e-mall/images/placeholder.png'; // مسار صورة افتراضية
            img.alt = `شعار ${place['اسم المكان']}`;
            card.appendChild(img);

            // اسم المكان
            const name = document.createElement('h3');
            name.textContent = place['اسم المكان'];
            card.appendChild(name);

            // حالة المكان
            const status = document.createElement('p');
            status.textContent = `الحالة: ${place['حالة المكان الان']}`;
            card.appendChild(status);

            // عند النقر على البطاقة، اعرض تفاصيل المكان في الـ Modal
            card.addEventListener('click', () => showPlaceDetailsInModal(place));
            placesContainer.appendChild(card);
        });
    }

    // دالة جديدة لعرض تفاصيل المكان والإعلانات في Modal
    function showPlaceDetailsInModal(place) {
        currentPlaceId = place['معرف المكان'];

        // تعبئة محتوى الـ Modal
        modalPlaceDetailName.textContent = place['اسم المكان'];
        modalPlaceDetailInfo.innerHTML = `
            <p><strong>رقم التواصل:</strong> ${place['رقم التواصل'] || 'غير متوفر'}</p>
            <p><strong>البريد الإلكتروني:</strong> ${place['الإيميل'] || 'غير متوفر'}</p>
            <p><strong>المكان:</strong> ${getPlaceLocationName(place['المكان'])} - الدور: ${place['الدور'] || 'غير متوفر'}</p>
            <p><strong>المدينة:</strong> ${getCityName(place['المدينة'])}</p>
            <p><strong>المنطقة:</strong> ${getAreaName(place['المنطقة'])}</p>
            <p><strong>نوع النشاط:</strong> ${getActivityTypeName(place['معرف نوع النشاط']) || 'غير محدد'}</p>
            <p><strong>خدمة التوصيل:</strong> ${place['يوجد خدمة توصيل'] || 'غير محدد'}</p>
            ${place['رابط واتساب'] && place['رابط واتساب'].startsWith('http') ? `<p><a href="${place['رابط واتساب']}" target="_blank"><i class="fab fa-whatsapp"></i> تواصل عبر واتساب</a></p>` : ''}
            ${place['الموقع'] && place['الموقع'].split(',').length === 2 ? `<p><a href="https://maps.google.com/?q=${place['الموقع']}" target="_blank"><i class="fas fa-map-marked-alt"></i> عرض الموقع على الخريطة</a></p>` : ''}
        `;

        displayAdsForPlaceInModal(place['معرف المكان']);

        // إظهار الـ Modal
        placeModal.style.display = 'flex'; // استخدام flex لتوسيط المحتوى
        // إضافة كلاس لـ body لمنع التمرير في الخلفية
        document.body.classList.add('modal-open');
    }

    // دالة لعرض الإعلانات الخاصة بمكان معين (تغيير اسم العنصر المستهدف)
    function displayAdsForPlaceInModal(placeId) {
        modalAdsContainer.innerHTML = '<h3>الإعلانات والعروض</h3>'; // عنوان داخل المودال
        if (!allData || !allData.ads) {
            modalAdsContainer.innerHTML += '<p>لا توجد إعلانات نشطة لهذا المكان حاليًا.</p>';
            return;
        }

        const relevantAds = allData.ads.filter(ad => ad['معرف المكان'] === placeId && isAdCurrentlyActive(ad));

        console.log(`Displaying ads for Place ID: ${placeId}`);
        console.log(`Found ${relevantAds.length} active ads for this place.`);

        if (relevantAds.length === 0) {
            modalAdsContainer.innerHTML += '<p>لا توجد إعلانات نشطة لهذا المكان حاليًا.</p>';
            return;
        }

        relevantAds.forEach(ad => {
            const adCard = document.createElement('div');
            adCard.className = 'ad-card'; // سيعاد استخدام أنماط ad-card الموجودة

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

            if (ad['رابط الصورة'] && ad['رابط الصورة'].startsWith('http')) {
                const img = document.createElement('img');
                img.src = ad['رابط الصورة'];
                img.alt = `صورة الإعلان ${ad['عنوان العرض'] || ''}`;
                mediaContainer.appendChild(img);
            }
            if (ad['رابط الفيديو'] && ad['رابط الفيديو'].startsWith('http')) {
                const video = document.createElement('video');
                video.controls = true;
                video.src = ad['رابط الفيديو'];
                mediaContainer.appendChild(video);
            }
            if (ad['رابط يوتيوب'] && ad['رابط يوتيوب'].startsWith('http')) {
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

            for (let i = 2; i <= 8; i++) {
                const imgKey = `رابط صورة${i}`;
                if (ad[imgKey] && ad[imgKey].startsWith('http')) {
                    const img = document.createElement('img');
                    img.src = ad[imgKey];
                    img.alt = `صورة إعلان إضافية ${i}`;
                    mediaContainer.appendChild(img);
                }
            }

            if (mediaContainer.children.length > 0) {
                adCard.appendChild(mediaContainer);
            }

            const adLinksContainer = document.createElement('div');
            adLinksContainer.className = 'ad-links';

            if (ad['رابط واتساب'] && ad['رابط واتساب'].startsWith('http')) {
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

            if (adLinksContainer.children.length > 0) {
                adCard.appendChild(adLinksContainer);
            }

            modalAdsContainer.appendChild(adCard); // إضافة الإعلان إلى حاوية إعلانات المودال
        });
    }

    // دوال مساعدة لجلب الأسماء من الـ IDs
    function getCityName(cityId) {
        if (!allData || !allData.cities) return 'غير معروفة';
        const city = allData.cities.find(c => c['IDالمدينة'] == cityId);
        return city ? city['المدينة'] : 'غير معروفة';
    }

    function getAreaName(areaId) {
        if (!allData || !allData.areas) return 'غير معروفة';
        const area = allData.areas.find(a => a['IDالمنطقة'] == areaId);
        return area ? area['المنطقة'] : 'غير معروفة';
    }

    function getPlaceLocationName(locationId) {
        if (!allData || !allData.locations) return 'غير معروف';
        const location = allData.locations.find(l => l['idالمكان'] == locationId);
        return location ? location['المكان'] : 'غير معروف';
    }

    // الدالة الجديدة: لجلب اسم نوع النشاط
    function getActivityTypeName(activityTypeId) {
        if (!allData || !allData.activityTypes) return 'غير معروف';
        // استخدام toString().trim() لضمان المقارنة الصحيحة وإزالة المسافات الزائدة
        const activityType = allData.activityTypes.find(type =>
            type['معرف نوع النشاط'] && activityTypeId &&
            String(type['معرف نوع النشاط']).trim() == String(activityTypeId).trim()
        );
        return activityType ? activityType['اسم نوع النشاط'] : 'غير معروف'; // استخدام "اسم نوع النشاط" للعرض
    }

    // معالج حدث لزر إغلاق الـ Modal
    closeButton.addEventListener('click', () => {
        placeModal.style.display = 'none'; // إخفاء الـ Modal
        document.body.classList.remove('modal-open'); // إزالة كلاس منع التمرير
        currentPlaceId = null; // إعادة تعيين معرف المكان
    });

    // إغلاق الـ Modal عند النقر خارجها
    window.addEventListener('click', (event) => {
        if (event.target === placeModal) {
            placeModal.style.display = 'none';
            document.body.classList.remove('modal-open');
            currentPlaceId = null;
        }
    });

    // ======= معالجة أحداث الفلاتر =======
    cityFilter.addEventListener('change', () => {
        updateAreaFilter();
        filterAndDisplayPlaces();
    });

    areaFilter.addEventListener('change', () => {
        filterAndDisplayPlaces();
    });

    activityTypeFilter.addEventListener('change', () => {
        filterAndDisplayPlaces();
    });

    // معالج حدث لزر "إعادة تعيين" الفلاتر
    resetFiltersButton.addEventListener('click', () => {
        cityFilter.value = '';
        areaFilter.value = '';
        activityTypeFilter.value = '';
        updateAreaFilter(); // لإعادة تعطيل فلتر المناطق وتصفيره
        filterAndDisplayPlaces();
    });

    // ======= التحديث التلقائي للبيانات =======
    // جلب البيانات عند تحميل الصفحة لأول مرة
    fetchData();

    // تحديث البيانات كل 30 ثانية (30000 ميلي ثانية)
    // يتم حفظ المؤشر في `refreshInterval` لإمكانية إيقافه لاحقاً إذا لزم الأمر
    refreshInterval = setInterval(fetchData, 30000);
});
