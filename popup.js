document.addEventListener('DOMContentLoaded', () => {
  const queueDiv = document.getElementById('queue');
  const waitInput = document.getElementById('waitTimeInput');
  const saveBtn = document.getElementById('saveWait');

  function renderQueue(queue) {
    queueDiv.innerHTML = '';
    if (!queue || queue.length === 0) {
      queueDiv.textContent = 'No pending uploads.';
      return;
    }
    queue.forEach(item => {
      const div = document.createElement('div');
      div.className = 'item';
      const wordSpan = document.createElement('span');
      wordSpan.className = 'word';
      wordSpan.textContent = item.word;
      const countdownSpan = document.createElement('span');
      countdownSpan.className = 'countdown';
      countdownSpan.textContent = item.countdown + 's';
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
      renderQueue(msg.queue);
    }
  });

  // load existing wait time from storage
  chrome.storage.local.get({ waitTime: 5000 }, (data) => {
    waitInput.value = Math.round(data.waitTime / 1000);
  });

  saveBtn.addEventListener('click', () => {
    const value = parseInt(waitInput.value, 10);
    if (!isNaN(value) && value > 0) {
      const ms = value * 1000;
      chrome.runtime.sendMessage({ type: 'SET_WAIT_TIME', waitTime: ms });
    }
  });

  requestQueue();
});
