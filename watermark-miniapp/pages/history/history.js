const api = require('../../utils/api');

const periodMap = ['all', 'week', 'earlier'];

Page({
  data: {
    historyList: [],
    filterIndex: 0,
    batchMode: false,
    selectedItems: {},
    selectedCount: 0,
    allSelected: false,
    page: 1,
    hasMore: true
  },

  onLoad() {
    this.loadHistory();
  },

  onShow() {
    this.setData({ page: 1 });
    this.loadHistory();
  },

  /**
   * 加载历史记录
   */
  async loadHistory() {
    const period = periodMap[this.data.filterIndex];

    try {
      const res = await api.getHistory(this.data.page, 10, period);
      if (res.code === 0) {
        const rawList = Array.isArray(res.data) ? res.data : [];
        const baseUrl = getApp().globalData.baseUrl;
        const list = rawList.map(item => ({
          ...item,
          taskId: String(item.taskId),
          thumbUrl: item.thumbUrl && item.thumbUrl.startsWith('http') ? item.thumbUrl : baseUrl + item.thumbUrl,
          resultUrl: item.resultUrl && item.resultUrl.startsWith('http') ? item.resultUrl : baseUrl + item.resultUrl
        }));
        const newList = this.data.page === 1 ? list : [...this.data.historyList, ...list];
        this.setData({
          historyList: newList,
          hasMore: list.length >= 10
        });
      }
    } catch (e) {
      // 后端未就绪时不渲染任何内容
      if (this.data.page === 1) {
        this.setData({ historyList: [] });
      }
    }
  },

  /**
   * 图片加载失败时下载到本地再显示
   */
  async onImgError(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.historyList[index];
    if (!item || !item.thumbUrl) return;
    try {
      const localPath = await api.downloadToLocal(item.thumbUrl);
      this.setData({ [`historyList[${index}].thumbUrl`]: localPath });
    } catch (err) {}
  },

  /**
   * 切换过滤器
   */
  switchFilter(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ filterIndex: index, page: 1 });
    this.loadHistory();
  },

  /**
   * 切换批量模式
   */
  toggleBatch() {
    this.setData({
      batchMode: !this.data.batchMode,
      selectedItems: {},
      selectedCount: 0,
      allSelected: false
    });
  },

  /**
   * 点击项目
   */
  onItemClick(e) {
    if (this.data.batchMode) {
      const id = e.currentTarget.dataset.id;
      const selected = { ...this.data.selectedItems };
      if (selected[id]) {
        delete selected[id];
      } else {
        selected[id] = true;
      }
      const count = Object.keys(selected).length;
      this.setData({
        selectedItems: selected,
        selectedCount: count,
        allSelected: count === this.data.historyList.length
      });
    } else {
      const url = e.currentTarget.dataset.url;
      if (url) {
        // previewImage 内部会自动下载，支持局域网地址
        wx.previewImage({ urls: [url], current: url });
      }
    }
  },

  /**
   * 全选
   */
  selectAll() {
    if (this.data.allSelected) {
      this.setData({ selectedItems: {}, selectedCount: 0, allSelected: false });
    } else {
      const selected = {};
      this.data.historyList.forEach(item => {
        selected[item.taskId] = true;
      });
      this.setData({ selectedItems: selected, selectedCount: this.data.historyList.length, allSelected: true });
    }
  },

  /**
   * 批量删除
   */
  async batchDelete() {
    const ids = Object.keys(this.data.selectedItems);
    if (ids.length === 0) return;

    wx.showModal({
      title: '确认删除',
      content: `确定删除 ${ids.length} 个作品吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await api.batchDeleteHistory(ids);
            if (result.code !== 0) {
              wx.showToast({ title: result.message || '删除失败', icon: 'none' });
              return;
            }
          } catch (e) {
            wx.showToast({ title: '删除失败，请重试', icon: 'none' });
            return;
          }

          const newList = this.data.historyList.filter(item => !this.data.selectedItems[item.taskId]);
          this.setData({
            historyList: newList,
            selectedItems: {},
            selectedCount: 0,
            allSelected: false,
            batchMode: false
          });
          wx.showToast({ title: '删除成功', icon: 'success' });
        }
      }
    });
  },

  /**
   * 下载单张
   */
  downloadItem(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({ urls: [url] });
  },

  /**
   * 去上传
   */
  goToUpload() {
    wx.switchTab({ url: '/pages/index/index' });
    setTimeout(() => {
      wx.navigateTo({ url: '/pages/upload/upload' });
    }, 500);
  },

  /**
   * 触底加载更多
   */
  onReachBottom() {
    if (this.data.hasMore && !this.data.batchMode) {
      this.setData({ page: this.data.page + 1 });
      this.loadHistory();
    }
  }
});
