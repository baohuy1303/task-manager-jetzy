const emailQueue = require('../queues/emailQueue');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASSWORD
    }
});

// Mock email sender
const sendEmail = async (to, subject, body) => {
    try {
        console.log(`📧 [EMAIL SENDING] TO: ${to}\n SUBJECT: ${subject}\n -----------------------`);
        await transporter.sendMail({
            to,
            subject,
            html: body
        }).then(() => {
            console.log(`📧 [EMAIL SENT] TO: ${to}\n SUBJECT: ${subject}\n -----------------------`);
        });
    } catch (error) {
        console.error(`Error sending email to ${to}:`, error);
        throw error;
    }
};

const processEmailJobs = () => {
  emailQueue.process(5, async (job) => {
    const { type, email, taskTitle, performedByName, performedByEmail } = job.data;

    try {
      let subject = '';
      let htmlBody = '';

      const baseStyles = `
        font-family: Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 600px;
        margin: 0 auto;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        overflow: hidden;
      `;
      const headerStyles = `
        background-color: #4CAF50;
        color: white;
        padding: 20px;
        text-align: center;
      `;
      const contentStyles = `
        padding: 20px;
      `;
      const footerStyles = `
        background-color: #f9f9f9;
        padding: 10px;
        text-align: center;
        font-size: 12px;
        color: #888;
      `;

      switch (type) {
        case 'TASK_ASSIGNED':
          subject = `Task Assignment: ${taskTitle}`;
          htmlBody = `
            <div style="${baseStyles}">
              <div style="${headerStyles}">
                <h1 style="margin:0;">New Task Assigned</h1>
              </div>
              <div style="${contentStyles}">
                <p>Hello,</p>
                <p>You have been assigned to the task <strong>${taskTitle}</strong>.</p>
                <p>Assigned by: <strong>${performedByName} (${performedByEmail})</strong></p>
                <p>Please log in to your dashboard to view details.</p>
              </div>
              <div style="${footerStyles}">
                Task Manager System
              </div>
            </div>
          `;
          break;

        case 'TASK_COMPLETED':
          subject = `Task Completed: ${taskTitle}`;
          htmlBody = `
            <div style="${baseStyles}">
              <div style="${headerStyles}">
                <h1 style="margin:0;">Task Completed</h1>
              </div>
              <div style="${contentStyles}">
                <p>Hello Manager,</p>
                <p>The task <strong>${taskTitle}</strong> has been marked as <span style="color:green;font-weight:bold;">DONE</span>.</p>
                <p>Completed by: <strong>${performedByName} (${performedByEmail})</strong></p>
              </div>
              <div style="${footerStyles}">
                Task Manager System
              </div>
            </div>
          `;
          break;

        default:
          console.warn(`Unknown job type: ${type}`);
          return;
      }

      await sendEmail(
        'huynhbaohuy130333@gmail.com', // Override for testing as per user setup
        subject,
        htmlBody
      );

    } catch (error) {
      console.error(`Error processing email job ${job.id}:`, error);
      throw error; // Trigger retry
    }
  });
  
  console.log('📨 Email Worker started');
};

module.exports = processEmailJobs;
