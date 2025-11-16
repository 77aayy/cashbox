/**
 * دالة مساعدة لفك تشفير التوكن (JWT)
 */
function decodeToken(token) {
  try {
    const payloadBase64 = token.split(".")[1];
    const payloadJson = atob(payloadBase64);
    return JSON.parse(payloadJson);
  } catch (e) {
    console.error("Failed to decode token:", e);
    return null;
  }
}

/**
 * دالة لإظهار رسالة تنبيه منبثقة (Toast)
 */
function showToast(message, type = "info", duration = 2000) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode === container) {
      container.removeChild(toast);
    }
  }, duration);
}


/**
 * دالة لإظهار نافذة تأكيد مخصصة
 */
function showConfirmModal(message, onConfirm) {
  const modal = document.getElementById("confirmModal");
  const messageEl = document.getElementById("confirmModalMessage");
  const cancelBtn = document.getElementById("confirmModalCancel");
  const okBtn = document.getElementById("confirmModalOk");

  if (!modal || !messageEl || !cancelBtn || !okBtn) return;

  messageEl.textContent = message;
  modal.style.display = "flex";

  const newOkBtn = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOkBtn, okBtn);
  
  const newCancelBtn = cancelBtn.cloneNode(true);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

  newOkBtn.addEventListener("click", () => {
    modal.style.display = "none";
    onConfirm(); 
  });

  newCancelBtn.addEventListener("click", () => {
    modal.style.display = "none";
  });
}

/**
 * (جديد) - دالة لإظهار نافذة معلومات (لعرض التقارير)
 * @param {string} title - عنوان النافذة
 * @param {string} htmlContent - محتوى HTML (مثل جدول)
 */
function showInfoModal(title, htmlContent) {
  const modal = document.getElementById("compareModal");
  const titleEl = document.getElementById("compareModalTitle");
  const bodyEl = document.getElementById("compareModalBody");
  const closeBtn = document.getElementById("compareModalClose");

  if (!modal || !titleEl || !bodyEl || !closeBtn) return;

  // 1. ملء المحتوى
  titleEl.textContent = title;
  bodyEl.innerHTML = htmlContent;

  // 2. إظهار النافذة
  modal.style.display = "flex";

  // 3. ربط زر الإغلاق
  // (نستخدم نفس تقنية cloneNode لضمان عدم تكرار المستمعين)
  const newCloseBtn = closeBtn.cloneNode(true);
  closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

  newCloseBtn.addEventListener("click", () => {
    modal.style.display = "none";
  });
}