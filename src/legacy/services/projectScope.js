function ownedProjectsWhere(user) {
  if (!user) return { id: -1 };

  if (user.role === 'MENAXHER_PROJEKTI') {
    return {
      OR: [
        { projectManagerId: user.id },
        { teamMembers: { some: { employee: { userId: user.id } } } }
      ]
    };
  }

  if (user.role === 'TEKNIK') {
    return {
      teamMembers: { some: { employee: { userId: user.id } } }
    };
  }

  return {};
}

function canAccessProject(user, project) {
  if (!user || !project) return false;
  if (user.role === 'ADMINISTRATOR') return true;
  if (user.role === 'MENAXHER_PROJEKTI') {
    const isManager = project.projectManagerId === user.id;
    const isMember = Array.isArray(project.teamMembers)
      && project.teamMembers.some((m) => m.employee && m.employee.userId === user.id);
    return isManager || isMember;
  }
  if (user.role === 'TEKNIK') {
    return Array.isArray(project.teamMembers)
      && project.teamMembers.some((m) => m.employee && m.employee.userId === user.id);
  }
  return true;
}

module.exports = {
  ownedProjectsWhere,
  canAccessProject
};
