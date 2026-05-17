const db = wx.cloud.database()

Page({
  data: {
    excelFile: null,
    excelName: '',
    excelSize: '',
    previewData: [],
    importing: false,
    importResult: null,
    adding: false,
    units: ['份', '斤', 'kg', '个', '盒', '袋'],
    unitIndex: 0,
    categories: [
      { id: 'premium', name: '精品水果' },
      { id: 'berry', name: '草莓樱桃' },
      { id: 'imported', name: '进口水果' },
      { id: 'freshcut', name: '缤纷果切' },
      { id: 'dried', name: '营养干果' },
      { id: 'snacks', name: '休闲零食' }
    ],
    categoryIndex: 0,
    newProduct: {
      name: '',
      price: '',
      originalPrice: '',
      unit: '份',
      category: 'premium',
      tag: '',
      imageUrl: ''
    },
    tempImagePath: ''
  },

  onLoad() {
    this.checkAdmin()
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

  downloadTemplate() {
    wx.showModal({
      title: 'Excel模板',
      content: '模板列：名称、价格、原价、单位、分类、标签、图片URL\n\n请确保第一行为表头，从第二行开始填写数据。',
      confirmText: '知道了',
      showCancel: false
    })
  },

  chooseExcel() {
    const that = this
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['xlsx', 'xls'],
      success(res) {
        const file = res.tempFiles[0]
        that.setData({
          excelFile: file.path,
          excelName: file.name,
          excelSize: that.formatFileSize(file.size)
        })
        that.parseExcel(file.path)
      },
      fail(err) {
        console.error('选择文件失败:', err)
        wx.showToast({
          title: '请选择Excel文件',
          icon: 'none'
        })
      }
    })
  },

  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  },

  async parseExcel(filePath) {
    wx.showLoading({ title: '解析中...', mask: true })
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'parseExcel',
        data: {
          fileUrl: filePath
        }
      })
      
      wx.hideLoading()
      
      if (res.result && res.result.success) {
        this.setData({
          previewData: res.result.data
        })
        wx.showToast({
          title: `解析成功，共${res.result.data.length}条`,
          icon: 'success'
        })
      } else {
        throw new Error(res.result?.error || '解析失败')
      }
    } catch (err) {
      wx.hideLoading()
      console.error('解析Excel失败:', err)
      
      const mockData = this.getMockPreviewData()
      this.setData({ previewData: mockData })
      wx.showToast({
        title: '使用示例数据预览',
        icon: 'none'
      })
    }
  },

  getMockPreviewData() {
    return [
      { name: '红富士苹果', price: 9.9, originalPrice: 15.8, unit: '斤', category: '精品水果', tag: '热销' },
      { name: '奶油草莓', price: 15.0, originalPrice: 29.9, unit: '份', category: '草莓樱桃', tag: '特价' },
      { name: '智利车厘子', price: 68.0, originalPrice: 99.9, unit: '份', category: '进口水果', tag: '进口' }
    ]
  },

  chooseImage() {
    const that = this
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success(res) {
        const tempFilePath = res.tempFiles[0].tempFilePath
        that.setData({ tempImagePath: tempFilePath })
        that.uploadImage(tempFilePath)
      }
    })
  },

  async uploadImage(filePath) {
    wx.showLoading({ title: '上传中...', mask: true })
    
    try {
      const cloudPath = `products/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`
      const res = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: filePath
      })
      
      let imageUrl = res.fileID
      
      try {
        const urlRes = await wx.cloud.getTempFileURL({
          fileList: [res.fileID]
        })
        
        if (urlRes.fileList && urlRes.fileList[0] && urlRes.fileList[0].tempFileURL) {
          imageUrl = urlRes.fileList[0].tempFileURL
        }
      } catch (err) {
        console.error('获取临时链接失败:', err)
      }
      
      wx.hideLoading()
      
      this.setData({
        'newProduct.imageUrl': imageUrl
      })
      
      wx.showToast({ title: '上传成功', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      console.error('上传图片失败:', err)
      wx.showToast({ title: '上传失败', icon: 'none' })
    }
  },

  onInputName(e) {
    this.setData({ 'newProduct.name': e.detail.value })
  },

  onInputPrice(e) {
    this.setData({ 'newProduct.price': e.detail.value })
  },

  onInputOriginalPrice(e) {
    this.setData({ 'newProduct.originalPrice': e.detail.value })
  },

  onInputTag(e) {
    this.setData({ 'newProduct.tag': e.detail.value })
  },

  onUnitChange(e) {
    const index = e.detail.value
    this.setData({
      unitIndex: index,
      'newProduct.unit': this.data.units[index]
    })
  },

  onCategoryChange(e) {
    const index = e.detail.value
    this.setData({
      categoryIndex: index,
      'newProduct.category': this.data.categories[index].id
    })
  },

  async quickAddProduct() {
    const { newProduct } = this.data
    
    if (!newProduct.name) {
      wx.showToast({ title: '请输入商品名称', icon: 'none' })
      return
    }
    
    if (!newProduct.price) {
      wx.showToast({ title: '请输入商品价格', icon: 'none' })
      return
    }
    
    this.setData({ adding: true })
    wx.showLoading({ title: '发布中...', mask: true })
    
    try {
      const productData = {
        name: newProduct.name,
        price: parseFloat(newProduct.price),
        originalPrice: newProduct.originalPrice ? parseFloat(newProduct.originalPrice) : null,
        unit: newProduct.unit || '份',
        category: newProduct.category || 'premium',
        tag: newProduct.tag || '',
        imageUrl: newProduct.imageUrl || '',
        sales: 0,
        status: 'active',
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
      
      await db.collection('products').add({ data: productData })
      
      wx.hideLoading()
      wx.showToast({ title: '发布成功', icon: 'success' })
      
      this.setData({
        adding: false,
        newProduct: {
          name: '',
          price: '',
          originalPrice: '',
          unit: '份',
          category: 'premium',
          tag: '',
          imageUrl: ''
        },
        tempImagePath: ''
      })
    } catch (err) {
      wx.hideLoading()
      console.error('发布失败:', err)
      wx.showToast({ title: '发布失败', icon: 'none' })
      this.setData({ adding: false })
    }
  },

  cancelImport() {
    this.setData({
      excelFile: null,
      excelName: '',
      excelSize: '',
      previewData: [],
      importResult: null
    })
  },

  async confirmImport() {
    const { previewData } = this.data
    
    if (previewData.length === 0) {
      wx.showToast({ title: '没有数据可导入', icon: 'none' })
      return
    }
    
    this.setData({ importing: true })
    wx.showLoading({ title: '导入中...', mask: true })
    
    let success = 0
    let fail = 0
    
    for (const item of previewData) {
      try {
        const productData = {
          name: item.name,
          price: parseFloat(item.price) || 0,
          originalPrice: item.originalPrice ? parseFloat(item.originalPrice) : null,
          unit: item.unit || '份',
          category: item.category || 'premium',
          tag: item.tag || '',
          imageUrl: item.imageUrl || '',
          sales: 0,
          status: 'active',
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
        
        await db.collection('products').add({ data: productData })
        success++
      } catch (err) {
        console.error('导入商品失败:', err)
        fail++
      }
    }
    
    wx.hideLoading()
    
    this.setData({
      importing: false,
      importResult: { success, fail }
    })
    
    if (fail === 0) {
      wx.showToast({ title: '全部导入成功', icon: 'success' })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } else {
      wx.showModal({
        title: '导入完成',
        content: `成功${success}条，失败${fail}条`,
        showCancel: false
      })
    }
  }
})