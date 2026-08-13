const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async event => {
  const { OPENID } = cloud.getWXContext()
  const id = String(event.id || '')
  if (!id) throw new Error('订单不存在')
  const order = await db.collection('orders').doc(id).get()
  if (!order.data || order.data._openid !== OPENID) throw new Error('无权操作此订单')

  if (event.action === 'confirmReceive') {
    if (order.data.status !== 'delivering') throw new Error('当前订单不能确认收货')
    await db.collection('orders').doc(id).update({ data: { status: 'completed', completedAt: db.serverDate(), updatedAt: db.serverDate() } })
    return { success: true }
  }

  if (event.action === 'applyRefund') {
    if (order.data.status !== 'completed') throw new Error('仅已完成订单可申请售后')
    await db.collection('orders').doc(id).update({ data: { status: 'refund', refundAt: db.serverDate(), updatedAt: db.serverDate() } })
    return { success: true }
  }

  throw new Error('不支持的订单操作')
}
