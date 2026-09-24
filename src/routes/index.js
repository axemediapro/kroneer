const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

const { isAuthenticated } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/roles');
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
router.get('/paneli', isAuthenticated, DashboardController.getIndex);
router.post('/paneli/logo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE', 'FINANCE', 'MENAXHER_PROJEKTI'), uploadLogo.single('logo'), SettingsController.postUploadLogo);
router.post('/paneli/logo/fshi', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE', 'FINANCE', 'MENAXHER_PROJEKTI'), SettingsController.postDeleteLogo);
router.post('/paneli/vula', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE', 'FINANCE', 'MENAXHER_PROJEKTI'), uploadStamp.single('stamp'), SettingsController.postUploadStamp);
router.post('/paneli/vula/fshi', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE', 'FINANCE', 'MENAXHER_PROJEKTI'), SettingsController.postDeleteStamp);

// 3. Klientët (CRM)
router.get('/klientet', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE', 'MENAXHER_PROJEKTI'), CustomerController.getIndex);
router.get('/klientet/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE'), CustomerController.getCreate);
router.post('/klientet/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE'), CustomerController.postCreate);
router.post('/klientet/api/krijo-shpejte', isAuthenticated, CustomerController.postQuickCreate);
router.get('/klientet/:id/pasqyra-pdf', isAuthenticated, CustomerController.getStatementPrint);
router.get('/klientet/:id/pasqyra', isAuthenticated, CustomerController.getStatementPrint);
router.get('/klientet/:id', isAuthenticated, CustomerController.getDetail);
router.get('/klientet/:id/ndrysho', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE'), CustomerController.getEdit);
router.post('/klientet/:id/ndrysho', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE'), CustomerController.postEdit);
router.post('/klientet/:id/fshi', isAuthenticated, authorizeRoles('ADMINISTRATOR'), CustomerController.postDelete);

// 4. Lifta & Konfiguruesi (Publike & ERP)
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
router.post('/lifts/:id/media', isAuthenticated, authorizeRoles('ADMINISTRATOR'), uploadElevatorMedia.single('media'), ElevatorController.postUploadMedia);
router.post('/lifts/:id/media/:mediaId/fshi', isAuthenticated, authorizeRoles('ADMINISTRATOR'), ElevatorController.postDeleteMedia);

// 5. Ofertat
router.get('/ofertat', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE'), QuotationController.getIndex);
router.get('/ofertat/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE'), QuotationController.getCreate);
router.post('/ofertat/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE'), QuotationController.postCreate);
router.get('/ofertat/:id', isAuthenticated, QuotationController.getDetail);
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
router.get('/kontratat', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE', 'FINANCE', 'MENAXHER_PROJEKTI'), ContractController.getIndex);
router.get('/kontratat/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE'), ContractController.getCreate);
router.post('/kontratat/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE'), ContractController.postCreate);
router.get('/kontratat/:id', isAuthenticated, ContractController.getDetail);
router.get('/kontratat/:id/ndrysho', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE'), ContractController.getEdit);
router.post('/kontratat/:id/ndrysho', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE'), ContractController.postEdit);
router.post('/kontratat/:id/fshi', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE'), ContractController.postDelete);
router.post('/kontratat/:id/status', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'SHITJE'), ContractController.postUpdateStatus);
router.get('/kontratat/:id/print', isAuthenticated, ContractController.getPrint);

// 7. Ridrejtimi i Profaturave në Fatura
router.all('/profaturat*', (req, res) => res.redirect('/faturat'));

// 8. Faturat
router.get('/faturat', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'FINANCE'), InvoiceController.getIndex);
router.get('/faturat/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'FINANCE'), InvoiceController.getCreate);
router.post('/faturat/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'FINANCE'), InvoiceController.postCreate);
router.get('/faturat/:id', isAuthenticated, InvoiceController.getDetail);
router.get('/faturat/:id/ndrysho', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'FINANCE'), InvoiceController.getEdit);
router.post('/faturat/:id/ndrysho', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'FINANCE'), InvoiceController.postEdit);
router.post('/faturat/:id/fshi', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'FINANCE'), InvoiceController.postDelete);
router.get('/faturat/:id/print', isAuthenticated, InvoiceController.getPrint);

// 9. Pagesat
router.get('/pagesat', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'FINANCE'), PaymentController.getIndex);
router.get('/pagesat/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'FINANCE'), PaymentController.getCreate);
router.post('/pagesat/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'FINANCE'), PaymentController.postCreate);
router.get('/pagesat/:id/deftese', isAuthenticated, PaymentController.getReceipt);

// 9.1 Shpenzimet
router.get('/shpenzimet', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'FINANCE', 'MENAXHER_PROJEKTI'), ExpenseController.getIndex);
router.get('/shpenzimet/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'FINANCE', 'MENAXHER_PROJEKTI'), ExpenseController.getCreate);
router.post('/shpenzimet/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'FINANCE', 'MENAXHER_PROJEKTI'), ExpenseController.postCreate);
router.get('/shpenzimet/eksporto-pdf', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'FINANCE', 'MENAXHER_PROJEKTI'), ExpenseController.getExportList);
router.get('/shpenzimet/:id', isAuthenticated, ExpenseController.getDetail);
router.get('/shpenzimet/:id/ndrysho', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'FINANCE', 'MENAXHER_PROJEKTI'), ExpenseController.getEdit);
router.post('/shpenzimet/:id/ndrysho', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'FINANCE', 'MENAXHER_PROJEKTI'), ExpenseController.postEdit);
router.post('/shpenzimet/:id/fshi', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'FINANCE'), ExpenseController.postDelete);
router.get('/shpenzimet/:id/print', isAuthenticated, ExpenseController.getPrint);

