# 泽明果业 - 水果预约小程序

基于微信云开发的线下水果店预约小程序。用户可浏览商品价格、加入购物车、选择到店自取或送货上门并提交预约；小程序不提供在线支付。

## 预约规则

- 到店自取：营业时间内到店取货。
- 送货上门：仅配送店铺 3km 内地址，配送费固定 ¥5。
- 提交后订单为“待商家确认”，由商家确认商品和配送/取货时间。

## 主要功能

- 商品浏览、分类和购物车
- 地址管理与腾讯地图配送范围校验
- 预约订单、订单进度和售后申请
- 商品、优惠券、店铺信息与订单管理
- 管理员商品改价、上架与下架

## 云函数

- `createReservation`：服务端校验商品价格、库存、优惠券和配送范围后创建预约单
- `decryptPhone`、`userLogin`：手机号登录
- `adminAuth`、`adminProducts`：管理员身份核验和商品管理
- `saveSettings`：店铺信息保存
- `parseExcel`：商品批量导入

## 使用

1. 在 `config/location-config.json` 配置腾讯地图 Key。
2. 用微信开发者工具导入项目并关联云开发环境。
3. 在云函数目录中上传并部署 `createReservation`、`decryptPhone`、`userLogin`、`adminAuth`、`adminProducts` 及其他所需云函数。
4. 在云开发控制台创建 `users`、`addresses`、`products`、`orders`、`coupons`、`settings`、`managers` 集合。

## 配置管理员账号

管理员必须先用手机号完成一次登录。然后在云开发数据库的 `managers` 集合新增一条记录：`phone` 为该管理员手机号、`status` 为 `active`、`role` 为 `owner` 或 `staff`。已在 `admins.adminOpenids` 中配置 OpenID 的账号也会自动获得管理员权限。
