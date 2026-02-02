module.exports = {
  apps: [{
    name: "sales-api",
    script: "./server.js",
    env_production: {
      NODE_ENV: "production",
      PORT: 5000,
      // User will need to fill these in on the server
      MONGO_URI: process.env.MONGO_URI,
      JWT_SECRET: process.env.JWT_SECRET,
      FRONTEND_URL: process.env.FRONTEND_URL,
      EMAIL_USER: process.env.EMAIL_USER,
      EMAIL_PASS: process.env.EMAIL_PASS,
      EMAIL_FROM: process.env.EMAIL_FROM
    }
  }]
}
