// Content script to capture selected word and context and send to background

function getSentence(range) {
  const container = range.startContainer;
  let text = '';
  if (container && container.textContent) {
    text = container.textContent.trim();
  }
  return text;
}

function getXPath(element) {
  if (!element) return '';
  let segs = [];
  for (let el = element.nodeType === 3 ? element.parentNode : element; el && el.nodeType === 1; el = el.parentNode) {
    let i = 1;
    let sib;
    for (sib = el.previousSibling; sib; sib = sib.previousSibling) {
      if (sib.nodeType === 1 && sib.nodeName === el.nodeName) i++;
    }
    segs.unshift(el.nodeName.toLowerCase() + '[' + i + ']');
  }
  return '/' + segs.join('/');
}

document.addEventListener('mouseup', (e) => {
  const sel = window.getSelection();
  const text = sel.toString().trim();
  if (!text) return;
  // treat as word if single word or ctrl key pressed
  if (!e.ctrlKey && text.split(/\s+/).length > 3) {
    return;
  }
  const range = sel.getRangeAt(0);
  const sentence = getSentence(range);
  const position = {
    url: window.location.href,
    scrollY: window.scrollY,
    xpath: getXPath(range.startContainer)
  };
  chrome.runtime.sendMessage({ type: 'WORD_SELECTED', word: text, sentence, position });
});
