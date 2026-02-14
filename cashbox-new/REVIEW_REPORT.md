# تقرير مراجعة المشروع — CashBox (حسب الرولز)

**تاريخ المراجعة:** 2025-02-15  
**المعيار:** Cursor Master Rules (Senior Engineer Mode — Physics & Security)

---

## 1. الأمان (Security First) — حرج

### 1.1 كود الأدمن مُصلّب (Hardcoded Secret)

| الموقع | المشكلة |
|--------|---------|
| `src/pages/CashBox.tsx` سطر 14 | `const ADMIN_CODE = 'ayman5255'` |

**الاستخدام:** يُقارَن به في ثلاث دوال:
- `submitDeleteCarriedWithCode` (حذف بند مرحّل)
- `submitDeleteWithCode` (حذف صف)
- `submitDeleteAllClosedWithCode` (حذف كل التقفيلات المغلقة)

**التقييم:** أي شخص يفتح الكود أو الـ bundle يرى الكود. لا يوجد `.env` أو متغيرات بيئة في المشروع.

**بدائل مقترحة (اختر واحدة أو اجمع):**

1. **متغير بيئة (أقل تكلفة):**
   - إضافة `.env` (ووضعه في `.gitignore`) وتفعيل `Vite` لقراءة `import.meta.env.VITE_ADMIN_CODE`.
   - في الكود: `const ADMIN_CODE = import.meta.env.VITE_ADMIN_CODE ?? ''`
   - تحذير: القيمة تبقى ظاهرة في الـ client bundle؛ مناسب فقط كطبقة إضافية وليس كحماية حقيقية.

2. **Backend/دالة آمنة:**
   - إرسال الكود المُدخل إلى API؛ التحقق يحدث في السيرفر فقط، ولا يُخزَّن الكود الصحيح في الفرونت.

3. **على الأقل عدم الـ commit:**
   - عدم رفع الكود الحقيقي إلى الريبو؛ استخدام placeholder في الكود وملء القيمة محلياً أو عبر CI/env.

---

## 2. TypeScript (Strict — No `any`)

| البند | الحالة |
|-------|--------|
| `tsconfig.app.json` | `strict: true`, `noUnusedLocals`, `noUnusedParameters` ✅ |
| استخدام `any` في `src/` | لم يُعثر على `: any` أو `as any` ✅ |

**الخلاصة:** المشروع ملتزم TypeScript صارم ولا يستخدم `any`.

---

## 3. useEffect — التنظيف (Cleanup)

| الملف | الـ Effect | التنظيف |
|-------|------------|---------|
| `App.tsx` | قراءة `sessionStorage` (مزامن) | لا يحتاج cleanup ✅ |
| `Toast.tsx` | `setTimeout` للإخفاء التلقائي | `return () => clearTimeout(t)` ✅ |
| `ClosureRow.tsx` | `setTimeout` لـ programBalancePulse و lockedPulseField | كلا الاثنين يعيدان `clearTimeout` ✅ |
| `CashBox.tsx` | تحميل الصفوف + debounce | `return () => { Object.values(debounceRef.current).forEach(clearTimeout); debounceRef.current = {} }` ✅ |
| `CashBox.tsx` | `setInterval` للوقت والعد التنازلي | `return () => clearInterval(t)` ✅ |
| `CashBox.tsx` | تعيين `expenseModalFocusedRowIdRef` عند إغلاق النافذة | effect مزامن، لا يحتاج cleanup ✅ |
| `CashBox.tsx` | `setTimeout` لـ pulseExpenseDescriptionIndex | `return () => clearTimeout(t)` ✅ |
| `Calculator.tsx` | `window.addEventListener('keydown', ...)` | `return () => window.removeEventListener(...)` ✅ |

**الخلاصة:** كل الـ timers والـ listeners لها cleanup صحيح؛ لا تسريب واضح.

---

## 4. الهندسة (Architecture)

| البند | الوضع الحالي |
|-------|----------------|
| **Data في services** | `lib/storage.ts` — قراءة/كتابة الصفوف، إضافة، إغلاق، حذف ✅ |
| **UI في components** | `Welcome`, `CashBox`, `ClosureRow`, `Calculator`, `CashCalculator`, `Toast` ✅ |
| **Logic** | معظم الـ logic (حالة، دوال، تأثيرات) داخل `CashBox.tsx` (ملف كبير جداً) |

**ملاحظة (تحسين اختياري):** الرول ينص على "Logic in hooks". يمكن لاحقاً استخراج hooks مثل:
- `useCashBoxRows(name)` — تحميل/تحديث الصفوف والـ debounce.
- `useClosingCountdown()` — حالة العد التنازلي والإغلاق.
- `useExpenseModal(rows)` — حالة نافذة المصروفات.

هذا يقلل حجم الصفحة ويحسّن إعادة الاستخدام، وليس خطأ في السلوك الحالي.

---

## 5. UI/UX حسب الرولز

| البند | الرول | الوضع في المشروع |
|-------|-------|-------------------|
| **لون البراند** | Turquoise `#14b8a6` / `text-primary-500` | لا يوجد تعريف `primary` في `tailwind.config.js`؛ الاستخدام السائد هو **amber** (أزرار، تركيز، حاسبة، إلخ). |
| **Glassmorphism** | `backdrop-blur-xl`, `border-white/20` | موجود في `Welcome` (`backdrop-blur-xl`, `border-white/10`) ✅؛ يمكن توحيد الحدود مع `border-white/20` إن رغبت. |
| **Responsive** | Mobile-first | لم تُراجع كل الشاشات؛ الهيكل العام يدعم التجاوب. |

**توصية:** إذا أردت توحيداً كاملاً مع الرول، أضف لون `primary` (مثلاً teal `#14b8a6`) في Tailwind واستخدمه للبراند/الـ highlights؛ أو أبقِ amber كخيار تصميم وثبّت ذلك في الرولز.

---

## 6. نقاط إضافية

### 6.1 تكرار إعداد Vite

- يوجد `vite.config.ts` و `vite.config.js` بمحتوى متطابق تقريباً.
- **التوصية:** الاعتماد على واحد فقط (مثلاً `vite.config.ts`) وحذف الآخر لتجنب الالتباس.

### 6.2 التخزين والتحقق من البيانات

- `storage.ts`: `load()` داخل `try/catch`؛ التحقق من أنواع الحقول بعد `JSON.parse` موجود ✅.
- لا توجد أسرار (API keys / tokens) أخرى في الكود المُراجع.

### 6.3 Linter

- تم تشغيل `read_lints` على `cashbox-new/src`: **لا أخطاء**.

---

## 7. ملخص أولويات الإجراء

| الأولوية | الإجراء |
|----------|---------|
| **حرج** | إزالة الـ hardcoded `ADMIN_CODE` واستبداله بمتغير بيئة أو تحقق من الـ backend. |
| **متوسط** | (اختياري) استخراج جزء من logic الـ CashBox إلى custom hooks. |
| **منخفض** | توحيد إعداد Vite (ملف واحد)، ومراجعة لون البراند (turquoise vs amber) حسب قرارك النهائي. |

---

*المراجعة تمت وفق "الدقة أهم من السرعة" وفحص الرولز المذكورة أعلاه.*
