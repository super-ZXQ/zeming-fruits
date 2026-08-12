const app = getApp()
const tencentMap = require('../../utils/tencentMap')

Page({
  data: {
    goods: [],
    goodsCount: 0,
    deliveryType: 'pickup',
    deliveryTime: 'now',
    scheduleDate: '',
    minDate: '',
    scheduleTimeIndex: 0,
    timeSlots: ['9:00-11:00', '11:00-13:00', '13:00-15:00', '15:00-17:00', '17:00-19:00', '19:00-21:00'],
    address: null,
    deliveryInfo: null,
    canDeliver: true,
    remark: '',
    outOfStockOption: 'call',
    selectedCoupon: null,
    availableCoupons: [],
    showCouponModal: false,
    agreedTerms: false,
    showPrivacyModal: false,
    canSubmit: false,
    submitting: false,
    priceDetail: {
      goodsTotal: 0,
      couponDiscount: 0,
      deliveryFee: 0,
      totalDiscount: 0,
      total: 0
    }
  },

  onLoad() {
    const today = this.formatDate(new Date())
    this.setData({ scheduleDate: today, minDate: today })
    this.initGoods()
    this.loadDefaultAddress()
  },

  onShow() {
    this.initGoods()
  },

  initGoods() {
    const goods = (app.globalData.cart || []).filter(item => item.selected).map(item => ({
      ...item,
      quantity: item.count || 1,
      totalPrice: ((Number(item.price) || 0) * (item.count || 1)).toFixed(2)
    }))
    this.setData({
      goods,
      goodsCount: goods.reduce((total, item) => total + item.quantity, 0)
    })
    this.calculatePrice()
  },

  async loadDefaultAddress() {
    try {
      const res = await wx.cloud.database().collection('addresses').orderBy('createdAt', 'desc').get()
      const saved = res.data.find(item => item.isDefault) || res.data[0]
      if (!saved) return
      this.setData({ address: this.normalizeSavedAddress(saved) })
      if (this.data.deliveryType === 'delivery') await this.checkDeliveryRange()
      this.calculatePrice()
    } catch (err) {
      console.error('加载默认地址失败:', err)
    }
  },

  normalizeSavedAddress(address) {
    return {
      userName: address.contactName,
      telNumber: address.phone,
      detailInfo: `${address.name || ''}${address.address || ''}${address.doorNumber || ''}`,
      location: { latitude: address.latitude, longitude: address.longitude }
    }
  },

  formatDate(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  async selectDeliveryType(e) {
    const deliveryType = e.currentTarget.dataset.type
    this.setData({ deliveryType })
    if (deliveryType === 'delivery' && this.data.address) await this.checkDeliveryRange()
    this.calculatePrice()
  },

  selectDeliveryTime(e) {
    this.setData({ deliveryTime: e.currentTarget.dataset.time })
  },

  onScheduleDateChange(e) {
    this.setData({ scheduleDate: e.detail.value })
  },

  onScheduleTimeChange(e) {
    this.setData({ scheduleTimeIndex: e.detail.value })
  },

  openMap() {
    wx.openLocation({
      latitude: 33.588399,
      longitude: 119.073823,
      name: '泽明果业',
      address: '江苏省淮安市清江浦区济南路东冠逸景花苑 1 号楼 1-5.1-6 号',
      scale: 16
    })
  },

  chooseAddress() {
    wx.chooseAddress({
      success: async res => {
        const detailInfo = `${res.provinceName}${res.cityName}${res.countyName}${res.detailInfo}`
        try {
          const location = await tencentMap.geocoder(detailInfo)
          this.setData({
            address: {
              userName: res.userName,
              telNumber: res.telNumber,
              detailInfo,
              location
            }
          })
          await this.checkDeliveryRange()
        } catch (err) {
          this.setData({ address: null, canDeliver: false, deliveryInfo: null })
          wx.showToast({ title: '地址无法定位，请更换地址', icon: 'none' })
        }
        this.calculatePrice()
      },
      fail: err => {
        if (!err.errMsg || !err.errMsg.includes('cancel')) {
          wx.showToast({ title: '请选择收货地址', icon: 'none' })
        }
      }
    })
  },

  async checkDeliveryRange() {
    const address = this.data.address
    if (!address || !address.location) return
    try {
      const deliveryInfo = await tencentMap.checkDeliveryRange(address.location)
      deliveryInfo.distanceStr = deliveryInfo.distance.toFixed(2)
      this.setData({ deliveryInfo, canDeliver: deliveryInfo.canDeliver })
      if (!deliveryInfo.canDeliver) wx.showToast({ title: '超出 3km 配送范围', icon: 'none' })
    } catch (err) {
      console.error('检查配送范围失败:', err)
      this.setData({ canDeliver: false, deliveryInfo: null })
      wx.showToast({ title: '无法计算配送距离', icon: 'none' })
    }
  },

  async calculatePrice() {
    const { goods, selectedCoupon, deliveryType, deliveryInfo } = this.data
    const goodsTotal = goods.reduce((total, item) => total + (Number(item.price) || 0) * item.quantity, 0)
    const couponDiscount = selectedCoupon && goodsTotal >= selectedCoupon.threshold
      ? Number(selectedCoupon.calculatedDiscount) || 0
      : 0
    const deliveryFee = deliveryType === 'delivery' && deliveryInfo && deliveryInfo.canDeliver ? 5 : 0
    const total = Math.max(0, goodsTotal - couponDiscount + deliveryFee)

    this.setData({
      priceDetail: {
        goodsTotal: Number(goodsTotal.toFixed(2)),
        couponDiscount: Number(couponDiscount.toFixed(2)),
        deliveryFee,
        totalDiscount: Number(couponDiscount.toFixed(2)),
        total: Number(total.toFixed(2))
      }
    })
    await this.loadAvailableCoupons(goodsTotal)
    this.checkCanSubmit()
  },

  async loadAvailableCoupons(goodsTotal) {
    try {
      const db = wx.cloud.database()
      const res = await db.collection('coupons').where({ status: 'active', threshold: db.command.lte(goodsTotal) }).get()
      const today = new Date().toISOString().slice(0, 10)
      const availableCoupons = res.data.filter(coupon =>
        (!coupon.validFrom || coupon.validFrom <= today) &&
        (!coupon.validTo || coupon.validTo >= today) &&
        (!coupon.stock || (coupon.usedCount || 0) < coupon.stock)
      ).map(coupon => {
        const calculatedDiscount = coupon.discountType === 'percent'
          ? goodsTotal * (1 - (Number(coupon.discount) || 10) / 10)
          : Number(coupon.value) || 0
        return { ...coupon, id: coupon._id, calculatedDiscount: Number(calculatedDiscount.toFixed(2)) }
      })
      this.setData({ availableCoupons })
    } catch (err) {
      console.error('加载优惠券失败:', err)
    }
  },

  showCouponPicker() {
    this.setData({ showCouponModal: true })
  },

  hideCouponPicker() {
    this.setData({ showCouponModal: false })
  },

  selectCoupon(e) {
    this.setData({ selectedCoupon: e.currentTarget.dataset.item || null, showCouponModal: false })
    this.calculatePrice()
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value })
  },

  selectOutOfStock(e) {
    this.setData({ outOfStockOption: e.currentTarget.dataset.value })
  },

  showPrivacyModal() {
    if (!this.data.agreedTerms) this.setData({ showPrivacyModal: true })
  },

  closePrivacyModal() {
    this.setData({ showPrivacyModal: false })
  },

  preventMove() {},

  agreePrivacy() {
    this.setData({ agreedTerms: true, showPrivacyModal: false })
    this.checkCanSubmit()
  },

  disagreePrivacy() {
    this.setData({ showPrivacyModal: false })
  },

  viewServiceAgreement() {
    wx.showModal({
      title: '预约服务说明',
      content: '提交预约后，商家会尽快确认商品与取货/配送时间。到店自取请在营业时间内到店；送货上门仅配送 3km 内地址，配送费固定为 5 元。',
      showCancel: false
    })
  },

  viewPrivacyPolicy() {
    wx.showModal({
      title: '用户隐私协议',
      content: '收货地址、联系方式和订单信息仅用于处理水果预约与配送服务。',
      showCancel: false
    })
  },

  checkCanSubmit() {
    const { goods, deliveryType, address, canDeliver, agreedTerms } = this.data
    const canSubmit = goods.length > 0 && agreedTerms && (deliveryType === 'pickup' || (address && canDeliver))
    this.setData({ canSubmit })
  },

  async submitOrder() {
    if (this.data.submitting) return
    if (!this.data.canSubmit) {
      const { deliveryType, address, canDeliver, agreedTerms } = this.data
      const title = !agreedTerms ? '请先阅读预约说明' :
        deliveryType === 'delivery' && !address ? '请选择收货地址' :
        deliveryType === 'delivery' && !canDeliver ? '当前地址超出配送范围' : '请选择商品'
      wx.showToast({ title, icon: 'none' })
      return
    }

    const { goods, deliveryType, address, deliveryTime, scheduleDate, scheduleTimeIndex, timeSlots, selectedCoupon, remark, outOfStockOption } = this.data
    this.setData({ submitting: true })
    wx.showLoading({ title: '提交预约中...', mask: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'createReservation',
        data: {
          goods: goods.map(item => ({ id: item.id, name: item.name, quantity: item.quantity })),
          deliveryType,
          address: deliveryType === 'delivery' ? address : null,
          deliveryTime: deliveryTime === 'schedule' ? { date: scheduleDate, timeSlot: timeSlots[scheduleTimeIndex] } : null,
          couponId: selectedCoupon && selectedCoupon.id,
          remark,
          outOfStockOption
        }
      })
      if (!res.result || !res.result.success) throw new Error(res.result?.error || '预约提交失败')

      app.globalData.cart = app.globalData.cart.filter(item => !item.selected)
      app.saveCartToStorage()
      app.updateCartBadge()
      wx.hideLoading()
      wx.showToast({ title: '预约提交成功', icon: 'success' })
      setTimeout(() => wx.redirectTo({ url: `/pages/orderDetail/orderDetail?id=${res.result.data.orderId}` }), 1200)
    } catch (err) {
      wx.hideLoading()
      console.error('预约提交失败:', err)
      wx.showToast({ title: err.message || '预约提交失败', icon: 'none' })
      this.setData({ submitting: false })
    }
  }
})
