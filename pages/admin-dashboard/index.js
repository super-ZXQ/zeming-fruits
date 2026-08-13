Page({
  data: {
    authorized: false,
    stats: { todaySales: '0.00', todayOrders: 0, newUsers: 0, pendingOrders: 0 },
    hotGoods: [],
    orders: [],
    orderFilter: 'all',
    page: 0,
    hasMore: false,
    statusMap: { pending: '待确认', confirmed: '已确认', preparing: '备货中', ready: '待取货', delivering: '配送中', completed: '已完成', after_sale: '售后中', refund: '售后中', cancelled: '已取消' }
  },

  onLoad() { this.checkAdmin() },
  onShow() { if (this.data.authorized) this.loadDashboard(true) },

  async checkAdmin() {
    try {
      const result = await wx.cloud.callFunction({ name: 'adminAuth' })
      if (!result.result || !result.result.isAdmin) throw new Error('您不是管理员')
      this.setData({ authorized: true })
      this.loadDashboard(true)
    } catch (err) {
      wx.showModal({ title: '无访问权限', content: err.message || '请使用管理员账号登录', showCancel: false, success: () => wx.navigateBack() })
    }
  },

  actionText(order) {
    if (order.status === 'pending') return '确认预约'
    if (order.status === 'confirmed') return '开始备货'
    if (order.status === 'preparing') return order.deliveryType === 'pickup' ? '通知取货' : '开始配送'
    if (order.status === 'ready') return '完成自取'
    if (order.status === 'delivering') return '完成配送'
    return ''
  },

  async loadDashboard(reset = false) {
    const page = reset ? 0 : this.data.page
    try {
      wx.showLoading({ title: '加载中', mask: true })
      const result = await wx.cloud.callFunction({ name: 'adminOrders', data: { action: 'dashboard', status: this.data.orderFilter, page } })
      if (!result.result || !result.result.success) throw new Error('加载后台数据失败')
      const orders = (result.result.orders || []).map((order, index) => ({
        ...order,
        orderIndex: page * 20 + index + 1,
        createTimeText: this.formatTime(order.createTime),
        nextAction: this.actionText(order)
      }))
      this.setData({
        stats: result.result.stats || this.data.stats,
        hotGoods: result.result.hotGoods || [],
        orders: reset ? orders : this.data.orders.concat(orders),
        page: page + 1,
        hasMore: !!result.result.hasMore
      })
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    } finally { wx.hideLoading() }
  },

  filterOrders(e) {
    this.setData({ orderFilter: e.currentTarget.dataset.filter })
    this.loadDashboard(true)
  },
  loadMore() { if (this.data.hasMore) this.loadDashboard(false) },

  async callOrderAction(action, id, extra = {}) {
    const result = await wx.cloud.callFunction({ name: 'adminOrders', data: { action, id, ...extra } })
    if (!result.result || !result.result.success) throw new Error('订单操作失败')
    this.loadDashboard(true)
  },

  async advanceOrder(e) {
    try { await this.callOrderAction('advance', e.currentTarget.dataset.id); wx.showToast({ title: '状态已更新', icon: 'success' }) }
    catch (err) { wx.showToast({ title: err.message || '操作失败', icon: 'none' }) }
  },

  cancelOrder(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({ title: '取消订单', content: '请填写取消原因，顾客会在详情中看到', editable: true, placeholderText: '例如：商品暂时缺货', success: async res => {
      if (!res.confirm) return
      try { await this.callOrderAction('cancel', id, { reason: res.content }); wx.showToast({ title: '订单已取消', icon: 'success' }) }
      catch (err) { wx.showToast({ title: err.message || '取消失败', icon: 'none' }) }
    }})
  },

  async resolveAfterSale(e) {
    try { await this.callOrderAction('resolveAfterSale', e.currentTarget.dataset.id); wx.showToast({ title: '售后已处理', icon: 'success' }) }
    catch (err) { wx.showToast({ title: err.message || '操作失败', icon: 'none' }) }
  },

  formatTime(value) {
    if (!value) return ''
    const date = new Date(value)
    const pad = item => String(item).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
})
