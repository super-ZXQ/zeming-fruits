App({
  globalData: {
    userInfo: null,
    token: null,
    location: null,
    cart: [],
    memberLevel: 0,
    memberBalance: 0,
    defaultAddress: null,
    orders: [],
    shopSettings: null
  },

  onLaunch() {
    // 初始化云开发环境
    if (wx.cloud) {
      wx.cloud.init({
        traceUser: true
      })
      console.log('云开发初始化成功')
    }
    
    this.loadCartFromStorage();
    this.loadAddressFromStorage();
    this.checkLoginStatus();
    this.loadShopSettings();
  },

  loadCartFromStorage() {
    try {
      const cart = wx.getStorageSync('cart') || [];
      this.globalData.cart = cart;
    } catch (e) {
      console.log('加载购物车失败', e);
    }
  },

  saveCartToStorage() {
    try {
      wx.setStorageSync('cart', this.globalData.cart);
    } catch (e) {
      console.log('保存购物车失败', e);
    }
  },

  loadAddressFromStorage() {
    try {
      const address = wx.getStorageSync('defaultAddress');
      if (address) {
        this.globalData.defaultAddress = address;
      }
    } catch (e) {
      console.log('加载地址失败', e);
    }
  },

  saveAddressToStorage(address) {
    try {
      wx.setStorageSync('defaultAddress', address);
      this.globalData.defaultAddress = address;
    } catch (e) {
      console.log('保存地址失败', e);
    }
  },

  addToCart(product, count) {
    count = count || 1;
    const cart = this.globalData.cart;
    let existingItem = null;
    
    for (let i = 0; i < cart.length; i++) {
      if (cart[i].id === product.id) {
        existingItem = cart[i];
        break;
      }
    }
    
    if (existingItem) {
      existingItem.count += count;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        emoji: product.emoji || '🍎',
        description: product.description || '',
        imageUrl: product.imageUrl || '',
        count: count,
        selected: true
      });
    }
    
    this.saveCartToStorage();
    this.updateCartBadge();
  },

  updateCartBadge() {
    let totalCount = 0;
    const cart = this.globalData.cart;
    for (let i = 0; i < cart.length; i++) {
      totalCount += cart[i].count;
    }
    if (totalCount > 0) {
      wx.setTabBarBadge({
        index: 2,
        text: totalCount > 99 ? '99+' : String(totalCount)
      });
    } else {
      wx.removeTabBarBadge({
        index: 2
      });
    }
  },

  checkLoginStatus() {
    try {
      const userInfo = wx.getStorageSync('userInfo');
      const token = wx.getStorageSync('token');
      if (userInfo && token) {
        this.globalData.userInfo = userInfo;
        this.globalData.token = token;
        this.globalData.memberLevel = userInfo.memberLevel || 0;
        this.globalData.memberBalance = userInfo.memberBalance || 0;
      }
    } catch (e) {
      console.log('检查登录状态失败', e);
    }
  },

  setUserInfo(userInfo, token) {
    this.globalData.userInfo = userInfo;
    this.globalData.token = token;
    this.globalData.memberLevel = userInfo.memberLevel || 0;
    this.globalData.memberBalance = userInfo.memberBalance || 0;
    
    wx.setStorageSync('userInfo', userInfo);
    wx.setStorageSync('token', token);
  },

  updateMemberInfo(level, balance) {
    this.globalData.memberLevel = level;
    this.globalData.memberBalance = balance;
    
    if (this.globalData.userInfo) {
      this.globalData.userInfo.memberLevel = level;
      this.globalData.userInfo.memberBalance = balance;
      wx.setStorageSync('userInfo', this.globalData.userInfo);
    }
  },

  async loadShopSettings() {
    try {
      const db = wx.cloud.database()
      const res = await db.collection('settings').doc('homepage').get()
      
      if (res.data) {
        this.globalData.shopSettings = {
          notices: res.data.notices,
          freeDeliveryThreshold: res.data.freeDeliveryThreshold,
          deliveryTip: res.data.deliveryTip,
          shopName: res.data.shopName,
          shopAddress: res.data.shopAddress,
          shopPhone: res.data.shopPhone,
          businessHours: res.data.businessHours
        }
      }
    } catch (err) {
      console.log('加载店铺设置失败，使用默认值:', err)
    }
  }
});