# Vocabulary Helper Extension

一个轻量级 Chrome 扩展，用于在浏览网页时快速记录未知单词，并自动同步至 Notion 词库。
支持：

* 双击查词
* 自动获取释义
* 倒计时自动上传
* 跳回原文并高亮该词
* Notion 富文本格式化释义
* 可选跳过无释义单词
* 精准 XPath 恢复单词位置

## ✨ 功能特性

### 📌 1. 双击取词

在网页中双击英文单词即可触发捕捉：

* 单词本体
* 所在句子
* 单词所在 DOM 节点的 XPath
* 网页链接

（输入框、密码框、可编辑区域会被自动排除）

### 📌 2. 自动查询释义（Definer API）

扩展会在选词的瞬间启动 API 查询，不依赖键盘输入或前端界面。

查询结果包括：

* 所有词性
* 每个词性的多个释义
* 示例句子
* 并以 **Notion 富文本格式**上传

### 📌 3. 倒计时自动上传至 Notion

你可以设置一个自动上传延迟（如 5 秒）：

* 若用户不取消，倒计时结束后自动上传
* 若释义仍在查询中，扩展会等待释义完成再上传
* 你可选择是否上传“无释义单词”

### 📌 4. 从 Notion 跳回原文并自动高亮

每条单词记录中自动生成：

```
Jump Back → https://example.com/page#highlight=xpath:::word
```

当你从 Notion 点击跳转回网页时，扩展会：

* 自动解析 hash
* 使用 XPath 定位元素
* 在元素内部精准查找单词文本
* 高亮标记并滚动到可视位置

无需外部服务器，无需扩展页面。

## 📁 目录结构

```
extension/
│── background.js       # 后台逻辑（队列、Notion 上传、释义查询）
│── content.js          # 页面脚本（取词、高亮、恢复）
│── popup.html/js       # 上传队列查看与取消
│── wordbook.html/js    # 设置页面
│── manifest.json       # MV3 配置
```

## ⚙️ 安装方法（开发者模式）

1. 下载或 clone 本项目
2. 打开 Chrome → 扩展程序
3. 开启 “开发者模式”
4. 选择 “加载已解压的扩展程序”
5. 指向项目目录即可加载

## 🔧 Notion 配置方法

1. 在 Notion 创建一个数据库

2. 添加以下字段：

   * Word（标题）
   * Meaning（富文本）
   * Sentence（富文本）
   * Source URL（URL）
   * Jump Back（URL）
   * Time（日期）

3. 右键扩展图标选择`打开侧边栏`，在扩展侧边设置页中填写：

   * Notion API Key
   * Database ID
   * 自动上传延迟（秒）
   * 是否上传无释义单词

## 🧠 工作流程说明

```
用户双击单词
     ↓
content.js 获取 word/sentence/url/xpath
     ↓
background.js 立即请求 Definer 释义
     ↓
加入上传队列并显示倒计时
     ↓
若倒计时结束 → 上传到 Notion
     ↓
Notion 中生成 Jump Back 链接
     ↓
用户从 Notion 点击“Jump Back”
     ↓
页面加载 → content.js 自动 XPath 定位 → 高亮词汇
```
