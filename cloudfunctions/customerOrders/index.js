const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function ownOrder(openid, id) {
  const result = await db.collection('orders').doc(String(id || '')).get()
  if (!result.data || result.data._openid !== openid) throw new Error('订单不存在')
  return result.data
}

exports.main = async event => {
  const { OPENID } = cloud.getWXContext()
  if (event.action === 'list') {
    const result = await db.collection('orders').where({ _openid: OPENID }).orderBy('createTime', 'desc').limit(100).get()
    return { success: true, orders: result.data }
  }

  const order = await ownOrder(OPENID, event.id)

  if (event.action === 'get') {
    return { success: true, order }
  }

  if (event.action === 'cancel') {
    if (order.status !== 'pending') throw new Error('商家确认后不能自行取消，请联系商家')
    await db.collection('orders').doc(order._id).update({ data: { status: 'cancelled', cancelledAt: db.serverDate(), cancelReason: '顾客取消', updatedAt: db.serverDate() } })
    return { success: true }
  }

  if (event.action === 'confirmReceive') {
    if (!['delivering', 'ready'].includes(order.status)) throw new Error('当前订单不能确认完成')
    await db.collection('orders').doc(order._id).update({ data: { status: 'completed', completedAt: db.serverDate(), updatedAt: db.serverDate() } })
    return { success: true }
  }

  if (event.action === 'applyAfterSale') {
    if (order.status !== 'completed') throw new Error('仅已完成订单可申请售后')
    await db.collection('orders').doc(order._id).update({ data: { status: 'after_sale', afterSaleAt: db.serverDate(), updatedAt: db.serverDate() } })
    return { success: true }
  }

  throw new Error('不支持的订单操作')
}
