let TENCENT_MAP_KEY = ''

try {
  const config = require('../config/location-config.json')
  TENCENT_MAP_KEY = config.tencentMapKey || ''
} catch (e) {
  console.warn('未找到地图配置文件，请在 config/location-config.json 中配置 tencentMapKey')
}

const SHOP_LOCATION = {
  latitude: 33.588399,
  longitude: 119.073823,
  address: '江苏省淮安市清江浦区济南路东冠逸景花苑1号楼1-5.1-6号 泽明果业',
  name: '泽明果业',
  phone: '15250878388'
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const rad = Math.PI / 180.0
  const radLat1 = lat1 * rad
  const radLat2 = lat2 * rad
  const a = radLat1 - radLat2
  const b = (lng1 * rad) - (lng2 * rad)
  
  let s = 2 * Math.asin(Math.sqrt(
    Math.pow(Math.sin(a / 2), 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.pow(Math.sin(b / 2), 2)
  ))
  
  s = s * 6378.137
  s = Math.round(s * 10000) / 10000
  
  return s
}

function getDrivingDistance(origin, destination) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: 'https://apis.map.qq.com/ws/distance/v1/matrix/',
      data: {
        key: TENCENT_MAP_KEY,
        mode: 'driving',
        from: `${origin.latitude},${origin.longitude}`,
        to: `${destination.latitude},${destination.longitude}`
      },
      success: (res) => {
        if (res.data.status === 0) {
          const result = res.data.result
          const row = result.rows[0]
          if (row && row.elements[0]) {
            const element = row.elements[0]
            resolve({
              distance: element.distance / 1000,
              duration: element.duration / 60,
              status: 'success'
            })
          } else {
            reject(new Error('无法获取距离信息'))
          }
        } else {
          reject(new Error(res.data.message || '请求失败'))
        }
      },
      fail: (err) => {
        reject(err)
      }
    })
  })
}

function geocoder(address) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: 'https://apis.map.qq.com/ws/geocoder/v1/',
      data: {
        key: TENCENT_MAP_KEY,
        address: address
      },
      success: (res) => {
        if (res.data.status === 0) {
          const location = res.data.result.location
          resolve({
            latitude: location.lat,
            longitude: location.lng,
            address: res.data.result.address,
            status: 'success'
          })
        } else {
          reject(new Error(res.data.message || '地址解析失败'))
        }
      },
      fail: (err) => {
        reject(err)
      }
    })
  })
}

function reverseGeocoder(latitude, longitude) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: 'https://apis.map.qq.com/ws/geocoder/v1/',
      data: {
        key: TENCENT_MAP_KEY,
        location: `${latitude},${longitude}`
      },
      success: (res) => {
        if (res.data.status === 0) {
          const result = res.data.result
          resolve({
            address: result.address,
            formatted_addresses: result.formatted_addresses,
            address_component: result.address_component,
            status: 'success'
          })
        } else {
          reject(new Error(res.data.message || '逆地址解析失败'))
        }
      },
      fail: (err) => {
        reject(err)
      }
    })
  })
}

function checkDeliveryRange(userLocation) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('========== checkDeliveryRange 开始 ==========')
      console.log('用户位置:', userLocation)
      console.log('店铺位置:', SHOP_LOCATION)
      
      let distance = 0
      let duration = 0
      
      distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        SHOP_LOCATION.latitude,
        SHOP_LOCATION.longitude
      )
      
      console.log('直线距离计算结果:', distance, '公里')
      
      try {
        const result = await getDrivingDistance(userLocation, SHOP_LOCATION)
        console.log('驾驶距离计算结果:', result)
        distance = result.distance
        duration = result.duration
      } catch (distErr) {
        console.log('驾驶距离计算失败，使用直线距离:', distErr.message)
      }
      
      console.log('最终计算距离:', distance, '公里')
      
      let deliveryFee = 0
      let canDeliver = true
      let message = ''
      
      if (distance <= 3) {
        deliveryFee = 5
        message = `配送距离 ${distance.toFixed(2)} 公里，配送费 ¥5`
      } else {
        canDeliver = false
        message = `配送距离 ${distance.toFixed(2)} 公里，超出配送范围（3公里）`
      }
      
      console.log('配送结果:', { canDeliver, deliveryFee, message })
      console.log('========== checkDeliveryRange 结束 ==========')
      
      resolve({
        distance,
        duration,
        deliveryFee,
        canDeliver,
        message,
        shopLocation: SHOP_LOCATION
      })
    } catch (err) {
      console.error('检查配送范围失败:', err)
      reject(err)
    }
  })
}

function chooseLocation() {
  return new Promise((resolve, reject) => {
    wx.chooseLocation({
      success: (res) => {
        console.log('选择位置成功:', res)
        resolve({
          latitude: res.latitude,
          longitude: res.longitude,
          name: res.name,
          address: res.address
        })
      },
      fail: (err) => {
        console.log('选择位置失败:', err)
        if (err.errMsg && err.errMsg.includes('cancel')) {
          reject(new Error('用户取消选择'))
        } else {
          reject(err)
        }
      }
    })
  })
}

function getUserLocation() {
  return new Promise((resolve, reject) => {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        resolve({
          latitude: res.latitude,
          longitude: res.longitude
        })
      },
      fail: (err) => {
        reject(err)
      }
    })
  })
}

function requestLocationPermission() {
  return new Promise((resolve, reject) => {
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.userLocation']) {
          resolve(true)
        } else {
          wx.authorize({
            scope: 'scope.userLocation',
            success: () => resolve(true),
            fail: (err) => {
              console.log('授权失败:', err)
              wx.showModal({
                title: '需要位置权限',
                content: '请在设置中开启位置权限，以便计算配送距离',
                showCancel: true,
                confirmText: '去设置',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    wx.openSetting({
                      success: (settingRes) => {
                        if (settingRes.authSetting['scope.userLocation']) {
                          resolve(true)
                        } else {
                          resolve(false)
                        }
                      },
                      fail: () => resolve(false)
                    })
                  } else {
                    resolve(false)
                  }
                }
              })
            }
          })
        }
      },
      fail: () => {
        resolve(false)
      }
    })
  })
}

module.exports = {
  SHOP_LOCATION,
  getMapKey: () => TENCENT_MAP_KEY,
  calculateDistance,
  getDrivingDistance,
  geocoder,
  reverseGeocoder,
  checkDeliveryRange,
  chooseLocation,
  getUserLocation,
  requestLocationPermission
}