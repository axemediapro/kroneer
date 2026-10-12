const prisma = require('../config/prisma');
const ActivityService = require('../services/activityService');

class ProformaController {
  static async getIndex(req, res) {
    try {
      const { search, status } = req.query;
      const where = {};

      if (status) where.status = status;
      if (search) {
        where.OR = [
          { number: { contains: search } },
          { customer: { companyName: { contains: search } } }
        ];
      }

      const proformas = await prisma.proforma.findMany({
        where,
        include: {
          customer: true,
          items: true,
          contract: true
        },
        orderBy: { createdAt: 'desc' }
      });

      res.render('profaturat/index', {
        pageTitle: 'Profaturat - KRONEER',
        proformas,
        filters: { search: search || '', status: status || '' }
      });
    } catch (err) {
      console.error('Gabim në ngarkimin e profaturave:', err);
      req.flash('error', 'Nuk u arrit të ngarkohen profaturat.');
      res.redirect('/paneli');
    }
  }

  static async getDetail(req, res) {
    try {
      const id = parseInt(req.params.id);
      const proforma = await prisma.proforma.findUnique({
        where: { id },
        include: {
          customer: true,
          contract: { include: { elevator: true } },
          quotation: true,
          items: { orderBy: { id: 'asc' } }
        }
      });

      if (!proforma) {
        req.flash('error', 'Profatura nuk u gjet.');
        return res.redirect('/profaturat');
      }

      // Llogarit progresin e pagesave
      const totalPaidMilestones = proforma.items.filter(it => it.isPaid).reduce((s, it) => s + it.amount, 0);
      const progressPercent = proforma.totalAmount > 0 ? Math.round((totalPaidMilestones / proforma.totalAmount) * 100) : 0;

      res.render('profaturat/detajet', {
        pageTitle: `Profatura ${proforma.number} - KRONEER`,
        proforma,
        totalPaidMilestones,
        progressPercent
      });
    } catch (err) {
      console.error(err);
      res.redirect('/profaturat');
    }
  }

  static async postToggleMilestone(req, res) {
    try {
      const proformaId = parseInt(req.params.id);
      const itemId = parseInt(req.body.itemId);

      const item = await prisma.proformaItem.findUnique({ where: { id: itemId } });
      if (!item) {
        req.flash('error', 'Etapa e pagesës nuk u gjet.');
        return res.redirect(`/profaturat/${proformaId}`);
      }

      const newIsPaid = !item.isPaid;
      await prisma.proformaItem.update({
        where: { id: itemId },
        data: {
          isPaid: newIsPaid,
          paidAt: newIsPaid ? new Date() : null
        }
      });

      // Përditëso gjendjen e profaturës
      const allItems = await prisma.proformaItem.findMany({ where: { proformaId } });
      const paidSum = allItems.filter(i => i.isPaid).reduce((s, i) => s + i.amount, 0);
      const allPaid = allItems.every(i => i.isPaid);

      const newStatus = allPaid ? 'Paguar' : (paidSum > 0 ? 'Pjesërisht e paguar' : 'Në Pritje');

      const updatedProforma = await prisma.proforma.update({
        where: { id: proformaId },
        data: {
          paidAmount: paidSum,
          status: newStatus
        }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: newIsPaid ? 'Paguar' : 'Ndryshuar',
        entityType: 'Profaturë',
        entityId: proformaId,
        description: `Etapa "${item.description}" (${item.amount.toLocaleString('de-DE')} €) u shënua si ${newIsPaid ? 'e paguar' : 'e papaguar'} në profaturën ${updatedProforma.number}.`
      });

      req.flash('success', `Etapa e pagesës u përditësua në "${newIsPaid ? 'Paguar' : 'Në Pritje'}".`);
      res.redirect(`/profaturat/${proformaId}`);
    } catch (err) {
      console.error(err);
      req.flash('error', 'Ndodhi një gabim gjatë përditësimit.');
      res.redirect(`/profaturat/${req.params.id}`);
    }
  }

