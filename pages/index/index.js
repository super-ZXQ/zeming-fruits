const app = getApp();

Page({
  data: {
    notices: [
      '🎉 新用户首单立减 10 元，快来选购吧！',
      '🍓 草莓季特惠，精选草莓 8 折起',
      '🚚 满 39 元免配送费，新鲜直达'
    ],
    banners: [
      { id: 1, title: '新鲜水果', subtitle: '产地直供 新鲜直达', emoji: '🍎', bgColor: 'linear-gradient(135deg, #43A047 0%, #2E7D32 100%)' },
      { id: 2, title: '限时秒杀', subtitle: '超值优惠 不容错过', emoji: '⚡', bgColor: 'linear-gradient(135deg, #e53935 0%, #c62828 100%)' },
      { id: 3, title: '会员专享', subtitle: '充值返现 更多福利', emoji: '👑', bgColor: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)' }
    ],
    quickEntries: [
      { id: 'premium', name: '精品水果', emoji: '🍇', bgColor: 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)' },
      { id: 'freshcut', name: '缤纷果切', emoji: '🍉', bgColor: 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)' },
      { id: 'dried', name: '营养干果', emoji: '🥜', bgColor: 'linear-gradient(135deg, #FFF8E1 0%, #FFECB3 100%)' },
      { id: 'snacks', name: '休闲零食', emoji: '🍪', bgColor: 'linear-gradient(135deg, #FCE4EC 0%, #F8BBD9 100%)' },
      { id: 'seckill', name: '限时秒杀', emoji: '⚡', bgColor: 'linear-gradient(135deg, #FFEBEE 0%, #FFCDD2 100%)' }
    ],
    countdown: {
      hours: '02',
      minutes: '30',
      seconds: '16'
    },
    seckillProducts: [],
    hotProducts: [],
    loading: true
  },

  countdownTimer: null,

  onLoad() {
    this.startCountdown();
  },

  onShow() {
    // 每次显示首页时都重新加载公告（确保显示最新数据）
    this.loadNotices();
    this.loadProducts();
  },

  async loadNotices() {
    const app = getApp();
    
    console.log('========== 首页加载公告 ==========')
    
    // 优先使用全局数据
    if (app.globalData.shopSettings && app.globalData.shopSettings.notices) {
      console.log('使用全局数据:', app.globalData.shopSettings.notices)
      this.setData({
        notices: app.globalData.shopSettings.notices
      });
      return;
    }
    
    // 如果全局数据没有，则从数据库加载
    try {
      const db = wx.cloud.database();
      const res = await db.collection('settings').doc('homepage').get();
      
      if (res.data && res.data.notices) {
        console.log('从数据库加载到公告:', res.data.notices)
        this.setData({
          notices: res.data.notices
        });
        
        app.globalData.shopSettings = res.data;
      } else {
        console.log('⚠️ 数据库中无公告数据，使用默认值')
      }
    } catch (err) {
      console.log('⚠️ 加载公告失败，使用默认值:', err);
    }
  },

  onUnload() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }
  },

  async loadProducts() {
    try {
      const db = wx.cloud.database();
      const res = await db.collection('products')
        .orderBy('sales', 'desc')
        .limit(20)
        .get();
      
      if (res.data && res.data.length > 0) {
        const products = res.data.map(item => ({
          id: item._id,
          name: item.name,
          description: item.unit ? `约${item.unit}` : '',
          emoji: item.emoji || '🍎',
          price: item.price,
          originalPrice: item.originalPrice,
          tag: item.tag || '',
          sales: item.sales || 0,
          imageUrl: item.imageUrl,
          isSeckill: item.isSeckill || false,
          seckillPrice: item.seckillPrice,
          seckillStock: item.seckillStock,
          seckillLimit: item.seckillLimit
        }));
        
        const seckillProducts = products.filter(p => p.isSeckill).slice(0, 4);
        const hotProducts = products.slice(0, 6);
        
        this.setData({
          seckillProducts: seckillProducts.length > 0 ? seckillProducts : this.getDefaultSeckillProducts(),
          hotProducts: hotProducts.length > 0 ? hotProducts : this.getDefaultHotProducts(),
          loading: false
        });
      } else {
        this.setData({
          seckillProducts: this.getDefaultSeckillProducts(),
          hotProducts: this.getDefaultHotProducts(),
          loading: false
        });
      }
    } catch (err) {
      console.error('加载商品失败:', err);
      this.setData({
        seckillProducts: this.getDefaultSeckillProducts(),
        hotProducts: this.getDefaultHotProducts(),
        loading: false
      });
    }
  },

  getDefaultSeckillProducts() {
    return [
      { id: 1, name: '3 袋 EDO 金桔柠檬夹心饼干', emoji: '🍪', price: 10.80, originalPrice: 25.90, sold: 4, remain: 56, progress: 7, limit: 2 },
      { id: 2, name: '海南金煌芒 约 500g', emoji: '🥭', price: 9.90, originalPrice: 25.80, sold: 28, remain: 22, progress: 56, limit: 1 },
      { id: 3, name: '奶油草莓 约 250g', emoji: '🍓', price: 15.00, originalPrice: 29.90, sold: 45, remain: 15, progress: 75, limit: 2 },
      { id: 4, name: '赣南脐橙 约 500g', emoji: '🍊', price: 8.80, originalPrice: 18.80, sold: 68, remain: 12, progress: 85, limit: 3 }
    ];
  },

  getDefaultHotProducts() {
    return [
      { id: 1, name: '花香蓝莓大果', description: '约 125g 新鲜采摘', emoji: '🫐', price: 12.80, originalPrice: 19.90, tag: '热销' },
      { id: 2, name: '智利车厘子', description: 'JJ 级 约 250g', emoji: '🍒', price: 39.90, originalPrice: 59.90, tag: '进口' },
      { id: 3, name: '红富士苹果', description: '约 500g 脆甜多汁', emoji: '🍎', price: 9.90, originalPrice: 15.80, tag: '特价' },
      { id: 4, name: '阳光玫瑰葡萄', description: '约 500g 香甜可口', emoji: '🍇', price: 29.90, originalPrice: 39.90, tag: '新品' },
      { id: 5, name: '水蜜桃', description: '约 500g 香甜多汁', emoji: '🍑', price: 19.90, originalPrice: 28.80, tag: '' },
      { id: 6, name: '海南香蕉', description: '约 500g 自然熟', emoji: '🍌', price: 5.90, originalPrice: 12.80, tag: '秒杀' }
    ];
  },

  startCountdown() {
    let totalSeconds = 2 * 3600 + 30 * 60 + 16;

    this.countdownTimer = setInterval(() => {
      if (totalSeconds <= 0) {
        totalSeconds = 2 * 3600 + 30 * 60 + 16;
      }

      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      this.setData({
        countdown: {
          hours: hours.toString().padStart(2, '0'),
          minutes: minutes.toString().padStart(2, '0'),
          seconds: seconds.toString().padStart(2, '0')
        }
      });

      totalSeconds--;
    }, 1000);
  },

  goToSearch() {
    wx.showToast({
      title: '搜索功能开发中',
      icon: 'none'
    });
  },

  shareApp() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },

  goToMember() {
    wx.navigateTo({
      url: '/pages/recharge/recharge'
    });
  },

  goToCategory(e) {
    const categoryId = e.currentTarget.dataset.id;
    app.globalData.categoryId = categoryId;
    wx.switchTab({
      url: '/pages/category/category'
    });
  },

  goToDetail(e) {
    const productId = e.currentTarget.dataset.id;
    wx.showToast({
      title: '商品详情开发中',
      icon: 'none'
    });
  },

  buySeckill(e) {
    const item = e.currentTarget.dataset.item;

    app.addToCart({
      id: item.id,
      name: item.name,
      price: item.price,
      emoji: item.emoji,
      imageUrl: item.imageUrl,
      description: '秒杀商品'
    }, 1);

    wx.showToast({
      title: '已加入购物车',
      icon: 'success'
    });
  },

  addToCart(e) {
    const item = e.currentTarget.dataset.item;

    app.addToCart({
      id: item.id,
      name: item.name,
      price: item.price,
      emoji: item.emoji,
      imageUrl: item.imageUrl,
      description: item.description
    }, 1);

    wx.showToast({
      title: '已加入购物车',
      icon: 'success'
    });
  }
});
