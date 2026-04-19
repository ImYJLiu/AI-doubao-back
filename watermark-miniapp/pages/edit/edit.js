const api = require('../../utils/api');
const canvasHelper = require('../../utils/canvas-helpers');

Page({
  data: {
    imageId: '',
    imagePath: '',
    imageUrl: '',
    brushSize: 20,
    activeTool: 'brush',
    canUndo: false,
    canRedo: false,
    canClear: false,
    processing: false,
    canvasW: 300,
    canvasH: 450,
    // 预览相关
    previewTaskId: null,
    previewStatus: '',
    previewResultUrl: '',
    isPreviewing: false,
    // 按钮状态
    processBtnText: '请先涂抹水印区域',
    processBtnClass: 'disabled'
  },

  canvas: null,
  ctx: null,
  canvasRect: null,
  isDrawing: false,
  lastX: 0,
  lastY: 0,
  debounceTimer: null,

  // 撤销重做：直接存储对象引用（不 JSON 序列化）
  undoStack: [],
  redoStack: [],
  currentStroke: null,

  imageWidth: 0,
  imageHeight: 0,

  onLoad(options) {
    this.setData({
      imageId: options.imageId || '',
      imagePath: decodeURIComponent(options.imagePath || ''),
      imageUrl: options.imageUrl ? decodeURIComponent(options.imageUrl) : decodeURIComponent(options.imagePath || '')
    });
  },

  async onReady() {
    const { canvas, ctx, width, height } = await canvasHelper.initCanvas('mask-canvas', this);
    this.canvas = canvas;
    this.ctx = ctx;
    this.setData({ canvasW: width, canvasH: height });

    // 获取 canvas 的实际位置，用于坐标转换
    const query = wx.createSelectorQuery().in(this);
    query.select('#mask-canvas').boundingClientRect((rect) => {
      this.canvasRect = rect;
      console.log('Canvas 位置:', rect);
    }).exec();

    // 初始化灰色蒙版（覆盖整个画布）
    this.initGrayMask();
  },

  /**
   * 初始化灰色蒙版层（覆盖整个画布）
   */
  initGrayMask() {
    if (!this.ctx) return;
    
    const w = this.data.canvasW;
    const h = this.data.canvasH;
    
    // 填充整个画布为灰色半透明
    this.ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
    this.ctx.fillRect(0, 0, w, h);
    
    console.log('灰色蒙版已初始化，画布尺寸:', w, h);
  },

  onImageLoad(e) {
    this.imageWidth = e.detail.width;
    this.imageHeight = e.detail.height;
    
    // 计算图片在 Canvas 中的实际显示区域（aspectFit 模式）
    const canvasW = this.data.canvasW;
    const canvasH = this.data.canvasH;
    const imgW = e.detail.width;
    const imgH = e.detail.height;
    
    // aspectFit: 保持宽高比，完整显示图片
    const scale = Math.min(canvasW / imgW, canvasH / imgH);
    this.imageDisplayWidth = imgW * scale;
    this.imageDisplayHeight = imgH * scale;
    this.imageDisplayX = (canvasW - this.imageDisplayWidth) / 2;
    this.imageDisplayY = (canvasH - this.imageDisplayHeight) / 2;
    
    console.log('图片加载完成，显示区域:', {
      x: this.imageDisplayX,
      y: this.imageDisplayY,
      w: this.imageDisplayWidth,
      h: this.imageDisplayHeight
    });
    
  },

  // ====== 工具 & 笔刷 ======

  switchTool(e) {
    const tool = e.currentTarget.dataset.tool;
    if (tool) {
      this.setData({ activeTool: tool });
    }
  },

  onBrushSizeChange(e) {
    this.setData({ brushSize: e.detail.value });
  },

  updateBtnState() {
    const hasStrokes = this.undoStack.length > 0;
    const previewSuccess = this.data.previewStatus === 'SUCCESS';
    const isPreviewing = this.data.isPreviewing;
    const processing = this.data.processing;

    let text = '请先涂抹水印区域';
    let cls = 'disabled';

    if (processing) {
      text = '处理中...';
      cls = 'loading';
    } else if (isPreviewing) {
      text = '预览生成中...';
      cls = 'loading';
    } else if (previewSuccess && this.data.previewResultUrl) {
      text = '确认保存';
      cls = 'confirm';
    } else if (hasStrokes) {
      text = '涂抹完成，等待预览';
      cls = '';
    }

    this.setData({
      processBtnText: text,
      processBtnClass: cls,
      canUndo: hasStrokes && !processing && !isPreviewing,
      canRedo: this.redoStack.length > 0 && !processing && !isPreviewing,
      canClear: hasStrokes && !processing && !isPreviewing
    });
  },

  // ====== 触摸绘制 ======

  onTouchStart(e) {
    if (this.data.processing || this.data.activeTool !== 'brush') return;

    // 清除之前的防抖定时器（用户继续涂抹，取消上次预览触发）
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // 如果正在预览，取消状态
    if (this.data.isPreviewing) {
      this.setData({ isPreviewing: false });
      this.updateBtnState();
    }

    const touch = e.touches[0];
    this.isDrawing = true;
    this.lastX = touch.x;
    this.lastY = touch.y;

    // 保存当前画布状态到撤销栈（在开始新笔画之前）
    this.saveCanvasState();

    // 清空重做栈
    this.redoStack = [];

    // 用 destination-out 擦除灰色蒙版，使涂抹区域变透明
    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.lineWidth = this.data.brushSize;
    this.ctx.strokeStyle = 'rgba(255,255,255,1)';

    // 画一个点（处理单击不拖动的情况）
    this.ctx.beginPath();
    this.ctx.arc(this.lastX, this.lastY, this.data.brushSize / 2, 0, Math.PI * 2);
    this.ctx.fill();
  },

  onTouchMove(e) {
    if (!this.isDrawing || !this.ctx) return;

    const touch = e.touches[0];
    const x = touch.x;
    const y = touch.y;

    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();

    this.lastX = x;
    this.lastY = y;
  },

  onTouchEnd() {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    // 恢复合成模式
    this.ctx.globalCompositeOperation = 'source-over';

    this.updateBtnState();

    // 防抖触发预览（涂抹结束 1.5 秒后自动触发）
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.triggerPreview();
    }, 1500);
  },

  // ====== 撤销 / 重做 / 清空 ======

  saveCanvasState() {
    if (!this.canvas) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const imageData = this.ctx.getImageData(0, 0, w, h);
    this.undoStack.push(imageData);
    // 限制撤销栈大小
    if (this.undoStack.length > 20) {
      this.undoStack.shift();
    }
  },

  restoreCanvasState(imageData) {
    if (!this.ctx || !imageData) return;
    this.ctx.putImageData(imageData, 0, 0);
  },

  onUndo() {
    if (this.undoStack.length === 0 || this.data.processing || this.data.isPreviewing) return;

    // 保存当前状态到重做栈
    const w = this.canvas.width;
    const h = this.canvas.height;
    const currentState = this.ctx.getImageData(0, 0, w, h);
    this.redoStack.push(currentState);

    // 恢复上一个状态
    const prevState = this.undoStack.pop();
    this.restoreCanvasState(prevState);

    this.updateBtnState();
  },

  onRedo() {
    if (this.redoStack.length === 0 || this.data.processing || this.data.isPreviewing) return;

    // 保存当前状态到撤销栈
    const w = this.canvas.width;
    const h = this.canvas.height;
    const currentState = this.ctx.getImageData(0, 0, w, h);
    this.undoStack.push(currentState);

    // 恢复下一个状态
    const nextState = this.redoStack.pop();
    this.restoreCanvasState(nextState);

    this.updateBtnState();
  },

  onClear() {
    if (this.undoStack.length === 0 || this.data.processing || this.data.isPreviewing) return;

    // 保存当前状态，以便撤销清空操作
    this.saveCanvasState();
    this.redoStack = [];

    // 重新初始化灰色蒙版（相当于清空所有涂抹）
    this.initGrayMask();

    // 清空后重置撤销栈（只保留清空前的那一个状态）
    this.updateBtnState();
  },

  /**
   * 触发预览（防抖后调用）
   */
  async triggerPreview() {
    if (this.data.isPreviewing) return;  // 防止重复调用
    this.setData({ isPreviewing: true });
    this.updateBtnState();
    
    console.log('开始触发预览...');
    
    try {
      // 导出蒙版（只裁剪图片显示区域）
      const maskPath = await canvasHelper.exportMask(
        this.canvas,
        this.data.canvasW,
        this.data.canvasH,
        wx.getSystemInfoSync().pixelRatio,
        this.imageWidth,
        this.imageHeight,
        {
          x: this.imageDisplayX,
          y: this.imageDisplayY,
          w: this.imageDisplayWidth,
          h: this.imageDisplayHeight
        }
      );
      
      if (!maskPath) throw new Error('蒙版导出失败');
      
      // 确保 imageId 有效（URL参数传入的是字符串如"42"，有效则直接用）
      let imageId = this.data.imageId;
      if (!imageId) {
        wx.showToast({ title: '正在准备...', icon: 'loading' });
        const uploadRes = await api.uploadImage(this.data.imagePath);
        imageId = uploadRes.data.imageId;
        this.setData({ imageId });
      }
      
      // 创建预览任务（不扣积分）
      const res = await api.createPreviewTask(imageId, maskPath);
      
      if (res.code === 0) {
        console.log('预览任务创建成功:', res.data.taskId);
        this.setData({
          previewTaskId: res.data.taskId,
          previewStatus: res.data.status,
          previewResultUrl: res.data.resultUrl || ''
        });
        
        // 开始轮询预览状态
        this.pollPreviewStatus();
      }
    } catch (e) {
      console.error('预览失败:', e);
      wx.showToast({ title: '预览失败，请重试', icon: 'none' });
      this.setData({ isPreviewing: false });
      this.updateBtnState();
    }
  },

  /**
   * 轮询预览状态
   */
  pollPreviewStatus() {
    let pollCount = 0;
    const maxPolls = 30; // 最多 60 秒（30 * 2s）
    const expectedTaskId = this.data.previewTaskId;
    
    const poll = () => {
      // 如果任务已更改（用户重新涂抹），停止旧轮询
      if (this.data.previewTaskId !== expectedTaskId) {
        console.log('任务已更新，停止旧轮询');
        return;
      }
      
      if (pollCount >= maxPolls) {
        wx.showToast({ title: '处理超时，请重试', icon: 'none' });
        this.setData({ isPreviewing: false });
        this.updateBtnState();
        return;
      }
      
      api.getTaskStatus(this.data.previewTaskId).then(res => {
        if (res.code === 0) {
          const { status, resultUrl } = res.data;
          
          this.setData({
            previewStatus: status,
            previewResultUrl: resultUrl || ''
          });
          
          if (status === 'SUCCESS') {
            // 预览完成
            this.setData({ isPreviewing: false });
            this.updateBtnState();
            wx.showToast({ title: '预览完成，点击「确认保存」', icon: 'success' });
            console.log('预览完成:', resultUrl);
            return;
          }
          
          if (status === 'FAILED') {
            wx.showToast({ title: '处理失败，请重新涂抹', icon: 'none' });
            this.setData({ isPreviewing: false });
            this.updateBtnState();
            return;
          }
          
          // 继续轮询
          pollCount++;
          console.log(`轮询中... (${pollCount}/${maxPolls}) 状态: ${status}`);
          setTimeout(poll, 2000);
        }
      }).catch(err => {
        console.error('轮询失败:', err);
        this.setData({ isPreviewing: false });
        this.updateBtnState();
      });
    };
    
    // 2 秒后开始第一次轮询
    setTimeout(poll, 2000);
  },

  /**
   * 确认保存（扣除积分）
   */
  async onConfirm() {
    if (this.data.processing) return;
    
    // 如果没有预览任务，走原有逻辑
    if (!this.data.previewTaskId) {
      return this.onProcess();
    }
    
    // 检查预览是否完成
    if (this.data.previewStatus !== 'SUCCESS') {
      wx.showToast({ title: '请等待预览完成', icon: 'none' });
      return;
    }
    
    const app = getApp();
    
    // 检查积分
    if (app.globalData.credits <= 0) {
      wx.showModal({
        title: '次数不足',
        content: '您的使用次数已用完，请前往任务中心获取次数',
        confirmText: '去领取',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/rewards/rewards' });
          }
        }
      });
      return;
    }
    
    this.setData({ processing: true });
    this.updateBtnState();
    
    try {
      // 确认任务（扣除积分）
      const res = await api.confirmTask(this.data.previewTaskId);
      
      if (res.code === 0) {
        // 扣除积分
        app.updateCredits(-1);
        
        // 跳转到结果页
        wx.redirectTo({
          url: `/pages/result/result?taskId=${this.data.previewTaskId}&imageUrl=${encodeURIComponent(this.data.imageUrl)}`
        });
      } else {
        throw new Error(res.message || '确认失败');
      }
    } catch (e) {
      console.error('确认失败:', e);
      wx.showToast({ title: e.message || '确认失败', icon: 'none' });
      this.setData({ processing: false });
      this.updateBtnState();
    }
  },

  /**
   * 处理图片（兼容旧逻辑）
   */
  async onProcess() {
    if (this.data.processing) return;
    if (this.undoStack.length === 0) {
      wx.showToast({ title: '请先涂抹水印区域', icon: 'none' });
      return;
    }

    const app = getApp();
    if (app.globalData.credits <= 0) {
      wx.showModal({
        title: '次数不足',
        content: '您的使用次数已用完，请前往任务中心获取次数',
        confirmText: '去领取',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/rewards/rewards' });
          }
        }
      });
      return;
    }

    this.setData({ processing: true });
    this.updateBtnState();

    try {
      // 导出蒙版（不破坏原始画布）
      const maskPath = await canvasHelper.exportMask(
        this.canvas,
        this.data.canvasW,
        this.data.canvasH,
        wx.getSystemInfoSync().pixelRatio,
        this.imageWidth,
        this.imageHeight,
        {
          x: this.imageDisplayX,
          y: this.imageDisplayY,
          w: this.imageDisplayWidth,
          h: this.imageDisplayHeight
        }
      );

      if (!maskPath) {
        throw new Error('蒙版导出失败');
      }

      // 确保 imageId 有效
      let imageId = this.data.imageId;
      if (!imageId) {
        wx.showToast({ title: '正在准备...', icon: 'loading' });
        const uploadRes = await api.uploadImage(this.data.imagePath);
        imageId = uploadRes.data.imageId;
      }

      // 提交任务
      const res = await api.createTask(imageId, maskPath);

      if (res.code === 0) {
        const taskId = res.data.taskId;
        const imageUrl = this.data.imageUrl;

        // API 成功后再更新本地次数
        app.updateCredits(-1);

        wx.redirectTo({
          url: `/pages/result/result?taskId=${taskId}&imageUrl=${encodeURIComponent(imageUrl)}`
        });
      } else {
        throw new Error(res.message || '创建任务失败');
      }
    } catch (e) {
      console.error('处理失败:', e);
      wx.showToast({ title: e.message || '处理失败', icon: 'none' });
      this.setData({ processing: false });
      this.updateBtnState();
    }
  },

  onClose() {
    wx.navigateBack();
  },

  showComingSoon() {
    wx.showToast({ title: '即将上线', icon: 'none' });
  },

  onUnload() {
    this.isDrawing = false;
    this.currentStroke = null;
    this.undoStack = [];
    this.redoStack = [];
    
    // 清理定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
});