const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  console.log('decryptPhone event:', event)
  
  if (!event.code) {
    return {
      success: false,
      error: '缺少 code 参数'
    }
  }
  
  try {
    const result = await cloud.openapi.phonenumber.getPhoneNumber({
      code: event.code
    })
    
    console.log('getPhoneNumber result:', result)
    
    if (result.errCode === 0 && result.phoneInfo) {
      const phoneInfo = result.phoneInfo
      return {
        success: true,
        data: {
          phoneNumber: phoneInfo.phoneNumber,
          purePhoneNumber: phoneInfo.purePhoneNumber,
          countryCode: phoneInfo.countryCode
        }
      }
    } else {
      return {
        success: false,
        error: result.errMsg || '获取手机号失败'
      }
    }
  } catch (err) {
    console.error('解密手机号失败:', err)
    
    return {
      success: false,
      error: err.message || '解密失败',
      errCode: err.errCode
    }
  }
}
