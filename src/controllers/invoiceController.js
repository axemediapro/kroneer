const prisma = require('../config/prisma');
const NumberService = require('../services/numberService');
const ActivityService = require('../services/activityService');
const quotationCatalogService = require('../services/quotationCatalogService');

class InvoiceController {
  static async getIndex(req, res) {
    try {
      const { status, search, customerId } = req.query;
      const where = {};

      if (status) where.status = status;
      if (customerId) where.customerId = parseInt(customerId);
      if (search) {
        where.OR = [
          { number: { contains: search } },
          { customer: { companyName: { contains: search } } },
          { customer: { firstName: { contains: search } } }
        ];
      }

      const invoices = await prisma.invoice.findMany({
        where,
        include: {
          customer: true,
          payments: true
        },
        orderBy: { createdAt: 'desc' }
      });

      // Statistikat financiare të faturave
      const totalAmount = invoices.reduce((s, i) => s + (i.total || 0), 0);
      const totalPaid = invoices.reduce((s, i) => s + (i.paidAmount || 0), 0);
      const totalBalance = invoices.reduce((s, i) => s + (i.balanceDue || 0), 0);

      const statuses = ['Draft', 'Dërguar', 'Pjesërisht e paguar', 'Paguar', 'E vonuar', 'Anuluar'];

      res.render('faturat/index', {
        pageTitle: 'Faturat - KRONEER',
        invoices,
        statuses,
        totalAmount,
        totalPaid,
        totalBalance,
        filters: { status: status || '', search: search || '', customerId: customerId || '' }
      });
    } catch (err) {
      console.error('Gabim në ngarkimin e faturave:', err);
      req.flash('error', 'Nuk u arrit të ngarkohen faturat.');
      res.redirect('/paneli');
    }
  }

  static async getCreate(req, res) {
    try {
      const [customers, elevators] = await Promise.all([
        prisma.customer.findMany({ orderBy: { companyName: 'asc' } }),
        prisma.elevator.findMany({ where: { status: 'Aktiv' } })
      ]);
      const nextNumber = await NumberService.getNextNumber('invoice');
      const catalog = await quotationCatalogService.getCatalog(elevators);

      res.render('faturat/krijo', {
        pageTitle: 'Lësho Faturë të Re - KRONEER',
        customers,
        catalog,
        nextNumber
      });
    } catch (err) {
      console.error(err);
      res.redirect('/faturat');
    }
  }

  static async postCreate(req, res) {
    try {
      const { customerId, date, dueDate, notes, items } = req.body;
      const number = await NumberService.getNextNumber('invoice');

      let parsedItems = [];
      if (typeof items === 'string') {
        try { parsedItems = JSON.parse(items); } catch (e) { parsedItems = []; }
      } else if (Array.isArray(items)) {
        parsedItems = items;
      }

      let subtotal = 0;
      let totalDiscount = 0;
      const vatRate = 18;

      parsedItems.forEach(item => {
        const qty = parseFloat(item.quantity) || 1;
        const price = parseFloat(item.unitPrice) || 0;
        const disc = parseFloat(item.discount) || 0;
        subtotal += (qty * price);
        totalDiscount += disc;
      });

      const discountedSubtotal = Math.max(0, subtotal - totalDiscount);
      const vatAmount = Math.round(discountedSubtotal * (vatRate / 100) * 100) / 100;
      const total = discountedSubtotal + vatAmount;

      const invoice = await prisma.invoice.create({
        data: {
          number,
          customerId: parseInt(customerId),
          date: date ? new Date(date) : new Date(),
          dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          subtotal,
          discount: totalDiscount,
          vatRate,
          vatAmount,
          total,
          paidAmount: 0,
          balanceDue: total,
          status: 'Dërguar',
          notes: notes || ''
        }
      });

      for (const it of parsedItems) {
        const q = parseFloat(it.quantity) || 1;
        const up = parseFloat(it.unitPrice) || 0;
        const d = parseFloat(it.discount) || 0;
        await prisma.invoiceItem.create({
          data: {
            invoiceId: invoice.id,
            name: it.name || 'Artikull Fature',
            description: it.description || '',
            quantity: q,
            unit: (it.unit || 'copë').toString().slice(0, 20),
            unitPrice: up,
            discount: d,
            vatRate,
            total: (q * up) - d
          }
        });
      }

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Krijuar',
        entityType: 'Faturë',
        entityId: invoice.id,
        description: `U lëshua fatura e re ${invoice.number} me vlerë totale ${total.toLocaleString('de-DE')} €.`
      });

