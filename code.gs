/* ========================= إعدادات عامة ========================= */
const SPREADSHEET_ID = '1xmsoewEa-cQ5NNWMW8LMOo24Kw-pBSksGgEz-dNOerU';
const MEDIA_FOLDER_ID = '103NWOBF-FLY5zSE3fRnG7F-JuTmgnYe9';
const IMGBB_API_KEY = 'c7538a6df45e079ee4faddaf2434735a';
const ADMIN_KEY = 'REPLACE_WITH_ADMIN_KEY';

const SHEET_NAMES = {
  places: 'الاماكن او الخدمات',
  ads: 'الاعلانات',
  cities: 'المدن',
  areas: 'المناطق',
  sites: 'المواقع او المولات',
  activities: 'نوع النشاط',
  packages: 'الباقات',
  visits: 'سجل الزيارات',
  paymentsMethods: 'طرق الدفع',
  paymentsRequests: 'طلبات الدفع'
};

function openSS() { return SpreadsheetApp.openById(SPREADSHEET_ID); }
function jsonSuccess(data) { return ContentService.createTextOutput(JSON.stringify({ success: true, data: data })).setMimeType(ContentService.MimeType.JSON); }
function jsonError(msg) { return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(msg) })).setMimeType(ContentService.MimeType.JSON); }

/* ========================= GET ========================= */
function doGet(e) {
  // ضمان وجود عمود حالة الباقة وملء الفارغ
  try { ensurePackageStatusColumn(); } catch (err) { Logger.log('ensurePackageStatusColumn (GET): ' + err); }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logSheet = ss.getSheetByName("سجل الزيارات");
  var placesSheet = ss.getSheetByName("الاماكن او الخدمات");
  var adsSheet = ss.getSheetByName("الاعلانات");

  var action = (e && e.parameter) ? e.parameter.action : undefined;
  var callback = (e && e.parameter) ? e.parameter.callback : undefined;
  var type = (e && e.parameter && e.parameter.type) ? (e.parameter.type || "").toLowerCase() : "";
  var id = (e && e.parameter) ? (e.parameter.id || "") : "";
  var source = (e && e.parameter && e.parameter.source) ? (e.parameter.source || "").toLowerCase() : "";

  var originalActions = {
    'getfilters': true,
    'getplaces': true,
    'getadsbyplaceid': true,
    'getplacebyid': true,
    'debugaddata': true
  };

  if (action) {
    var an = String(action).toLowerCase();

    if (originalActions[an]) {
      var output;
      if (an == "getfilters") output = getFilters();
      else if (an == "getplaces") output = getPlaces();
      else if (an == "getadsbyplaceid") output = getAdsByPlaceId(e.parameter.placeId);
      else if (an == "getplacebyid") output = getPlaceById(e.parameter.placeId);
      else if (an == "debugaddata") output = debugAdData(e.parameter.placeId);
      else output = JSON.stringify({ error: "Invalid action" });

      return callback ?
        ContentService.createTextOutput(callback + "(" + output + ")").setMimeType(ContentService.MimeType.JAVASCRIPT) :
        ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JSON);
    }

    try {
      var params = e.parameter || {};
      var a = String(params.action || '').toLowerCase();

      function sendJsonObj(obj) {
        var txt;
        try { txt = JSON.stringify(obj); } catch (je) { txt = String(obj); }
        if (callback && String(callback).trim() !== '') {
          return ContentService.createTextOutput(callback + "(" + txt + ")").setMimeType(ContentService.MimeType.JAVASCRIPT);
        } else {
          return ContentService.createTextOutput(txt).setMimeType(ContentService.MimeType.JSON);
        }
      }

      switch (a) {
        case 'ping':
          return sendJsonObj({ success: true, data: { pong: true, time: new Date().toISOString() } });
        case 'places':
          return sendJsonObj({ success: true, data: { places: getPlacesForSelect() } });
        case 'getlookups':
          return sendJsonObj({ success: true, data: getLookups() });
        case 'remainingads':
          return sendJsonObj({ success: true, data: getRemainingAds(params.placeId || '') });
        case 'ads':
          return sendJsonObj({ success: true, data: { ads: getAdsForPlace(params.placeId || '') } });
        case 'getpaymentsrequests':
          var providedKey = params.adminKey || params.adminkey || '';
          if (!providedKey || String(providedKey) !== ADMIN_KEY) return sendJsonObj({ success: false, error: 'unauthorized' });
          return sendJsonObj({ success: true, data: { payments: readSheetObjects(SHEET_NAMES.paymentsRequests) } });
        default:
          return sendJsonObj({ success: false, error: 'Unknown action (GET): ' + String(params.action || '') });
      }
    } catch (errAction) {
      if (callback && String(callback).trim() !== '') {
        return ContentService.createTextOutput(callback + "(" + JSON.stringify({ success: false, error: String(errAction) }) + ")").setMimeType(ContentService.MimeType.JAVASCRIPT);
      } else {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(errAction) })).setMimeType(ContentService.MimeType.JSON);
      }
    }
  }

  // توجيه مباشر place/ad
  if (type && id) {
    var redirectUrl = "";
    var name = "";

    if (type === "place") {
      var data = placesSheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === id) {
          name = data[i][1];
          redirectUrl = source === "whatsapp" ? data[i][9] :
                        source === "website" ? data[i][11] : data[i][7];
          try {
            logVisit('place', id, name, source, {
              referrer: e.parameter.referrer || '',
              userAgent: e.parameter.userAgent || '',
              device: e.parameter.device || '',
              notes: 'زيارة مباشرة - ' + source
            });
          } catch (lvErr) { Logger.log('logVisit(place) failed: ' + lvErr); }
          break;
        }
      }
    } else if (type === "ad") {
      var data = adsSheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === id) {
          name = data[i][3];
          redirectUrl = source === "image1" ? data[i][16] :
                        source === "image2" ? data[i][17] : data[i][24];
          try {
            logVisit('ad', id, name, source, {
              adId: id,
              referrer: e.parameter.referrer || '',
              userAgent: e.parameter.userAgent || '',
              device: e.parameter.device || '',
              notes: 'زيارة إعلان - ' + source
            });
          } catch (lvErr2) { Logger.log('logVisit(ad) failed: ' + lvErr2); }
          break;
        }
      }
    }

    if (redirectUrl) return HtmlService.createHtmlOutput("<script>window.location.href='" + redirectUrl + "';</script>");
    return ContentService.createTextOutput("Link not found");
  }

  return ContentService.createTextOutput("Missing parameters");
}

/* ========================= POST ========================= */
function doPost(e) {
  try {
    // ضمان وجود عمود حالة الباقة وملء الفارغ
    try { ensurePackageStatusColumn(); } catch (err0) { Logger.log('ensurePackageStatusColumn (POST): ' + err0); }

    let data = {};
    if (e.postData && e.postData.contents && e.postData.type && e.postData.type.indexOf('application/json') !== -1) {
      data = JSON.parse(e.postData.contents || '{}');
    } else if (e.parameter && Object.keys(e.parameter).length > 0) {
      data = {};
      for (const k in e.parameter) {
        data[k] = Array.isArray(e.parameter[k]) && e.parameter[k].length === 1 ? e.parameter[k][0] : e.parameter[k];
      }
    } else if (e.postData && e.postData.contents) {
      try { data = JSON.parse(e.postData.contents); } catch (e2) { data = {}; }
    }

    const action = (data.action || '').toString().trim();

    switch (action) {
      case 'getLookups': return jsonSuccess(getLookups());
      case 'registerPlace': return jsonSuccess(registerPlace(data));
      case 'updatePlace': return jsonSuccess(updatePlace(data));
      case 'loginPlace': return jsonSuccess(loginPlace(data));
      case 'choosePackage': return jsonSuccess(choosePackage(data));
      case 'confirmPayment': return jsonSuccess(confirmPayment(data));
      case 'uploadMedia':
      case 'uploadFile': return jsonSuccess(uploadMedia(data));
      case 'updatePaymentRequest': return jsonSuccess(updatePaymentRequest(data));
      case 'getDashboard': return jsonSuccess(getDashboard(data));
      case 'recordVisit': return jsonSuccess(recordVisit(data));
      case 'addAd': return jsonSuccess(addAd(data));
      case 'updateAd': return jsonSuccess(updateAd(data));
      case 'deleteAd': return jsonSuccess(deleteAd(data));
      default:
        return jsonError('Unknown action (POST): ' + action);
    }
  } catch (err) {
    return jsonError(String(err));
  }
}

