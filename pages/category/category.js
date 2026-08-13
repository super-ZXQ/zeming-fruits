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
      { id: 'snacks', name: '休闲零食' }
    ],
    products: [],
    currentCategoryName: '精品水果',
    cartCount: 0,
    cartTotal: '0.00',
    loading: false,
    loadError: ''
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
    const category = this.data.categories.find(item => item.id === categoryId) || this.data.categories[0]
    this.setData({ loading: true, loadError: '', currentCategory: category.id, currentCategoryName: category.name });
    
    try {
      const db = wx.cloud.database();
      const res = await db.collection('products')
        .orderBy('sales', 'desc')
        .limit(50)
        .get();
      
      const activeProducts = (res.data || []).filter(product => product.status !== 'inactive' && product.status !== 'soldout')
      if (activeProducts.length > 0) {
        let filteredProducts = activeProducts;
        const categoryProducts = activeProducts.filter(p => p.category === category.id);
        
        if (categoryProducts.length > 0) {
          filteredProducts = categoryProducts;
        } else if (category.id === 'berry') {
          filteredProducts = activeProducts.filter(p =>
            (p.name && (p.name.includes('草莓') || p.name.includes('樱桃') || p.name.includes('车厘子'))) ||
            (p.emoji && (p.emoji === '🍓' || p.emoji === '🍒'))
          );
        } else if (category.id === 'durian') {
          filteredProducts = activeProducts.filter(p =>
            (p.name && (p.name.includes('榴莲') || p.name.includes('山竹'))) ||
            (p.emoji && p.emoji === '🥝')
          );
        } else if (category.id === 'imported') {
          filteredProducts = activeProducts.filter(p =>
            (p.tag && p.tag.includes('进口')) ||
            (p.name && p.name.includes('进口'))
          );
        } else if (category.id === 'freshcut') {
          filteredProducts = activeProducts.filter(p =>
            (p.name && (p.name.includes('鲜切') || p.name.includes('拼盘'))) ||
            (p.emoji && (p.emoji === '🍉' || p.emoji === '🍍' || p.emoji === '🍈'))
          );
        } else if (category.id === 'dried') {
          filteredProducts = activeProducts.filter(p =>
            (p.name && (p.name.includes('干') || p.name.includes('坚果') || p.name.includes('核桃') || p.name.includes('葡萄干'))) ||
            (p.emoji && p.emoji === '🥜')
          );
        } else if (category.id === 'snacks') {
          filteredProducts = activeProducts.filter(p =>
            (p.name && (p.name.includes('饼干') || p.name.includes('巧克力') || p.name.includes('糖果'))) ||
            (p.emoji && (p.emoji === '🍪' || p.emoji === '🍫'))
          );
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
        this.setData({ products: [], loading: false });
      }
    } catch (err) {
      console.error('加载商品失败:', err);
      this.setData({ products: [], loading: false, loadError: '鲜果加载失败，请检查网络后重试' });
    }
  },

  switchCategory(e) {
    const categoryId = e.currentTarget.dataset.id;
    this.loadProducts(categoryId);
  },

  retryLoad() {
    this.loadProducts(this.data.currentCategory)
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
      title: '已加入预约单',
      icon: 'success',
      duration: 1000
    });
  },

  onImageError(e) {
    this.setData({ [`products[${e.currentTarget.dataset.index}].imageUrl`]: '' })
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