      req.flash('success', `Fatura ${invoice.number} u lëshua me sukses.`);
      res.redirect(`/faturat/${invoice.id}`);
    } catch (err) {
      console.error('Gabim në krijimin e faturës:', err);
      req.flash('error', 'Nuk u krijua dot fatura.');
      res.redirect('/faturat/krijo');
    }
  }

  static async getDetail(req, res) {
    try {
      const id = parseInt(req.params.id);
      const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: {
          customer: true,
          items: true,
          payments: { orderBy: { date: 'desc' } },
          contract: true,
          quotation: true
        }
      });

      if (!invoice) {
        req.flash('error', 'Fatura nuk u gjet.');
        return res.redirect('/faturat');
      }

      res.render('faturat/detajet', {
        pageTitle: `Fatura ${invoice.number} - KRONEER`,
        invoice
      });
    } catch (err) {
      console.error(err);
      res.redirect('/faturat');
    }
  }

  static async getPrint(req, res) {
    try {
      const id = parseInt(req.params.id);
      const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: {
          customer: true,
          items: true,
          payments: true
        }
      });

      if (!invoice) {
        return res.status(404).send('Fatura nuk u gjet.');
      }

      const numMatch = (invoice.number || '').match(/\d+$/);
      const invoiceNum = numMatch ? parseInt(numMatch[0], 10) : invoice.id;
      const formattedNum = String(invoiceNum).padStart(2, '0');
      const docTitle = `KR-FTR-${formattedNum}`;

      res.render('faturat/print', {
        pageTitle: docTitle,
        invoice,
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

      const invoices = await prisma.invoice.findMany({
        where,
        include: { customer: true },
        orderBy: { date: 'desc' }
      });

      let customer = null;
      if (customerId) {
        customer = await prisma.customer.findUnique({ where: { id: parseInt(customerId) } });
      }

      const totalAmount = invoices.reduce((s, i) => s + (i.total || 0), 0);
      const totalPaid = invoices.reduce((s, i) => s + (i.paidAmount || 0), 0);
      const totalBalance = invoices.reduce((s, i) => s + (i.balanceDue || 0), 0);

      res.render('faturat/print-list', {
        pageTitle: customer ? `Faturat_${customer.companyName.replace(/[^a-zA-Z0-9]/g, '_')}` : 'Raporti_i_Faturave',
        invoices,
        customer,
        totalAmount,
        totalPaid,
        totalBalance,
        layout: 'layouts/print'
      });
    } catch (err) {
      console.error('Gabim në eksportimin e listës së faturave:', err);
      res.status(500).send('Gabim në gjenerimin e raportit.');
    }
  }

  static async getEdit(req, res) {
    try {
      const id = parseInt(req.params.id);
      const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: {
          customer: true,
          items: true,
          payments: true
        }
      });

      if (!invoice) {
        req.flash('error', 'Fatura nuk u gjet.');
        return res.redirect('/faturat');
      }

      const [customers, elevators] = await Promise.all([
        prisma.customer.findMany({ orderBy: { companyName: 'asc' } }),
        prisma.elevator.findMany({ where: { status: 'Aktiv' } })
      ]);
      const statuses = ['Draft', 'Dërguar', 'Pjesërisht e paguar', 'Paguar', 'E vonuar', 'Anuluar'];
      const catalog = await quotationCatalogService.getCatalog(elevators);

      res.render('faturat/ndrysho', {
        pageTitle: `Ndrysho Faturën ${invoice.number} - KRONEER`,
        invoice,
        customers,
        catalog,
        statuses
      });
    } catch (err) {
      console.error('Gabim gjatë hapjes së formës së editimit të faturës:', err);
      req.flash('error', 'Nuk u arrit të hapet forma e editimit.');
      res.redirect('/faturat');
    }
  }

  static async postEdit(req, res) {
    try {
      const id = parseInt(req.params.id);
      const { customerId, date, dueDate, status, notes, items } = req.body;

      const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: { payments: true }
      });

      if (!invoice) {
        req.flash('error', 'Fatura nuk u gjet.');
        return res.redirect('/faturat');
      }

      let parsedItems = [];
      if (typeof items === 'string') {
        try { parsedItems = JSON.parse(items); } catch (e) { parsedItems = []; }
      } else if (Array.isArray(items)) {
        parsedItems = items;
      }

      let subtotal = 0;
      let totalDiscount = 0;
      const vatRate = 18;

      parsedItems.forEach(item => {
        const qty = parseFloat(item.quantity) || 1;
        const price = parseFloat(item.unitPrice) || 0;
        const disc = parseFloat(item.discount) || 0;
        subtotal += (qty * price);
        totalDiscount += disc;
      });

      const discountedSubtotal = Math.max(0, subtotal - totalDiscount);
      const vatAmount = Math.round(discountedSubtotal * (vatRate / 100) * 100) / 100;
      const total = discountedSubtotal + vatAmount;
      const paidAmount = invoice.paidAmount || 0;
      const balanceDue = Math.max(0, total - paidAmount);

      await prisma.$transaction([
        prisma.invoiceItem.deleteMany({ where: { invoiceId: id } }),
        prisma.invoice.update({
          where: { id },
          data: {
            customerId: parseInt(customerId),
            date: date ? new Date(date) : invoice.date,
            dueDate: dueDate ? new Date(dueDate) : invoice.dueDate,
            subtotal,
            discount: totalDiscount,
            vatRate,
            vatAmount,
            total,
            balanceDue,
            status: status || invoice.status,
            notes: notes || ''
          }
        })
      ]);

      if (parsedItems.length > 0) {
        for (const it of parsedItems) {
          const q = parseFloat(it.quantity) || 1;
          const up = parseFloat(it.unitPrice) || 0;
          const d = parseFloat(it.discount) || 0;
          await prisma.invoiceItem.create({
            data: {
              invoiceId: id,
              name: it.name || 'Artikull Fature',
              description: it.description || '',
              quantity: q,
              unit: (it.unit || 'copë').toString().slice(0, 20),
              unitPrice: up,
              discount: d,
              vatRate,
              total: (q * up) - d
            }
          });
        }
      }

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Ndryshuar',
        entityType: 'Faturë',
        entityId: id,
        description: `Fatura ${invoice.number} u modifikua. Vlera e re: ${total.toLocaleString('de-DE')} €.`
      });

      req.flash('success', `Fatura ${invoice.number} u përditësua me sukses.`);
      res.redirect(`/faturat/${id}`);
    } catch (err) {
      console.error('Gabim në ruajtjen e ndryshimeve të faturës:', err);
      req.flash('error', 'Ndodhi një gabim gjatë ruajtjes së ndryshimeve.');
      res.redirect(`/faturat/${req.params.id}/ndrysho`);
    }
  }

  static async postDelete(req, res) {
    try {
      const id = parseInt(req.params.id);
      const invoice = await prisma.invoice.findUnique({ where: { id } });

      if (!invoice) {
        req.flash('error', 'Fatura nuk u gjet.');
        return res.redirect('/faturat');
      }

      // Shkëput pagesat e lidhura me këtë faturë
      await prisma.payment.updateMany({
        where: { invoiceId: id },
        data: { invoiceId: null }
      });

      await prisma.invoice.delete({ where: { id } });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Fshirë',
        entityType: 'Faturë',
        entityId: id,
        description: `Fatura ${invoice.number} u fshi nga sistemi.`
      });

      req.flash('success', `Fatura ${invoice.number} u fshi me sukses.`);
      res.redirect('/faturat');
    } catch (err) {
      console.error('Gabim gjatë fshirjes së faturës:', err);
      req.flash('error', 'Fatura nuk mund të fshihet.');
      res.redirect('/faturat');
    }
  }
}

module.exports = InvoiceController;
