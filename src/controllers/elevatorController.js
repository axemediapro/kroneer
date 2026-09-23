const prisma = require('../config/prisma');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const NumberService = require('../services/numberService');
const ActivityService = require('../services/activityService');

class ElevatorController {
  static async getCatalog(req, res) {
    try {
      const { type, search } = req.query;
      const where = {};

      if (type) where.type = type;
      if (search) {
        where.OR = [
          { model: { contains: search } },
          { code: { contains: search } },
          { description: { contains: search } }
        ];
      }

      const elevators = await prisma.elevator.findMany({
        where,
        orderBy: { basePrice: 'asc' }
      });

      res.render('lifts/katalogu', {
        pageTitle: 'Katalogu i Lifteve - KRONEER',
        elevators,
        types: ElevatorController.TYPES,
        filters: { type: type || '', search: search || '' }
      });
    } catch (err) {
      console.error('Gabim në ngarkimin e katalogut:', err);
      req.flash('error', 'Nuk u ngarkua katalogu i lifteve.');
      res.redirect('/paneli');
    }
  }

  static async getDetail(req, res) {
    try {
      const id = parseInt(req.params.id);
      const elevator = await prisma.elevator.findUnique({
        where: { id },
        include: { media: { orderBy: { sortOrder: 'asc' } } }
      });
      if (!elevator) {
        req.flash('error', 'Lifti nuk u gjet.');
        return res.redirect('/lifts');
      }

      const options = await prisma.elevatorOption.findMany();

      const host = req.get('host');
      const protocol = req.protocol;
      const publicUrl = `${protocol}://${host}/p/lifts/${elevator.id}`;

      // Generate QR Code Data URL
      const qrCodeDataUrl = await QRCode.toDataURL(publicUrl, {
        width: 240,
        margin: 1.5,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      });

      res.render('lifts/detajet', {
        pageTitle: `${elevator.model} (${elevator.code}) - KRONEER`,
        elevator,
        options,
        qrCodeDataUrl,
        publicUrl
      });
    } catch (err) {
      console.error(err);
      res.redirect('/lifts');
    }
  }

  static async getPublicDetail(req, res) {
    try {
      const id = parseInt(req.params.id);
      const elevator = await prisma.elevator.findUnique({
        where: { id },
        include: { media: { orderBy: { sortOrder: 'asc' } } }
      });
      if (!elevator) {
        return res.status(404).send('Modeli i liftit nuk u gjet.');
      }

      const host = req.get('host');
      const protocol = req.protocol;
      const publicUrl = `${protocol}://${host}/p/lifts/${elevator.id}`;

      const qrCodeDataUrl = await QRCode.toDataURL(publicUrl, {
        width: 200,
        margin: 1.5,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      });

      const options = await prisma.elevatorOption.findMany();
      let company = await prisma.companySettings.findFirst();

      res.render('lifts/publik', {
        layout: 'layouts/public',
        pageTitle: `${elevator.model} (${elevator.code}) — Fleta Teknike | KRONEER`,
        elevator,
        options,
        qrCodeDataUrl,
        publicUrl,
        company: company || {}
      });
    } catch (err) {
      console.error('Gabim në ngarkimin e fletës publike:', err);
      res.status(500).send('Gabim në ngarkimin e fletës teknike publike.');
    }
  }

  static async getConfigurator(req, res) {
    try {
      const elevators = await prisma.elevator.findMany({ where: { status: 'Aktiv' } });
      const options = await prisma.elevatorOption.findMany();
      const customers = await prisma.customer.findMany({ orderBy: { companyName: 'asc' } });

      let selectedElevator = null;
      if (req.query.elevatorId) {
        selectedElevator = await prisma.elevator.findUnique({ where: { id: parseInt(req.query.elevatorId) } });
      }

      res.render('lifts/konfiguruesi', {
        pageTitle: 'Konfiguruesi i Liftit KRONEER - Sistemi Interaktiv',
        elevators,
        options,
        customers,
        selectedElevator
      });
    } catch (err) {
      console.error('Gabim në ngarkimin e konfiguruesit:', err);
      req.flash('error', 'Nuk u hap dot konfiguruesi.');
      res.redirect('/lifts');
    }
  }

