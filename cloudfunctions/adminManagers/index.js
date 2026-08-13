const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function getIdentity(openid) {
  const admins = await db.collection('admins').get()
  if (admins.data.some(item => Array.isArray(item.adminOpenids) && item.adminOpenids.includes(openid))) return { isAdmin: true, role: 'owner' }
  const users = await db.collection('users').where({ _openid: openid }).limit(1).get()
  const phone = users.data[0] && users.data[0].phone
  const managers = phone ? await db.collection('managers').where({ phone }).limit(1).get().catch(() => ({ data: [] })) : { data: [] }
  const manager = managers.data[0]
  return manager && manager.status === 'active' ? { isAdmin: true, role: manager.role || 'staff' } : { isAdmin: false, role: 'normal' }
}

async function requireOwner() {
  const { OPENID } = cloud.getWXContext()
  const identity = await getIdentity(OPENID)
  if (!identity.isAdmin || !['owner', 'super_admin'].includes(identity.role)) throw new Error('仅店主可管理管理员账号')
}

exports.main = async event => {
  await requireOwner()
  const action = event.action
  if (action === 'list') return { success: true, managers: (await db.collection('managers').orderBy('createTime', 'desc').get()).data }
  if (action === 'search') {
    const keyword = String(event.keyword || '').trim()
    if (!keyword) throw new Error('请输入手机号')
    const users = await db.collection('users').where({ phone: db.RegExp({ regexp: keyword, options: 'i' }) }).limit(10).get()
    return { success: true, users: users.data.map(user => ({ _id: user._id, phone: user.phone, nickname: user.nickname || '微信用户' })) }
  }
  if (action === 'add') {
    const phone = String(event.phone || '').trim()
    const role = ['staff', 'super_admin'].includes(event.role) ? event.role : 'staff'
    if (!/^1[3-9]\d{9}$/.test(phone)) throw new Error('管理员手机号不正确')
    const user = await db.collection('users').where({ phone }).limit(1).get()
    if (!user.data[0]) throw new Error('该手机号尚未登录过小程序')
    const exists = await db.collection('managers').where({ phone }).limit(1).get()
    if (exists.data[0]) throw new Error('该用户已经是管理员')
    const result = await db.collection('managers').add({ data: { phone, nickname: user.data[0].nickname || '微信用户', role, status: 'active', createTime: db.serverDate() } })
    return { success: true, id: result._id }
  }
  if (action === 'toggle') {
    const manager = await db.collection('managers').doc(String(event.id)).get()
    if (manager.data.role === 'super_admin') throw new Error('不能禁用超级管理员')
    await db.collection('managers').doc(String(event.id)).update({ data: { status: manager.data.status === 'active' ? 'disabled' : 'active' } })
    return { success: true }
  }
  if (action === 'delete') {
    const manager = await db.collection('managers').doc(String(event.id)).get()
    if (manager.data.role === 'super_admin') throw new Error('不能删除超级管理员')
    await db.collection('managers').doc(String(event.id)).remove()
    return { success: true }
  }
  throw new Error('不支持的管理员操作')
}