/* ========================= أدوات شائعة ========================= */
function readSheetObjects(sheetName) {
  const ss = openSS();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return [];
  const values = sh.getDataRange().getValues();
  if (!values || values.length === 0) return [];
  const headers = values[0].map(String);
  const out = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const obj = { raw: {} };
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = row[c];
      obj.raw[headers[c]] = row[c];
    }
    out.push(obj);
  }
  return out;
}

function appendRowWithHeaders(sheetName, obj) {
  const ss = openSS();
  let sh = ss.getSheetByName(sheetName);
  if (!sh) sh = ss.insertSheet(sheetName);
  const lastRow = sh.getLastRow();
  if (lastRow === 0) {
    const headers = Object.keys(obj);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    const vals = headers.map(h => obj[h]);
    sh.appendRow(vals);
    return 2;
  } else {
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    const missing = [];
    for (const k of Object.keys(obj)) if (headers.indexOf(k) === -1) missing.push(k);
    if (missing.length > 0) {
      const newHeaders = headers.concat(missing);
      sh.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
      headers.push(...missing);
    }
    const row = headers.map(h => (obj.hasOwnProperty(h) ? obj[h] : ''));
    sh.appendRow(row);
    return sh.getLastRow();
  }
}

function setCellByHeader(sheetName, rowIndex, headerName, value) {
  const ss = openSS();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw 'Sheet not found: ' + sheetName;
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  let idx = headers.indexOf(headerName);
  if (idx === -1) {
    sh.getRange(1, headers.length + 1).setValue(headerName);
    idx = headers.length;
  }
  sh.getRange(rowIndex, idx + 1).setValue(value);
}

function findHeaderIndex(headers, names) {
  if (!headers || !Array.isArray(headers)) return -1;
  for (let n of names) {
    for (let i = 0; i < headers.length; i++) if (String(headers[i]).trim() === n) return i;
  }
  for (let n of names) {
    const lower = n.toLowerCase();
    for (let i = 0; i < headers.length; i++) if (String(headers[i]).toLowerCase().indexOf(lower) !== -1) return i;
  }
  return -1;
}

function formatDate(d) {
  return Utilities.formatDate(new Date(d), Session.getScriptTimeZone() || 'GMT+3', 'yyyy-MM-dd');
}

/* ========================= Lookups ========================= */
function getLookups() {
  const ss = openSS();
  const safeRead = (sheetName) => {
    try {
      const sh = ss.getSheetByName(sheetName);
      if (!sh) return { headers: [], rows: [] };
      const values = sh.getDataRange().getValues();
      if (!values || values.length === 0) return { headers: [], rows: [] };
      const headers = values[0].map(String);
      const rows = values.slice(1).map(r => {
        const obj = {};
        for (let i = 0; i < headers.length; i++) obj[headers[i]] = r[i];
        return obj;
      });
      return { headers, rows };
    } catch (e) {
      Logger.log('safeRead error for sheet ' + sheetName + ': ' + e);
      return { headers: [], rows: [] };
    }
  };

  const citiesData = safeRead(SHEET_NAMES.cities);
  const areasData = safeRead(SHEET_NAMES.areas);
  const sitesData = safeRead(SHEET_NAMES.sites);
  const activitiesData = safeRead(SHEET_NAMES.activities);
  const packagesData = safeRead(SHEET_NAMES.packages);
  const paymentsData = safeRead(SHEET_NAMES.paymentsMethods);

  const mapSimple = (rows, idKeyCandidates, nameKeyCandidates) => {
    if (!Array.isArray(rows)) return [];
    return rows.map(r => {
      let id = '';
      let name = '';
      for (const k of idKeyCandidates) if (r.hasOwnProperty(k) && r[k] !== '') { id = String(r[k]); break; }
      for (const k of nameKeyCandidates) if (r.hasOwnProperty(k) && r[k] !== '') { name = String(r[k]); break; }
      if (!id) {
        const keys = Object.keys(r);
        if (keys.length > 0) id = String(r[keys[0]] || '');
      }
      if (!name) {
        const keys = Object.keys(r);
        if (keys.length > 1) name = String(r[keys[1]] || '');
      }
      return { id: id, name: name, raw: r };
    });
  };

  const packages = [];
  try {
    (packagesData.rows || []).forEach(r => {
      const id = r['ID الباقة'] || r['id'] || r['ID'] || r['packageId'] || r['ID_الباقة'] || '';
      const name = r['اسم الباقة'] || r['اسم'] || r['name'] || '';
      const duration = Number(r['مدة الباقة باليوم'] || r['مدة'] || r['duration'] || 0) || 0;
      const price = Number(r['سعر الباقة'] || r['السعر'] || r['price'] || 0) || 0;
      const allowedAds = Number(r['عدد الاعلانات'] || r['عدد_الاعلانات'] || r['allowedAds'] || 0) || 0;
      packages.push({ id: String(id || ''), name: String(name || ''), duration: duration, price: price, allowedAds: allowedAds, raw: r });
    });
  } catch (e) {
    Logger.log('Error building packages array: ' + e);
  }

  return {
    cities: mapSimple(citiesData.rows, ['ID المدينة', 'id', 'ID'], ['اسم المدينة', 'name', 'اسم']),
    areas: mapSimple(areasData.rows, ['ID المنطقة', 'id', 'ID'], ['اسم المنطقة', 'name', 'اسم']),
    sites: mapSimple(sitesData.rows, ['ID الموقع او المول', 'id', 'ID'], ['اسم الموقع او المول', 'name', 'اسم']),
    activities: mapSimple(activitiesData.rows, ['ID النشاط', 'id', 'ID'], ['اسم النشاط', 'name', 'اسم']),
    packages: packages,
    paymentsMethods: mapSimple(paymentsData.rows, ['معرف الدفع', 'id', 'ID'], ['طرق الدفع', 'طريقة الدفع', 'name'])
  };
}

/* ========================= أماكن ========================= */
function getPlacesForSelect() {
  const ss = openSS();
  const sh = ss.getSheetByName(SHEET_NAMES.places);
  if (!sh) return [];
  const values = sh.getDataRange().getValues();
  if (!values || values.length <= 1) return [];
  const headers = values[0];
  const idCol = headers.indexOf('ID المكان');
  const nameCol = headers.indexOf('اسم المكان');
  const rows = values.slice(1);
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const id = idCol >= 0 ? r[idCol] : (i + 1).toString();
    const name = nameCol >= 0 ? r[nameCol] : ('مكان ' + (i + 1));
    out.push({ id: String(id), name: String(name), raw: rows[i] });
  }
  return out;
}

function ensurePackageStatusColumn() {
  const ss = openSS();
  const sh = ss.getSheetByName(SHEET_NAMES.places);
  if (!sh) return;
  const lastCol = Math.max(1, sh.getLastColumn());
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  let statusColIdx = headers.indexOf('حالة الباقة');

  if (statusColIdx === -1) {
    // أضف العمود واكتب القيمة الافتراضية
    sh.getRange(1, headers.length + 1).setValue('حالة الباقة');
    statusColIdx = headers.length; // صفرية الأساس
    if (sh.getLastRow() > 1) {
      sh.getRange(2, statusColIdx + 1, sh.getLastRow() - 1, 1).setValue('لا يوجد اشتراك');
    }
  } else {
    // املأ الفارغ فقط
    if (sh.getLastRow() > 1) {
      const rng = sh.getRange(2, statusColIdx + 1, sh.getLastRow() - 1, 1);
      const vals = rng.getValues();
      let toWrite = [];
      let changed = false;
      for (let i = 0; i < vals.length; i++) {
        const v = vals[i][0];
        if (v === '' || v === null) { toWrite.push(['لا يوجد اشتراك']); changed = true; }
        else toWrite.push([v]);
      }
      if (changed) rng.setValues(toWrite);
    }
  }
}

