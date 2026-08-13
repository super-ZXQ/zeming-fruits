const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const SHOP_LOCATION = { latitude: 33.588399, longitude: 119.073823 }
const DELIVERY_LIMIT_KM = 3
const DELIVERY_FEE = 5
const TIME_SLOTS = ['9:00-11:00', '11:00-13:00', '13:00-15:00', '15:00-17:00', '17:00-19:00', '19:00-21:00']

function failure(code, error, extra = {}) {
  return { success: false, code, error, ...extra }
}

async function requireUser(openid) {
  const result = await db.collection('users').where({ _openid: openid }).limit(1).get()
  const user = result.data[0]
  if (!user || !user.phoneVerifiedAt || !user.phone) throw Object.assign(new Error('请先完成手机号登录'), { code: 'AUTH_REQUIRED' })
  return user
}

function chinaDate() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function normalizeDeliveryTime(value) {
  if (!value || value.type === 'asap') return { type: 'asap' }
  const date = String(value.date || '')
  const timeSlot = String(value.timeSlot || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < chinaDate() || !TIME_SLOTS.includes(timeSlot)) {
    throw Object.assign(new Error('预约时间无效'), { code: 'INVALID_TIME' })
  }
  return { type: 'schedule', date, timeSlot }
}

function distanceKm(from, to) {
  const radians = Math.PI / 180
  const lat1 = from.latitude * radians
  const lat2 = to.latitude * radians
  const deltaLat = lat2 - lat1
  const deltaLng = (to.longitude - from.longitude) * radians
  const value = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

async function buildQuote(event, user) {
  if (!Array.isArray(event.goods) || event.goods.length < 1 || event.goods.length > 30) {
    throw Object.assign(new Error('请选择 1 至 30 种商品'), { code: 'PRODUCT_UNAVAILABLE' })
  }
  if (!['pickup', 'delivery'].includes(event.deliveryType)) throw Object.assign(new Error('预约方式无效'), { code: 'INVALID_REQUEST' })

  const seen = new Set()
  const requests = event.goods.map(item => {
    const id = String(item.id || '')
    const quantity = Math.floor(Number(item.quantity))
    if (!id || seen.has(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw Object.assign(new Error('商品数量无效'), { code: 'PRODUCT_UNAVAILABLE' })
    }
    seen.add(id)
    return { id, quantity }
  })

  const products = await Promise.all(requests.map(item => db.collection('products').doc(item.id).get().catch(() => null)))
  let goodsTotal = 0
  const goods = requests.map((request, index) => {
    const product = products[index] && products[index].data
    if (!product || ['inactive', 'soldout'].includes(product.status)) {
      throw Object.assign(new Error('部分商品已下架，请返回预约单更新'), { code: 'PRODUCT_UNAVAILABLE' })
    }
    if (typeof product.stock === 'number' && product.stock < request.quantity) {
      throw Object.assign(new Error(`${product.name}库存不足`), { code: 'PRODUCT_UNAVAILABLE' })
    }
    const price = Number(product.price)
    if (!Number.isFinite(price) || price < 0) throw Object.assign(new Error('商品价格无效'), { code: 'PRODUCT_UNAVAILABLE' })
    goodsTotal += price * request.quantity
    return {
      id: product._id,
      name: product.name,
      price,
      quantity: request.quantity,
      unit: product.unit || '份',
      imageUrl: product.imageUrl || '',
      emoji: product.emoji || '🍎'
    }
  })

  let deliveryFee = 0
  let address = null
  let distance = 0
  let contact = { name: user.nickname || '微信用户', phone: user.phone }
  if (event.deliveryType === 'delivery') {
    const input = event.address || {}
    const latitude = Number(input.location && input.location.latitude)
    const longitude = Number(input.location && input.location.longitude)
    const phone = String(input.telNumber || '').trim()
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !/^1[3-9]\d{9}$/.test(phone) || !String(input.detailInfo || '').trim()) {
      throw Object.assign(new Error('请选择完整且可定位的收货地址'), { code: 'INVALID_ADDRESS' })
    }
    distance = distanceKm({ latitude, longitude }, SHOP_LOCATION)
    if (distance > DELIVERY_LIMIT_KM) throw Object.assign(new Error('该地址超出 3km 配送范围'), { code: 'OUT_OF_RANGE' })
    deliveryFee = DELIVERY_FEE
    contact = { name: String(input.userName || '顾客').slice(0, 30), phone }
    address = {
      userName: contact.name,
      telNumber: phone,
      detailInfo: String(input.detailInfo).slice(0, 240),
      location: { latitude, longitude },
      distance: Number(distance.toFixed(2))
    }
  }

  const deliveryTime = normalizeDeliveryTime(event.deliveryTime)
  const priceDetail = {
    goodsTotal: Number(goodsTotal.toFixed(2)),
    deliveryFee,
    total: Number((goodsTotal + deliveryFee).toFixed(2))
  }
  const versionData = {
    goods: goods.map(item => [item.id, item.price, item.quantity]),
    deliveryType: event.deliveryType,
    address: address ? [address.location.latitude, address.location.longitude] : null,
    deliveryTime,
    priceDetail
  }
  const quoteVersion = crypto.createHash('sha256').update(JSON.stringify(versionData)).digest('hex')
  return { goods, deliveryType: event.deliveryType, address, contact, deliveryTime, distance: Number(distance.toFixed(2)), priceDetail, quoteVersion }
}

exports.main = async event => {
  const { OPENID } = cloud.getWXContext()
  try {
    const user = await requireUser(OPENID)
    if (event.action === 'quote') {
      const quote = await buildQuote(event, user)
      return { success: true, quote }
    }
    if (event.action !== 'submit') return failure('INVALID_REQUEST', '不支持的预约操作')

    const requestId = String(event.requestId || '')
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(requestId)) return failure('INVALID_REQUEST', '预约请求无效')
    const existing = await db.collection('orders').where({ _openid: OPENID, requestId }).limit(1).get()
    if (existing.data[0]) return { success: true, duplicate: true, data: { orderId: existing.data[0]._id, orderNo: existing.data[0].orderNo } }

    const quote = await buildQuote(event, user)
    if (event.quoteVersion !== quote.quoteVersion) return failure('QUOTE_CHANGED', '商品或费用已更新，请确认最新金额', { quote })

    const orderNo = `ZM${Date.now().toString().slice(-10)}`
    let result
    try {
      result = await db.collection('orders').add({
        data: {
          _openid: OPENID,
          requestId,
          orderNo,
          userId: user._id,
          contact: quote.contact,
          goods: quote.goods,
          deliveryType: quote.deliveryType,
          address: quote.address,
          deliveryTime: quote.deliveryTime,
          remark: String(event.remark || '').trim().slice(0, 200),
          outOfStockOption: 'call',
          priceDetail: quote.priceDetail,
          status: 'pending',
          createTime: db.serverDate(),
          updatedAt: db.serverDate()
        }
      })
    } catch (err) {
      const duplicate = await db.collection('orders').where({ _openid: OPENID, requestId }).limit(1).get()
      if (duplicate.data[0]) return { success: true, duplicate: true, data: { orderId: duplicate.data[0]._id, orderNo: duplicate.data[0].orderNo } }
      throw err
    }
    return { success: true, data: { orderId: result._id, orderNo } }
  } catch (err) {
    console.error('createReservation failed:', err.code || err.message)
    return failure(err.code || 'RESERVATION_FAILED', err.message || '预约提交失败')
  }
}
