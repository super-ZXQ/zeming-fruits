const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  const { outTradeNo, transactionId } = event
  
  console.log('========== payCallback 支付回调 ==========')
  console.log('商户订单号:', outTradeNo)
  console.log('微信支付订单号:', transactionId)
  
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
    
    if (order.status === 'paid') {
      return {
        returnCode: 'SUCCESS',
        returnMsg: 'OK'
      }
    }

    const userRes = order.userId
      ? await db.collection('users').doc(order.userId).get().then(res => ({ data: [res.data] })).catch(() => ({ data: [] }))
      : await db.collection('users').where({ _openid: order._openid }).get()

    if (order.orderType === 'recharge' && (!userRes.data || userRes.data.length === 0)) {
      throw new Error('充值用户不存在')
    }
    
    if (userRes.data && userRes.data.length > 0) {
      const user = userRes.data[0]

      if (order.orderType === 'recharge') {
        const recharge = order.recharge || {}
        const amount = Number(recharge.amount) || 0
        const packageBonus = {
          50: 0,
          100: 10,
          200: 30,
          500: 100
        }
        const giveAmount = packageBonus[amount] || 0
        const creditAmount = amount + giveAmount

        await db.collection('users').doc(user._id).update({
          data: {
            memberBalance: db.command.inc(creditAmount),
            updatedAt: db.serverDate()
          }
        })

        await db.collection('recharge_records').add({
          data: {
            userId: user._id,
            amount,
            giveAmount,
            totalAmount: creditAmount,
            orderId: order._id,
            transactionId,
            status: 'success',
            createTime: db.serverDate()
          }
        })

        await markOrderPaid(db, order._id, transactionId)

        return {
          returnCode: 'SUCCESS',
          returnMsg: 'OK'
        }
      }

      console.log('更新用户订单统计')
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

    if (order.coupon && order.coupon.id) {
      await db.collection('coupons').doc(order.coupon.id).update({
        data: {
          usedCount: db.command.inc(1)
        }
      }).catch(() => null)
    }

    await markOrderPaid(db, order._id, transactionId)
    
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

async function markOrderPaid(db, orderId, transactionId) {
  await db.collection('orders').doc(orderId).update({
    data: {
      status: 'paid',
      paidAt: db.serverDate(),
      transactionId,
      updatedAt: db.serverDate()
    }
  })
}
