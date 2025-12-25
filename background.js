// background.js — 带 Notion 上传逻辑（使用用户设置的密钥和 DB ID）

let waitTime = 5000; // default wait time in ms
let pendingEntries = []; // array of pending word entries

// 从本地读取 Notion 设置（由用户在设置页填写）
let notionApiKey = null;
let notionDatabaseId = null;
let uploadWithoutDefinition = true; // 是否上传无释义单词，默认 true
// Firefox MV2 兼容：action/browserAction 统一接口
const actionAPI = (typeof chrome !== "undefined" && (chrome.action || chrome.browserAction)) || null;
const menusAPI = (typeof chrome !== "undefined" && (chrome.contextMenus || chrome.menus)) || null;

chrome.storage.local.get(
  ["waitTime", "notionApiKey", "notionDatabaseId", "uploadWithoutDefinition"],
  (data) => {
    if (typeof data.waitTime === "number") waitTime = data.waitTime;
    if (data.notionApiKey) notionApiKey = data.notionApiKey;
    if (data.notionDatabaseId) notionDatabaseId = data.notionDatabaseId;
    if (typeof data.uploadWithoutDefinition === "boolean") {
      uploadWithoutDefinition = data.uploadWithoutDefinition;
    }
  }
);

// --- Badge & Queue UI 更新逻辑 ---
function updateBadge() {
  if (pendingEntries.length === 0) {
    actionAPI && actionAPI.setBadgeText({ text: "" });
    return;
  }
  const now = Date.now();
  let maxRemaining = 0;
  pendingEntries.forEach((item) => {
    const remaining = item.endTime - now;
    if (remaining > maxRemaining) maxRemaining = remaining;
  });
  const seconds = Math.max(0, Math.ceil(maxRemaining / 1000));
  let text = `UP${seconds}`;
  if (pendingEntries.length > 1) text += "+";
  actionAPI && actionAPI.setBadgeText({ text });
}

function sendQueueUpdate() {
  const queue = pendingEntries.map((item) => ({
    id: item.id,
    word: item.entry.word,
    dueTime: item.endTime,
  }));
  chrome.runtime.sendMessage({ type: "QUEUE_UPDATE", queue }, () => {
    const err = chrome.runtime.lastError;
  });
}

// --- 启动某个条目的倒计时定时器 ---
function startItemTimer(item) {
  item.endTime = Date.now() + waitTime;
  item.timerId = setTimeout(async () => {
    // 定时器触发：从队列移除该项
    pendingEntries = pendingEntries.filter((i) => i.id !== item.id);
    updateBadge();
    sendQueueUpdate();

    try {
      // 等待释义完成（如果还在查询中）
      let definitionResult = null;
      if (item.meaningRichText) { // 已经缓存结果
        definitionResult = {
          meaningRichText: item.meaningRichText,
          phonetic: item.phonetic,
        };
      } else {
        definitionResult = await item.definitionPromise;
        item.meaningRichText = definitionResult.meaningRichText;
        item.phonetic = definitionResult.phonetic;
      }

      await uploadToNotion(
        item.entry,
        definitionResult.meaningRichText,
        definitionResult.phonetic
      );
    } catch (err) {
      console.error("处理上传时出错：", err);
    }
  }, waitTime);

  updateBadge();
  sendQueueUpdate();
}

// --- 调度上传（创建定时器） ---
function scheduleUpload(item) {
  startItemTimer(item);
}

// --- 监听 content script & popup ---
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "WORD_SELECTED") {
    const id = Date.now().toString() + Math.random().toString(16).slice(2);

    // 选中单词后立即开始查询释义（异步）
    const definitionPromise = fetchDefinitionFromDefiner(msg.word);

    const item = {
      id,
      entry: msg,
      definitionPromise,   // Promise<{ meaningRichText, phonetic }>
      meaningRichText: null, // 缓存结果，避免重复 await
      phonetic: null,
      timerId: null,
      endTime: Date.now() + waitTime,
    };
    pendingEntries.push(item);
    scheduleUpload(item);

  } else if (msg.type === "CANCEL_UPLOAD") {
    const id = msg.id;
    const item = pendingEntries.find((i) => i.id === id);
    if (item) {
      clearTimeout(item.timerId);
      pendingEntries = pendingEntries.filter((i) => i.id !== id);
      updateBadge();
      sendQueueUpdate();
    }

  } else if (msg.type === "SET_WAIT_TIME") {
    waitTime = msg.waitTime;
    chrome.storage.local.set({ waitTime });

    // 重置所有条目的倒计时
    pendingEntries.forEach((item) => {
      clearTimeout(item.timerId);
      startItemTimer(item);
    });

    updateBadge();
    sendQueueUpdate();

  } else if (msg.type === "SET_NOTION_CONFIG") {
    notionApiKey = msg.apiKey || null;
    notionDatabaseId = msg.dbId || null;

    chrome.storage.local.set({
      notionApiKey,
      notionDatabaseId,
    });

    console.log("Notion 设置已更新：", notionApiKey, notionDatabaseId);

  } else if (msg.type === "SET_UPLOAD_OPTION") {
    uploadWithoutDefinition = !!msg.uploadWithoutDefinition;
    chrome.storage.local.set({ uploadWithoutDefinition });
    console.log("上传无释义单词选项已更新：", uploadWithoutDefinition);

  } else if (msg.type === "GET_QUEUE") {
    sendQueueUpdate();
  }
});

// --- 每秒更新倒计时 ---
setInterval(() => {
  if (pendingEntries.length > 0) {
    updateBadge();
    sendQueueUpdate();
  }
}, 1000);

