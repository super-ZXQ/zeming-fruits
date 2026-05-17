const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { goods, couponId, deliveryType, deliveryFee, openid } = event
  
  try {
    let subtotal = 0
    let goodsTotal = 0
    
    for (const item of goods) {
      goodsTotal += item.price * item.quantity
    }
    
    subtotal = goodsTotal
    
    let couponDiscount = 0
    let couponInfo = null
    
    if (couponId) {
      const couponRes = await db.collection('coupons').doc(couponId).get()
      
      if (couponRes.data && couponRes.data.status === 'active') {
        const coupon = couponRes.data
        const now = new Date()
        const validFrom = new Date(coupon.validFrom)
        const validTo = new Date(coupon.validTo)
        
        if (now >= validFrom && now <= validTo) {
          if (goodsTotal >= coupon.threshold) {
            if (coupon.discountType === 'cash') {
              couponDiscount = coupon.value
            } else if (coupon.discountType === 'percent') {
              couponDiscount = goodsTotal * (1 - coupon.discount / 10)
            }
            
            couponInfo = {
              id: coupon._id,
              name: coupon.name,
              type: coupon.type,
              discountType: coupon.discountType,
              discount: couponDiscount
            }
          }
        }
      }
    }
    
    subtotal = goodsTotal - couponDiscount
    if (subtotal < 0) subtotal = 0
    
    let finalDeliveryFee = 0
    if (deliveryType === 'delivery') {
      finalDeliveryFee = deliveryFee || 0
    }
    
    const total = subtotal + finalDeliveryFee
    
    const availableCoupons = await getAvailableCoupons(goodsTotal, goods)
    
    return {
      success: true,
      data: {
        goodsTotal: parseFloat(goodsTotal.toFixed(2)),
        couponDiscount: parseFloat(couponDiscount.toFixed(2)),
        couponInfo,
        subtotal: parseFloat(subtotal.toFixed(2)),
        deliveryFee: parseFloat(finalDeliveryFee.toFixed(2)),
        total: parseFloat(total.toFixed(2)),
        availableCoupons
      }
    }
  } catch (err) {
    console.error('计算订单失败:', err)
    return {
      success: false,
      error: err.message
    }
  }
}

async function getAvailableCoupons(goodsTotal, goods) {
  try {
    const now = new Date().toISOString().split('T')[0]
    
    const res = await db.collection('coupons')
      .where({
        status: 'active',
        validFrom: _.lte(now),
        validTo: _.gte(now),
        threshold: _.lte(goodsTotal)
      })
      .get()
    
    const coupons = res.data.filter(coupon => {
      if (coupon.usedCount >= coupon.stock) {
        return false
      }
      
      if (coupon.scope === 'specific_goods' && coupon.goodsIds) {
        const goodsIds = goods.map(g => g.id)
        const hasMatch = coupon.goodsIds.some(id => goodsIds.includes(id))
        return hasMatch
      }
      
      return true
    })
    
    return coupons.map(coupon => {
      let discount = 0
      if (coupon.discountType === 'cash') {
        discount = coupon.value
      } else if (coupon.discountType === 'percent') {
        discount = goodsTotal * (1 - coupon.discount / 10)
      }
      
      return {
        id: coupon._id,
        name: coupon.name,
        type: coupon.type,
        discountType: coupon.discountType,
        value: coupon.value,
        discount: coupon.discount,
        threshold: coupon.threshold,
        calculatedDiscount: parseFloat(discount.toFixed(2))
      }
    })
  } catch (err) {
    console.error('获取可用优惠券失败:', err)
    return []
  }
}