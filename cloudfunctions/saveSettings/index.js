const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

let adminConfig = {}
try {
  adminConfig = require('./admin-config.json')
} catch (e) {
  adminConfig = {
    adminOpenIds: ['od_cz3QbJT7rJnill3ACZM45K4pY']
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  console.log('========== saveSettings 云函数开始 ==========')
  console.log('调用者 openid:', wxContext.OPENID)
  console.log('接收到的数据:', event)
  
  if (!adminConfig.adminOpenIds.includes(wxContext.OPENID)) {
    console.error('非管理员尝试访问:', wxContext.OPENID)
    return {
      success: false,
      error: '无权限：只有管理员可以修改店铺设置'
    }
  }
  
  try {
    const db = cloud.database()
    const settingsData = {
      notices: event.notices,
      freeDeliveryThreshold: event.freeDeliveryThreshold,
      deliveryTip: event.deliveryTip,
      shopName: event.shopName,
      shopAddress: event.shopAddress,
      shopPhone: event.shopPhone,
      businessHours: event.businessHours,
      updatedAt: db.serverDate()
    }
    
    console.log('准备保存的数据:', JSON.stringify(settingsData))
    
    // 先尝试获取文档
    let docExists = false
    try {
      const checkRes = await db.collection('settings').doc('homepage').get()
      if (checkRes.data) {
        docExists = true
        console.log('文档已存在，准备更新')
      }
    } catch (checkErr) {
      console.log('文档不存在或获取失败:', checkErr.errMsg)
    }
    
    if (docExists) {
      // 文档存在，使用 set 覆盖（确保完整保存）
      await db.collection('settings').doc('homepage').set({
        data: settingsData
      })
      console.log('✅ 使用 set 更新成功')
    } else {
      // 文档不存在，创建新文档
      await db.collection('settings').add({
        data: {
          _id: 'homepage',
          ...settingsData
        }
      })
      console.log('✅ 创建文档成功')
    }
    
    // 验证保存结果
    const verifyRes = await db.collection('settings').doc('homepage').get()
    console.log('验证保存结果:', JSON.stringify(verifyRes.data))
    
    console.log('========== saveSettings 云函数完成 ==========')
    
    return {
      success: true,
      message: '保存成功',
      savedData: verifyRes.data
    }
    
  } catch (err) {
    console.error('========== saveSettings 云函数失败 ==========')
    console.error('错误类型:', err.constructor.name)
    console.error('错误代码:', err.errCode)
    console.error('错误消息:', err.errMsg || err.message)
    console.error('错误详情:', JSON.stringify(err))
    
    return {
      success: false,
      error: err.message || '保存失败',
      errorCode: err.errCode,
      errMsg: err.errMsg
    }
  }
}
