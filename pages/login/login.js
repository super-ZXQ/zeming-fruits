const app = getApp()

Page({
  data: {
    agreed: false,
    loading: false,
    logoUrl: '/images/store-logo.jpg'
  },

  onLoad() {
    console.log('登录页面加载')
    this.checkPrivacyAgreed()
  },

  checkPrivacyAgreed() {
    const agreed = wx.getStorageSync('privacyAgreed') || false
    this.setData({ agreed })
  },

  toggleAgreement() {
    const agreed = !this.data.agreed
    this.setData({ agreed })
    wx.setStorageSync('privacyAgreed', agreed)
  },

  skipLogin() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  async getPhoneNumber(e) {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先阅读并同意相关协议', icon: 'none' })
      return
    }

    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      wx.showToast({
        title: '您需要授权手机号才能登录',
        icon: 'none'
      })
      return
    }

    if (!e.detail.code) {
      wx.showModal({
        title: '暂时无法获取手机号',
        content: '请使用真机微信重新点击授权；开发者工具模拟器不会返回真实手机号。',
        showCancel: false
      })
      return
    }

    if (this.data.loading) return

    this.setData({ loading: true })
    wx.showLoading({ title: '登录中...', mask: true })

    try {
      console.log('用户授权手机号，code:', e.detail.code)
      
      const phoneRes = await wx.cloud.callFunction({
        name: 'decryptPhone',
        data: {
          code: e.detail.code
        }
      })

      console.log('云函数返回结果:', phoneRes)

      if (!phoneRes.result || !phoneRes.result.success) {
        console.error('获取手机号失败，错误:', phoneRes.result)
        wx.hideLoading()
        wx.showModal({
          title: '获取手机号失败',
          content: '错误信息：' + (phoneRes.result ? phoneRes.result.error : '未知错误'),
          showCancel: false
        })
        this.setData({ loading: false })
        return
      }

      const phoneNumber = phoneRes.result.data.phoneNumber
      console.log('获取到手机号:', phoneNumber)

      const db = wx.cloud.database()
      const loginRes = await wx.cloud.callFunction({
        name: 'userLogin'
      })

      if (!loginRes.result || !loginRes.result.success) {
        throw new Error(loginRes.result?.error || '登录失败')
      }

      const loginUserInfo = loginRes.result.userInfo
      let userRes = await db.collection('users').doc(phoneNumber).get().catch(() => null)

      if (!userRes || !userRes.data) {
        const openidRes = await db.collection('users')
          .where({ _openid: loginUserInfo.openid })
          .limit(1)
          .get()
        userRes = openidRes.data.length > 0 ? { data: openidRes.data[0] } : null
      }

      let userInfo
      let isNewUser = false

      if (userRes && userRes.data) {
        const userData = userRes.data
        if (userData.phone !== phoneNumber) {
          await db.collection('users').doc(userData._id).update({
            data: {
              phone: phoneNumber,
              updatedAt: db.serverDate()
            }
          })
        }
        userInfo = {
          id: userData._id,
          openid: userData._openid || loginUserInfo.openid,
          phone: phoneNumber,
          nickname: userData.nickname || userData.nickName || '微信用户',
          avatarUrl: userData.avatarUrl || ''
        }
        console.log('老用户登录:', userInfo)
      } else {
        userInfo = {
          id: phoneNumber,
          openid: loginUserInfo.openid,
          phone: phoneNumber,
          nickname: loginUserInfo.nickName,
          avatarUrl: loginUserInfo.avatarUrl
        }
        
        await db.collection('users').add({
          data: {
            _id: phoneNumber,
            phone: phoneNumber,
            nickname: loginUserInfo.nickName,
            avatarUrl: loginUserInfo.avatarUrl,
            createTime: db.serverDate()
          }
        })
        
        isNewUser = true
        console.log('新用户注册:', userInfo)
      }

      app.setUserInfo(userInfo, 'token_' + phoneNumber)
      wx.setStorageSync('userPhone', phoneNumber)
      wx.setStorageSync('userId', phoneNumber)

      const admin = await this.checkAdminByPhone(phoneNumber)

      wx.hideLoading()
      wx.showToast({
        title: isNewUser ? '注册成功' : '登录成功',
        icon: 'success',
        duration: 1500
      })

      setTimeout(() => {
        if (admin) {
          wx.showModal({
            title: '管理员登录成功',
            content: '是否进入商品管理工作台？',
            confirmText: '进入后台',
            cancelText: '顾客首页',
            success: result => {
              if (result.confirm) {
                wx.navigateTo({ url: '/pages/admin/admin' })
              } else {
                wx.switchTab({ url: '/pages/index/index' })
              }
            }
          })
        } else {
          wx.switchTab({ url: '/pages/index/index' })
        }
      }, 1500)

    } catch (err) {
      wx.hideLoading()
      console.error('登录失败:', err)
      wx.showModal({
        title: '登录失败',
        content: err.message || '请检查网络连接后重试',
        showCancel: false
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  async checkAdminByPhone(phone) {
    console.log('通过手机号检查管理员, phone:', phone)
    try {
      const result = await wx.cloud.callFunction({ name: 'adminAuth' })
      const admin = result.result && result.result.isAdmin
      wx.setStorageSync('isAdmin', !!admin)
      wx.setStorageSync('adminRole', result.result && result.result.role || 'normal')
      return !!admin
    } catch (err) {
      console.error('检查管理员失败:', err)
      wx.setStorageSync('isAdmin', false)
      wx.setStorageSync('adminRole', 'normal')
      return false
    }
  },

  viewAgreement() {
    wx.showModal({
      title: '用户协议',
      content: '欢迎使用泽明果业！\n\n1. 用户需保证提供的个人信息真实有效\n2. 提交预约后由商家确认商品与时间\n3. 商品送达后请及时确认收货\n4. 如有问题可联系客服处理',
      showCancel: false
    })
  },

  viewPrivacy() {
    wx.showModal({
      title: '隐私政策',
      content: '我们重视您的隐私保护：\n\n1. 收集的信息仅用于提供服务和改善用户体验\n2. 不会将您的信息用于其他商业目的\n3. 采取安全措施保护您的个人信息\n4. 如有任何隐私问题，请联系客服',
      showCancel: false
    })
  }
})
