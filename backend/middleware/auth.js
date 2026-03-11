const { auth } = require('../config/firebase');

module.exports = async (req, res, next) => {

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'No authorization token provided'
    });
  }

  const token = authHeader.split(' ')[1];

  try {

    // Verify Firebase ID Token
    const decodedToken = await auth.verifyIdToken(token);

    // decodedToken contains uid, email, etc.
    req.user = decodedToken;

    next();

  } catch (error) {

    console.error('Token verification failed:', error.message);

    return res.status(401).json({
      error: 'Invalid or expired token'
    });

  }

};