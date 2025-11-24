// wordbook.js — 侧边栏设置脚本
document.addEventListener('DOMContentLoaded', () => {
  const waitInput = document.getElementById('waitTimeInput');
  const keyInput = document.getElementById('notionKeyInput');
  const dbInput = document.getElementById('notionDbInput');
  const uploadWithoutDefInput = document.getElementById('uploadWithoutDefinition');
  const saveBtn = document.getElementById('saveSettings');
  const statusSpan = document.getElementById('status');

  // 读取保存的设置
  chrome.storage.local.get(
    ['waitTime', 'notionApiKey', 'notionDatabaseId', 'uploadWithoutDefinition'],
    (data) => {
      if (typeof data.waitTime === 'number') {
        waitInput.value = (data.waitTime / 1000).toString();
      }
      if (data.notionApiKey) {
        keyInput.value = data.notionApiKey;
      }
      if (data.notionDatabaseId) {
        dbInput.value = data.notionDatabaseId;
      }
      if (typeof data.uploadWithoutDefinition === 'boolean') {
        uploadWithoutDefInput.checked = data.uploadWithoutDefinition;
      } else {
        // 默认：勾选（上传无释义单词）
        uploadWithoutDefInput.checked = true;
      }
    }
  );

  // 保存设置并通知后台更新等待时间 / Notion 配置 / 上传选项
  saveBtn.addEventListener('click', () => {
    const newWait = parseInt(waitInput.value, 10);
    const newApiKey = keyInput.value.trim();
    const newDbId = dbInput.value.trim();
    const uploadWithoutDefinition = uploadWithoutDefInput.checked;

    const updates = {};
    if (!isNaN(newWait) && newWait > 0) {
      updates.waitTime = newWait * 1000;
    }
    updates.notionApiKey = newApiKey;
    updates.notionDatabaseId = newDbId;
    updates.uploadWithoutDefinition = uploadWithoutDefinition;

    chrome.storage.local.set(updates, () => {
      if (!isNaN(newWait) && newWait > 0) {
        // 通知后台更新等待时间
        chrome.runtime.sendMessage({ type: 'SET_WAIT_TIME', waitTime: newWait * 1000 });
      }
      // 通知后台更新notion密钥
      chrome.runtime.sendMessage({
        type: "SET_NOTION_CONFIG",
        apiKey: newApiKey,
        dbId: newDbId
      });
      // 通知后台更新“是否上传无释义单词”选项
      chrome.runtime.sendMessage({
        type: "SET_UPLOAD_OPTION",
        uploadWithoutDefinition
      });

      // 显示提示消息
      statusSpan.textContent = '已保存';
      setTimeout(() => {
        statusSpan.textContent = '';
      }, 2000);
    });
  });
});
