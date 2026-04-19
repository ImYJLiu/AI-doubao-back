const api = require('../../utils/api');
const app = getApp();

Page({
  data: {
    recentImages: [],
    uploading: false
  },

  /**
   * 从相册选择图片
   */
  async chooseImage() {
    try {
      const res = await wx.chooseMedia({
        count: 9,
        mediaType: ['image'],
        sourceType: ['album'],
        sizeType: ['compressed']
      });

      if (res.tempFiles && res.tempFiles.length > 0) {
        const recent = res.tempFiles.map(f => f.tempFilePath);
        this.setData({ recentImages: recent });
        // 选择第一张进入编辑
        this.navigateToEdit(recent[0]);
      }
    } catch (e) {
      // 用户取消选择
    }
  },

  /**
   * 拍照上传
   */
  async takePhoto() {
    try {
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['camera'],
        sizeType: ['compressed']
      });

      if (res.tempFiles && res.tempFiles.length > 0) {
        this.navigateToEdit(res.tempFiles[0].tempFilePath);
      }
    } catch (e) {
      // 用户取消
    }
  },

  /**
   * 选择最近图片
   */
  selectRecent(e) {
    const index = e.currentTarget.dataset.index;
    const path = this.data.recentImages[index];
    this.navigateToEdit(path);
  },

  /**
   * 跳转到编辑页
   */
  async navigateToEdit(imagePath) {
    wx.showLoading({ title: '上传中...' });

    try {
      // 确保登录完成后再上传
      const app = getApp();
      if (!app.globalData.token) {
        await app.silentLogin();
      }

      // 先上传到后端获取 imageId
      const res = await api.uploadImage(imagePath);

      wx.hideLoading();

      if (res.code === 0) {
        // 优先使用fullImageUrl（完整URL），兼容旧版用imageUrl
        const imageUrl = res.data.fullImageUrl || res.data.imageUrl;
        wx.navigateTo({
          url: `/pages/edit/edit?imageId=${res.data.imageId}&imagePath=${encodeURIComponent(imagePath)}&imageUrl=${encodeURIComponent(imageUrl)}`
        });
      } else {
        wx.showToast({ title: res.message || '上传失败', icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      // 后端未就绪时，直接带本地路径跳转
      wx.navigateTo({
        url: `/pages/edit/edit?imagePath=${encodeURIComponent(imagePath)}&imageUrl=`
      });
    }
  }
});
