const prisma = require('../config/prisma');
const NumberService = require('../services/numberService');
const ActivityService = require('../services/activityService');

const EXPENSE_CATEGORIES = [
  'Materiale & Pjesë',
  'Rroga & Mëditje',
  'Transport & Karburant',
  'Nënkontraktorë',
  'Vegla & Pajisje',
  'Qira & Shërbime',
  'Të tjera'
];

const EXPENSE_STATUSES = ['Paguar', 'Në pritje', 'Refuzuar'];

class ExpenseController {
  static async getIndex(req, res) {
    try {
      const { category, status, search, projectId } = req.query;
      const where = {};

      if (category) where.category = category;
      if (status) where.status = status;
      if (projectId) where.projectId = parseInt(projectId);
      if (search) {
        where.OR = [
          { number: { contains: search } },
          { title: { contains: search } },
          { supplier: { contains: search } },
          { referenceNumber: { contains: search } },
          { notes: { contains: search } }
        ];
      }

      const expenses = await prisma.expense.findMany({
        where,
        include: {
          project: true,
          user: true
        },
        orderBy: { date: 'desc' }
      });

      // Statistika & KPI
      const allExpenses = await prisma.expense.findMany();
      const totalExpenses = allExpenses.reduce((s, e) => s + (e.amount || 0), 0);
      const paidExpenses = allExpenses.filter(e => e.status === 'Paguar').reduce((s, e) => s + (e.amount || 0), 0);
      const pendingExpenses = allExpenses.filter(e => e.status === 'Në pritje').reduce((s, e) => s + (e.amount || 0), 0);

      // Shpenzimet e këtij muaji
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthlyExpenses = allExpenses
        .filter(e => new Date(e.date) >= firstDayOfMonth)
        .reduce((s, e) => s + (e.amount || 0), 0);

      // Shpërndarja sipas kategorive
      const categoryBreakdown = {};
      EXPENSE_CATEGORIES.forEach(cat => { categoryBreakdown[cat] = 0; });
      allExpenses.forEach(e => {
        if (categoryBreakdown[e.category] !== undefined) {
          categoryBreakdown[e.category] += e.amount || 0;
        } else {
          categoryBreakdown['Të tjera'] += e.amount || 0;
        }
      });

      const projects = await prisma.project.findMany({ orderBy: { name: 'asc' } });

      res.render('shpenzimet/index', {
        pageTitle: 'Shpenzimet Operative - KRONEER',
        expenses,
        categories: EXPENSE_CATEGORIES,
        statuses: EXPENSE_STATUSES,
        projects,
        totalExpenses,
        paidExpenses,
        pendingExpenses,
        monthlyExpenses,
        categoryBreakdown,
        filters: { category: category || '', status: status || '', search: search || '', projectId: projectId || '' }
      });
    } catch (err) {
      console.error('Gabim në ngarkimin e shpenzimeve:', err);
      req.flash('error', 'Nuk u arrit të ngarkohen shpenzimet.');
      res.redirect('/paneli');
    }
  }

  static async getCreate(req, res) {
    try {
      const nextNumber = await NumberService.getNextNumber('expense');
      const projects = await prisma.project.findMany({ orderBy: { name: 'asc' } });
      const users = await prisma.user.findMany({ where: { isActive: true } });

      res.render('shpenzimet/krijo', {
        pageTitle: 'Regjistro Shpenzim të Ri - KRONEER',
        nextNumber,
        categories: EXPENSE_CATEGORIES,
        statuses: EXPENSE_STATUSES,
        projects,
        users
      });
    } catch (err) {
      console.error(err);
      res.redirect('/shpenzimet');
    }
  }

  static async postCreate(req, res) {
    try {
      const {
        title, category, amount, currency, date, paymentMethod,
        supplier, referenceNumber, status, notes, projectId
      } = req.body;

      const number = await NumberService.getNextNumber('expense');

      const expense = await prisma.expense.create({
        data: {
          number,
          title: title ? title.trim() : 'Shpenzim Operativ',
          category: category || 'Të tjera',
          amount: parseFloat(amount) || 0,
          currency: currency || 'EUR',
          date: date ? new Date(date) : new Date(),
          paymentMethod: paymentMethod || 'Transfertë bankare',
          supplier: supplier ? supplier.trim() : null,
          referenceNumber: referenceNumber ? referenceNumber.trim() : null,
          status: status || 'Paguar',
          notes: notes ? notes.trim() : null,
          projectId: projectId ? parseInt(projectId) : null,
          userId: req.session.user?.id || null
        }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Krijuar',
        entityType: 'Shpenzim',
        entityId: expense.id,
        description: `U regjistrua shpenzimi ${expense.number} (${expense.title}) me vlerë ${expense.amount.toLocaleString('de-DE')} €.`
      });

      req.flash('success', `Shpenzimi ${expense.number} u regjistrua me sukses.`);
      res.redirect(`/shpenzimet/${expense.id}`);
    } catch (err) {
      console.error('Gabim në regjistrimin e shpenzimit:', err);
      req.flash('error', 'Ndodhi një gabim gjatë regjistrimit të shpenzimit.');
      res.redirect('/shpenzimet/krijo');
    }
  }

