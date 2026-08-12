const app = getApp()

Page({
  data: {
    notices: ['3km 内配送费固定 ¥5，超出范围暂不配送'],
    categories: [
      { id: 'premium', name: '精品水果', icon: 'fruit' },
      { id: 'freshcut', name: '缤纷果切', icon: 'slice' },
      { id: 'dried', name: '营养干果', icon: 'nut' },
      { id: 'snacks', name: '休闲零食', icon: 'snack' }
    ],
    products: [],
    loading: true
  },

  onShow() {
    this.loadNotices()
    this.loadProducts()
  },

  async loadNotices() {
    const settings = app.globalData.shopSettings
    if (settings && settings.notices && settings.notices.length) {
      this.setData({ notices: settings.notices })
      return
    }
    try {
      const res = await wx.cloud.database().collection('settings').doc('homepage').get()
      if (res.data && res.data.notices && res.data.notices.length) {
        app.globalData.shopSettings = res.data
        this.setData({ notices: res.data.notices })
      }
    } catch (err) {
      console.log('加载公告失败:', err)
    }
  },

  async loadProducts() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.database().collection('products')
        .orderBy('sales', 'desc')
        .limit(20)
        .get()
      this.setData({
        products: res.data
          .filter(item => item.status !== 'inactive' && item.status !== 'soldout')
          .map(item => ({
          id: item._id,
          name: item.name,
          description: item.unit ? `约 ${item.unit}` : '',
          emoji: item.emoji || '🍎',
          price: item.price,
          originalPrice: item.originalPrice,
          tag: item.tag || '',
          sales: item.sales || 0,
            imageUrl: item.imageUrl || ''
          })),
        loading: false
      })
    } catch (err) {
      console.error('加载商品失败:', err)
      this.setData({ products: [], loading: false })
    }
  },

  goToCategory(e) {
    app.globalData.categoryId = e.currentTarget.dataset.id
    wx.switchTab({ url: '/pages/category/category' })
  },

  goToAllProducts() {
    app.globalData.categoryId = 'premium'
    wx.switchTab({ url: '/pages/category/category' })
  },

  addToCart(e) {
    const item = e.currentTarget.dataset.item
    app.addToCart({
      id: item.id,
      name: item.name,
      price: item.price,
      emoji: item.emoji,
      imageUrl: item.imageUrl,
      description: item.description
    }, 1)
    wx.showToast({ title: '已加入预约单', icon: 'success' })
  },

  shareApp() {
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] })
  }
})
