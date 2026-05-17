const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const usersCollection = db.collection('users')

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  try {
    // 只获取用户基本信息，不再作为唯一标识
    const userResult = await usersCollection.where({
      _openid: openid
    }).get()
    
    if (userResult.data.length > 0) {
      const user = userResult.data[0]
      await usersCollection.doc(user._id).update({
        data: {
          lastLoginTime: db.serverDate(),
          loginCount: db.command.inc(1)
        }
      })
      
      return {
        success: true,
        isNewUser: false,
        userInfo: {
          id: user._id,
          openid: openid,
          nickName: user.nickName || '微信用户',
          avatarUrl: user.avatarUrl || '',
          phone: user.phone || '',
          memberLevel: user.memberLevel || 0,
          memberBalance: user.memberBalance || 0,
          createTime: user.createTime,
          lastLoginTime: new Date()
        }
      }
    } else {
      // 新用户，返回基本信息，由登录页面根据手机号创建用户
      return {
        success: true,
        isNewUser: true,
        userInfo: {
          openid: openid,
          nickName: '微信用户',
          avatarUrl: '',
          phone: '',
          memberLevel: 0,
          memberBalance: 0
        }
      }
    }
  } catch (err) {
    console.error('登录失败:', err)
    return {
      success: false,
      error: err.message
    }
  }
}