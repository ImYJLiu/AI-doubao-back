const api = require('../../utils/api');

Page({
  data: {
    credits: 0
  },

  onShow() {
    this.refreshCredits();
  },

  async refreshCredits() {
    try {
      const res = await api.getCreditsInfo();
      if (res.code === 0) {
        this.setData({ credits: res.data.credits });
      } else {
        // 后端未就绪时，从本地获取
        const app = getApp();
        this.setData({ credits: app.globalData.credits });
      }
    } catch (e) {
      const app = getApp();
      this.setData({ credits: app.globalData.credits });
    }
  },

  goToUpload() {
    wx.navigateTo({ url: '/pages/upload/upload' });
  }
});
