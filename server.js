const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const salesRoutes = require('./routes/salesRoutes');

dotenv.config();

// Initialize Crons
require('./cron/rewardCron');

// Connect to MongoDB
connectDB();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory');
}

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
    'https://admin.swampdeer.cloud',
    'https://sale.swampdeer.cloud',
    'https://user.swampdeer.cloud',
    'http://localhost:5173',
    'http://localhost:5174'
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like Postman or server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true, // allow cookies/auth headers
}));

app.use(express.json());

app.use('/uploads', express.static('uploads'));

// Routes
app.get('/', (req, res) => {
    res.send('Sales Management API is running');
});

app.use('/api/auth', authRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/branches', require('./routes/branchRoutes'));
app.use('/api/investors', require('./routes/investorRoutes'));
app.use('/api/withdrawals', require('./routes/withdrawalRoutes'));
app.use('/api/rewards', require('./routes/rewardRoutes'));
app.use('/api/investments', require('./routes/investmentRoutes'));

// Error Handling Middleware (Simple)
app.use((err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);
    res.json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
