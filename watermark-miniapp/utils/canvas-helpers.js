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
 * 不修改主画布，直接导出原始内容（灰色半透明 + 透明涂抹区域）
 * 黑白转换交给后端处理，避免前端 Canvas 操作兼容性问题
 */
function exportMask(canvas, width, height, dpr, origWidth, origHeight, displayArea) {
  return new Promise((resolve) => {
    console.log('开始导出蒙版, canvas尺寸:', canvas.width, 'x', canvas.height);

    wx.canvasToTempFilePath({
      canvas: canvas,
      fileType: 'png',
      quality: 1,
      success: (res) => {
        console.log('蒙版已导出:', res.tempFilePath);
        resolve(res.tempFilePath);
      },
      fail: (err) => {
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