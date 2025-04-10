const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Xử lý yêu cầu OPTIONS (preflight) cho CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: ''
    };
  }

  // Lấy URL đích từ query string
  const targetUrl = event.queryStringParameters.url;
  if (!targetUrl) {
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ error: 'Missing URL parameter' })
    };
  }

  // Kiểm tra URL đích để bảo mật (chỉ cho phép gửi đến GAS của bạn)
  if (!targetUrl.startsWith('https://script.google.com/macros/s/AKfycbw6-aMFUuM0Ifeuc9PCC4i3QDko0vBGT30uGQEmC5_4JMcvemWGxwhTYyLHQ1F7eJHDsg/exec')) {
    return {
      statusCode: 403,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ error: 'Invalid target URL' })
    };
  }

  try {
  // Gửi yêu cầu đến URL đích (GAS)
  const response = await fetch(targetUrl, {
    method: event.httpMethod,
    headers: {
      'Content-Type': 'application/json'
    },
    body: event.httpMethod === 'POST' ? event.body : undefined
  });

  // Kiểm tra Content-Type của phản hồi
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(`Expected JSON but received ${contentType || 'unknown content type'}: ${text.slice(0, 100)}...`);
  }

  const data = await response.json();

  // Trả về phản hồi với header CORS
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify(data)
  };
} catch (error) {
  return {
    statusCode: 500,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify({ error: error.message })
  };
}