function registerPlace(data) {
  const ss = openSS();
  const sh = ss.getSheetByName(SHEET_NAMES.places);
  if (!sh) throw 'Sheet not found: ' + SHEET_NAMES.places;
  const all = sh.getDataRange().getValues();
  if (!all || all.length === 0) throw 'places sheet has no header';
  const headers = all[0];
  const idCol = headers.indexOf('ID المكان');
  if (idCol < 0) throw 'Missing header ID المكان';

  const lastRow = sh.getLastRow();
  let existing = [];
  if (lastRow > 1) existing = sh.getRange(2, idCol + 1, lastRow - 1, 1).getValues().flat();
  let maxId = 0;
  existing.forEach(v => { const n = Number(v); if (!isNaN(n) && n > maxId) maxId = n; });
  const newId = maxId + 1;

  const payload = {
    name: data.name || data.placeName || '',
    activityId: data.activityId || data.activityType || '',
    cityId: data.cityId || data.city || '',
    areaId: data.areaId || data.area || '',
    siteId: data.siteId || data.mall || data.location || '',
    address: data.address || data.detailedAddress || '',
    mapLink: data.mapLink || '',
    phone: data.phone || '',
    whatsapp: data.whatsapp || data.whatsappLink || '',
    email: data.email || '',
    website: data.website || '',
    hours: data.hours || data.workingHours || '',
    delivery: data.delivery || '',
    password: data.password || '',
    description: data.description || '',
    logoUrl: data.logoUrl || '',
    imgbbLogoUrl: data.imgbbLogoUrl || '',
    status: data.status || ''
  };

  const row = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    switch (h) {
      case 'ID المكان': row.push(newId); break;
      case 'اسم المكان': row.push(payload.name); break;
      case 'نوع النشاط / الفئة': row.push(payload.activityId); break;
      case 'المدينة': row.push(payload.cityId); break;
      case 'المنطقة': row.push(payload.areaId); break;
      case 'الموقع او المول': row.push(payload.siteId); break;
      case 'العنوان التفصيلي': row.push(payload.address); break;
      case 'رابط الموقع على الخريطة': row.push(payload.mapLink); break;
      case 'رقم التواصل': row.push(payload.phone); break;
      case 'رابط واتساب': row.push(payload.whatsapp); break;
      case 'البريد الإلكتروني': row.push(payload.email); break;
      case 'الموقع الالكتروني': row.push(payload.website); break;
      case 'ساعات العمل': row.push(payload.hours); break;
      case 'خدمات التوصيل': row.push(payload.delivery); break;
      case 'صورة شعار أو صورة المكان': row.push(payload.logoUrl); break;
      case 'رابط صورة شعار المكان': row.push(payload.imgbbLogoUrl); break;
      case 'عدد االزيارات الكليه': row.push(0); break;
      case 'عدد الزيارات اليومية': row.push(0); break;
      case 'وصف مختصر ': row.push(payload.description); break;
      case 'حالة التسجيل': row.push(payload.status || 'مفتوح'); break;
      case 'تاريخ بداية الاشتراك': row.push(''); break;
      case 'تاريخ نهاية الاشتراك': row.push(''); break;
      case 'الباقة': row.push(''); break;
      case 'حالة الباقة': row.push('لا يوجد اشتراك'); break;
      case 'كلمة المرور': row.push(payload.password); break;
      case 'حالة المكان': row.push(payload.status || 'مفتوح'); break;
      case 'حالة الباقة التجريبية': row.push(''); break;
      default: row.push('');
    }
  }

  sh.appendRow(row);

  // 🔥 تفعيل الباقة التجريبية تلقائياً
  try {
    const lookups = getLookups();
    const trialPkg = (lookups.packages || []).find(p => Number(p.price) === 0);
    if (trialPkg) {
      choosePackage({ placeId: newId, packageId: trialPkg.id });
    }
  } catch (e) {
    Logger.log("Auto trial package failed: " + e);
  }

  return { message: 'تم التسجيل', id: newId };
}

function updatePlace(data) {
  const ss = openSS();
  const sh = ss.getSheetByName(SHEET_NAMES.places);
  if (!sh) throw 'Sheet not found: ' + SHEET_NAMES.places;
  const headers = sh.getDataRange().getValues()[0].map(String);

  let rowNum = null;
  if (data.row) rowNum = Number(data.row);
  else if (data.placeId) {
    const values = sh.getDataRange().getValues();
    const idCol = headers.indexOf('ID المكان');
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][idCol]) === String(data.placeId)) { rowNum = i + 1; break; }
    }
  }
  if (!rowNum) throw 'Place not found to update';

  const map = {
    'اسم المكان': data.name || data.placeName || '',
    'نوع النشاط / الفئة': data.activityId || data.activity || data.activityType || '',
    'المدينة': data.cityId || data.city || '',
    'المنطقة': data.areaId || data.area || '',
    'الموقع او المول': data.siteId || data.mall || data.location || '',
    'العنوان التفصيلي': data.address || data.detailedAddress || '',
    'رابط الموقع على الخريطة': data.mapLink || '',
    'رقم التواصل': data.phone || '',
    'رابط واتساب': data.whatsapp || data.whatsappLink || '',
    'البريد الإلكتروني': data.email || '',
    'الموقع الالكتروني': data.website || '',
    'ساعات العمل': data.hours || data.workingHours || '',
    'خدمات التوصيل': data.delivery || '',
    'صورة شعار أو صورة المكان': data.logoUrl || '',
    'رابط صورة شعار المكان': data.imgbbLogoUrl || '',
    //|| data.logoUrl
    'وصف مختصر ': data.description || '',
   // 'حالة التسجيل': data.status || '',
    'حالة المكان': data.status || ''
  };

//   // إذا لم تُرسل باقة (أو أزلت الباقة)، اضبط حالة الباقة على "لا يوجد اشتراك"
//   const hasPackageId = !!(data.packageId || data.package);
//   if (!hasPackageId) {
//     map['حالة الباقة'] = 'لا يوجد اشتراك';
//   }

  // ❌ لا تغيّر حالة الباقة إطلاقاً إلا إذا فيه packageId جديد مبعوت
  if (data.packageId || data.package) {
    map['الباقة'] = data.packageId || data.package;
  }

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (map.hasOwnProperty(h)) {
      const val = map[h];
      if (val !== '' && val !== null && val !== undefined) {
        try { sh.getRange(rowNum, i + 1).setValue(val); } catch (e) {}
      }
    }
  }

  const updatedRow = sh.getRange(rowNum, 1, 1, headers.length).getValues()[0];
  const obj = {};
  for (let j = 0; j < headers.length; j++) obj[headers[j]] = updatedRow[j];
  obj._row = rowNum;
  return { message: 'تم التحديث', place: normalizePlaceObject(obj) };
}

function loginPlace(data) {
  const idOrPhone = String(data.phoneOrId || '').trim();
  const password = String(data.password || '');
  const ss = openSS();
  const sh = ss.getSheetByName(SHEET_NAMES.places);
  if (!sh) throw 'Sheet not found: ' + SHEET_NAMES.places;
  const values = sh.getDataRange().getValues();
  if (!values || values.length === 0) return { success: false, error: 'لا توجد بيانات' };
  const headers = values[0];
  const rows = values.slice(1);
  const idCol = headers.indexOf('ID المكان');
  const phoneCol = headers.indexOf('رقم التواصل');
  const pwCol = headers.indexOf('كلمة المرور');

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const idVal = String(r[idCol] || '');
    const phoneVal = String(r[phoneCol] || '');
    const pwVal = String(r[pwCol] || '');
    if ((idVal && idVal === idOrPhone) || (phoneVal && phoneVal === idOrPhone)) {
      if (pwVal === password) {
        const obj = {};
        for (let j = 0; j < headers.length; j++) obj[headers[j]] = r[j];
        obj._row = i + 2;
        return { message: 'تم الدخول', place: normalizePlaceObject(obj) };
      } else {
        return { success: false, error: 'كلمة المرور غير صحيحة' };
      }
    }
  }
  return { success: false, error: 'لم يتم العثور على المكان' };
}

