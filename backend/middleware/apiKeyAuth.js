// API Key authentication middleware for external API access
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      message: 'Please provide X-API-Key header'
    });
  }

  // Validate against environment variable
  const validApiKey = process.env.EXTERNAL_API_KEY;

  if (!validApiKey) {
    console.error('EXTERNAL_API_KEY not configured');
    return res.status(500).json({ error: 'API key validation not configured' });
  }

  if (apiKey !== validApiKey) {
    console.warn('Invalid API key attempt:', {
      providedKey: apiKey.substring(0, 8) + '...',
      timestamp: new Date().toISOString()
    });
    return res.status(403).json({
      error: 'Invalid API key',
      message: 'The provided API key is not valid'
    });
  }

  // API key is valid, proceed
  next();
};

module.exports = apiKeyAuth;
