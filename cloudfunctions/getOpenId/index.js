// 云函数入口函数
exports.main = async (event, context) => {
  const { OPENID } = getWXContext()
  return {
    openid: OPENID,
    appid: context.APPID,
    unionid: context.UNIONID
  }
}

function getWXContext() {
  return {
    OPENID: process.env.WX_OPENID,
    APPID: process.env.WX_APPID,
    UNIONID: process.env.WX_UNIONID
  }
}