const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  const admins = await db.collection('admins').get().catch(() => ({ data: [] }))
  const isOwner = admins.data.some(item => Array.isArray(item.adminOpenids) && item.adminOpenids.includes(OPENID))
  if (isOwner) return { success: true, isAdmin: true, role: 'owner' }

  const result = await db.collection('managers').where({ openid: OPENID, status: 'active' }).limit(1).get().catch(() => ({ data: [] }))
  const manager = result.data[0]
  return manager
    ? { success: true, isAdmin: true, role: manager.role || 'staff' }
    : { success: true, isAdmin: false, role: 'normal' }
}
