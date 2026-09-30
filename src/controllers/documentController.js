const prisma = require('../config/prisma');
const ActivityService = require('../services/activityService');
const { ownedProjectsWhere } = require('../services/projectScope');

class DocumentController {
  static async getIndex(req, res) {
    try {
      const { type, search } = req.query;
      const user = req.session.user;
      const where = {};
      const andFilters = [];

      if (user && (user.role === 'TEKNIK' || user.role === 'MENAXHER_PROJEKTI')) {
        const scope = ownedProjectsWhere(user);
        andFilters.push({
          OR: [
            { projectId: null },
            { project: scope }
          ]
        });
      }

      if (type) andFilters.push({ documentType: type });
      if (search) {
        andFilters.push({
          OR: [
            { title: { contains: search } },
            { customer: { companyName: { contains: search } } },
            { project: { name: { contains: search } } }
          ]
        });
      }

      if (andFilters.length === 1) Object.assign(where, andFilters[0]);
      else if (andFilters.length > 1) where.AND = andFilters;

      const documents = await prisma.document.findMany({
        where,
        include: {
          customer: true,
          project: true,
          quotation: true,
          contract: true,
          invoice: true
        },
        orderBy: { createdAt: 'desc' }
      });

      const types = [
        'Oferta',
        'Kontrata',
        'Fatura',
        'Certifikata',
        'Vizatime teknike',
        'Garancia',
        'Inspektimi',
        'Dorëzimi',
        'Mirëmbajtja'
      ];

      res.render('dokumentet/index', {
        pageTitle: 'Qendra e Dokumenteve - KRONEER',
        documents,
        types,
        canManage: user && ['ADMINISTRATOR', 'SHITJE', 'FINANCE'].includes(user.role),
        filters: { type: type || '', search: search || '' }
      });
    } catch (err) {
      console.error(err);
      req.flash('error', 'Nuk u arrit të ngarkohen dokumentet.');
      res.redirect('/paneli');
    }
  }

  static async getCreate(req, res) {
    try {
      const customers = await prisma.customer.findMany({ orderBy: { companyName: 'asc' } });
      const projects = await prisma.project.findMany({ orderBy: { name: 'asc' } });
      const types = [
        'Oferta',
        'Kontrata',
        'Fatura',
        'Certifikata',
        'Vizatime teknike',
        'Garancia',
        'Inspektimi',
        'Dorëzimi',
        'Mirëmbajtja'
      ];

      res.render('dokumentet/krijo', {
        pageTitle: 'Ngarko / Regjistro Dokument - KRONEER',
        customers,
        projects,
        types
      });
    } catch (err) {
      console.error(err);
      res.redirect('/dokumentet');
    }
  }

  static async postCreate(req, res) {
    try {
      const { title, documentType, fileUrl, customerId, projectId, fileSize } = req.body;

      const doc = await prisma.document.create({
        data: {
          title: title.trim(),
          documentType: documentType || 'Dokument',
          fileUrl: fileUrl ? fileUrl.trim() : '#',
          fileType: 'PDF',
          fileSize: fileSize || '1.8 MB',
          customerId: customerId ? parseInt(customerId) : null,
          projectId: projectId ? parseInt(projectId) : null
        }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Krijuar',
        entityType: 'Dokument',
        entityId: doc.id,
        description: `U shtua dokumenti i ri "${doc.title}" [${doc.documentType}].`
      });

      req.flash('success', `Dokumenti "${doc.title}" u regjistrua me sukses.`);
      res.redirect('/dokumentet');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Nuk u ruajt dokumenti.');
      res.redirect('/dokumentet/krijo');
    }
  }
}

module.exports = DocumentController;
