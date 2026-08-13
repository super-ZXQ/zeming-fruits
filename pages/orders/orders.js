Page({
  data: {
    currentStatus: 'all', allOrders: [], orders: [], pendingCount: 0, loading: true, loadError: '',
    statusText: { pending: '待确认', confirmed: '已确认', preparing: '备货中', ready: '待取货', delivering: '配送中', completed: '已完成', after_sale: '售后中', refund: '售后中', cancelled: '已取消' }
  },
  onLoad(options) { this.setData({ currentStatus: options.status || 'all' }) },
  onShow() { this.loadOrders() },
  async loadOrders() {
    this.setData({ loading: true, loadError: '' })
    try {
      const result = await wx.cloud.database().collection('orders').orderBy('createTime', 'desc').limit(100).get()
      const allOrders = result.data.map(order => this.normalizeOrder(order))
      this.setData({ allOrders, pendingCount: allOrders.filter(order => order.status === 'pending').length, loading: false })
      this.applyFilter()
    } catch (err) { this.setData({ loading: false, loadError: '订单加载失败，请检查网络后重试', orders: [] }) }
  },
  applyFilter() {
    const { allOrders, currentStatus } = this.data
    const active = ['confirmed', 'preparing', 'ready', 'delivering']
    const orders = allOrders.filter(order => currentStatus === 'all' || (currentStatus === 'active' && active.includes(order.status)) || (currentStatus === 'after_sale' && ['after_sale', 'refund'].includes(order.status)) || order.status === currentStatus)
    this.setData({ orders })
  },
  normalizeOrder(order) {
    const price = order.priceDetail || {}
    return { ...order, id: order._id || order.id, items: (order.goods || order.items || []).map(item => ({ ...item, count: item.quantity || item.count || 1 })), totalAmount: price.total !== undefined ? price.total : (order.finalAmount || order.totalAmount || 0), createTimeText: this.formatTime(order.createTime), modeText: order.deliveryType === 'pickup' ? '到店自取' : '送货上门' }
  },
  formatTime(value) { if (!value) return ''; const date = new Date(value); const pad = item => String(item).padStart(2, '0'); return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}` },
  switchTab(e) { this.setData({ currentStatus: e.currentTarget.dataset.status }); this.applyFilter() },
  goToDetail(e) { wx.navigateTo({ url: `/pages/orderDetail/orderDetail?id=${e.currentTarget.dataset.id}` }) },
  goShopping() { wx.switchTab({ url: '/pages/index/index' }) }
})
