const app = getApp();

/**
 * 统一请求封装 —— 使用 wx.request
 */
function request(options) {
  const retries = options._retries || 0;
  const maxRetries = options.maxRetries !== undefined ? options.maxRetries : 2;
  const authRetried = options._authRetried || false;

  return new Promise((resolve, reject) => {
    const loginReady = app.loginReadyPromise || Promise.resolve(true);
    loginReady.then(() => {
      const token = wx.getStorageSync('token') || app.globalData.token;
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
            if (authRetried) {
              wx.showToast({ title: '登录已过期，请重新进入', icon: 'none' });
              reject({ code: 401, message: '登录已过期' });
              return;
            }
            wx.removeStorageSync('token');
            app.globalData.token = null;
            app.silentLogin().then((success) => {
              if (success) {
                request({ ...options, _authRetried: true }).then(resolve).catch(reject);
              } else {
                wx.showToast({ title: '登录失败，请重新进入', icon: 'none' });
                reject({ code: 401, message: '登录失败' });
              }
            });
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
function uploadFile(url, filePath, formData = {}, _authRetried = false) {
  return new Promise((resolve, reject) => {
    const loginReady = app.loginReadyPromise || Promise.resolve(true);
    loginReady.then(() => {
      _doUploadFile(url, filePath, formData, _authRetried, resolve, reject);
    });
  });
}

function _doUploadFile(url, filePath, formData, _authRetried, resolve, reject) {
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
        if (_authRetried) {
          wx.showToast({ title: '登录已过期，请重新进入', icon: 'none' });
          reject({ code: 401, message: '登录已过期' });
          return;
        }
        wx.removeStorageSync('token');
        app.globalData.token = null;
        app.silentLogin().then((success) => {
          if (success) {
            uploadFile(url, filePath, formData, true).then(resolve).catch(reject);
          } else {
            wx.showToast({ title: '登录失败，请重新进入', icon: 'none' });
            reject({ code: 401, message: '登录失败' });
          }
        });
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