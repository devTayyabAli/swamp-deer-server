const nodemailer = require('nodemailer');

const getTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '465'),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
        tls: {
            rejectUnauthorized: false,
        },
    });
};

const sendCredentials = async (email, password) => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log('---------------------------------------------------');
        console.log('WARNING: No EMAIL_USER/EMAIL_PASS defined in .env');
        console.log(`Mock Sending Email to: ${email}`);
        console.log(`Password: ${password}`);
        console.log('---------------------------------------------------');
        // Still return so registration isn't blocked by missing env
        return;
    }

    const transporter = getTransporter();

    const mailOptions = {
        from: process.env.EMAIL_FROM || '"Swamp Deer" <no-reply@unboundedwealth.com>',
        to: email,
        subject: 'Your New Account Credentials',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #004225; text-align: center;">Welcome to Swamp Deer</h2>
                <p>Hello,</p>
                <p>An administrator has created a new account for you on the Swamp Deer Management System.</p>
                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>System Access Details:</strong></p>
                    <p style="margin: 5px 0;"><strong>Identity:</strong> ${email}</p>
                    <p style="margin: 5px 0;"><strong>Access Key:</strong> <code style="background: #eee; padding: 2px 5px; border-radius: 3px;">${password}</code></p>
                </div>
                <p style="color: #004225; font-weight: bold;">Important: Please log in and update your security profile immediately.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #7f8c8d; text-align: center;">This is an automated security transmission. Please do not reply.</p>
            </div>
        `,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ' + info.response);
    } catch (error) {
        console.error('Error sending email:', error);
    }
};

const sendResetPasswordEmail = async (email, resetUrl) => {
    const transporter = getTransporter();

    const mailOptions = {
        from: process.env.EMAIL_FROM || '"Sales Manager" <no-reply@salesapp.com>',
        to: email,
        subject: 'Password Reset Request',
        html: `
            <h3>Password Reset Request</h3>
            <p>You are receiving this email because you (or someone else) have requested the reset of the password for your account.</p>
            <p>Please click on the following link, or paste this into your browser to complete the process:</p>
            <a href="${resetUrl}">${resetUrl}</a>
            <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Reset Password Email sent');
    } catch (error) {
        console.error('Error sending reset email:', error);
    }
};

const sendVerificationEmail = async (email, verificationToken) => {
    const transporter = getTransporter();

    // Use FRONTEND_URL or default to localhost
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const verificationUrl = `${frontendUrl}/verify-email/${verificationToken}`;

    const mailOptions = {
        from: process.env.EMAIL_FROM || '"Swamp Deer" <no-reply@unboundedwealth.com>',
        to: email,
        subject: 'Verify Your Email Address',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #004225; text-align: center;">Welcome to Swamp Deer</h2>
                <p>Hello,</p>
                <p>Thank you for registering. Please verify your email address to complete your signup.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${verificationUrl}" style="background-color: #004225; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Verify Email Address</a>
                </div>
                <p style="font-size: 14px;">Or copy this link:</p>
                <code style="background: #f4f4f4; padding: 5px; word-break: break-all;">${verificationUrl}</code>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #7f8c8d; text-align: center;">This link expires in 24 hours.</p>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Verification Email sent to:', email);
    } catch (error) {
        console.error('Error sending verification email:', error);
    }
};

const sendStakingCapReachedEmail = async (email, reason) => {
    const transporter = getTransporter();

    const mailOptions = {
        from: process.env.EMAIL_FROM || '"Swamp Deer" <no-reply@unboundedwealth.com>',
        to: email,
        subject: 'Investment Cap Reached - Notification',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #004225; text-align: center;">Investment Milestone Reached</h2>
                <p>Hello,</p>
                <p>We are writing to inform you that your staking investment has reached its allocated limit.</p>
                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #004225;">
                    <p style="margin: 5px 0;"><strong>Closure Reason:</strong> ${reason}</p>
                    <p style="margin: 5px 0;"><strong>Status:</strong> Completed</p>
                </div>
                <p>Your investment has successfully matured. You can now view your final earnings in your dashboard or start a new investment cycle.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" style="background-color: #004225; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Go to Dashboard</a>
                </div>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #7f8c8d; text-align: center;">This is an automated notification. Please do not reply.</p>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Staking Cap Notification sent to:', email);
    } catch (error) {
        console.error('Error sending staking cap notification:', error);
    }
};

const sendAdminCronFailureEmail = async (jobName, error) => {
    const transporter = getTransporter();
    const adminEmail = process.env.ADMIN_EMAIL || "mujigujjar125@gmail.com";

    const mailOptions = {
        from: process.env.EMAIL_FROM || '"Swamp Deer System" <no-reply@unboundedwealth.com>',
        to: adminEmail,
        subject: `CRITICAL: Cron Job Failed - ${jobName}`,
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #fee2e2; border-radius: 10px; background-color: #fffafb;">
                <h2 style="color: #991b1b; text-align: center;">System Alert: Cron Failure</h2>
                <p>Hello Admin,</p>
                <p>The system has detected a critical failure in a scheduled task after multiple retries.</p>
                <div style="background-color: #fef2f2; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #991b1b;">
                    <p style="margin: 5px 0;"><strong>Job Name:</strong> ${jobName}</p>
                    <p style="margin: 5px 0;"><strong>Error:</strong> ${error}</p>
                    <p style="margin: 5px 0;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                </div>
                <p style="color: #7f1d1d; font-weight: bold;">Action Required: Please investigate the logs to identify the root cause.</p>
                <hr style="border: none; border-top: 1px solid #fee2e2; margin: 20px 0;">
                <p style="font-size: 12px; color: #7f8c8d; text-align: center;">This is a high-priority system notification.</p>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Admin Failure Notification sent to:', adminEmail);
    } catch (err) {
        console.error('Error sending admin failure notification:', err);
    }
};

module.exports = { sendCredentials, sendResetPasswordEmail, sendVerificationEmail, sendStakingCapReachedEmail, sendAdminCronFailureEmail };
