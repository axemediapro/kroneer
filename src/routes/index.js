const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

const { isAuthenticated } = require('../middleware/auth');
const { authorizeRoles, denyFieldFromCrm } = require('../middleware/roles');
const { uploadLogo, uploadStamp, uploadBackupJson, uploadElevatorMedia } = require('../middleware/upload');

const AuthController = require('../controllers/authController');
const DashboardController = require('../controllers/dashboardController');
const CustomerController = require('../controllers/customerController');
const ElevatorController = require('../controllers/elevatorController');
const QuotationController = require('../controllers/quotationController');
const ContractController = require('../controllers/contractController');
const ProformaController = require('../controllers/proformaController');
const InvoiceController = require('../controllers/invoiceController');
const PaymentController = require('../controllers/paymentController');
const ExpenseController = require('../controllers/expenseController');
const ProjectController = require('../controllers/projectController');
const InstallationController = require('../controllers/installationController');
const HandoverController = require('../controllers/handoverController');
const MaintenanceController = require('../controllers/maintenanceController');
const ServiceController = require('../controllers/serviceController');
const SparePartController = require('../controllers/sparePartController');
const DocumentController = require('../controllers/documentController');
const ReportController = require('../controllers/reportController');
const SearchController = require('../controllers/searchController');
const SettingsController = require('../controllers/settingsController');
const EmployeeController = require('../controllers/employeeController');
const InterventionController = require('../controllers/interventionController');
const ManagerDashboardController = require('../controllers/managerDashboardController');
const OperationsHubController = require('../controllers/operationsHubController');

// 1. Autentifikimi
router.get('/kycu', AuthController.getLogin);
router.post('/kycu', AuthController.postLogin);
router.get('/dil', AuthController.logout);

// Root redirect
router.get('/', (req, res) => {
  if (req.session && req.session.user) {
    res.redirect('/paneli');
  } else {
    res.redirect('/kycu');
  }
});

