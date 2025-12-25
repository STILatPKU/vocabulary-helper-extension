# Vocabulary Helper Extension

Chrome 扩展：在网页中双击取词，自动查释义并同步到 Notion，支持从 Notion 一键跳回原文并高亮。

## 主要功能
- 双击取词，捕获单词/所在句子/页面标题与 URL/XPath 位置
- 后台调用 Definer API 获取释义 + 音标，按 Notion 富文本格式上传
- 倒计时自动上传，可在弹窗队列中取消
- Notion 记录内生成 Jump Back 链接，点击后回到原页面自动高亮并滚动到单词

## 安装
- Chrome：下载 Release 中的 `vocabulary-helper-chrome.zip`，在扩展管理页启用“开发者模式”后“加载已解压的扩展程序”，指向解压目录。
- Firefox：下载 Release 中的已签名 `vocabulary-helper-firefox.xpi`，在扩展管理页直接安装；或在 `about:debugging#/runtime/this-firefox` 选择“临时载入附加组件”指向 xpi/manifest。

## Notion 数据库准备
在 Notion 新建数据库并添加字段：
- Word（标题）
- Phonetic（富文本）
- Meaning（富文本）
- Sentence（富文本）
- Source Title（富文本）
- Source URL（URL）
- Jump Back（URL）
- Time（日期）

## 配置（Options Page）
- Chrome：在扩展管理页点击“详情” → “扩展选项”，或右键扩展图标选择“选项”。
- Firefox：在扩展管理页找到本扩展 → “选项”；或右键扩展图标使用内置“Open Settings”（右键菜单）。
- 填写并保存：
  - Notion API Key
  - Database ID
  - 自动上传延迟（秒）
  - 是否上传无释义单词

## 使用方式
- 在任意网页双击英文单词，扩展会：
  - 立即请求释义与音标
  - 将条目加入上传队列（弹窗可见倒计时，可点击 Cancel 取消）
- 倒计时结束后自动上传到 Notion
- 在 Notion 记录中点击 Jump Back 链接，可回到原文并自动高亮该词（支持动态页面，字体加载等变动会触发重新定位）

## 文件结构
```
background.js              # 后台逻辑：队列、Notion 上传、释义/音标查询
content.js                 # 页面脚本：取词、高亮、跳回恢复
popup.html / popup.js      # Action 弹窗：查看上传队列、取消
options.html / options.js  # Options Page：配置 API Key/DB/延迟/上传策略
manifest.json              # Chrome MV3 配置
manifest.firefox.json      # Firefox 配置（含 gecko id 与 data_collection_permissions）
scripts/sync-*.sh          # 生成 dist/chrome 与 dist/firefox 的同步脚本
```

## 隐私与数据
- 配置存储于浏览器 `chrome.storage.local`
- 仅调用 Definer API 获取释义，Notion API 上传到你自己的数据库

## 故障排查
- 未上传：检查 Options Page 中的 API Key / Database ID 是否正确，或查看后台日志（开发者工具 → Service Worker）
- 回跳未高亮：确认 Notion 记录的 Jump Back 链接包含 `#highlight=`，并在目标页允许内容脚本运行

## 开发提示（Firefox / 多平台）
- Chrome 版本使用 `manifest.json`；Firefox 版本使用 `manifest.firefox.json`，可运行 `bash scripts/sync-firefox.sh` 生成 `dist/firefox/manifest.json` 供临时加载。
- 代码中使用 `chrome.*` 接口，Firefox 会兼容回调式 `chrome.*`；若后续要统一 Promise 风格，建议引入 `webextension-polyfill` 或封装一个 `browser`/`chrome` 适配层。
- `dist/`、`legacy/`、`todo.md` 已在 `.gitignore`，生成物不应提交；提 PR 前请确保同步 manifest 变更并运行同步脚本。

## 测试结果
- 已测试学术数据库、预印本平台、出版商、论坛，新闻报道中测试不全，科技媒体测试通过，经济政策测试通过
- JSTOR多级滚动不支持
- OSF等需要点击展开的网页不支持
- tandf会清除#标签
- 带付费墙的媒体未测试
