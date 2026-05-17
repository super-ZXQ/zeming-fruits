const apiBaseUrl = 'https://api.zemingfruits.com';

const request = (url, data = {}, method = 'GET') => {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token');
    
    wx.request({
      url: apiBaseUrl + url,
      data: data,
      method: method,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else if (res.statusCode === 401) {
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          wx.showToast({
            title: '请先登录',
            icon: 'none'
          });
          reject(res);
        } else {
          reject(res);
        }
      },
      fail: (err) => {
        console.error('请求失败', err);
        reject(err);
      }
    });
  });
};

const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const calculateDeliveryFee = (userLat, userLon, storeLat = 23.1291, storeLon = 113.2644) => {
  const distance = getDistance(userLat, userLon, storeLat, storeLon);
  if (distance <= 5) {
    return { available: true, fee: 5, distance: distance.toFixed(1) };
  } else {
    return { available: false, fee: 0, distance: distance.toFixed(1) };
  }
};

const formatPrice = (price) => {
  return (price / 100).toFixed(2);
};

const showToast = (title, icon = 'none') => {
  wx.showToast({
    title: title,
    icon: icon,
    duration: 2000
  });
};

const showModal = (title, content) => {
  return new Promise((resolve) => {
    wx.showModal({
      title: title,
      content: content,
      showCancel: false,
      success: () => resolve()
    });
  });
};

module.exports = {
  request,
  getDistance,
  calculateDeliveryFee,
  formatPrice,
  showToast,
  showModal
};