// 2. Paneli Kryesor (Dashboard)
router.get('/paneli', isAuthenticated, (req, res, next) => {
  const role = req.session.user && req.session.user.role;
  if (role === 'MENAXHER_PROJEKTI') {
    return ManagerDashboardController.getIndex(req, res, next);
  }
  if (role === 'TEKNIK') {
    return DashboardController.getWorkerIndex(req, res, next);
  }
  return DashboardController.getIndex(req, res, next);
});
router.get('/menaxheri', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI'), ManagerDashboardController.getIndex);
router.post('/paneli/logo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE', 'FINANCE', 'MENAXHER_PROJEKTI'), uploadLogo.single('logo'), SettingsController.postUploadLogo);
router.post('/paneli/logo/fshi', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE', 'FINANCE', 'MENAXHER_PROJEKTI'), SettingsController.postDeleteLogo);
router.post('/paneli/vula', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE', 'FINANCE', 'MENAXHER_PROJEKTI'), uploadStamp.single('stamp'), SettingsController.postUploadStamp);
router.post('/paneli/vula/fshi', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE', 'FINANCE', 'MENAXHER_PROJEKTI'), SettingsController.postDeleteStamp);

// 3. Klientët (CRM)
router.get('/klientet', isAuthenticated, denyFieldFromCrm, authorizeRoles('ADMINISTRATOR', 'SHITJE'), CustomerController.getIndex);
router.get('/klientet/krijo', isAuthenticated, denyFieldFromCrm, authorizeRoles('ADMINISTRATOR', 'SHITJE'), CustomerController.getCreate);
router.post('/klientet/krijo', isAuthenticated, denyFieldFromCrm, authorizeRoles('ADMINISTRATOR', 'SHITJE'), CustomerController.postCreate);
router.post('/klientet/api/krijo-shpejte', isAuthenticated, denyFieldFromCrm, CustomerController.postQuickCreate);
router.get('/klientet/:id/pasqyra-pdf', isAuthenticated, denyFieldFromCrm, CustomerController.getStatementPrint);
router.get('/klientet/:id/pasqyra', isAuthenticated, denyFieldFromCrm, CustomerController.getStatementPrint);
router.get('/klientet/:id', isAuthenticated, denyFieldFromCrm, CustomerController.getDetail);
router.get('/klientet/:id/ndrysho', isAuthenticated, denyFieldFromCrm, authorizeRoles('ADMINISTRATOR', 'SHITJE'), CustomerController.getEdit);
router.post('/klientet/:id/ndrysho', isAuthenticated, denyFieldFromCrm, authorizeRoles('ADMINISTRATOR', 'SHITJE'), CustomerController.postEdit);
router.post('/klientet/:id/fshi', isAuthenticated, denyFieldFromCrm, authorizeRoles('ADMINISTRATOR'), CustomerController.postDelete);

// 4. Lifta & Konfiguruesi & Ndjekja Publike (Pa Kyçje)
router.get('/track/:token', InterventionController.getPublicTracking);
router.get('/p/intervenimet/:token', InterventionController.getPublicTracking);
router.get('/p/lifts/:id', ElevatorController.getPublicDetail);
router.get('/public/lifts/:id', ElevatorController.getPublicDetail);
router.get('/p/kontrata/:token', ContractController.getPublicDetail);
router.get('/public/kontrata/:token', ContractController.getPublicDetail);
router.get('/lifts', isAuthenticated, ElevatorController.getCatalog);
router.get('/lifts/katalogu', isAuthenticated, ElevatorController.getCatalog);
router.get('/lifts/konfiguruesi', isAuthenticated, ElevatorController.getConfigurator);
router.post('/lifts/konfiguruesi/ruaj', isAuthenticated, ElevatorController.postSaveConfiguration);
router.get('/lifts/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR'), ElevatorController.getCreate);
router.post('/lifts/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR'), ElevatorController.postCreate);
router.get('/lifts/:id', isAuthenticated, ElevatorController.getDetail);
router.get('/lifts/:id/ndrysho', isAuthenticated, authorizeRoles('ADMINISTRATOR'), ElevatorController.getEdit);
router.post('/lifts/:id/ndrysho', isAuthenticated, authorizeRoles('ADMINISTRATOR'), ElevatorController.postEdit);
router.post('/lifts/:id/fshi', isAuthenticated, authorizeRoles('ADMINISTRATOR'), ElevatorController.postDelete);
router.post('/lifts/:id/media', isAuthenticated, authorizeRoles('ADMINISTRATOR'), uploadElevatorMedia.array('media', 10), ElevatorController.postUploadMedia);
router.post('/lifts/:id/media/:mediaId/fshi', isAuthenticated, authorizeRoles('ADMINISTRATOR'), ElevatorController.postDeleteMedia);

// 5. Ofertat
router.get('/ofertat', isAuthenticated, denyFieldFromCrm, authorizeRoles('ADMINISTRATOR', 'SHITJE'), QuotationController.getIndex);
router.get('/ofertat/krijo', isAuthenticated, denyFieldFromCrm, authorizeRoles('ADMINISTRATOR', 'SHITJE'), QuotationController.getCreate);
router.post('/ofertat/krijo', isAuthenticated, denyFieldFromCrm, authorizeRoles('ADMINISTRATOR', 'SHITJE'), QuotationController.postCreate);
router.get('/ofertat/:id', isAuthenticated, denyFieldFromCrm, QuotationController.getDetail);
router.get('/ofertat/:id/ndrysho', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE'), QuotationController.getEdit);
router.post('/ofertat/:id/ndrysho', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE'), QuotationController.postEdit);
router.post('/ofertat/:id/fshi', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE'), QuotationController.postDelete);
router.get('/ofertat/:id/print', isAuthenticated, QuotationController.getPrint);
router.post('/ofertat/:id/status', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE'), QuotationController.postUpdateStatus);
router.post('/ofertat/:id/dupliko', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE'), QuotationController.postDuplicate);
router.post('/ofertat/:id/kontrate', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE'), QuotationController.postConvertToContract);
router.post('/ofertat/:id/fature', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE', 'FINANCE'), QuotationController.postConvertToInvoice);
router.post('/ofertat/:id/profature', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE', 'FINANCE'), QuotationController.postConvertToInvoice);

// 6. Kontratat
router.get('/kontratat', isAuthenticated, denyFieldFromCrm, authorizeRoles('ADMINISTRATOR', 'SHITJE', 'FINANCE'), ContractController.getIndex);
router.get('/kontratat/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE'), ContractController.getCreate);
router.post('/kontratat/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE'), ContractController.postCreate);
router.get('/kontratat/:id', isAuthenticated, denyFieldFromCrm, ContractController.getDetail);
router.get('/kontratat/:id/ndrysho', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE'), ContractController.getEdit);
router.post('/kontratat/:id/ndrysho', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE'), ContractController.postEdit);
router.post('/kontratat/:id/fshi', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE'), ContractController.postDelete);
router.post('/kontratat/:id/status', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE'), ContractController.postUpdateStatus);
router.get('/kontratat/:id/print', isAuthenticated, ContractController.getPrint);

// 7. Ridrejtimi i Profaturave në Fatura
router.all('/profaturat*', (req, res) => res.redirect('/faturat'));

// 8. Faturat
router.get('/faturat', isAuthenticated, denyFieldFromCrm, authorizeRoles('ADMINISTRATOR', 'FINANCE'), InvoiceController.getIndex);
router.get('/faturat/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'FINANCE'), InvoiceController.getCreate);
router.post('/faturat/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'FINANCE'), InvoiceController.postCreate);
router.get('/faturat/:id', isAuthenticated, denyFieldFromCrm, InvoiceController.getDetail);
router.get('/faturat/:id/ndrysho', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'FINANCE'), InvoiceController.getEdit);
router.post('/faturat/:id/ndrysho', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'FINANCE'), InvoiceController.postEdit);
router.post('/faturat/:id/fshi', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'FINANCE'), InvoiceController.postDelete);
router.get('/faturat/:id/print', isAuthenticated, InvoiceController.getPrint);

// 9. Pagesat
router.get('/pagesat', isAuthenticated, denyFieldFromCrm, authorizeRoles('ADMINISTRATOR', 'FINANCE'), PaymentController.getIndex);
router.get('/pagesat/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'FINANCE'), PaymentController.getCreate);
router.post('/pagesat/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'FINANCE'), PaymentController.postCreate);
router.get('/pagesat/:id/deftese', isAuthenticated, PaymentController.getReceipt);

// 9.1 Shpenzimet
router.get('/shpenzimet', isAuthenticated, denyFieldFromCrm, authorizeRoles('ADMINISTRATOR', 'FINANCE'), ExpenseController.getIndex);
router.get('/shpenzimet/krijo', isAuthenticated, denyFieldFromCrm, authorizeRoles('ADMINISTRATOR', 'FINANCE'), ExpenseController.getCreate);
router.post('/shpenzimet/krijo', isAuthenticated, denyFieldFromCrm, authorizeRoles('ADMINISTRATOR', 'FINANCE'), ExpenseController.postCreate);
router.get('/shpenzimet/eksporto-pdf', isAuthenticated, denyFieldFromCrm, authorizeRoles('ADMINISTRATOR', 'FINANCE'), ExpenseController.getExportList);
router.get('/shpenzimet/:id', isAuthenticated, denyFieldFromCrm, ExpenseController.getDetail);
router.get('/shpenzimet/:id/ndrysho', isAuthenticated, denyFieldFromCrm, authorizeRoles('ADMINISTRATOR', 'FINANCE'), ExpenseController.getEdit);
router.post('/shpenzimet/:id/ndrysho', isAuthenticated, denyFieldFromCrm, authorizeRoles('ADMINISTRATOR', 'FINANCE'), ExpenseController.postEdit);
router.post('/shpenzimet/:id/fshi', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'FINANCE'), ExpenseController.postDelete);
router.get('/shpenzimet/:id/print', isAuthenticated, ExpenseController.getPrint);

// 10. Projektet & Ekipet
router.get('/projektet', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI', 'TEKNIK'), ProjectController.getIndex);
router.get('/projektet/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI'), ProjectController.getCreate);
router.post('/projektet/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI'), ProjectController.postCreate);
router.get('/projektet/:id', isAuthenticated, ProjectController.getDetail);
router.post('/projektet/:id/faza', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI'), ProjectController.postUpdateStage);
router.post('/projektet/:id/ekipi', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI'), ProjectController.postAddTeamMember);
router.post('/projektet/:id/ekipi/:memberId/fshi', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI'), ProjectController.postRemoveTeamMember);
router.post('/projektet/:id/menaxheri', isAuthenticated, authorizeRoles('ADMINISTRATOR'), ProjectController.postUpdateProjectManager);

// 10.1 Intervenimet në Terren & Ekipet
router.get('/intervenimet', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI', 'TEKNIK'), InterventionController.getIndex);
router.get('/intervenimet/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI', 'TEKNIK'), InterventionController.getCreate);
router.post('/intervenimet/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI', 'TEKNIK'), InterventionController.postCreate);
router.get('/intervenimet/:id/print', isAuthenticated, InterventionController.getPrint);
router.get('/intervenimet/:id', isAuthenticated, InterventionController.getDetail);
router.post('/intervenimet/:id/status', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI', 'TEKNIK'), InterventionController.postUpdateStatus);
router.post('/intervenimet/:id/workers', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI'), InterventionController.postAddWorker);
router.post('/intervenimet/:id/workers/:workerId/fshi', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI'), InterventionController.postRemoveWorker);

// 11. Qendra e Instalimeve
router.get('/instalimet', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI', 'TEKNIK'), InstallationController.getIndex);
router.get('/instalimet/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI'), InstallationController.getCreate);
router.post('/instalimet/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI'), InstallationController.postCreate);
router.get('/instalimet/:id', isAuthenticated, InstallationController.getDetail);
router.post('/instalimet/:id/checklist', isAuthenticated, InstallationController.postToggleChecklist);
router.post('/instalimet/:id/checklist-toggle', isAuthenticated, InstallationController.postToggleChecklist);

// 11.1 Sistemi Publik i Ndjekjes së Liftit në Kohë Reale (Public Encrypted Client Portal)
router.get('/track/lift/:token', InstallationController.getPublicLiftTracking);
router.get('/p/lift/:token', InstallationController.getPublicLiftTracking);
router.post('/track/lift/:token/report-issue', InstallationController.postPublicReportIssue);

// 12. Dorëzimi i Liftit
router.get('/dorezimi', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI', 'TEKNIK'), HandoverController.getIndex);
router.get('/dorezimi/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI', 'TEKNIK'), HandoverController.getCreate);
router.post('/dorezimi/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI', 'TEKNIK'), HandoverController.postCreate);
router.get('/dorezimi/:id', isAuthenticated, HandoverController.getDetail);
router.get('/dorezimi/:id/print', isAuthenticated, HandoverController.getPrint);

// 13. Servisi & Mirëmbajtja (Shtylla 3 - E Integruar)
router.get('/servisi-mirembajtja', isAuthenticated, OperationsHubController.getServiceMaintenance);

// 13.1 Mirëmbajtja
router.get('/mirembajtja', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'TEKNIK', 'MENAXHER_PROJEKTI'), MaintenanceController.getIndex);
router.get('/mirembajtja/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'TEKNIK', 'MENAXHER_PROJEKTI'), MaintenanceController.getCreate);
router.post('/mirembajtja/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'TEKNIK', 'MENAXHER_PROJEKTI'), MaintenanceController.postCreate);
router.get('/mirembajtja/:id', isAuthenticated, MaintenanceController.getDetail);
router.get('/mirembajtja/:id/ndrysho', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'TEKNIK', 'MENAXHER_PROJEKTI'), MaintenanceController.getEdit);
router.post('/mirembajtja/:id/ndrysho', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'TEKNIK', 'MENAXHER_PROJEKTI'), MaintenanceController.postEdit);
router.get('/mirembajtja/:id/print', isAuthenticated, MaintenanceController.getPrint);
router.post('/mirembajtja/:id/fshi', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'TEKNIK', 'MENAXHER_PROJEKTI'), MaintenanceController.postDelete);
router.post('/mirembajtja/:id/vizite', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'TEKNIK'), MaintenanceController.postAddVisit);

// 14. Servisi
router.get('/servisi', isAuthenticated, ServiceController.getIndex);
router.get('/servisi/krijo', isAuthenticated, ServiceController.getCreate);
router.post('/servisi/krijo', isAuthenticated, ServiceController.postCreate);
router.get('/servisi/:id', isAuthenticated, ServiceController.getDetail);
router.get('/servisi/:id/print', isAuthenticated, ServiceController.getPrint);
router.post('/servisi/:id/status', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'TEKNIK', 'MENAXHER_PROJEKTI'), ServiceController.postUpdateStatus);

// 14.1 Modernizimi (Shtylla 4)
router.get('/modernizimi', isAuthenticated, OperationsHubController.getModernization);

// 15. Pjesët Rezervë & Magazina / Katalogu
router.get('/pjeset-rezerve', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'TEKNIK', 'MENAXHER_PROJEKTI', 'FINANCE', 'SHITJE'), SparePartController.getIndex);
router.get('/pjeset-rezerve/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI'), SparePartController.getCreate);
router.post('/pjeset-rezerve/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI'), SparePartController.postCreate);
router.post('/pjeset-rezerve/:id/stok', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI'), SparePartController.postUpdateStock);
router.get('/pjeset-rezerve/:id/ndrysho', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI', 'FINANCE'), SparePartController.getEdit);
router.post('/pjeset-rezerve/:id/ndrysho', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI', 'FINANCE'), SparePartController.postEdit);
router.get('/api/katalogu/kerko', isAuthenticated, SparePartController.apiLiveSearchItems);
router.get('/api/spare-parts/search', isAuthenticated, SparePartController.apiLiveSearchItems);

// 16. Qendra e Dokumenteve
router.get('/dokumentet', isAuthenticated, DocumentController.getIndex);
router.get('/dokumentet/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE', 'FINANCE'), DocumentController.getCreate);
router.post('/dokumentet/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE', 'FINANCE'), DocumentController.postCreate);

// 16.1 Puntorët & Stafi
router.get('/puntoret', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI', 'FINANCE'), EmployeeController.getIndex);
router.get('/puntoret/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI'), EmployeeController.getCreate);
router.post('/puntoret/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI'), EmployeeController.postCreate);
router.get('/puntoret/financat/kesh-bonuse', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI', 'FINANCE'), EmployeeController.getCashAndBonusesOverview);
router.post('/puntoret/transaksionet', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI', 'FINANCE'), EmployeeController.postAddTransaction);
router.post('/puntoret/transaksionet/:id/fshi', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI', 'FINANCE'), EmployeeController.postDeleteTransaction);
router.get('/puntoret/transaksionet/:id/print', isAuthenticated, EmployeeController.getTransactionReceipt);
router.get('/puntoret/:id', isAuthenticated, EmployeeController.getDetail);
router.get('/puntoret/:id/ndrysho', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI'), EmployeeController.getEdit);
router.post('/puntoret/:id/ndrysho', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI'), EmployeeController.postEdit);
router.post('/puntoret/:id/llogaria', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI'), EmployeeController.postManageAccount);
router.post('/puntoret/:id/fshi', isAuthenticated, authorizeRoles('ADMINISTRATOR'), EmployeeController.postDelete);

// 16.2 Prezenca & Orari i Punës (Attendance Software)
router.get('/prezenca', isAuthenticated, EmployeeController.getAttendanceDashboard);
router.get('/prezenca/print', isAuthenticated, EmployeeController.getAttendancePrint);
router.post('/prezenca/nis-punen', isAuthenticated, EmployeeController.postClockIn);
router.post('/prezenca/nis-pauzen', isAuthenticated, EmployeeController.postStartBreak);
router.post('/prezenca/perfundo-pauzen', isAuthenticated, EmployeeController.postEndBreak);
router.post('/prezenca/perfundo-punen', isAuthenticated, EmployeeController.postClockOut);
router.post('/prezenca/manual', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI'), EmployeeController.postManualAttendance);
router.post('/prezenca/:id/fshi', isAuthenticated, authorizeRoles('ADMINISTRATOR'), EmployeeController.postDeleteAttendance);

// 17. Raportet
router.get('/raportet', isAuthenticated, denyFieldFromCrm, authorizeRoles('ADMINISTRATOR', 'FINANCE', 'SHITJE'), ReportController.getIndex);

// 18. Kërkimi Global
router.get('/kerko', isAuthenticated, SearchController.search);
router.get('/api/kerko', isAuthenticated, SearchController.apiLiveSearch);

// 19. Njoftimet API
router.post('/api/njoftimet/lexo/:id', isAuthenticated, async (req, res) => {
  try {
    await prisma.notification.update({
      where: { id: parseInt(req.params.id) },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false });
  }
});

router.post('/api/njoftimet/lexo-te-gjitha', isAuthenticated, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: {
        OR: [{ userId: req.session.user?.id }, { userId: null }]
      },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false });
  }
});

// 20. Cilësimet & Settings & Përdoruesit
router.get('/settings', isAuthenticated, (req, res) => res.redirect('/cilesimet'));
router.get('/perdoruesit', isAuthenticated, (req, res) => res.redirect('/cilesimet#perdoruesit'));
router.get('/cilesimet', isAuthenticated, (req, res, next) => {
  if (req.session.user && req.session.user.role === 'ADMINISTRATOR') {
    return SettingsController.getIndex(req, res, next);
  }
  return SettingsController.getProfile(req, res, next);
});
router.post('/cilesimet/profili', isAuthenticated, SettingsController.postUpdateProfile);
router.post('/cilesimet/logo', isAuthenticated, authorizeRoles('ADMINISTRATOR'), uploadLogo.single('logo'), SettingsController.postUploadLogo);
router.post('/cilesimet/logo/fshi', isAuthenticated, authorizeRoles('ADMINISTRATOR'), SettingsController.postDeleteLogo);
router.post('/cilesimet/vula', isAuthenticated, authorizeRoles('ADMINISTRATOR'), uploadStamp.single('stamp'), SettingsController.postUploadStamp);
router.post('/cilesimet/vula/fshi', isAuthenticated, authorizeRoles('ADMINISTRATOR'), SettingsController.postDeleteStamp);
router.post('/cilesimet/vula/madhesia', isAuthenticated, authorizeRoles('ADMINISTRATOR'), SettingsController.postUpdateStampSize);
router.post('/cilesimet/kompania', isAuthenticated, authorizeRoles('ADMINISTRATOR'), SettingsController.postUpdateCompany);
router.post('/cilesimet/perdoruesit/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR'), SettingsController.postCreateUser);
router.post('/cilesimet/perdoruesit/:id/ndrysho', isAuthenticated, authorizeRoles('ADMINISTRATOR'), SettingsController.postEditUser);
router.post('/cilesimet/perdoruesit/:id/status', isAuthenticated, authorizeRoles('ADMINISTRATOR'), SettingsController.postToggleUserStatus);
router.post('/cilesimet/perdoruesit/:id/fshi', isAuthenticated, authorizeRoles('ADMINISTRATOR'), SettingsController.postDeleteUser);
router.get('/cilesimet/backup', isAuthenticated, authorizeRoles('ADMINISTRATOR'), SettingsController.getBackup);
router.post('/cilesimet/restore', isAuthenticated, authorizeRoles('ADMINISTRATOR'), uploadBackupJson.single('backupFile'), SettingsController.postRestore);

module.exports = router;
