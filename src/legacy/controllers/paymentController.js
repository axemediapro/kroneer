const prisma = require('../config/prisma');
const NumberService = require('../services/numberService');
const ActivityService = require('../services/activityService');

class PaymentController {
  static async getIndex(req, res) {
    try {
      const { search, method } = req.query;
      const where = {};

      if (method) where.paymentMethod = method;
      if (search) {
        where.OR = [
          { number: { contains: search } },
          { referenceNumber: { contains: search } },
          { customer: { companyName: { contains: search } } }
        ];
      }

      const payments = await prisma.payment.findMany({
        where,
        include: {
          customer: true,
          invoice: true,
          project: true
        },
        orderBy: { date: 'desc' }
      });

      const totalCollected = payments.reduce((s, p) => s + (p.amount || 0), 0);
      const methods = ['Transfertë bankare', 'Para në dorë', 'Kartelë', 'Tjetër'];

      res.render('pagesat/index', {
        pageTitle: 'Pagesat - KRONEER',
        payments,
        totalCollected,
        methods,
        filters: { search: search || '', method: method || '' }
      });
    } catch (err) {
      console.error('Gabim në ngarkimin e pagesave:', err);
      req.flash('error', 'Nuk u arrit të ngarkohen pagesat.');
      res.redirect('/paneli');
    }
  }

  static async getCreate(req, res) {
    try {
      const { invoiceId, customerId } = req.query;
      const customers = await prisma.customer.findMany({ orderBy: { companyName: 'asc' } });
      const invoices = await prisma.invoice.findMany({
        where: { balanceDue: { gt: 0 } },
        include: { customer: true },
        orderBy: { createdAt: 'desc' }
      });
      const nextNumber = await NumberService.getNextNumber('payment');

      res.render('pagesat/krijo', {
        pageTitle: 'Regjistro Pagesë të Re - KRONEER',
        customers,
        invoices,
        nextNumber,
        selectedInvoiceId: invoiceId ? parseInt(invoiceId) : null,
        selectedCustomerId: customerId ? parseInt(customerId) : null
      });
    } catch (err) {
      console.error(err);
      res.redirect('/pagesat');
    }
  }

  static async postCreate(req, res) {
    try {
      const { invoiceId, customerId, amount, date, paymentMethod, referenceNumber, notes } = req.body;
      const payAmount = parseFloat(amount) || 0;

      if (payAmount <= 0) {
        req.flash('error', 'Shuma e pagesës duhet të jetë më e madhe se zero.');
        return res.redirect('/pagesat/krijo');
      }

      const number = await NumberService.getNextNumber('payment');
      let custId = customerId ? parseInt(customerId) : null;
      let invId = invoiceId ? parseInt(invoiceId) : null;

      let invoice = null;
      if (invId) {
        invoice = await prisma.invoice.findUnique({ where: { id: invId } });
        if (invoice) {
          custId = invoice.customerId;
        }
      }

      const payment = await prisma.payment.create({
        data: {
          number,
          invoiceId: invId,
          customerId: custId,
          amount: payAmount,
          date: date ? new Date(date) : new Date(),
          paymentMethod: paymentMethod || 'Transfertë bankare',
          referenceNumber: referenceNumber ? referenceNumber.trim() : null,
          notes: notes ? notes.trim() : null
        }
      });

      // Nëse pagesa është lidhur me një faturë, përditëso gjendjen e faturës
      if (invoice) {
        const newPaidAmount = (invoice.paidAmount || 0) + payAmount;
        const newBalance = Math.max(0, (invoice.total || 0) - newPaidAmount);
        const newStatus = newBalance === 0 ? 'Paguar' : 'Pjesërisht e paguar';

        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount: newPaidAmount,
            balanceDue: newBalance,
            status: newStatus
          }
        });
      }

      const customer = custId ? await prisma.customer.findUnique({ where: { id: custId } }) : null;

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Paguar',
        entityType: 'Pagesë',
        entityId: payment.id,
        description: `U regjistrua pagesa ${payment.number} prej €${payAmount.toLocaleString('de-DE')} nga ${customer ? customer.companyName : 'Klienti'} (${payment.paymentMethod}).`
      });

      req.flash('success', `Pagesa prej €${payAmount.toLocaleString('de-DE')} (${payment.number}) u regjistrua me sukses.`);
      res.redirect(`/pagesat/${payment.id}/deftese`);
    } catch (err) {
      console.error('Gabim në regjistrimin e pagesës:', err);
      req.flash('error', 'Ndodhi një gabim gjatë regjistrimit të pagesës.');
      res.redirect('/pagesat/krijo');
    }
  }

  static async getReceipt(req, res) {
    try {
      const id = parseInt(req.params.id);
      const payment = await prisma.payment.findUnique({
        where: { id },
        include: {
          customer: true,
          invoice: true
        }
      });

      if (!payment) {
        req.flash('error', 'Pagesa nuk u gjet.');
        return res.redirect('/pagesat');
      }

      res.render('pagesat/deftese', {
        pageTitle: `Dëftesë Pagese ${payment.number} - KRONEER`,
        payment,
        layout: 'layouts/print'
      });
    } catch (err) {
      console.error(err);
      res.redirect('/pagesat');
    }
  }
}

module.exports = PaymentController;
