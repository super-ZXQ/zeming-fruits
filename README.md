# 泽明果业

这是一个基于微信云开发的水果预约小程序：顾客可查看商品与价格、加入购物车、选择到店自取或 3km 内送货上门（配送费 ¥5），提交预约但不在线支付。

## 当前流程

1. 顾客用手机号授权登录，浏览在售水果并加入购物车。
2. 结算时选择自取，或从已保存地址中选择带定位的配送地址。
3. 服务端重新核验商品价格、上下架状态和配送距离；3km 外无法提交。
4. 管理员确认预约后，依次进入备货、配送、完成；顾客只能在配送中确认收货，或在完成后申请售后。

## 首次部署

在微信开发者工具中关联云环境后，右键以下云函数，选择“创建并部署：云端安装依赖（不上传 node_modules）”：

- `createReservation`、`decryptPhone`、`userLogin`
- `adminAuth`、`adminProducts`、`adminOrders`、`adminManagers`
- `customerOrders`、`parseExcel`

然后在云开发控制台创建 `users`、`addresses`、`products`、`orders`、`coupons`、`settings`、`managers`、`admins` 集合。

## 必做的数据库权限设置

云函数部署不会自动修改数据库权限。请在云开发控制台的数据库权限中，将以下三个集合的规则分别替换为仓库 `cloud` 文件夹中对应内容：

- `products`：使用 `cloud/products.permissions.json`，顾客只读，商品价格和上下架只能通过管理员云函数修改。
- `managers`：使用 `cloud/managers.permissions.json`，禁止客户端直接读写管理员名单。
- `orders`：使用 `cloud/orders.permissions.json`，顾客只读自己的订单，状态只能由云函数推进。

这一步必须完成，否则恶意客户端仍可能绕过页面直接修改数据。

## 管理员账号

第一位店主需要在 `admins` 集合配置一条包含其 OpenID 的记录，例如：

```json
{ "adminOpenids": ["店主的 OpenID"] }
```

店主先用手机号登录，然后进入“我的 → 管理后台”。在商品管理页顶部可进入订单看板和账号管理；账号管理可按手机号搜索已登录过小程序的用户，并添加普通管理员或超级管理员。

## 地图配置

地址新增使用微信位置选择，不依赖腾讯地图 Key。若后续要启用自由输入地址的地理编码，再在 `config/location-config.json` 填入真实腾讯地图 Key；不要提交密钥到仓库。