function normalizePlaceObject(obj) {
  return {
    id: String(obj['ID المكان'] || ''),
    name: obj['اسم المكان'] || '',
    phone: obj['رقم التواصل'] || '',
    package: obj['الباقة'] || '',
    packageEnd: obj['تاريخ نهاية الاشتراك'] || '',
    logoDrive: obj['صورة شعار أو صورة المكان'] || '',
    logoImgBB: obj['رابط صورة شعار المكان'] || '',
    raw: obj
  };
}

/* ========================= باقات ومدفوعات ========================= */
function getPackageById(pkgId) {
  if (!pkgId) return null;
  const ss = openSS();
  const sh = ss.getSheetByName(SHEET_NAMES.packages);
  if (!sh) return null;
  const values = sh.getDataRange().getValues();
  if (!values || values.length === 0) return null;
  const headers = values[0];
  const idCol = headers.indexOf('ID الباقة');
  const adsCountCol = headers.indexOf('عدد الاعلانات');
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === pkgId) {
      return {
        id: String(values[i][idCol]),
        name: String(values[i][headers.indexOf('اسم الباقة')] || ''),
        duration: Number(values[i][headers.indexOf('مدة الباقة باليوم')] || 0),
        description: values[i][headers.indexOf('وصف الباقة')] || '',
        allowedAds: Number(values[i][adsCountCol] || 0),
        price: Number(values[i][headers.indexOf('سعر الباقة')] || values[i][headers.indexOf('السعر')] || 0) || 0,
        raw: values[i]
      };
    }
  }
  return null;
}

const PAYMENT_CANONICAL = {
  'receipturl': 'رابط إيصال الدفع',
  'receipt_url': 'رابط إيصال الدفع',
  'receipt': 'رابط إيصال الدفع',
  'رابط إيصال الدفع': 'رابط إيصال الدفع',
  'رابط': 'رابط إيصال الدفع',
  'link': 'رابط إيصال الدفع',
  'notes': 'ملاحظات',
  'note': 'ملاحظات',
  'ملاحظات': 'ملاحظات',
  'status': 'الحالة',
  'state': 'الحالة',
  'الحالة': 'الحالة',
  'معرف الطلب': 'معرف الطلب',
  'paymentid': 'معرف الطلب',
  'payment_id': 'معرف الطلب',
  'id المكان': 'ID المكان',
  'id الباقة': 'ID الباقة',
  'سعر الباقة': 'سعر الباقة',
  'price': 'سعر الباقة'
};

function canonicalHeaderName(raw) {
  if (!raw) return raw;
  const s = String(raw).trim();
  const key = s.replace(/\s+/g, ' ').toLowerCase();
  if (PAYMENT_CANONICAL.hasOwnProperty(key)) return PAYMENT_CANONICAL[key];
  const simple = key.replace(/[^a-z0-9\u0600-\u06FF]/g, '');
  if (PAYMENT_CANONICAL.hasOwnProperty(simple)) return PAYMENT_CANONICAL[simple];
  return s;
}

function ensurePlacesColumnExists(headerName) {
  const ss = openSS();
  const sh = ss.getSheetByName(SHEET_NAMES.places);
  if (!sh) throw 'Sheet not found: ' + SHEET_NAMES.places;
  const headers = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
  if (headers.indexOf(headerName) === -1) {
    sh.getRange(1, headers.length + 1).setValue(headerName);
  }
}

/* choosePackage: يمنع التجريبية مرتين ويضبط حالة الباقة */
function choosePackage(data) {
  const placeId = String(data.placeId || '');
  const pkgId = String(data.packageId || '');
  if (!placeId || !pkgId) throw 'placeId and packageId required';
  const pkg = getPackageById(pkgId);
  if (!pkg) throw 'Package not found';
  const price = Number(pkg.price || 0);
  const duration = Number(pkg.duration || 0);

  const ss = openSS();
  ensurePlacesColumnExists('حالة الباقة التجريبية');
  ensurePackageStatusColumn(); // تأكيد العمود وقيمته الافتراضية

  const shPlaces = ss.getSheetByName(SHEET_NAMES.places);
  if (!shPlaces) throw 'Sheet not found: ' + SHEET_NAMES.places;
  const placeValues = shPlaces.getDataRange().getValues();
  const placeHeaders = placeValues[0].map(String);
  const idCol = placeHeaders.indexOf('ID المكان');
  let placeRowIndex = -1;
  for (let i = 1; i < placeValues.length; i++) {
    if (String(placeValues[i][idCol]) === placeId) { placeRowIndex = i + 1; break; }
  }
  if (placeRowIndex === -1) throw 'Place not found';

  const trialCol = placeHeaders.indexOf('حالة الباقة التجريبية');
  const trialUsed = trialCol >= 0 ? String(shPlaces.getRange(placeRowIndex, trialCol + 1).getValue()).toLowerCase() === 'true' : false;

  if (price === 0) {
    // تجريبية
    if (trialUsed) {
      return { success: false, error: 'لا يمكن تفعيل الباقة التجريبية أكثر من مرة' };
    }
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + (duration || 0) * 24 * 3600 * 1000);
    setCellByHeader(SHEET_NAMES.places, placeRowIndex, 'تاريخ بداية الاشتراك', formatDate(startDate));
    setCellByHeader(SHEET_NAMES.places, placeRowIndex, 'تاريخ نهاية الاشتراك', formatDate(endDate));
    setCellByHeader(SHEET_NAMES.places, placeRowIndex, 'الباقة', pkgId);
    setCellByHeader(SHEET_NAMES.places, placeRowIndex, 'حالة الباقة', 'مفعلة');
    setCellByHeader(SHEET_NAMES.places, placeRowIndex, 'حالة الباقة التجريبية', 'true');
    return { success: true, pending: false, start: formatDate(startDate), end: formatDate(endDate), trialActivated: true };
  }

  // باقة مدفوعة -> إنشاء طلب دفع
  const paymentId = 'PAY' + (new Date()).getTime();
  const paymentObj = {
    'معرف الطلب': paymentId,
    'ID المكان': placeId,
    'ID الباقة': pkgId,
    'سعر الباقة': price,
    'العملة': 'ج.م',
    'الحالة': 'قيد الدفع',
    'تاريخ الإنشاء': formatDate(new Date()),
    'رابط إيصال الدفع': '',
    'ملاحظات': data.note || ''
  };
  appendRowWithHeaders(SHEET_NAMES.paymentsRequests, paymentObj);

  setCellByHeader(SHEET_NAMES.places, placeRowIndex, 'الباقة', pkgId);
  setCellByHeader(SHEET_NAMES.places, placeRowIndex, 'حالة الباقة', 'قيد الدفع');
  setCellByHeader(SHEET_NAMES.places, placeRowIndex, 'معرف طلب الدفع', paymentId);

  return { success: true, pending: true, paymentId: paymentId, amount: price, currency: 'ج.م' };
}

