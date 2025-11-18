// background.js
let pendingTimer = null;
let lastEntry = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'WORD_SELECTED') {
    lastEntry = msg;
    // start countdown and badge
    let count = 5;
    const updateBadge = () => {
      if (count <= 0) {
        uploadToNotion(lastEntry);
        chrome.action.setBadgeText({ text: '' });
        pendingTimer = null;
      } else {
        chrome.action.setBadgeText({ text: 'UP' + count });
        count--;
        pendingTimer = setTimeout(updateBadge, 1000);
      }
    };
    if (pendingTimer) clearTimeout(pendingTimer);
    updateBadge();
  } else if (msg.type === 'CANCEL_UPLOAD') {
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      chrome.action.setBadgeText({ text: '' });
      pendingTimer = null;
    }
  }
});

async function uploadToNotion(entry) {
  // Placeholder: implement Notion API upload here
  console.log('Uploading to Notion', entry);
}
