// background.js with queue and adjustable wait time

let waitTime = 5000; // default wait time in ms
let pendingEntries = []; // array of pending word entries

// Load wait time from storage if previously saved
chrome.storage.local.get({ waitTime: 5000 }, (data) => {
  waitTime = data.waitTime;
});

function updateBadge() {
  const count = pendingEntries.length;
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
}

function sendQueueUpdate() {
  const now = Date.now();
  const queue = pendingEntries.map(item => {
    const remaining = Math.max(0, Math.ceil((item.endTime - now) / 1000));
    return { id: item.id, word: item.entry.word, countdown: remaining };
  });
  chrome.runtime.sendMessage({ type: 'QUEUE_UPDATE', queue });
}

function scheduleUpload(item) {
  item.endTime = Date.now() + waitTime;
  item.timerId = setTimeout(() => {
    // on timeout remove item and upload
    pendingEntries = pendingEntries.filter(i => i.id !== item.id);
    updateBadge();
    sendQueueUpdate();
    uploadToNotion(item.entry);
  }, waitTime);
  updateBadge();
  sendQueueUpdate();
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'WORD_SELECTED') {
    const id = Date.now().toString() + Math.random().toString(16).slice(2);
    const item = { id, entry: msg, timerId: null, endTime: Date.now() + waitTime };
    pendingEntries.push(item);
    scheduleUpload(item);
  } else if (msg.type === 'CANCEL_UPLOAD') {
    const id = msg.id;
    const item = pendingEntries.find(i => i.id === id);
    if (item) {
      clearTimeout(item.timerId);
      pendingEntries = pendingEntries.filter(i => i.id !== id);
      updateBadge();
      sendQueueUpdate();
    }
  } else if (msg.type === 'SET_WAIT_TIME') {
    waitTime = msg.waitTime;
    chrome.storage.local.set({ waitTime });
    // reschedule existing items
    pendingEntries.forEach(item => {
      clearTimeout(item.timerId);
      item.endTime = Date.now() + waitTime;
      item.timerId = setTimeout(() => {
        pendingEntries = pendingEntries.filter(i => i.id !== item.id);
        updateBadge();
        sendQueueUpdate();
        uploadToNotion(item.entry);
      }, waitTime);
    });
    updateBadge();
    sendQueueUpdate();
  } else if (msg.type === 'GET_QUEUE') {
    sendQueueUpdate();
  }
});

// periodically update countdowns every second
setInterval(() => {
  if (pendingEntries.length > 0) {
    sendQueueUpdate();
  }
}, 1000);

function uploadToNotion(entry) {
  // TODO: implement actual Notion upload
  console.log('Uploading to Notion:', entry.word);
}