function updatePaymentRequest(data) {
  if (!data || !data.paymentId) throw 'paymentId required';
  let updates = data.updates || {};
  if (typeof updates === 'string') {
    try { updates = JSON.parse(updates); } catch (e) { updates = { 'ملاحظات': updates }; }
  }
  if (typeof updates !== 'object' || updates === null) updates = { 'ملاحظات': String(updates) };

  const ss = openSS();
  const shName = SHEET_NAMES.paymentsRequests;
  const sh = ss.getSheetByName(shName);
  if (!sh) throw 'Payments requests sheet not found';
  const values = sh.getDataRange().getValues();
  if (!values || values.length <= 1) throw 'No payment requests';
  let headers = values[0].map(String);

  const idCol = headers.indexOf('معرف الطلب');
  if (idCol === -1) throw 'Payments sheet missing "معرف الطلب" header';

  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === data.paymentId) { rowIndex = i + 1; break; }
  }
  if (rowIndex === -1) throw 'Payment request not found';

  const canonicalIndex = {};
  for (let i = 0; i < headers.length; i++) {
    const c = canonicalHeaderName(headers[i]);
    if (!canonicalIndex.hasOwnProperty(c)) canonicalIndex[c] = i;
  }

  for (const rawKey of Object.keys(updates)) {
    const canonical = canonicalHeaderName(rawKey);
    let colIdx = canonicalIndex[canonical];
    if (colIdx === undefined) {
      headers.push(canonical);
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      colIdx = headers.length - 1;
      canonicalIndex[canonical] = colIdx;
    }
    const val = updates[rawKey];
    sh.getRange(rowIndex, colIdx + 1).setValue(val);
  }

  return { success: true, message: 'payment request updated (canonicalized)' };
}

function confirmPayment(data) {
  const paymentId = String(data.paymentId || '');
  const adminKey = String(data.adminKey || '');
  if (!paymentId) throw 'paymentId required';
  if (!adminKey || adminKey !== ADMIN_KEY) throw 'unauthorized';

  const ss = openSS();
  const shPayments = ss.getSheetByName(SHEET_NAMES.paymentsRequests);
  if (!shPayments) throw 'Payments requests sheet not found: ' + SHEET_NAMES.paymentsRequests;
  const values = shPayments.getDataRange().getValues();
  if (!values || values.length <= 1) throw 'No payment requests';
  const headers = values[0].map(String);
  const idCol = headers.indexOf('معرف الطلب');
  if (idCol === -1) throw 'Payments sheet missing "معرف الطلب" header';

  let rowIndex = -1;
  let paymentRow = null;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === paymentId) { rowIndex = i + 1; paymentRow = values[i]; break; }
  }
  if (rowIndex === -1) throw 'Payment request not found';

  const statusCol = headers.indexOf('الحالة');
  const paidAtCol = headers.indexOf('تاريخ الدفع');
  if (statusCol >= 0 && String(paymentRow[statusCol]).toLowerCase().indexOf('مدفوع') !== -1) {
    return { success: true, message: 'already_paid' };
  }

  if (statusCol >= 0) shPayments.getRange(rowIndex, statusCol + 1).setValue('مدفوع');
  if (paidAtCol >= 0) shPayments.getRange(rowIndex, paidAtCol + 1).setValue(formatDate(new Date()));
  else setCellByHeader(SHEET_NAMES.paymentsRequests, rowIndex, 'تاريخ الدفع', formatDate(new Date()));

  const placeId = String(paymentRow[findHeaderIndex(headers, ['ID المكان'])] || '');
  const pkgId = String(paymentRow[findHeaderIndex(headers, ['ID الباقة'])] || '');
  if (!placeId || !pkgId) return { success: true, message: 'payment marked paid, missing placeId or pkgId' };

  const pkg = getPackageById(pkgId);
  const duration = pkg ? Number(pkg.duration || 0) : 0;

  const shPlaces = openSS().getSheetByName(SHEET_NAMES.places);
  if (!shPlaces) throw 'Sheet not found: ' + SHEET_NAMES.places;
  const placeValues = shPlaces.getDataRange().getValues();
  const placeHeaders = placeValues[0].map(String);
  const idColPlaces = placeHeaders.indexOf('ID المكان');
  let placeRowIndex = -1;
  for (let i = 1; i < placeValues.length; i++) {
    if (String(placeValues[i][idColPlaces]) === placeId) { placeRowIndex = i + 1; break; }
  }
  if (placeRowIndex === -1) throw 'Place not found when activating package';

  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + (duration || 0) * 24 * 3600 * 1000);

  setCellByHeader(SHEET_NAMES.places, placeRowIndex, 'تاريخ بداية الاشتراك', formatDate(startDate));
  setCellByHeader(SHEET_NAMES.places, placeRowIndex, 'تاريخ نهاية الاشتراك', formatDate(endDate));
  setCellByHeader(SHEET_NAMES.places, placeRowIndex, 'الباقة', pkgId);
  setCellByHeader(SHEET_NAMES.places, placeRowIndex, 'حالة الباقة', 'مفعلة');

  const pendingIdHeader = 'معرف طلب الدفع';
  const pendingColIndex = findHeaderIndex(placeHeaders, [pendingIdHeader]);
  if (pendingColIndex !== -1) {
    shPlaces.getRange(placeRowIndex, pendingColIndex + 1).setValue('');
  } else {
    try { setCellByHeader(SHEET_NAMES.places, placeRowIndex, pendingIdHeader, ''); } catch (e) {}
  }

  return { success: true, message: 'payment confirmed and package activated', placeId: placeId, start: formatDate(startDate), end: formatDate(endDate) };
}

/* ========================= رفع وسائط ========================= */
function getFileNameFromUrl(url) {
  if (!url) return '';
  try { return String(url).split('/').pop().split('?')[0]; } catch (e) { return String(url); }
}

function uploadToImgBB(base64Image, name) {
  if (!IMGBB_API_KEY || IMGBB_API_KEY.length < 8) throw 'IMGBB_API_KEY not configured';
  const url = 'https://api.imgbb.com/1/upload';
  const payload = 'key=' + encodeURIComponent(IMGBB_API_KEY)
                + '&image=' + encodeURIComponent(base64Image)
                + (name ? '&name=' + encodeURIComponent(name) : '');
  const options = {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: payload,
    muteHttpExceptions: true
  };
  const res = UrlFetchApp.fetch(url, options);
  const code = res.getResponseCode();
  const txt = res.getContentText();
  if (code < 200 || code >= 300) throw new Error('ImgBB upload failed: ' + code + ' - ' + txt);
  const json = JSON.parse(txt || '{}');
  if (json && json.success && json.data) {
    return String(json.data.display_url || json.data.url || '');
  }
  throw new Error('ImgBB upload invalid response: ' + txt);
}

function uploadMedia(data) {
  const placeId = String(data.placeId || '');
  const filename = data.fileName || ('upload_' + new Date().getTime());
  const mimeType = data.mimeType || 'application/octet-stream';
  const base64 = data.fileData || data.base64 || '';
  const imgbbFlag = (data.imgbb === true || data.imgbb === '1' || data.imgbb === 'true');

  if (!base64) throw 'No base64 data';

  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, filename);
  const folder = DriveApp.getFolderById(MEDIA_FOLDER_ID);
  const file = folder.createFile(blob);
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  const driveUrl = file.getUrl();
  let imgbbUrl = '';

  if (imgbbFlag) {
    try {
      imgbbUrl = uploadToImgBB(base64, filename);
    } catch (e) {
      Logger.log('uploadMedia: imgbb upload failed: ' + e);
      imgbbUrl = '';
    }
  }

  if (placeId) {
    try {
      const ss = openSS();
      const sh = ss.getSheetByName(SHEET_NAMES.places);
      if (sh) {
        const values = sh.getDataRange().getValues();
        const headers = values[0].map(String);
        const idCol = headers.indexOf('ID المكان');
        const logoDriveCol = headers.indexOf('صورة شعار أو صورة المكان');
        const logoImgBBCol = headers.indexOf('رابط صورة شعار المكان');
        for (let i = 1; i < values.length; i++) {
          if (String(values[i][idCol]) === placeId) {
            if (logoDriveCol >= 0) sh.getRange(i + 1, logoDriveCol + 1).setValue(driveUrl);
            if (logoImgBBCol >= 0 && imgbbUrl) sh.getRange(i + 1, logoImgBBCol + 1).setValue(imgbbUrl);
            break;
          }
        }
      }
    } catch (e) { Logger.log('uploadMedia: failed to write logo link: ' + e); }
  }

  return { message: 'uploaded', fileUrl: driveUrl, fileId: file.getId(), imgbbUrl: imgbbUrl || '', fileName: file.getName() || filename };
}

