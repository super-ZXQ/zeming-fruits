const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

async function getAdminIdentity(openid) {
  const admins = await db.collection('admins').get()
  const configuredAdmin = admins.data.some(item =>
    Array.isArray(item.adminOpenids) && item.adminOpenids.includes(openid)
  )

  if (configuredAdmin) {
    return { isAdmin: true, role: 'owner' }
  }

  const users = await db.collection('users').where({ _openid: openid }).limit(1).get()
  const phone = users.data[0] && users.data[0].phone
  if (!phone) return { isAdmin: false, role: 'normal' }

  try {
    const managers = await db.collection('managers').where({ phone }).limit(1).get()
    const manager = managers.data[0]
    if (manager && manager.status === 'active') {
      return { isAdmin: true, role: manager.role || 'staff' }
    }
  } catch (err) {
    console.warn('管理员手机号表不可用:', err.message)
  }

  return { isAdmin: false, role: 'normal' }
}

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  const identity = await getAdminIdentity(OPENID)
  return { success: true, ...identity }
}

exports.getAdminIdentity = getAdminIdentity
