function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      req.flash('error', 'Ju lutem kyçuni për të vazhduar.');
      return res.redirect('/kycu');
    }

    const userRole = req.session.user.role;

    // Administratori ka qasje të plotë kudo
    if (userRole === 'ADMINISTRATOR') {
      return next();
    }

    if (allowedRoles.includes(userRole)) {
      return next();
    }

    req.flash('error', 'Nuk keni autorizim për të hyrë në këtë seksion të sistemit.');
    return res.redirect('/paneli');
  };
}

module.exports = {
  authorizeRoles
};
