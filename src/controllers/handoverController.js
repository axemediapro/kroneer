const prisma = require('../config/prisma');
const ActivityService = require('../services/activityService');

class HandoverController {
  static async getIndex(req, res) {
    try {
      const handovers = await prisma.handover.findMany({
        include: {
          project: { include: { customer: true } },
          customer: true
        },
        orderBy: { handoverDate: 'desc' }
      });

      res.render('dorezimi/index', {
        pageTitle: 'Procesverbalet e Dorëzimit - KRONEER',
        handovers
      });
    } catch (err) {
      console.error(err);
      req.flash('error', 'Nuk u arrit të ngarkohen procesverbalet.');
      res.redirect('/paneli');
    }
  }

  static async getCreate(req, res) {
    try {
      const { projectId, installationId } = req.query;
      const projects = await prisma.project.findMany({
        include: { customer: true, installations: true },
        orderBy: { name: 'asc' }
      });

      let selectedInstallation = null;
      if (installationId) {
        selectedInstallation = await prisma.installation.findUnique({
          where: { id: parseInt(installationId) },
          include: { project: { include: { customer: true } } }
        });
      }

      res.render('dorezimi/krijo', {
        pageTitle: 'Krijo Procesverbal Dorëzimi - KRONEER',
        projects,
        selectedInstallation
      });
    } catch (err) {
      console.error(err);
      res.redirect('/dorezimi');
    }
  }

  static async postCreate(req, res) {
    try {
      const {
        projectId, customerId, elevatorModel, serialNumber, installationDate, handoverDate,
        technicalInspection, safetyCheck, documentationHanded, clientTrainingDone,
        keysHanded, accessActivated, warrantyStarted,
        clientSigneeName, clientSignatureData, repSigneeName, repSignatureData, notes
      } = req.body;

      const handover = await prisma.handover.create({
        data: {
          projectId: parseInt(projectId),
          customerId: parseInt(customerId),
          elevatorModel: elevatorModel.trim(),
          serialNumber: serialNumber.trim(),
          installationDate: installationDate ? new Date(installationDate) : new Date(),
          handoverDate: handoverDate ? new Date(handoverDate) : new Date(),
          technicalInspection: technicalInspection === 'on' || technicalInspection === true,
          safetyCheck: safetyCheck === 'on' || safetyCheck === true,
          documentationHanded: documentationHanded === 'on' || documentationHanded === true,
          clientTrainingDone: clientTrainingDone === 'on' || clientTrainingDone === true,
          keysHanded: keysHanded === 'on' || keysHanded === true,
          accessActivated: accessActivated === 'on' || accessActivated === true,
          warrantyStarted: warrantyStarted === 'on' || warrantyStarted === true,
          clientSigneeName: clientSigneeName ? clientSigneeName.trim() : 'Klienti',
          clientSignatureData: clientSignatureData || null,
          repSigneeName: repSigneeName ? repSigneeName.trim() : (req.session.user?.fullName || 'Përfaqësues KRONEER'),
          repSignatureData: repSignatureData || null,
          notes: notes ? notes.trim() : null,
          status: 'Dorëzuar me Sukses'
        }
      });

      // Përditëso projektin në fazën 'Dorëzim' ose 'Përfunduar'
      await prisma.project.update({
        where: { id: parseInt(projectId) },
        data: { stage: 'Përfunduar', completedDate: new Date() }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Dorëzuar',
        entityType: 'Projekt',
        entityId: parseInt(projectId),
        description: `U krye me sukses dorëzimi teknik dhe u nënshkrua procesverbali për liftin SN: ${handover.serialNumber}.`
      });

      req.flash('success', `Procesverbali i dorëzimit për liftin ${handover.serialNumber} u krijua me sukses.`);
      res.redirect(`/dorezimi/${handover.id}`);
    } catch (err) {
      console.error('Gabim në krijimin e procesverbalit:', err);
      req.flash('error', 'Ndodhi një gabim gjatë krijimit të procesverbalit.');
      res.redirect('/dorezimi/krijo');
    }
  }

  static async getDetail(req, res) {
    try {
      const id = parseInt(req.params.id);
      const handover = await prisma.handover.findUnique({
        where: { id },
        include: {
          project: true,
          customer: true
        }
      });

      if (!handover) {
        req.flash('error', 'Procesverbali nuk u gjet.');
        return res.redirect('/dorezimi');
      }

      res.render('dorezimi/detajet', {
        pageTitle: `Procesverbal Dorëzimi (SN: ${handover.serialNumber}) - KRONEER`,
        handover
      });
    } catch (err) {
      console.error(err);
      res.redirect('/dorezimi');
    }
  }

  static async getPrint(req, res) {
    try {
      const id = parseInt(req.params.id);
      const handover = await prisma.handover.findUnique({
        where: { id },
        include: {
          project: true,
          customer: true
        }
      });

      if (!handover) {
        return res.status(404).send('Procesverbali nuk u gjet.');
      }

      res.render('dorezimi/print', {
        pageTitle: `Procesverbal_Dorezimi_${handover.serialNumber}`,
        handover,
        layout: 'layouts/print'
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Gabim në printim.');
    }
  }
}

module.exports = HandoverController;
