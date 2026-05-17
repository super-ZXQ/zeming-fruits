const app = getApp()

Page({
  data: {
    agreed: false,
    loading: false,
    logoUrl: '/images/store-logo.jpg',
    showPrivacyModal: false,
    pendingLoginEvent: null
  },

  onLoad() {
    console.log('登录页面加载')
    this.checkPrivacyAgreed()
  },

  checkPrivacyAgreed() {
    const agreed = wx.getStorageSync('privacyAgreed') || false
    this.setData({ agreed })
  },

  preventMove() {
    return false
  },

  toggleAgreement() {
    this.setData({
      agreed: !this.data.agreed
    })
  },

  skipLogin() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  async getPhoneNumber(e) {
    if (!this.data.agreed) {
      this.setData({
        showPrivacyModal: true,
        pendingLoginEvent: e
      })
      return
    }

    await this.doGetPhoneNumber(e)
  },

  async doGetPhoneNumber(e) {
    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      wx.showToast({
        title: '您需要授权手机号才能登录',
        icon: 'none'
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
      
      // 使用手机号作为唯一标识查询用户
      const userRes = await db.collection('users').doc(phoneNumber).get().catch(() => null)

      let userInfo
      let isNewUser = false

      if (userRes && userRes.data) {
        // 老用户，使用已有数据
        const userData = userRes.data
        userInfo = {
          id: phoneNumber,
          openid: userData._openid || '',
          phone: userData.phone,
          nickname: userData.nickname,
          avatarUrl: userData.avatarUrl,
          memberLevel: userData.memberLevel || 0,
          memberBalance: userData.memberBalance || 0
        }
        console.log('老用户登录:', userInfo)
      } else {
        // 新用户，创建新记录（使用手机号作为_id）
        const loginRes = await wx.cloud.callFunction({
          name: 'userLogin'
        })

        if (!loginRes.result.success) {
          throw new Error(loginRes.result.error || '登录失败')
        }

        const loginUserInfo = loginRes.result.userInfo
        userInfo = {
          id: phoneNumber,
          openid: loginUserInfo.openid,
          phone: phoneNumber,
          nickname: loginUserInfo.nickName,
          avatarUrl: loginUserInfo.avatarUrl,
          memberLevel: 0,
          memberBalance: 0
        }
        
        // 使用手机号作为 _id，确保每个手机号都是独立用户
        await db.collection('users').add({
          data: {
            _id: phoneNumber,
            _openid: loginUserInfo.openid,
            phone: phoneNumber,
            nickname: loginUserInfo.nickName,
            avatarUrl: loginUserInfo.avatarUrl,
            memberLevel: 0,
            memberBalance: 0,
            createTime: db.serverDate()
          }
        })
        
        isNewUser = true
        console.log('新用户注册:', userInfo)
      }

      app.setUserInfo(userInfo, 'token_' + phoneNumber)
      wx.setStorageSync('userPhone', phoneNumber)
      wx.setStorageSync('userId', phoneNumber)

      await this.checkAdminByPhone(phoneNumber)

      wx.hideLoading()
      wx.showToast({
        title: isNewUser ? '注册成功' : '登录成功',
        icon: 'success',
        duration: 1500
      })

      setTimeout(() => {
        wx.switchTab({
          url: '/pages/index/index'
        })
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
      const db = wx.cloud.database()
      const res = await db.collection('managers').where({ phone: phone }).get()

      console.log('查询结果:', res)

      if (res.data && res.data.length > 0) {
        const manager = res.data[0]
        console.log('找到管理员记录:', manager)
        if (manager.status === 'active') {
          wx.setStorageSync('isAdmin', true)
          wx.setStorageSync('adminRole', manager.role || 'staff')
          console.log('✓ 设置为管理员，角色:', manager.role)
          return true
        }
      }

      console.log('未找到管理员记录')
      wx.setStorageSync('isAdmin', false)
      wx.setStorageSync('adminRole', 'normal')
      return false
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
      content: '欢迎使用泽明果业！\n\n本协议规定了用户使用小程序的相关条款，包括但不限于：\n\n1. 用户需保证提供的个人信息真实有效\n2. 订单提交后需在规定时间内完成支付\n3. 商品送达后请及时确认收货\n4. 如有问题可联系客服处理',
      showCancel: false
    })
  },

  viewPrivacy() {
    wx.showModal({
      title: '隐私政策',
      content: '我们重视您的隐私保护：\n\n1. 收集的信息仅用于提供服务和改善用户体验\n2. 不会将您的信息用于其他商业目的\n3. 采取安全措施保护您的个人信息\n4. 如有任何隐私问题，请联系客服',
      showCancel: false
    })
  },

  viewPrivacyInModal() {
    wx.showModal({
      title: '用户隐私协议',
      content: '【泽明果业隐私协议】\n\n一、信息收集\n我们可能收集以下信息：\n1. 手机号码：用于账号注册和身份验证\n2. 收货地址：用于商品配送\n3. 定位信息：用于计算配送距离\n\n二、信息使用\n收集的信息仅用于提供订单服务、配送服务及改善用户体验。\n\n三、信息保护\n我们采用业界标准的安全措施保护您的个人信息。\n\n四、权利行使\n您有权访问、更正或删除您的个人信息。',
      showCancel: false,
      confirmText: '我已了解'
    })
  },

  agreePrivacy() {
    this.setData({
      agreed: true,
      showPrivacyModal: false
    })
    wx.setStorageSync('privacyAgreed', true)
    
    if (this.data.pendingLoginEvent) {
      const event = this.data.pendingLoginEvent
      this.setData({ pendingLoginEvent: null })
      this.doGetPhoneNumber(event)
    }
  },

  disagreePrivacy() {
    this.setData({
      showPrivacyModal: false,
      pendingLoginEvent: null
    })
    wx.showToast({
      title: '需要同意隐私协议才能使用',
      icon: 'none',
      duration: 2000
    })
  },

  closePrivacyModal() {
    this.setData({
      showPrivacyModal: false,
      pendingLoginEvent: null
    })
  }
})