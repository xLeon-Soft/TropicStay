const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

const googleClient = new OAuth2Client();

const googleLogin = async (req, res) => {
  const { credential } = req.body;
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const jwtSecret = process.env.JWT_SECRET;

  if (!googleClientId || !jwtSecret) {
    return res.status(500).json({
      success: false,
      message: 'El inicio de sesión no está configurado en el servidor.',
    });
  }

  if (!credential) {
    return res.status(400).json({ success: false, message: 'Credencial de Google requerida.' });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: googleClientId,
    });
    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email || !payload.email_verified) {
      return res.status(401).json({ success: false, message: 'La cuenta de Google no pudo verificarse.' });
    }

    const user = await User.findOneAndUpdate(
      { email: payload.email.toLowerCase() },
      {
        $set: {
          name: payload.name || payload.email,
          avatar: payload.picture || undefined,
          googleId: payload.sub,
          verified: true,
        },
        $setOnInsert: { role: 'guest' },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const token = jwt.sign(
      { sub: user._id.toString(), email: user.email },
      jwtSecret,
      { expiresIn: '8h' }
    );

    return res.json({
      success: true,
      token,
      user: { name: user.name, email: user.email, picture: user.avatar },
    });
  } catch (error) {
    console.error('Error verificando el acceso con Google:', error.message);
    return res.status(401).json({ success: false, message: 'La credencial de Google no es válida.' });
  }
};

module.exports = { googleLogin };
