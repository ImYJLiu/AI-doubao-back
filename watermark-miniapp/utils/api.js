const app = getApp();

/**
 * 统一请求封装（带重试机制）
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
        url: `${app.globalData.baseUrl}${options.url}`,
        method: options.method || 'GET',
        data: options.data,
        header: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.header
        },
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
 * 文件上传封装
 */
function uploadFile(url, filePath, formData = {}, _authRetried = false) {
  return new Promise((resolve, reject) => {
    // 等待启动时的登录流程完成，确保 token 已就绪
    const loginReady = app.loginReadyPromise || Promise.resolve(true);
    loginReady.then(() => {
      _doUploadFile(url, filePath, formData, _authRetried, resolve, reject);
    });
  });
}

function _doUploadFile(url, filePath, formData, _authRetried, resolve, reject) {
  const token = wx.getStorageSync('token');
  const globalToken = app.globalData.token;
  
  console.log('上传文件 - storage token:', token ? 'exists' : 'missing');
  console.log('上传文件 - globalData token:', globalToken ? 'exists' : 'missing');
  
  const finalToken = token || globalToken;
  
  const header = {};
  if (finalToken) {
    header['Authorization'] = `Bearer ${finalToken}`;
    console.log('已设置Authorization header');
  } else {
    console.warn('token为空，无法设置Authorization');
  }
  
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
        const data = JSON.parse(res.data);
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

/**
 * 创建预览任务（不扣积分）
 */
function createPreviewTask(imageId, maskFilePath) {
  return uploadFile('/api/task/preview', maskFilePath, { imageId });
}

/**
 * 确认预览任务（扣除积分）
 */
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
  claimShareReward
};