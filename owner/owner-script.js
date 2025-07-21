// owner/owner-script.js
// تسجيل Service Worker الخاص بواجهة المعلن
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // يجب أن يكون نطاق Service Worker مساويًا أو أوسع من المسار الذي يتواجد فيه ملف manifest.json
        // "/owner/sw.js" هو المسار لملف Service Worker نفسه
        // { scope: '/owner/' } يحدد أن هذا Service Worker يتحكم في كل المسارات تحت /owner/
        navigator.serviceWorker.register('/owner/sw.js', { scope: '/owner/' })
            .then(registration => {
                console.log('Owner Service Worker registered with scope:', registration.scope);
            })
            .catch(error => {
                console.error('Owner Service Worker registration failed:', error);
            });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // هنا سيتم إضافة الكود الخاص بتفاعل صفحة التسجيل مع Google Apps Script لاحقًا
    // على سبيل المثال: معالجة إرسال نموذج التسجيل
    const registrationForm = document.getElementById('registration-form');
    if (registrationForm) {
        registrationForm.addEventListener('submit', (event) => {
            event.preventDefault(); // منع الإرسال الافتراضي للنموذج
            
            const shopName = document.getElementById('shop-name').value;
            const ownerEmail = document.getElementById('owner-email').value;
            const phoneNumber = document.getElementById('phone-number').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            // هنا يمكنك إضافة التحققات الأولية (مثل تطابق كلمات المرور)
            if (password !== confirmPassword) {
                alert('كلمة المرور وتأكيد كلمة المرور غير متطابقين!');
                return;
            }

            console.log('Registration data:', { shopName, ownerEmail, phoneNumber, password });
            
            // في الخطوات القادمة، سنقوم بإرسال هذه البيانات إلى Google Apps Script
            // alert('تم استلام بيانات التسجيل. سيتم معالجتها قريباً.');
        });
    }
});
