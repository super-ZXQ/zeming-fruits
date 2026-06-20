Page({
  data: {
    orderId: '',
    order: {},
    logisticsInfo: [],
    statusText: {
      pending: '待付款',
      paid: '处理中',
      completed: '已完成',
      refund: '售后中',
      cancelled: '已取消'
    },
    statusDesc: {
      pending: '请尽快完成支付',
      paid: '商家正在为您准备商品',
      completed: '订单已完成，感谢您的购买',
      refund: '售后申请处理中',
      cancelled: '订单已取消'
    }
  },

  onLoad(options) {
    this.setData({ orderId: options.id })
  },

  onShow() {
    this.loadOrderDetail()
  },

  async loadOrderDetail() {
    try {
      const db = wx.cloud.database()
      const res = await db.collection('orders').doc(this.data.orderId).get()
      const order = this.normalizeOrder(res.data)
      this.setData({ order })
      this.generateLogistics(order)
    } catch (err) {
      console.error('加载订单详情失败:', err)
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
    const totalAmount = priceDetail.goodsTotal !== undefined ? priceDetail.goodsTotal : (order.totalAmount || 0)
    const deliveryFee = priceDetail.deliveryFee !== undefined ? priceDetail.deliveryFee : (order.deliveryFee || 0)
    const finalAmount = priceDetail.total !== undefined ? priceDetail.total : (order.finalAmount || 0)
    const address = order.address
      ? {
          name: order.address.userName || order.address.name,
          phone: order.address.telNumber || order.address.phone,
          province: order.address.provinceName || order.address.province || '',
          city: order.address.cityName || order.address.city || '',
          district: order.address.countyName || order.address.district || '',
          detail: order.address.detailInfo || order.address.detail || ''
        }
      : null

    return {
      ...order,
      id: order._id || order.id,
      status,
      address,
      items: (order.goods || order.items || []).map(item => ({
        ...item,
        count: item.quantity || item.count || 1
      })),
      totalAmount,
      deliveryFee,
      finalAmount,
      createTime: this.formatTime(order.createTime),
      payTime: this.formatTime(order.paidAt || order.payTime)
    }
  },

  formatTime(value) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
  },

  generateLogistics(order) {
    const logistics = []
    const paidAt = order.payTime || order.createTime

    if (order.status === 'paid') {
      logistics.push({ desc: '订单已支付，商家正在备货', time: paidAt })
    } else if (order.status === 'completed') {
      logistics.push({ desc: '商品已送达，订单已完成', time: this.formatTime(order.completedAt) || paidAt })
      logistics.push({ desc: '订单已支付，商家开始备货', time: paidAt })
    }

    this.setData({ logisticsInfo: logistics })
  },

  async payOrder() {
    try {
      wx.showLoading({ title: '正在发起支付...', mask: true })
      const res = await wx.cloud.callFunction({
        name: 'payOrder',
        data: { orderId: this.data.orderId }
      })
      wx.hideLoading()

      if (!res.result || !res.result.success) {
        throw new Error(res.result?.error || '发起支付失败')
      }

      const payment = res.result.data
      await new Promise((resolve, reject) => {
        wx.requestPayment({
          timeStamp: payment.timeStamp,
          nonceStr: payment.nonceStr,
          package: payment.package,
          signType: payment.signType || 'MD5',
          paySign: payment.paySign,
          success: resolve,
          fail: reject
        })
      })

      wx.showToast({ title: '支付成功', icon: 'success' })
      setTimeout(() => this.loadOrderDetail(), 1000)
    } catch (err) {
      wx.hideLoading()
      wx.showToast({
        title: err.errMsg && err.errMsg.includes('cancel') ? '已取消支付' : '支付失败',
        icon: 'none'
      })
    }
  },

  viewLogistics() {
    wx.showModal({
      title: '配送进度',
      content: '订单正在准备中，如需帮助请联系客服。',
      showCancel: false
    })
  },

  confirmReceive() {
    wx.showModal({
      title: '确认收货',
      content: '确定已收到商品吗？',
      success: async (res) => {
        if (!res.confirm) return
        const db = wx.cloud.database()
        await db.collection('orders').doc(this.data.orderId).update({
          data: {
            status: 'completed',
            completedAt: db.serverDate()
          }
        })
        wx.showToast({ title: '收货成功', icon: 'success' })
        this.loadOrderDetail()
      }
    })
  },

  applyRefund() {
    wx.showModal({
      title: '申请售后',
      content: '确定要申请售后吗？',
      success: async (res) => {
        if (!res.confirm) return
        await wx.cloud.database().collection('orders').doc(this.data.orderId).update({
          data: { status: 'refund' }
        })
        wx.showToast({ title: '售后申请已提交', icon: 'success' })
        this.loadOrderDetail()
      }
    })
  }
})