  static async getPrint(req, res) {
    try {
      const id = parseInt(req.params.id);
      const proforma = await prisma.proforma.findUnique({
        where: { id },
        include: {
          customer: true,
          items: { orderBy: { id: 'asc' } }
        }
      });

      if (!proforma) {
        return res.status(404).send('Profatura nuk u gjet.');
      }

      res.render('profaturat/print', {
        pageTitle: `Profatura_${proforma.number}`,
        proforma,
        layout: 'layouts/print'
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Gabim gjatë hapjes së formatit të printimit.');
    }
  }

  static async getExportList(req, res) {
    try {
      const { customerId, status, search } = req.query;
      const where = {};

      if (status) where.status = status;
      if (customerId) where.customerId = parseInt(customerId);
      if (search) {
        where.OR = [
          { number: { contains: search } },
          { customer: { companyName: { contains: search } } }
        ];
      }

      const proformas = await prisma.proforma.findMany({
        where,
        include: {
          customer: true,
          items: true
        },
        orderBy: { date: 'desc' }
      });

      let customer = null;
      if (customerId) {
        customer = await prisma.customer.findUnique({ where: { id: parseInt(customerId) } });
      }

      const totalAmount = proformas.reduce((s, p) => s + (p.totalAmount || 0), 0);
      const totalPaid = proformas.reduce((s, p) => s + (p.paidAmount || 0), 0);

      res.render('profaturat/print-list', {
        pageTitle: customer ? `Profaturat_${customer.companyName.replace(/[^a-zA-Z0-9]/g, '_')}` : 'Raporti_i_Profaturave',
        proformas,
        customer,
        totalAmount,
        totalPaid,
        layout: 'layouts/print'
      });
    } catch (err) {
      console.error('Gabim në eksportimin e listës së profaturave:', err);
      res.status(500).send('Gabim në gjenerimin e raportit.');
    }
  }

  static async getEdit(req, res) {
    try {
      const id = parseInt(req.params.id);
      const proforma = await prisma.proforma.findUnique({
        where: { id },
        include: {
          customer: true,
          contract: true,
          quotation: true,
          items: { orderBy: { id: 'asc' } }
        }
      });

      if (!proforma) {
        req.flash('error', 'Profatura nuk u gjet.');
        return res.redirect('/profaturat');
      }

      const customers = await prisma.customer.findMany({ orderBy: { companyName: 'asc' } });
      const statuses = ['Në Pritje', 'Pjesërisht e paguar', 'Paguar', 'Anuluar'];

      res.render('profaturat/ndrysho', {
        pageTitle: `Ndrysho Profaturën ${proforma.number} - KRONEER`,
        proforma,
        customers,
        statuses
      });
    } catch (err) {
      console.error('Gabim gjatë ngarkimit të formës së editimit të profaturës:', err);
      req.flash('error', 'Nuk u arrit të hapet forma e editimit.');
      res.redirect('/profaturat');
    }
  }

  static async postEdit(req, res) {
    try {
      const id = parseInt(req.params.id);
      const { customerId, date, dueDate, status, notes, items } = req.body;

      const proforma = await prisma.proforma.findUnique({ where: { id } });
      if (!proforma) {
        req.flash('error', 'Profatura nuk u gjet.');
        return res.redirect('/profaturat');
      }

      let parsedItems = [];
      if (typeof items === 'string') {
        try { parsedItems = JSON.parse(items); } catch (e) { parsedItems = []; }
      } else if (Array.isArray(items)) {
        parsedItems = items;
      }

      let totalAmount = 0;
      let paidAmount = 0;

      parsedItems.forEach(it => {
        const amt = parseFloat(it.amount) || 0;
        totalAmount += amt;
        if (it.isPaid) {
          paidAmount += amt;
        }
      });

      const subtotal = Math.round((totalAmount / 1.18) * 100) / 100;
      const vatAmount = Math.round((totalAmount - subtotal) * 100) / 100;

      await prisma.$transaction([
        prisma.proformaItem.deleteMany({ where: { proformaId: id } }),
        prisma.proforma.update({
          where: { id },
          data: {
            customerId: parseInt(customerId),
            date: date ? new Date(date) : proforma.date,
            dueDate: dueDate ? new Date(dueDate) : proforma.dueDate,
            subtotal,
            vatAmount,
            totalAmount,
            paidAmount,
            status: status || proforma.status,
            notes: notes || ''
          }
        })
      ]);

      if (parsedItems.length > 0) {
        for (const it of parsedItems) {
          await prisma.proformaItem.create({
            data: {
              proformaId: id,
              percentage: parseFloat(it.percentage) || 0,
              description: it.description || 'Etapë Pagese',
              amount: parseFloat(it.amount) || 0,
              isPaid: !!it.isPaid,
              paidAt: it.isPaid ? new Date() : null
            }
          });
        }
      }

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Ndryshuar',
        entityType: 'Profaturë',
        entityId: id,
        description: `Profatura ${proforma.number} u modifikua. Vlera totale: ${totalAmount.toLocaleString('de-DE')} €.`
      });

      req.flash('success', `Profatura ${proforma.number} u përditësua me sukses.`);
      res.redirect(`/profaturat/${id}`);
    } catch (err) {
      console.error('Gabim në ruajtjen e profaturës:', err);
      req.flash('error', 'Ndodhi një gabim gjatë ruajtjes së ndryshimeve.');
      res.redirect(`/profaturat/${req.params.id}/ndrysho`);
    }
  }

  static async postDelete(req, res) {
    try {
      const id = parseInt(req.params.id);
      const proforma = await prisma.proforma.findUnique({ where: { id } });

      if (!proforma) {
        req.flash('error', 'Profatura nuk u gjet.');
        return res.redirect('/profaturat');
      }

      await prisma.proforma.delete({ where: { id } });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Fshirë',
        entityType: 'Profaturë',
        entityId: id,
        description: `Profatura ${proforma.number} u fshi nga sistemi.`
      });

      req.flash('success', `Profatura ${proforma.number} u fshi me sukses.`);
      res.redirect('/profaturat');
    } catch (err) {
      console.error('Gabim gjatë fshirjes së profaturës:', err);
      req.flash('error', 'Profatura nuk mund të fshihet.');
      res.redirect('/profaturat');
    }
  }
}

module.exports = ProformaController;
