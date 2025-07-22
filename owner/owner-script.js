// // owner/owner-script.js
// // تسجيل Service Worker الخاص بواجهة المعلن
// if ('serviceWorker' in navigator) {
//     window.addEventListener('load', () => {
//         // يجب أن يكون نطاق Service Worker مساويًا أو أوسع من المسار الذي يتواجد فيه ملف manifest.json
//         // "/owner/sw.js" هو المسار لملف Service Worker نفسه
//         // { scope: '/owner/' } يحدد أن هذا Service Worker يتحكم في كل المسارات تحت /owner/
//         navigator.serviceWorker.register('/E-mall/owner/sw.js', { scope: '/E-mall/owner/' })
//             .then(registration => {
//                 console.log('Owner Service Worker registered with scope:', registration.scope);
//             })
//             .catch(error => {
//                 console.error('Owner Service Worker registration failed:', error);
//             });
//     });
// }

// document.addEventListener('DOMContentLoaded', () => {
//     // هنا سيتم إضافة الكود الخاص بتفاعل صفحة التسجيل مع Google Apps Script لاحقًا
//     // على سبيل المثال: معالجة إرسال نموذج التسجيل
//     const registrationForm = document.getElementById('registration-form');
//     if (registrationForm) {
//         registrationForm.addEventListener('submit', (event) => {
//             event.preventDefault(); // منع الإرسال الافتراضي للنموذج
            
//             const shopName = document.getElementById('shop-name').value;
//             const ownerEmail = document.getElementById('owner-email').value;
//             const phoneNumber = document.getElementById('phone-number').value;
//             const password = document.getElementById('password').value;
//             const confirmPassword = document.getElementById('confirm-password').value;

//             // هنا يمكنك إضافة التحققات الأولية (مثل تطابق كلمات المرور)
//             if (password !== confirmPassword) {
//                 alert('كلمة المرور وتأكيد كلمة المرور غير متطابقين!');
//                 return;
//             }

//             console.log('Registration data:', { shopName, ownerEmail, phoneNumber, password });
            
//             // في الخطوات القادمة، سنقوم بإرسال هذه البيانات إلى Google Apps Script
//             // alert('تم استلام بيانات التسجيل. سيتم معالجتها قريباً.');
//         });
//     }
// });
// owner/owner-script.js
// تسجيل Service Worker الخاص بواجهة المعلن
// owner/owner-script.js
// تسجيل Service Worker الخاص بواجهة المعلن
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // تأكد من أن هذا المسار صحيح ويشمل اسم الريبوزيتوري إذا كان موجوداً
        // مثال: '/E-mall/owner/sw.js'
        navigator.serviceWorker.register('/E-mall/owner/sw.js', { scope: '/E-mall/owner/' }) 
            .then(registration => {
                console.log('Owner Service Worker registered with scope:', registration.scope);
            })
            .catch(error => {
                console.error('Owner Service Worker registration failed:', error);
            });
    });
}

// الرابط الذي حصلت عليه بعد نشر Google Apps Script كتطبيق ويب
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwascdO4cpZQ9Y5ZcdFOSu3pb-iDuw8KZbd393i1FKVOzA9umFBZ3CHM0x5OaAVmGk/exec'; // <--- استبدل هذا برابط تطبيق الويب الفعلي الخاص بك

document.addEventListener('DOMContentLoaded', () => {
    const registrationForm = document.getElementById('registration-form');
    const loginForm = document.getElementById('login-form');

    // معالجة نموذج التسجيل (في owner/register.html)
    if (registrationForm) {
        registrationForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // منع الإرسال الافتراضي للنموذج
            
            const shopName = document.getElementById('shop-name').value;
            const ownerEmail = document.getElementById('owner-email').value;
            const phoneNumber = document.getElementById('phone-number').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            // التحققات الأولية على جانب العميل
            if (password !== confirmPassword) {
                alert('كلمة المرور وتأكيد كلمة المرور غير متطابقين!');
                return;
            }
            if (password.length < 6) { // مثال: كلمة المرور لا تقل عن 6 أحرف
                alert('يجب أن تكون كلمة المرور 6 أحرف على الأقل.');
                return;
            }

            try {
                const response = await fetch(WEB_APP_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'register', // تحديد نوع العملية للسكريبت في Apps Script
                        shopName,
                        ownerEmail,
                        phoneNumber,
                        password
                    })
                });

                const data = await response.json();
                console.log('Apps Script response (register):', data);

                if (data.success) {
                    alert(data.message);
                    // بعد التسجيل الناجح، يمكن إعادة توجيه المستخدم لصفحة تسجيل الدخول
                    window.location.href = 'login.html'; 
                } else {
                    alert('فشل التسجيل: ' + data.message);
                }
            } catch (error) {
                console.error('Error communicating with Google Apps Script during registration:', error);
                alert('حدث خطأ غير متوقع أثناء التسجيل. الرجاء المحاولة لاحقًا.');
            }
        });
    }

    // معالجة نموذج تسجيل الدخول (في owner/login.html)
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // منع الإرسال الافتراضي للنموذج

            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            try {
                const response = await fetch(WEB_APP_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'login', // تحديد نوع العملية للسكريبت في Apps Script
                        email,
                        password
                    })
                });

                const data = await response.json();
                console.log('Apps Script response (login):', data);

                if (data.success) {
                    alert(data.message);
                    // حفظ بيانات المستخدم (معرف المستخدم، معرف المكان، الإيميل، الاسم) في Local Storage
                    // لاستخدامها لاحقًا في لوحة التحكم
                    localStorage.setItem('currentUserEmail', data.email);
                    localStorage.setItem('currentUserId', data.userId);
                    localStorage.setItem('currentPlaceId', data.placeId);
                    localStorage.setItem('currentUserName', data.name);
                    localStorage.setItem('currentUserPhoneNumber', data.phoneNumber); // حفظ رقم التليفون
                    
                    // هنا سيتم إعادة توجيه المستخدم إلى لوحة التحكم الخاصة به
                    window.location.href = 'dashboard.html'; // سنقوم بإنشاء هذه الصفحة لاحقًا
                } else {
                    alert('فشل تسجيل الدخول: ' + data.message);
                }
            } catch (error) {
                console.error('Error communicating with Google Apps Script during login:', error);
                alert('حدث خطأ غير متوقع أثناء تسجيل الدخول. الرجاء المحاولة لاحقًا.');
            }
        });
    }
});
