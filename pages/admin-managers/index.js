Page({
  data: {
    searchKeyword: '', searchResults: [], selectedUserId: '', selectedUserPhone: '', selectedUserName: '',
    roleIndex: 0, roles: [{ value: 'staff', label: '普通管理员' }, { value: 'super_admin', label: '超级管理员' }],
    managers: [], adding: false
  },

  onLoad() { this.checkOwner() },

  async checkOwner() {
    try {
      const result = await wx.cloud.callFunction({ name: 'adminAuth' })
      if (!result.result || !['owner', 'super_admin'].includes(result.result.role)) throw new Error('仅店主可管理管理员账号')
      this.loadManagers()
    } catch (err) {
      wx.showModal({ title: '无访问权限', content: err.message || '仅店主可访问此页面', showCancel: false, success: () => wx.navigateBack() })
    }
  },

  async loadManagers() {
    try {
      const result = await wx.cloud.callFunction({ name: 'adminManagers', data: { action: 'list' } })
      if (!result.result || !result.result.success) throw new Error('加载管理员失败')
      this.setData({ managers: result.result.managers || [] })
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    }
  },

  onSearchInput(e) { this.setData({ searchKeyword: e.detail.value }) },
  onRoleChange(e) { this.setData({ roleIndex: Number(e.detail.value) }) },

  async searchUsers() {
    const keyword = this.data.searchKeyword.trim()
    if (!keyword) return wx.showToast({ title: '请输入手机号', icon: 'none' })
    try {
      wx.showLoading({ title: '搜索中', mask: true })
      const result = await wx.cloud.callFunction({ name: 'adminManagers', data: { action: 'search', keyword } })
      if (!result.result || !result.result.success) throw new Error('搜索失败')
      this.setData({ searchResults: result.result.users || [] })
      if (!(result.result.users || []).length) wx.showToast({ title: '未找到用户', icon: 'none' })
    } catch (err) {
      wx.showToast({ title: err.message || '搜索失败', icon: 'none' })
    } finally { wx.hideLoading() }
  },

  selectUser(e) {
    const { id, phone, name } = e.currentTarget.dataset
    this.setData({ selectedUserId: id, selectedUserPhone: phone, selectedUserName: name || '微信用户', searchResults: [], searchKeyword: '' })
  },

  async addAdmin() {
    const { selectedUserId, selectedUserPhone, roles, roleIndex, adding } = this.data
    if (adding || !selectedUserPhone) return
    this.setData({ adding: true })
    try {
      wx.showLoading({ title: '添加中', mask: true })
      const result = await wx.cloud.callFunction({ name: 'adminManagers', data: { action: 'add', userId: selectedUserId, role: roles[roleIndex].value } })
      if (!result.result || !result.result.success) throw new Error('添加失败')
      this.setData({ selectedUserId: '', selectedUserPhone: '', selectedUserName: '' })
      wx.showToast({ title: '添加成功', icon: 'success' })
      this.loadManagers()
    } catch (err) {
      wx.showToast({ title: err.message || '添加失败', icon: 'none' })
    } finally { this.setData({ adding: false }); wx.hideLoading() }
  },

  async toggleAdmin(e) {
    try {
      const result = await wx.cloud.callFunction({ name: 'adminManagers', data: { action: 'toggle', id: e.currentTarget.dataset.id, status: e.currentTarget.dataset.status } })
      if (!result.result || !result.result.success) throw new Error('操作失败')
      this.loadManagers()
    } catch (err) { wx.showToast({ title: err.message || '操作失败', icon: 'none' }) }
  },

  deleteAdmin(e) {
    const { id, name } = e.currentTarget.dataset
    wx.showModal({ title: '确认删除', content: `确定要删除管理员“${name}”吗？`, success: async res => {
      if (!res.confirm) return
      try {
        const result = await wx.cloud.callFunction({ name: 'adminManagers', data: { action: 'delete', id } })
        if (!result.result || !result.result.success) throw new Error('删除失败')
        this.loadManagers()
      } catch (err) { wx.showToast({ title: err.message || '删除失败', icon: 'none' }) }
    }})
  }
})
