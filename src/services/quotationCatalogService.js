const prisma = require('../config/prisma');

async function getCatalog(elevators) {
  const [components, spareParts] = await Promise.all([
    prisma.component.findMany({ orderBy: { name: 'asc' } }),
    prisma.sparePart.findMany({ orderBy: { name: 'asc' } })
  ]);

  return [
    ...elevators.map(e => ({
      itemType: 'Lift',
      name: e.model,
      description: e.description || [e.capacityKg + ' kg', e.speed + ' m/s', e.driveSystem].join(', '),
      unit: 'copë',
      unitPrice: e.basePrice || 0
    })),
    ...components.map(c => ({
      itemType: 'Komponent',
      name: c.name,
      description: c.description || '',
      unit: 'copë',
      unitPrice: c.price || 0
    })),
    ...spareParts.map(p => ({
      itemType: 'Pjesë',
      name: p.name,
      description: p.partNumber || '',
      unit: 'copë',
      unitPrice: p.sellingPrice || 0
    }))
  ];
}

module.exports = { getCatalog };
