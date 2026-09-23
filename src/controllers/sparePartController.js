const prisma = require('../config/prisma');
const ActivityService = require('../services/activityService');

class SparePartController {
  static async getIndex(req, res) {
    try {
      const { category, stockStatus, search } = req.query;
      const where = {};

      if (category) where.category = category;
      if (search) {
        where.OR = [
          { partNumber: { contains: search } },
          { name: { contains: search } },
          { compatibleElevators: { contains: search } },
          { supplier: { contains: search } }
        ];
      }

      let parts = await prisma.sparePart.findMany({
        where,
        orderBy: { name: 'asc' }
      });

      if (stockStatus === 'low') {
        parts = parts.filter(p => p.stockQty > 0 && p.stockQty <= p.minStockQty);
      } else if (stockStatus === 'out') {
        parts = parts.filter(p => p.stockQty === 0);
      } else if (stockStatus === 'ok') {
        parts = parts.filter(p => p.stockQty > p.minStockQty);
      }

      const totalItems = parts.reduce((s, p) => s + p.stockQty, 0);
      const totalInventoryValue = parts.reduce((s, p) => s + (p.stockQty * p.sellingPrice), 0);
      const lowStockCount = parts.filter(p => p.stockQty > 0 && p.stockQty <= p.minStockQty).length;
      const outOfStockCount = parts.filter(p => p.stockQty === 0).length;

      const categories = ['Mekanike', 'Elektrike', 'Hidraulike', 'Elektronike', 'Dyer', 'Siguri', 'Interier'];

      res.render('pjeset-rezerve/index', {
        pageTitle: 'Pjesët Rezervë & Magazina - KRONEER',
        parts,
        categories,
        totalItems,
        totalInventoryValue,
        lowStockCount,
        outOfStockCount,
        filters: { category: category || '', stockStatus: stockStatus || '', search: search || '' }
      });
    } catch (err) {
      console.error(err);
      req.flash('error', 'Nuk u ngarkua inventari i pjesëve rezervë.');
      res.redirect('/paneli');
    }
  }

  static getCreate(req, res) {
    const categories = ['Mekanike', 'Elektrike', 'Hidraulike', 'Elektronike', 'Dyer', 'Siguri', 'Interier'];
    res.render('pjeset-rezerve/krijo', {
      pageTitle: 'Regjistro Pjesë Rezervë të Re - KRONEER',
      categories
    });
  }

  static async postCreate(req, res) {
    try {
      const { partNumber, name, category, compatibleElevators, stockQty, minStockQty, purchasePrice, sellingPrice, supplier, location } = req.body;

      const part = await prisma.sparePart.create({
        data: {
          partNumber: partNumber.trim(),
          name: name.trim(),
          category: category || 'Mekanike',
          compatibleElevators: compatibleElevators ? compatibleElevators.trim() : null,
          stockQty: parseInt(stockQty) || 0,
          minStockQty: parseInt(minStockQty) || 5,
          purchasePrice: parseFloat(purchasePrice) || 0,
          sellingPrice: parseFloat(sellingPrice) || 0,
          supplier: supplier ? supplier.trim() : null,
          location: location ? location.trim() : null
        }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Krijuar',
        entityType: 'Pjesë Rezervë',
        entityId: part.id,
        description: `U regjistrua pjesa e re rezervë "${part.name}" (${part.partNumber}) me sasi ${part.stockQty} copë.`
      });

      req.flash('success', `Pjesa rezervë "${part.name}" u shtua në magazinë.`);
      res.redirect('/pjeset-rezerve');
    } catch (err) {
      console.error('Gabim në regjistrimin e pjesës rezervë:', err);
      req.flash('error', 'Nuk u regjistrua pjesa rezervë (kontrolloni numrin unik të pjesës).');
      res.redirect('/pjeset-rezerve/krijo');
    }
  }

  static async postUpdateStock(req, res) {
    try {
      const id = parseInt(req.params.id);
      const { deltaQty } = req.body;
      const delta = parseInt(deltaQty) || 0;

      const part = await prisma.sparePart.findUnique({ where: { id } });
      if (!part) {
        req.flash('error', 'Pjesa nuk u gjet.');
        return res.redirect('/pjeset-rezerve');
      }

      const newQty = Math.max(0, part.stockQty + delta);
      await prisma.sparePart.update({
        where: { id },
        data: { stockQty: newQty }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Ndryshuar',
        entityType: 'Pjesë Rezervë',
        entityId: id,
        description: `U ndryshua stoku për "${part.name}" nga ${part.stockQty} në ${newQty} copë.`
      });

      req.flash('success', `Stoku për "${part.name}" u përditësua në ${newQty} copë.`);
      res.redirect('/pjeset-rezerve');
    } catch (err) {
      console.error(err);
      res.redirect('/pjeset-rezerve');
    }
  }
}

module.exports = SparePartController;
