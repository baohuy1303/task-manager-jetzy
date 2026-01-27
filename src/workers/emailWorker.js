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
        await transporter.sendMail({
            to,
            subject,
            html: body
        }).then(() => {
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

        case 'USER_DEACTIVATED':
          const taskList = job.data.tasks && job.data.tasks.length > 0 
              ? job.data.tasks.map(t => `<li><strong>${t.title}</strong> (ID: ${t.id})</li>`).join('')
              : '<li>No pending tasks unassigned.</li>';
          
          let projectsSection = '';
          if (job.data.associatedProjects && job.data.associatedProjects.length > 0) {
              const projList = job.data.associatedProjects.map(p => `<li>${p}</li>`).join('');
              projectsSection = `
                <p>The user was working on the following projects:</p>
                <ul>${projList}</ul>
              `;
          }

          const roleLabel = job.data.deactivatedUserRole ? ` (${job.data.deactivatedUserRole})` : '';

          subject = `Action Required: User Deactivated${roleLabel}`;
          htmlBody = `
            <div style="${baseStyles}">
              <div style="${headerStyles} background-color: #d9534f;">
                <h1 style="margin:0;">User Deactivated</h1>
              </div>
              <div style="${contentStyles}">
                <p>Hello ${job.data.managerName},</p>
                <p>User <strong>${job.data.deactivatedUserName}</strong>${roleLabel} has been deactivated.</p>
                
                ${projectsSection}

                <p>The following tasks are now <strong>Unassigned</strong> and require attention:</p>
                <ul>
                  ${taskList}
                </ul>
                <p>Please review and reassign immediately.</p>
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
        process.env.TEST_EMAIL, // Override for testing
        subject,
        htmlBody
      );

    } catch (error) {
      console.error(`Error processing email job ${job.id}:`, error);

      // Log failure to Audit Logs (Background/Async)
      try {
        const auditLogRepository = require('../repositories/auditLogRepository');
        await auditLogRepository.create({
            organization_id: job.data.organization_id || null,
            entity_type: 'notification',
            entity_id: job.id.toString().includes(':') ? null : job.id, // Bull IDs can be complex
            action: 'notification_failure',
            performed_by: null, // System action
            metadata: {
                type,
                error: error.message,
                to: email || job.data.email,
                request_id: job.data.request_id // Extract correlation ID from job data
            }
        });
      } catch (auditError) {
        console.error('Failed to log notification failure to audit logs:', auditError);
      }

      throw error; // Trigger retry
    }
  });
  
  console.log('📨 Email Worker started');
};

module.exports = processEmailJobs;
