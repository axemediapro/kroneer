function canAssignBonus(user) {
  const role = user && user.role;
  return role === 'ADMINISTRATOR' || role === 'MENAXHER' || role === 'MENAXHER_PROJEKTI';
}

function isFieldStaff(user) {
  const role = user && user.role;
  return role === 'TEKNIK' || role === 'MENAXHER_PROJEKTI';
}

function denyFieldFromCrm(req, res, next) {
  if (isFieldStaff(req.session && req.session.user)) {
    req.flash('error', 'Nuk keni qasje te klientët, faturat dhe shitjet. Ky seksion është për zyrën.');
    return res.redirect('/paneli');
  }
  return next();
}

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

    // Menaxheri i përgjithshëm mund të përdorë modulet, por jo veprimet vetëm për administratorin.
    if (userRole === 'MENAXHER' && !allowedRoles.every((role) => role === 'ADMINISTRATOR')) {
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
  authorizeRoles,
  canAssignBonus,
  isFieldStaff,
  denyFieldFromCrm
};
