const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function getOwner(openid) {
  const admins = await db.collection('admins').get().catch(() => ({ data: [] }))
  return admins.data.some(item => Array.isArray(item.adminOpenids) && item.adminOpenids.includes(openid))
}

async function getAdminIdentity(openid, user) {
  if (await getOwner(openid)) return { isAdmin: true, role: 'owner' }
  let result = await db.collection('managers').where({ openid, status: 'active' }).limit(1).get().catch(() => ({ data: [] }))
  let manager = result.data[0]

  if (!manager && user && user.phoneVerifiedAt && user.phone) {
    result = await db.collection('managers').where({ phone: user.phone, status: 'active' }).limit(1).get().catch(() => ({ data: [] }))
    manager = result.data[0]
    if (manager) {
      await db.collection('managers').doc(manager._id).update({ data: { openid, userId: user._id, updatedAt: db.serverDate() } })
    }
  }
  return manager ? { isAdmin: true, role: manager.role || 'staff' } : { isAdmin: false, role: 'normal' }
}

function publicUser(user, openid) {
  if (!user || !user.phoneVerifiedAt) return null
  return {
    id: user._id,
    openid,
    phone: user.phone || '',
    nickname: user.nickname || user.nickName || '微信用户',
    avatarUrl: user.avatarUrl || ''
  }
}

async function findUser(openid) {
  const result = await db.collection('users').where({ _openid: openid }).limit(1).get()
  return result.data[0] || null
}

exports.main = async event => {
  const { OPENID } = cloud.getWXContext()
  const action = event.action || 'session'

  try {
    if (action === 'session') {
      const user = await findUser(OPENID)
      const identity = await getAdminIdentity(OPENID, user)
      return { success: true, user: publicUser(user, OPENID), ...identity }
    }

    if (action !== 'bindPhone' || !event.code) {
      return { success: false, code: 'INVALID_REQUEST', error: '登录请求无效' }
    }

    const phoneResult = await cloud.openapi.phonenumber.getPhoneNumber({ code: event.code })
    if (phoneResult.errCode !== 0 || !phoneResult.phoneInfo || !phoneResult.phoneInfo.phoneNumber) {
      return { success: false, code: 'PHONE_AUTH_FAILED', error: phoneResult.errMsg || '手机号授权失败' }
    }

    const phone = phoneResult.phoneInfo.phoneNumber
    let user = await findUser(OPENID)
    if (user) {
      await db.collection('users').doc(user._id).update({
        data: { phone, phoneVerifiedAt: db.serverDate(), lastLoginTime: db.serverDate(), loginCount: db.command.inc(1), updatedAt: db.serverDate() }
      })
      user = { ...user, phone, phoneVerifiedAt: new Date() }
    } else {
      const result = await db.collection('users').add({
        data: { _openid: OPENID, phone, nickname: '微信用户', avatarUrl: '', phoneVerifiedAt: db.serverDate(), createTime: db.serverDate(), lastLoginTime: db.serverDate(), loginCount: 1 }
      })
      user = { _id: result._id, phone, nickname: '微信用户', avatarUrl: '', phoneVerifiedAt: new Date() }
    }

    const identity = await getAdminIdentity(OPENID, user)
    return { success: true, user: publicUser(user, OPENID), ...identity }
  } catch (err) {
    console.error('userLogin failed:', err.errCode || err.message)
    return { success: false, code: 'LOGIN_FAILED', error: '登录失败，请稍后重试' }
  }
}
