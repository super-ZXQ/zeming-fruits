Page({
  data: {
    cartItems: [],
    totalAmount: '0.00',
    address: null,
    remark: ''
  },

  onLoad: function() {
    this.loadCartItems();
    this.loadAddress();
  },

  onShow: function() {
    this.loadAddress();
  },

  loadCartItems: function() {
    var app = getApp();
    var cart = app.globalData && app.globalData.cart ? app.globalData.cart : [];
    var selectedItems = [];
    var total = 0;
    
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].selected) {
        selectedItems.push({
          id: cart[i].id,
          name: cart[i].name,
          price: cart[i].price,
          count: cart[i].count,
          emoji: cart[i].emoji || '🍎',
          imageUrl: cart[i].imageUrl || ''
        });
        total += cart[i].price * cart[i].count;
      }
    }
    
    this.setData({
      cartItems: selectedItems,
      totalAmount: total.toFixed(2)
    });
  },

  loadAddress: function() {
    var app = getApp();
    var address = app.globalData && app.globalData.defaultAddress;
    this.setData({ address: address });
  },

  chooseAddress() {
    wx.navigateTo({
      url: '/pages/address/address?from=checkout'
    });
  },

  inputRemark: function(e) {
    this.setData({ remark: e.detail.value });
  },

  async submitOrder() {
    const { address, cartItems, totalAmount, remark } = this.data;
    
    if (!address) {
      wx.showToast({ title: '请添加收货地址', icon: 'none' });
      return;
    }
    
    if (cartItems.length === 0) {
      wx.showToast({ title: '购物车为空', icon: 'none' });
      return;
    }

    const userPhone = wx.getStorageSync('userPhone');
    if (!userPhone) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再下单',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/login' });
          }
        }
      });
      return;
    }
    
    wx.showModal({
      title: '确认订单',
      content: '订单金额: ¥' + totalAmount,
      confirmText: '去支付',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '创建订单...', mask: true });
          
          try {
            const app = getApp();
            const orderId = 'ZM' + Date.now();
            const order = {
              _id: orderId,
              id: orderId,
              userId: userPhone,
              items: cartItems,
              totalAmount: parseFloat(totalAmount),
              deliveryFee: 0,
              finalAmount: parseFloat(totalAmount),
              address: address,
              remark: remark,
              status: 'pending',
              deliveryType: 'delivery',
              createTime: new Date().toISOString()
            };
            
            // 保存订单到云数据库
            const db = wx.cloud.database();
            await db.collection('orders').add({
              data: order
            });
            
            // 保存到本地
            if (!app.globalData.orders) {
              app.globalData.orders = [];
            }
            app.globalData.orders.unshift(order);
            
            // 清除已选购物车商品
            const cart = app.globalData.cart;
            for (let i = cart.length - 1; i >= 0; i--) {
              if (cart[i].selected) {
                cart.splice(i, 1);
              }
            }
            app.globalData.cart = cart;
            app.saveCartToStorage && app.saveCartToStorage();
            
            wx.hideLoading();
            
            // 模拟支付
            wx.showModal({
              title: '订单已创建',
              content: '订单金额 ¥' + totalAmount + '，是否现在支付？',
              confirmText: '立即支付',
              cancelText: '稍后支付',
              success: async (res2) => {
                if (res2.confirm) {
                  wx.showLoading({ title: '支付中...', mask: true });
                  
                  // 模拟支付过程
                  setTimeout(async () => {
                    try {
                      // 更新订单状态
                      await db.collection('orders').doc(orderId).update({
                        data: {
                          status: 'paid',
                          payTime: new Date().toISOString()
                        }
                      });
                      
                      // 更新本地订单状态
                      const orders = app.globalData.orders;
                      const localOrder = orders.find(o => o.id === orderId);
                      if (localOrder) {
                        localOrder.status = 'paid';
                        localOrder.payTime = new Date().toISOString();
                      }
                      
                      wx.hideLoading();
                      wx.showToast({ title: '支付成功', icon: 'success' });
                      
                      setTimeout(() => {
                        wx.redirectTo({ url: '/pages/orders/orders' });
                      }, 1500);
                    } catch (err) {
                      wx.hideLoading();
                      console.error('支付失败:', err);
                      wx.showModal({
                        title: '支付失败',
                        content: '请稍后在订单列表中重新支付',
                        showCancel: false,
                        success: () => {
                          wx.redirectTo({ url: '/pages/orders/orders' });
                        }
                      });
                    }
                  }, 1500);
                } else {
                  wx.redirectTo({ url: '/pages/orders/orders' });
                }
              }
            });
          } catch (err) {
            wx.hideLoading();
            console.error('创建订单失败:', err);
            wx.showModal({
              title: '创建订单失败',
              content: err.message || '请检查网络连接后重试',
              showCancel: false
            });
          }
        }
      }
    });
  }
});