/* ========================= الإعلانات ========================= */
function getAdsForPlace(placeId) {
  try {
    if (!placeId) return [];
    const ss = openSS();
    const sh = ss.getSheetByName(SHEET_NAMES.ads) || ss.getSheetByName('الاعلانات');
    if (!sh) return [];
    const values = sh.getDataRange().getValues();
    if (!values || values.length <= 1) return [];
    const headers = values[0].map(String);
    const idx = (names) => findHeaderIndex(headers, names);
    const idCol = idx(['ID الإعلان','IDالاعلان','id الاعلان','idالاعلان']);
    const placeCol = idx(['ID المكان','IDالمكان','id المكان','idالمكان','placeId','place_id']);
    const titleCol = idx(['العنوان','title']);
    const descCol = idx(['الوصف','description']);
    const startCol = idx(['تاريخ البداية','startDate','start_date']);
    const endCol = idx(['تاريخ النهاية','endDate','end_date']);
    const statusCol = idx(['حالة الاعلان','حالة الإعلان','الحالة']);

    const out = [];
    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      const rowPlace = String((placeCol >= 0 && row[placeCol] !== undefined) ? row[placeCol] : '');
      if (String(rowPlace) !== String(placeId)) continue;

      const ad = {
        id: String((idCol >= 0 && row[idCol] !== undefined) ? row[idCol] : (r + 1)),
        placeId: String(rowPlace),
        title: (titleCol >= 0 && row[titleCol] !== undefined) ? row[titleCol] : '',
        description: (descCol >= 0 && row[descCol] !== undefined) ? row[descCol] : '',
        startDate: (startCol >= 0 && row[startCol] !== undefined) ? row[startCol] : '',
        endDate: (endCol >= 0 && row[endCol] !== undefined) ? row[endCol] : '',
        status: (statusCol >= 0 && row[statusCol] !== undefined) ? row[statusCol] : '',
        images: []
      };

      for (let i = 1; i <= 8; i++) {
        const nameIdx = idx([`صورة ${i}`,`صورة${i}`]);
        const urlIdx = idx([`رابط صورة ${i}`,`رابطصورة ${i}`,`رابطصورة${i}`,`رابط صورة${i}`]);
        const nameVal = (nameIdx >= 0 && row[nameIdx] !== undefined) ? String(row[nameIdx]) : '';
        const urlVal = (urlIdx >= 0 && row[urlIdx] !== undefined) ? String(row[urlIdx]) : '';
        if (nameVal || urlVal) ad.images.push({ name: nameVal || '', url: urlVal || '' });
      }
      out.push(ad);
    }

    return out;
  } catch (e) {
    Logger.log('getAdsForPlace error: ' + e);
    return [];
  }
}

function addAd(data) {
  const placeId = String(data.placeId || '');
  if (!placeId) throw 'placeId required to add ad';
  const remainingInfo = getRemainingAds(placeId);
  if (remainingInfo.allowed <= 0) return { success: false, error: 'هذه الباقة لا تسمح بإضافة إعلانات' };
  if (remainingInfo.remaining <= 0) return { success: false, error: 'لقد استنفدت عدد الإعلانات المسموح بها في باقتك' };

  const ss = openSS();
  const sh = ss.getSheetByName(SHEET_NAMES.ads);
  if (!sh) throw 'Sheet not found: ' + SHEET_NAMES.ads;
  const headers = sh.getDataRange().getValues()[0].map(String);

  const idColForScan = findHeaderIndex(headers, ['ID الإعلان', 'IDالاعلان']);
  const vals = sh.getDataRange().getValues();
  const allIds = [];
  for (let i = 1; i < vals.length; i++) {
    const v = vals[i][idColForScan];
    const n = Number(v);
    if (!isNaN(n)) allIds.push(n);
  }
  const newId = (allIds.length === 0) ? 1 : (Math.max.apply(null, allIds) + 1);

  let imageNames = [];
  try {
    let arr = [];
    if (typeof data.imageFiles === 'string') arr = JSON.parse(data.imageFiles || '[]');
    else if (Array.isArray(data.imageFiles)) arr = data.imageFiles;
    imageNames = arr.slice(0, 8).map(v => {
      if (!v) return '';
      if (v.indexOf('http') === 0 || v.indexOf('/') !== -1) return getFileNameFromUrl(v);
      return v;
    });
  } catch (e) { imageNames = []; }

  const row = new Array(headers.length).fill('');
  const set = (headerCandidates, value) => {
    const idx = findHeaderIndex(headers, headerCandidates);
    if (idx >= 0) row[idx] = value;
  };

  set(['ID الإعلان','IDالاعلان'], newId);
  set(['ID المكان','IDالمكان'], placeId);
  set(['نوع الاعلان','نوع الإعلان'], data.adType || '');
  set(['العنوان'], data.adTitle || '');
  set(['الوصف'], data.adDescription || '');
  set(['تاريخ البداية'], data.startDate || '');
  set(['تاريخ النهاية'], data.endDate || '');
  set(['كوبون خصم'], data.coupon || '');
  for (let i = 1; i <= 8; i++) set([`صورة ${i}`,`صورة${i}`], imageNames[i-1] || '');
  set(['الفيديو'], data.videoFile || '');
  set(['رابط الفيديو'], data.videoUrl || '');
  set(['حالة الاعلان','الحالة'], data.adActiveStatus || '');

  sh.appendRow(row);
  return { message: 'ad saved', id: newId, imageNames: imageNames };
}

function updateAd(data) {
  const adId = String(data.adId || data.id || '');
  if (!adId) throw 'adId required';
  const ss = openSS();
  const sh = ss.getSheetByName(SHEET_NAMES.ads);
  if (!sh) throw 'Sheet not found: ' + SHEET_NAMES.ads;
  const values = sh.getDataRange().getValues();
  if (!values || values.length <= 1) throw 'No ads rows';
  const headers = values[0].map(String);
  const idCol = findHeaderIndex(headers, ['ID الإعلان', 'IDالاعلان']);
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(adId)) { rowIndex = i + 1; break; }
  }
  if (rowIndex === -1) throw 'Ad not found';

  const setCell = (headerCandidates, value) => {
    const idx = findHeaderIndex(headers, headerCandidates);
    if (idx >= 0) {
      try { sh.getRange(rowIndex, idx + 1).setValue(value); } catch (e) { Logger.log('setCell error: ' + e); }
    }
  };

  if (data.placeId) setCell(['ID المكان','IDالمكان'], data.placeId);
  if (data.adType) setCell(['نوع الاعلان','نوع الإعلان'], data.adType);
  if (data.adTitle) setCell(['العنوان'], data.adTitle);
  if (data.adDescription) setCell(['الوصف'], data.adDescription);
  if (data.startDate) setCell(['تاريخ البداية'], data.startDate);
  if (data.endDate) setCell(['تاريخ النهاية'], data.endDate);
  if (data.coupon) setCell(['كوبون خصم'], data.coupon);

  try {
    let arr = [];
    if (typeof data.imageFiles === 'string') arr = JSON.parse(data.imageFiles || '[]');
    else if (Array.isArray(data.imageFiles)) arr = data.imageFiles;
    for (let i = 1; i <= 8; i++) {
      const v = arr[i-1] || '';
      if (v) setCell([`صورة ${i}`,`صورة${i}`], (v.indexOf('http') === 0 || v.indexOf('/') !== -1) ? getFileNameFromUrl(v) : v);
    }
  } catch (e) {}

  if (data.videoFile) setCell(['الفيديو'], data.videoFile);
  if (data.videoUrl) setCell(['رابط الفيديو'], data.videoUrl);
  if (data.adActiveStatus) setCell(['حالة الاعلان','الحالة'], data.adActiveStatus);

  const updatedRow = sh.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const obj = {};
  for (let j = 0; j < headers.length; j++) obj[headers[j]] = updatedRow[j];
  obj._row = rowIndex;
  return { message: 'ad updated', ad: obj };
}

