const { chromium } = require('playwright');

(async () => {
  // 启动浏览器
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 导航到监控页面
    await page.goto('http://localhost:3000');

    // 等待页面加载
    await page.waitForSelector('h1');

    // 截图
    await page.screenshot({ path: 'screenshot.png', fullPage: true });

    console.log('截图成功，已保存为 screenshot.png');
  } catch (error) {
    console.error('截图失败:', error);
  } finally {
    // 关闭浏览器
    await browser.close();
  }
})();
