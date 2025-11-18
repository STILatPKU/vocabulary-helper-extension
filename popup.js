document.addEventListener('DOMContentLoaded', () => {
  const cancelButton = document.getElementById('cancel');
  if (cancelButton) {
    cancelButton.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'CANCEL_UPLOAD' });
      window.close();
    });
  }
});
