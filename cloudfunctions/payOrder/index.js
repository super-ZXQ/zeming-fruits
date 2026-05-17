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
  const { orderId, totalAmount } = event
  
  console.log('========== payOrder 云函数开始执行 ==========')
  console.log('接收参数:', { 
    orderId, 
    totalAmount,
    totalAmountInCents: Math.round(totalAmount * 100),
    openid: wxContext.OPENID 
  })
  
  if (!orderId || !totalAmount) {
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
    
    const totalFee = Math.round(totalAmount * 100)
    const outTradeNo = 'ORDER_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase()
    
    console.log('商户订单号:', outTradeNo)
    console.log('支付金额:', totalFee, '分')
    
    let payRes
    try {
      payRes = await cloud.cloudPay.unifiedOrder({
        body: '泽明果业-水果订单',
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