  static async getDetail(req, res) {
    try {
      const id = parseInt(req.params.id);
      const expense = await prisma.expense.findUnique({
        where: { id },
        include: {
          project: true,
          user: true
        }
      });

      if (!expense) {
        req.flash('error', 'Shpenzimi nuk u gjet.');
        return res.redirect('/shpenzimet');
      }

      res.render('shpenzimet/detajet', {
        pageTitle: `Shpenzimi ${expense.number} - KRONEER`,
        expense
      });
    } catch (err) {
      console.error(err);
      res.redirect('/shpenzimet');
    }
  }

  static async getEdit(req, res) {
    try {
      const id = parseInt(req.params.id);
      const expense = await prisma.expense.findUnique({
        where: { id },
        include: { project: true }
      });

      if (!expense) {
        req.flash('error', 'Shpenzimi nuk u gjet.');
        return res.redirect('/shpenzimet');
      }

      const projects = await prisma.project.findMany({ orderBy: { name: 'asc' } });
      const users = await prisma.user.findMany({ where: { isActive: true } });

      res.render('shpenzimet/ndrysho', {
        pageTitle: `Ndrysho Shpenzimin ${expense.number} - KRONEER`,
        expense,
        categories: EXPENSE_CATEGORIES,
        statuses: EXPENSE_STATUSES,
        projects,
        users
      });
    } catch (err) {
      console.error(err);
      res.redirect('/shpenzimet');
    }
  }

  static async postEdit(req, res) {
    try {
      const id = parseInt(req.params.id);
      const {
        title, category, amount, currency, date, paymentMethod,
        supplier, referenceNumber, status, notes, projectId
      } = req.body;

      const expense = await prisma.expense.findUnique({ where: { id } });
      if (!expense) {
        req.flash('error', 'Shpenzimi nuk u gjet.');
        return res.redirect('/shpenzimet');
      }

      const updated = await prisma.expense.update({
        where: { id },
        data: {
          title: title ? title.trim() : expense.title,
          category: category || expense.category,
          amount: parseFloat(amount) || 0,
          currency: currency || 'EUR',
          date: date ? new Date(date) : expense.date,
          paymentMethod: paymentMethod || expense.paymentMethod,
          supplier: supplier ? supplier.trim() : null,
          referenceNumber: referenceNumber ? referenceNumber.trim() : null,
          status: status || expense.status,
          notes: notes ? notes.trim() : null,
          projectId: projectId ? parseInt(projectId) : null
        }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Ndryshuar',
        entityType: 'Shpenzim',
        entityId: id,
        description: `Shpenzimi ${updated.number} u modifikua. Vlera: ${updated.amount.toLocaleString('de-DE')} €.`
      });

      req.flash('success', `Shpenzimi ${updated.number} u përditësua me sukses.`);
      res.redirect(`/shpenzimet/${id}`);
    } catch (err) {
      console.error('Gabim në përditësimin e shpenzimit:', err);
      req.flash('error', 'Ndodhi një gabim gjatë ruajtjes.');
      res.redirect(`/shpenzimet/${req.params.id}/ndrysho`);
    }
  }

  static async postDelete(req, res) {
    try {
      const id = parseInt(req.params.id);
      const expense = await prisma.expense.findUnique({ where: { id } });

      if (!expense) {
        req.flash('error', 'Shpenzimi nuk u gjet.');
        return res.redirect('/shpenzimet');
      }

      await prisma.expense.delete({ where: { id } });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Fshirë',
        entityType: 'Shpenzim',
        entityId: id,
        description: `Shpenzimi ${expense.number} (${expense.title}) u fshi nga sistemi.`
      });

      req.flash('success', `Shpenzimi ${expense.number} u fshi me sukses.`);
      res.redirect('/shpenzimet');
    } catch (err) {
      console.error('Gabim në fshirjen e shpenzimit:', err);
      req.flash('error', 'Shpenzimi nuk mund të fshihet.');
      res.redirect('/shpenzimet');
    }
  }

  static async getPrint(req, res) {
    try {
      const id = parseInt(req.params.id);
      const expense = await prisma.expense.findUnique({
        where: { id },
        include: { project: true, user: true }
      });

      if (!expense) {
        return res.status(404).send('Shpenzimi nuk u gjet.');
      }

      res.render('shpenzimet/print', {
        pageTitle: `Flete_Shpenzim_${expense.number}`,
        expense,
        layout: 'layouts/print'
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Gabim në gjenerimin e fletë-shpenzimit.');
    }
  }

  static async getExportList(req, res) {
    try {
      const { category, status, search, projectId } = req.query;
      const where = {};

      if (category) where.category = category;
      if (status) where.status = status;
      if (projectId) where.projectId = parseInt(projectId);
      if (search) {
        where.OR = [
          { number: { contains: search } },
          { title: { contains: search } },
          { supplier: { contains: search } },
          { referenceNumber: { contains: search } }
        ];
      }

      const expenses = await prisma.expense.findMany({
        where,
        include: { project: true, user: true },
        orderBy: { date: 'desc' }
      });

      const totalAmount = expenses.reduce((s, e) => s + (e.amount || 0), 0);

      res.render('shpenzimet/print-list', {
        pageTitle: 'Raporti_i_Shpenzimeve_KRONEER',
        expenses,
        totalAmount,
        categoryFilter: category || '',
        layout: 'layouts/print'
      });
    } catch (err) {
      console.error('Gabim në eksportimin e shpenzimeve:', err);
      res.status(500).send('Gabim në gjenerimin e raportit.');
    }
  }
}

module.exports = ExpenseController;
