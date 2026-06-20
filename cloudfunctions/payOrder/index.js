const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

let payConfig = {}
try {
  payConfig = require('./pay-config.json')
} catch (e) {
  payConfig = {
    merchantId: '1107818038',
    envId: 'cloud1-3g1f8ehxdf89c874'
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { orderId } = event
  
  console.log('========== payOrder 云函数开始执行 ==========')
  console.log('接收参数:', { 
    orderId, 
    openid: wxContext.OPENID 
  })
  
  if (!orderId) {
    return {
      success: false,
      error: '缺少必要参数'
    }
  }
  
  try {
    const db = cloud.database()
    
    const orderRes = await db.collection('orders').doc(orderId).get()
    
    if (!orderRes.data) {
      return {
        success: false,
        error: '订单不存在'
      }
    }
    
    const order = orderRes.data
    
    if (order._openid !== wxContext.OPENID) {
      return {
        success: false,
        error: '无权操作此订单'
      }
    }

    if (!['pending', 'pending_payment'].includes(order.status)) {
      return {
        success: false,
        error: '当前订单状态不可支付'
      }
    }
    
    const verifiedOrder = await calculateVerifiedOrder(db, order)
    const orderAmount = verifiedOrder.total
    if (!Number.isFinite(orderAmount) || orderAmount <= 0) {
      return {
        success: false,
        error: '订单金额无效'
      }
    }

    const userRes = await db.collection('users')
      .where({ _openid: wxContext.OPENID })
      .limit(1)
      .get()

    await db.collection('orders').doc(orderId).update({
      data: {
        userId: userRes.data.length > 0 ? userRes.data[0]._id : '',
        goods: verifiedOrder.goods,
        priceDetail: verifiedOrder.priceDetail,
        verifiedAt: db.serverDate()
      }
    })

    const totalFee = Math.round(orderAmount * 100)
    const outTradeNo = 'ORDER_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase()
    
    console.log('商户订单号:', outTradeNo)
    console.log('支付金额:', totalFee, '分')
    
    let payRes
    try {
      payRes = await cloud.cloudPay.unifiedOrder({
        body: order.orderType === 'recharge' ? '泽明果业-会员充值' : '泽明果业-水果订单',
        outTradeNo: outTradeNo,
        spbillCreateIp: '127.0.0.1',
        subMchId: payConfig.merchantId,
        totalFee: totalFee,
        envId: payConfig.envId,
        functionName: 'payCallback',
        nonceStr: Math.random().toString(36).substr(2, 32),
        tradeType: 'JSAPI'
      })
    } catch (payErr) {
      console.error('unifiedOrder 调用失败:', payErr)
      return {
        success: false,
        error: payErr.message || '支付接口调用失败',
        details: {
          errCode: payErr.errCode,
          errMsg: payErr.errMsg
        }
      }
    }
    
    console.log('微信支付返回:', JSON.stringify(payRes, null, 2))
    
    if (payRes.returnCode === 'SUCCESS' && payRes.resultCode === 'SUCCESS') {
      await db.collection('orders').doc(orderId).update({
        data: {
          orderNo: outTradeNo,
          prepayId: payRes.prepayId,
          status: 'pending_payment',
          updatedAt: db.serverDate()
        }
      })
      
      const payment = payRes.payment
      
      if (!payment) {
        return {
          success: false,
          error: '支付参数获取失败'
        }
      }
      
      return {
        success: true,
        data: {
          timeStamp: payment.timeStamp,
          nonceStr: payment.nonceStr,
          package: payment.package,
          signType: payment.signType || 'MD5',
          paySign: payment.paySign,
          orderNo: outTradeNo
        }
      }
    } else {
      const errorMsg = payRes.errMsgDes || payRes.returnMsg || '统一下单失败'
      console.error('统一下单失败:', payRes)
      
      return {
        success: false,
        error: errorMsg,
        details: {
          returnCode: payRes.returnCode,
          resultCode: payRes.resultCode,
          returnMsg: payRes.returnMsg,
          errMsgDes: payRes.errMsgDes,
          errCode: payRes.errCode
        }
      }
    }
  } catch (err) {
    console.error('云函数异常:', err)
    return {
      success: false,
      error: err.message || '创建支付失败'
    }
  }
}

async function calculateVerifiedOrder(db, order) {
  if (order.orderType === 'recharge') {
    const amount = Number(order.recharge && order.recharge.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('充值金额无效')
    }

    return {
      total: amount,
      goods: [],
      priceDetail: {
        goodsTotal: amount,
        couponDiscount: 0,
        deliveryFee: 0,
        total: amount
      }
    }
  }

  if (!Array.isArray(order.goods) || order.goods.length === 0) {
    throw new Error('订单商品为空')
  }

  const goods = []
  let goodsTotal = 0

  for (const item of order.goods) {
    const productRes = await db.collection('products').doc(String(item.id)).get()
    const product = productRes.data
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1))

    if (!product || product.status === 'inactive' || product.status === 'soldout') {
      throw new Error(`商品“${item.name || item.id}”已下架`)
    }
    if (typeof product.stock === 'number' && product.stock < quantity) {
      throw new Error(`商品“${product.name}”库存不足`)
    }

    goods.push({
      id: product._id,
      name: product.name,
      price: Number(product.price),
      quantity,
      emoji: product.emoji || '🍎'
    })
    goodsTotal += Number(product.price) * quantity
  }

  let couponDiscount = 0
  const couponId = order.coupon && order.coupon.id
  if (couponId) {
    const couponRes = await db.collection('coupons').doc(couponId).get()
    const coupon = couponRes.data
    const today = new Date().toISOString().split('T')[0]
    const valid = coupon &&
      coupon.status === 'active' &&
      (!coupon.validFrom || coupon.validFrom <= today) &&
      (!coupon.validTo || coupon.validTo >= today) &&
      (!coupon.stock || (coupon.usedCount || 0) < coupon.stock) &&
      goodsTotal >= (Number(coupon.threshold) || 0)
    const goodsIds = goods.map(item => item.id)
    const scopeMatches = coupon &&
      (coupon.scope !== 'specific_goods' ||
        !Array.isArray(coupon.goodsIds) ||
        coupon.goodsIds.some(id => goodsIds.includes(id)))

    if (valid && scopeMatches) {
      couponDiscount = coupon.discountType === 'percent'
        ? goodsTotal * (1 - (Number(coupon.discount) || 10) / 10)
        : Number(coupon.value) || 0
    }
  }

  let deliveryFee = 0
  if (order.deliveryType === 'delivery') {
    let freeDeliveryThreshold = 39
    try {
      const settingsRes = await db.collection('settings').doc('homepage').get()
      freeDeliveryThreshold = Number(settingsRes.data.freeDeliveryThreshold) || 39
    } catch (err) {
      console.warn('读取免配送门槛失败，使用默认值', err.message)
    }
    deliveryFee = goodsTotal >= freeDeliveryThreshold ? 0 : 5
  }

  const total = Math.max(1, goodsTotal - couponDiscount + deliveryFee)
  const priceDetail = {
    goodsTotal: Number(goodsTotal.toFixed(2)),
    couponDiscount: Number(couponDiscount.toFixed(2)),
    deliveryFee: Number(deliveryFee.toFixed(2)),
    activityDiscount: 0,
    totalDiscount: Number(couponDiscount.toFixed(2)),
    total: Number(total.toFixed(2))
  }

  return {
    total: priceDetail.total,
    goods,
    priceDetail
  }
}
