/**
 * Content script to capture selected word on double click and context and send to background
 */

function getSentence(range) {
  const node = range.startContainer;
  const parent = node.parentElement || node;
  const fullText = parent.innerText || parent.textContent || '';
  const word = range.toString();
  const idx = fullText.indexOf(word);
  if (idx === -1) {
    return fullText.trim();
  }
  const before = fullText.slice(0, idx);
  const startIdx = Math.max(before.lastIndexOf('.'), before.lastIndexOf('!'), before.lastIndexOf('?')) + 1;
  const after = fullText.slice(idx + word.length);
  const endIndices = [after.indexOf('.'), after.indexOf('!'), after.indexOf('?')].filter(i => i !== -1);
  let endOffset;
  if (endIndices.length > 0) {
    endOffset = idx + word.length + Math.min(...endIndices) + 1;
  } else {
    endOffset = fullText.length;
  }
  const sentence = fullText.slice(startIdx, endOffset).trim();
  return sentence;
}

function getXPath(node) {
  // if node is not an element, walk up to its parent
  if (!node || node.nodeType !== 1) {
    return node && node.parentNode ? getXPath(node.parentNode) : '/html/body';
  }
  if (node.id) {
    return 'id("' + node.id + '")';
  }
  if (node === document.body) {
    return '/html/body';
  }
  const siblings = Array.from(node.parentNode.children);
  const ix = siblings.indexOf(node) + 1;
  return getXPath(node.parentNode) + '/' + node.tagName.toLowerCase() + '[' + ix + ']';
}

function handleDoubleClick(e) {
  const selection = window.getSelection();
  const text = selection ? selection.toString().trim() : '';
  if (!text) {
    return;
  }
  const range = selection.getRangeAt(0);
  const sentence = getSentence(range);
  const xpath = getXPath(range.startContainer);
  const position = {
    url: window.location.href,
    scrollY: window.scrollY,
    xpath: xpath
  };
  chrome.runtime.sendMessage({
    type: 'WORD_SELECTED',
    word: text,
    sentence: sentence,
    position: position
  });
}

document.addEventListener('dblclick', handleDoubleClick);
