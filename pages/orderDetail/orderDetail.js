const app = getApp();

Page({
  data: {
    orderId: '',
    order: {},
    logisticsInfo: [],
    statusText: {
      pending: '待付款',
      paid: '配送中',
      completed: '已完成',
      refund: '售后中'
    },
    statusDesc: {
      pending: '请尽快完成支付',
      paid: '商家已发货，配送员正在为您送货',
      completed: '订单已完成',
      refund: '售后处理中'
    }
  },

  onLoad(options) {
    const orderId = options.id;
    this.setData({ orderId });
    this.loadOrderDetail();
  },

  loadOrderDetail() {
    const orders = app.globalData.orders || [];
    const order = orders.find(o => o.id === this.data.orderId);
    
    if (order) {
      order.createTime = this.formatTime(order.createTime);
      if (order.payTime) {
        order.payTime = this.formatTime(order.payTime);
      }
      
      this.setData({ order });
      this.generateLogistics();
    }
  },

  formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  generateLogistics() {
    const { order } = this.data;
    const logistics = [];
    
    if (order.status === 'paid' || order.status === 'completed') {
      const payDate = order.payTime || this.formatTime(order.createTime);
      logistics.push({
        desc: '商品已送达，欢迎再次购买',
        time: payDate
      });
      logistics.push({
        desc: '配送员正在为您送货',
        time: this.addHours(payDate, 2)
      });
      logistics.push({
        desc: '商品已到达配送站点',
        time: this.addHours(payDate, 1)
      });
      logistics.push({
        desc: '商家已发货',
        time: payDate
      });
    }
    
    this.setData({ logisticsInfo: logistics });
  },

  addHours(timeStr, hours) {
    const [datePart, timePart] = timeStr.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    
    const date = new Date(year, month - 1, day, hour, minute);
    date.setHours(date.getHours() + hours);
    
    const newMonth = String(date.getMonth() + 1).padStart(2, '0');
    const newDay = String(date.getDate()).padStart(2, '0');
    const newHour = String(date.getHours()).padStart(2, '0');
    const newMinute = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${newMonth}-${newDay} ${newHour}:${newMinute}`;
  },

  payOrder() {
    wx.showModal({
      title: '确认支付',
      content: '确定要支付该订单吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '支付中...' });
          
          setTimeout(() => {
            const orders = app.globalData.orders;
            const order = orders.find(o => o.id === this.data.orderId);
            if (order) {
              order.status = 'paid';
              order.payTime = new Date().toISOString();
            }
            
            wx.hideLoading();
            wx.showToast({ title: '支付成功', icon: 'success' });
            this.loadOrderDetail();
          }, 1500);
        }
      }
    });
  },

  viewLogistics() {
    wx.showModal({
      title: '物流信息',
      content: '配送员：张师傅\n电话：138****8888\n当前正在为您送货',
      confirmText: '知道了',
      showCancel: false
    });
  },

  confirmReceive() {
    wx.showModal({
      title: '确认收货',
      content: '确定已收到商品吗？',
      success: (res) => {
        if (res.confirm) {
          const orders = app.globalData.orders;
          const order = orders.find(o => o.id === this.data.orderId);
          if (order) {
            order.status = 'completed';
          }
          
          wx.showToast({ title: '收货成功', icon: 'success' });
          this.loadOrderDetail();
        }
      }
    });
  },

  applyRefund() {
    wx.showModal({
      title: '申请售后',
      content: '确定要申请售后吗？',
      success: (res) => {
        if (res.confirm) {
          const orders = app.globalData.orders;
          const order = orders.find(o => o.id === this.data.orderId);
          if (order) {
            order.status = 'refund';
          }
          
          wx.showToast({ title: '售后申请已提交', icon: 'success' });
          this.loadOrderDetail();
        }
      }
    });
  }
});