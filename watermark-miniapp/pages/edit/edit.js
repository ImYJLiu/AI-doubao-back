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
    previewLoaded: false,
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

  // 画布笔画级撤销重做（涂抹过程中使用）
  undoStack: [],
  redoStack: [],
  currentStroke: null,

  // 结果图级撤销重做（预览成功后使用，存储状态快照）
  resultUndoStack: [],
  resultRedoStack: [],

  imageWidth: 0,
  imageHeight: 0,

  // 下一轮底图上传 Promise（预览成功后异步上传结果图，下一轮涂抹基于该结果）
  _baseImageUploadPromise: null,

  // 服务器URL→本地文件路径缓存（iOS不支持HTTP图片渲染，必须用本地文件显示）
  _localPathCache: {},

  onLoad(options) {
    const imageId = options.imageId || '';
    const imageUrl = options.imageUrl ? decodeURIComponent(options.imageUrl) : decodeURIComponent(options.imagePath || '');
    this.setData({
      imageId,
      imagePath: decodeURIComponent(options.imagePath || ''),
      imageUrl
    });
    // 保存初始状态快照（原图），用于结果图级撤销的基点
    this._initialState = { imageId, imageUrl, previewResultUrl: '' };
    // 进入编辑页时同步最新积分
    this.syncCredits();
  },

  async syncCredits() {
    try {
      const res = await api.getCreditsInfo();
      if (res.code === 0) {
        const app = getApp();
        app.globalData.credits = res.data.credits || 0;
      }
    } catch (e) {
      // 忽略，使用本地缓存的值
    }
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

    // 画布保持透明，涂抹时直接绘制深紫色画笔
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

  /**
   * 预览结果图加载完成，淡入显示
   */
  onPreviewImageLoad() {
    this.setData({ previewLoaded: true });
  },

  /**
   * 图片加载失败（排查iOS不渲染问题）
   */
  onImageError(e) {
    console.error('图片加载失败:', e.detail);
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
      text = '预览生成中...';
      cls = 'loading';
    }

    // 撤销/重做模式：结果图栈有内容时走结果图级，否则走笔画级
    const hasResultHistory = this.resultUndoStack.length > 0 || this.resultRedoStack.length > 0;
    let canUndo, canRedo;
    if (hasResultHistory) {
      canUndo = this.resultUndoStack.length > 0 && !processing && !isPreviewing;
      canRedo = this.resultRedoStack.length > 0 && !processing && !isPreviewing;
    } else {
      canUndo = hasStrokes && !processing && !isPreviewing;
      canRedo = this.redoStack.length > 0 && !processing && !isPreviewing;
    }

    this.setData({
      processBtnText: text,
      processBtnClass: cls,
      canUndo,
      canRedo,
      canClear: (hasStrokes || previewSuccess) && !processing && !isPreviewing
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

    // 预览成功后用户继续涂抹：保留结果图，仅重置预览状态
    if (this.data.isPreviewing) {
      this.setData({ isPreviewing: false, previewTaskId: null });
      this.updateBtnState();
    }
    if (this.data.previewStatus === 'SUCCESS') {
      // 不重置 previewResultUrl，结果图保持可见
      this.setData({ previewStatus: '', previewLoaded: false, previewTaskId: null });
      // 开始新涂抹，旧的结果图重做路径作废，笔画栈清零
      this.resultRedoStack = [];
      this.undoStack = [];
      this.redoStack = [];
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

    // 用深紫色画笔涂抹水印区域
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.lineWidth = this.data.brushSize;
    this.ctx.strokeStyle = 'rgba(126, 34, 206, 0.5)';
    this.ctx.fillStyle = 'rgba(126, 34, 206, 0.5)';

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
    }, 300);
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
    if (this.data.processing || this.data.isPreviewing) return;

    // 结果图栈有内容时走结果图级，否则走笔画级
    const hasResultHistory = this.resultUndoStack.length > 0 || this.resultRedoStack.length > 0;

    if (hasResultHistory) {
      // 结果图级撤销：回到上一轮结果图（或原图）
      if (this.resultUndoStack.length === 0) return;
      // 保存当前结果状态到重做栈
      this.resultRedoStack.push({
        imageId: this.data.imageId,
        imageUrl: this.data.imageUrl,
        previewResultUrl: this.data.previewResultUrl,
        imagePath: this.data.imagePath,
        previewTaskId: this.data.previewTaskId
      });
      const prevState = this.resultUndoStack.pop();
      // 恢复上一个结果状态
      this.ctx.clearRect(0, 0, this.data.canvasW, this.data.canvasH);
      this.undoStack = [];
      this.redoStack = [];
      const localResultUrl = prevState.previewResultUrl && this._localPathCache[prevState.previewResultUrl]
        ? this._localPathCache[prevState.previewResultUrl]
        : prevState.previewResultUrl;
      this.setData({
        imageId: prevState.imageId,
        imageUrl: prevState.imageUrl,
        imagePath: prevState.imagePath,
        previewResultUrl: localResultUrl,
        previewStatus: prevState.previewResultUrl ? 'SUCCESS' : '',
        previewLoaded: !!prevState.previewResultUrl,
        previewTaskId: prevState.previewTaskId || null
      });
      this.updateBtnState();
      console.log('结果图撤销, 回到:', prevState.previewResultUrl || '原图');
    } else {
      // 画布笔画级撤销
      if (this.undoStack.length === 0) return;
      const w = this.canvas.width;
      const h = this.canvas.height;
      const currentState = this.ctx.getImageData(0, 0, w, h);
      this.redoStack.push(currentState);
      const prevState = this.undoStack.pop();
      this.restoreCanvasState(prevState);
      this.updateBtnState();
    }
  },

  onRedo() {
    if (this.data.processing || this.data.isPreviewing) return;

    // 结果图栈有内容时走结果图级，否则走笔画级
    const hasResultHistory = this.resultUndoStack.length > 0 || this.resultRedoStack.length > 0;

    if (hasResultHistory) {
      // 结果图级重做：前进到下一轮结果图
      if (this.resultRedoStack.length === 0) return;
      // 保存当前结果状态到撤销栈
      this.resultUndoStack.push({
        imageId: this.data.imageId,
        imageUrl: this.data.imageUrl,
        previewResultUrl: this.data.previewResultUrl,
        imagePath: this.data.imagePath,
        previewTaskId: this.data.previewTaskId
      });
      const nextState = this.resultRedoStack.pop();
      // 恢复下一个结果状态
      this.ctx.clearRect(0, 0, this.data.canvasW, this.data.canvasH);
      this.undoStack = [];
      this.redoStack = [];
      const localResultUrl = nextState.previewResultUrl && this._localPathCache[nextState.previewResultUrl]
        ? this._localPathCache[nextState.previewResultUrl]
        : nextState.previewResultUrl;
      this.setData({
        imageId: nextState.imageId,
        imageUrl: nextState.imageUrl,
        imagePath: nextState.imagePath,
        previewResultUrl: localResultUrl,
        previewStatus: nextState.previewResultUrl ? 'SUCCESS' : '',
        previewLoaded: !!nextState.previewResultUrl,
        previewTaskId: nextState.previewTaskId || null
      });
      this.updateBtnState();
      console.log('结果图重做, 前进到:', nextState.previewResultUrl || '原图');
    } else {
      // 画布笔画级重做
      if (this.redoStack.length === 0) return;
      const w = this.canvas.width;
      const h = this.canvas.height;
      const currentState = this.ctx.getImageData(0, 0, w, h);
      this.undoStack.push(currentState);
      const nextState = this.redoStack.pop();
      this.restoreCanvasState(nextState);
      this.updateBtnState();
    }
  },

  onClear() {
    if (this.data.processing || this.data.isPreviewing) return;
    if (this.undoStack.length === 0 && this.data.previewStatus !== 'SUCCESS') return;

    // 清空画布笔画
    this.ctx.clearRect(0, 0, this.data.canvasW, this.data.canvasH);
    this.undoStack = [];
    this.redoStack = [];
    // 清除预览结果，回到当前底图（不清除结果图历史，仍可撤销回之前的结果）
    this.setData({ previewResultUrl: '', previewStatus: '', previewLoaded: false, previewTaskId: null });
    this.updateBtnState();
  },

  /**
   * 预览成功处理：清旧笔画，结果图保持可见，异步上传结果图为下一轮底图
   */
  handlePreviewSuccess(resultUrl) {
    // 保存当前状态到结果图撤销栈（预览成功前的底图状态）
    this.resultUndoStack.push({
      imageId: this.data.imageId,
      imageUrl: this.data.imageUrl,
      previewResultUrl: this.data.previewResultUrl,
      imagePath: this.data.imagePath,
      previewTaskId: this.data.previewTaskId
    });
    this.resultRedoStack = [];

    // 拼接完整 URL
    const fullResultUrl = resultUrl && !resultUrl.startsWith('http')
      ? getApp().globalData.baseUrl + resultUrl
      : resultUrl;

    this.setData({ isPreviewing: false });
    this.updateBtnState();

    // 异步下载到本地路径后再显示，避免真机无法直接加载局域网图片
    this._baseImageUploadPromise = this._uploadResultAsNewBase(fullResultUrl);
  },

  /**
   * 将结果图下载到本地后显示，并上传为新底图
   */
  async _uploadResultAsNewBase(resultUrl) {
    try {
      const localPath = await api.downloadToLocal(resultUrl);
      this._localPathCache[resultUrl] = localPath;

      this.setData({
        imagePath: localPath,
        previewResultUrl: localPath,
        previewStatus: 'SUCCESS',
        previewLoaded: false
      });
      this.updateBtnState();
      wx.showToast({ title: '预览完成', icon: 'success' });

      const res = await api.uploadImage(localPath);
      if (res.code === 0) {
        this.setData({ imageId: res.data.imageId, imageUrl: resultUrl });
      }
    } catch (e) {
      console.error('下载/上传结果图失败:', e);
      wx.showToast({ title: '预览加载失败，请重试', icon: 'none' });
    } finally {
      this._baseImageUploadPromise = null;
    }
  },

  /**
   * 触发预览（防抖后调用）
   */
  async triggerPreview() {
    if (this.data.isPreviewing) return;  // 防止重复调用

    // 等待结果图上传完成（确保 imageId 指向上一轮结果而非原图）
    if (this._baseImageUploadPromise) {
      await this._baseImageUploadPromise;
    }

    this.setData({ isPreviewing: true });
    this.updateBtnState();
    
    console.log('开始触发预览, imageId:', this.data.imageId);
    
    try {
      // 导出蒙版（仅当前笔画，因为底图已是上一轮结果）
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

      // 蒙版已导出，清除紫色笔画（避免透在 loading 遮罩上）
      this.ctx.clearRect(0, 0, this.data.canvasW, this.data.canvasH);
      
      // 确保 imageId 有效
      let imageId = this.data.imageId;
      if (!imageId) {
        wx.showToast({ title: '正在准备...', icon: 'loading' });
        const uploadRes = await api.uploadImage(this.data.imagePath);
        imageId = uploadRes.data.imageId;
        this.setData({ imageId });
      }
      
      // 创建预览任务
      const res = await api.createPreviewTask(imageId, maskPath);
      
      if (res.code === 0) {
        this.setData({ previewTaskId: res.data.taskId });

        // 后端同步返回成功，直接展示结果
        if (res.data.status === 'SUCCESS' && res.data.resultUrl) {
          this.handlePreviewSuccess(res.data.resultUrl);
          return;
        }

        // 否则轮询等待结果
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
    const maxPolls = 30;
    const expectedTaskId = this.data.previewTaskId;
    
    const poll = () => {
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
            this.handlePreviewSuccess(resultUrl);
            return;
          }
          
          if (status === 'FAILED') {
            wx.showToast({ title: '处理失败，请重新涂抹', icon: 'none' });
            this.setData({ isPreviewing: false });
            this.updateBtnState();
            return;
          }
          
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
      // 导出蒙版（仅当前笔画）
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
    this.resultUndoStack = [];
    this.resultRedoStack = [];
    
    // 清理定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
});