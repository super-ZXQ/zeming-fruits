const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

async function requireAdmin() {
  const { OPENID } = cloud.getWXContext()
  const admins = await db.collection('admins').get().catch(() => ({ data: [] }))
  if (admins.data.some(item => Array.isArray(item.adminOpenids) && item.adminOpenids.includes(OPENID))) return
  const managers = await db.collection('managers').where({ openid: OPENID, status: 'active' }).limit(1).get().catch(() => ({ data: [] }))
  if (!managers.data[0]) throw new Error('无管理员权限')
}

function statusQuery(status) {
  if (!status || status === 'all') return {}
  if (status === 'active') return { status: _.in(['confirmed', 'preparing', 'ready', 'delivering']) }
  if (status === 'after_sale') return { status: _.in(['after_sale', 'refund']) }
  return { status }
}

function normalizeOrder(order) {
  return {
    ...order,
    userInfo: order.contact ? { nickname: order.contact.name || '顾客', phone: order.contact.phone || '' } : null
  }
}

async function listOrders(status, page = 0) {
  const limit = 20
  const filter = statusQuery(status)
  const collection = db.collection('orders')
  const query = Object.keys(filter).length ? collection.where(filter) : collection
  const result = await query.orderBy('createTime', 'desc').skip(Math.max(0, page) * limit).limit(limit + 1).get()
  return { orders: result.data.slice(0, limit).map(normalizeOrder), hasMore: result.data.length > limit }
}

function chinaDayStart() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return new Date(`${values.year}-${values.month}-${values.day}T00:00:00+08:00`)
}

exports.main = async event => {
  await requireAdmin()

  if (event.action === 'dashboard') {
    const page = Math.max(0, Number(event.page) || 0)
    const list = await listOrders(event.status, page)
    const start = chinaDayStart()
    const today = await db.collection('orders').where({ createTime: _.gte(start), status: _.neq('cancelled') }).limit(100).get()
    const products = await db.collection('products').orderBy('sales', 'desc').limit(5).get()
    const users = await db.collection('users').where({ createTime: _.gte(start) }).count()
    const pending = await db.collection('orders').where({ status: 'pending' }).count()
    return {
      success: true,
      ...list,
      hotGoods: products.data.map(item => ({ _id: item._id, name: item.name, totalSales: item.sales || 0, totalRevenue: Number((Number(item.price || 0) * Number(item.sales || 0)).toFixed(2)) })),
      stats: {
        todaySales: today.data.reduce((sum, order) => sum + Number(order.priceDetail && order.priceDetail.total || 0), 0).toFixed(2),
        todayOrders: today.data.length,
        newUsers: users.total,
        pendingOrders: pending.total
      }
    }
  }

  const order = (await db.collection('orders').doc(String(event.id || '')).get()).data
  if (!order) throw new Error('订单不存在')

  if (event.action === 'advance') {
    const transitions = { pending: 'confirmed', confirmed: 'preparing', ready: 'completed', delivering: 'completed' }
    let nextStatus = transitions[order.status]
    if (order.status === 'preparing') nextStatus = order.deliveryType === 'pickup' ? 'ready' : 'delivering'
    if (!nextStatus) throw new Error('当前订单无法继续流转')
    const updates = { status: nextStatus, updatedAt: db.serverDate() }
    const timestampFields = { confirmed: 'confirmedAt', preparing: 'preparingAt', ready: 'readyAt', delivering: 'deliveringAt', completed: 'completedAt' }
    updates[timestampFields[nextStatus]] = db.serverDate()
    await db.collection('orders').doc(order._id).update({ data: updates })
    return { success: true, nextStatus }
  }

  if (event.action === 'cancel') {
    if (!['pending', 'confirmed', 'preparing', 'ready', 'delivering'].includes(order.status)) throw new Error('当前订单不能取消')
    const reason = String(event.reason || '').trim().slice(0, 100)
    if (!reason) throw new Error('请填写取消原因')
    await db.collection('orders').doc(order._id).update({ data: { status: 'cancelled', cancelReason: reason, cancelledAt: db.serverDate(), updatedAt: db.serverDate() } })
    return { success: true }
  }

  if (event.action === 'resolveAfterSale') {
    if (!['after_sale', 'refund'].includes(order.status)) throw new Error('当前订单没有待处理售后')
    await db.collection('orders').doc(order._id).update({ data: { status: 'completed', afterSaleResolvedAt: db.serverDate(), updatedAt: db.serverDate() } })
    return { success: true }
  }

  throw new Error('不支持的订单操作')
}
