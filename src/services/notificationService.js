const emailQueue = require('../queues/emailQueue');
const userRepository = require('../repositories/userRepository');
const projectRepository = require('../repositories/projectRepository');

class NotificationService {
    async notifyAssignee(taskId, taskTitle, assignedToId, performedById) {
        if (!assignedToId) return;

        try {
            const user = await userRepository.findById(assignedToId);
            if (!user) {
                console.warn(`[Notification] Assignee ${assignedToId} not found, skipping email.`);
                return;
            }

            let performedByName = 'System';
            let performedByEmail = 'System';
            if (performedById) {
                const user = await userRepository.findById(performedById);
                if (user){
                    performedByName = user.name;
                    performedByEmail = user.email;
                }
            }

            console.log(`[Notification] Adding 'TASK_ASSIGNED' job for ${user.email}...`);
            await emailQueue.add({
                type: 'TASK_ASSIGNED',
                email: user.email,
                taskTitle: taskTitle,
                taskId: taskId,
                performedByName: performedByName,
                performedByEmail: performedByEmail // Send Name instead of ID
            });
            console.log(`[Notification] Queued assignment email for ${user.email}`);
        } catch (error) {
            console.error('[Notification] Error queuing assignment email:', error);
            // Non-blocking: we don't want to fail the task creation if notification fails
        }
    }

    async notifyManagers(taskId, taskTitle, projectId, performedById) {
        try {
            const project = await projectRepository.findById(projectId);
            if (!project) return;

            // Fetch managers assigned to this project
            // We use projectMemberRepository to check membership, filtering by role 'manager'
            const projectManagers = await require('../repositories/projectMemberRepository').findMembersByProject(projectId, {
                roles: ['manager']
            });
            
            const recipients = projectManagers;
            
            let performedByName = 'System';
            let performedByEmail = 'System';
            if (performedById) {
                const user = await userRepository.findById(performedById);
                if (user){
                    performedByName = user.name;
                    performedByEmail = user.email;
                }
            }
            
            // Queue jobs (one per recipient)
            const jobs = recipients.map(user => ({
                data: {
                    type: 'TASK_COMPLETED',
                    email: user.email,
                    taskTitle: taskTitle,
                    taskId: taskId,
                    performedByName: performedByName,
                    performedByEmail: performedByEmail
                }
            }));

            // Bull addBulk is more efficient
            console.log(`[Notification] Adding bulk 'TASK_COMPLETED' jobs for ${jobs.length} recipients...`);
            await emailQueue.addBulk(jobs);
            console.log(`[Notification] Queued completion emails for ${jobs.length} managers`);

        } catch (error) {
            console.error('[Notification] Error queuing completion emails:', error);
        }
    }
}

module.exports = new NotificationService();
