let tencentMapKey = ''

try {
  tencentMapKey = require('../config/location-config.json').tencentMapKey || ''
} catch (err) {
  console.warn('未找到地图配置文件，请在 config/location-config.json 中配置 tencentMapKey')
}

const SHOP_LOCATION = {
  latitude: 33.588399,
  longitude: 119.073823
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

function geocoder(address) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: 'https://apis.map.qq.com/ws/geocoder/v1/',
      data: { key: tencentMapKey, address },
      success: res => {
        if (res.data.status !== 0) {
          reject(new Error(res.data.message || '地址解析失败'))
          return
        }
        const location = res.data.result.location
        resolve({ latitude: location.lat, longitude: location.lng })
      },
      fail: reject
    })
  })
}

function checkDeliveryRange(location) {
  const distance = calculateDistance(location, SHOP_LOCATION)
  const canDeliver = distance <= 3
  return Promise.resolve({
    distance,
    deliveryFee: canDeliver ? 5 : 0,
    canDeliver
  })
}

module.exports = {
  SHOP_LOCATION,
  calculateDistance,
  geocoder,
  checkDeliveryRange
}
