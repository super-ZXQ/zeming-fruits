Page({
  data: {
    orderId: '', order: {}, timeline: [],
    statusText: { pending: '待商家确认', confirmed: '已确认', preparing: '备货中', ready: '等待取货', delivering: '配送中', completed: '已完成', after_sale: '售后处理中', refund: '售后处理中', cancelled: '已取消' },
    statusDesc: { pending: '预约已提交，商家将尽快确认', confirmed: '商家已确认预约', preparing: '商家正在准备商品', ready: '商品已备好，请到店取货', delivering: '商品正在配送中', completed: '本次预约已完成', after_sale: '商家正在处理售后申请', refund: '商家正在处理售后申请', cancelled: '本次预约已取消' }
  },
  onLoad(options) { this.setData({ orderId: options.id || '' }) },
  onShow() {
    if (this.data.orderId) this.loadOrderDetail()
    else {
      wx.showToast({ title: '请从订单列表选择订单', icon: 'none' })
      setTimeout(() => wx.redirectTo({ url: '/pages/orders/orders' }), 500)
    }
  },
  async loadOrderDetail() {
    try {
      const result = await wx.cloud.callFunction({ name: 'customerOrders', data: { action: 'get', id: this.data.orderId } })
      if (!result.result || !result.result.success || !result.result.order) throw new Error('订单不存在')
      const rawOrder = result.result.order
      const order = this.normalizeOrder(rawOrder)
      this.setData({ order, timeline: this.buildTimeline(rawOrder) })
    }
    catch (err) {
      console.error('订单详情加载失败:', err)
      wx.showToast({ title: err.message || '订单加载失败', icon: 'none' })
    }
  },
  normalizeOrder(order) {
    const price = order.priceDetail || {}; const raw = order.address; const address = raw ? { name: raw.userName || raw.name, phone: raw.telNumber || raw.phone, detail: raw.detailInfo || raw.detail || '' } : null
    return { ...order, id: order._id || order.id, address, items: (order.goods || order.items || []).map(item => ({ ...item, count: item.quantity || item.count || 1 })), totalAmount: price.goodsTotal !== undefined ? price.goodsTotal : (order.totalAmount || 0), deliveryFee: price.deliveryFee || 0, finalAmount: price.total !== undefined ? price.total : (order.finalAmount || 0), createTimeText: this.formatTime(order.createTime), scheduleText: order.deliveryTime && order.deliveryTime.type === 'schedule' ? `${order.deliveryTime.date} ${order.deliveryTime.timeSlot}` : '尽快安排', contact: order.contact || (address ? { name: address.name, phone: address.phone } : null) }
  },
  buildTimeline(order) {
    const events = [{ desc: '预约已提交', time: order.createTime }]
    if (order.confirmedAt) events.push({ desc: '商家已确认预约', time: order.confirmedAt })
    if (order.preparingAt) events.push({ desc: '开始备货', time: order.preparingAt })
    if (order.readyAt) events.push({ desc: '商品已备好，等待取货', time: order.readyAt })
    if (order.deliveringAt) events.push({ desc: '商品开始配送', time: order.deliveringAt })
    if (order.completedAt) events.push({ desc: '预约已完成', time: order.completedAt })
    if (order.afterSaleAt) events.push({ desc: '已提交售后申请', time: order.afterSaleAt })
    if (order.afterSaleResolvedAt) events.push({ desc: '售后已处理', time: order.afterSaleResolvedAt })
    if (order.cancelledAt) events.push({ desc: `预约已取消${order.cancelReason ? `：${order.cancelReason}` : ''}`, time: order.cancelledAt })
    return events.reverse().map(item => ({ ...item, time: this.formatTime(item.time) }))
  },
  formatTime(value) { if (!value) return ''; const date = new Date(value); const pad = item => String(item).padStart(2, '0'); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}` },
  cancelOrder() { this.confirmAction('cancel', '取消预约', '确定取消这笔待确认预约吗？', '预约已取消') },
  confirmReceive() { this.confirmAction('confirmReceive', this.data.order.deliveryType === 'pickup' ? '确认取货' : '确认收货', '请确认商品已经收到。', '订单已完成') },
  applyAfterSale() { this.confirmAction('applyAfterSale', '申请售后', '提交后商家会电话联系您处理。', '售后申请已提交') },
  confirmAction(action, title, content, successTitle) {
    wx.showModal({ title, content, success: async res => {
      if (!res.confirm) return
      wx.showLoading({ title: '处理中', mask: true })
      try {
        const result = await wx.cloud.callFunction({ name: 'customerOrders', data: { action, id: this.data.orderId } })
        if (!result.result || !result.result.success) throw new Error('操作失败')
        wx.hideLoading()
        wx.showToast({ title: successTitle, icon: 'success' })
        this.loadOrderDetail()
      } catch (err) {
        wx.hideLoading()
        wx.showToast({ title: err.message || '操作失败', icon: 'none' })
      }
    } })
  },
  contactService() { wx.makePhoneCall({ phoneNumber: '15250878388' }) }
})
