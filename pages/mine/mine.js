Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    isAdmin: false
  },

  onShow: function() {
    this.checkLoginStatus()
    if (this.data.isLoggedIn) {
      this.checkAdminRole()
    } else {
      this.setData({ isAdmin: false, adminRole: 'normal' })
    }
    var app = getApp()
    if (app.updateCartBadge) {
      app.updateCartBadge()
    }
  },

  checkLoginStatus: function() {
    var app = getApp()
    var userInfo = app.globalData && app.globalData.userInfo
    var isLoggedIn = !!userInfo
    this.setData({
      isLoggedIn: isLoggedIn,
      userInfo: userInfo
    })
  },

  async checkAdminRole() {
    try {
      const result = await wx.cloud.callFunction({ name: 'adminAuth' })
      const isAdmin = !!(result.result && result.result.isAdmin)
      const adminRole = result.result && result.result.role || 'normal'
      wx.setStorageSync('isAdmin', isAdmin)
      wx.setStorageSync('adminRole', adminRole)
      this.setData({ isAdmin, adminRole })
    } catch (err) {
      console.error('检查管理员角色失败:', err)
      wx.setStorageSync('isAdmin', false)
      wx.setStorageSync('adminRole', 'normal')
      this.setData({ isAdmin: false, adminRole: 'normal' })
    }
  },

  handleUserInfo: function() {
    if (!this.data.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/login' });
    }
  },

  goToOrders: function(e) {
    if (!this.data.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    var status = e && e.currentTarget && e.currentTarget.dataset.status || 'all';
    wx.navigateTo({
      url: '/pages/orders/orders?status=' + status
    });
  },

  goToAddress() {
    if (!this.data.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    wx.navigateTo({ url: '/pages/address/address' });
  },

  contactService: function() {
    wx.showModal({
      title: '联系客服',
      content: '客服电话: 15250878388',
      showCancel: false,
      confirmText: '拨打',
      success: function(res) {
        if (res.confirm) {
          wx.makePhoneCall({ phoneNumber: '15250878388' });
        }
      }
    });
  },

  goToAdmin: function() {
    wx.navigateTo({ url: '/pages/admin/admin' });
  },

  logout: function() {
    var this$1 = this;
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: function(res) {
        if (res.confirm) {
          var app = getApp();
          app.clearSession();
          this$1.setData({
            isLoggedIn: false,
            userInfo: null,
            isAdmin: false
          });
          wx.showToast({ title: '已退出登录', icon: 'success' });
        }
      }
    });
  }
});
