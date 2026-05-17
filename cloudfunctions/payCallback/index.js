const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { outTradeNo, transactionId } = event
  
  console.log('========== payCallback 支付回调 ==========')
  console.log('商户订单号:', outTradeNo)
  console.log('微信支付订单号:', transactionId)
  console.log('openid:', wxContext.OPENID)
  
  try {
    const db = cloud.database()
    
    console.log('查询订单:', outTradeNo)
    const orderRes = await db.collection('orders').where({
      orderNo: outTradeNo
    }).get()
    
    if (!orderRes.data || orderRes.data.length === 0) {
      console.error('订单不存在:', outTradeNo)
      return {
        returnCode: 'FAIL',
        returnMsg: '订单不存在'
      }
    }
    
    const order = orderRes.data[0]
    console.log('订单信息:', {
      orderId: order._id,
      status: order.status,
      amount: order.priceDetail?.total
    })
    
    console.log('更新订单状态为已支付')
    await db.collection('orders').doc(order._id).update({
      data: {
        status: 'paid',
        paidAt: db.serverDate(),
        transactionId: transactionId,
        updatedAt: db.serverDate()
      }
    })
    
    console.log('更新用户订单统计')
    const userRes = await db.collection('users').where({
      _openid: wxContext.OPENID
    }).get()
    
    if (userRes.data && userRes.data.length > 0) {
      const user = userRes.data[0]
      const updateData = {
        totalSpent: db.command.inc(order.priceDetail?.total || 0),
        orderCount: db.command.inc(1),
        lastOrderAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
      
      if (!user.firstOrderAt) {
        updateData.firstOrderAt = db.serverDate()
      }
      
      await db.collection('users').doc(user._id).update({
        data: updateData
      })
    }
    
    console.log('========== 支付回调处理完成 ==========')
    
    return {
      returnCode: 'SUCCESS',
      returnMsg: 'OK'
    }
  } catch (err) {
    console.error('========== 支付回调处理失败 ==========')
    console.error('错误:', err)
    console.error('错误消息:', err.message)
    
    return {
      returnCode: 'FAIL',
      returnMsg: err.message
    }
  }
}
