const api = require('../../utils/api');

Page({
  data: {
    credits: 0,
    barPercent: 100
  },

  onShow() {
    this.refreshCredits();
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
        const app = getApp();
        app.globalData.credits = credits;
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
   * 观看广告（功能未开放）
   */
  watchAd() {
    wx.showToast({ title: '该功能暂未开放', icon: 'none' });
  },

  /**
   * VIP 购买（功能未开放）
   */
  openVip() {
    wx.showToast({ title: '该功能暂未开放', icon: 'none' });
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
      wx.showToast({ title: '领取失败，请重试', icon: 'none' });
    }
  },

  onShareAppMessage() {
    return {
      title: '我用AI去掉了图片水印，效果超赞！',
      path: '/pages/index/index'
    };
  }
});