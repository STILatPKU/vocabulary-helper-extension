// background.js with queue and adjustable wait time

let waitTime = 5000; // default wait time in ms
let pendingEntries = []; // array of pending word entries

// Load wait time from storage if previously saved
chrome.storage.local.get(['waitTime'], data => {
  if (typeof data.waitTime === 'number') {
    waitTime = data.waitTime;
  }
});

// Update badge to show remaining time of the last upload
function updateBadge() {
  const count = pendingEntries.length;
  if (count === 0) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }
  // find the item with the maximum dueTime
  const maxDue = Math.max(...pendingEntries.map(item => item.dueTime));
  const msRemaining = maxDue - Date.now();
  const secs = Math.max(0, Math.ceil(msRemaining / 1000));
  const text = 'UP' + secs + (count > 1 ? '+' : '');
  chrome.action.setBadgeText({ text });
}

// Send queue update to popup; ignore error if no listener
function sendQueueUpdate() {
  const queue = pendingEntries.map(item => ({
    id: item.id,
    word: item.word,
    dueTime: item.dueTime
  }));
  chrome.runtime.sendMessage({ type: 'QUEUE_UPDATE', queue }, () => {
    if (chrome.runtime.lastError) {
      // no listeners, ignore
    }
  });
}

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'WORD_SELECTED') {
    const { word, sentence, position } = msg;
    const id = crypto.randomUUID();
    const dueTime = Date.now() + waitTime;
    const entry = { id, word, sentence, position, dueTime, timerId: null };
    // schedule upload after waitTime
    entry.timerId = setTimeout(() => {
      pendingEntries = pendingEntries.filter(e => e.id !== entry.id);
      updateBadge();
      sendQueueUpdate();
      uploadToNotion(entry);
    }, waitTime);
    pendingEntries.push(entry);
    updateBadge();
    sendQueueUpdate();
  } else if (msg.type === 'CANCEL_UPLOAD') {
    const { id } = msg;
    const idx = pendingEntries.findIndex(item => item.id === id);
    if (idx >= 0) {
      clearTimeout(pendingEntries[idx].timerId);
      pendingEntries.splice(idx, 1);
      updateBadge();
      sendQueueUpdate();
    }
  } else if (msg.type === 'SET_WAIT_TIME') {
    const newMs = msg.waitTime;
    waitTime = newMs;
    chrome.storage.local.set({ waitTime: newMs });
    // reschedule existing entries with new waitTime from now
    const now = Date.now();
    pendingEntries.forEach(item => {
      clearTimeout(item.timerId);
      item.dueTime = now + waitTime;
      item.timerId = setTimeout(() => {
        pendingEntries = pendingEntries.filter(e => e.id !== item.id);
        updateBadge();
        sendQueueUpdate();
        uploadToNotion(item);
      }, waitTime);
    });
    updateBadge();
    sendQueueUpdate();
  } else if (msg.type === 'GET_QUEUE') {
    sendQueueUpdate();
  }
});

// Periodically update countdowns and badge every second
setInterval(() => {
  if (pendingEntries.length > 0) {
    updateBadge();
    sendQueueUpdate();
  }
}, 1000);

// Placeholder for Notion upload
function uploadToNotion(entry) {
  console.log('Uploading', entry.word);
}
