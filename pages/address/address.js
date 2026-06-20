Page({
  data: {
    addresses: []
  },

  onShow() {
    this.loadAddresses()
  },

  async loadAddresses() {
    try {
      const res = await wx.cloud.database().collection('addresses')
        .orderBy('createdAt', 'desc')
        .get()
      const addresses = res.data.map(item => ({
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

  deleteAddress(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '确定要删除该地址吗？',
      success: async (res) => {
        if (!res.confirm) return

        const deleted = this.data.addresses.find(item => item.id === id)
        await wx.cloud.database().collection('addresses').doc(id).remove()

        const remaining = this.data.addresses.filter(item => item.id !== id)
        if (deleted && deleted.isDefault && remaining.length > 0) {
          await wx.cloud.database().collection('addresses').doc(remaining[0].id).update({
            data: { isDefault: true }
          })
        }

        wx.showToast({ title: '删除成功', icon: 'success' })
        this.loadAddresses()
      }
    })
  },

  async setDefault(e) {
    const id = e.currentTarget.dataset.id
    const collection = wx.cloud.database().collection('addresses')

    await Promise.all(this.data.addresses.map(item =>
      collection.doc(item.id).update({
        data: { isDefault: item.id === id }
      })
    ))

    wx.showToast({ title: '已设为默认', icon: 'success' })
    this.loadAddresses()
  }
})
