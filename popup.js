document.addEventListener('DOMContentLoaded', () => {
  const queueDiv = document.getElementById('queue');
  let currentQueue = [];

  function renderQueue() {
    queueDiv.innerHTML = '';
    if (!currentQueue || currentQueue.length === 0) {
      queueDiv.textContent = 'No pending uploads.';
      return;
    }
    const now = Date.now();
    currentQueue.forEach(item => {
      const div = document.createElement('div');
      div.className = 'item';
      const wordSpan = document.createElement('span');
      wordSpan.className = 'word';
      wordSpan.textContent = item.word;
      const countdownSpan = document.createElement('span');
      countdownSpan.className = 'countdown';
      const msRemaining = item.dueTime - now;
      const seconds = Math.max(0, Math.ceil(msRemaining / 1000));
      countdownSpan.textContent = `${seconds}s`;
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'cancel-btn';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'CANCEL_UPLOAD', id: item.id });
      });
      div.appendChild(wordSpan);
      div.appendChild(countdownSpan);
      div.appendChild(cancelBtn);
      queueDiv.appendChild(div);
    });
  }

  function requestQueue() {
    chrome.runtime.sendMessage({ type: 'GET_QUEUE' });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'QUEUE_UPDATE') {
      currentQueue = msg.queue;
      renderQueue();
    }
  });

  // initial fetch
  requestQueue();
  // update countdown every second
  setInterval(() => {
    if (currentQueue && currentQueue.length > 0) {
      renderQueue();
    }
  }, 1000);
});
