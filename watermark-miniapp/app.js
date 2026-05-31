App({
  globalData: {
    userInfo: null,
    token: null,
    credits: 0,
    baseUrl: 'https://spring-boot-ai-253721-5-1323340180.sh.run.tcloudbase.com'
  },

  // 登录完成的 Promise，供其他模块 await
  loginReadyPromise: null,
  // 并发锁：防止多个 401 同时触发重新登录
  loginPromise: null,

  onLaunch() {
    // 保存登录 Promise，让其他模块可以 await 登录完成
    this.loginReadyPromise = this.silentLogin();
  },

  async silentLogin() {
    // 如果已有登录 Promise 未完成，直接返回（并发保护）
    if (this.loginPromise) {
      return this.loginPromise;
    }

    this.loginPromise = (async () => {
      try {
        // 已有 token 且有效，直接返回
        const token = wx.getStorageSync('token');
        if (token) {
          this.globalData.token = token;
          const userInfo = wx.getStorageSync('userInfo');
          if (userInfo) {
            this.globalData.userInfo = userInfo;
            this.globalData.credits = userInfo.credits || 0;
          }
          return true;
        }

        // 获取 code 并请求登录（code 只能用一次）
        const { code } = await wx.login();
        const res = await new Promise((resolve, reject) => {
          wx.request({
            url: this.globalData.baseUrl + '/api/auth/login',
            method: 'POST',
            header: { 'Content-Type': 'application/json' },
            data: { code },
            success: resolve,
            fail: reject
          });
        });

        if (res.data && res.data.code === 0) {
          const { token: newToken, credits, ...user } = res.data.data;
          this.globalData.token = newToken;
          this.globalData.userInfo = user;
          this.globalData.credits = credits;
          wx.setStorageSync('token', newToken);
          wx.setStorageSync('userInfo', { ...user, credits });
          return true;
        }
        
        // 登录失败，清除状态
        console.error('登录失败:', res.data);
        wx.removeStorageSync('token');
        wx.removeStorageSync('userInfo');
        this.globalData.token = null;
        this.globalData.userInfo = null;
        return false;
      } catch (e) {
        console.error('静默登录异常:', e);
        return false;
      } finally {
        // 登录完成后清空 Promise，允许下次重新登录
        this.loginPromise = null;
      }
    })();

    return this.loginPromise;
  },

  updateCredits(delta) {
    this.globalData.credits += delta;
    wx.setStorageSync('userInfo', {
      ...this.globalData.userInfo,
      credits: this.globalData.credits
    });
  }
});