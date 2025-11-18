// background.js — 带 Notion 上传逻辑（使用用户设置的密钥和 DB ID）

let waitTime = 5000; // default wait time in ms
let pendingEntries = []; // array of pending word entries

// 从本地读取 Notion 设置（由用户在设置页填写）
let notionApiKey = null;
let notionDatabaseId = null;

chrome.storage.local.get(["waitTime", "notionApiKey", "notionDatabaseId"], (data) => {
  if (typeof data.waitTime === "number") waitTime = data.waitTime;
  if (data.notionApiKey) notionApiKey = data.notionApiKey;
  if (data.notionDatabaseId) notionDatabaseId = data.notionDatabaseId;
});

// --- Badge & Queue UI 更新逻辑 ---
function updateBadge() {
  if (pendingEntries.length === 0) {
    chrome.action.setBadgeText({ text: "" });
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
  chrome.action.setBadgeText({ text });
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

// --- 调度上传 ---
function scheduleUpload(item) {
  item.endTime = Date.now() + waitTime;
  item.timerId = setTimeout(() => {
    pendingEntries = pendingEntries.filter((i) => i.id !== item.id);
    updateBadge();
    sendQueueUpdate();
    uploadToNotion(item.entry);
  }, waitTime);

  updateBadge();
  sendQueueUpdate();
}

// --- 监听 content script & popup ---
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "WORD_SELECTED") {
    const id = Date.now().toString() + Math.random().toString(16).slice(2);
    const item = {
      id,
      entry: msg,
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

    pendingEntries.forEach((item) => {
      clearTimeout(item.timerId);
      item.endTime = Date.now() + waitTime;
      item.timerId = setTimeout(() => {
        pendingEntries = pendingEntries.filter((i) => i.id !== item.id);
        updateBadge();
        sendQueueUpdate();
        uploadToNotion(item.entry);
      }, waitTime);
    });

    updateBadge();
    sendQueueUpdate();

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

// -----------------------------------------------------
// Notion 上传逻辑（使用字段：Word / Meaning / Sentence / Source URL / Page Location / Time）
// -----------------------------------------------------

async function uploadToNotion(entry) {
  // 如果用户还没有配置 Notion API，则忽略上传
  if (!notionApiKey || !notionDatabaseId) {
    console.warn("Notion API Key / Database ID 未设置，跳过上传");
    return;
  }

  // 构造 Notion 请求
  const notionPayload = {
    parent: { database_id: notionDatabaseId },
    properties: {
      Word: { title: [{ text: { content: entry.word } }] },
      Meaning: {
        rich_text: [{ text: { content: "(待查询或用户补充的释义)" } }],
      },
      Sentence: {
        rich_text: [{ text: { content: entry.sentence || "" } }],
      },
      "Source URL": { url: entry.position?.url || null },
      "Page Location": {
        rich_text: [
          {
            text: {
              content: `scrollY=${entry.position?.scrollY || 0}\nxpath=${entry.position?.xpath || ""}`,
            },
          },
        ],
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
