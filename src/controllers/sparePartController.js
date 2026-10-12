const prisma = require('../config/prisma');
const ActivityService = require('../services/activityService');

async function resolveSupplier(body) {
  const id = parseInt(body.supplierId);
  if (id) {
    const s = await prisma.supplier.findUnique({ where: { id } });
    if (s) return { supplierId: s.id, supplier: s.name };
  }
  return { supplierId: null, supplier: body.supplier ? body.supplier.trim() : null };
}

class SparePartController {
  static async getIndex(req, res) {
    try {
      const { category, stockStatus, search, tab } = req.query;
      const where = {};

      if (category) {
        where.category = category;
      } else if (tab === 'modernizim') {
        where.category = 'Modernizim';
      } else if (tab === 'sherbime') {
        where.category = { in: ['Shërbime Inxhinierike', 'Shërbime Teknike', 'Servis'] };
      } else if (tab === 'pjese') {
        where.category = { notIn: ['Modernizim', 'Shërbime Inxhinierike', 'Shërbime Teknike', 'Servis'] };
      }

      if (search) {
        where.OR = [
          { partNumber: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { compatibleElevators: { contains: search, mode: 'insensitive' } },
          { supplier: { contains: search, mode: 'insensitive' } }
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

      // Count stats from all inventory
      const allParts = await prisma.sparePart.findMany();
      const totalItems = allParts.reduce((s, p) => s + p.stockQty, 0);
      const totalInventoryValue = allParts.reduce((s, p) => s + (p.stockQty * p.sellingPrice), 0);
      const lowStockCount = allParts.filter(p => p.stockQty > 0 && p.stockQty <= p.minStockQty).length;
      const outOfStockCount = allParts.filter(p => p.stockQty === 0).length;

      const modernizationCount = allParts.filter(p => p.category === 'Modernizim').length;
      const serviceCount = allParts.filter(p => ['Shërbime Inxhinierike', 'Shërbime Teknike', 'Servis'].includes(p.category)).length;
      const partsCount = allParts.length - modernizationCount - serviceCount;

      const categories = [
        'Mekanike',
        'Elektrike',
        'Hidraulike',
        'Elektronike',
        'Dyer',
        'Siguri',
        'Interier',
        'Modernizim',
        'Shërbime Inxhinierike'
      ];

      res.render('pjeset-rezerve/index', {
        pageTitle: 'Katalogu i Pjesëve, Produkteve & Shërbimeve - KRONEER',
        parts,
        categories,
        totalItems,
        totalInventoryValue,
        lowStockCount,
        outOfStockCount,
        modernizationCount,
        serviceCount,
        partsCount,
        activeTab: tab || 'all',
        canManage: req.session.user && ['ADMINISTRATOR', 'MENAXHER_PROJEKTI', 'FINANCE'].includes(req.session.user.role),
        filters: { category: category || '', stockStatus: stockStatus || '', search: search || '', tab: tab || '' }
      });
    } catch (err) {
      console.error(err);
      req.flash('error', 'Nuk u ngarkua inventari i pjesëve dhe shërbimeve.');
      res.redirect('/paneli');
    }
  }

  static async getCreate(req, res) {
    const suppliers = await prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    const categories = [
      'Mekanike',
      'Elektrike',
      'Hidraulike',
      'Elektronike',
      'Dyer',
      'Siguri',
      'Interier',
      'Modernizim',
      'Shërbime Inxhinierike'
    ];
    res.render('pjeset-rezerve/krijo', {
      pageTitle: 'Regjistro Pjesë, Produkt ose Shërbim të Ri - KRONEER',
      categories,
      suppliers
    });
  }

  static async postCreate(req, res) {
    try {
      const { partNumber, name, category, compatibleElevators, stockQty, minStockQty, purchasePrice, sellingPrice, location } = req.body;

      const part = await prisma.sparePart.create({
        data: {
          partNumber: partNumber.trim(),
          name: name.trim(),
          category: category || 'Mekanike',
          compatibleElevators: compatibleElevators ? compatibleElevators.trim() : null,
          stockQty: parseInt(stockQty) || 0,
          minStockQty: parseInt(minStockQty) || 2,
          purchasePrice: parseFloat(purchasePrice) || 0,
          sellingPrice: parseFloat(sellingPrice) || 0,
          ...(await resolveSupplier(req.body)),
          location: location ? location.trim() : null
        }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Krijuar',
        entityType: 'Katalog / Pjesë Rezervë',
        entityId: part.id,
        description: `U regjistrua artikulli "${part.name}" (${part.partNumber}) në kategorinë ${part.category}.`
      });

      req.flash('success', `Artikulli/Shërbimi "${part.name}" u shtua me sukses në katalog.`);
      res.redirect('/pjeset-rezerve');
    } catch (err) {
      console.error('Gabim në regjistrimin e artikullit:', err);
      req.flash('error', 'Nuk u regjistrua artikulli (kontrolloni nëse kodi/numri i pjesës ekziston tashmë).');
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
        req.flash('error', 'Artikulli nuk u gjet.');
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
        entityType: 'Stok',
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

  static async getEdit(req, res) {
    try {
      const id = parseInt(req.params.id);
      const part = await prisma.sparePart.findUnique({ where: { id } });
      if (!part) {
        req.flash('error', 'Artikulli nuk u gjet.');
        return res.redirect('/pjeset-rezerve');
      }
      const suppliers = await prisma.supplier.findMany({ where: { OR: [{ isActive: true }, { id: part.supplierId || -1 }] }, orderBy: { name: 'asc' } });
      res.render('pjeset-rezerve/ndrysho', {
        pageTitle: `Ndrysho: ${part.name} - KRONEER`,
        part,
        suppliers
      });
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gabim gjatë ngarkimit të artikullit.');
      res.redirect('/pjeset-rezerve');
    }
  }

  static async postEdit(req, res) {
    try {
      const id = parseInt(req.params.id);
      const { partNumber, name, category, compatibleElevators, stockQty, minStockQty, purchasePrice, sellingPrice, location } = req.body;

      const part = await prisma.sparePart.update({
        where: { id },
        data: {
          partNumber: partNumber.trim(),
          name: name.trim(),
          category: category || 'Mekanike',
          compatibleElevators: compatibleElevators ? compatibleElevators.trim() : null,
          stockQty: parseInt(stockQty) || 0,
          minStockQty: parseInt(minStockQty) || 2,
          purchasePrice: parseFloat(purchasePrice) || 0,
          sellingPrice: parseFloat(sellingPrice) || 0,
          ...(await resolveSupplier(req.body)),
          location: location ? location.trim() : null
        }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Ndryshuar',
        entityType: 'Katalog / Pjesë Rezervë',
        entityId: part.id,
        description: `U ndryshua artikulli "${part.name}" (${part.partNumber}).`
      });

      req.flash('success', `Artikulli "${part.name}" u ndryshuan me sukses.`);
      res.redirect('/pjeset-rezerve');
    } catch (err) {
      console.error('Gabim në ndryshimin e artikullit:', err);
      req.flash('error', 'Nuk u ruajtën ndryshimet (kontrolloni nëse kodi ekziston tashmë).');
      res.redirect(`/pjeset-rezerve/${req.params.id}/ndrysho`);
    }
  }

  /**
   * API Endpoint: Live search for Spare Parts, Modernization Packages & Services
   * Used by Invoice & Quotation builders to auto-detect products on typing
   */
  static async apiLiveSearchItems(req, res) {
    try {
      const query = (req.query.q || req.query.search || '').trim();
      if (!query || query.length < 1) {
        // Return top 15 most common items if empty query
        const topItems = await prisma.sparePart.findMany({
          take: 15,
          orderBy: { name: 'asc' }
        });
        return res.json({
          success: true,
          items: topItems.map(p => ({
            id: p.id,
            code: p.partNumber,
            name: p.name,
            category: p.category,
            sellingPrice: p.sellingPrice,
            purchasePrice: p.purchasePrice,
            stockQty: p.stockQty,
            unit: p.category === 'Modernizim' ? 'komplet' : (p.category.includes('Shërbim') ? 'shërbim' : 'copë'),
            description: p.compatibleElevators ? `${p.partNumber} - Për: ${p.compatibleElevators}` : p.partNumber,
            isService: p.category.includes('Shërbim'),
            isModernization: p.category === 'Modernizim'
          }))
        });
      }

      const parts = await prisma.sparePart.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { partNumber: { contains: query, mode: 'insensitive' } },
            { category: { contains: query, mode: 'insensitive' } },
            { compatibleElevators: { contains: query, mode: 'insensitive' } }
          ]
        },
        take: 20,
        orderBy: { name: 'asc' }
      });

      const formatted = parts.map(p => ({
        id: p.id,
        code: p.partNumber,
        name: p.name,
        category: p.category,
        sellingPrice: p.sellingPrice,
        purchasePrice: p.purchasePrice,
        stockQty: p.stockQty,
        unit: p.category === 'Modernizim' ? 'komplet' : (p.category.includes('Shërbim') ? 'shërbim' : 'copë'),
        description: p.compatibleElevators ? `${p.partNumber} - Për: ${p.compatibleElevators}` : p.partNumber,
        isService: p.category.includes('Shërbim'),
        isModernization: p.category === 'Modernizim'
      }));

      return res.json({
        success: true,
        items: formatted
      });
    } catch (err) {
      console.error('Gabim në apiLiveSearchItems:', err);
      return res.status(500).json({ success: false, error: 'Gabim në kërkimin e artikujve.' });
    }
  }
}

module.exports = SparePartController;
