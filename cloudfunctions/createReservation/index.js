const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const SHOP_LOCATION = { latitude: 33.588399, longitude: 119.073823 }
const DELIVERY_LIMIT_KM = 3
const DELIVERY_FEE = 5

exports.main = async event => {
  const { OPENID } = cloud.getWXContext()
  const { goods, deliveryType, address, deliveryTime, couponId, remark, outOfStockOption } = event

  try {
    if (!Array.isArray(goods) || goods.length === 0) {
      throw new Error('请选择至少一件商品')
    }
    if (!['pickup', 'delivery'].includes(deliveryType)) {
      throw new Error('配送方式无效')
    }

    const verifiedGoods = []
    let goodsTotal = 0
    for (const item of goods) {
      const productRes = await db.collection('products').doc(String(item.id)).get()
      const product = productRes.data
      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1))

      if (!product || product.status === 'inactive' || product.status === 'soldout') {
        throw new Error(`商品“${item.name || item.id}”已下架`)
      }
      if (typeof product.stock === 'number' && product.stock < quantity) {
        throw new Error(`商品“${product.name}”库存不足`)
      }

      const price = Number(product.price)
      verifiedGoods.push({
        id: product._id,
        name: product.name,
        price,
        quantity,
        emoji: product.emoji || '🍎'
      })
      goodsTotal += price * quantity
    }

    let deliveryFee = 0
    let savedAddress = null
    if (deliveryType === 'delivery') {
      if (!address || !address.location || !Number.isFinite(address.location.latitude) || !Number.isFinite(address.location.longitude)) {
        throw new Error('请选择可定位的收货地址')
      }
      const distance = calculateDistance(address.location, SHOP_LOCATION)
      if (distance > DELIVERY_LIMIT_KM) {
        throw new Error('该地址超出 3km 配送范围')
      }
      deliveryFee = DELIVERY_FEE
      savedAddress = {
        userName: address.userName,
        telNumber: address.telNumber,
        detailInfo: address.detailInfo,
        location: address.location,
        distance: Number(distance.toFixed(2))
      }
    }

    const coupon = await getCoupon(couponId, goodsTotal)
    const couponDiscount = coupon ? coupon.discount : 0
    const total = Math.max(0, goodsTotal - couponDiscount + deliveryFee)
    const userRes = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
    const orderNo = `ZM${Date.now().toString().slice(-10)}`

    const result = await db.collection('orders').add({
      data: {
        orderNo,
        _openid: OPENID,
        userId: userRes.data[0]?._id || '',
        goods: verifiedGoods,
        deliveryType,
        address: savedAddress,
        deliveryTime: deliveryTime || null,
        coupon: coupon ? { id: coupon.id, name: coupon.name, discount: coupon.discount } : null,
        remark: String(remark || '').slice(0, 200),
        outOfStockOption: outOfStockOption || 'call',
        priceDetail: {
          goodsTotal: Number(goodsTotal.toFixed(2)),
          couponDiscount: Number(couponDiscount.toFixed(2)),
          deliveryFee,
          total: Number(total.toFixed(2))
        },
        status: 'pending',
        createTime: db.serverDate(),
        updatedAt: db.serverDate()
      }
    })

    if (coupon) {
      await db.collection('coupons').doc(coupon.id).update({ data: { usedCount: db.command.inc(1) } })
    }

    return { success: true, data: { orderId: result._id, orderNo } }
  } catch (err) {
    console.error('创建预约单失败:', err)
    return { success: false, error: err.message || '预约提交失败' }
  }
}

async function getCoupon(couponId, goodsTotal) {
  if (!couponId) return null
  const res = await db.collection('coupons').doc(couponId).get().catch(() => null)
  const coupon = res && res.data
  const today = new Date().toISOString().slice(0, 10)
  const valid = coupon && coupon.status === 'active' &&
    (!coupon.validFrom || coupon.validFrom <= today) &&
    (!coupon.validTo || coupon.validTo >= today) &&
    (!coupon.stock || (coupon.usedCount || 0) < coupon.stock) &&
    goodsTotal >= (Number(coupon.threshold) || 0)
  if (!valid) return null

  const discount = coupon.discountType === 'percent'
    ? goodsTotal * (1 - (Number(coupon.discount) || 10) / 10)
    : Number(coupon.value) || 0
  return { id: coupon._id, name: coupon.name, discount: Math.min(discount, goodsTotal) }
}

function calculateDistance(from, to) {
  const radians = Math.PI / 180
  const lat1 = from.latitude * radians
  const lat2 = to.latitude * radians
  const deltaLat = lat2 - lat1
  const deltaLng = (to.longitude - from.longitude) * radians
  const value = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}
