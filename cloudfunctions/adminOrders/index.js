const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function getAdminIdentity(openid) {
  const admins = await db.collection('admins').get()
  if (admins.data.some(item => Array.isArray(item.adminOpenids) && item.adminOpenids.includes(openid))) return { isAdmin: true, role: 'owner' }
  const users = await db.collection('users').where({ _openid: openid }).limit(1).get()
  const phone = users.data[0] && users.data[0].phone
  if (!phone) return { isAdmin: false, role: 'normal' }
  const managers = await db.collection('managers').where({ phone }).limit(1).get().catch(() => ({ data: [] }))
  const manager = managers.data[0]
  return manager && manager.status === 'active' ? { isAdmin: true, role: manager.role || 'staff' } : { isAdmin: false, role: 'normal' }
}

async function requireAdmin() {
  const { OPENID } = cloud.getWXContext()
  const identity = await getAdminIdentity(OPENID)
  if (!identity.isAdmin) throw new Error('无管理员权限')
}

async function listOrders() {
  const result = await db.collection('orders').orderBy('createTime', 'desc').limit(100).get()
  return Promise.all(result.data.map(async order => {
    const user = order._openid ? await db.collection('users').where({ _openid: order._openid }).limit(1).get().catch(() => ({ data: [] })) : { data: [] }
    const userInfo = user.data[0]
    return {
      ...order,
      userInfo: userInfo ? { nickname: userInfo.nickname || '微信用户', phone: userInfo.phone || '' } : null
    }
  }))
}

exports.main = async event => {
  await requireAdmin()
  const action = event.action
  if (action === 'dashboard') {
    const orders = await listOrders()
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const todayOrders = orders.filter(order => new Date(order.createTime) >= start && order.status !== 'cancelled')
    const products = await db.collection('products').orderBy('sales', 'desc').limit(5).get()
    const users = await db.collection('users').where({ createTime: db.command.gte(start) }).count()
    return {
      success: true,
      orders,
      hotGoods: products.data.map(item => ({ _id: item._id, name: item.name, totalSales: item.sales || 0, totalRevenue: Number((item.price * (item.sales || 0)).toFixed(2)) })),
      stats: {
        todaySales: todayOrders.reduce((sum, order) => sum + Number(order.priceDetail && order.priceDetail.total || 0), 0).toFixed(2),
        todayOrders: todayOrders.length,
        newUsers: users.total,
        couponUsed: 0
      }
    }
  }
  if (action === 'advance') {
    const transitions = { pending: 'confirmed', confirmed: 'preparing', preparing: 'delivering', delivering: 'completed' }
    const order = await db.collection('orders').doc(String(event.id)).get()
    const nextStatus = transitions[order.data.status]
    if (!nextStatus) throw new Error('当前订单无法继续流转')
    const updates = { status: nextStatus, updatedAt: db.serverDate() }
    if (nextStatus === 'confirmed') updates.confirmedAt = db.serverDate()
    if (nextStatus === 'delivering') updates.deliveringAt = db.serverDate()
    if (nextStatus === 'completed') updates.completedAt = db.serverDate()
    await db.collection('orders').doc(String(event.id)).update({ data: updates })
    return { success: true, nextStatus }
  }
  throw new Error('不支持的订单操作')
}
