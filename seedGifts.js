const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Gift = require('./models/Gift');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const gifts = [
    { rankId: 1, title: 'Tour Northern Areas', amount: 0 },
    { rankId: 2, title: 'Android Phone', amount: 0 },
    { rankId: 3, title: 'iPhone', amount: 0 },
    { rankId: 4, title: 'Alto Car', amount: 0 },
    { rankId: 5, title: 'Honda City', amount: 0 },
    { rankId: 6, title: 'Jacco 5 SUV', amount: 0 },
    { rankId: 7, title: 'Tank 500', amount: 0 },
    { rankId: 8, title: 'Beautiful Villa or 5 CR Cash', amount: 50000000 },
];

const seedGifts = async () => {
    try {
        await Gift.deleteMany();
        await Gift.insertMany(gifts);
        console.log('Gifts seeded successfully');
        process.exit();
    } catch (error) {
        console.error('Error seeding gifts:', error);
        process.exit(1);
    }
};

seedGifts();
