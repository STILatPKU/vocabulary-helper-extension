// background.js with queue and adjustable wait time and improved badge display

let waitTime = 5000; // default wait time in ms
let pendingEntries = []; // array of pending word entries

// Load wait time from storage if previously saved
chrome.storage.local.get({ waitTime: 5000 }, (data) => {
  if (typeof data.waitTime === 'number') {
    waitTime = data.waitTime;
  }
});

// Update badge to show remaining time of the last upload plus plus sign if queue has more than one item
function updateBadge() {
  if (pendingEntries.length === 0) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }
  const now = Date.now();
  let maxRemaining = 0;
  pendingEntries.forEach(item => {
    const remaining = item.endTime - now;
    if (remaining > maxRemaining) {
      maxRemaining = remaining;
    }
  });
  const seconds = Math.max(0, Math.ceil(maxRemaining / 1000));
  let text = `UP${seconds}`;
  if (pendingEntries.length > 1) {
    text += '+';
  }
  chrome.action.setBadgeText({ text });
}

// Send queue update to any listeners (popup). Catch errors if no listener.
function sendQueueUpdate() {
  const queue = pendingEntries.map(item => {
    return { id: item.id, word: item.entry.word, dueTime: item.endTime };
  });
  chrome.runtime.sendMessage({ type: 'QUEUE_UPDATE', queue }, () => {
    const err = chrome.runtime.lastError;
    // ignore if no listener
  });
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
    // reschedule existing items with new wait time from now
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

// periodically update countdowns and badge every second
setInterval(() => {
  if (pendingEntries.length > 0) {
    updateBadge();
    sendQueueUpdate();
  }
}, 1000);

function uploadToNotion(entry) {
  // TODO: implement actual Notion upload
  console.log('Uploading to Notion:', entry.word);
}
