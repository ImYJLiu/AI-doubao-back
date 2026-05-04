# Edit 页面涂抹功能逻辑文档

## 一、涂抹与画布

### 1.1 画笔样式
- 画布初始状态：透明（无灰蒙版）
- 画笔颜色：`rgba(126, 34, 206, 0.5)`（深紫色半透明）
- 合成模式：`source-over`
- 笔画区域 = 用户涂抹的水印区域

### 1.2 画布层级（从底到顶）
1. `<image src="{{imagePath || imageUrl}}">` — 底图（原图或上轮结果）
2. `<image src="{{previewResultUrl}}">` — AI结果叠加层（z-index: 5）
3. `<canvas>` — 画布（z-index: 10，透明底，紫色笔画）

### 1.3 页面锁定
- `disableSwipeBack: true` — 禁止iOS侧滑返回，防止涂抹时误触
- `disableScroll: true` — 禁止页面滚动

---

## 二、涂抹→预览流程

### 2.1 防抖触发
- 涂抹结束（onTouchEnd）后 300ms 自动触发 `triggerPreview`
- 用户继续涂抹时取消之前的防抖定时器

### 2.2 triggerPreview 执行顺序
1. 等待 `_baseImageUploadPromise`（确保 imageId 指向上轮结果）
2. 设置 `isPreviewing: true`（显示loading遮罩）
3. 导出蒙版（`exportMask` 读取画布紫色笔画，转换为后端格式）
4. **清除紫色笔画**（`ctx.clearRect`，避免透在loading遮罩上）
5. 调用 `api.createPreviewTask(imageId, maskPath)`
6. 同步成功 → `handlePreviewSuccess`
7. 异步等待 → `pollPreviewStatus`

### 2.3 蒙版格式转换（exportMask）
- 画布内容：紫色笔画（alpha>0）+ 透明区域（alpha=0）
- 后端期望：灰色半透明（alpha>=64，保留）+ 透明（alpha<64，修复）
- 转换规则：有笔画→透明（修复），无笔画→灰色半透明（保留）
- 导出时临时替换画布内容，导出后立即恢复

---

## 三、预览成功处理（handlePreviewSuccess）

### 3.1 执行顺序
1. 保存当前状态到 `resultUndoStack`（imageId, imageUrl, previewResultUrl）
2. 清空 `resultRedoStack`
3. 拼接完整结果URL
4. 设置 `previewStatus: 'SUCCESS'`，`previewResultUrl: fullResultUrl`
5. 更新按钮状态（确认保存）
6. 异步调用 `_uploadResultAsNewBase`

### 3.2 画布状态
- 画布已在 `triggerPreview` 中清除，此处不再清除
- `undoStack`/`redoStack` 不在此处清空

---

## 四、多轮涂抹：基于结果图迭代

### 4.1 核心原则
每轮AI处理基于**上一轮结果图**，而非原图。

### 4.2 流程
```
第1轮: 原图(imageId=1) + 笔画S1 → AI结果1
       ↓ _uploadResultAsNewBase: 上传结果1为新底图(imageId=2)
第2轮: 结果1(imageId=2) + 笔画S2 → AI结果2
       ↓ _uploadResultAsNewBase: 上传结果2为新底图(imageId=3)
第3轮: 结果2(imageId=3) + 笔画S3 → AI结果3
       ↓ 满意 → 确认保存
```

### 4.3 _uploadResultAsNewBase 执行内容
1. `wx.downloadFile` 下载结果图到临时文件
2. 用本地路径更新 `imagePath` 和 `previewResultUrl`（iOS兼容）
3. 缓存到 `_localPathCache[服务器URL] = 本地路径`
4. `api.uploadImage` 上传为新图片，获取新 imageId
5. 更新 `imageId` 和 `imageUrl`（服务器URL）

### 4.4 蒙版只需当前笔画
因为底图已是上轮结果，蒙版只需覆盖本轮新涂抹的区域，不需要累积历史笔画。

