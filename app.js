App({
  globalData: {
    userInfo: null,
    isAdmin: false,
    adminRole: 'normal',
    cart: []
  },

  onLaunch() {
    if (wx.cloud) wx.cloud.init({ env: 'cloud1-d2gkep1yz4b62ba1e', traceUser: true })
    this.loadCartFromStorage()
    this.restoreSession()
  },

  onShow() {
    this.updateCartBadge()
  },

  loadCartFromStorage() {
    try {
      this.globalData.cart = wx.getStorageSync('cart') || []
    } catch (err) {
      this.globalData.cart = []
    }
  },

  saveCartToStorage() {
    wx.setStorageSync('cart', this.globalData.cart)
  },

  addToCart(product, count = 1) {
    const cart = this.globalData.cart
    const existing = cart.find(item => item.id === product.id)
    if (existing) {
      existing.count = Math.min(99, existing.count + count)
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        emoji: product.emoji || '🍎',
        description: product.description || '',
        imageUrl: product.imageUrl || '',
        count: Math.min(99, count),
        selected: true
      })
    }
    this.saveCartToStorage()
    this.updateCartBadge()
  },

  updateCartBadge() {
    const total = this.globalData.cart.reduce((sum, item) => sum + (Number(item.count) || 0), 0)
    if (total > 0) wx.setTabBarBadge({ index: 2, text: total > 99 ? '99+' : String(total) })
    else wx.removeTabBarBadge({ index: 2 })
  },

  restoreSession() {
    if (wx.getStorageSync('sessionDisabled')) return
    const cached = wx.getStorageSync('userInfo')
    if (!cached) return
    this.globalData.userInfo = cached
    this.refreshSession()
  },

  async refreshSession() {
    try {
      const result = await wx.cloud.callFunction({ name: 'userLogin', data: { action: 'session' } })
      if (!result.result || !result.result.success || !result.result.user) {
        this.clearSession(false)
        return null
      }
      this.setSession(result.result.user, result.result)
      return result.result
    } catch (err) {
      return null
    }
  },

  setSession(user, identity = {}) {
    this.globalData.userInfo = user
    this.globalData.isAdmin = !!identity.isAdmin
    this.globalData.adminRole = identity.role || 'normal'
    wx.setStorageSync('userInfo', user)
    wx.setStorageSync('isAdmin', this.globalData.isAdmin)
    wx.setStorageSync('adminRole', this.globalData.adminRole)
    wx.removeStorageSync('sessionDisabled')
  },

  clearSession(disable = true) {
    this.globalData.userInfo = null
    this.globalData.isAdmin = false
    this.globalData.adminRole = 'normal'
    wx.removeStorageSync('userInfo')
    wx.removeStorageSync('isAdmin')
    wx.removeStorageSync('adminRole')
    wx.removeStorageSync('userPhone')
    wx.removeStorageSync('userId')
    wx.removeStorageSync('token')
    if (disable) wx.setStorageSync('sessionDisabled', true)
  }
})
