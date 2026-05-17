const app = getApp();

Page({
  data: {
    currentStatus: 'all',
    orders: [],
    pendingCount: 0,
    statusText: {
      pending: '待付款',
      paid: '进行中',
      completed: '已完成'
    }
  },

  onLoad(options) {
    const status = options.status || 'all';
    this.setData({ currentStatus: status });
    this.loadOrders();
  },

  onShow() {
    this.loadOrders();
  },

  loadOrders() {
    const orders = app.globalData && app.globalData.orders ? app.globalData.orders : [];
    const currentStatus = this.data.currentStatus;
    
    let filtered = [];
    if (currentStatus === 'all') {
      filtered = orders;
    } else {
      filtered = orders.filter(order => order.status === currentStatus);
    }

    filtered = filtered.map(order => ({
      ...order,
      createTime: this.formatTime(order.createTime)
    }));

    const pendingCount = orders.filter(o => o.status === 'pending').length;
    
    this.setData({ orders: filtered, pendingCount });
  },

  formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hour}:${minute}`;
  },

  switchTab(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({ currentStatus: status });
    this.loadOrders();
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/orderDetail/orderDetail?id=' + id
    });
  },

  goShopping() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  }
});