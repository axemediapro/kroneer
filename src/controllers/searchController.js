const prisma = require('../config/prisma');
const { ownedProjectsWhere } = require('../services/projectScope');
const { isFieldStaff } = require('../middleware/roles');

function projectSearchWhere(user, q) {
  const textMatch = {
    OR: [
      { name: { contains: q } },
      { number: { contains: q } }
    ]
  };
  const scope = ownedProjectsWhere(user);
  if (scope && Object.keys(scope).length > 0) {
    return { AND: [scope, textMatch] };
  }
  return textMatch;
}

class SearchController {
  static async search(req, res) {
    try {
      const q = (req.query.q || '').trim();

      if (!q) {
        return res.render('kerko/index', {
          pageTitle: 'Kërkimi Global - KRONEER',
          query: '',
          results: {
            customers: [],
            projects: [],
            quotations: [],
            contracts: [],
            invoices: [],
            installations: [],
            serviceTickets: [],
            spareParts: [],
            expenses: [],
            documents: []
          },
          totalResults: 0
        });
      }

      const [
        customers,
        projects,
        quotations,
        contracts,
        invoices,
        installations,
        serviceTickets,
        spareParts,
        expenses,
        documents,
        employees
      ] = await Promise.all([
        prisma.customer.findMany({
          where: {
            OR: [
              { companyName: { contains: q } },
              { contactPerson: { contains: q } },
              { code: { contains: q } },
              { phone: { contains: q } },
              { buildingName: { contains: q } }
            ]
          },
          take: 5
        }),
        prisma.project.findMany({
          where: projectSearchWhere(req.session.user, q),
          include: { customer: true },
          take: 5
        }),
        prisma.quotation.findMany({
          where: {
            OR: [
              { number: { contains: q } },
              { notes: { contains: q } }
            ]
          },
          include: { customer: true },
          take: 5
        }),
        prisma.contract.findMany({
          where: {
            OR: [
              { number: { contains: q } },
              { specialTerms: { contains: q } }
            ]
          },
          include: { customer: true },
          take: 5
        }),
        prisma.invoice.findMany({
          where: {
            OR: [
              { number: { contains: q } },
              { notes: { contains: q } }
            ]
          },
          include: { customer: true },
          take: 5
        }),
        prisma.installation.findMany({
          where: {
            OR: [
              { serialNumber: { contains: q } },
              { elevatorModel: { contains: q } }
            ]
          },
          include: { project: { include: { customer: true } } },
          take: 5
        }),
        prisma.serviceTicket.findMany({
          where: {
            OR: [
              { number: { contains: q } },
              { serialNumber: { contains: q } },
              { problemDescription: { contains: q } }
            ]
          },
          include: { customer: true },
          take: 5
        }),
        prisma.sparePart.findMany({
          where: {
            OR: [
              { partNumber: { contains: q } },
              { name: { contains: q } },
              { compatibleElevators: { contains: q } }
            ]
          },
          take: 5
        }),
        prisma.expense.findMany({
          where: {
            OR: [
              { number: { contains: q } },
              { title: { contains: q } },
              { supplier: { contains: q } },
              { referenceNumber: { contains: q } }
            ]
          },
          take: 5
        }),
        prisma.document.findMany({
          where: {
            OR: [
              { title: { contains: q } },
              { documentType: { contains: q } }
            ]
          },
          include: { customer: true },
          take: 5
        }),
        prisma.employee.findMany({
          where: {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { code: { contains: q, mode: 'insensitive' } },
              { position: { contains: q, mode: 'insensitive' } }
            ]
          },
          take: 5
        })
      ]);

      const totalResults = customers.length + projects.length + quotations.length +
        contracts.length + invoices.length + installations.length +
        serviceTickets.length + spareParts.length + expenses.length + documents.length + employees.length;

      res.render('kerko/index', {
        pageTitle: `Rezultatet e kërkimit: "${q}" - KRONEER`,
        query: q,
        results: {
          customers,
          projects,
          quotations,
          contracts,
          invoices,
          installations,
          serviceTickets,
          spareParts,
          expenses,
          documents,
          employees
        },
        totalResults
      });
    } catch (err) {
      console.error('Gabim në kërkimin global:', err);
      res.redirect('/paneli');
    }
  }

  static async apiLiveSearch(req, res) {
    try {
      const q = (req.query.q || '').trim();
      if (!q || q.length < 2) {
        return res.json({ items: [] });
      }

      const fieldOnly = isFieldStaff(req.session.user);
      const empty = Promise.resolve([]);

      const [customers, projects, quotations, invoices, installations, serviceTickets, contracts, spareParts, expenses, documents, employees] = await Promise.all([
        fieldOnly ? empty : prisma.customer.findMany({
          where: {
            OR: [
              { companyName: { contains: q } },
              { code: { contains: q } }
            ]
          },
          take: 3
        }),
        prisma.project.findMany({
          where: projectSearchWhere(req.session.user, q),
          take: 3
        }),
        fieldOnly ? empty : prisma.quotation.findMany({
          where: { number: { contains: q } },
          include: { customer: true },
          take: 3
        }),
        fieldOnly ? empty : prisma.invoice.findMany({
          where: { number: { contains: q } },
          include: { customer: true },
          take: 3
        }),
        prisma.installation.findMany({
          where: {
            OR: [
              { serialNumber: { contains: q } },
              { elevatorModel: { contains: q } }
            ]
          },
          take: 3
        }),
        prisma.serviceTicket.findMany({
          where: {
            OR: [
              { number: { contains: q } },
              { serialNumber: { contains: q } }
            ]
          },
          take: 3
        }),
        fieldOnly ? empty : prisma.contract.findMany({
          where: { number: { contains: q } },
          include: { customer: true },
          take: 3
        }),
        prisma.sparePart.findMany({
          where: {
            OR: [
              { partNumber: { contains: q } },
              { name: { contains: q } }
            ]
          },
          take: 3
        }),
        fieldOnly ? empty : prisma.expense.findMany({
          where: {
            OR: [
              { number: { contains: q } },
              { title: { contains: q } }
            ]
          },
          take: 3
        }),
        prisma.document.findMany({
          where: { title: { contains: q } },
          take: 3
        }),
        prisma.employee.findMany({
          where: {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { code: { contains: q, mode: 'insensitive' } }
            ]
          },
          take: 3
        })
      ]);

      const items = [];

      customers.forEach(c => {
        items.push({
          title: c.companyName,
          subtitle: `Klient (${c.code}) • ${c.city || 'Kosovë'}`,
          url: `/klientet/${c.id}`,
          category: 'Klient'
        });
      });

      projects.forEach(p => {
        items.push({
          title: p.name,
          subtitle: `Projekt (${p.number}) • Faza: ${p.stage}`,
          url: `/projektet/${p.id}`,
          category: 'Projekt'
        });
      });

      quotations.forEach(q => {
        items.push({
          title: `Oferta ${q.number}`,
          subtitle: `${q.customer.companyName} • ${(q.total || 0).toLocaleString('de-DE')} €`,
          url: `/ofertat/${q.id}`,
          category: 'Ofertë'
        });
      });

      invoices.forEach(i => {
        items.push({
          title: `Fatura ${i.number}`,
          subtitle: `${i.customer.companyName} • ${(i.total || 0).toLocaleString('de-DE')} €`,
          url: `/faturat/${i.id}`,
          category: 'Faturë'
        });
      });

      installations.forEach(inst => {
        items.push({
          title: `${inst.elevatorModel} (SN: ${inst.serialNumber})`,
          subtitle: `Instalim • Progresi: ${inst.progressPercent}%`,
          url: `/instalimet/${inst.id}`,
          category: 'Instalim'
        });
      });

      serviceTickets.forEach(st => {
        items.push({
          title: `Servis ${st.number}`,
          subtitle: `SN: ${st.serialNumber || '-'} • Prioriteti: ${st.priority}`,
          url: `/servisi`,
          category: 'Servis'
        });
      });

      contracts.forEach(c => {
        items.push({
          title: `Kontrata ${c.number}`,
          subtitle: `${c.customer.companyName} • ${(c.value || 0).toLocaleString('de-DE')} €`,
          url: `/kontratat/${c.id}`,
          category: 'Kontratë'
        });
      });

      spareParts.forEach(p => {
        items.push({
          title: p.name,
          subtitle: `Pjesë Rezervë (${p.partNumber}) • Stoku: ${p.stockQty}`,
          url: `/pjeset-rezerve`,
          category: 'Pjesë Rezervë'
        });
      });

      expenses.forEach(e => {
        items.push({
          title: `Shpenzimi ${e.number}`,
          subtitle: `${e.title} • ${(e.amount || 0).toLocaleString('de-DE')} €`,
          url: `/shpenzimet`,
          category: 'Shpenzim'
        });
      });

      documents.forEach(d => {
        items.push({
          title: d.title,
          subtitle: `Dokument • ${d.documentType}`,
          url: `/dokumentet`,
          category: 'Dokument'
        });
      });

      employees.forEach(emp => {
        items.push({
          title: `${emp.firstName} ${emp.lastName}`,
          subtitle: `Puntor (${emp.code}) • ${emp.position}`,
          url: `/puntoret/${emp.id}`,
          category: 'Puntor'
        });
      });

      res.json({ items: items.slice(0, 8) });
    } catch (err) {
      console.error(err);
      res.json({ items: [] });
    }
  }
}

module.exports = SearchController;
