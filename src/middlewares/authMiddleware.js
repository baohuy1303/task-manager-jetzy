const jwt = require('jsonwebtoken');

const userRepository = require('../repositories/userRepository');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Access token missing or invalid' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await userRepository.findById(decoded.id);
    if (!user || !user.is_active) {
        return res.status(401).json({ success: false, error: 'User not found or deactivated' });
    }
    req.user = user;
    
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Not authorized to access this resource' });
    }
    next();
  };
};

const requireOrganization = (req, res, next) => {
    if (!req.user || !req.user.organization_id) {
        return res.status(403).json({ 
            success: false, 
            error: 'Organization required.', 
            message: 'You must create or join an organization to access this resource.' 
        });
    }
    next();
};

const organizationRepository = require('../repositories/organizationRepository');

const validateOrganizationStatus = async (req, res, next) => {
    // Skip if no user or no organization (e.g. org-less admin)
    if (!req.user || !req.user.organization_id) {
        return next();
    }

    try {
        const org = await organizationRepository.findById(req.user.organization_id);
        
        if (!org) {
             return res.status(404).json({ success: false, error: 'Organization not found' });
        }

        if (org.status === 'suspended') {
            // Admins are allowed to bypass suspension logic (to manage/unsuspend)
            if (req.user.role === 'admin') {
                return next();
            }
            return res.status(403).json({ 
                success: false, 
                error: 'Organization is suspended',
                message: 'Your organization has been suspended. Please contact your administrator.' 
            });
        }
        next();
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

module.exports = { authenticate, authorize, requireOrganization, validateOrganizationStatus };
