const api = require('../../utils/api');

Page({
  data: {
    credits: 0,
    barPercent: 100,
    adWatching: false,
    adCountdown: 15
  },

  videoAd: null,
  adTimer: null,
  adFallbackUsed: false,

  onLoad() {
    this.initRewardedVideoAd();
  },

  onShow() {
    this.refreshCredits();
  },

  /**
   * 初始化微信激励视频广告
   */
  initRewardedVideoAd() {
    if (typeof wx.createRewardedVideoAd === 'function') {
      this.videoAd = wx.createRewardedVideoAd({
        adUnitId: '' // 用户在微信小程序后台创建广告位后填入
      });

      this.videoAd.onClose((res) => {
        this.setData({ adWatching: false });
        if (res && res.isEnded) {
          this.finishAd();
        } else {
          wx.showToast({ title: '需完整观看才能获得奖励', icon: 'none' });
        }
      });

      this.videoAd.onError((err) => {
        console.error('广告加载失败:', err);
        this.setData({ adWatching: false });
      });
    }
  },

  async refreshCredits() {
    try {
      const res = await api.getCreditsInfo();
      if (res.code === 0) {
        const credits = res.data.credits || 0;
        const maxCredits = 3;
        this.setData({
          credits,
          barPercent: Math.min(100, (credits / maxCredits) * 100)
        });
      }
    } catch (e) {
      const app = getApp();
      const credits = app.globalData.credits;
      this.setData({
        credits,
        barPercent: Math.min(100, (credits / 3) * 100)
      });
    }
  },

  /**
   * 观看广告（优先使用真实广告，fallback 到模拟）
   */
  async watchAd() {
    if (this.data.adWatching) return;

    // 尝试显示真实激励视频广告
    if (this.videoAd && !this.adFallbackUsed) {
      try {
        await this.videoAd.load();
        this.setData({ adWatching: true });
        await this.videoAd.show();
        return;
      } catch (e) {
        // 广告加载失败，fallback 到模拟
        console.warn('广告加载失败，使用模拟模式:', e);
        this.adFallbackUsed = true;
      }
    }

    // 模拟广告（15秒倒计时）
    this.startAdSimulation();
  },

  startAdSimulation() {
    this.setData({ adWatching: true, adCountdown: 15 });

    this.adTimer = setInterval(() => {
      const newCount = this.data.adCountdown - 1;
      if (newCount <= 0) {
        this.finishAd();
      } else {
        this.setData({ adCountdown: newCount });
      }
    }, 1000);
  },

  /**
   * 广告完成
   */
  async finishAd() {
    clearInterval(this.adTimer);
    this.adTimer = null;

    this.setData({ adWatching: false, adCountdown: 15 });

    try {
      const res = await api.claimAdReward();
      if (res.code === 0) {
        this.refreshCredits();
        wx.showToast({ title: '+3 次已到账', icon: 'success' });
      } else {
        wx.showToast({ title: res.message || '领取失败', icon: 'none' });
      }
    } catch (e) {
      const app = getApp();
      app.updateCredits(3);
      this.setData({
        credits: app.globalData.credits,
        barPercent: Math.min(100, (app.globalData.credits / 3) * 100)
      });
      wx.showToast({ title: '+3 次已到账', icon: 'success' });
    }
  },

  /**
   * 分享任务
   */
  shareTask() {
    wx.showModal({
      title: '分享好友',
      content: '分享给好友，双方各得 +2 次！',
      confirmText: '去分享',
      success: (res) => {
        if (res.confirm) {
          this.claimShareReward();
        }
      }
    });
  },

  async claimShareReward() {
    try {
      const res = await api.claimShareReward();
      if (res.code === 0) {
        this.refreshCredits();
        wx.showToast({ title: '+2 次已到账', icon: 'success' });
      } else {
        wx.showToast({ title: res.message || '领取失败', icon: 'none' });
      }
    } catch (e) {
      const app = getApp();
      app.updateCredits(2);
      this.setData({
        credits: app.globalData.credits,
        barPercent: Math.min(100, (app.globalData.credits / 3) * 100)
      });
      wx.showToast({ title: '+2 次已到账', icon: 'success' });
    }
  },

  /**
   * 分享配置
   */
  onShareAppMessage() {
    return {
      title: '我用AI去掉了图片水印，效果超赞！',
      path: '/pages/index/index'
    };
  },

  onUnload() {
    if (this.adTimer) {
      clearInterval(this.adTimer);
      this.adTimer = null;
    }
  }
});