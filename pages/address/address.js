Page({
  data: {
    addresses: [],
    selectMode: false
  },

  onLoad(options) {
    this.setData({ selectMode: options.select === '1' })
  },

  onShow() {
    this.loadAddresses()
  },

  async loadAddresses() {
    try {
      const res = await wx.cloud.callFunction({ name: 'customerProfile', data: { action: 'list' } })
      if (!res.result || !res.result.success) throw new Error('地址加载失败')
      const addresses = (res.result.addresses || []).map(item => ({
        ...item,
        id: item._id,
        name: item.contactName,
        detail: `${item.address || ''}${item.doorNumber || ''}`
      }))
      this.setData({ addresses })
    } catch (err) {
      console.error('加载地址失败:', err)
      wx.showToast({ title: '地址加载失败', icon: 'none' })
    }
  },

  addAddress() {
    wx.navigateTo({ url: '/pages/address/add' })
  },

  editAddress(e) {
    wx.navigateTo({
      url: `/pages/address/add?id=${e.currentTarget.dataset.id}`
    })
  },

  selectAddress(e) {
    if (!this.data.selectMode) return
    wx.setStorageSync('checkoutAddressId', e.currentTarget.dataset.id)
    wx.navigateBack()
  },

  deleteAddress(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '确定要删除该地址吗？',
      success: async (res) => {
        if (!res.confirm) return

        const result = await wx.cloud.callFunction({ name: 'customerProfile', data: { action: 'delete', id } })
        if (!result.result || !result.result.success) throw new Error('删除失败')

        wx.showToast({ title: '删除成功', icon: 'success' })
        this.loadAddresses()
      }
    })
  },

  async setDefault(e) {
    const id = e.currentTarget.dataset.id
    const result = await wx.cloud.callFunction({ name: 'customerProfile', data: { action: 'setDefault', id } })
    if (!result.result || !result.result.success) return wx.showToast({ title: '设置失败', icon: 'none' })

    wx.showToast({ title: '已设为默认', icon: 'success' })
    this.loadAddresses()
  }
})