// 10. Projektet
router.get('/projektet', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI', 'TEKNIK'), ProjectController.getIndex);
router.get('/projektet/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI'), ProjectController.getCreate);
router.post('/projektet/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI'), ProjectController.postCreate);
router.get('/projektet/:id', isAuthenticated, ProjectController.getDetail);
router.post('/projektet/:id/faza', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI'), ProjectController.postUpdateStage);

// 11. Qendra e Instalimeve
router.get('/instalimet', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI', 'TEKNIK'), InstallationController.getIndex);
router.get('/instalimet/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI'), InstallationController.getCreate);
router.post('/instalimet/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI'), InstallationController.postCreate);
router.get('/instalimet/:id', isAuthenticated, InstallationController.getDetail);
router.post('/instalimet/:id/checklist', isAuthenticated, InstallationController.postToggleChecklist);

// 12. Dorëzimi i Liftit
router.get('/dorezimi', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI', 'TEKNIK'), HandoverController.getIndex);
router.get('/dorezimi/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI', 'TEKNIK'), HandoverController.getCreate);
router.post('/dorezimi/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI', 'TEKNIK'), HandoverController.postCreate);
router.get('/dorezimi/:id', isAuthenticated, HandoverController.getDetail);
router.get('/dorezimi/:id/print', isAuthenticated, HandoverController.getPrint);

// 13. Mirëmbajtja
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
router.get('/servisi', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'TEKNIK', 'MENAXHER_PROJEKTI'), ServiceController.getIndex);
router.get('/servisi/krijo', isAuthenticated, ServiceController.getCreate);
router.post('/servisi/krijo', isAuthenticated, ServiceController.postCreate);
router.post('/servisi/:id/status', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'TEKNIK', 'MENAXHER_PROJEKTI'), ServiceController.postUpdateStatus);

// 15. Pjesët Rezervë
router.get('/pjeset-rezerve', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'TEKNIK', 'MENAXHER_PROJEKTI'), SparePartController.getIndex);
router.get('/pjeset-rezerve/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'TEKNIK'), SparePartController.getCreate);
router.post('/pjeset-rezerve/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'TEKNIK'), SparePartController.postCreate);
router.post('/pjeset-rezerve/:id/stok', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'TEKNIK'), SparePartController.postUpdateStock);

// 16. Qendra e Dokumenteve
router.get('/dokumentet', isAuthenticated, DocumentController.getIndex);
router.get('/dokumentet/krijo', isAuthenticated, DocumentController.getCreate);
router.post('/dokumentet/krijo', isAuthenticated, DocumentController.postCreate);

// 16.1 Puntorët & Stafi
router.get('/puntoret', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI', 'FINANCE'), EmployeeController.getIndex);
router.get('/puntoret/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI'), EmployeeController.getCreate);
router.post('/puntoret/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI'), EmployeeController.postCreate);
router.get('/puntoret/:id', isAuthenticated, EmployeeController.getDetail);
router.get('/puntoret/:id/ndrysho', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI'), EmployeeController.getEdit);
router.post('/puntoret/:id/ndrysho', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'MENAXHER_PROJEKTI'), EmployeeController.postEdit);
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
router.get('/raportet', isAuthenticated, authorizeRoles('ADMINISTRATOR', 'FINANCE', 'SHITJE', 'MENAXHER_PROJEKTI'), ReportController.getIndex);

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
router.get('/cilesimet', isAuthenticated, authorizeRoles('ADMINISTRATOR'), SettingsController.getIndex);
router.post('/cilesimet/logo', isAuthenticated, authorizeRoles('ADMINISTRATOR'), uploadLogo.single('logo'), SettingsController.postUploadLogo);
router.post('/cilesimet/logo/fshi', isAuthenticated, authorizeRoles('ADMINISTRATOR'), SettingsController.postDeleteLogo);
router.post('/cilesimet/vula', isAuthenticated, authorizeRoles('ADMINISTRATOR'), uploadStamp.single('stamp'), SettingsController.postUploadStamp);
router.post('/cilesimet/vula/fshi', isAuthenticated, authorizeRoles('ADMINISTRATOR'), SettingsController.postDeleteStamp);
router.post('/cilesimet/kompania', isAuthenticated, authorizeRoles('ADMINISTRATOR'), SettingsController.postUpdateCompany);
router.post('/cilesimet/perdoruesit/krijo', isAuthenticated, authorizeRoles('ADMINISTRATOR'), SettingsController.postCreateUser);
router.post('/cilesimet/perdoruesit/:id/ndrysho', isAuthenticated, authorizeRoles('ADMINISTRATOR'), SettingsController.postEditUser);
router.post('/cilesimet/perdoruesit/:id/status', isAuthenticated, authorizeRoles('ADMINISTRATOR'), SettingsController.postToggleUserStatus);
router.post('/cilesimet/perdoruesit/:id/fshi', isAuthenticated, authorizeRoles('ADMINISTRATOR'), SettingsController.postDeleteUser);
router.get('/cilesimet/backup', isAuthenticated, authorizeRoles('ADMINISTRATOR'), SettingsController.getBackup);
router.post('/cilesimet/restore', isAuthenticated, authorizeRoles('ADMINISTRATOR'), uploadBackupJson.single('backupFile'), SettingsController.postRestore);

module.exports = router;
