const app = getApp();

Page({
  data: {
    currentCategory: 'premium',
    categories: [
      { id: 'premium', name: '精品水果' },
      { id: 'berry', name: '草莓樱桃' },
      { id: 'durian', name: '榴莲山竹' },
      { id: 'imported', name: '进口水果' },
      { id: 'freshcut', name: '缤纷果切' },
      { id: 'dried', name: '营养干果' },
      { id: 'snacks', name: '休闲零食' },
      { id: 'seckill', name: '限时秒杀' }
    ],
    products: [],
    cartCount: 0,
    cartTotal: '0.00',
    loading: false
  },

  onLoad() {
    const categoryId = app.globalData.categoryId || 'premium';
    this.loadProducts(categoryId);
  },

  onShow() {
    this.updateCartInfo();
    
    const categoryId = app.globalData.categoryId;
    if (categoryId) {
      this.loadProducts(categoryId);
      app.globalData.categoryId = null;
    } else {
      this.loadProducts(this.data.currentCategory);
    }
  },

  async loadProducts(categoryId) {
    this.setData({ loading: true, currentCategory: categoryId });
    
    try {
      const db = wx.cloud.database();
      const res = await db.collection('products')
        .orderBy('sales', 'desc')
        .limit(50)
        .get();
      
      if (res.data && res.data.length > 0) {
        let filteredProducts = res.data;
        const categoryProducts = res.data.filter(p => p.category === categoryId);
        
        if (categoryProducts.length > 0) {
          filteredProducts = categoryProducts;
        } else if (categoryId === 'berry') {
          filteredProducts = res.data.filter(p => 
            (p.name && (p.name.includes('草莓') || p.name.includes('樱桃') || p.name.includes('车厘子'))) ||
            (p.emoji && (p.emoji === '🍓' || p.emoji === '🍒'))
          );
        } else if (categoryId === 'durian') {
          filteredProducts = res.data.filter(p => 
            (p.name && (p.name.includes('榴莲') || p.name.includes('山竹'))) ||
            (p.emoji && p.emoji === '🥝')
          );
        } else if (categoryId === 'imported') {
          filteredProducts = res.data.filter(p => 
            (p.tag && p.tag.includes('进口')) ||
            (p.name && p.name.includes('进口'))
          );
        } else if (categoryId === 'freshcut') {
          filteredProducts = res.data.filter(p => 
            (p.name && (p.name.includes('鲜切') || p.name.includes('拼盘'))) ||
            (p.emoji && (p.emoji === '🍉' || p.emoji === '🍍' || p.emoji === '🍈'))
          );
        } else if (categoryId === 'dried') {
          filteredProducts = res.data.filter(p => 
            (p.name && (p.name.includes('干') || p.name.includes('坚果') || p.name.includes('核桃') || p.name.includes('葡萄干'))) ||
            (p.emoji && p.emoji === '🥜')
          );
        } else if (categoryId === 'snacks') {
          filteredProducts = res.data.filter(p => 
            (p.name && (p.name.includes('饼干') || p.name.includes('巧克力') || p.name.includes('糖果'))) ||
            (p.emoji && (p.emoji === '🍪' || p.emoji === '🍫'))
          );
        } else if (categoryId === 'seckill') {
          filteredProducts = res.data.filter(p => 
            p.tag && p.tag.includes('秒杀')
          );
        }
        
        if (filteredProducts.length === 0) {
          filteredProducts = res.data;
        }
        
        const products = filteredProducts.map(item => ({
          id: item._id,
          name: item.name,
          emoji: item.emoji || '🍎',
          brand: item.brand || '泽明',
          tag: item.tag || '',
          sales: item.sales || 0,
          originalPrice: item.originalPrice,
          price: item.price,
          unit: item.unit || '份',
          discountText: item.tag || '特价',
          imageUrl: item.imageUrl
        }));
        
        this.setData({ 
          products: products,
          loading: false
        });
      } else {
        this.setData({ 
          products: this.getDefaultProducts(categoryId),
          loading: false
        });
      }
    } catch (err) {
      console.error('加载商品失败:', err);
      this.setData({ 
        products: this.getDefaultProducts(categoryId),
        loading: false
      });
    }
  },

  getDefaultProducts(categoryId) {
    const defaults = {
      'premium': [
        { id: 1, name: '花香蓝莓大果 约125g', emoji: '🫐', brand: '泽明', tag: '品牌特惠', sales: 528, originalPrice: 19.9, price: 12.8, discountText: '第1件¥12.8' },
        { id: 2, name: '智利车厘子 JJ级 约250g', emoji: '🍒', brand: '进口', tag: '空运直达', sales: 328, originalPrice: 99.9, price: 68.0, discountText: '第1件¥68' },
        { id: 3, name: '阳光玫瑰葡萄 约500g', emoji: '🍇', brand: '泽明', tag: '精品', sales: 456, originalPrice: 39.9, price: 29.9, discountText: '第1件¥29.9' }
      ],
      'berry': [
        { id: 5, name: '丹东草莓 约300g', emoji: '🍓', brand: '丹东', tag: '产地直发', sales: 456, originalPrice: 39.9, price: 29.9, discountText: '第1件¥29.9' },
        { id: 6, name: '奶油草莓 约250g', emoji: '🍓', brand: '泽明', tag: '今日特价', sales: 892, originalPrice: 29.9, price: 15.0, discountText: '第1件¥15' }
      ],
      'seckill': [
        { id: 32, name: '西瓜 约2kg', emoji: '🍉', tag: '秒杀', sales: 156, originalPrice: 29.9, price: 9.9, discountText: '限时秒杀' },
        { id: 33, name: '香蕉 约500g', emoji: '🍌', tag: '秒杀', sales: 289, originalPrice: 12.8, price: 5.9, discountText: '限时秒杀' }
      ]
    };
    
    return defaults[categoryId] || defaults['premium'];
  },

  switchCategory(e) {
    const categoryId = e.currentTarget.dataset.id;
    this.loadProducts(categoryId);
  },

  addToCart(e) {
    const item = e.currentTarget.dataset.item;
    
    app.addToCart({
      id: item.id,
      name: item.name,
      price: item.price,
      emoji: item.emoji,
      imageUrl: item.imageUrl,
      description: item.discountText
    }, 1);

    this.updateCartInfo();

    wx.showToast({
      title: '已加入购物车',
      icon: 'success',
      duration: 1000
    });
  },

  updateCartInfo() {
    const cart = app.globalData.cart || [];
    let count = 0;
    let total = 0;

    cart.forEach(item => {
      count += item.count;
      total += item.price * item.count;
    });

    this.setData({
      cartCount: count,
      cartTotal: total.toFixed(2)
    });
  },

  goToCart() {
    wx.switchTab({
      url: '/pages/cart/cart'
    });
  }
});
