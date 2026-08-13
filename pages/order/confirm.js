const app = getApp()

Page({
  data: {
    goods: [],
    goodsCount: 0,
    deliveryType: 'pickup',
    deliveryTimeType: 'asap',
    scheduleDate: '',
    minDate: '',
    scheduleTimeIndex: 0,
    timeSlots: ['9:00-11:00', '11:00-13:00', '13:00-15:00', '15:00-17:00', '17:00-19:00', '19:00-21:00'],
    address: null,
    quote: null,
    quoteError: '',
    remark: '',
    agreedTerms: false,
    submitting: false,
    quoting: false,
    requestId: ''
  },

  onLoad() {
    const today = this.formatDate(new Date())
    this.setData({ scheduleDate: today, minDate: today, requestId: this.createRequestId() })
    this.initGoods()
  },

  onShow() {
    this.initGoods()
    this.loadAddress()
  },

  createRequestId() {
    return `r_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  },

  formatDate(date) {
    const pad = value => String(value).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  },

  initGoods() {
    const goods = (app.globalData.cart || []).filter(item => item.selected).map(item => ({ id: item.id, name: item.name, price: item.price, quantity: item.count || 1, imageUrl: item.imageUrl || '', emoji: item.emoji || '🍎' }))
    this.setData({ goods, goodsCount: goods.reduce((sum, item) => sum + item.quantity, 0) })
    if (goods.length) this.loadQuote()
  },

  async loadAddress() {
    try {
      const selectedId = wx.getStorageSync('checkoutAddressId')
      if (selectedId) wx.removeStorageSync('checkoutAddressId')
      const result = await wx.cloud.callFunction({ name: 'customerProfile', data: { action: 'list' } })
      if (!result.result || !result.result.success) return
      const list = result.result.addresses || []
      const saved = (selectedId && list.find(item => item._id === selectedId)) || list.find(item => item.isDefault) || list[0]
      if (saved) this.setData({ address: this.normalizeAddress(saved) })
      this.loadQuote()
    } catch (err) {}
  },

  normalizeAddress(address) {
    return {
      userName: address.contactName,
      telNumber: address.phone,
      detailInfo: `${address.name || ''}${address.address || ''}${address.doorNumber || ''}`,
      location: { latitude: address.latitude, longitude: address.longitude }
    }
  },

  reservationData() {
    return {
      goods: this.data.goods.map(item => ({ id: item.id, quantity: item.quantity })),
      deliveryType: this.data.deliveryType,
      address: this.data.deliveryType === 'delivery' ? this.data.address : null,
      deliveryTime: this.data.deliveryTimeType === 'schedule'
        ? { type: 'schedule', date: this.data.scheduleDate, timeSlot: this.data.timeSlots[this.data.scheduleTimeIndex] }
        : { type: 'asap' }
    }
  },

  async loadQuote() {
    if (!this.data.goods.length || (this.data.deliveryType === 'delivery' && !this.data.address) || this.data.quoting) return
    this.setData({ quoting: true, quoteError: '' })
    try {
      const result = await wx.cloud.callFunction({ name: 'createReservation', data: { action: 'quote', ...this.reservationData() } })
      if (!result.result || !result.result.success) throw new Error(result.result && result.result.error || '报价失败')
      const quote = result.result.quote
      this.setData({ quote, goods: quote.goods, goodsCount: quote.goods.reduce((sum, item) => sum + item.quantity, 0) })
      this.syncCartPrices(quote.goods)
    } catch (err) {
      this.setData({ quote: null, quoteError: err.message || '暂时无法计算预约金额' })
    } finally {
      this.setData({ quoting: false })
    }
  },

  syncCartPrices(goods) {
    const map = Object.fromEntries(goods.map(item => [item.id, item]))
    app.globalData.cart.forEach(item => {
      if (map[item.id]) Object.assign(item, { name: map[item.id].name, price: map[item.id].price, imageUrl: map[item.id].imageUrl, emoji: map[item.id].emoji })
    })
    app.saveCartToStorage()
  },

  selectDeliveryType(e) {
    this.setData({ deliveryType: e.currentTarget.dataset.type, quote: null })
    this.loadQuote()
  },

  selectDeliveryTime(e) {
    this.setData({ deliveryTimeType: e.currentTarget.dataset.time, quote: null })
    this.loadQuote()
  },

  onScheduleDateChange(e) { this.setData({ scheduleDate: e.detail.value, quote: null }); this.loadQuote() },
  onScheduleTimeChange(e) { this.setData({ scheduleTimeIndex: Number(e.detail.value), quote: null }); this.loadQuote() },
  onRemarkInput(e) { this.setData({ remark: e.detail.value }) },
  toggleAgreement() { this.setData({ agreedTerms: !this.data.agreedTerms }) },
  chooseAddress() { wx.navigateTo({ url: '/pages/address/address?select=1' }) },

  openMap() {
    wx.openLocation({ latitude: 33.588399, longitude: 119.073823, name: '泽明果业', address: '江苏省淮安市清江浦区济南路东冠逸景花苑 1 号楼 1-5.1-6 号', scale: 16 })
  },

  viewAgreement() {
    wx.showModal({ title: '预约服务说明', content: '本小程序只提交预约，不在线收款。商家确认后安排备货；3km 内配送费 5 元；待确认预约可自行取消，确认后请联系商家。', showCancel: false })
  },

  async submitOrder() {
    if (this.data.submitting) return
    if (!this.data.agreedTerms) return wx.showToast({ title: '请先同意预约服务说明', icon: 'none' })
    if (!this.data.quote) return wx.showToast({ title: this.data.quoteError || '请等待金额更新', icon: 'none' })

    this.setData({ submitting: true })
    wx.showLoading({ title: '提交预约中', mask: true })
    try {
      const result = await wx.cloud.callFunction({
        name: 'createReservation',
        data: { action: 'submit', ...this.reservationData(), quoteVersion: this.data.quote.quoteVersion, requestId: this.data.requestId, remark: this.data.remark }
      })
      if (!result.result || !result.result.success) {
        if (result.result && result.result.code === 'QUOTE_CHANGED' && result.result.quote) {
          this.setData({ quote: result.result.quote, goods: result.result.quote.goods })
          wx.showModal({ title: '金额已更新', content: `最新预估金额为 ¥${result.result.quote.priceDetail.total}，请确认后重新提交。`, showCancel: false })
          return
        }
        throw new Error(result.result && result.result.error || '预约提交失败')
      }
      app.globalData.cart = app.globalData.cart.filter(item => !item.selected)
      app.saveCartToStorage()
      app.updateCartBadge()
      wx.showToast({ title: '预约提交成功', icon: 'success' })
      setTimeout(() => wx.redirectTo({ url: `/pages/orderDetail/orderDetail?id=${result.result.data.orderId}` }), 700)
    } catch (err) {
      wx.showToast({ title: err.message || '预约提交失败', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ submitting: false })
    }
  }
})
