Component({
  properties: {
    beforeSrc: { type: String, value: '' },
    afterSrc: { type: String, value: '' },
    height: { type: Number, value: 800 }
  },
  data: {
    percent: 50,
    sliderX: 0,
    areaWidth: 0
  },
  observers: {
    '**': function() {
      // 页面渲染后获取 slider-area 宽度
      if (this.data.areaWidth === 0) {
        setTimeout(() => {
          const query = this.createSelectorQuery();
          query.select('.slider-area').boundingClientRect((rect) => {
            if (rect) {
              const width = rect.width;
              this.setData({
                areaWidth: width,
                sliderX: width / 2 - 30 // 居中滑块
              });
            }
          }).exec();
        }, 300);
      }
    }
  },
  methods: {
    onSliderChange(e) {
      if (!this.data.areaWidth) return;
      const x = e.detail.x;
      const percent = (x / this.data.areaWidth) * 100;
      this.setData({
        percent: Math.max(0, Math.min(100, percent))
      });
    },
    onSliderEnd() {
      // 确保滑块不超出边界
      if (!this.data.areaWidth) return;
      const targetX = (this.data.percent / 100) * this.data.areaWidth - 30;
      this.setData({
        sliderX: Math.max(0, Math.min(this.data.areaWidth - 60, targetX))
      });
    }
  }
});
