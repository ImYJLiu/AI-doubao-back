/**
 * Canvas 2D 工具函数
 */

/**
 * 初始化Canvas 2D上下文
 * @param {string} canvasId - canvas节点ID
 * @param {object} ctx - 页面this
 * @returns {Promise<{canvas, ctx, width, height, dpr}>}
 */
function initCanvas(canvasId, ctx) {
  return new Promise((resolve) => {
    const query = wx.createSelectorQuery().in(ctx);
    query.select(`#${canvasId}`)
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) {
          console.error('Canvas 节点获取失败');
          resolve(null);
          return;
        }

        const canvas = res[0].node;
        const dpr = wx.getSystemInfoSync().pixelRatio;
        const width = res[0].width;
        const height = res[0].height;

        // 设置物理像素尺寸
        canvas.width = width * dpr;
        canvas.height = height * dpr;

        const context = canvas.getContext('2d');
        // 缩放到 DPR，这样绘制时可以直接使用 CSS 坐标
        context.scale(dpr, dpr);

        console.log(`Canvas 初始化: CSS尺寸 ${width}x${height}, 物理尺寸 ${canvas.width}x${canvas.height}, DPR=${dpr}`);
        resolve({ canvas, ctx: context, width, height, dpr });
      });
  });
}

/**
 * 在canvas上绘制图片
 */
function drawImageOnCanvas(canvas, ctx, imagePath, x, y, width, height) {
  return new Promise((resolve) => {
    const img = canvas.createImage();
    img.onload = () => {
      ctx.drawImage(img, x, y, width, height);
      resolve();
    };
    img.src = imagePath;
  });
}

/**
 * 将触摸事件坐标转换为canvas内坐标
 * Canvas 2D 的 touch 事件中 x/y 已经是 canvas 内坐标，直接使用
 */
function getCanvasPos(touch, canvasRect) {
  return {
    x: touch.x,
    y: touch.y
  };
}

/**
 * 导出蒙版为 PNG 文件
 * 前端画布内容为：深紫色笔画（alpha>0）+ 透明区域（alpha=0）
 * 后端期望格式：灰色半透明区域（alpha>=64，保留）+ 透明区域（alpha<64，修复）
 * 因此导出时需要转换：有笔画→透明（修复），无笔画→灰色半透明（保留）
 */
function exportMask(canvas, width, height, dpr, origWidth, origHeight, displayArea) {
  return new Promise((resolve) => {
    console.log('开始导出蒙版, canvas尺寸:', canvas.width, 'x', canvas.height);

    const ctx = canvas.getContext('2d');
    const canvasW = canvas.width;
    const canvasH = canvas.height;

    // 1. 保存当前画布内容（深紫色笔画）
    const currentData = ctx.getImageData(0, 0, canvasW, canvasH);

    // 2. 创建导出用蒙版数据：笔画区域→透明，无笔画区域→灰色半透明
    const exportData = ctx.createImageData(canvasW, canvasH);
    for (let i = 0; i < currentData.data.length; i += 4) {
      const alpha = currentData.data[i + 3];
      if (alpha > 10) {
        // 有笔画（涂抹区域）→ 透明（后端识别为需修复区域）
        exportData.data[i] = 0;
        exportData.data[i + 1] = 0;
        exportData.data[i + 2] = 0;
        exportData.data[i + 3] = 0;
      } else {
        // 无笔画（未涂抹区域）→ 灰色半透明（后端识别为保留区域）
        exportData.data[i] = 128;
        exportData.data[i + 1] = 128;
        exportData.data[i + 2] = 128;
        exportData.data[i + 3] = 128;
      }
    }

    // 3. 临时替换画布内容为蒙版格式
    ctx.putImageData(exportData, 0, 0);

    // 4. 导出蒙版
    wx.canvasToTempFilePath({
      canvas: canvas,
      fileType: 'png',
      quality: 1,
      success: (res) => {
        // 5. 恢复当前画布内容
        ctx.putImageData(currentData, 0, 0);
        console.log('蒙版已导出:', res.tempFilePath);
        resolve(res.tempFilePath);
      },
      fail: (err) => {
        ctx.putImageData(currentData, 0, 0);
        console.error('蒙版导出失败:', err);
        resolve(null);
      }
    });
  });
}

module.exports = {
  initCanvas,
  drawImageOnCanvas,
  getCanvasPos,
  exportMask
};