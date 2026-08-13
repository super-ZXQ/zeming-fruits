Page({
  data: {
    orderId: '', order: {}, logisticsInfo: [],
    statusText: { pending: '待商家确认', confirmed: '已确认', preparing: '备货中', delivering: '配送中', completed: '已完成', refund: '售后中', cancelled: '已取消' },
    statusDesc: { pending: '预约已提交，商家将尽快与您确认', confirmed: '商家已确认您的预约', preparing: '商家正在为您准备商品', delivering: '商品正在配送中', completed: '订单已完成，感谢您的购买', refund: '售后申请处理中', cancelled: '订单已取消' }
  },

  onLoad(options) { this.setData({ orderId: options.id }) },
  onShow() { this.loadOrderDetail() },

  async loadOrderDetail() {
    try {
      const res = await wx.cloud.database().collection('orders').doc(this.data.orderId).get()
      const order = this.normalizeOrder(res.data)
      this.setData({ order })
      this.generateLogistics(order)
    } catch (err) {
      console.error('加载订单详情失败:', err)
      wx.showToast({ title: '订单加载失败', icon: 'none' })
    }
  },

  normalizeOrder(order) {
    const priceDetail = order.priceDetail || {}
    const address = order.address ? {
      name: order.address.userName || order.address.name,
      phone: order.address.telNumber || order.address.phone,
      province: order.address.provinceName || order.address.province || '',
      city: order.address.cityName || order.address.city || '',
      district: order.address.countyName || order.address.district || '',
      detail: order.address.detailInfo || order.address.detail || ''
    } : null
    return {
      ...order,
      id: order._id || order.id,
      address,
      items: (order.goods || order.items || []).map(item => ({ ...item, count: item.quantity || item.count || 1 })),
      totalAmount: priceDetail.goodsTotal !== undefined ? priceDetail.goodsTotal : (order.totalAmount || 0),
      deliveryFee: priceDetail.deliveryFee !== undefined ? priceDetail.deliveryFee : (order.deliveryFee || 0),
      finalAmount: priceDetail.total !== undefined ? priceDetail.total : (order.finalAmount || 0),
      createTime: this.formatTime(order.createTime),
      confirmedTime: this.formatTime(order.confirmedAt)
    }
  },

  formatTime(value) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const pad = item => String(item).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  },

  generateLogistics(order) {
    const confirmedAt = order.confirmedTime || order.createTime
    const logistics = []
    if (['confirmed', 'preparing'].includes(order.status)) logistics.push({ desc: '商家已确认预约，正在备货', time: confirmedAt })
    if (order.status === 'delivering') {
      logistics.push({ desc: '商品正在配送中', time: this.formatTime(order.deliveringAt) || confirmedAt })
      logistics.push({ desc: '商家已确认预约，正在备货', time: confirmedAt })
    }
    if (order.status === 'completed') {
      logistics.push({ desc: '商品已送达，订单已完成', time: this.formatTime(order.completedAt) || confirmedAt })
      logistics.push({ desc: '商家已确认预约，开始备货', time: confirmedAt })
    }
    this.setData({ logisticsInfo: logistics })
  },

  viewLogistics() {
    wx.showModal({ title: '配送进度', content: '订单正在处理中，如需帮助请联系商家。', showCancel: false })
  },

  confirmReceive() { this.updateOrder('confirmReceive', '确认收货', '确定已收到商品吗？', '收货成功') },
  applyRefund() { this.updateOrder('applyRefund', '申请售后', '确定要申请售后吗？', '售后申请已提交') },

  updateOrder(action, title, content, successTitle) {
    wx.showModal({ title, content, success: async res => {
      if (!res.confirm) return
      try {
        wx.showLoading({ title: '处理中', mask: true })
        const result = await wx.cloud.callFunction({ name: 'customerOrders', data: { action, id: this.data.orderId } })
        if (!result.result || !result.result.success) throw new Error('订单状态更新失败')
        wx.showToast({ title: successTitle, icon: 'success' })
        this.loadOrderDetail()
      } catch (err) {
        wx.showToast({ title: err.message || '操作失败', icon: 'none' })
      } finally { wx.hideLoading() }
    }})
  }
})
