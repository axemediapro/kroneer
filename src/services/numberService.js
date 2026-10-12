const prisma = require('../config/prisma');

class NumberService {
  static async getNextNumber(type) {
    const year = new Date().getFullYear();
    const settings = await prisma.companySettings.findFirst() || {};

    let prefix = '';
    let count = 0;

    switch (type) {
      case 'quotation':
        prefix = `${settings.quotePrefix || 'KR-O'}-${year}-`;
        count = await prisma.quotation.count();
        break;
      case 'contract':
        prefix = `${settings.contractPrefix || 'KR-K'}-${year}-`;
        count = await prisma.contract.count();
        break;
      case 'proforma':
        prefix = `${settings.proformaPrefix || 'KR-PF'}-${year}-`;
        count = await prisma.proforma.count();
        break;
      case 'invoice': {
        const invoices = await prisma.invoice.findMany({ select: { number: true } });
        let maxInvNum = 0;
        for (const inv of invoices) {
          const match = (inv.number || '').match(/\d+$/);
          if (match) {
            const num = parseInt(match[0], 10);
            if (!isNaN(num) && num > maxInvNum) {
              maxInvNum = num;
            }
          }
        }
        return String(maxInvNum + 1);
      }
      case 'project':
        prefix = `${settings.projectPrefix || 'KR-PRJ'}-${year}-`;
        count = await prisma.project.count();
        break;
      case 'service':
        prefix = `${settings.servicePrefix || 'KR-SRV'}-${year}-`;
        count = await prisma.serviceTicket.count();
        break;
      case 'payment':
        prefix = `${settings.paymentPrefix || 'KR-PAG'}-${year}-`;
        count = await prisma.payment.count();
        break;
      case 'expense':
        prefix = `KR-SHP-${year}-`;
        count = await prisma.expense.count();
        break;
      case 'customer':
        prefix = 'KR-CUST-';
        count = await prisma.customer.count();
        return `${prefix}${String(count + 1).padStart(4, '0')}`;
      case 'employee':
        prefix = 'KR-PUNT-';
        count = await prisma.employee.count();
        return `${prefix}${String(count + 1).padStart(4, '0')}`;
      case 'maintenance':
        prefix = `KR-MNT-${year}-`;
        count = await prisma.maintenanceContract.count();
        break;
      case 'serial':
        prefix = `KR-SN-${year}-`;
        count = await prisma.installation.count();
        break;
      case 'employee_cash':
        prefix = `KR-KESH-${year}-`;
        count = await prisma.employeeTransaction.count({ where: { type: { in: ['KESH_AVANC', 'PAGESE_KESH'] } } });
        break;
      case 'employee_bonus':
        prefix = `KR-BON-${year}-`;
        count = await prisma.employeeTransaction.count({ where: { type: 'BONUS' } });
        break;
      case 'intervention':
        prefix = `KR-INT-${year}-`;
        count = await prisma.intervention.count();
        break;
      default:
        prefix = `KR-DOC-${year}-`;
        count = 1;
    }

    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }
}

module.exports = NumberService;