  static async postSaveConfiguration(req, res) {
    try {
      const {
        customerId, elevatorId, elevatorType, capacityKg, speed, floorsCount, stopsCount,
        travelHeight, shaftWidth, shaftDepth, pitDepth, headroomHeight,
        driveSystem, doorType, cabinFinish, floorFinish, ceilingFinish, wallFinish,
        lighting, mirror, handrail, selectedOptions,
        basePrice, optionsPrice, installationPrice, transportPrice, discount,
        subtotal, vatAmount, calculatedPrice, createQuotation
      } = req.body;

      // Krijimi i konfigurimit
      const config = await prisma.elevatorConfiguration.create({
        data: {
          elevatorId: elevatorId ? parseInt(elevatorId) : null,
          elevatorType: elevatorType || 'Lift pasagjerësh',
          capacityKg: parseInt(capacityKg) || 630,
          speed: parseFloat(speed) || 1.0,
          floorsCount: parseInt(floorsCount) || 5,
          stopsCount: parseInt(stopsCount) || 5,
          travelHeight: parseFloat(travelHeight) || 15.0,
          shaftWidth: parseInt(shaftWidth) || 1650,
          shaftDepth: parseInt(shaftDepth) || 1750,
          pitDepth: parseInt(pitDepth) || 1200,
          headroomHeight: parseInt(headroomHeight) || 3600,
          driveSystem: driveSystem || 'MRL',
          doorType: doorType || 'Automatike Qendrore',
          cabinFinish: cabinFinish || 'Inoks',
          floorFinish: floorFinish || 'Granit',
          ceilingFinish: ceilingFinish || 'LED Spote',
          wallFinish: wallFinish || 'Inox Saten',
          lighting: lighting || 'LED',
          mirror: mirror || 'Gjysmë pasqyrë',
          handrail: handrail || 'Inoks i rrumbullakët',
          selectedOptionsJson: typeof selectedOptions === 'string' ? selectedOptions : JSON.stringify(selectedOptions || []),
          basePrice: parseFloat(basePrice) || 0,
          optionsPrice: parseFloat(optionsPrice) || 0,
          installationPrice: parseFloat(installationPrice) || 0,
          transportPrice: parseFloat(transportPrice) || 0,
          discount: parseFloat(discount) || 0,
          subtotal: parseFloat(subtotal) || 0,
          vatAmount: parseFloat(vatAmount) || 0,
          calculatedPrice: parseFloat(calculatedPrice) || 0
        }
      });

      // Nëse përdoruesi zgjodhi krijimin e menjëhershëm të ofertës
      if (createQuotation && customerId) {
        const quoteNumber = await NumberService.getNextNumber('quotation');
        const custId = parseInt(customerId);

        const quote = await prisma.quotation.create({
          data: {
            number: quoteNumber,
            date: new Date(),
            validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 ditë vlefshmëri
            customerId: custId,
            salesRepId: req.session.user?.id || null,
            subtotal: parseFloat(subtotal) || 0,
            discount: parseFloat(discount) || 0,
            vatRate: 18,
            vatAmount: parseFloat(vatAmount) || 0,
            total: parseFloat(calculatedPrice) || 0,
            status: 'Draft',
            notes: `Ofertë e gjeneruar automatikisht nga Konfiguruesi i Liftit KRONEER (${elevatorType} - ${capacityKg} KG).`
          }
        });

        // Lidh konfigurimin me ofertën
        await prisma.elevatorConfiguration.update({
          where: { id: config.id },
          data: { quotationId: quote.id }
        });

        // Krijimi i artikujve të ofertës
        await prisma.quotationItem.create({
          data: {
            quotationId: quote.id,
            itemType: 'Lift',
            name: `Lift KRONEER ${elevatorType} ${capacityKg}kg (${speed} m/s, ${floorsCount} kate)`,
            description: `Model i konfiguruar me makinë ${driveSystem}, dyer ${doorType}, kabinë ${cabinFinish}, dysheme ${floorFinish}, mure ${wallFinish}`,
            quantity: 1,
            unit: 'copë',
            unitPrice: parseFloat(basePrice) || 0,
            discount: 0,
            vatRate: 18,
            total: parseFloat(basePrice) || 0
          }
        });

        if (parseFloat(optionsPrice) > 0) {
          await prisma.quotationItem.create({
            data: {
              quotationId: quote.id,
              itemType: 'Komponent',
              name: 'Paketa e Opsioneve & Aksesorëve të Zgjedhur',
              description: 'Aksesorë interieri, drita të personalizuara dhe pajisje sigurie',
              quantity: 1,
              unit: 'pako',
              unitPrice: parseFloat(optionsPrice) || 0,
              discount: 0,
              vatRate: 18,
              total: parseFloat(optionsPrice) || 0
            }
          });
        }

        if (parseFloat(installationPrice) > 0) {
          await prisma.quotationItem.create({
            data: {
              quotationId: quote.id,
              itemType: 'Instalim',
              name: 'Punimet e Montimit dhe Instalimit Profesional',
              description: 'Montimi i shinave, kabinës, kontrollorit dhe kalibrimi i plotë',
              quantity: 1,
              unit: 'shërbim',
              unitPrice: parseFloat(installationPrice) || 0,
              discount: 0,
              vatRate: 18,
              total: parseFloat(installationPrice) || 0
            }
          });
        }

        if (parseFloat(transportPrice) > 0) {
          await prisma.quotationItem.create({
            data: {
              quotationId: quote.id,
              itemType: 'Transport',
              name: 'Transporti dhe Shkarkimi i Sigurt në Kantier',
              description: 'Transporti i të gjithë komponentëve dhe shkarkimi me vinç',
              quantity: 1,
              unit: 'shërbim',
              unitPrice: parseFloat(transportPrice) || 0,
              discount: 0,
              vatRate: 18,
              total: parseFloat(transportPrice) || 0
            }
          });
        }

        await ActivityService.log({
          userId: req.session.user?.id,
          userName: req.session.user?.fullName,
          actionType: 'Krijuar',
          entityType: 'Ofertë',
          entityId: quote.id,
          description: `U krijua oferta ${quote.number} nga Konfiguruesi me vlerë €${(quote.total || 0).toLocaleString('de-DE')}.`
        });

        req.flash('success', `Oferta ${quote.number} u gjenerua me sukses nga konfigurimi.`);
        return res.redirect(`/ofertat/${quote.id}`);
      }

      req.flash('success', 'Konfigurimi i liftit u ruajt me sukses.');
      res.redirect('/lifts');
    } catch (err) {
      console.error('Gabim në ruajtjen e konfigurimit:', err);
      req.flash('error', 'Ndodhi një gabim gjatë ruajtjes së konfigurimit.');
      res.redirect('/lifts/konfiguruesi');
    }
  }

