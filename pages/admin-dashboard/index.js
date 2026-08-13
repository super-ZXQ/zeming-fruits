Page({
  data: {
    authorized: false,
    stats: { todaySales: '0.00', todayOrders: 0, newUsers: 0, couponUsed: 0 },
    hotGoods: [],
    orders: [],
    orderFilter: 'all',
    statusMap: {
      pending: '待确认', confirmed: '已确认', preparing: '备货中',
      delivering: '配送中', completed: '已完成', cancelled: '已取消'
    },
    actionMap: {
      pending: '确认预约', confirmed: '开始备货', preparing: '开始配送', delivering: '完成订单'
    }
  },

  onLoad() {
    this.checkAdmin()
  },

  onShow() {
    if (this.data.authorized) this.loadDashboard()
  },

  async checkAdmin() {
    try {
      const result = await wx.cloud.callFunction({ name: 'adminAuth' })
      if (!result.result || !result.result.isAdmin) throw new Error('您不是管理员')
      this.setData({ authorized: true })
      this.loadDashboard()
    } catch (err) {
      wx.showModal({
        title: '无访问权限',
        content: err.message || '请使用已授权的管理员账号登录',
        showCancel: false,
        success: () => wx.navigateBack()
      })
    }
  },

  async loadDashboard() {
    try {
      wx.showLoading({ title: '加载中', mask: true })
      const result = await wx.cloud.callFunction({ name: 'adminOrders', data: { action: 'dashboard' } })
      if (!result.result || !result.result.success) throw new Error('加载后台数据失败')
      const { actionMap } = this.data
      const orders = (result.result.orders || []).map((order, index) => ({
        ...order,
        orderIndex: (result.result.orders || []).length - index,
        createTimeText: this.formatTime(order.createTime),
        nextAction: actionMap[order.status] || ''
      })).filter(order => this.data.orderFilter === 'all' || order.status === this.data.orderFilter)
      this.setData({
        stats: result.result.stats || this.data.stats,
        hotGoods: result.result.hotGoods || [],
        orders
      })
    } catch (err) {
      console.error('加载后台数据失败:', err)
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  filterOrders(e) {
    this.setData({ orderFilter: e.currentTarget.dataset.filter })
    this.loadDashboard()
  },

  async advanceOrder(e) {
    const id = e.currentTarget.dataset.id
    try {
      wx.showLoading({ title: '处理中', mask: true })
      const result = await wx.cloud.callFunction({ name: 'adminOrders', data: { action: 'advance', id } })
      if (!result.result || !result.result.success) throw new Error('订单状态更新失败')
      wx.showToast({ title: '订单状态已更新', icon: 'success' })
      this.loadDashboard()
    } catch (err) {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  formatTime(date) {
    if (!date) return ''
    const d = new Date(date)
    if (Number.isNaN(d.getTime())) return ''
    const pad = value => String(value).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
})
