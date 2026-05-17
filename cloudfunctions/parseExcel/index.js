const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  const { fileUrl } = event
  
  if (!fileUrl) {
    return {
      success: false,
      error: '缺少文件路径'
    }
  }
  
  try {
    const xlsx = require('node-xlsx')
    
    let fileContent
    if (fileUrl.startsWith('cloud://')) {
      const downloadRes = await cloud.downloadFile({
        fileID: fileUrl
      })
      fileContent = downloadRes.fileContent
    } else {
      return {
        success: false,
        error: '请先上传文件到云存储'
      }
    }
    
    const sheets = xlsx.parse(fileContent)
    
    if (!sheets || sheets.length === 0) {
      return {
        success: false,
        error: 'Excel文件为空'
      }
    }
    
    const sheet = sheets[0]
    const data = sheet.data
    
    if (data.length < 2) {
      return {
        success: false,
        error: 'Excel没有数据行'
      }
    }
    
    const headers = data[0]
    const headerMap = {}
    
    headers.forEach((header, index) => {
      if (header) {
        const h = String(header).trim()
        if (h.includes('名称') || h.toLowerCase() === 'name') {
          headerMap.name = index
        } else if (h.includes('价格') || h.toLowerCase() === 'price') {
          headerMap.price = index
        } else if (h.includes('原价') || h.toLowerCase() === 'originalprice') {
          headerMap.originalPrice = index
        } else if (h.includes('单位') || h.toLowerCase() === 'unit') {
          headerMap.unit = index
        } else if (h.includes('分类') || h.toLowerCase() === 'category') {
          headerMap.category = index
        } else if (h.includes('标签') || h.toLowerCase() === 'tag') {
          headerMap.tag = index
        } else if (h.includes('图片') || h.toLowerCase() === 'image') {
          headerMap.imageUrl = index
        }
      }
    })
    
    const products = []
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i]
      
      if (!row || row.length === 0) continue
      
      const name = headerMap.name !== undefined ? row[headerMap.name] : row[0]
      const price = headerMap.price !== undefined ? row[headerMap.price] : row[1]
      
      if (!name || !price) continue
      
      const product = {
        name: String(name).trim(),
        price: parseFloat(price) || 0,
        originalPrice: headerMap.originalPrice !== undefined ? parseFloat(row[headerMap.originalPrice]) || null : null,
        unit: headerMap.unit !== undefined ? String(row[headerMap.unit] || '份').trim() : '份',
        category: headerMap.category !== undefined ? String(row[headerMap.category] || '').trim() : '',
        tag: headerMap.tag !== undefined ? String(row[headerMap.tag] || '').trim() : '',
        imageUrl: headerMap.imageUrl !== undefined ? String(row[headerMap.imageUrl] || '').trim() : ''
      }
      
      products.push(product)
    }
    
    return {
      success: true,
      data: products,
      total: products.length
    }
    
  } catch (err) {
    console.error('解析Excel失败:', err)
    return {
      success: false,
      error: err.message || '解析失败'
    }
  }
}