  static getCreate(req, res) {
    res.render('lifts/krijo', {
      pageTitle: 'Shto Model të Ri Lifti - KRONEER',
      types: ElevatorController.TYPES
    });
  }

  static async postCreate(req, res) {
    try {
      const {
        code, model, type, description, capacityKg, personsCount, speed,
        floorsCount, stopsCount, motorType, driveSystem, doorType,
        cabinDimensions, shaftDimensions, pitDepth, headroomHeight,
        powerSupply, motorPower, cabinMaterial, lighting, controlSystem,
        safetySystem, warrantyMonths, basePrice, vatRate, status
      } = req.body;

      if (!code || !code.trim() || !model || !model.trim()) {
        req.flash('error', 'Kodi dhe emri i modelit janë të detyrueshëm.');
        return res.redirect('/lifts/krijo');
      }

      const elevator = await prisma.elevator.create({
        data: {
          code: code.trim().toUpperCase(),
          model: model.trim(),
          type: type || 'Lift pasagjerësh',
          description: description ? description.trim() : null,
          capacityKg: parseInt(capacityKg) || 630,
          personsCount: parseInt(personsCount) || 8,
          speed: parseFloat(speed) || 1.0,
          floorsCount: parseInt(floorsCount) || 5,
          stopsCount: parseInt(stopsCount) || 5,
          motorType: motorType || 'Gearless',
          driveSystem: driveSystem || 'MRL',
          doorType: doorType || 'Automatike Qendrore',
          cabinDimensions: cabinDimensions ? cabinDimensions.trim() : null,
          shaftDimensions: shaftDimensions ? shaftDimensions.trim() : null,
          pitDepth: parseInt(pitDepth) || 1200,
          headroomHeight: parseInt(headroomHeight) || 3600,
          powerSupply: powerSupply || '380V / 3 Faza / 50Hz',
          motorPower: parseFloat(motorPower) || 5.5,
          cabinMaterial: cabinMaterial || 'Inox Saten AISI 304',
          lighting: lighting || 'LED me fikje automatike',
          controlSystem: controlSystem || 'Mikroprocesor VVF Inverter',
          safetySystem: safetySystem || 'EN81-20/50 e plotë',
          warrantyMonths: parseInt(warrantyMonths) || 24,
          basePrice: parseFloat(basePrice) || 20000,
          vatRate: parseFloat(vatRate) || 18,
          status: status || 'Aktiv'
        }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Krijuar',
        entityType: 'Model Lifti',
        entityId: elevator.id,
        description: `U shtua modeli i ri i liftit "${elevator.model}" (${elevator.code}) në katalog.`
      });

      req.flash('success', `Modeli "${elevator.model}" u shtua me sukses në katalog.`);
      res.redirect(`/lifts/${elevator.id}`);
    } catch (err) {
      console.error('Gabim në krijimin e modelit të liftit:', err);
      if (err.code === 'P2002') {
        req.flash('error', 'Ky kod modeli ekziston tashmë. Zgjidhni një kod tjetër.');
      } else {
        req.flash('error', 'Ndodhi një gabim gjatë krijimit të modelit.');
      }
      res.redirect('/lifts/krijo');
    }
  }

