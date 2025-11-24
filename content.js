/**
 * Content script to capture selected word on double click and context and send to background
 */

/* ---------------- Sentence Extraction ---------------- */

function getSentence(range) {
  const node = range.startContainer;
  const parent = node.parentElement || node;
  const fullText = parent.innerText || parent.textContent || '';
  const word = range.toString();
  const idx = fullText.indexOf(word);
  if (idx === -1) return fullText.trim();

  const before = fullText.slice(0, idx);
  const startIdx = Math.max(
    before.lastIndexOf('.'),
    before.lastIndexOf('!'),
    before.lastIndexOf('?')
  ) + 1;

  const after = fullText.slice(idx + word.length);
  const endIndices = [after.indexOf('.'), after.indexOf('!'), after.indexOf('?')]
    .filter(i => i !== -1);
  const endOffset =
    endIndices.length > 0
      ? idx + word.length + Math.min(...endIndices) + 1
      : fullText.length;

  return fullText.slice(startIdx, endOffset).trim();
}

/* ---------------- XPath Generation (Stable) ---------------- */

function getXPath(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentNode;
  }

  if (node === document.body) return '/html/body';

  const parts = [];
  while (node && node.nodeType === Node.ELEMENT_NODE && node !== document.body) {
    let index = 1;
    let sibling = node.previousElementSibling;
    while (sibling) {
      if (sibling.nodeName === node.nodeName) index++;
      sibling = sibling.previousElementSibling;
    }
    parts.unshift(`${node.nodeName.toLowerCase()}[${index}]`);
    node = node.parentNode;
  }

  return '/html/body/' + parts.join('/');
}

/* ---------------- Single-Word Highlight (Span-Wrap) ---------------- */

function highlightWordInsideElement(element, targetWord) {
  if (!element || !targetWord) return;

  const treeWalker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null
  );

  let node;
  while ((node = treeWalker.nextNode())) {
    const text = node.nodeValue;
    const index = text.toLowerCase().indexOf(targetWord.toLowerCase());
    if (index !== -1) {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + targetWord.length);

      const wrapper = document.createElement("span");
      wrapper.style.background = "yellow";
      wrapper.style.transition = "background-color 1.5s ease";

      range.surroundContents(wrapper);
      wrapper.scrollIntoView({ behavior: "smooth", block: "center" });

      // Fade highlight
      setTimeout(() => {
        wrapper.style.backgroundColor = "";
      }, 2000);

      break;
    }
  }
}

/* ---------------- Double-Click Handler ---------------- */

function handleDoubleClick(e) {
  const t = e.target;
  const tag = t.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || t.isContentEditable) return;

  const sel = window.getSelection();
  const text = sel ? sel.toString().trim() : '';
  if (!text) return;

  const range = sel.getRangeAt(0);

  const sentence = getSentence(range);
  const xpath = getXPath(range.startContainer);

  const position = {
    url: window.location.href.split("#")[0], // remove possible hash
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

/* ---------------- Restore Highlight From #hash ---------------- */

function getElementByXPath(xpath) {
  try {
    return document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;
  } catch {
    return null;
  }
}

function highlightFromHash() {
  const hash = location.hash;
  if (!hash.startsWith("#highlight=")) return;

  const raw = hash.slice("#highlight=".length);
  const decoded = decodeURIComponent(raw);

  // Format: xpath:::word
  const parts = decoded.split(":::");
  const xpath = parts[0];
  const word = parts[1];

  const el = getElementByXPath(xpath);
  if (!el) return;

  highlightWordInsideElement(el, word);
}

highlightFromHash();
