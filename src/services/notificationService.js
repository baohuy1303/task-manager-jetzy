
const projectMemberRepository = require('../repositories/projectMemberRepository');
const userRepository = require('../repositories/userRepository');
const emailQueue = require('../queues/emailQueue');

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

            console.log(`[Notification] Adding 'TASK_ASSIGNED' job for ${user.email}...`);
            await emailQueue.add({
                type: 'TASK_ASSIGNED',
                email: user.email,
                organization_id: user.organization_id, // For auditing
                request_id: correlationId, // For correlation
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

    async notifyManagers(taskId, taskTitle, projectId, performedById, correlationId) {
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
            const jobs = recipients.map(recipient => ({
                data: {
                    type: 'TASK_COMPLETED',
                    email: recipient.email,
                    organization_id: project.organization_id, // For auditing
                    request_id: correlationId, // For correlation
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

    async notifyDeactivation(deactivatedUser, unassignedTasks, performedById, correlationId) {
        console.log(`[Notification] notifyDeactivation called for ${deactivatedUser?.email} (${deactivatedUser?.role})`);
        if (!deactivatedUser) {
            console.log('[Notification] Aborting: No deactivatedUser provided.');
            return;
        }

        try {
            const role = deactivatedUser.role;

            // --- CASE A: Manager or Admin Deactivated ---
            if (role === 'manager' || role === 'admin') {
                console.log(`[Notification] Handling Manager/Admin deactivation logic.`);
                // 1. Fetch All Admins
                let admins = await userRepository.findAdminsByOrganization(deactivatedUser.organization_id);
                console.log(`[Notification] Found ${admins.length} admins in org.`);
                
                // If the deactivated user is an admin, remove them from the notification list
                if (role === 'admin') {
                    admins = admins.filter(u => u.id !== deactivatedUser.id);
                }

                if (admins.length === 0) {
                    console.log('[Notification] No other admins to notify.');
                    return;
                }

                // 2. Fetch Projects they were involved with
                const projects = await projectMemberRepository.findProjectsByUser(deactivatedUser.id);
                const projectNames = projects ? projects.map(p => p.name) : [];

                if (projectNames.length > 0) {
                    console.log(`[Notification] Found ${projectNames.length} associated projects: ${projectNames.join(', ')}`);
                } else {
                    console.log('[Notification] No associated projects found.');
                }

                // 3. Queue Email for each Admin
                const jobs = admins.map(admin => ({
                    data: {
                        type: 'USER_DEACTIVATED',
                        email: admin.email,
                        organization_id: admin.organization_id, // For auditing
                        request_id: correlationId, // For correlation
                        managerName: admin.name, // "Manager Name" implies recipient name in email template
                        deactivatedUserName: deactivatedUser.name,
                        deactivatedUserRole: role,
                        associatedProjects: projectNames,
                        tasks: unassignedTasks || [], 
                        performedBy: performedById
                    }
                }));

                if (jobs.length > 0) {
                    console.log(`[Notification] Queuing ${jobs.length} admin alerts for ${role} deactivation...`);
                    await emailQueue.addBulk(jobs);
                    console.log('[Notification] Jobs added to queue.');
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
                                organization_id: deactivatedUser.organization_id, // For auditing
                                request_id: correlationId, // For correlation
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
                    console.log(`[Notification] Queuing ${jobs.length} manager alerts for member deactivation...`);
                    await emailQueue.addBulk(jobs);
                }
            }

        } catch (error) {
            console.error('[Notification] Error queuing deactivation emails:', error);
        }
    }
}

module.exports = new NotificationService();
