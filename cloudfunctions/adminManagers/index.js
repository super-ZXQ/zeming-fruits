const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function getIdentity(openid) {
  const admins = await db.collection('admins').get().catch(() => ({ data: [] }))
  if (admins.data.some(item => Array.isArray(item.adminOpenids) && item.adminOpenids.includes(openid))) return { isAdmin: true, role: 'owner' }
  const result = await db.collection('managers').where({ openid, status: 'active' }).limit(1).get().catch(() => ({ data: [] }))
  const manager = result.data[0]
  return manager ? { isAdmin: true, role: manager.role || 'staff' } : { isAdmin: false, role: 'normal' }
}

async function requireOwner() {
  const { OPENID } = cloud.getWXContext()
  const identity = await getIdentity(OPENID)
  if (!identity.isAdmin || !['owner', 'super_admin'].includes(identity.role)) throw new Error('仅店主可管理管理员账号')
}

exports.main = async event => {
  await requireOwner()
  const action = event.action

  if (action === 'list') {
    const result = await db.collection('managers').orderBy('createTime', 'desc').limit(100).get()
    return { success: true, managers: result.data }
  }

  if (action === 'search') {
    const keyword = String(event.keyword || '').replace(/\D/g, '').slice(0, 11)
    if (keyword.length < 4) throw new Error('请输入至少 4 位手机号')
    const result = await db.collection('users').where({ phone: db.RegExp({ regexp: `^${keyword}` }) }).limit(10).get()
    const users = result.data.filter(user => user.phoneVerifiedAt).map(user => ({
      _id: user._id,
      openid: user._openid,
      phone: user.phone,
      nickname: user.nickname || '微信用户'
    }))
    return { success: true, users }
  }

  if (action === 'add') {
    const userId = String(event.userId || '')
    const role = ['staff', 'super_admin'].includes(event.role) ? event.role : 'staff'
    const userResult = await db.collection('users').doc(userId).get()
    const user = userResult.data
    if (!user || !user.phoneVerifiedAt || !user._openid) throw new Error('该用户尚未完成手机号授权')
    const exists = await db.collection('managers').where({ openid: user._openid }).limit(1).get()
    if (exists.data[0]) throw new Error('该用户已经是管理员')
    const result = await db.collection('managers').add({
      data: {
        userId: user._id,
        openid: user._openid,
        phone: user.phone,
        nickname: user.nickname || '微信用户',
        role,
        status: 'active',
        createTime: db.serverDate(),
        updatedAt: db.serverDate()
      }
    })
    return { success: true, id: result._id }
  }

  if (action === 'toggle' || action === 'delete') {
    const manager = (await db.collection('managers').doc(String(event.id)).get()).data
    if (!manager) throw new Error('管理员不存在')
    if (manager.role === 'super_admin') throw new Error(action === 'toggle' ? '不能禁用超级管理员' : '不能删除超级管理员')
    if (action === 'toggle') {
      await db.collection('managers').doc(manager._id).update({
        data: { status: manager.status === 'active' ? 'disabled' : 'active', updatedAt: db.serverDate() }
      })
    } else {
      await db.collection('managers').doc(manager._id).remove()
    }
    return { success: true }
  }

  throw new Error('不支持的管理员操作')
}