function deleteAd(data) {
  const adId = String(data.adId || data.id || '');
  if (!adId) throw 'adId required';
  const ss = openSS();
  const sh = ss.getSheetByName(SHEET_NAMES.ads);
  if (!sh) throw 'Sheet not found: ' + SHEET_NAMES.ads;
  const values = sh.getDataRange().getValues();
  if (!values || values.length <= 1) throw 'No ads rows';
  const headers = values[0];
  const idCol = findHeaderIndex(headers, ['ID الإعلان', 'IDالاعلان']);
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(adId)) { rowIndex = i + 1; break; }
  }
  if (rowIndex === -1) throw 'Ad not found';
  sh.deleteRow(rowIndex);
  return { message: 'ad deleted', id: adId };
}

/* ========================= الحصة ولوحة القيادة ========================= */
function countActiveAdsForPlace(placeId) {
  if (!placeId) return 0;
  const ss = openSS();
  const sh = ss.getSheetByName(SHEET_NAMES.ads);
  if (!sh) return 0;
  const values = sh.getDataRange().getValues();
  if (!values || values.length <= 1) return 0;
  const headers = values[0];
  const placeCol = findHeaderIndex(headers, ['ID المكان', 'IDالمكان', 'id المكان']);
  const statusCol = findHeaderIndex(headers, ['حالة الاعلان', 'الحالة', 'حالة الاعلان']);
  let count = 0;
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const pid = String(row[placeCol] || '');
    if (pid === String(placeId)) {
      if (statusCol >= 0) {
        const s = String(row[statusCol] || '').toLowerCase();
        if (s === 'نشط' || s === 'active' || s === 'مفتوح') count++;
      } else count++;
    }
  }
  return count;
}

function getRemainingAds(placeId) {
  if (!placeId) return { packageId: '', allowed: 0, used: 0, remaining: 0 };
  const ss = openSS();
  const shPlaces = ss.getSheetByName(SHEET_NAMES.places);
  if (!shPlaces) throw 'Sheet not found: ' + SHEET_NAMES.places;
  const values = shPlaces.getDataRange().getValues();
  if (!values || values.length === 0) return { packageId: '', allowed: 0, used: 0, remaining: 0 };
  const headers = values[0];
  const idCol = headers.indexOf('ID المكان');
  const pkgCol = headers.indexOf('الباقة');
  let pkgId = '';
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(placeId)) { pkgId = String(values[i][pkgCol] || ''); break; }
  }
  const pkg = getPackageById(pkgId);
  const allowed = pkg ? Number(pkg.allowedAds || 0) : 0;
  const used = countActiveAdsForPlace(placeId);
  const remaining = Math.max(0, allowed - used);
  return { packageId: pkg ? pkg.id : '', allowed: allowed, used: used, remaining: remaining, packageName: pkg ? pkg.name : '' };
}

function getDashboard(data) {
  const placeId = String(data.placeId || '');
  const ss = openSS();
  const shPlaces = ss.getSheetByName(SHEET_NAMES.places);
  if (!shPlaces) throw 'Sheet not found: ' + SHEET_NAMES.places;
  const allVals = shPlaces.getDataRange().getValues();
  if (!allVals || allVals.length === 0) return { place: null, visits: [] };
  const headers = allVals[0];
  const rows = allVals.slice(1);
  let place = null;
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][headers.indexOf('ID المكان')]) === placeId) {
      const obj = {};
      for (let j = 0; j < headers.length; j++) obj[headers[j]] = rows[i][j];
      obj._row = i + 2;
      place = normalizePlaceObject(obj);
      break;
    }
  }

  const visits = [];
  const shVisits = ss.getSheetByName(SHEET_NAMES.visits);
  if (shVisits) {
    const vValues = shVisits.getDataRange().getValues();
    if (vValues && vValues.length > 1) {
      const vHeaders = vValues[0];
      for (let i = 1; i < vValues.length; i++) {
        const r = vValues[i];
        if (String(r[vHeaders.indexOf('ID المكان')]) === placeId || String(r[vHeaders.indexOf('ID الإعلان')]) === placeId) {
          const rec = {};
          for (let j = 0; j < vHeaders.length; j++) rec[vHeaders[j]] = r[j];
          visits.push(rec);
        }
      }
    }
  }

  return { place: place, visits: visits };
}

function recordVisit(data) {
  const ss = openSS();
  const sh = ss.getSheetByName(SHEET_NAMES.visits);
  if (!sh) throw 'Sheet not found: ' + SHEET_NAMES.visits;
  const headers = sh.getDataRange().getValues()[0];
  const row = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    switch (h) {
      case 'ID الإعلان': row.push(data.adId || ''); break;
      case 'ID المكان': row.push(data.placeId || ''); break;
      case 'نوع الزيارة': row.push(data.type || ''); break;
      case 'التاريخ': row.push(formatDate(new Date())); break;
      case 'IP': row.push(data.ip || ''); break;
      default: row.push('');
    }
  }
  sh.appendRow(row);
  return { message: 'visit recorded' };
}

/* ========================= تسجيل الزيارات ========================= */
/**
 * يسجل زيارة جديدة في جدول "سجل الزيارات" ويحدث عدادات الزيارة.
 * @param {string} type - نوع الزيارة ('place' أو 'ad')
 * @param {string} entityId - مُعرّف المكان أو الإعلان
 * @param {string} name - اسم المكان أو الإعلان
 * @param {string} source - مصدر الزيارة (مثلاً 'card_click' أو 'whatsapp')
 * @param {object} metadata - بيانات إضافية للزيارة
 */
function logVisit(type, entityId, name, source, metadata = {}) {
  const ss = openSS();
  const logSheet = ss.getSheetByName(SHEET_NAMES.visits);
  const placesSheet = ss.getSheetByName(SHEET_NAMES.places);

  if (!logSheet) {
    Logger.log('logVisit failed: "سجل الزيارات" sheet not found.');
    return;
  }
  if (!placesSheet) {
    Logger.log('logVisit failed: "الاماكن او الخدمات" sheet not found.');
    return;
  }

  // 1. تسجيل الزيارة في جدول "سجل الزيارات"
  const now = new Date();
  const visitRecord = {
    'التاريخ': now,
    'نوع الزيارة': type,
    'ID المكان': (type === 'place') ? entityId : '',
    'ID الإعلان': (type === 'ad') ? entityId : '',
    'اسم المكان / الإعلان': name,
    'المصدر': source,
    'ملاحظات': metadata.notes || '',
    'IP': '', // لا يمكن الحصول على IP من جانب السيرفر
  };
  appendRowWithHeaders(SHEET_NAMES.visits, visitRecord);
  Logger.log('Visit logged: ' + JSON.stringify(visitRecord));

  // 2. تحديث عدادات الزيارة في جدول "الاماكن او الخدمات"
  const placeIdToUpdate = (type === 'place') ? entityId : '';
  if (placeIdToUpdate) {
    const values = placesSheet.getDataRange().getValues();
    const headers = values[0].map(String);
    const idCol = headers.indexOf('ID المكان');
    const dailyCol = headers.indexOf('عدد الزيارات اليومية');
    const totalCol = headers.indexOf('عدد االزيارات الكليه');

    for (let i = 1; i < values.length; i++) {
      if (String(values[i][idCol]) === placeIdToUpdate) {
        const rowData = values[i];
        const currentRow = i + 1;

        const currentDaily = Number(rowData[dailyCol] || 0) || 0;
        const currentTotal = Number(rowData[totalCol] || 0) || 0;

        setCellByHeader(SHEET_NAMES.places, currentRow, 'عدد الزيارات اليومية', currentDaily + 1);
        setCellByHeader(SHEET_NAMES.places, currentRow, 'عدد االزيارات الكليه', currentTotal + 1);
        Logger.log(`Visits updated for placeId ${placeIdToUpdate}: Daily +1, Total +1`);
        break;
      }
    }
  }
}

