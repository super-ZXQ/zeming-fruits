const db = wx.cloud.database()

Page({
  data: {
    searchKeyword: '',
    searchResults: [],
    selectedUserPhone: '',
    selectedUserName: '',
    roleIndex: 0,
    roles: [
      { value: 'staff', label: '普通管理员' },
      { value: 'super_admin', label: '超级管理员' }
    ],
    managers: [],
    adding: false,
    currentPhone: ''
  },

  onLoad() {
    this.checkSuperAdmin()
    this.loadManagers()
    this.getCurrentPhone()
  },

  async getCurrentPhone() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'userLogin'
      })
      if (res.result.success) {
        this.setData({ currentPhone: wx.getStorageSync('userPhone') })
      }
    } catch (err) {
      console.error('获取手机号失败:', err)
    }
  },

  checkSuperAdmin() {
    const phone = wx.getStorageSync('userPhone')
    console.log('检查超级管理员, phone:', phone)
  },

  async loadManagers() {
    try {
      const res = await db.collection('managers').get()
      const managersWithNickname = await Promise.all(res.data.map(async (manager) => {
        try {
          const userRes = await db.collection('users').where({ phone: manager.phone }).get()
          if (userRes.data && userRes.data.length > 0) {
            manager.nickname = userRes.data[0].nickname
          }
        } catch (err) {
          console.log('获取用户昵称失败')
        }
        return manager
      }))
      this.setData({ managers: managersWithNickname })
    } catch (err) {
      console.error('加载管理员列表失败:', err)
    }
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value })
  },

  async searchUsers() {
    const { searchKeyword } = this.data
    
    if (!searchKeyword.trim()) {
      wx.showToast({ title: '请输入搜索关键词', icon: 'none' })
      return
    }
    
    wx.showLoading({ title: '搜索中...', mask: true })
    
    try {
      const res = await db.collection('users')
        .where({
          phone: db.RegExp({
            regexp: searchKeyword,
            options: 'i'
          })
        })
        .limit(10)
        .get()
      
      wx.hideLoading()
      
      if (res.data && res.data.length > 0) {
        this.setData({ searchResults: res.data })
      } else {
        this.setData({ searchResults: [] })
        wx.showToast({ title: '未找到用户', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      console.error('搜索用户失败:', err)
      wx.showToast({ title: '搜索失败', icon: 'none' })
    }
  },

  selectUser(e) {
    const { id, phone, name } = e.currentTarget.dataset
    this.setData({
      selectedUserPhone: phone,
      selectedUserName: name || '未命名用户',
      searchResults: [],
      searchKeyword: ''
    })
    wx.showToast({ title: '已选择用户', icon: 'success' })
  },

  onAdminIdInput(e) {
    this.setData({ newAdminId: e.detail.value })
  },

  onRoleChange(e) {
    this.setData({ roleIndex: parseInt(e.detail.value) })
  },

  async addAdmin() {
    const { selectedUserPhone, selectedUserName, roles, roleIndex, adding } = this.data

    if (adding) return

    if (!selectedUserPhone) {
      wx.showToast({ title: '请先选择用户', icon: 'none' })
      return
    }

    this.setData({ adding: true })
    wx.showLoading({ title: '添加中...' })

    try {
      const existRes = await db.collection('managers')
        .where({ phone: selectedUserPhone })
        .get()

      if (existRes.data && existRes.data.length > 0) {
        wx.hideLoading()
        wx.showToast({ title: '该用户已是管理员', icon: 'none' })
        this.setData({ adding: false })
        return
      }

      const addResult = await db.collection('managers').add({
        data: {
          phone: selectedUserPhone,
          nickname: selectedUserName,
          role: roles[roleIndex].value,
          status: 'active',
          createTime: db.serverDate()
        }
      })

      console.log('添加管理员结果:', addResult)
      wx.hideLoading()
      wx.showToast({ title: '添加成功', icon: 'success' })

      this.setData({
        selectedUserPhone: '',
        selectedUserName: '',
        adding: false
      })

      setTimeout(() => {
        this.loadManagers()
      }, 500)
    } catch (err) {
      wx.hideLoading()
      console.error('添加管理员失败:', err)
      wx.showModal({
        title: '添加失败',
        content: '错误信息: ' + (err.message || JSON.stringify(err)),
        showCancel: false
      })
      this.setData({ adding: false })
    }
  },

  async toggleAdmin(e) {
    const { id, status } = e.currentTarget.dataset
    const newStatus = status === 'active' ? 'disabled' : 'active'

    try {
      await db.collection('managers').doc(id).update({
        data: { status: newStatus }
      })

      wx.showToast({ 
        title: newStatus === 'active' ? '已启用' : '已禁用', 
        icon: 'success' 
      })
      
      this.loadManagers()
    } catch (err) {
      console.error('操作失败:', err)
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  async deleteAdmin(e) {
    const { id, name } = e.currentTarget.dataset

    wx.showModal({
      title: '确认删除',
      content: `确定要删除管理员"${name}"吗？`,
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' })
          try {
            const result = await db.collection('managers').doc(id).remove()
            console.log('删除结果:', result)
            
            wx.hideLoading()
            wx.showToast({ 
              title: '删除成功', 
              icon: 'success' 
            })
            
            this.loadManagers()
          } catch (err) {
            wx.hideLoading()
            console.error('删除失败:', err)
            wx.showModal({
              title: '删除失败',
              content: '错误信息: ' + (err.message || JSON.stringify(err)),
              showCancel: false
            })
          }
        }
      }
    })
  }
})