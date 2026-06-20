Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    memberName: '普通会员',
    memberColor: '#999999',
    memberBalance: '0.00',
    isAdmin: false
  },

  onShow: function() {
    this.checkLoginStatus()
    this.checkAdminRole()
    var app = getApp()
    if (app.updateCartBadge) {
      app.updateCartBadge()
    }
  },

  checkLoginStatus: function() {
    var app = getApp()
    var userInfo = app.globalData && app.globalData.userInfo
    var isLoggedIn = !!userInfo
    var memberLevel = app.globalData && app.globalData.memberLevel || 0
    var memberBalance = app.globalData && app.globalData.memberBalance || 0
    
    var levelNames = ['普通会员', '铜牌会员', '银牌会员', '金牌会员', '钻石会员']
    var colors = ['#999999', '#cd7f32', '#c0c0c0', '#ffd700', '#b9f2ff']
    
    this.setData({
      isLoggedIn: isLoggedIn,
      userInfo: userInfo,
      memberName: levelNames[memberLevel] || '普通会员',
      memberColor: colors[memberLevel] || '#999999',
      memberBalance: memberBalance.toFixed(2)
    })
    
    if (isLoggedIn && userInfo && userInfo.id) {
      this.loadUserDataFromCloud(userInfo.id)
    }
  },

  async checkAdminRole() {
    console.log('=== 开始检查管理员角色 ===')
    try {
      const db = wx.cloud.database()
      const phone = wx.getStorageSync('userPhone')
      
      console.log('当前用户的手机号:', phone)
      
      if (!phone) {
        console.log('没有手机号，设置isAdmin为false')
        wx.setStorageSync('isAdmin', false)
        wx.setStorageSync('adminRole', 'normal')
        this.setData({ isAdmin: false, adminRole: 'normal' })
        return
      }
      
      console.log('查询managers集合...')
      const res = await db.collection('managers').where({ phone: phone }).get()
      
      console.log('查询结果:', res)
      console.log('res.data:', res.data)
      console.log('res.data长度:', res.data ? res.data.length : 0)
      
      if (res.data && res.data.length > 0) {
        const manager = res.data[0]
        console.log('找到管理员记录:', manager)
        if (manager.status === 'active') {
          wx.setStorageSync('isAdmin', true)
          wx.setStorageSync('adminRole', manager.role || 'staff')
          this.setData({
            isAdmin: true,
            adminRole: manager.role || 'staff'
          })
          console.log('✓ 设置为管理员，角色:', manager.role)
          return
        } else {
          console.log('管理员状态不是active，status:', manager.status)
        }
      } else {
        console.log('未找到管理员记录')
      }
      
      wx.setStorageSync('isAdmin', false)
      wx.setStorageSync('adminRole', 'normal')
      this.setData({ isAdmin: false, adminRole: 'normal' })
    } catch (err) {
      console.error('检查管理员角色失败:', err)
      wx.setStorageSync('isAdmin', false)
      wx.setStorageSync('adminRole', 'normal')
      this.setData({ isAdmin: false, adminRole: 'normal' })
    }
  },

  async loadUserDataFromCloud(userId) {
    try {
      const db = wx.cloud.database()
      // 使用手机号作为用户ID查询
      const res = await db.collection('users').doc(userId).get()
      
      if (res.data) {
        const user = res.data
        const app = getApp()
        
        app.globalData.memberLevel = user.memberLevel || 0
        app.globalData.memberBalance = user.memberBalance || 0
        
        var levelNames = ['普通会员', '铜牌会员', '银牌会员', '金牌会员', '钻石会员']
        var colors = ['#999999', '#cd7f32', '#c0c0c0', '#ffd700', '#b9f2ff']
        
        this.setData({
          memberName: levelNames[user.memberLevel || 0] || '普通会员',
          memberColor: colors[user.memberLevel || 0] || '#999999',
          memberBalance: (user.memberBalance || 0).toFixed(2)
        })
      }
    } catch (err) {
      console.log('加载用户数据失败:', err)
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

  goToCoupons() {
    wx.showToast({ title: '暂无可用优惠券', icon: 'none' });
  },

  goToRecharge: function() {
    if (!this.data.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    wx.navigateTo({ url: '/pages/recharge/recharge' });
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
          app.globalData.userInfo = null;
          app.globalData.token = null;
          app.globalData.memberLevel = 0;
          app.globalData.memberBalance = 0;
          wx.removeStorageSync('userInfo');
          wx.removeStorageSync('token');
          wx.removeStorageSync('isAdmin');
          wx.removeStorageSync('adminRole');
          wx.removeStorageSync('userPhone');
          wx.removeStorageSync('userId');
          this$1.setData({
            isLoggedIn: false,
            userInfo: null,
            memberName: '普通会员',
            memberColor: '#999999',
            memberBalance: '0.00',
            isAdmin: false
          });
          wx.showToast({ title: '已退出登录', icon: 'success' });
        }
      }
    });
  }
});
