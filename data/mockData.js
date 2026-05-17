var products = [
  {
    id: 1,
    name: '红富士苹果',
    price: 12.80,
    emoji: '🍎',
    description: '新鲜红富士苹果，脆甜多汁',
    category: '时令水果',
    sales: 5280,
    stock: 100
  },
  {
    id: 2,
    name: '进口车厘子',
    price: 68.00,
    emoji: '🍒',
    description: '智利进口车厘子，个大饱满',
    category: '进口水果',
    sales: 3260,
    stock: 50
  },
  {
    id: 3,
    name: '海南芒果',
    price: 15.80,
    emoji: '🥭',
    description: '海南新鲜芒果，香甜软糯',
    category: '热带水果',
    sales: 2890,
    stock: 80
  },
  {
    id: 4,
    name: '智利蓝莓',
    price: 45.00,
    emoji: '🫐',
    description: '新鲜蓝莓，富含花青素',
    category: '浆果类',
    sales: 1980,
    stock: 40
  },
  {
    id: 5,
    name: '西瓜',
    price: 9.90,
    emoji: '🍉',
    description: '夏日必备，甘甜多汁',
    category: '瓜类',
    sales: 4560,
    stock: 120
  },
  {
    id: 6,
    name: '赣南脐橙',
    price: 18.80,
    emoji: '🍊',
    description: '江西赣南脐橙，酸甜适中',
    category: '柑橘类',
    sales: 3780,
    stock: 90
  },
  {
    id: 7,
    name: '水蜜桃',
    price: 22.80,
    emoji: '🍑',
    description: '阳山水蜜桃，香甜多汁',
    category: '核果类',
    sales: 2150,
    stock: 60
  },
  {
    id: 8,
    name: '进口香蕉',
    price: 8.80,
    emoji: '🍌',
    description: '菲律宾进口香蕉，口感软糯',
    category: '热带水果',
    sales: 5200,
    stock: 150
  }
];

var categories = [
  { id: 1, name: '时令水果' },
  { id: 2, name: '进口水果' },
  { id: 3, name: '热带水果' },
  { id: 4, name: '浆果类' },
  { id: 5, name: '瓜类' },
  { id: 6, name: '柑橘类' },
  { id: 7, name: '核果类' }
];

var memberLevels = [
  { level: 0, name: '普通会员', discount: 1, color: '#999999' },
  { level: 1, name: '铜牌会员', discount: 0.98, color: '#cd7f32' },
  { level: 2, name: '银牌会员', discount: 0.95, color: '#c0c0c0' },
  { level: 3, name: '金牌会员', discount: 0.90, color: '#ffd700' },
  { level: 4, name: '钻石会员', discount: 0.85, color: '#b9f2ff' }
];

var rechargePackages = [
  { amount: 100, giveAmount: 5 },
  { amount: 200, giveAmount: 15 },
  { amount: 500, giveAmount: 50 },
  { amount: 1000, giveAmount: 120 }
];

var mockOrders = [];

function generateOrderId() {
  return 'ZM' + Date.now() + Math.random().toString(36).substr(2, 6).toUpperCase();
}

function getProducts() {
  return products;
}

function getProductsByCategory(category) {
  if (!category || category === '全部') {
    return products;
  }
  return products.filter(function(p) {
    return p.category === category;
  });
}

function getHotProducts(limit) {
  limit = limit || 10;
  return products.slice(0).sort(function(a, b) {
    return b.sales - a.sales;
  }).slice(0, limit);
}

function getProductById(id) {
  return products.find(function(p) {
    return p.id === id;
  });
}

function getCategories() {
  return categories;
}

function getMemberLevels() {
  return memberLevels;
}

function getRechargePackages() {
  return rechargePackages;
}

function createOrder(orderData) {
  var order = {
    id: generateOrderId(),
    items: orderData.items,
    totalAmount: orderData.totalAmount,
    deliveryFee: orderData.deliveryFee || 0,
    finalAmount: orderData.finalAmount,
    status: 'pending',
    createTime: new Date().toISOString(),
    payTime: null,
    deliveryType: orderData.deliveryType,
    address: orderData.address,
    phone: orderData.phone,
    remark: orderData.remark || ''
  };
  mockOrders.unshift(order);
  return order;
}

function getOrders(status) {
  if (!status || status === 'all') {
    return mockOrders;
  }
  return mockOrders.filter(function(order) {
    return order.status === status;
  });
}

function getOrderById(orderId) {
  return mockOrders.find(function(order) {
    return order.id === orderId;
  });
}

function updateOrderStatus(orderId, status) {
  var order = mockOrders.find(function(o) {
    return o.id === orderId;
  });
  if (order) {
    order.status = status;
    if (status === 'paid') {
      order.payTime = new Date().toISOString();
    }
    return order;
  }
  return null;
}

function mockLogin(phone, code, wechatInfo) {
  var nickname = wechatInfo ? wechatInfo.nickName : ('用户' + phone.slice(-4));
  var userInfo = {
    id: 'user_' + Date.now(),
    phone: phone,
    nickname: nickname,
    avatar: wechatInfo ? wechatInfo.avatarUrl : '',
    memberLevel: 0,
    memberBalance: 0,
    createTime: new Date().toISOString()
  };
  var token = 'mock_token_' + Date.now();
  return { userInfo: userInfo, token: token };
}

module.exports = {
  getProducts: getProducts,
  getProductsByCategory: getProductsByCategory,
  getHotProducts: getHotProducts,
  getProductById: getProductById,
  getCategories: getCategories,
  getMemberLevels: getMemberLevels,
  getRechargePackages: getRechargePackages,
  createOrder: createOrder,
  getOrders: getOrders,
  getOrderById: getOrderById,
  updateOrderStatus: updateOrderStatus,
  mockLogin: mockLogin
};