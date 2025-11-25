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
function smoothInertialScrollTo(targetY, duration = 600) {
  const startY = window.scrollY;
  const diff = targetY - startY;
  const start = performance.now();

  function step(now) {
    const time = now - start;
    const percent = Math.min(time / duration, 1);

    // ease-out cubic (自然惯性)
    const ease = 1 - Math.pow(1 - percent, 3);

    window.scrollTo(0, startY + diff * ease);

    if (percent < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

function scrollElementToCenter(el) {
  const rect = el.getBoundingClientRect();
  const absoluteY = rect.top + window.scrollY;
  const centerY = absoluteY - window.innerHeight / 2 + rect.height / 2;

  smoothInertialScrollTo(centerY);
}


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
      console.log("🔶 Highlighted word:", targetWord);

      // 🌟 强制居中滚动，解决长页面定位失败问题
      scrollElementToCenter(wrapper);

      // Fade highlight
      setTimeout(() => {
        wrapper.style.backgroundColor = "";
      }, 5000);

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
    xpath: xpath,
    title: document.title
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
  const [xpath, word] = decoded.split(":::");
  
  smartHighlight(xpath,word);
}

highlightFromHash();

/* ============================================================
   动态页面智能恢复系统（轮询 + MutationObserver）
   ============================================================ */

function waitForElementByXPath(xpath, maxWait = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    function tryFind() {
      const el = getElementByXPath(xpath);
      if (el) {
        console.log("✅ 元素已找到（轮询）:", xpath);
        resolve(el);
        return;
      }
      if (Date.now() - start > maxWait) {
        resolve(null); // 超时，返回 null
        return;
      }
      requestAnimationFrame(tryFind);
    }
    tryFind();
  });
}

function waitForElementWithObserver(xpath, callback, maxWait = 8000) {
  let done = false;
  const start = Date.now();

  const tryResolve = async () => {
    const el = getElementByXPath(xpath);
    if (el) {
      console.log("✅ 元素已找到（MutationObserver）:", xpath);
      done = true;
      observer.disconnect();
      callback(el);
    } else if (Date.now() - start > maxWait) {
      done = true;
      observer.disconnect();
      callback(null);
    }
  };

  const observer = new MutationObserver(() => {
    if (!done) tryResolve();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  tryResolve();
}

async function smartHighlight(xpath, word) {
  // ① 先用轮询查找元素
  let el = await waitForElementByXPath(xpath, 5000);

  if (!el) {
    // ② 轮询找不到 → 使用 MutationObserver
    return waitForElementWithObserver(xpath, (el) => {
      if (el) {
        highlightWordInsideElement(el, word);
      } else {
        console.warn("智能恢复失败：未找到元素", xpath);
      }
    });
  }

  // 找到了
  highlightWordInsideElement(el, word);
}
