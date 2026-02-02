const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const companyDetails = {
    name: "Swamp Deer",
    about: "We specialize in bulk food commodity trading, sourcing high-quality products from trusted suppliers. Our focus is on ethical sourcing, efficient logistics, and strong client relationships that help businesses grow sustainably. Swamp Deer was founded with a clear mission: to source, process, and supply premium food commodities while maintaining the highest standards of quality, transparency, and trust.",
    experience: "With years of industry experience, we connect reliable producers with local and international markets, ensuring consistency, safety, and long-term value for our partners.",
    phone_primary: "+92 335 6919811",
    phone_secondary: "021-35882481",
    email: "info@swampdeer.store",
    address: "22nd Commercial Street, Building 42-C, 1st Floor, DHA Phase II Ext, Karachi"
};

/**
 * Generates an investment document PDF
 * @param {Object} sale - Sale record
 * @param {Object} investor - Investor record
 * @returns {Promise<string>} - Path to the generated PDF
 */
const generateInvestmentDocument = async (sale, investor) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ 
                margin: 0, 
                size: 'A4'
            });
            const filename = `investment_${sale._id}.pdf`;
            const dir = path.join(__dirname, '../uploads/documents');
            
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            const filePath = path.join(dir, filename);
            const stream = fs.createWriteStream(filePath);
            
            doc.pipe(stream);

            // --- PREMIUM HEADER ---
            doc.rect(0, 0, 612, 120).fill('#004d18'); 
            
            doc.fillColor('#ffffff')
               .fontSize(28)
               .font('Helvetica-Bold')
               .text(companyDetails.name.toUpperCase(), 50, 40);
            
            doc.fontSize(10)
               .font('Helvetica')
               .fillColor('#a8d5ba')
               .text('PREMIUM FOOD COMMODITIES TRADING & LOGISTICS', 52, 75, { characterSpacing: 1.5 });

            doc.rect(400, 45, 180, 40).fill('#ffffff');
            doc.fillColor('#004d18')
               .fontSize(12)
               .font('Helvetica-Bold')
               .text('OFFICIAL RECEIPT', 410, 58, { width: 160, align: 'center' });

            doc.moveDown(5);
            
            const contentX = 50;
            const contentY = 160;
            
            doc.fillColor('#111813').fontSize(9).font('Helvetica-Bold').text('DOCUMENT INFORMATION', contentX, contentY);
            doc.rect(contentX, contentY + 12, 512, 1).fill('#dbe6df');
            
            const infoY = contentY + 25;
            doc.fillColor('#61896f').font('Helvetica').fontSize(9).text('Reference ID:', contentX, infoY);
            doc.fillColor('#111813').font('Helvetica-Bold').text(sale._id, contentX + 70, infoY);
            
            doc.fillColor('#61896f').font('Helvetica').text('Issue Date:', 350, infoY);
            const dateStr = new Date(sale.createdAt || Date.now()).toLocaleDateString('en-GB', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            doc.fillColor('#111813').font('Helvetica-Bold').text(dateStr, 420, infoY);

            const partiesY = infoY + 40;
            
            doc.fillColor('#006820').fontSize(11).font('Helvetica-Bold').text('ISSUER (COMPANY)', contentX, partiesY);
            doc.fillColor('#111813').fontSize(12).text(companyDetails.name, contentX, partiesY + 18);
            doc.fillColor('#444a46').fontSize(9).font('Helvetica').moveDown(0.3);
            doc.text(companyDetails.address, { width: 230 });
            doc.text(`T: ${companyDetails.phone_primary}`);
            doc.text(`E: ${companyDetails.email}`);

            const investorColX = 350;
            doc.fillColor('#006820').fontSize(11).font('Helvetica-Bold').text('RECIPIENT (INVESTOR)', investorColX, partiesY);
            doc.fillColor('#111813').fontSize(12).text(investor.fullName || investor.name, investorColX, partiesY + 18);
            doc.fillColor('#444a46').fontSize(9).font('Helvetica').moveDown(0.3);
            doc.text(investor.address || 'Not Provided', { width: 210 });
            doc.text(`T: ${investor.phone}`);
            doc.text(`E: ${investor.email}`);

            const tableY = doc.y + 40;
            doc.fillColor('#f8faf9').rect(contentX, tableY, 512, 35).fill();
            doc.fillColor('#004d18').font('Helvetica-Bold').fontSize(10).text('INVESTMENT DESCRIPTION', contentX + 15, tableY + 12);
            doc.text('TOTAL AMOUNT', 450, tableY + 12);

            doc.fillColor('#111813').font('Helvetica').fontSize(11).text(sale.description, contentX + 15, tableY + 50, { width: 350, lineGap: 5 });
            doc.font('Helvetica-Bold').fontSize(16).text(`$${sale.amount.toLocaleString()}.00`, 430, tableY + 50);

            doc.rect(contentX, tableY + 95, 512, 35).fill('#eaf4ef');
            doc.fillColor('#006820').fontSize(10).font('Helvetica-Bold').text('STATUS: CONFIRMED & REGISTERED', contentX, tableY + 108, { width: 512, align: 'center' });

            doc.moveDown(7);
            doc.fillColor('#111813').fontSize(10).font('Helvetica-Bold').text('LEGAL & STRATEGIC OVERVIEW');
            doc.rect(contentX, doc.y + 2, 150, 1.5).fill('#006820');
            doc.moveDown(1.5);
            
            doc.fillColor('#444a46').fontSize(8.5).font('Helvetica').text(companyDetails.about, { align: 'justify', lineGap: 2 });
            doc.moveDown(0.5);
            doc.text(companyDetails.experience, { align: 'justify', lineGap: 2 });

            const footerY = 750;
            doc.rect(0, footerY, 612, 100).fill('#fbfcfb');
            doc.fillColor('#dbe6df').rect(0, footerY, 612, 1).fill();
            
            doc.fillColor('#91a499').fontSize(8).font('Helvetica').text('© 2024 SWAMP DEER COMMODITIES. ALL RIGHTS RESERVED.', 0, footerY + 20, { align: 'center' });
            doc.moveDown(0.5);
            doc.text('This is a computer-generated confirmation and does not require a physical signature for initial acknowledgement.', { align: 'center' });
            doc.text('For any queries, please contact info@swampdeer.store mentioning the Reference ID above.', { align: 'center' });

            doc.opacity(0.04)
               .fontSize(80)
               .fillColor('#004d18')
               .text('CERTIFIED', 100, 400, { rotation: 30 });
            
            doc.end();
            
            stream.on('finish', () => {
                resolve(filePath);
            });
            
            stream.on('error', (err) => {
                reject(err);
            });
            
        } catch (err) {
            reject(err);
        }
    });
};

module.exports = { generateInvestmentDocument };
