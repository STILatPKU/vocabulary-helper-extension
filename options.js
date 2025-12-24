// options.js — 独立 Options Page，负责读写设置并通知后台
document.addEventListener('DOMContentLoaded', () => {
  const waitInput = document.getElementById('waitTimeInput');
  const keyInput = document.getElementById('notionKeyInput');
  const dbInput = document.getElementById('notionDbInput');
  const uploadWithoutDefInput = document.getElementById('uploadWithoutDefinition');
  const saveBtn = document.getElementById('saveSettings');
  const statusSpan = document.getElementById('status');

  function loadSettings() {
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
          uploadWithoutDefInput.checked = true;
        }
      }
    );
  }

  function saveSettings() {
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
        chrome.runtime.sendMessage({ type: 'SET_WAIT_TIME', waitTime: newWait * 1000 });
      }
      chrome.runtime.sendMessage({ type: 'SET_NOTION_CONFIG', apiKey: newApiKey, dbId: newDbId });
      chrome.runtime.sendMessage({ type: 'SET_UPLOAD_OPTION', uploadWithoutDefinition });

      statusSpan.textContent = '已保存';
      setTimeout(() => { statusSpan.textContent = ''; }, 2000);
    });
  }

  saveBtn.addEventListener('click', saveSettings);
  loadSettings();
});
