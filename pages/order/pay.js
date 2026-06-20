const app = getApp()
const tencentMap = require('../../utils/tencentMap')

Page({
  data: {
    goods: [],
    deliveryType: 'pickup',
    deliveryTime: 'now',
    deliveryInfo: null,
    canDeliver: true,
    address: null,
    userLocation: null,
    scheduleDate: '',
    minDate: '',
    scheduleTimeIndex: 0,
    timeSlots: ['9:00-11:00', '11:00-13:00', '13:00-15:00', '15:00-17:00', '17:00-19:00', '19:00-21:00'],
    remark: '',
    selectedCoupon: null,
    availableCoupons: [],
    priceDetail: {
      goodsTotal: 0,
      couponDiscount: 0,
      deliveryFee: 0,
      activityDiscount: 0,
      totalDiscount: 0,
      total: 0
    },
    showCouponModal: false,
    canSubmit: true,
    canPay: false,
    userInfo: null,
    hasPhone: false,
    agreedTerms: false,
    showPrivacyModal: false,
    outOfStockOption: 'call',
    goodsCount: 0,
    pickupDistance: '',
    pendingOrderId: ''
  },

  onLoad(options) {
    this.initGoods()
    this.initScheduleDate()
    this.loadUserInfo()
    this.loadDefaultAddress()
    this.calculatePrice()
  },

  onShow() {
    this.initGoods()
    this.loadDefaultAddress()
    this.calculatePrice()
  },

  async loadDefaultAddress() {
    if (this.data.address) return

    try {
      const res = await wx.cloud.database().collection('addresses')
        .orderBy('createdAt', 'desc')
        .get()
      if (!res.data.length) return

      const saved = res.data.find(item => item.isDefault) || res.data[0]
      this.setData({
        address: {
          userName: saved.contactName,
          telNumber: saved.phone,
          provinceName: '',
          cityName: '',
          countyName: '',
          detailInfo: `${saved.address || ''}${saved.doorNumber || ''}`
        }
      })
      this.checkCanPay()
    } catch (err) {
      console.error('加载默认地址失败:', err)
    }
  },

  async loadUserInfo() {
    const user = app.globalData.userInfo
    this.setData({
      userInfo: user,
      hasPhone: !!(user && user.phone)
    })
  },

  initGoods() {
    const cart = app.globalData.cart || []
    const goods = cart.filter(item => item.selected).map(item => ({
      ...item,
      quantity: item.count || item.quantity || 1
    }))
    const goodsCount = goods.reduce((sum, item) => sum + item.quantity, 0)
    this.setData({ goods, goodsCount })
  },

  initScheduleDate() {
    const today = new Date()
    const todayStr = this.formatDate(today)
    this.setData({ 
      scheduleDate: todayStr,
      minDate: todayStr
    })
  },

  formatDate(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  async selectDeliveryType(e) {
    const type = e.currentTarget.dataset.type
    this.setData({ deliveryType: type })
    if (type === 'delivery' && this.data.address) {
      await this.checkDeliveryRange()
    }
    this.calculatePrice()
    this.checkCanPay()
  },

  selectDeliveryTime(e) {
    const time = e.currentTarget.dataset.time
    this.setData({ deliveryTime: time })
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
    wx.showLoading({ title: '加载中...', mask: true })
    
    wx.chooseAddress({
      success: (res) => {
        wx.hideLoading()
        console.log('选择地址成功:', res)
        
        const address = {
          userName: res.userName,
          telNumber: res.telNumber,
          provinceName: res.provinceName,
          cityName: res.cityName,
          countyName: res.countyName,
          detailInfo: res.detailInfo
        }
        
        this.setData({ address })
        
        this.saveUserAddress(address).then(async () => {
          if (this.data.deliveryType === 'delivery') {
            await this.checkDeliveryRange()
            
            if (this.data.canDeliver) {
              this.setData({ deliveryType: 'delivery' })
              this.calculatePrice()
            } else {
              wx.showToast({
                title: '超出配送范围，请选择其他地址',
                icon: 'none'
              })
            }
          } else {
            this.setData({ deliveryType: 'delivery' })
            await this.checkDeliveryRange()
            this.calculatePrice()
          }
        })
      },
      fail: (err) => {
        wx.hideLoading()
        console.log('选择地址失败:', err)
        
        if (err.errMsg && (err.errMsg.includes('cancel') || err.errMsg.includes('授权'))) {
          wx.showToast({ title: '您取消了地址选择', icon: 'none' })
        } else {
          wx.showModal({
            title: '提示',
            content: '需要获取您的收货地址权限',
            confirmText: '去设置',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.openSetting()
              }
            }
          })
        }
      }
    })
  },

  async saveUserAddress(address) {
    try {
      const db = wx.cloud.database()
      const userId = app.globalData.userInfo && app.globalData.userInfo.id
      if (!userId) return

      const userRes = await db.collection('users').doc(userId).get()
      
      if (userRes.data) {
        const user = userRes.data
        const addresses = user.addresses || []
        
        const newAddress = {
          id: Date.now().toString(),
          name: address.userName,
          phone: address.telNumber,
          province: address.provinceName,
          city: address.cityName,
          district: address.countyName,
          detail: address.detailInfo,
          fullAddress: `${address.provinceName}${address.cityName}${address.countyName}${address.detailInfo}`,
          isDefault: addresses.length === 0
        }
        
        const existIndex = addresses.findIndex(a => 
          a.fullAddress === newAddress.fullAddress
        )
        
        if (existIndex === -1) {
          addresses.unshift(newAddress)
          
          await db.collection('users').doc(user._id).update({
            data: {
              addresses: addresses,
              updatedAt: db.serverDate()
            }
          })
        }
      }
    } catch (err) {
      console.error('保存地址失败:', err)
    }
  },

  async checkDeliveryRange() {
    if (!this.data.address) return
    
    try {
      console.log('========== 检查配送范围 ==========')
      console.log('地址信息:', this.data.address)
      console.log('用户定位:', this.data.userLocation)
      
      let location = this.data.userLocation
      
      if (!location) {
        const addressStr = `${this.data.address.provinceName}${this.data.address.cityName}${this.data.address.countyName}${this.data.address.detailInfo}`
        console.log('地址字符串:', addressStr)
        
        try {
          location = await tencentMap.geocoder(addressStr)
          console.log('地理编码结果:', location)
        } catch (geoErr) {
          console.error('地理编码失败:', geoErr)
          this.setData({
            canDeliver: false,
            deliveryInfo: null
          })
          wx.showToast({
            title: '地址无法定位，请重新选择',
            icon: 'none'
          })
          this.calculatePrice()
          return
        }
      }
      
      console.log('最终计算位置:', location)
      
      const result = await tencentMap.checkDeliveryRange({
        latitude: location.latitude,
        longitude: location.longitude
      })
      
      console.log('配送范围检查结果:', result)
      
      result.distanceStr = result.distance ? result.distance.toFixed(2) : '0.00'
      
      this.setData({
        deliveryInfo: result,
        canDeliver: result.canDeliver
      })
      
      if (!result.canDeliver) {
        wx.showToast({
          title: '超出配送范围',
          icon: 'none'
        })
      }
      
      this.calculatePrice()
    } catch (err) {
      console.error('检查配送范围失败:', err)
      this.setData({ canDeliver: false })
    }
  },

  async calculatePrice() {
    const { goods, selectedCoupon, deliveryType, deliveryInfo } = this.data
    
    if (goods.length === 0) return
    
    let goodsTotal = 0
    let goodsCount = 0
    for (const item of goods) {
      goodsTotal += item.price * item.quantity
      goodsCount += item.quantity
    }
    
    let couponDiscount = 0
    if (selectedCoupon && goodsTotal >= selectedCoupon.threshold) {
      couponDiscount = selectedCoupon.calculatedDiscount || selectedCoupon.value || 0
    }
    
    let deliveryFee = 0
    if (deliveryType === 'delivery' && deliveryInfo) {
      deliveryFee = typeof deliveryInfo.deliveryFee === 'number'
        ? deliveryInfo.deliveryFee
        : 5
      const threshold = Number(app.globalData.shopSettings?.freeDeliveryThreshold) || 39
      if (goodsTotal >= threshold) {
        deliveryFee = 0
      }
    }
    
    let total = goodsTotal - couponDiscount + deliveryFee
    if (total < 1) total = 1
    
    const totalDiscount = couponDiscount
    
    this.setData({
      goodsCount,
      priceDetail: {
        goodsTotal: parseFloat(goodsTotal.toFixed(2)),
        couponDiscount: parseFloat(couponDiscount.toFixed(2)),
        deliveryFee: parseFloat(deliveryFee.toFixed(2)),
        activityDiscount: 0,
        totalDiscount: parseFloat(totalDiscount.toFixed(2)),
        total: parseFloat(total.toFixed(2))
      }
    })

    await this.loadAvailableCoupons(goodsTotal)
    this.checkCanPay()
  },

  async loadAvailableCoupons(goodsTotal) {
    try {
      const db = wx.cloud.database()
      const res = await db.collection('coupons')
        .where({
          status: 'active',
          threshold: db.command.lte(goodsTotal)
        })
        .get()
      
      const today = new Date().toISOString().split('T')[0]
      const availableCoupons = res.data
        .filter(coupon => {
          const inDateRange = (!coupon.validFrom || coupon.validFrom <= today) &&
            (!coupon.validTo || coupon.validTo >= today)
          const hasStock = !coupon.stock || (coupon.usedCount || 0) < coupon.stock
          return inDateRange && hasStock
        })
        .map(coupon => {
        let calculatedDiscount = 0
        if (goodsTotal >= coupon.threshold) {
          if (coupon.discountType === 'cash') {
            calculatedDiscount = coupon.value || 0
          } else if (coupon.discountType === 'percent') {
            calculatedDiscount = goodsTotal * (1 - (coupon.discount || 10) / 10)
          }
        }
        return {
          ...coupon,
          id: coupon._id,
          calculatedDiscount: parseFloat(calculatedDiscount.toFixed(2))
        }
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
    const item = e.currentTarget.dataset.item
    this.setData({
      selectedCoupon: item,
      showCouponModal: false
    })
    this.calculatePrice()
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value })
  },

  selectOutOfStock(e) {
    const value = e.currentTarget.dataset.value
    this.setData({ outOfStockOption: value })
  },

  toggleAgreement() {
    this.showPrivacyModal()
  },

  showPrivacyModal() {
    if (!this.data.agreedTerms) {
      this.setData({ showPrivacyModal: true })
    }
  },

  preventMove() {
    return false
  },

  agreePrivacy() {
    this.setData({
      agreedTerms: true,
      showPrivacyModal: false
    })
    wx.setStorageSync('payPrivacyAgreed', true)
    this.checkCanPay()
  },

  disagreePrivacy() {
    this.setData({
      showPrivacyModal: false
    })
    wx.showToast({
      title: '需要同意协议才能支付',
      icon: 'none',
      duration: 2000
    })
  },

  closePrivacyModal() {
    this.setData({ showPrivacyModal: false })
  },

  viewServiceAgreement() {
    wx.showModal({
      title: '用户服务条款',
      content: '【泽明果业用户服务条款】\n\n一、订单确认\n提交订单后请在30分钟内完成支付，超时订单将自动取消。\n\n二、配送说明\n• 到店自取：营业时间 08:00-21:00\n• 送货上门：约30分钟送达（视距离而定）\n\n三、退换货政策\n商品质量问题可在24小时内申请退换货。\n\n四、用户责任\n请确保收货地址准确，保持电话畅通。',
      showCancel: false,
      confirmText: '我已了解'
    })
  },

  viewPrivacyPolicy() {
    wx.showModal({
      title: '用户隐私协议',
      content: '【泽明果业隐私协议】\n\n一、信息收集\n1. 收货地址：用于商品配送\n2. 联系方式：用于订单联系和配送通知\n3. 订单信息：用于提供订单服务\n\n二、信息使用\n仅用于订单处理和配送服务。\n\n三、信息保护\n采用安全措施保护您的个人信息。\n\n四、权利行使\n您有权访问或删除您的个人信息。',
      showCancel: false,
      confirmText: '我已了解'
    })
  },

  checkCanPay() {
    const { goods, deliveryType, address, canDeliver, agreedTerms } = this.data
    
    let canPay = false
    
    if (goods.length === 0) {
      canPay = false
    } else if (!agreedTerms) {
      // 所有模式都需要先同意服务协议
      canPay = false
    } else if (deliveryType === 'pickup') {
      canPay = true
    } else if (deliveryType === 'delivery') {
      canPay = address && canDeliver
    }
    
    this.setData({ canPay })
  },

  async getPhoneNumber(e) {
    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      console.log('用户拒绝授权手机号')
      return
    }
    
    wx.showLoading({ title: '获取中...', mask: true })
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'decryptPhone',
        data: {
          code: e.detail.code
        }
      })
      
      wx.hideLoading()
      
      if (res.result && res.result.success) {
        const phone = res.result.data.phoneNumber
        const userId = app.globalData.userInfo && app.globalData.userInfo.id
        if (userId) {
          await wx.cloud.database().collection('users').doc(userId).update({
            data: {
              phone,
              updatedAt: wx.cloud.database().serverDate()
            }
          })
        }
        if (app.globalData.userInfo) {
          app.globalData.userInfo.phone = phone
          wx.setStorageSync('userInfo', app.globalData.userInfo)
        }
        this.setData({
          hasPhone: true,
          'userInfo.phone': phone
        })
        wx.showToast({ title: '绑定成功', icon: 'success' })
      } else {
        throw new Error(res.result?.error || '获取失败')
      }
    } catch (err) {
      wx.hideLoading()
      console.error('获取手机号失败:', err)
      wx.showToast({ title: '获取失败', icon: 'none' })
    }
  },

  async submitOrder() {
    if (!this.data.canSubmit) return

    if (!this.data.canPay) {
      if (!this.data.agreedTerms) {
        wx.showToast({ title: '请先同意服务协议', icon: 'none' })
      } else if (this.data.deliveryType === 'delivery' && !this.data.address) {
        wx.showToast({ title: '请选择收货地址', icon: 'none' })
      } else if (this.data.deliveryType === 'delivery' && !this.data.canDeliver) {
        wx.showToast({ title: '当前地址超出配送范围', icon: 'none' })
      } else {
        wx.showToast({ title: '请完善订单信息', icon: 'none' })
      }
      return
    }
    
    const { goods, deliveryType, address, deliveryTime, scheduleDate, scheduleTimeIndex, timeSlots, selectedCoupon, remark, priceDetail, outOfStockOption } = this.data
    
    console.log('提交订单数据:', {
      goods,
      deliveryType,
      address,
      deliveryTime,
      priceDetail
    })
    
    this.setData({ canSubmit: false })
    wx.showLoading({ title: '提交中...', mask: true })
    
    try {
      if (this.data.pendingOrderId) {
        wx.hideLoading()
        const paySuccess = await this.createPayment(this.data.pendingOrderId)
        if (!paySuccess) {
          this.setData({ canSubmit: true })
        }
        return
      }

      const db = wx.cloud.database()
      const ordersCollection = db.collection('orders')
      
      const orderData = {
        orderType: 'goods',
        userId: app.globalData.userInfo && app.globalData.userInfo.id,
        goods: goods.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          emoji: item.emoji
        })),
        deliveryType,
        address: deliveryType === 'delivery' ? {
          userName: address.userName,
          telNumber: address.telNumber,
          provinceName: address.provinceName,
          cityName: address.cityName,
          countyName: address.countyName,
          detailInfo: address.detailInfo
        } : null,
        deliveryTime: deliveryTime === 'schedule' ? {
          date: scheduleDate,
          timeSlot: timeSlots[scheduleTimeIndex]
        } : null,
        coupon: selectedCoupon ? {
          id: selectedCoupon.id,
          name: selectedCoupon.name,
          discount: selectedCoupon.calculatedDiscount
        } : null,
        remark,
        outOfStockOption,
        priceDetail,
        status: 'pending',
        createTime: db.serverDate()
      }
      
      const result = await ordersCollection.add({ data: orderData })
      this.setData({ pendingOrderId: result._id })
      
      wx.hideLoading()
      
      const paySuccess = await this.createPayment(result._id)
      
      if (!paySuccess) {
        this.setData({ canSubmit: true })
        wx.showToast({ title: '支付失败，请重试', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      console.error('提交订单失败:', err)
      wx.showToast({
        title: '提交失败',
        icon: 'none'
      })
      this.setData({ canSubmit: true })
    }
  },

  async createPayment(orderId) {
    wx.showLoading({ title: '正在发起支付...', mask: true })
    
    try {
      console.log('========== 开始支付流程 ==========')
      console.log('订单 ID:', orderId)
      
      const res = await wx.cloud.callFunction({
        name: 'payOrder',
        data: {
          orderId: orderId
        }
      })
      
      console.log('云函数返回结果:', JSON.stringify(res, null, 2))
      wx.hideLoading()
      
      if (!res.result) {
        console.error('云函数调用失败，无返回结果')
        wx.showModal({
          title: '支付失败',
          content: '网络错误：云函数未返回结果\n\n完整响应：' + JSON.stringify(res),
          showCancel: false
        })
        return false
      }
      
      console.log('支付结果:', JSON.stringify(res.result, null, 2))
      
      if (!res.result.success) {
        const errorMsg = res.result.error || '未知错误'
        const errorDetails = res.result.details ? '\n\n详细信息：' + JSON.stringify(res.result.details, null, 2) : ''
        console.error('云函数返回失败:', errorMsg)
        
        wx.showModal({
          title: '支付失败',
          content: '错误原因：' + errorMsg + errorDetails + '\n\n请将此错误信息发送给开发者进行排查。',
          showCancel: false
        })
        return false
      }
      
      const paymentData = res.result.data
      console.log('支付参数:', paymentData)
      
      if (!paymentData) {
        console.error('支付参数为空')
        wx.showModal({
          title: '支付失败',
          content: '支付参数错误',
          showCancel: false
        })
        return false
      }
      
      if (!paymentData.package || !paymentData.timeStamp || !paymentData.paySign) {
        console.error('支付参数不完整:', paymentData)
        wx.showModal({
          title: '支付失败',
          content: '支付参数不完整',
          showCancel: false
        })
        return false
      }
      
      console.log('调用 wx.requestPayment...')
      
      await new Promise((resolve, reject) => {
        wx.requestPayment({
          timeStamp: paymentData.timeStamp,
          nonceStr: paymentData.nonceStr,
          package: paymentData.package,
          signType: paymentData.signType || 'MD5',
          paySign: paymentData.paySign,
          success: (payRes) => {
            console.log('支付成功:', payRes)
            resolve(payRes)
          },
          fail: (payErr) => {
            console.error('支付失败:', payErr)
            reject(payErr)
          }
        })
      })
      
      console.log('支付成功，更新订单状态')
      await this.onPaymentSuccess(orderId)
      
      console.log('========== 支付流程完成 ==========')
      return true
      
    } catch (err) {
      wx.hideLoading()
      console.error('========== 支付异常 ==========')
      console.error('错误信息:', err)
      console.error('错误详情:', err.message)
      console.error('errMsg:', err.errMsg)
      
      if (err.errMsg && err.errMsg.includes('cancel')) {
        wx.showToast({ title: '已取消支付', icon: 'none' })
        return false
      }
      
      wx.showModal({
        title: '支付失败',
        content: err.message || '支付失败，请稍后重试',
        showCancel: false
      })
      
      return false
    }
  },

  async onPaymentSuccess(orderId) {
    try {
      const cart = app.globalData.cart.filter(item => !item.selected)
      app.globalData.cart = cart
      app.saveCartToStorage()
      app.updateCartBadge()
      this.setData({ pendingOrderId: '' })
      
      wx.showToast({ title: '支付成功', icon: 'success' })
      
      setTimeout(() => {
        wx.redirectTo({
          url: `/pages/orderDetail/orderDetail?id=${orderId}`
        })
      }, 1500)
    } catch (err) {
      console.error('支付成功后处理失败:', err)
    }
  }
})
