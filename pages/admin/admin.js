const MAX_IMAGE_SIZE = 200 * 1024

Page({
  data: {
    products: [],
    loading: true,
    authorized: false,
    adminRole: 'normal',
    showModal: false,
    isEdit: false,
    categories: [
      { id: 'premium', name: '精品水果' },
      { id: 'berry', name: '草莓樱桃' },
      { id: 'imported', name: '进口水果' },
      { id: 'freshcut', name: '缤纷果切' },
      { id: 'dried', name: '营养干果' },
      { id: 'snacks', name: '休闲零食' }
    ],
    categoryIndex: 0,
    editForm: {
      _id: '', name: '', price: '', originalPrice: '', unit: '份',
      category: 'premium', tag: '', sales: 0, imageUrl: '', status: 'active'
    }
  },

  onLoad() {
    this.checkAdmin()
  },

  onShow() {
    if (this.data.authorized) this.loadProducts()
  },

  goToDashboard() {
    wx.navigateTo({ url: '/pages/admin-dashboard/index' })
  },

  goToManagers() {
    wx.navigateTo({ url: '/pages/admin-managers/index' })
  },

  async checkAdmin() {
    try {
      const result = await wx.cloud.callFunction({ name: 'adminAuth' })
      const authorized = !!(result.result && result.result.isAdmin)
      wx.setStorageSync('isAdmin', authorized)
      if (!authorized) throw new Error('您不是管理员，无法访问此页面')
      this.setData({ authorized, adminRole: result.result.role || 'staff' })
      this.loadProducts()
    } catch (err) {
      wx.showModal({
        title: '无访问权限',
        content: err.message || '请使用已授权的管理员手机号登录',
        showCancel: false,
        success: () => wx.switchTab({ url: '/pages/index/index' })
      })
    }
  },

  async loadProducts() {
    this.setData({ loading: true })
    try {
      const result = await wx.cloud.callFunction({ name: 'adminProducts', data: { action: 'list' } })
      if (!result.result || !result.result.success) throw new Error('加载商品失败')
      this.setData({ products: result.result.products || [], loading: false })
    } catch (err) {
      console.error('加载商品失败:', err)
      this.setData({ products: [], loading: false })
      wx.showToast({ title: err.message || '加载商品失败', icon: 'none' })
    }
  },

  addProduct() {
    this.setData({
      showModal: true,
      isEdit: false,
      categoryIndex: 0,
      editForm: { _id: '', name: '', price: '', originalPrice: '', unit: '份', category: 'premium', tag: '', sales: 0, imageUrl: '', status: 'active' }
    })
  },

  editProduct(e) {
    const product = this.data.products.find(item => item._id === e.currentTarget.dataset.id)
    if (!product) return
    const categoryIndex = Math.max(0, this.data.categories.findIndex(item => item.id === product.category))
    this.setData({
      showModal: true,
      isEdit: true,
      categoryIndex,
      editForm: {
        _id: product._id,
        name: product.name || '',
        price: product.price === undefined ? '' : String(product.price),
        originalPrice: product.originalPrice === null || product.originalPrice === undefined ? '' : String(product.originalPrice),
        unit: product.unit || '份',
        category: product.category || 'premium',
        tag: product.tag || '',
        sales: product.sales || 0,
        imageUrl: product.imageUrl || '',
        status: product.status || 'active'
      }
    })
  },

  closeModal() {
    this.setData({ showModal: false })
  },

  onImageError(e) {
    const products = this.data.products.slice()
    const index = e.currentTarget.dataset.index
    if (products[index]) products[index].imageUrl = ''
    this.setData({ products })
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: res => {
        const image = res.tempFiles[0]
        if (!image || image.size > MAX_IMAGE_SIZE) {
          wx.showToast({ title: '请上传 200KB 以内的图片', icon: 'none' })
          return
        }
        const suffix = (image.tempFilePath.split('.').pop() || 'jpg').toLowerCase()
        if (!['jpg', 'jpeg', 'png'].includes(suffix)) {
          wx.showToast({ title: '仅支持 JPG 或 PNG 图片', icon: 'none' })
          return
        }
        wx.showLoading({ title: '上传中…', mask: true })
        wx.cloud.uploadFile({
          cloudPath: `products/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${suffix}`,
          filePath: image.tempFilePath,
          success: upload => this.setData({ 'editForm.imageUrl': upload.fileID }),
          fail: () => wx.showToast({ title: '图片上传失败', icon: 'none' }),
          complete: () => wx.hideLoading()
        })
      }
    })
  },

  onInputName(e) { this.setData({ 'editForm.name': e.detail.value }) },
  onInputPrice(e) { this.setData({ 'editForm.price': e.detail.value }) },
  onInputOriginalPrice(e) { this.setData({ 'editForm.originalPrice': e.detail.value }) },
  onInputTag(e) { this.setData({ 'editForm.tag': e.detail.value }) },
  onInputSales(e) { this.setData({ 'editForm.sales': e.detail.value }) },
  selectUnit(e) { this.setData({ 'editForm.unit': e.currentTarget.dataset.unit }) },
  onCategoryChange(e) {
    const categoryIndex = Number(e.detail.value)
    this.setData({ categoryIndex, 'editForm.category': this.data.categories[categoryIndex].id })
  },

  async toggleProductStatus(e) {
    const { id, status } = e.currentTarget.dataset
    const nextStatus = status === 'active' ? 'inactive' : 'active'
    try {
      wx.showLoading({ title: nextStatus === 'active' ? '上架中…' : '下架中…', mask: true })
      const result = await wx.cloud.callFunction({ name: 'adminProducts', data: { action: 'setStatus', id, status: nextStatus } })
      if (!result.result || !result.result.success) throw new Error('操作失败')
      wx.showToast({ title: nextStatus === 'active' ? '已上架' : '已下架', icon: 'success' })
      this.loadProducts()
    } catch (err) {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  async saveProduct() {
    const product = this.data.editForm
    if (!String(product.name || '').trim()) return wx.showToast({ title: '请输入商品名称', icon: 'none' })
    if (product.price === '' || Number(product.price) < 0) return wx.showToast({ title: '请输入正确价格', icon: 'none' })
    try {
      wx.showLoading({ title: '保存中…', mask: true })
      const result = await wx.cloud.callFunction({ name: 'adminProducts', data: { action: 'save', product } })
      if (!result.result || !result.result.success) throw new Error('保存失败')
      this.closeModal()
      wx.showToast({ title: '保存成功', icon: 'success' })
      this.loadProducts()
    } catch (err) {
      wx.showModal({ title: '保存失败', content: err.message || '请稍后重试', showCancel: false })
    } finally {
      wx.hideLoading()
    }
  }
})