/* ========================= فلاتر قديمة ومساعدة ========================= */
function getFilters() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("filters");
  if (cached) return cached;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var citiesSheet = ss.getSheetByName("المدن");
  var cities = [];
  if (citiesSheet && citiesSheet.getLastRow() > 1) {
    cities = citiesSheet
      .getRange(2, 1, citiesSheet.getLastRow() - 1, 2)
      .getValues()
      .map(function(r) { return { id: String(r[0]), name: String(r[1]) }; });
  }
  var areasSheet = ss.getSheetByName("المناطق");
  var areas = [];
  if (areasSheet && areasSheet.getLastRow() > 1) {
    areas = areasSheet
      .getRange(2, 1, areasSheet.getLastRow() - 1, 3)
      .getValues()
      .map(function(r) { return { id: String(r[0]), name: String(r[1]), cityId: String(r[2]) }; });
  }
  var activitySheet = ss.getSheetByName("نوع النشاط");
  var activities = [];
  if (activitySheet && activitySheet.getLastRow() > 1) {
    activities = activitySheet
      .getRange(2, 1, activitySheet.getLastRow() - 1, 2)
      .getValues()
      .map(function(r) { return { id: String(r[0]), name: String(r[1]) }; });
  }
  var result = JSON.stringify({ cities: cities, areas: areas, activities: activities });
  cache.put("filters", result, 60);
  return result;
}

function getPlaces() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("places");
  if (cached) return cached;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("الاماكن او الخدمات");
  var logSheet = ss.getSheetByName("سجل الزيارات");
  if (!sheet || sheet.getLastRow() < 2) return JSON.stringify([]);

  var raw = sheet.getRange(2, 1, sheet.getLastRow() - 1, 27).getValues();
  var data = raw.filter(function(r) {
    var id = String(r[0] || '').trim();
    var name = String(r[1] || '').trim();
    return id !== '' && name !== '';
  });

  function toMap(sheetName, idCol, nameCol) {
    var sh = ss.getSheetByName(sheetName);
    if (!sh || sh.getLastRow() < 2) return {};
    var vals = sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(idCol, nameCol)).getValues();
    var m = {};
    vals.forEach(function(r){
      var id = String(r[idCol - 1] || '').trim();
      var nm = String(r[nameCol - 1] || '').trim();
      if (id !== '' && nm !== '') m[id] = nm;
    });
    return m;
  }

  var activityMap = toMap("نوع النشاط", 1, 2);
  var cityMap     = toMap("المدن", 1, 2);
  var areaMap     = toMap("المناطق", 1, 2);

  var mallMap = {};
  var mallSheetsCandidates = ["المولات", "الموقع او المول", "المواقع او المولات", "المواقع"];
  for (var ms = 0; ms < mallSheetsCandidates.length; ms++) {
    var cand = mallSheetsCandidates[ms];
    var m = toMap(cand, 1, 2);
    if (Object.keys(m).length) { mallMap = m; break; }
  }

  function calculateVisits(placeId) {
    if (!logSheet || logSheet.getLastRow() < 2) return { daily: 0, total: 0 };
    var logs = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, logSheet.getLastColumn()).getValues();
    var daily = 0, total = 0;
    var todayStr = new Date().toDateString();

    logs.forEach(function(log) {
      var placeIdInLog = '';
      var logDate = null;

      if (log[0] && log[0] instanceof Date) {
        placeIdInLog = String(log[2] || '');
        logDate = log[0];
      } else if (log[1]) {
        placeIdInLog = String(log[1] || '');
        logDate = (log[3] instanceof Date) ? log[3] : (log[3] ? new Date(log[3]) : null);
      }

      if (placeIdInLog === String(placeId) && logDate) {
        total++;
        if (logDate.toDateString() === todayStr) daily++;
      }
    });

    return { daily: daily, total: total };
  }

  var places = data.map(function(r) {
    var placeId = String(r[0]);
    var activityId = String(r[2] || '').trim();
    var cityId     = String(r[3] || '').trim();
    var areaId     = String(r[4] || '').trim();
    var mallId     = String(r[5] || '').trim();
    var activityName = activityMap[activityId] || activityId;
    var cityName     = cityMap[cityId] || cityId;
    var areaName     = areaMap[areaId] || areaId;
    var mallName     = mallMap[mallId] || mallId;
    var visitsFromLog = calculateVisits(placeId);
    return {
      id: placeId,
      name: String(r[1] || ''),
      activity: activityName,
      city: cityName,
      area: areaName,
      mall: mallName,
      activityId: activityId,
      cityId: cityId,
      areaId: areaId,
      mallId: mallId,
      address: String(r[6] || ''),
      mapLink: String(r[7] || ''),
      phone: String(r[8] || ''),
      whatsapp: String(r[9] || ''),
      email: String(r[10] || ''),
      website: String(r[11] || ''),
      workHours: String(r[12] || ''),
      delivery: String(r[13] || ''),
      image: String(r[15] || ''),
      logoImage: String(r[14] || ''),
      description: String(r[18] || ''),
      dailyVisits: visitsFromLog.daily,
      totalVisits: visitsFromLog.total,
      registrationStatus: String(r[19] || ''),
      startDate: String(r[20] || ''),
      endDate: String(r[21] || ''),
      package: String(r[22] || ''),
      packageStatus: String(r[23] || ''),
      status: String(r[25] || ''),
      paymentRequestId: String(r[26] || '')
    };
  });

  var result = JSON.stringify(places);
  cache.put("places", result, 60);
  return result;
}

function debugAdData(placeId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("الاعلانات");
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 25).getValues();
  Logger.log('=== DEBUG: Ads for placeId ' + placeId + ' ===');
  var found = data.filter(r => String(r[1]) === String(placeId));
  Logger.log('Found ' + found.length + ' ads');
  found.forEach((ad, i) => {
    Logger.log('Ad#' + (i+1) + ' id=' + ad[0] + ' title=' + ad[3]);
  });
}

function getAdsByPlaceId(placeId) {
  var cache = CacheService.getScriptCache();
  var cacheKey = "ads_" + placeId;
  var cached = cache.get(cacheKey);
  if (cached) return cached;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("الاعلانات");
  if (!sheet || sheet.getLastRow() < 2) return JSON.stringify([]);

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h){ return String(h || '').trim(); });
  var raw = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  var data = raw.filter(function(r) {
    var adId = String(r[0] || '').trim();
    var pId = String(r[1] || '').trim();
    return adId !== '' && pId !== '' && String(pId) === String(placeId || '');
  });

  function normalizeDate(v) {
    if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    return v != null ? String(v) : '';
  }

  var imageCols = [];
  var videoCol = -1;
  for (var i = 0; i < headers.length; i++) {
    var h = headers[i];
    if (/^رابط\s*صورة\d*$/i.test(h)) imageCols.push(i);
    if (h === 'رابط الفيديو') videoCol = i;
  }

  var ads = data.map(function(r) {
    var images = [];
    imageCols.forEach(function(idx) { if (r[idx] && String(r[idx]).trim() !== '') images.push(String(r[idx])); });
    var videoUrl = videoCol !== -1 ? String(r[videoCol] || '') : '';
    return {
      id: String(r[0]),
      placeId: String(r[1]),
      type: String(r[2] || ''),
      title: String(r[3] || ''),
      description: String(r[4] || ''),
      startDate: normalizeDate(r[5]),
      endDate: normalizeDate(r[6]),
      coupon: String(r[7] || ''),
      images: images,
      video: videoUrl,
      status: String(r[r.length-1] || '')
    };
  });
  var result = JSON.stringify(ads);
  cache.put(cacheKey, result, 60);
  return result;
}

function getPlaceById(placeId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("الاماكن او الخدمات");
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 23).getValues();
  var place = data.find(r => String(r[0]) === String(placeId));
  if (!place) return JSON.stringify({ error: "Place not found" });

  var status = '';
  for (var i = 0; i < place.length; i++) {
    var value = String(place[i] || '').trim();
    if (value === 'مفتوح' || value === 'مغلق' || value === 'مغلق للصلاة') { status = value; break; }
  }
  return JSON.stringify({
    id: String(place[0]),
    name: String(place[1]),
    activity: String(place[2]),
    city: String(place[3]),
    area: String(place[4]),
    status: status,
    registrationStatus: String(place[19] || ''),
    packageStatus: String(place[22] || '')
  });
}
