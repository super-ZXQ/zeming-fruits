Page({
  data: {
    currentStatus: 'all',
    orders: [],
    pendingCount: 0,
    statusText: {
      pending: '待付款',
      paid: '进行中',
      completed: '已完成',
      refund: '售后中',
      cancelled: '已取消'
    }
  },

  onLoad(options) {
    this.setData({ currentStatus: options.status || 'all' })
  },

  onShow() {
    this.loadOrders()
  },

  async loadOrders() {
    try {
      const db = wx.cloud.database()
      const res = await db.collection('orders')
        .orderBy('createTime', 'desc')
        .limit(50)
        .get()

      const allOrders = res.data
        .filter(order => order.orderType !== 'recharge')
        .map(order => this.normalizeOrder(order))
      const currentStatus = this.data.currentStatus
      const orders = currentStatus === 'all'
        ? allOrders
        : allOrders.filter(order => order.status === currentStatus)

      this.setData({
        orders,
        pendingCount: allOrders.filter(order => order.status === 'pending').length
      })
    } catch (err) {
      console.error('加载订单失败:', err)
      wx.showToast({ title: '订单加载失败', icon: 'none' })
    }
  },

  normalizeOrder(order) {
    const statusMap = {
      pending_payment: 'pending',
      preparing: 'paid',
      delivering: 'paid'
    }
    const status = statusMap[order.status] || order.status
    const priceDetail = order.priceDetail || {}
    const totalAmount = priceDetail.total !== undefined
      ? priceDetail.total
      : (order.finalAmount !== undefined ? order.finalAmount : (order.totalAmount || 0))

    return {
      ...order,
      id: order._id || order.id,
      status,
      items: (order.goods || order.items || []).map(item => ({
        ...item,
        count: item.quantity || item.count || 1
      })),
      totalAmount,
      createTime: this.formatTime(order.createTime)
    }
  },

  formatTime(value) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${month}-${day} ${hour}:${minute}`
  },

  switchTab(e) {
    this.setData({ currentStatus: e.currentTarget.dataset.status })
    this.loadOrders()
  },

  goToDetail(e) {
    wx.navigateTo({
      url: '/pages/orderDetail/orderDetail?id=' + e.currentTarget.dataset.id
    })
  },

  goShopping() {
    wx.switchTab({ url: '/pages/index/index' })
  }
})
