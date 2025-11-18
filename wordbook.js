document.addEventListener('DOMContentLoaded', () => {
  const waitInput = document.getElementById('waitTime');
  const apiKeyInput = document.getElementById('apiKey');
  const dbIdInput = document.getElementById('dbId');
  const saveBtn = document.getElementById('saveBtn');
  const status = document.getElementById('status');

  // Load saved settings
  chrome.storage.local.get(['waitTime', 'notionApiKey', 'notionDatabaseId'], (data) => {
    if (typeof data.waitTime === 'number') {
      waitInput.value = (data.waitTime / 1000).toString();
    }
    if (data.notionApiKey) {
      apiKeyInput.value = data.notionApiKey;
    }
    if (data.notionDatabaseId) {
      dbIdInput.value = data.notionDatabaseId;
    }
  });

  saveBtn.addEventListener('click', () => {
    const newWait = parseInt(waitInput.value, 10);
    const newApiKey = apiKeyInput.value.trim();
    const newDbId = dbIdInput.value.trim();
    const updates = {};
    if (!isNaN(newWait) && newWait > 0) {
      updates.waitTime = newWait * 1000;
    }
    if (newApiKey) {
      updates.notionApiKey = newApiKey;
    }
    if (newDbId) {
      updates.notionDatabaseId = newDbId;
    }
    chrome.storage.local.set(updates, () => {
      // send waitTime update if changed
      if (!isNaN(newWait) && newWait > 0) {
        chrome.runtime.sendMessage({ type: 'SET_WAIT_TIME', waitTime: newWait * 1000 });
      }
      status.textContent = '已保存';
      setTimeout(() => {
        status.textContent = '';
      }, 2000);
    });
  });
});
