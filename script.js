document.addEventListener('DOMContentLoaded', () => {
    // تأكد من أن هذا الرابط صحيح ويشير إلى نشرك لـ Google Apps Script
    const jsonUrl = 'https://script.google.com/macros/s/AKfycbxkKrHyeEAgSkLz2QHzSgA5w09dIvfFJgDUMkP373f-VVAZmahHalr0GOYojqK41x6E/exec';
    
    // العناصر الرئيسية في DOM
    const placesContainer = document.getElementById('places-container');
    const placeDetailsContainer = document.getElementById('place-details-container');
    const placeDetailName = document.getElementById('place-detail-name');
    const placeDetailInfo = document.getElementById('place-detail-info');
    const adsContainer = document.getElementById('ads-container');
    const backButton = document.getElementById('back-button');

    // عناصر الفلاتر
    const cityFilter = document.getElementById('city-filter');
    const areaFilter = document.getElementById('area-filter');
    const activityTypeFilter = document.getElementById('activity-type-filter');
    const resetFiltersButton = document.getElementById('reset-filters-button');

    let allData = null; // لتخزين جميع البيانات التي تم جلبها من Google Sheet
    let currentPlaceId = null; // لتتبع المكان المعروض حاليا في صفحة التفاصيل
    let refreshInterval; // لتخزين مؤشر setInterval

    // دالة للتحقق مما إذا كان الإعلان نشطًا (بناءً على حالة الاعلان فقط)
    function isAdCurrentlyActive(ad) {
        return ad['حالة الاعلان'] === 'نشط';
    }

    // دالة لجلب البيانات من Google Sheet
    async function fetchData() {
        console.log('Fetching data...');
        try {
            const response = await fetch(jsonUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('Fetched Data:', data);
            allData = data; // تحديث البيانات

            // إعادة ملء الفلاتر وعرض الأماكن بعد جلب البيانات الجديدة
            populateFilters();
            filterAndDisplayPlaces();

            // إذا كان المستخدم في صفحة تفاصيل مكان، قم بتحديث الإعلانات الخاصة به
            if (!placeDetailsContainer.classList.contains('hidden') && currentPlaceId) {
                displayAdsForPlace(currentPlaceId);
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
        allData.cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city['IDالمدينة'];
            option.textContent = city['المدينة'];
            cityFilter.appendChild(option);
        });
        cityFilter.value = currentCityValue; // استعادة القيمة المحفوظة


        // تحديث المناطق بناءً على المدينة المختارة حالياً
        updateAreaFilter();

        // أنواع الأنشطة
        const currentActivityValue = activityTypeFilter.value; // حفظ القيمة الحالية
        activityTypeFilter.innerHTML = '<option value="">كل الأنشطة</option>';
        allData.activityTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type['معرف نوع النشاط'];
            option.textContent = type['نوع النشاط'];
            activityTypeFilter.appendChild(option);
        });
        activityTypeFilter.value = currentActivityValue; // استعادة القيمة المحفوظة
    }

    // دالة لتحديث فلتر المناطق بناءً على المدينة المختارة
    function updateAreaFilter() {
        const selectedCityId = cityFilter.value;
        const currentAreaValue = areaFilter.value; // حفظ القيمة الحالية
        areaFilter.innerHTML = '<option value="">كل المناطق</option>';

        if (selectedCityId) {
            // استخدام == للمقارنة لأن IDالمدينة قد يكون رقمًا في البيانات لكن value يكون نصًا
            const relevantAreas = allData.areas.filter(area => area['IDالمدينة'] == selectedCityId);
            relevantAreas.forEach(area => {
                const option = document.createElement('option');
                option.value = area['IDالمنطقة'];
                option.textContent = area['المنطقة'];
                areaFilter.appendChild(option);
            });
            areaFilter.disabled = false;
        } else {
            areaFilter.disabled = true;
        }
        areaFilter.value = currentAreaValue; // استعادة القيمة المحفوظة
        // إذا كانت القيمة المحفوظة غير موجودة في الخيارات الجديدة، ستصبح القيمة فارغة
        if (areaFilter.value !== currentAreaValue && areaFilter.options.length > 0) {
            areaFilter.value = ''; // لضمان عدم وجود قيمة غير موجودة
        }
    }

    // دالة لتصفية وعرض الأماكن بناءً على الفلاتر المختارة
    function filterAndDisplayPlaces() {
        if (!allData) return; // تأكد أن البيانات قد تم جلبها

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
            filteredPlaces = filteredPlaces.filter(place => place['معرف نوع النشاط'] == selectedActivityTypeId);
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
            img.src = place['رابط صورة شعار المكان'] || 'https://via.placeholder.com/100?text=No+Logo'; // صورة افتراضية
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

            // عند النقر على البطاقة، اعرض تفاصيل المكان
            card.addEventListener('click', () => showPlaceDetails(place));
            placesContainer.appendChild(card);
        });
    }

    // دالة لعرض تفاصيل مكان محدد
    function showPlaceDetails(place) {
        // حفظ المكان الحالي لتحديث الإعلانات إذا حدث تحديث للبيانات
        currentPlaceId = place['معرف المكان'];

        placesContainer.classList.add('hidden');
        document.getElementById('filters-container').classList.add('hidden'); // إخفاء الفلاتر
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

    // دالة لعرض الإعلانات الخاصة بمكان معين
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
            if (ad['رابط يوتيوب']) {
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

            // حاوية لروابط الإعلان (واتساب، بريد إلكتروني)
            const adLinksContainer = document.createElement('div');
            adLinksContainer.className = 'ad-links';

            if (ad['رابط واتساب']) {
                const whatsappLink = document.createElement('a');
                whatsappLink.href = ad['رابط واتساب'];
                whatsappLink.target = '_blank';
                whatsappLink.innerHTML = '<i class="fab fa-whatsapp"></i> واتساب';
                whatsappLink.classList.add('whatsapp-link'); // إضافة كلاس لتلوين واتساب
                adLinksContainer.appendChild(whatsappLink);
            }
            if (ad['البريد الالكتروني']) {
                const emailLink = document.createElement('a');
                emailLink.href = `mailto:${ad['البريد الالكتروني']}`;
                emailLink.innerHTML = '<i class="fas fa-envelope"></i> بريد إلكتروني';
                emailLink.classList.add('email-link'); // إضافة كلاس لتلوين البريد
                adLinksContainer.appendChild(emailLink);
            }
            
            if (adLinksContainer.children.length > 0) {
                adCard.appendChild(adLinksContainer);
            }

            adsContainer.appendChild(adCard);
        });
    }

    // دوال مساعدة لجلب الأسماء من الـ IDs
    function getCityName(cityId) {
        const city = allData.cities.find(c => c['IDالمدينة'] == cityId);
        return city ? city['المدينة'] : 'غير معروفة';
    }

    function getAreaName(areaId) {
        const area = allData.areas.find(a => a['IDالمنطقة'] == areaId);
        return area ? area['المنطقة'] : 'غير معروفة';
    }

    function getPlaceLocationName(locationId) {
        const location = allData.locations.find(l => l['idالمكان'] == locationId);
        return location ? location['المكان'] : 'غير معروف';
    }

    // معالج حدث لزر "العودة إلى الأماكن"
    backButton.addEventListener('click', () => {
        currentPlaceId = null; // إعادة تعيين معرف المكان عند العودة
        placeDetailsContainer.classList.add('hidden');
        document.getElementById('filters-container').classList.remove('hidden'); // إظهار الفلاتر
        placesContainer.classList.remove('hidden');
        filterAndDisplayPlaces(); // إعادة عرض الأماكن مع تطبيق الفلاتر الحالية
    });

    // ======= معالجة أحداث الفلاتر =======
    cityFilter.addEventListener('change', () => {
        // لا نحتاج لحفظ القيمة في dataset.selectedValue بعد الآن، لأن populateFilters ستقوم باستعادتها
        // ولكن لا يزال تحديث فلتر المناطق وتطبيق الفلاتر مطلوبًا
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