---

## 五、撤销/重做

### 5.1 双模式

| 状态 | 撤销/重做类型 | 数据来源 |
|------|--------------|---------|
| 预览成功（previewStatus==='SUCCESS'） | 结果图级 | resultUndoStack / resultRedoStack |
| 涂抹中 | 画布笔画级 | undoStack / redoStack |

### 5.2 结果图级撤销/重做

每个状态快照：`{ imageId, imageUrl, previewResultUrl }`

**撤销流程**（onUndo，预览成功时）：
1. 当前状态 push 到 `resultRedoStack`
2. 从 `resultUndoStack` pop 上一状态
3. 恢复 imageId, imageUrl, previewResultUrl
4. previewResultUrl 通过 `_localPathCache` 转换为本地路径
5. 如果上一状态的 previewResultUrl 为空 → 回到原图

**重做流程**（onRedo，预览成功时）：反向操作

**示例**：
```
初始 → resultUndoStack: []
涂抹+预览1 → resultUndoStack: [{原图}]，显示结果1
涂抹+预览2 → resultUndoStack: [{原图}, {结果1}]，显示结果2
点撤销 → resultUndoStack: [{原图}]，显示结果1，可重做
再点撤销 → resultUndoStack: []，显示原图，可重做
点重做 → resultUndoStack: [{原图}]，显示结果1
```

### 5.3 画布笔画级撤销/重做
- onTouchStart 时保存当前画布到 undoStack
- onUndo：当前状态→redoStack，pop undoStack 恢复
- onRedo：当前状态→undoStack，pop redoStack 恢复

### 5.4 栈的清空时机
- `resultRedoStack`：onTouchStart（开始新涂抹时清空，旧重做路径作废）
- `undoStack/redoStack`：handlePreviewSuccess 中的笔画级栈不需要在此清空（已在 triggerPreview 中清画布）

---

## 六、iOS 图片渲染兼容

### 6.1 问题
iOS 的 `<image>` 组件受 ATS 限制，无法渲染 HTTP 协议图片（`http://192.168.x.x:8080/...`），且不报错。

### 6.2 解决方案
所有 `<image>` 的 src 必须使用本地文件路径：

| 场景 | 本地路径来源 |
|------|------------|
| 原图 | `imagePath`（wx.chooseMedia 返回的临时文件） |
| 结果图 | `_uploadResultAsNewBase` 中 wx.downloadFile 的 tempFilePath |

### 6.3 _localPathCache
```
服务器URL → 本地文件路径
```
撤销/重做恢复状态时，用此缓存将服务器URL转换为本地路径用于显示。

### 6.4 后端 ImageService
返回 `fullImageUrl` 时动态获取请求的 host（`RequestContextHolder`），不再硬编码 `localhost`。

---

## 七、UI 状态与按钮

### 7.1 按钮状态（updateBtnState）

| 条件 | 按钮文字 | 按钮样式 | canUndo | canRedo |
|------|---------|---------|---------|---------|
| processing | 处理中... | loading | false | false |
| isPreviewing | 预览生成中... | loading | false | false |
| previewSuccess + resultUrl | 确认保存 | confirm | resultUndoStack.length>0 | resultRedoStack.length>0 |
| hasStrokes | 预览生成中... | loading | undoStack.length>0 | redoStack.length>0 |
| 无笔画 | 请先涂抹水印区域 | disabled | false | false |

### 7.2 预览成功后继续涂抹
- onTouchStart 时：保留 previewResultUrl（结果图可见），重置 previewStatus
- 清空 resultRedoStack（新涂抹产生新结果，旧重做路径作废）

### 7.3 清空（onClear）
- 清除画布笔画
- 清除预览结果（回到当前底图）
- 不清除 resultUndoStack（仍可撤销回之前的结果图）

---

## 八、loading 遮罩

- 触发条件：`processing || isPreviewing`
- 预览中标题：AI预览生成中
- 处理中标题：AI处理中
