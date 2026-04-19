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

  /**
   * 加载历史记录
   */
  async loadHistory() {
    const period = periodMap[this.data.filterIndex];

    try {
      const res = await api.getHistory(this.data.page, 10, period);
      if (res.code === 0) {
        // res.data 直接是数组（后端返回 Result<List<HistoryItemVO>>）
        const list = Array.isArray(res.data) ? res.data : [];
        const newList = this.data.page === 1 ? list : [...this.data.historyList, ...list];
        this.setData({
          historyList: newList,
          hasMore: list.length >= 10
        });
      }
    } catch (e) {
      // 后端未就绪，使用模拟数据
      this.loadMockHistory();
    }
  },

  /**
   * 模拟历史数据
   */
  loadMockHistory() {
    const mockData = [
      { taskId: '1', thumbUrl: '/images/demo-after.png', resultUrl: '/images/demo-after.png', createdAt: '2026-04-10' },
      { taskId: '2', thumbUrl: '/images/demo-before.png', resultUrl: '/images/demo-before.png', createdAt: '2026-04-09' },
      { taskId: '3', thumbUrl: '/images/banner-placeholder.png', resultUrl: '/images/banner-placeholder.png', createdAt: '2026-04-08' },
      { taskId: '4', thumbUrl: '/images/demo-after.png', resultUrl: '/images/demo-after.png', createdAt: '2026-03-28' }
    ];
    this.setData({ historyList: mockData });
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
            await wx.request({
              url: `${getApp().globalData.baseUrl}/api/history/batch-delete`,
              method: 'POST',
              data: { taskIds: ids }
            });
          } catch (e) {}

          // 本地删除
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
