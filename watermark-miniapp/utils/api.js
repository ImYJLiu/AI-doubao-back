const app = getApp();

/**
 * 统一请求封装 —— 使用 wx.request
 */
function request(options) {
  const retries = options._retries || 0;
  const maxRetries = options.maxRetries !== undefined ? options.maxRetries : 2;

  return new Promise((resolve, reject) => {
    const loginReady = app.loginReadyPromise || Promise.resolve(true);
    loginReady.then((loginSuccess) => {
      // 登录失败，不发请求
      if (!loginSuccess) {
        wx.showToast({ title: '登录失败，请重新进入小程序', icon: 'none' });
        reject({ code: 401, message: '登录失败' });
        return;
      }

      const token = wx.getStorageSync('token') || app.globalData.token;
      // token 不存在，说明登录未完成
      if (!token) {
        wx.showToast({ title: '登录中，请稍候', icon: 'none' });
        reject({ code: 401, message: '未登录' });
        return;
      }

      wx.request({
        url: app.globalData.baseUrl + options.url,
        header: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.header
        },
        method: options.method || 'GET',
        data: options.data,
        success(res) {
          if (res.statusCode === 401) {
            // token 过期，清除本地状态，提示重新进入
            wx.removeStorageSync('token');
            wx.removeStorageSync('userInfo');
            app.globalData.token = null;
            app.globalData.userInfo = null;
            wx.showToast({ title: '登录已过期，请重新进入小程序', icon: 'none', duration: 2000 });
            reject({ code: 401, message: '登录已过期' });
            return;
          }
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data);
          } else if (res.statusCode >= 500 && retries < maxRetries) {
            retryRequest(options, retries + 1, resolve, reject);
          } else {
            wx.showToast({ title: res.data?.message || '请求失败', icon: 'none' });
            reject(res.data);
          }
        },
        fail(err) {
          if (retries < maxRetries) {
            retryRequest(options, retries + 1, resolve, reject);
          } else {
            wx.showToast({ title: '网络异常', icon: 'none' });
            reject(err);
          }
        }
      });
    });
  });
}

/**
 * 重试请求（指数退避）
 */
function retryRequest(options, retries, resolve, reject) {
  const delay = Math.min(1000 * Math.pow(2, retries - 1), 5000);
  setTimeout(() => {
    request({ ...options, _retries: retries }).then(resolve).catch(reject);
  }, delay);
}

/**
 * 文件上传封装 —— wx.cloud.callContainer 不支持文件上传，继续用 HTTPS
 */
function uploadFile(url, filePath, formData = {}) {
  return new Promise((resolve, reject) => {
    const loginReady = app.loginReadyPromise || Promise.resolve(true);
    loginReady.then((loginSuccess) => {
      // 登录失败，不发请求
      if (!loginSuccess) {
        wx.showToast({ title: '登录失败，请重新进入小程序', icon: 'none' });
        reject({ code: 401, message: '登录失败' });
        return;
      }

      const token = wx.getStorageSync('token') || app.globalData.token;
      // token 不存在，说明登录未完成
      if (!token) {
        wx.showToast({ title: '登录中，请稍候', icon: 'none' });
        reject({ code: 401, message: '未登录' });
        return;
      }

      _doUploadFile(url, filePath, formData, resolve, reject);
    });
  });
}

function _doUploadFile(url, filePath, formData, resolve, reject) {
  const token = wx.getStorageSync('token') || app.globalData.token;
  const header = {};
  if (token) header['Authorization'] = `Bearer ${token}`;

  wx.uploadFile({
    url: `${app.globalData.baseUrl}${url}`,
    filePath,
    name: 'file',
    formData,
    header,
    timeout: 60000,
    success(res) {
      if (res.statusCode === 401) {
        // token 过期，清除本地状态，提示重新进入
        wx.removeStorageSync('token');
        wx.removeStorageSync('userInfo');
        app.globalData.token = null;
        app.globalData.userInfo = null;
        wx.showToast({ title: '登录已过期，请重新进入小程序', icon: 'none', duration: 2000 });
        reject({ code: 401, message: '登录已过期' });
        return;
      }
      try {
        const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        if (data.code === 0) {
          resolve(data);
        } else {
          wx.showToast({ title: data.message || '上传失败', icon: 'none' });
          reject(data);
        }
      } catch (e) {
        reject({ message: '响应解析失败' });
      }
    },
    fail(err) {
      wx.showToast({ title: '网络异常', icon: 'none' });
      reject(err);
    }
  });
}

/**
 * 下载远程图片到本地临时路径
 */
function downloadToLocal(url) {
  return new Promise((resolve, reject) => {
    wx.downloadFile({ url, success: (res) => resolve(res.tempFilePath), fail: reject });
  });
}

// ============ API 方法 ============

function getCreditsInfo() {
  return request({ url: '/api/credits/info' });
}

function uploadImage(filePath) {
  return uploadFile('/api/image/upload', filePath);
}

function createTask(imageId, maskFilePath) {
  return uploadFile('/api/task/create', maskFilePath, { imageId });
}

function createPreviewTask(imageId, maskFilePath) {
  return uploadFile('/api/task/preview', maskFilePath, { imageId });
}

function confirmTask(taskId) {
  return request({ url: `/api/task/${taskId}/confirm`, method: 'POST' });
}

function getTaskStatus(taskId) {
  return request({ url: `/api/task/${taskId}/status` });
}

function getHistory(page = 1, size = 10, period = 'all') {
  return request({ url: `/api/history/list?page=${page}&size=${size}&period=${period}` });
}

function submitFeedback(taskId, rating) {
  return request({ url: '/api/feedback', method: 'POST', data: { taskId, rating } });
}

function claimAdReward() {
  return request({ url: '/api/credits/ad-reward', method: 'POST' });
}

function claimShareReward() {
  return request({ url: '/api/credits/share-reward', method: 'POST' });
}

function batchDeleteHistory(taskIds) {
  return request({ url: '/api/history/batch-delete', method: 'POST', data: { taskIds: taskIds.map(Number) } });
}

module.exports = {
  request,
  uploadFile,
  getCreditsInfo,
  uploadImage,
  createTask,
  createPreviewTask,
  confirmTask,
  getTaskStatus,
  getHistory,
  submitFeedback,
  claimAdReward,
  claimShareReward,
  batchDeleteHistory,
  downloadToLocal
};