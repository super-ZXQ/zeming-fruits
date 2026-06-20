Page({
  data: {
    cart: [],
    totalPrice: '0.00',
    selectedCount: 0,
    allSelected: false
  },

  onShow: function() {
    this.loadCart();
  },

  loadCart: function() {
    var app = getApp();
    var cart = app.globalData && app.globalData.cart ? app.globalData.cart : [];
    var total = 0;
    var count = 0;
    var all = true;
    
    for (var i = 0; i < cart.length; i++) {
      var item = cart[i];
      if (item.selected) {
        total += item.price * item.count;
        count += item.count;
      } else {
        all = false;
      }
    }
    
    this.setData({
      cart: cart,
      totalPrice: total.toFixed(2),
      selectedCount: count,
      allSelected: cart.length > 0 && all
    });
  },

  saveCart: function() {
    var app = getApp();
    app.saveCartToStorage();
    app.updateCartBadge();
    this.loadCart();
  },

  toggleSelect: function(e) {
    var id = e.currentTarget.dataset.id;
    var app = getApp();
    var cart = app.globalData.cart;
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].id === id) {
        cart[i].selected = !cart[i].selected;
        break;
      }
    }
    this.saveCart();
  },

  toggleSelectAll: function() {
    var allSelected = !this.data.allSelected;
    var app = getApp();
    var cart = app.globalData.cart;
    for (var i = 0; i < cart.length; i++) {
      cart[i].selected = allSelected;
    }
    this.saveCart();
  },

  increaseCount: function(e) {
    var id = e.currentTarget.dataset.id;
    var app = getApp();
    var cart = app.globalData.cart;
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].id === id) {
        cart[i].count += 1;
        break;
      }
    }
    this.saveCart();
  },

  decreaseCount: function(e) {
    var id = e.currentTarget.dataset.id;
    var app = getApp();
    var cart = app.globalData.cart;
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].id === id) {
        if (cart[i].count > 1) {
          cart[i].count -= 1;
        }
        break;
      }
    }
    this.saveCart();
  },

  deleteItem: function(e) {
    var this$1 = this;
    var id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除该商品吗？',
      success: function(res) {
        if (res.confirm) {
          var app = getApp();
          var cart = app.globalData.cart;
          for (var i = cart.length - 1; i >= 0; i--) {
            if (cart[i].id === id) {
              cart.splice(i, 1);
              break;
            }
          }
          this$1.saveCart();
        }
      }
    });
  },

  goShopping: function() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  goToCheckout: function() {
    if (this.data.selectedCount === 0) {
      wx.showToast({ title: '请选择商品', icon: 'none' });
      return;
    }
    
    var app = getApp();
    if (!app.globalData.userInfo) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再结算',
        confirmText: '去登录',
        success: function(res) {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/login' });
          }
        }
      });
      return;
    }
    
    wx.navigateTo({ url: '/pages/order/pay' });
  }
});
