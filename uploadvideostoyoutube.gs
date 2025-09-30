// ضع هنا ID المجلد اللي فيه الفيديوهات على Drive
var VIDEOS_FOLDER_ID = "103NWOBF-FLY5zSE3fRnG7F-JuTmgnYe9";


/**
 * الدالة الرئيسية:
 * بترفع الفيديوهات من جدول "الإعلانات" على YouTube
 * وتحط رابط embed في عمود "رابط الفيديو"
 */
function uploadAdsVideosToYouTube() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("الاعلانات");

  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  var colVideo = headers.indexOf("الفيديو");
  var colVideoLink = headers.indexOf("رابط الفيديو");

  if (colVideo === -1 || colVideoLink === -1) {
    throw new Error("تأكد إن الأعمدة (الفيديو, رابط الفيديو) موجودة بالاسم الصحيح");
  }

  // افتح المجلد اللي فيه الفيديوهات
  var folder = DriveApp.getFolderById(VIDEOS_FOLDER_ID);

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var fileInput = row[colVideo];      // قيمة عمود الفيديو
    var currentLink = row[colVideoLink];

    if (!fileInput || String(currentLink).indexOf("youtube.com") !== -1) continue;

    try {
      var fileId = null;

      // ✅ لو لينك Drive أو File ID
      var match = String(fileInput).match(/[-\w]{25,}/);
      if (match) {
        fileId = match[0];
      } else {
        // ✅ لو اسم ملف → دور جوه المجلد
        var files = folder.getFilesByName(fileInput);
        if (files.hasNext()) {
          fileId = files.next().getId();
        }
      }

      if (!fileId) {
        Logger.log("⚠️ لم يتم العثور على ملف صالح: " + fileInput + " (الصف " + (i + 1) + ")");
        continue;
      }

      // ارفع الفيديو
      var result = uploadYouTubeFromDrive(fileId, {
        title: row[headers.indexOf("العنوان")] || "إعلان بدون عنوان",
        description: row[headers.indexOf("الوصف")] || "",
        privacyStatus: "unlisted"
      });

      if (result && result.videoId) {
        // كون رابط embed
        var embedUrl = "https://www.youtube.com/embed/" + result.videoId;

        // اكتب الرابط في العمود
        sheet.getRange(i + 1, colVideoLink + 1).setValue(embedUrl);

        Logger.log("✅ تم رفع الفيديو (ID: " + result.videoId + ") للصف " + (i + 1));
      }

    } catch (err) {
      Logger.log("❌ خطأ في الصف " + (i + 1) + ": " + err.message);
    }
  }
}

/**
 * رفع فيديو إلى YouTube من Google Drive
 * @param {string} fileId - ID الفيديو في Google Drive
 * @param {object} options - خصائص الفيديو (title, description, privacyStatus)
 * @return {object} - يحتوي videoId و status
 */
function uploadYouTubeFromDrive(fileId, options) {
  var file = DriveApp.getFileById(fileId);
  
  var videoResource = {
    snippet: {
      title: options.title || file.getName(),
      description: options.description || "",
    },
    status: {
      privacyStatus: options.privacyStatus || "unlisted"
    }
  };

  var mediaData = file.getBlob();

  // ✅ الصيغة الصحيحة للـ insert
  var uploadResponse = YouTube.Videos.insert(
    videoResource,
    "snippet,status",
    mediaData
  );

  return {
    videoId: uploadResponse.id,
    status: uploadResponse.status.uploadStatus
  };
}

/**
 * إضافة زر في القائمة لتشغيل رفع الفيديوهات بسهولة
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("📺 إعلانات")
    .addItem("⬆️ رفع الفيديوهات إلى YouTube", "uploadAdsVideosToYouTube")
    .addToUi();
}
