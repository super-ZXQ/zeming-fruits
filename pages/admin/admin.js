const db = wx.cloud.database()
const productsCollection = db.collection('products')

Page({
  data: {
    products: [],
    loading: true,
    showModal: false,
    isEdit: false,
    editForm: {
      _id: '',
      name: '',
      price: '',
      originalPrice: '',
      unit: '份',
      tag: '',
      sales: 0,
      imageUrl: '',
      isSeckill: false,
      seckillPrice: '',
      seckillStock: '',
      seckillLimit: ''
    },
    tempFilePath: ''
  },

  onLoad() {
    this.checkAdmin()
  },

  onShow() {
    if (wx.getStorageSync('isAdmin')) {
      this.loadProducts()
    }
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
    this.loadProducts()
  },

  goToDashboard() {
    wx.navigateTo({ url: '/pages/admin-dashboard/index' })
  },

  goToManagers() {
    wx.navigateTo({ url: '/pages/admin-managers/index' })
  },

  goToCoupons() {
    wx.navigateTo({ url: '/pages/coupon-admin/list' })
  },

  goToBatchImport() {
    wx.navigateTo({ url: '/pages/admin-product/batch-import' })
  },

  goToSettings() {
    wx.navigateTo({ url: '/pages/admin-settings/index' })
  },

  async loadProducts() {
    this.setData({ loading: true })
    
    try {
      const res = await productsCollection
        .orderBy('createTime', 'desc')
        .get()
      
      this.setData({
        products: res.data,
        loading: false
      })
    } catch (err) {
      console.error('加载商品失败:', err)
      this.setData({ loading: false })
      
      this.setData({
        products: this.getMockProducts(),
        loading: false
      })
    }
  },

  getMockProducts() {
    return [
      { _id: 'mock1', name: '花香蓝莓大果', price: 12.8, originalPrice: 19.9, unit: '份', tag: '品牌特惠', sales: 528 },
      { _id: 'mock2', name: '奶油草莓', price: 15.0, originalPrice: 29.9, unit: '份', tag: '今日特价', sales: 892 },
      { _id: 'mock3', name: '红富士苹果', price: 9.9, originalPrice: 15.8, unit: '斤', tag: '热销', sales: 1256 }
    ]
  },

  addProduct() {
    this.setData({
      showModal: true,
      isEdit: false,
      editForm: {
        _id: '',
        name: '',
        price: '',
        originalPrice: '',
        unit: '份',
        tag: '',
        sales: 0,
        imageUrl: ''
      },
      tempFilePath: ''
    })
  },

  editProduct(e) {
    const id = e.currentTarget.dataset.id
    const product = this.data.products.find(p => p._id === id)
    
    if (!product) return
    
    this.setData({
      showModal: true,
      isEdit: true,
      editForm: {
        _id: product._id,
        name: product.name || '',
        price: product.price || '',
        originalPrice: product.originalPrice || '',
        unit: product.unit || '份',
        tag: product.tag || '',
        sales: product.sales || 0,
        imageUrl: product.imageUrl || '',
        isSeckill: product.isSeckill || false,
        seckillPrice: product.seckillPrice || '',
        seckillStock: product.seckillStock || '',
        seckillLimit: product.seckillLimit || ''
      },
      tempFilePath: ''
    })
  },

  closeModal() {
    this.setData({
      showModal: false,
      tempFilePath: ''
    })
  },

  onImageError(e) {
    const index = e.currentTarget.dataset.index
    if (index !== undefined) {
      const products = this.data.products
      products[index].imageUrl = ''
      this.setData({ products })
    }
  },

  chooseImage() {
    const that = this
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        const fileType = tempFilePath.split('.').pop().toLowerCase()
        
        if (!['jpg', 'jpeg', 'png'].includes(fileType)) {
          wx.showToast({
            title: '仅支持jpg/png格式',
            icon: 'none'
          })
          return
        }
        
        wx.showLoading({ title: '上传中...', mask: true })
        
        const cloudPath = `products/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileType}`
        console.log('开始上传图片，cloudPath:', cloudPath)
        
        wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: tempFilePath,
          success: (uploadRes) => {
            console.log('上传成功，fileID:', uploadRes.fileID)
            
            const fileID = uploadRes.fileID
            
            that.setData({
              'editForm.imageUrl': fileID,
              'editForm.tempFileID': fileID
            })
            console.log('设置后的editForm.imageUrl (fileID):', fileID)
            
            wx.hideLoading()
            wx.showToast({ title: '上传成功', icon: 'success' })
          },
          fail: (err) => {
            wx.hideLoading()
            console.error('上传图片失败:', err)
            wx.showToast({ title: '上传失败', icon: 'none' })
          }
        })
      },
      fail: (err) => {
        console.error('选择图片失败:', err)
        if (err.errMsg && !err.errMsg.includes('cancel')) {
          wx.showToast({ title: '选择图片失败', icon: 'none' })
        }
      }
    })
  },

  onInputName(e) {
    this.setData({ 'editForm.name': e.detail.value })
  },

  onInputPrice(e) {
    this.setData({ 'editForm.price': e.detail.value })
  },

  onInputOriginalPrice(e) {
    this.setData({ 'editForm.originalPrice': e.detail.value })
  },

  onInputTag(e) {
    this.setData({ 'editForm.tag': e.detail.value })
  },

  onInputSales(e) {
    this.setData({ 'editForm.sales': parseInt(e.detail.value) || 0 })
  },

  selectUnit(e) {
    this.setData({ 'editForm.unit': e.currentTarget.dataset.unit })
  },

  toggleSeckill() {
    this.setData({ 'editForm.isSeckill': !this.data.editForm.isSeckill })
  },

  onInputSeckillPrice(e) {
    this.setData({ 'editForm.seckillPrice': e.detail.value })
  },

  onInputSeckillStock(e) {
    this.setData({ 'editForm.seckillStock': e.detail.value })
  },

  onInputSeckillLimit(e) {
    this.setData({ 'editForm.seckillLimit': e.detail.value })
  },

  async saveProduct() {
    const { editForm, isEdit } = this.data
    
    if (!editForm.name) {
      wx.showToast({ title: '请输入商品名称', icon: 'none' })
      return
    }
    
    if (!editForm.price) {
      wx.showToast({ title: '请输入商品价格', icon: 'none' })
      return
    }
    
    console.log('保存商品数据:', editForm)
    console.log('imageUrl的值:', editForm.imageUrl)
    
    wx.showLoading({ title: '保存中...' })
    
    try {
      const productData = {
        name: editForm.name,
        price: parseFloat(editForm.price),
        originalPrice: editForm.originalPrice ? parseFloat(editForm.originalPrice) : null,
        unit: editForm.unit || '份',
        tag: editForm.tag || '',
        sales: editForm.sales || 0,
        imageUrl: editForm.imageUrl || '',
        isSeckill: editForm.isSeckill || false,
        seckillPrice: editForm.isSeckill && editForm.seckillPrice ? parseFloat(editForm.seckillPrice) : null,
        seckillStock: editForm.isSeckill && editForm.seckillStock ? parseInt(editForm.seckillStock) : 0,
        seckillLimit: editForm.isSeckill && editForm.seckillLimit ? parseInt(editForm.seckillLimit) : 1,
        updateTime: db.serverDate()
      }
      
      console.log('准备保存的商品数据:', productData)
      
      let saveResult
      if (isEdit) {
        saveResult = await productsCollection.doc(editForm._id).update({
          data: productData
        })
        console.log('更新结果:', saveResult)
      } else {
        productData.createTime = db.serverDate()
        saveResult = await productsCollection.add({
          data: productData
        })
        console.log('添加结果:', saveResult)
      }
      
      wx.hideLoading()
      wx.showToast({ title: '保存成功', icon: 'success' })
      
      this.closeModal()
      
      setTimeout(() => {
        this.loadProducts()
      }, 500)
      
    } catch (err) {
      wx.hideLoading()
      console.error('保存失败，详细错误:', err)
      
      wx.showModal({
        title: '保存失败',
        content: err.message || '云数据库操作失败: ' + JSON.stringify(err),
        showCancel: false
      })
    }
  },

  saveToLocal() {
    const { editForm, isEdit } = this.data
    let products = this.data.products
    
    const productData = {
      _id: isEdit ? editForm._id : 'local_' + Date.now(),
      name: editForm.name,
      price: parseFloat(editForm.price),
      originalPrice: editForm.originalPrice ? parseFloat(editForm.originalPrice) : null,
      unit: editForm.unit || '份',
      tag: editForm.tag || '',
      sales: editForm.sales || 0,
      imageUrl: editForm.imageUrl || ''
    }
    
    if (isEdit) {
      const index = products.findIndex(p => p._id === editForm._id)
      if (index > -1) {
        products[index] = productData
      }
    } else {
      products.unshift(productData)
    }
    
    this.setData({ products })
    this.closeModal()
  },

  async uploadImage(filePath) {
    const cloudPath = `products/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`
    
    const res = await wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: filePath
    })
    
    try {
      const urlRes = await wx.cloud.getTempFileURL({
        fileList: [res.fileID]
      })
      
      if (urlRes.fileList && urlRes.fileList[0] && urlRes.fileList[0].tempFileURL) {
        return urlRes.fileList[0].tempFileURL
      }
    } catch (err) {
      console.error('获取临时链接失败:', err)
    }
    
    return res.fileID
  },

  async deleteProduct() {
    const { editForm } = this.data
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除"${editForm.name}"吗？`,
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' })
          
          try {
            const result = await productsCollection.doc(editForm._id).remove()
            console.log('删除成功:', result)
            
            wx.hideLoading()
            wx.showToast({ title: '删除成功', icon: 'success' })
            
            this.closeModal()
            setTimeout(() => {
              this.loadProducts()
            }, 500)
            
          } catch (err) {
            wx.hideLoading()
            console.error('删除失败:', err)
            
            wx.showModal({
              title: '删除失败',
              content: '云数据库删除失败，可能是权限问题。请检查云数据库权限设置。错误信息: ' + (err.message || '未知错误'),
              showCancel: false
            })
          }
        }
      }
    })
  }
})