// ------------------------------------------------------------
// Action 图标右键菜单：打开设置（兼容 Firefox/Chrome）
// ------------------------------------------------------------
function setupActionContextMenu() {
  if (!menusAPI) return;

  // 尝试清空旧菜单，避免重复创建报错
  try {
    menusAPI.removeAll(() => {
      // Chrome MV3: "action"; Firefox: "browser_action"
      const isFirefox = typeof browser !== "undefined" && !!browser.runtime;
      const contexts = isFirefox ? ["browser_action"] : ["action"];
      menusAPI.create({
        id: "open-options",
        title: "Open Settings",
        contexts
      });
    });
  } catch (e) {
    console.warn("contextMenus setup skipped:", e);
  }

  const handler = (info, tab) => {
    if (info.menuItemId === "open-options") {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        // Firefox 旧版 fallback
        chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
      }
    }
  };

  if (menusAPI.onClicked) {
    menusAPI.onClicked.addListener(handler);
  }
}

setupActionContextMenu();

// ------------------------------------------------------------
// Definer API：获取所有词性/释义/例句（返回 Notion rich_text）
// ------------------------------------------------------------
async function fetchDefinitionFromDefiner(word) {
  const url = `https://lumetrium.com/dictionary-api/v1/entries/en/${encodeURIComponent(
    word
  )}`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn("Definer API 查询失败：", resp.status);
      return {
        meaningRichText: [
          { type: "text", text: { content: "(definition unavailable)" } },
        ],
        phonetic: null,
      };
    }

    const data = await resp.json();

    if (!Array.isArray(data) || data.length === 0) {
      return {
        meaningRichText: [{ type: "text", text: { content: "(no definition)" } }],
        phonetic: null,
      };
    }

    const entry = data[0];
    const phonetic = entry.phonetic || null;
    const meaning = entry.meaning || {};

    // 🔥 富文本数组
    let richTexts = [];

    for (const partOfSpeech in meaning) {
      const definitions = meaning[partOfSpeech].definitions || [];

      definitions.forEach((defObj) => {
        const definition = defObj.definition || "";
        const example = defObj.example || null;

        // 1. 词性 — 加粗
        richTexts.push({
          type: "text",
          text: { content: `${partOfSpeech}\n` },
          annotations: { bold: true },
        });

        // 2. 释义 — 普通文本
        richTexts.push({
          type: "text",
          text: { content: definition + "\n" },
        });

        // 3. 例句（如果存在）— 斜体 + 灰色
        if (example) {
          richTexts.push({
            type: "text",
            text: { content: `${example}\n` },
            annotations: { italic: true, color: "gray" },
          });
        }

        // 空行分隔不同释义
        richTexts.push({
          type: "text",
          text: { content: "\n" },
        });
      });
    }

    // 防御性：至少返回一个元素
    if (richTexts.length === 0) {
      return {
        meaningRichText: [{ type: "text", text: { content: "(no definition)" } }],
        phonetic,
      };
    }

    return { meaningRichText: richTexts, phonetic };
  } catch (err) {
    console.error("❌ Definer API 查询错误：", err);
    return {
      meaningRichText: [{ type: "text", text: { content: "(definition error)" } }],
      phonetic: null,
    };
  }
}

// -----------------------------------------------------
// Notion 上传逻辑（使用字段：Word / Meaning / Sentence / Source URL / Page Location / Time）
// -----------------------------------------------------

async function uploadToNotion(entry, meaningRichText, phonetic) {
  // 如果用户还没有配置 Notion API，则忽略上传
  if (!notionApiKey || !notionDatabaseId) {
    console.warn("Notion API Key / Database ID 未设置，跳过上传");
    return;
  }

  // 安全兜底：如果没拿到释义，调用一次（理论上 definitionPromise 已处理）
  if (!meaningRichText) {
    const definitionResult = await fetchDefinitionFromDefiner(entry.word);
    meaningRichText = definitionResult.meaningRichText;
    phonetic = phonetic || definitionResult.phonetic;
  }

  // 按设置决定是否跳过无释义的单词
  if (!uploadWithoutDefinition) {
    const isNoMeaning =
      !meaningRichText ||
      meaningRichText.length === 0 ||
      (meaningRichText.length === 1 &&
        typeof meaningRichText[0]?.text?.content === "string" &&
        (
          meaningRichText[0].text.content.includes("(no definition)") ||
          meaningRichText[0].text.content.includes("(definition unavailable)") ||
          meaningRichText[0].text.content.includes("(definition error)")
        ));

    if (isNoMeaning) {
      console.warn("根据设置，跳过无释义单词：", entry.word);
      return;
    }
  }

  // 构造 Notion 请求
  const notionPayload = {
    parent: { database_id: notionDatabaseId },
    properties: {
      Word: { title: [{ text: { content: entry.word } }] },
      Phonetic: {
        rich_text: [{ text: { content: phonetic ? `/${phonetic}/` : "" } }],
      },
      Meaning: {
        rich_text: meaningRichText,
      },
      Sentence: {
        rich_text: [{ text: { content: entry.sentence || "" } }],
      },
      "Source Title": {
          rich_text: [{ text: { content: entry.position?.title || "" }}]
      },
      "Source URL": { url: entry.position?.url || null },
      "Jump Back": {
        url: `${entry.position.url}#highlight=${encodeURIComponent(entry.position.xpath + ":::" + entry.word)}`
      },

      Time: {
        date: { start: new Date().toISOString() },
      },
    },
  };

  try {
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionApiKey}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify(notionPayload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("❌ Notion 上传失败:", errorText);
      return;
    }

    console.log(`✅ 已上传：${entry.word}`);
  } catch (err) {
    console.error("❌ 上传到 Notion 时出错:", err);
  }
}
