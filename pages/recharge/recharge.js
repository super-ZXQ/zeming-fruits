const app = getApp();

Page({
  data: {
    packages: [
      { amount: 50, giveAmount: 0, label: '50元' },
      { amount: 100, giveAmount: 10, label: '100元送10元' },
      { amount: 200, giveAmount: 30, label: '200元送30元' },
      { amount: 500, giveAmount: 100, label: '500元送100元' }
    ],
    selectedPackage: -1,
    customAmount: 0,
    rechargeAmount: 0,
    currentBalance: '0.00',
    memberLevelInfo: { name: '普通会员', color: '#999999', discount: 1 },
    loading: false
  },

  onLoad() {
    this.loadMemberInfo();
  },

  onShow() {
    this.loadMemberInfo();
  },

  async loadMemberInfo() {
    try {
      const userInfo = app.globalData.userInfo;
      if (userInfo && userInfo.id) {
        const db = wx.cloud.database();
        const res = await db.collection('users').doc(userInfo.id).get();
        
        if (res.data) {
          const user = res.data;
          const memberLevels = [
            { name: '普通会员', color: '#999999', discount: 1 },
            { name: '铜牌会员', color: '#cd7f32', discount: 0.98 },
            { name: '银牌会员', color: '#c0c0c0', discount: 0.95 },
            { name: '金牌会员', color: '#ffd700', discount: 0.92 },
            { name: '钻石会员', color: '#b9f2ff', discount: 0.88 }
          ];
          
          const memberLevelInfo = memberLevels[user.memberLevel || 0];
          
          app.globalData.memberLevel = user.memberLevel || 0;
          app.globalData.memberBalance = user.memberBalance || 0;
          
          this.setData({
            memberLevelInfo: memberLevelInfo,
            currentBalance: (user.memberBalance || 0).toFixed(2)
          });
        }
      } else {
        const memberBalance = (app.globalData.memberBalance || 0).toFixed(2);
        this.setData({ currentBalance: memberBalance });
      }
    } catch (err) {
      console.error('加载会员信息失败:', err);
    }
  },

  selectPackage(e) {
    const index = e.currentTarget.dataset.index;
    const packageItem = this.data.packages[index];
    
    this.setData({
      selectedPackage: index,
      customAmount: 0,
      rechargeAmount: packageItem.amount
    });
  },

  inputAmount(e) {
    const amount = parseFloat(e.detail.value) || 0;
    
    this.setData({
      customAmount: amount,
      selectedPackage: -1,
      rechargeAmount: amount
    });
  },

  async submitRecharge() {
    const { rechargeAmount, selectedPackage, packages, loading } = this.data;
    
    if (loading) return;
    
    if (rechargeAmount <= 0) {
      wx.showToast({ title: '请选择充值金额', icon: 'none' });
      return;
    }

    const userInfo = app.globalData.userInfo;
    if (!userInfo || !userInfo.id) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => {
        wx.navigateTo({ url: '/pages/login/login' });
      }, 1500);
      return;
    }

    const giveAmount = selectedPackage >= 0 ? packages[selectedPackage].giveAmount : 0;
    const totalAmount = rechargeAmount + giveAmount;

    wx.showModal({
      title: '确认充值',
      content: giveAmount > 0 
        ? `充值¥${rechargeAmount}，赠送¥${giveAmount}，到账¥${totalAmount}`
        : `确定要充值¥${rechargeAmount}吗？`,
      confirmText: '确认充值',
      success: async (res) => {
        if (res.confirm) {
          this.setData({ loading: true });
          wx.showLoading({ title: '充值中...', mask: true });
          
          try {
            const db = wx.cloud.database();

            const orderRes = await db.collection('orders').add({
              data: {
                orderType: 'recharge',
                userId: userInfo.id,
                goods: [],
                recharge: {
                  amount: rechargeAmount,
                  giveAmount,
                  creditAmount: totalAmount
                },
                priceDetail: {
                  goodsTotal: rechargeAmount,
                  couponDiscount: 0,
                  deliveryFee: 0,
                  total: rechargeAmount
                },
                status: 'pending',
                createTime: db.serverDate()
              }
            });

            const payRes = await wx.cloud.callFunction({
              name: 'payOrder',
              data: {
                orderId: orderRes._id
              }
            })

            if (!payRes.result || !payRes.result.success) {
              throw new Error(payRes.result?.error || '发起支付失败')
            }

            const payment = payRes.result.data
            await new Promise((resolve, reject) => {
              wx.requestPayment({
                timeStamp: payment.timeStamp,
                nonceStr: payment.nonceStr,
                package: payment.package,
                signType: payment.signType || 'MD5',
                paySign: payment.paySign,
                success: resolve,
                fail: reject
              })
            })
            
            wx.hideLoading();
            wx.showToast({
              title: '支付成功，余额更新中',
              icon: 'success',
              duration: 2000
            });

            this.setData({
              selectedPackage: -1,
              customAmount: 0,
              rechargeAmount: 0,
              loading: false
            });

            setTimeout(() => this.loadMemberInfo(), 1500)
          } catch (err) {
            wx.hideLoading();
            console.error('充值失败:', err);
            wx.showToast({
              title: err.errMsg && err.errMsg.includes('cancel') ? '已取消支付' : '充值失败，请重试',
              icon: 'none'
            });
            this.setData({ loading: false });
          }
        }
      }
    });
  }
});
