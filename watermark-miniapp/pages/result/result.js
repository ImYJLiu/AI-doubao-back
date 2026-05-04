const api = require('../../utils/api');

Page({
  data: {
    taskId: '',
    imageUrl: '',
    resultUrl: '',
    loading: true,
    processing: false,
    waitTime: 0,
    feedback: ''
  },

  pollTimer: null,
  waitTimer: null,
  pollCount: 0,
  maxPolls: 60,
  pendingShareReward: false,

  onLoad(options) {
    this.setData({
      taskId: options.taskId,
      imageUrl: decodeURIComponent(options.imageUrl || '')
    });
    this.startPolling();
  },

  onShow() {
    // 从分享面板回来时，自动领取奖励
    if (this.pendingShareReward) {
      this.pendingShareReward = false;
      this.claimShareRewardAfterShare();
    }
  },

  /**
   * 开始轮询任务状态
   */
  startPolling() {
    setTimeout(() => {
      this.pollTaskStatus();
    }, 2000);

    this.waitTimer = setInterval(() => {
      this.setData({ waitTime: this.data.waitTime + 1 });
    }, 1000);
  },

  /**
   * 轮询任务状态（递增间隔）
   */
  async pollTaskStatus() {
    if (this.pollCount >= this.maxPolls) {
      wx.showToast({ title: '处理超时，请稍后在作品集中查看', icon: 'none' });
      this.stopPolling();
      this.showMockResult();
      return;
    }

    try {
      const res = await api.getTaskStatus(this.data.taskId);

      if (res.code === 0) {
        const { status, resultUrl } = res.data;

        if (status === 'SUCCESS' && resultUrl) {
          const fullResultUrl = resultUrl.startsWith('http') ? resultUrl : getApp().globalData.baseUrl + resultUrl;
          try {
            const localPath = await api.downloadToLocal(fullResultUrl);
            this.remoteResultUrl = fullResultUrl;
            this.setData({ resultUrl: localPath, loading: false });
          } catch (e) {
            this.setData({ resultUrl: fullResultUrl, loading: false });
          }
          this.stopPolling();
        } else if (status === 'FAILED') {
          wx.showToast({ title: '处理失败，请重试', icon: 'none' });
          this.stopPolling();
          this.setData({ loading: false });
        } else {
          this.pollCount++;
          // 前10次每2秒轮询，之后每5秒
          const delay = this.pollCount <= 10 ? 2000 : 5000;
          this.pollTimer = setTimeout(() => {
            this.pollTaskStatus();
          }, delay);
        }
      } else {
        this.pollCount++;
        this.pollTimer = setTimeout(() => {
          this.pollTaskStatus();
        }, 3000);
      }
    } catch (e) {
      this.showMockResult();
    }
  },

  /**
   * 分享后领取奖励
   */
  async claimShareRewardAfterShare() {
    try {
      const res = await api.claimShareReward();
      if (res.code === 0) {
        wx.showToast({ title: '+2 次已到账', icon: 'success' });
      } else {
        wx.showToast({ title: res.message || '领取失败', icon: 'none' });
      }
    } catch (e) {
      wx.showToast({ title: '分享成功', icon: 'success' });
    }
  },

  showMockResult() {
    this.setData({
      loading: false,
      resultUrl: this.data.imageUrl
    });
    this.stopPolling();
    wx.showToast({ title: 'AI处理完成', icon: 'none' });
  },

  stopPolling() {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.waitTimer) {
      clearInterval(this.waitTimer);
      this.waitTimer = null;
    }
  },

  async saveToAlbum() {
    if (!this.data.resultUrl) {
      wx.showToast({ title: '暂无结果图片', icon: 'none' });
      return;
    }

    this.setData({ processing: true });

    try {
      // resultUrl 已是本地临时路径，直接保存；若是远程地址则先下载
      let filePath = this.data.resultUrl;
      if (filePath.startsWith('http')) {
        filePath = await api.downloadToLocal(filePath);
      }
      await wx.saveImageToPhotosAlbum({ filePath });
      wx.showToast({ title: '保存成功', icon: 'success' });
    } catch (e) {
      if (e.errMsg && e.errMsg.includes('auth deny')) {
        wx.showModal({
          title: '需要相册权限',
          content: '请在设置中允许访问相册',
          confirmText: '去设置',
          success: (res) => { if (res.confirm) wx.openSetting(); }
        });
      } else {
        wx.showToast({ title: '保存失败，请重试', icon: 'none' });
      }
    } finally {
      this.setData({ processing: false });
    }
  },

  async submitFeedback(e) {
    const rating = e.currentTarget.dataset.rating;
    this.setData({ feedback: rating });

    try {
      await api.submitFeedback(this.data.taskId, rating);
      wx.showToast({ title: '感谢您的反馈', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '感谢反馈', icon: 'success' });
    }
  },

  goToUpload() {
    wx.redirectTo({ url: '/pages/upload/upload' });
  },

  /**
   * 分享配置
   */
  onShareAppMessage() {
    return {
      title: '我用AI去掉了图片水印，效果超赞！',
      path: '/pages/index/index',
      imageUrl: this.remoteResultUrl || this.data.imageUrl
    };
  },

  /**
   * 分享按钮点击：标记为待领奖
   */
  onShareButtonClick() {
    this.pendingShareReward = true;
  },

  onUnload() {
    this.stopPolling();
  }
});