  static async getEdit(req, res) {
    try {
      const id = parseInt(req.params.id);
      const elevator = await prisma.elevator.findUnique({ where: { id } });
      if (!elevator) {
        req.flash('error', 'Lifti nuk u gjet.');
        return res.redirect('/lifts');
      }
      res.render('lifts/ndrysho', {
        pageTitle: `Ndrysho ${elevator.model} - KRONEER`,
        elevator,
        types: ElevatorController.TYPES
      });
    } catch (err) {
      console.error(err);
      res.redirect('/lifts');
    }
  }

  static async postEdit(req, res) {
    try {
      const id = parseInt(req.params.id);
      const {
        code, model, type, description, capacityKg, personsCount, speed,
        floorsCount, stopsCount, motorType, driveSystem, doorType,
        cabinDimensions, shaftDimensions, pitDepth, headroomHeight,
        powerSupply, motorPower, cabinMaterial, lighting, controlSystem,
        safetySystem, warrantyMonths, basePrice, vatRate, status
      } = req.body;

      const elevator = await prisma.elevator.update({
        where: { id },
        data: {
          code: code ? code.trim().toUpperCase() : undefined,
          model: model ? model.trim() : undefined,
          type: type || undefined,
          description: description ? description.trim() : null,
          capacityKg: parseInt(capacityKg) || 630,
          personsCount: parseInt(personsCount) || 8,
          speed: parseFloat(speed) || 1.0,
          floorsCount: parseInt(floorsCount) || 5,
          stopsCount: parseInt(stopsCount) || 5,
          motorType: motorType || 'Gearless',
          driveSystem: driveSystem || 'MRL',
          doorType: doorType || 'Automatike Qendrore',
          cabinDimensions: cabinDimensions ? cabinDimensions.trim() : null,
          shaftDimensions: shaftDimensions ? shaftDimensions.trim() : null,
          pitDepth: parseInt(pitDepth) || 1200,
          headroomHeight: parseInt(headroomHeight) || 3600,
          powerSupply: powerSupply || '380V / 3 Faza / 50Hz',
          motorPower: parseFloat(motorPower) || 5.5,
          cabinMaterial: cabinMaterial || 'Inox Saten AISI 304',
          lighting: lighting || 'LED me fikje automatike',
          controlSystem: controlSystem || 'Mikroprocesor VVF Inverter',
          safetySystem: safetySystem || 'EN81-20/50 e plotë',
          warrantyMonths: parseInt(warrantyMonths) || 24,
          basePrice: parseFloat(basePrice) || 20000,
          vatRate: parseFloat(vatRate) || 18,
          status: status || 'Aktiv'
        }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Ndryshuar',
        entityType: 'Model Lifti',
        entityId: elevator.id,
        description: `U përditësua modeli i liftit "${elevator.model}" (${elevator.code}).`
      });

      req.flash('success', `Modeli "${elevator.model}" u përditësua me sukses.`);
      res.redirect(`/lifts/${elevator.id}`);
    } catch (err) {
      console.error('Gabim në ndryshimin e modelit të liftit:', err);
      if (err.code === 'P2002') {
        req.flash('error', 'Ky kod modeli ekziston tashmë. Zgjidhni një kod tjetër.');
      } else {
        req.flash('error', 'Ndodhi një gabim gjatë përditësimit të modelit.');
      }
      res.redirect(`/lifts/${req.params.id}/ndrysho`);
    }
  }

