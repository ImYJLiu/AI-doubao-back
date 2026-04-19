Component({
  properties: {
    icon: { type: String, value: '' },
    title: { type: String, value: '暂无内容' },
    desc: { type: String, value: '' },
    showBtn: { type: Boolean, value: false },
    btnText: { type: String, value: '去试试' }
  },
  methods: {
    onTap() {
      this.triggerEvent('tap');
    }
  }
});
