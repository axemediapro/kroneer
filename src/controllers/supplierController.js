const prisma = require('../config/prisma');
const ActivityService = require('../services/activityService');

const clean = (v) => (v && String(v).trim()) || null;
const fields = (b) => ({
  name: String(b.name || '').trim(),
  contactPerson: clean(b.contactPerson),
  phone: clean(b.phone),
  email: clean(b.email),
  country: clean(b.country),
  city: clean(b.city),
  address: clean(b.address),
  taxNumber: clean(b.taxNumber),
  notes: clean(b.notes)
});

class SupplierController {
  static async getIndex(req, res) {
    try {
      const search = (req.query.q || '').trim();
      const where = search ? { OR: ['name', 'contactPerson', 'phone', 'email', 'city'].map((k) => ({ [k]: { contains: search, mode: 'insensitive' } })) } : {};
      const suppliers = await prisma.supplier.findMany({ where, orderBy: { name: 'asc' }, include: { _count: { select: { parts: true } } } });
      res.render('furnitoret/index', { pageTitle: 'Furnitorët - KRONEER', suppliers, search });
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gabim gjatë ngarkimit të furnitorëve.');
      res.redirect('/paneli');
    }
  }

  static getCreate(req, res) {
    res.render('furnitoret/forma', { pageTitle: 'Furnitor i Ri - KRONEER', supplier: null });
  }

  static async postCreate(req, res) {
    try {
      const data = fields(req.body);
      if (!data.name) {
        req.flash('error', 'Emri i furnitorit është i detyrueshëm.');
        return res.redirect('/furnitoret/krijo');
      }
      const supplier = await prisma.supplier.create({ data });
      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Krijuar',
        entityType: 'Furnitor',
        entityId: supplier.id,
        description: `U regjistrua furnitori "${supplier.name}".`
      });
      req.flash('success', `Furnitori "${supplier.name}" u shtua.`);
      res.redirect('/furnitoret');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Nuk u ruajt furnitori (emri mund të ekzistojë tashmë).');
      res.redirect('/furnitoret/krijo');
    }
  }

  static async getEdit(req, res) {
    const supplier = await prisma.supplier.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!supplier) {
      req.flash('error', 'Furnitori nuk u gjet.');
      return res.redirect('/furnitoret');
    }
    res.render('furnitoret/forma', { pageTitle: `Ndrysho: ${supplier.name} - KRONEER`, supplier });
  }

  static async postEdit(req, res) {
    const id = parseInt(req.params.id);
    try {
      const data = fields(req.body);
      if (!data.name) {
        req.flash('error', 'Emri i furnitorit është i detyrueshëm.');
        return res.redirect(`/furnitoret/${id}/ndrysho`);
      }
      const supplier = await prisma.supplier.update({ where: { id }, data: { ...data, isActive: req.body.isActive === 'on' } });
      await prisma.sparePart.updateMany({ where: { supplierId: id }, data: { supplier: supplier.name } });
      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Ndryshuar',
        entityType: 'Furnitor',
        entityId: id,
        description: `U ndryshua furnitori "${supplier.name}".`
      });
      req.flash('success', 'Furnitori u ruajt.');
      res.redirect('/furnitoret');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Nuk u ruajtën ndryshimet (emri mund të ekzistojë tashmë).');
      res.redirect(`/furnitoret/${id}/ndrysho`);
    }
  }

  static async postDelete(req, res) {
    const id = parseInt(req.params.id);
    try {
      const supplier = await prisma.supplier.delete({ where: { id } });
      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Fshirë',
        entityType: 'Furnitor',
        entityId: id,
        description: `U fshi furnitori "${supplier.name}".`
      });
      req.flash('success', 'Furnitori u fshi. Artikujt mbajnë emrin e tij si tekst.');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Furnitori nuk u fshi.');
    }
    res.redirect('/furnitoret');
  }
}

module.exports = SupplierController;