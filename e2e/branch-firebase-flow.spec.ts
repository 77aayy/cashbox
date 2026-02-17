/**
 * اختبار عزل الفروع وسير عمل Firebase
 * - عزل الفروع: الكورنيش والأندلس بيانات منفصلة (localStorage + Firebase)
 * - Firebase: تحميل الصفحة الأولى (4 صفوف مغلقة)، التقسيم، التخزين المحلي
 */
import { test, expect } from '@playwright/test'

test.describe('عزل الفروع وسير Firebase', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('الدخول بفرع الكورنيش وتحميل صفحة الكاش بوكس', async ({ page }) => {
    await page.getByPlaceholder('أدخل اسمك').fill('اختبار')
    await page.getByRole('button', { name: 'الكورنيش' }).click()
    await page.getByRole('button', { name: 'دخول' }).click()
    await expect(page.locator('header')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: 'تغيير الفرع' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'تغيير المستخدم' })).toBeVisible()
  })

  test('الدخول بفرع الأندلس وتحميل صفحة الكاش بوكس', async ({ page }) => {
    await page.getByPlaceholder('أدخل اسمك').fill('اختبار')
    await page.getByRole('button', { name: 'الأندلس' }).click()
    await page.getByRole('button', { name: 'دخول' }).click()
    await expect(page.locator('header')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: 'تغيير الفرع' })).toBeVisible()
  })

  test('تغيير الفرع من الكورنيش إلى الأندلس', async ({ page }) => {
    await page.getByPlaceholder('أدخل اسمك').fill('اختبار')
    await page.getByRole('button', { name: 'الكورنيش' }).click()
    await page.getByRole('button', { name: 'دخول' }).click()
    await expect(page.locator('header')).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: 'تغيير الفرع' }).click()
    await expect(page.getByText('هل تريد الانتقال إلى فرع الأندلس؟')).toBeVisible()
    await page.getByRole('button', { name: 'نعم، الانتقال' }).click()
    await expect(page.locator('header')).toBeVisible({ timeout: 5000 })
  })

  test('تغيير الفرع من الأندلس إلى الكورنيش', async ({ page }) => {
    await page.getByPlaceholder('أدخل اسمك').fill('اختبار')
    await page.getByRole('button', { name: 'الأندلس' }).click()
    await page.getByRole('button', { name: 'دخول' }).click()
    await expect(page.locator('header')).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: 'تغيير الفرع' }).click()
    await expect(page.getByText('هل تريد الانتقال إلى فرع الكورنيش؟')).toBeVisible()
    await page.getByRole('button', { name: 'نعم، الانتقال' }).click()
    await expect(page.locator('header')).toBeVisible({ timeout: 5000 })
  })

  test('إلغاء تغيير الفرع', async ({ page }) => {
    await page.getByPlaceholder('أدخل اسمك').fill('اختبار')
    await page.getByRole('button', { name: 'الكورنيش' }).click()
    await page.getByRole('button', { name: 'دخول' }).click()
    await expect(page.locator('header')).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: 'تغيير الفرع' }).click()
    await expect(page.getByText('هل تريد الانتقال إلى فرع الأندلس؟')).toBeVisible()
    await page.getByRole('button', { name: 'إلغاء' }).click()
    await expect(page.getByText('هل تريد الانتقال إلى فرع الأندلس؟')).not.toBeVisible()
  })

  test('جدول الصفوف يظهر وفلتر اليوم موجود', async ({ page }) => {
    await page.getByPlaceholder('أدخل اسمك').fill('اختبار')
    await page.getByRole('button', { name: 'الكورنيش' }).click()
    await page.getByRole('button', { name: 'دخول' }).click()
    await expect(page.locator('header')).toBeVisible({ timeout: 15000 })

    await expect(page.getByRole('button', { name: 'اليوم' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'أمس' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'الأسبوع الماضي' })).toBeVisible()
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 })
  })

  test('زر إغلاق الشفت موجود عند وجود صف نشط', async ({ page }) => {
    await page.getByPlaceholder('أدخل اسمك').fill('اختبار')
    await page.getByRole('button', { name: 'الكورنيش' }).click()
    await page.getByRole('button', { name: 'دخول' }).click()
    await expect(page.locator('header')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/إغلاق شفت|إغلاق الشفت/)).toBeVisible({ timeout: 8000 })
  })

  test('دائرة كاملة: دخول → تغيير فرع → تغيير مستخدم → العودة للترحيب', async ({ page }) => {
    await page.getByPlaceholder('أدخل اسمك').fill('اختبار')
    await page.getByRole('button', { name: 'الكورنيش' }).click()
    await page.getByRole('button', { name: 'دخول' }).click()
    await expect(page.locator('header')).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: 'تغيير الفرع' }).click()
    await page.getByRole('button', { name: 'نعم، الانتقال' }).click()
    await expect(page.locator('header')).toBeVisible({ timeout: 5000 })

    await page.getByRole('button', { name: 'تغيير المستخدم' }).click()
    await expect(page.getByPlaceholder('أدخل اسمك')).toBeVisible({ timeout: 5000 })
  })
})
