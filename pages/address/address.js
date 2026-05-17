const app = getApp();
const tencentMap = require('../../utils/tencentMap')

Page({
  data: {
    addresses: [],
    showModal: false,
    isEdit: false,
    editId: '',
    region: [],
    isLocating: false,
    formData: {
      name: '',
      phone: '',
      province: '',
      city: '',
      district: '',
      detail: '',
      isDefault: false
    }
  },

  onLoad(options) {
    if (options.from === 'checkout') {
      this.setData({ fromCheckout: true });
    }
    this.loadAddresses();
  },

  onShow() {
    this.loadAddresses();
  },

  loadAddresses() {
    const addresses = wx.getStorageSync('addresses') || [];
    this.setData({ addresses });
  },

  addAddress() {
    wx.navigateTo({
      url: '/pages/address/add'
    })
  },

  showAddModal() {
    this.setData({
      showModal: true,
      isEdit: false,
      editId: '',
      region: [],
      formData: {
        name: '',
        phone: '',
        province: '',
        city: '',
        district: '',
        detail: '',
        isDefault: false
      }
    });
  },

  editAddress(e) {
    const id = e.currentTarget.dataset.id;
    const address = this.data.addresses.find(a => a.id === id);
    if (address) {
      this.setData({
        showModal: true,
        isEdit: true,
        editId: id,
        region: [address.province, address.city, address.district],
        formData: { ...address }
      });
    }
  },

  closeModal() {
    this.setData({ showModal: false });
  },

  inputName(e) {
    this.setData({ 'formData.name': e.detail.value });
  },

  inputPhone(e) {
    this.setData({ 'formData.phone': e.detail.value });
  },

  inputDetail(e) {
    this.setData({ 'formData.detail': e.detail.value });
  },

  bindRegionChange(e) {
    const region = e.detail.value;
    this.setData({
      region,
      'formData.province': region[0],
      'formData.city': region[1],
      'formData.district': region[2]
    });
  },

  bindDefaultChange(e) {
    this.setData({ 'formData.isDefault': e.detail.value });
  },

  getLocation() {
    if (!this.data.showModal) {
      this.addAddress()
      setTimeout(() => {
        this.doGetLocation()
      }, 300)
    } else {
      this.doGetLocation()
    }
  },

  doGetLocation() {
    if (this.data.isLocating) {
      return
    }
    this.setData({ isLocating: true })
    
    wx.showLoading({ title: '定位中...', mask: true })
    
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        console.log('获取位置成功:', res)
        
        wx.chooseLocation({
          latitude: res.latitude,
          longitude: res.longitude,
          success: (chooseRes) => {
            console.log('选择位置成功:', chooseRes)
            
            const detailAddr = chooseRes.address || chooseRes.name || ''
            
            this.reverseGeocoder(chooseRes.latitude, chooseRes.longitude, detailAddr)
          },
          fail: (err) => {
            wx.hideLoading()
            this.setData({ isLocating: false })
            console.log('选择位置失败:', err)
            
            if (err.errMsg && err.errMsg.includes('cancel')) {
              return
            }
            
            this.reverseGeocoder(res.latitude, res.longitude, '')
          }
        })
      },
      fail: (err) => {
        wx.hideLoading()
        this.setData({ isLocating: false })
        console.log('获取位置失败:', err)
        
        if (err.errMsg && err.errMsg.includes('auth')) {
          wx.showModal({
            title: '需要位置权限',
            content: '请允许获取位置权限',
            confirmText: '去设置',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.openSetting()
              }
            }
          })
        } else {
          wx.chooseLocation({
            success: (chooseRes) => {
              console.log('选择位置成功:', chooseRes)
              const detailAddr = chooseRes.address || chooseRes.name || ''
              this.reverseGeocoder(chooseRes.latitude, chooseRes.longitude, detailAddr)
            },
            fail: (err2) => {
              console.log('选择位置失败:', err2)
              wx.showToast({ title: '定位失败', icon: 'none' })
            }
          })
        }
      }
    })
  },

  reverseGeocoder(latitude, longitude, detailAddress) {
    wx.request({
      url: 'https://apis.map.qq.com/ws/geocoder/v1/',
      data: {
        key: tencentMap.getMapKey(),
        location: `${latitude},${longitude}`
      },
      success: (res) => {
        wx.hideLoading()
        this.setData({ isLocating: false })
        
        console.log('逆地址解析结果:', res.data)
        
        if (res.data && res.data.status === 0) {
          const result = res.data.result
          const addressComponent = result.address_component
          
          console.log('解析到的省市区:', addressComponent)
          
          this.setData({
            region: [
              addressComponent.province || '',
              addressComponent.city || '',
              addressComponent.district || ''
            ],
            'formData.province': addressComponent.province || '',
            'formData.city': addressComponent.city || '',
            'formData.district': addressComponent.district || '',
            'formData.detail': detailAddress || result.formatted_addresses?.recommend || result.address || ''
          })
          
          console.log('设置后的表单数据:', this.data.formData)
          console.log('设置后的region:', this.data.region)
          
          wx.showToast({ title: '定位成功', icon: 'success' })
        } else {
          console.log('逆地址解析失败，使用默认地址')
          this.setData({
            'formData.detail': detailAddress || ''
          })
          wx.showToast({ title: '定位成功', icon: 'success' })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        this.setData({ isLocating: false })
        
        console.log('逆地址解析失败:', err)
        this.setData({
          'formData.detail': detailAddress || ''
        })
        wx.showToast({ title: '定位成功', icon: 'success' })
      }
    })
  },

  saveAddress() {
    const { formData, isEdit, editId, addresses } = this.data;
    
    if (!formData.name.trim()) {
      wx.showToast({ title: '请输入收货人', icon: 'none' });
      return;
    }
    if (!formData.phone.trim() || !/^1[3-9]\d{9}$/.test(formData.phone)) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' });
      return;
    }
    if (!formData.province) {
      wx.showToast({ title: '请选择省市区', icon: 'none' });
      return;
    }
    if (!formData.detail.trim()) {
      wx.showToast({ title: '请输入详细地址', icon: 'none' });
      return;
    }

    let newAddresses = [...addresses];
    
    if (formData.isDefault) {
      newAddresses = newAddresses.map(a => ({ ...a, isDefault: false }));
    }

    if (isEdit) {
      newAddresses = newAddresses.map(a => 
        a.id === editId ? { ...formData, id: editId } : a
      );
    } else {
      const newId = Date.now().toString();
      newAddresses.push({ ...formData, id: newId });
    }

    wx.setStorageSync('addresses', newAddresses);
    this.setData({ showModal: false, addresses: newAddresses });
    
    wx.showToast({
      title: isEdit ? '修改成功' : '添加成功',
      icon: 'success'
    });
  },

  deleteAddress(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除该地址吗？',
      success: (res) => {
        if (res.confirm) {
          let addresses = this.data.addresses.filter(a => a.id !== id);
          
          if (addresses.length > 0 && !addresses.some(a => a.isDefault)) {
            addresses[0].isDefault = true;
          }
          
          wx.setStorageSync('addresses', addresses);
          this.setData({ addresses });
          
          wx.showToast({ title: '删除成功', icon: 'success' });
        }
      }
    });
  },

  setDefault(e) {
    const id = e.currentTarget.dataset.id;
    let addresses = this.data.addresses.map(a => ({
      ...a,
      isDefault: a.id === id
    }));
    
    wx.setStorageSync('addresses', addresses);
    this.setData({ addresses });
    
    wx.showToast({ title: '已设为默认', icon: 'success' });
  },

  selectAddress(e) {
    if (this.data.fromCheckout) {
      const id = e.currentTarget.dataset.id;
      const address = this.data.addresses.find(a => a.id === id);
      if (address) {
        const pages = getCurrentPages();
        const checkoutPage = pages.find(p => p.route.includes('checkout'));
        if (checkoutPage) {
          checkoutPage.setData({ 
            selectedAddress: address,
            hasAddress: true
          });
        }
        wx.navigateBack();
      }
    }
  }
});