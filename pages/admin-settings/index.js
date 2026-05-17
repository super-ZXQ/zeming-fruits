const db = wx.cloud.database()
const app = getApp()

Page({
  data: {
    notices: [
      '🎉 新用户首单立减 10 元，快来选购吧！',
      '🍓 草莓季特惠，精选草莓 8 折起',
      '🚚 满 39 元免配送费，新鲜直达'
    ],
    freeDeliveryThreshold: '39',
    deliveryTip: '满 39 元免配送费，新鲜直达',
    shopName: '泽明果业',
    shopAddress: '江苏省淮安市清江浦区济南路东冠逸景花苑 1 号楼 1-5.1-6 号',
    shopPhone: '15250878388',
    businessHours: '08:00 - 21:00'
  },

  onLoad() {
    this.checkAdmin()
    this.loadSettings()
  },

  onShow() {
    // 每次显示页面时重新加载设置
    this.loadSettings()
  },

  checkAdmin() {
    const isAdmin = wx.getStorageSync('isAdmin')
    if (!isAdmin) {
      wx.showModal({
        title: '无访问权限',
        content: '您不是管理员，无法访问此页面',
        showCancel: false,
        success: () => {
          wx.switchTab({
            url: '/pages/index/index'
          })
        }
      })
      return
    }
  },

  async loadSettings() {
    try {
      console.log('========== 加载店铺设置 ==========')
      const res = await db.collection('settings').doc('homepage').get()
      
      if (res.data) {
        console.log('加载到数据:', JSON.stringify(res.data))
        this.setData({
          notices: res.data.notices || this.data.notices,
          freeDeliveryThreshold: res.data.freeDeliveryThreshold || '39',
          deliveryTip: res.data.deliveryTip || '满 39 元免配送费，新鲜直达',
          shopName: res.data.shopName || '泽明果业',
          shopAddress: res.data.shopAddress || '江苏省淮安市清江浦区济南路东冠逸景花苑 1 号楼 1-5.1-6 号',
          shopPhone: res.data.shopPhone || '15250878388',
          businessHours: res.data.businessHours || '08:00 - 21:00'
        })
        
        // 同步更新全局数据
        app.globalData.shopSettings = this.data
        console.log('✅ 设置加载完成')
      } else {
        console.log('⚠️ 数据库中无数据，使用默认值')
      }
    } catch (err) {
      console.log('⚠️ 加载设置失败，使用默认值:', err)
    }
  },

  onInputNotice1(e) {
    const notices = this.data.notices
    notices[0] = e.detail.value
    this.setData({ notices })
  },

  onInputNotice2(e) {
    const notices = this.data.notices
    notices[1] = e.detail.value
    this.setData({ notices })
  },

  onInputNotice3(e) {
    const notices = this.data.notices
    notices[2] = e.detail.value
    this.setData({ notices })
  },

  onInputFreeDelivery(e) {
    this.setData({
      freeDeliveryThreshold: e.detail.value
    })
  },

  onInputDeliveryTip(e) {
    this.setData({
      deliveryTip: e.detail.value
    })
  },

  onInputShopName(e) {
    this.setData({
      shopName: e.detail.value
    })
  },

  onInputShopAddress(e) {
    this.setData({
      shopAddress: e.detail.value
    })
  },

  onInputShopPhone(e) {
    this.setData({
      shopPhone: e.detail.value
    })
  },

  onInputBusinessHours(e) {
    this.setData({
      businessHours: e.detail.value
    })
  },

  async saveSettings() {
    wx.showLoading({
      title: '保存中...',
      mask: true
    })

    try {
      console.log('========== 开始保存设置 ==========')
      
      // 使用云函数保存设置（绕过前端权限限制）
      const res = await wx.cloud.callFunction({
        name: 'saveSettings',
        data: {
          notices: this.data.notices,
          freeDeliveryThreshold: this.data.freeDeliveryThreshold,
          deliveryTip: this.data.deliveryTip,
          shopName: this.data.shopName,
          shopAddress: this.data.shopAddress,
          shopPhone: this.data.shopPhone,
          businessHours: this.data.businessHours
        }
      })
      
      console.log('云函数返回:', JSON.stringify(res.result))
      
      if (!res.result || !res.result.success) {
        throw new Error(res.result?.error || '云函数执行失败')
      }

      wx.hideLoading()
      
      // 更新全局数据
      app.globalData.shopSettings = {
        notices: this.data.notices,
        freeDeliveryThreshold: this.data.freeDeliveryThreshold,
        deliveryTip: this.data.deliveryTip,
        shopName: this.data.shopName,
        shopAddress: this.data.shopAddress,
        shopPhone: this.data.shopPhone,
        businessHours: this.data.businessHours
      }
      
      console.log('✅ 全局数据已更新:', JSON.stringify(app.globalData.shopSettings))

      wx.showToast({
        title: '保存成功',
        icon: 'success',
        duration: 2000
      })

      console.log('========== 保存设置完成 ==========')

      // 不再自动返回上一页，让用户可以继续修改

    } catch (err) {
      wx.hideLoading()
      console.error('========== 保存设置失败 ==========')
      console.error('错误类型:', err.constructor.name)
      console.error('错误消息:', err.errMsg || err.message)
      console.error('完整错误:', JSON.stringify(err))
      
      let errorMsg = '保存失败，请重试'
      
      // 根据错误类型给出具体提示
      if (err.errMsg && err.errMsg.includes('无权限')) {
        errorMsg = '您不是管理员，无法修改店铺设置！请使用管理员账号登录。'
      } else if (err.errMsg) {
        errorMsg = err.errMsg
      } else if (err.message) {
        errorMsg = err.message
      }
      
      wx.showModal({
        title: '保存失败',
        content: errorMsg + '\n\n详细错误信息：' + JSON.stringify(err),
        showCancel: false
      })
    }
  }
})
