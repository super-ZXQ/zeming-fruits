const db = wx.cloud.database()
const couponsCollection = db.collection('coupons')
const productsCollection = db.collection('products')

Page({
  data: {
    form: {
      name: '',
      type: 'discount',
      discountType: 'cash',
      value: '',
      discount: '',
      threshold: '',
      stock: '',
      validFrom: '',
      validTo: '',
      scope: 'all',
      goodsIds: [],
      password: '',
      description: ''
    },
    couponTypes: [
      { value: 'discount', label: '通用券' },
      { value: 'activity', label: '活动券' },
      { value: 'hidden', label: '隐藏券' }
    ],
    typeIndex: 0,
    discountTypes: [
      { value: 'cash', label: '满减券' },
      { value: 'percent', label: '折扣券' }
    ],
    discountIndex: 0,
    scopeTypes: [
      { value: 'all', label: '全场通用' },
      { value: 'specific', label: '指定商品' }
    ],
    scopeIndex: 0,
    products: [],
    selectedGoods: [],
    loading: false
  },

  onLoad() {
    this.checkAdmin()
    this.loadProducts()
    this.initDate()
  },

  checkAdmin() {
    const isAdmin = wx.getStorageSync('isAdmin')
    if (!isAdmin) {
      wx.showModal({
        title: '无权限',
        content: '您不是管理员，无法访问此页面',
        showCancel: false,
        success: () => {
          wx.navigateBack()
        }
      })
    }
  },

  async loadProducts() {
    try {
      const res = await productsCollection.limit(100).get()
      this.setData({ products: res.data })
    } catch (err) {
      console.error('加载商品失败:', err)
    }
  },

  initDate() {
    const today = new Date()
    const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    
    this.setData({
      'form.validFrom': this.formatDate(today),
      'form.validTo': this.formatDate(nextMonth)
    })
  },

  formatDate(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  onInputChange(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    this.setData({
      [`form.${field}`]: value
    })
  },

  onTypeChange(e) {
    const index = e.detail.value
    this.setData({
      typeIndex: index,
      'form.type': this.data.couponTypes[index].value
    })
  },

  onDiscountChange(e) {
    const index = e.detail.value
    this.setData({
      discountIndex: index,
      'form.discountType': this.data.discountTypes[index].value
    })
  },

  onScopeChange(e) {
    const index = e.detail.value
    this.setData({
      scopeIndex: index,
      'form.scope': this.data.scopeTypes[index].value
    })
  },

  onDateChange(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [`form.${field}`]: e.detail.value
    })
  },

  toggleGoods(e) {
    const id = e.currentTarget.dataset.id
    const selectedGoods = [...this.data.selectedGoods]
    const index = selectedGoods.indexOf(id)
    
    if (index > -1) {
      selectedGoods.splice(index, 1)
    } else {
      selectedGoods.push(id)
    }
    
    this.setData({
      selectedGoods,
      'form.goodsIds': selectedGoods
    })
  },

  validateForm() {
    const { form, discountIndex, typeIndex } = this.data
    
    if (!form.name) {
      wx.showToast({ title: '请输入优惠券名称', icon: 'none' })
      return false
    }
    
    if (discountIndex === 0 && !form.value) {
      wx.showToast({ title: '请输入减免金额', icon: 'none' })
      return false
    }
    
    if (discountIndex === 1 && !form.discount) {
      wx.showToast({ title: '请输入折扣比例', icon: 'none' })
      return false
    }
    
    if (!form.stock) {
      wx.showToast({ title: '请输入库存数量', icon: 'none' })
      return false
    }
    
    if (!form.validFrom || !form.validTo) {
      wx.showToast({ title: '请选择有效期', icon: 'none' })
      return false
    }
    
    if (typeIndex === 2 && !form.password) {
      wx.showToast({ title: '请输入领取口令', icon: 'none' })
      return false
    }
    
    return true
  },

  async submitForm() {
    if (!this.validateForm()) return
    
    this.setData({ loading: true })
    
    try {
      const { form, discountIndex, scopeIndex } = this.data
      
      const couponData = {
        name: form.name,
        type: form.type,
        discountType: form.discountType,
        value: discountIndex === 0 ? parseFloat(form.value) : null,
        discount: discountIndex === 1 ? parseFloat(form.discount) : null,
        threshold: parseFloat(form.threshold) || 0,
        stock: parseInt(form.stock),
        usedCount: 0,
        validFrom: form.validFrom,
        validTo: form.validTo,
        scope: form.scope,
        goodsIds: scopeIndex === 1 ? form.goodsIds : [],
        password: form.password || null,
        description: form.description || '',
        createTime: db.serverDate(),
        status: 'active'
      }
      
      await couponsCollection.add({ data: couponData })
      
      wx.showToast({
        title: '创建成功',
        icon: 'success'
      })
      
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } catch (err) {
      console.error('创建优惠券失败:', err)
      wx.showToast({
        title: '创建失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  cancelCreate() {
    wx.navigateBack()
  }
})