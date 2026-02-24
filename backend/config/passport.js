const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Configure Passport to use Google OAuth
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.API_BASE_URL || 'http://localhost:5001'}/auth/google/callback`,
    scope: ['profile', 'email']
  },
  function(accessToken, refreshToken, profile, done) {
    // This function is called after successful authentication
    // You can save the user to your database here
    return done(null, profile);
  }
));

// Serialize user into the session
passport.serializeUser((user, done) => {
  done(null, user);
});

// Deserialize user from the session
passport.deserializeUser((user, done) => {
  done(null, user);
});

module.exports = passport;
