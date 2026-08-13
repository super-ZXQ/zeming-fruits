const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function requireUser(openid) {
  const result = await db.collection('users').where({ _openid: openid }).limit(1).get()
  const user = result.data[0]
  if (!user || !user.phoneVerifiedAt) throw new Error('请先完成手机号登录')
  return user
}

function text(value, max) {
  return String(value || '').trim().slice(0, max)
}

function validateAddress(input) {
  const address = {
    name: text(input.name, 80),
    address: text(input.address, 160),
    doorNumber: text(input.doorNumber, 80),
    contactName: text(input.contactName, 30),
    gender: input.gender === 'female' ? 'female' : 'male',
    phone: text(input.phone, 20),
    tags: Array.isArray(input.tags) ? input.tags.map(item => text(item, 10)).filter(Boolean).slice(0, 2) : [],
    latitude: Number(input.latitude),
    longitude: Number(input.longitude)
  }
  if (!address.name || !address.doorNumber || !address.contactName || !/^1[3-9]\d{9}$/.test(address.phone)) throw new Error('请填写完整有效的地址信息')
  if (!Number.isFinite(address.latitude) || !Number.isFinite(address.longitude)) throw new Error('请选择可定位的地址')
  return address
}

async function ownAddress(openid, id) {
  const result = await db.collection('addresses').doc(String(id)).get()
  if (!result.data || result.data._openid !== openid) throw new Error('地址不存在')
  return result.data
}

exports.main = async event => {
  const { OPENID } = cloud.getWXContext()
  await requireUser(OPENID)
  const addresses = db.collection('addresses')

  if (event.action === 'list') {
    const result = await addresses.where({ _openid: OPENID }).orderBy('createdAt', 'desc').limit(50).get()
    return { success: true, addresses: result.data }
  }

  if (event.action === 'get') {
    return { success: true, address: await ownAddress(OPENID, event.id) }
  }

  if (event.action === 'save') {
    const data = validateAddress(event.address || {})
    if (event.id) {
      await ownAddress(OPENID, event.id)
      await addresses.doc(String(event.id)).update({ data: { ...data, updatedAt: db.serverDate() } })
      return { success: true, id: String(event.id) }
    }
    const count = await addresses.where({ _openid: OPENID }).count()
    const result = await addresses.add({ data: { ...data, _openid: OPENID, isDefault: count.total === 0, createdAt: db.serverDate(), updatedAt: db.serverDate() } })
    return { success: true, id: result._id }
  }

  if (event.action === 'setDefault') {
    await ownAddress(OPENID, event.id)
    const list = await addresses.where({ _openid: OPENID }).limit(50).get()
    await Promise.all(list.data.map(item => addresses.doc(item._id).update({ data: { isDefault: item._id === event.id, updatedAt: db.serverDate() } })))
    return { success: true }
  }

  if (event.action === 'delete') {
    const target = await ownAddress(OPENID, event.id)
    await addresses.doc(target._id).remove()
    if (target.isDefault) {
      const remaining = await addresses.where({ _openid: OPENID }).orderBy('createdAt', 'desc').limit(1).get()
      if (remaining.data[0]) await addresses.doc(remaining.data[0]._id).update({ data: { isDefault: true, updatedAt: db.serverDate() } })
    }
    return { success: true }
  }

  throw new Error('不支持的地址操作')
}
