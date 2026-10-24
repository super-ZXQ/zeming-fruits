const app = getApp()

Page({
  data: { agreed: false, loading: false, logoUrl: '/images/store-logo.jpg' },

  onLoad() {
    this.setData({ agreed: !!wx.getStorageSync('privacyAgreed') })
  },

  toggleAgreement() {
    const agreed = !this.data.agreed
    this.setData({ agreed })
    wx.setStorageSync('privacyAgreed', agreed)
  },

  skipLogin() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  async getPhoneNumber(e) {
    if (!this.data.agreed) return wx.showToast({ title: '请先阅读并同意相关协议', icon: 'none' })
    if (e.detail.errMsg !== 'getPhoneNumber:ok' || !e.detail.code) {
      return wx.showToast({ title: '未获得手机号授权，可先浏览商品', icon: 'none' })
    }
    if (this.data.loading) return

    this.setData({ loading: true })
    wx.showLoading({ title: '登录中', mask: true })
    try {
      const result = await wx.cloud.callFunction({ name: 'userLogin', data: { action: 'bindPhone', code: e.detail.code } })
      if (!result.result || !result.result.success || !result.result.user) {
        throw new Error(result.result && result.result.error || '登录失败')
      }
      app.setSession(result.result.user, result.result)
      wx.hideLoading()
      wx.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => wx.switchTab({ url: '/pages/index/index' }), 700)
    } catch (err) {
      wx.hideLoading()
      wx.showModal({ title: '登录失败', content: err.message || '请稍后重试', showCancel: false })
    } finally {
      this.setData({ loading: false })
    }
  },

  viewAgreement() {
    wx.showModal({
      title: '预约服务说明',
      content: '本小程序仅提供水果预约，不在线收款。提交后由商家确认商品与时间；3km 内送货上门配送费为 5 元，超出范围暂不配送；待确认预约可自行取消，确认后请联系商家处理。',
      showCancel: false
    })
  },

  viewPrivacy() {
    if (wx.openPrivacyContract) {
      wx.openPrivacyContract({ fail: () => wx.showToast({ title: '请先在公众平台配置隐私指引', icon: 'none' }) })
    } else {
      wx.showModal({ title: '用户隐私协议', content: '手机号、地址和订单信息仅用于水果预约、自取与配送服务。', showCancel: false })
    }
  }
})
