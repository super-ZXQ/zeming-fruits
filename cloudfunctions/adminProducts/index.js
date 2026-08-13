const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const allowedStatuses = ['active', 'inactive', 'soldout']

async function getAdminIdentity(openid) {
  const admins = await db.collection('admins').get()
  if (admins.data.some(item => Array.isArray(item.adminOpenids) && item.adminOpenids.includes(openid))) {
    return { isAdmin: true, role: 'owner' }
  }

  const users = await db.collection('users').where({ _openid: openid }).limit(1).get()
  const phone = users.data[0] && users.data[0].phone
  if (!phone) return { isAdmin: false, role: 'normal' }

  try {
    const managers = await db.collection('managers').where({ phone }).limit(1).get()
    const manager = managers.data[0]
    if (manager && manager.status === 'active') return { isAdmin: true, role: manager.role || 'staff' }
  } catch (err) {
    console.warn('管理员手机号表不可用:', err.message)
  }

  return { isAdmin: false, role: 'normal' }
}

function ensureString(value, name, maxLength) {
  const text = String(value || '').trim()
  if (!text || text.length > maxLength) throw new Error(`${name}不合法`)
  return text
}

function toPrice(value, name, required) {
  if ((value === '' || value === null || value === undefined) && !required) return null
  const price = Number(value)
  if (!Number.isFinite(price) || price < 0 || price > 100000) throw new Error(`${name}不合法`)
  return Math.round(price * 100) / 100
}

function buildProduct(input, isNew) {
  const product = {
    name: ensureString(input.name, '商品名称', 60),
    price: toPrice(input.price, '商品价格', true),
    originalPrice: toPrice(input.originalPrice, '原价', false),
    unit: String(input.unit || '份').slice(0, 12),
    tag: String(input.tag || '').trim().slice(0, 20),
    imageUrl: String(input.imageUrl || '').trim(),
    category: String(input.category || 'premium').slice(0, 20),
    sales: Math.max(0, Math.floor(Number(input.sales) || 0)),
    status: allowedStatuses.includes(input.status) ? input.status : 'active',
    updateTime: db.serverDate()
  }
  if (product.originalPrice !== null && product.originalPrice < product.price) {
    throw new Error('原价不能低于现价')
  }
  if (isNew) product.createTime = db.serverDate()
  return product
}

async function requireAdmin() {
  const { OPENID } = cloud.getWXContext()
  const identity = await getAdminIdentity(OPENID)
  if (!identity.isAdmin) throw new Error('无管理员权限')
  return identity
}

exports.main = async event => {
  await requireAdmin()
  const action = event.action
  const products = db.collection('products')

  if (action === 'list') {
    const result = await products.orderBy('createTime', 'desc').limit(100).get()
    return { success: true, products: result.data }
  }

  if (action === 'save') {
    const input = event.product || {}
    const isNew = !input._id
    const product = buildProduct(input, isNew)
    if (isNew) {
      const result = await products.add({ data: product })
      return { success: true, id: result._id }
    }
    await products.doc(input._id).update({ data: product })
    return { success: true, id: input._id }
  }

  if (action === 'setStatus') {
    const id = ensureString(event.id, '商品ID', 80)
    const status = ensureString(event.status, '商品状态', 20)
    if (!allowedStatuses.includes(status)) throw new Error('不支持的商品状态')
    await products.doc(id).update({ data: { status, updateTime: db.serverDate() } })
    return { success: true }
  }

  throw new Error('不支持的管理操作')
}
