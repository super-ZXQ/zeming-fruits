const db = wx.cloud.database()
const _ = db.command

Page({
  data: {
    stats: {
      todaySales: 0,
      todayOrders: 0,
      newUsers: 0,
      couponUsed: 0
    },
    hotGoods: [],
    orders: [],
    orderFilter: 'all',
    statusMap: {
      pending: '待付款',
      paid: '已支付',
      delivering: '配送中',
      completed: '已完成',
      cancelled: '已取消'
    },
    finance: {
      todayIncome: 0,
      monthIncome: 0,
      pending: 0
    }
  },

  onLoad() {
    this.checkAdmin()
    this.loadStats()
    this.loadHotGoods()
    this.loadOrders()
    this.loadFinance()
  },

  onShow() {
    this.loadStats()
  },

  checkAdmin() {
    const isAdmin = wx.getStorageSync('isAdmin')
    if (!isAdmin) {
      wx.showModal({
        title: '无权限',
        content: '您不是管理员',
        showCancel: false,
        success: () => {
          wx.navigateBack()
        }
      })
    }
  },

  async loadStats() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    try {
      const ordersRes = await db.collection('orders')
        .where({
          createTime: _.gte(today),
          status: _.neq('cancelled')
        })
        .get()
      
      const todaySales = ordersRes.data.reduce((sum, order) => sum + (order.priceDetail?.total || 0), 0)
      const todayOrders = ordersRes.data.length
      
      const usersRes = await db.collection('users')
        .where({
          createTime: _.gte(today)
        })
        .count()
      
      const couponsRes = await db.collection('coupons')
        .where({
          usedCount: _.gt(0)
        })
        .get()
      
      const couponUsed = couponsRes.data.reduce((sum, c) => sum + (c.usedCount || 0), 0)
      
      this.setData({
        stats: {
          todaySales: todaySales.toFixed(2),
          todayOrders,
          newUsers: usersRes.total,
          couponUsed
        }
      })
    } catch (err) {
      console.error('加载统计数据失败:', err)
    }
  },

  async loadHotGoods() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getHotGoods'
      })
      
      if (res.result.success) {
        this.setData({ hotGoods: res.result.data })
      }
    } catch (err) {
      console.error('加载热销商品失败:', err)
    }
  },

  async loadOrders() {
    const { orderFilter } = this.data
    
    try {
      let query = {}
      if (orderFilter !== 'all') {
        query.status = orderFilter
      }
      
      const res = await db.collection('orders')
        .where(query)
        .orderBy('createTime', 'desc')
        .limit(20)
        .get()
      
      const orders = await Promise.all(res.data.map(async (order, index) => {
        let userInfo = null
        if (order._openid) {
          try {
            const userRes = await db.collection('users')
              .where({ _openid: order._openid })
              .limit(1)
              .get()
            if (userRes.data && userRes.data.length > 0) {
              userInfo = userRes.data[0]
            }
          } catch (e) {
            console.log('获取用户信息失败:', e)
          }
        }
        
        return {
          ...order,
          orderIndex: res.data.length - index,
          userInfo,
          createTime: this.formatTime(order.createTime)
        }
      }))
      
      this.setData({ orders })
    } catch (err) {
      console.error('加载订单失败:', err)
    }
  },

  async loadFinance() {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    try {
      const todayRes = await db.collection('orders')
        .where({
          status: 'paid',
          paymentTime: _.gte(todayStart)
        })
        .get()
      
      const todayIncome = todayRes.data.reduce((sum, order) => sum + (order.priceDetail?.total || 0), 0)
      
      const monthRes = await db.collection('orders')
        .where({
          status: 'paid',
          paymentTime: _.gte(monthStart)
        })
        .get()
      
      const monthIncome = monthRes.data.reduce((sum, order) => sum + (order.priceDetail?.total || 0), 0)
      
      const pendingRes = await db.collection('orders')
        .where({
          status: 'pending'
        })
        .get()
      
      const pending = pendingRes.data.reduce((sum, order) => sum + (order.priceDetail?.total || 0), 0)
      
      this.setData({
        finance: {
          todayIncome: todayIncome.toFixed(2),
          monthIncome: monthIncome.toFixed(2),
          pending: pending.toFixed(2)
        }
      })
    } catch (err) {
      console.error('加载财务数据失败:', err)
    }
  },

  filterOrders(e) {
    const filter = e.currentTarget.dataset.filter
    this.setData({ orderFilter: filter })
    this.loadOrders()
  },

  viewOrder(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/orderDetail/orderDetail?id=${id}`
    })
  },

  formatTime(date) {
    if (!date) return ''
    const d = new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hour = String(d.getHours()).padStart(2, '0')
    const minute = String(d.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
  }
})