  static async postDelete(req, res) {
    try {
      const id = parseInt(req.params.id);
      const elevator = await prisma.elevator.findUnique({ where: { id } });
      if (!elevator) {
        req.flash('error', 'Lifti nuk u gjet.');
        return res.redirect('/lifts');
      }

      await prisma.elevator.delete({ where: { id } });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Fshirë',
        entityType: 'Model Lifti',
        entityId: id,
        description: `U fshi modeli i liftit "${elevator.model}" (${elevator.code}) nga katalogu.`
      });

      req.flash('success', `Modeli "${elevator.model}" u fshi nga katalogu.`);
      res.redirect('/lifts');
    } catch (err) {
      console.error('Gabim në fshirjen e modelit të liftit:', err);
      req.flash('error', 'Ky model nuk mund të fshihet sepse është i lidhur me kontrata/oferta ekzistuese. Çaktivizojeni në vend të fshirjes.');
      res.redirect(`/lifts/${req.params.id}/ndrysho`);
    }
  }

  static async postUploadMedia(req, res) {
    try {
      const elevatorId = parseInt(req.params.id);
      if (!req.file) {
        req.flash('error', 'Nuk u zgjodh asnjë skedar për ngarkim.');
        return res.redirect(`/lifts/${elevatorId}`);
      }

      const isVideo = req.file.mimetype && req.file.mimetype.startsWith('video/');
      const url = `/uploads/elevators/${req.file.filename}`;
      const count = await prisma.elevatorMedia.count({ where: { elevatorId } });

      await prisma.elevatorMedia.create({
        data: {
          elevatorId,
          type: isVideo ? 'video' : 'image',
          url,
          caption: req.body.caption ? req.body.caption.trim() : null,
          sortOrder: count
        }
      });

      req.flash('success', 'Media u shtua me sukses në galerinë e liftit.');
      res.redirect(`/lifts/${elevatorId}`);
    } catch (err) {
      console.error('Gabim në ngarkimin e medias së liftit:', err);
      req.flash('error', err.message || 'Ndodhi një gabim gjatë ngarkimit të medias.');
      res.redirect(`/lifts/${req.params.id}`);
    }
  }

  static async postDeleteMedia(req, res) {
    try {
      const elevatorId = parseInt(req.params.id);
      const mediaId = parseInt(req.params.mediaId);
      const media = await prisma.elevatorMedia.findUnique({ where: { id: mediaId } });

      if (media) {
        if (media.url && media.url.startsWith('/uploads/elevators/')) {
          const filePath = path.join(__dirname, '../../public', media.url);
          if (fs.existsSync(filePath)) {
            fs.unlink(filePath, () => {});
          }
        }
        await prisma.elevatorMedia.delete({ where: { id: mediaId } });
        req.flash('success', 'Media u fshi nga galeria.');
      }

      res.redirect(`/lifts/${elevatorId}`);
    } catch (err) {
      console.error('Gabim në fshirjen e medias së liftit:', err);
      req.flash('error', 'Ndodhi një gabim gjatë fshirjes së medias.');
      res.redirect(`/lifts/${req.params.id}`);
    }
  }
}

ElevatorController.TYPES = [
  'Lift pasagjerësh',
  'Lift shtëpiak',
  'Lift panoramik',
  'Lift mallrash',
  'Lift spitalor',
  'Lift shërbimi',
  'Lift automobilash',
  'Platformë ngritëse'
];

module.exports = ElevatorController;
