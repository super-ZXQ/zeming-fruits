const tencentMap = require('../../utils/tencentMap.js')

Page({
  data: {
    latitude: 33.588399,
    longitude: 119.073823,
    poiName: '',
    distance: '',
    doorNumber: '',
    contactName: '',
    gender: 'male',
    phone: '',
    selectedTags: [],
    pasteText: '',
    detailAddress: '',
    markers: [],
    canSave: false,
    editId: null
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ editId: options.id })
      this.loadAddress(options.id)
    } else {
      this.getCurrentLocation()
    }
  },

  async getCurrentLocation() {
    wx.showLoading({ title: '定位中...', mask: true })
    
    try {
      const res = await new Promise((resolve, reject) => {
        wx.getLocation({
          type: 'gcj02',
          success: resolve,
          fail: reject
        })
      })
      
      this.setData({
        latitude: res.latitude,
        longitude: res.longitude
      })
      
      this.updateDistance(res.latitude, res.longitude)
      
      this.chooseLocation()
    } catch (err) {
      wx.hideLoading()
      console.log('获取位置失败:', err)
      this.chooseLocation()
    }
  },

  async loadAddress(id) {
    try {
      const db = wx.cloud.database()
      const res = await db.collection('addresses').doc(id).get()
      
      if (res.data) {
        const addr = res.data
        this.setData({
          poiName: addr.name || '',
          latitude: addr.latitude,
          longitude: addr.longitude,
          doorNumber: addr.doorNumber || '',
          contactName: addr.contactName || '',
          gender: addr.gender || 'male',
          phone: addr.phone || '',
          selectedTags: addr.tags || [],
          detailAddress: addr.address || '',
          markers: [{
            id: 1,
            latitude: addr.latitude,
            longitude: addr.longitude,
            width: 30,
            height: 30
          }]
        })
        
        this.updateDistance(addr.latitude, addr.longitude)
        this.checkCanSave()
      }
    } catch (err) {
      console.error('加载地址失败:', err)
    }
  },

  updateDistance(lat, lng) {
    const shopLat = 33.588399
    const shopLng = 119.073823
    
    const distance = this.calculateDistance(lat, lng, shopLat, shopLng)
    const distanceText = distance < 1000 
      ? Math.round(distance) + '米'
      : (distance / 1000).toFixed(1) + '公里'
    
    this.setData({ distance: distanceText })
  },

  calculateDistance(lat1, lng1, lat2, lng2) {
    const rad = Math.PI / 180.0
    const radLat1 = lat1 * rad
    const radLat2 = lat2 * rad
    const a = radLat1 - radLat2
    const b = lng1 * rad - lng2 * rad
    let s = 2 * Math.asin(Math.sqrt(
      Math.pow(Math.sin(a / 2), 2) +
      Math.cos(radLat1) * Math.cos(radLat2) * Math.pow(Math.sin(b / 2), 2)
    ))
    s = s * 6378137
    return s
  },

  chooseLocation() {
    wx.chooseLocation({
      latitude: this.data.latitude,
      longitude: this.data.longitude,
      success: (res) => {
        console.log('选择位置成功:', res)
        
        this.setData({
          poiName: res.name || '',
          latitude: res.latitude,
          longitude: res.longitude,
          detailAddress: res.address || this.data.detailAddress,
          markers: [{
            id: 1,
            latitude: res.latitude,
            longitude: res.longitude,
            width: 30,
            height: 30
          }]
        })
        
        this.updateDistance(res.latitude, res.longitude)
        this.checkCanSave()
      },
      fail: (err) => {
        console.log('选择位置失败:', err)
        if (!this.data.poiName) {
          wx.showToast({ title: '请选择位置', icon: 'none' })
        }
      }
    })
  },

  onMapTap() {
    this.chooseLocation()
  },

  onDoorNumberInput(e) {
    this.setData({ doorNumber: e.detail.value })
    this.checkCanSave()
  },

  onNameInput(e) {
    this.setData({ contactName: e.detail.value })
    this.checkCanSave()
  },

  selectGender(e) {
    this.setData({ gender: e.currentTarget.dataset.gender })
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value })
    this.checkCanSave()
  },

  toggleTag(e) {
    const tag = e.currentTarget.dataset.tag
    let selectedTags = [...this.data.selectedTags]
    
    const index = selectedTags.indexOf(tag)
    if (index > -1) {
      selectedTags.splice(index, 1)
    } else {
      if (selectedTags.length < 2) {
        selectedTags.push(tag)
      } else {
        selectedTags.shift()
        selectedTags.push(tag)
      }
    }
    
    this.setData({ selectedTags })
  },

  onPasteInput(e) {
    this.setData({ pasteText: e.detail.value })
  },

  parsePasteText() {
    const text = this.data.pasteText.trim()
    if (!text) {
      wx.getClipboardData({
        success: (res) => {
          this.setData({ pasteText: res.clipboardData })
          this.parseAddressText(res.clipboardData)
        }
      })
    } else {
      this.parseAddressText(text)
    }
  },

  parseAddressText(text) {
    const phoneMatch = text.match(/1[3-9]\d{9}/)
    if (phoneMatch) {
      this.setData({ phone: phoneMatch[0] })
    }
    
    const nameMatch = text.match(/(?:姓名|收货人|联系人)[：:]\s*(\S+)/)
    if (nameMatch) {
      this.setData({ contactName: nameMatch[1] })
    }
    
    const addressMatch = text.match(/(?:地址|详细地址)[：:]\s*(\S+)/)
    if (addressMatch) {
      this.setData({ detailAddress: addressMatch[1] })
    }
    
    this.checkCanSave()
    wx.showToast({ title: '已识别地址信息', icon: 'success' })
  },

  onDetailInput(e) {
    this.setData({ detailAddress: e.detail.value })
    this.checkCanSave()
  },

  checkCanSave() {
    const { poiName, contactName, phone, doorNumber } = this.data
    const canSave = poiName && contactName && phone && phone.length === 11 && doorNumber
    this.setData({ canSave: !!canSave })
  },

  showCountryCodePicker() {
    wx.showActionSheet({
      itemList: ['+86 中国', '+852 香港', '+853 澳门', '+886 台湾'],
      success: (res) => {
        console.log('选择区号:', res.tapIndex)
      }
    })
  },

  async saveAddress() {
    if (!this.data.canSave) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }
    
    wx.showLoading({ title: '保存中...', mask: true })
    
    try {
      const db = wx.cloud.database()
      const addressData = {
        name: this.data.poiName,
        address: this.data.detailAddress,
        doorNumber: this.data.doorNumber,
        contactName: this.data.contactName,
        gender: this.data.gender,
        phone: this.data.phone,
        tags: this.data.selectedTags,
        latitude: this.data.latitude,
        longitude: this.data.longitude,
        updatedAt: db.serverDate()
      }
      
      if (this.data.editId) {
        await db.collection('addresses').doc(this.data.editId).update({
          data: addressData
        })
      } else {
        addressData.createdAt = db.serverDate()
        await db.collection('addresses').add({ data: addressData })
      }
      
      wx.hideLoading()
      wx.showToast({ title: '保存成功', icon: 'success' })
      
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } catch (err) {
      wx.hideLoading()
      console.error('保存地址失败:', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  }
})
