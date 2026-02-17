import { test, expect } from '@playwright/test'

test('تبديل الوضع الداكن/الفاتح يعمل من صفحة الكاش بوكس', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('أدخل اسمك').fill('اختبار')
  await page.getByRole('button', { name: 'دخول' }).click()
  await expect(page.locator('header')).toBeVisible({ timeout: 10000 })

  const html = page.locator('html')
  const hadDark = await html.evaluate((el) => el.classList.contains('dark'))

  const toggle = page.getByRole('button', { name: /الوضع الداكن|الوضع الفاتح/ })
  await expect(toggle).toBeVisible()
  await toggle.click()
  await expect.poll(() => html.evaluate((el) => el.classList.contains('dark'))).toBe(!hadDark)

  await toggle.click()
  await expect.poll(() => html.evaluate((el) => el.classList.contains('dark'))).toBe(hadDark)
})
