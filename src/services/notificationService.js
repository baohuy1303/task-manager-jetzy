
const projectMemberRepository = require('../repositories/projectMemberRepository');
const userRepository = require('../repositories/userRepository');
const emailQueue = require('../queues/emailQueue');
const projectRepository = require('../repositories/projectRepository');
class NotificationService {
    async notifyAssignee(taskId, taskTitle, assignedToId, performedById, correlationId) {
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

            await emailQueue.add({
                type: 'TASK_ASSIGNED',
                email: user.email,
                organization_id: user.organization_id,
                request_id: correlationId,
                taskTitle: taskTitle,
                taskId: taskId,
                performedByName: performedByName,
                performedByEmail: performedByEmail
            });
        } catch (error) {
            console.error('[Notification] Error queuing assignment email:', error);
            // Non-blocking: we don't want to fail the task creation if notification fails
        }
    }

    async notifyManagers(taskId, taskTitle, projectId, performedById, correlationId) {
        try {
            const project = await projectRepository.findById(projectId);
            if (!project) return;

            // Fetch managers assigned to this project
            const projectManagers = await projectMemberRepository.findMembersByProject(projectId, {
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
            const jobs = recipients.map(recipient => ({
                data: {
                    type: 'TASK_COMPLETED',
                    email: recipient.email,
                    organization_id: project.organization_id,
                    request_id: correlationId,
                    taskTitle: taskTitle,
                    taskId: taskId,
                    performedByName: performedByName,
                    performedByEmail: performedByEmail
                }
            }));

            // Bull addBulk is more efficient
            await emailQueue.addBulk(jobs);

        } catch (error) {
            console.error('[Notification] Error queuing completion emails:', error);
        }
    }

    async notifyDeactivation(deactivatedUser, unassignedTasks, performedById, correlationId) {
        if (!deactivatedUser) {
            return;
        }

        try {
            const role = deactivatedUser.role;

            // --- CASE A: Manager or Admin Deactivated ---
            if (role === 'manager' || role === 'admin') {
                // 1. Fetch All Admins
                let admins = await userRepository.findAdminsByOrganization(deactivatedUser.organization_id);
                
                // If the deactivated user is an admin, remove them from the notification list
                if (role === 'admin') {
                    admins = admins.filter(u => u.id !== deactivatedUser.id);
                }

                if (admins.length === 0) {
                    return;
                }

                // 2. Fetch Projects they were involved with
                const projects = await projectMemberRepository.findProjectsByUser(deactivatedUser.id);
                const projectNames = projects ? projects.map(p => p.name) : [];

                // 3. Queue Email for each Admin
                const jobs = admins.map(admin => ({
                    data: {
                        type: 'USER_DEACTIVATED',
                        email: admin.email,
                        organization_id: admin.organization_id,
                        request_id: correlationId,
                        managerName: admin.name, // Recipient Name
                        deactivatedUserName: deactivatedUser.name,
                        deactivatedUserRole: role,
                        associatedProjects: projectNames,
                        tasks: unassignedTasks || [], 
                        performedBy: performedById
                    }
                }));

                if (jobs.length > 0) {
                    await emailQueue.addBulk(jobs);
                }
                return;
            } // --- CASE B: Member Deactivated (Existing Logic) ---
            else if (unassignedTasks && unassignedTasks.length > 0) {
                // 1. Group tasks by Project
                const projectTasksMap = {}; 
                unassignedTasks.forEach(task => {
                    if (!projectTasksMap[task.project_id]) {
                        projectTasksMap[task.project_id] = [];
                    }
                    projectTasksMap[task.project_id].push(task);
                });

                const projectIds = Object.keys(projectTasksMap);
                if (projectIds.length === 0) return;

                // 2. Fetch Managers
                const managers = await projectMemberRepository.findManagersByProjectIds(projectIds);

                // 3. Queue Emails
                const jobs = [];
                for (const manager of managers) {
                    const projectId = manager.project_id;
                    const tasksForProject = projectTasksMap[projectId];
                    
                    if (tasksForProject && tasksForProject.length > 0) {
                        jobs.push({
                            data: {
                                type: 'USER_DEACTIVATED',
                                email: manager.email,
                                organization_id: deactivatedUser.organization_id,
                                request_id: correlationId,
                                managerName: manager.name,
                                deactivatedUserName: deactivatedUser.name,
                                deactivatedUserRole: role,
                                tasks: tasksForProject.map(t => ({ id: t.id, title: t.title })),
                                projectName: `Project ID ${projectId}`, 
                                performedBy: performedById
                            }
                        });
                    }
                }

                if (jobs.length > 0) {
                    await emailQueue.addBulk(jobs);
                }
            }

        } catch (error) {
            console.error('[Notification] Error queuing deactivation emails:', error);
        }
    }
}

module.exports = new NotificationService();
