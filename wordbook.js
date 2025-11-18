// wordbook.js — 侧边栏设置脚本
document.addEventListener('DOMContentLoaded', () => {
  const waitInput = document.getElementById('waitTimeInput');
  const keyInput = document.getElementById('notionKeyInput');
  const dbInput = document.getElementById('notionDbInput');
  const saveBtn = document.getElementById('saveSettings');
  const statusSpan = document.getElementById('status');

  // 读取保存的设置
  chrome.storage.local.get(['waitTime', 'notionApiKey', 'notionDatabaseId'], (data) => {
    if (typeof data.waitTime === 'number') {
      waitInput.value = (data.waitTime / 1000).toString();
    }
    if (data.notionApiKey) {
      keyInput.value = data.notionApiKey;
    }
    if (data.notionDatabaseId) {
      dbInput.value = data.notionDatabaseId;
    }
  });

  // 保存设置并通知后台更新等待时间
  saveBtn.addEventListener('click', () => {
    const newWait = parseInt(waitInput.value, 10);
    const newApiKey = keyInput.value.trim();
    const newDbId = dbInput.value.trim();
    const updates = {};
    if (!isNaN(newWait) && newWait > 0) {
      updates.waitTime = newWait * 1000;
    }
    updates.notionApiKey = newApiKey;
    updates.notionDatabaseId = newDbId;

    chrome.storage.local.set(updates, () => {
      if (!isNaN(newWait) && newWait > 0) {
        // 通知后台更新等待时间
        chrome.runtime.sendMessage({ type: 'SET_WAIT_TIME', waitTime: newWait * 1000 });
      }
      // 显示提示消息
      statusSpan.textContent = '已保存';
      setTimeout(() => {
        statusSpan.textContent = '';
      }, 2000);
    });
  });
});
