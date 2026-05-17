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
            
            const userRes = await db.collection('users').doc(userInfo.id).get();
            const currentBalance = userRes.data.memberBalance || 0;
            const newBalance = currentBalance + totalAmount;
            
            await db.collection('users').doc(userInfo.id).update({
              data: {
                memberBalance: newBalance
              }
            });
            
            await db.collection('recharge_records').add({
              data: {
                userId: userInfo.id,
                openid: userInfo.openid,
                amount: rechargeAmount,
                giveAmount: giveAmount,
                totalAmount: totalAmount,
                balanceBefore: currentBalance,
                balanceAfter: newBalance,
                createTime: db.serverDate()
              }
            });
            
            app.globalData.memberBalance = newBalance;
            
            wx.hideLoading();
            wx.showToast({
              title: giveAmount > 0 ? `充值成功！赠送¥${giveAmount}` : '充值成功！',
              icon: 'success',
              duration: 2000
            });

            this.setData({
              currentBalance: newBalance.toFixed(2),
              selectedPackage: -1,
              customAmount: 0,
              rechargeAmount: 0,
              loading: false
            });
          } catch (err) {
            wx.hideLoading();
            console.error('充值失败:', err);
            wx.showToast({
              title: '充值失败，请重试',
              icon: 'none'
            });
            this.setData({ loading: false });
          }
        }
      }
    });
  }
});