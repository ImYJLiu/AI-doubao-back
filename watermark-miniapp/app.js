App({
  globalData: {
    userInfo: null,
    token: null,
    credits: 0,
    baseUrl: 'https://springboot-xo46-253721-5-1323340180.sh.run.tcloudbase.com',
    cloudEnv: 'prod-d4gp039vi70f1a3ac',
    cloudService: 'springboot-xo46'
  },

  // 登录完成的 Promise，供其他模块 await
  loginReadyPromise: null,
  // 并发锁：防止多个 401 同时触发重新登录
  loginPromise: null,

  onLaunch() {
    // 初始化微信云托管环境
    wx.cloud.init({ env: 'prod-d4gp039vi70f1a3ac' });

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

        const { code } = await wx.login();
        const res = await new Promise((resolve, reject) => {
          wx.cloud.callContainer({
            config: { env: 'prod-d4gp039vi70f1a3ac' },
            path: '/api/auth/login',
            header: {
              'Content-Type': 'application/json',
              'X-WX-SERVICE': 'springboot-xo46'
            },
            method: 'POST',
            data: { code },
            success: resolve,
            fail: reject
          });
        });

        if (res.data && res.data.code === 0) {
          const { token: newToken, credits, ...user } = res.data.data;
          console.log('解析token:', newToken);
          this.globalData.token = newToken;
          this.globalData.userInfo = user;
          this.globalData.credits = credits;
          wx.setStorageSync('token', newToken);
          wx.setStorageSync('userInfo', { ...user, credits });
          console.log('登录成功, token已保存, globalData.token:', this.globalData.token);
          return true;
        }
        console.log('登录响应code不为0:', res.data);
        return false;
      } catch (e) {
        console.error('静默登录失败:', e);
        return false;
      } finally {
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