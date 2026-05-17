const db = wx.cloud.database()
const couponsCollection = db.collection('coupons')

Page({
  data: {
    currentTab: 'all',
    coupons: [],
    stats: {
      total: 0,
      active: 0,
      used: 0
    },
    loading: false
  },

  onLoad() {
    this.checkAdmin()
    this.loadCoupons()
  },

  onShow() {
    this.loadCoupons()
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

  async loadCoupons() {
    this.setData({ loading: true })
    
    try {
      let res
      const now = new Date().toISOString().split('T')[0]
      
      if (this.data.currentTab === 'all') {
        res = await couponsCollection.orderBy('createTime', 'desc').get()
      } else if (this.data.currentTab === 'active') {
        res = await couponsCollection.where({
          validTo: db.command.gte(now),
          status: 'active'
        }).orderBy('createTime', 'desc').get()
      } else {
        res = await couponsCollection.where({
          validTo: db.command.lt(now)
        }).orderBy('validTo', 'desc').get()
      }
      
      const coupons = res.data.map(item => {
        if (item.validTo < now && item.status === 'active') {
          item.status = 'expired'
        }
        return item
      })
      
      const stats = {
        total: coupons.length,
        active: coupons.filter(c => c.status === 'active').length,
        used: coupons.reduce((sum, c) => sum + (c.usedCount || 0), 0)
      }
      
      this.setData({ coupons, stats, loading: false })
    } catch (err) {
      console.error('加载优惠券失败:', err)
      this.setData({ loading: false })
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ currentTab: tab })
    this.loadCoupons()
  },

  goToCreate() {
    wx.navigateTo({
      url: '/pages/coupon-admin/create'
    })
  },

  editCoupon(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/coupon-admin/create?id=${id}`
    })
  },

  async toggleStatus(e) {
    const id = e.currentTarget.dataset.id
    const status = e.currentTarget.dataset.status
    const newStatus = status === 'active' ? 'disabled' : 'active'
    
    try {
      await couponsCollection.doc(id).update({
        data: { status: newStatus }
      })
      
      wx.showToast({
        title: newStatus === 'active' ? '已启用' : '已禁用',
        icon: 'success'
      })
      
      this.loadCoupons()
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  async deleteCoupon(e) {
    const id = e.currentTarget.dataset.id
    
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复',
      success: async (res) => {
        if (res.confirm) {
          try {
            await couponsCollection.doc(id).remove()
            
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            })
            
            this.loadCoupons()
          } catch (err) {
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }
})