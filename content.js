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

function calculateElementCenterY(el) {
  const rect = el.getBoundingClientRect();
  return rect.top + window.scrollY - window.innerHeight / 2 + rect.height / 2;
}

// 保证只有一个滚动任务，MutationObserver 可触发重新计算位置
const scrollController = (() => {
  let frameId = null;
  let active = false;
  let targetEl = null;
  let duration = 600;
  let startTime = 0;
  let startY = 0;
  let targetY = 0;
  let recalcRequested = false;
  let notConnectedSince = null;

  function stop() {
    active = false;
    if (frameId) cancelAnimationFrame(frameId);
    frameId = null;
    startTime = 0;
  }

  function step(timestamp) {
    if (!active) return;

    if (recalcRequested || startTime === 0) {
      if (!targetEl) {
        console.warn("⚠️ No scroll target; stopping scroll.");
        stop();
        return;
      }

      if (!targetEl.isConnected) {
        // target 还未挂载，容忍短暂等待，超时则放弃
        if (notConnectedSince === null) notConnectedSince = timestamp;
        if (timestamp - notConnectedSince > 800) {
          console.warn("⚠️ Scroll target stayed detached; stopping scroll.");
          stop();
          return;
        }

        console.log("⏳ Target not connected, waiting...");
        recalcRequested = true;
        startTime = 0;
        frameId = requestAnimationFrame(step);
        return;
      }

      notConnectedSince = null;

      const nextTarget = calculateElementCenterY(targetEl);
      startY = window.scrollY;
      targetY = nextTarget;
      startTime = timestamp;
      recalcRequested = false;
      console.log("🔁 Recalculating scroll target:", Math.round(targetY));
    }

    const elapsed = timestamp - startTime;
    const percent = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - percent, 3);
    const nextY = startY + (targetY - startY) * ease;

    window.scrollTo(0, nextY);
    console.log(`🚀 Scrolling... ${Math.round(percent * 100)}%`);

    if (percent < 1 && active) {
      frameId = requestAnimationFrame(step);
    } else {
      stop();
      console.log("✅ Scrolling complete.");
    }
  }

  function start() {
    if (active) return;
    active = true;
    frameId = requestAnimationFrame(step);
  }

  return {
    scrollToElement(el, dur = 600) {
      targetEl = el;
      duration = dur;
      recalcRequested = true;
      start();
    },
    notifyRecalc() {
      if (!targetEl) return;
      recalcRequested = true;
      start();
    },
    stop
  };
})();

function scrollElementToCenter(el) {
  console.log("🎯 Request scroll to element center");
  scrollController.scrollToElement(el);
}


function highlightWordInsideElement(element, targetWord) {
  if (!element || !targetWord) return null;

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

      // 加入短暂高亮 fade-out
      setTimeout(() => {
        wrapper.style.backgroundColor = "";
        console.log("✨ Faded highlight for word:", wrapper.textContent);
      }, 10000);

      return wrapper;   // ⭐ 返回 wrapper 以配合 watcher
    }
  }

  return null;
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
        console.warn("⚠️ 元素查找超时（轮询）:", xpath);
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
      console.warn("⚠️ 元素查找超时（MutationObserver）:", xpath);
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

function watchWrapperDisappear(wrapper, element, word, xpath) {
  const fontSet = document.fonts;
  const onFontEvent = () => {
    if (wrapper && wrapper.isConnected) {
      console.log("🔠 Font load event, recalculating scroll target.");
      scrollController.notifyRecalc();
    }
  };

  if (fontSet && fontSet.addEventListener) {
    fontSet.addEventListener('loadingdone', onFontEvent);
    fontSet.addEventListener('loadingerror', onFontEvent);
  }

  const mo = new MutationObserver(() => {
    if (!wrapper || !wrapper.isConnected) {
      console.warn("⚠️ Wrapper disappeared, attempting to re-highlight.");
      scrollController.stop();
      mo.disconnect();
      if (fontSet && fontSet.removeEventListener) {
        fontSet.removeEventListener('loadingdone', onFontEvent);
        fontSet.removeEventListener('loadingerror', onFontEvent);
      }

      setTimeout(() => {
        // 如果原 element 已经被替换，重新查找
        let host = element && element.isConnected ? element : null;
        if (!host && xpath) {
          host = getElementByXPath(xpath);
        }

        if (!host) {
          console.error("❌ 重新高亮失败，未找到容器元素。");
          return;
        }

        const newWrapper = highlightWordInsideElement(host, word);

        if (newWrapper) {
          scrollElementToCenter(newWrapper);
          watchWrapperDisappear(newWrapper, host, word, xpath);
        } else {
          console.error("❌ 重新高亮失败，未找到目标词。");
        }
      }, 1000); // slight delay to ensure DOM stability

      return;
    }

    // wrapper 仍存在但 DOM 发生变化，通知滚动重新计算目标
    console.log("🔄 DOM changed, notifying scroll controller to recalc.");
    scrollController.notifyRecalc();
  });
  // 监听整个 body 的变化,如果有子节点变动就
  mo.observe(document, { childList: true, subtree: true });

  // 如果10秒内没有触发变化就断开观察，避免长期占用资源
  setTimeout(() => {
    mo.disconnect();
    if (fontSet && fontSet.removeEventListener) {
      fontSet.removeEventListener('loadingdone', onFontEvent);
      fontSet.removeEventListener('loadingerror', onFontEvent);
    }
  }, 10000);
}

async function smartHighlight(xpath, word) {
  // ① 先用轮询查找元素
  let el = await waitForElementByXPath(xpath, 5000);

  // ② 轮询找不到 → 使用 MutationObserver
  if (!el) {
    return waitForElementWithObserver(xpath, (el) => {
      if (el) {
        const wrapper = highlightWordInsideElement(el, word);
        if (wrapper) {
          scrollElementToCenter(wrapper);
          watchWrapperDisappear(wrapper, el, word, xpath);
        }
      }
    });
  }

  // ③ 找到元素 → 高亮并监视
  setTimeout(() => {
    const wrapper = highlightWordInsideElement(el, word);
    if (wrapper) {
      scrollElementToCenter(wrapper);
      watchWrapperDisappear(wrapper, el, word, xpath);
    }
  }, 100);
}
