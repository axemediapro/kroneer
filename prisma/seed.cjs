const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('--- Duke filluar me pastrimin dhe mbushjen e bazës së të dhënave KRONEER ---');

  // Pastrimi i të dhënave ekzistuese në sekuencë të sigurt
  await prisma.notification.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.document.deleteMany();
  await prisma.serviceTicket.deleteMany();
  await prisma.maintenanceVisit.deleteMany();
  await prisma.maintenanceContract.deleteMany();
  await prisma.handover.deleteMany();
  await prisma.installationChecklist.deleteMany();
  await prisma.installation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.proformaItem.deleteMany();
  await prisma.proforma.deleteMany();
  await prisma.project.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.elevatorConfiguration.deleteMany();
  await prisma.quotationItem.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.sparePart.deleteMany();
  await prisma.component.deleteMany();
  await prisma.elevatorOption.deleteMany();
  await prisma.elevator.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.companySettings.deleteMany();

  // 1. Cilësimet e Kompanisë
  console.log('1. Krijimi i cilësimeve të kompanisë...');
  await prisma.companySettings.create({
    data: {
      companyName: 'KRONEER',
      tagline: 'Professional Elevator Solutions',
      address: 'Bulevardi Dëshmorët e Kombit, Kompleksi Tregtar Nd. 45',
      city: 'Prishtinë',
      country: 'Kosovë',
      taxNumber: '330184920',
      businessNumber: '70849201',
      phone: '+383 (0) 38 500 600',
      email: 'info@kroneer-lifts.com',
      website: 'www.kroneer-lifts.com',
      bankName: 'Banka Kombëtare Tregtare (BKT Kosovo)',
      iban: 'XK05 1901 0000 1234 5678',
      swift: 'BKTKXKPR',
      currency: 'EUR',
      vatRate: 18.0,
      quotePrefix: 'KR-O',
      contractPrefix: 'KR-K',
      proformaPrefix: 'KR-PF',
      invoicePrefix: 'KR-F',
      projectPrefix: 'KR-PRJ',
      servicePrefix: 'KR-SRV',
      paymentPrefix: 'KR-PAG'
    }
  });

  // 2. Përdoruesit & Rolet
  console.log('2. Krijimi i përdoruesve...');
  const salt = await bcrypt.genSalt(10);
  const passwordAdmin = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || (() => { throw new Error('Vendosni SEED_ADMIN_PASSWORD në .env'); })(), salt);
  const passwordGeneral = await bcrypt.hash(require('node:crypto').randomBytes(24).toString('hex'), salt);

  const admin = await prisma.user.create({
    data: {
      username: 'Kroneer',
      passwordHash: passwordAdmin,
      fullName: 'Administrator KRONEER',
      email: 'admin@kroneer-lifts.com',
      role: 'ADMINISTRATOR',
      phone: '+383 44 111 222',
      isActive: true
    }
  });

  const salesUser = await prisma.user.create({
    data: {
      username: 'besnik.shitje',
      passwordHash: passwordGeneral,
      fullName: 'Besnik Krasniqi',
      email: 'besnik.krasniqi@kroneer-lifts.com',
      role: 'SHITJE',
      phone: '+383 49 222 333',
      isActive: true
    }
  });

  const financeUser = await prisma.user.create({
    data: {
      username: 'valbona.finance',
      passwordHash: passwordGeneral,
      fullName: 'Valbona Gashi',
      email: 'valbona.gashi@kroneer-lifts.com',
      role: 'FINANCE',
      phone: '+383 45 333 444',
      isActive: true
    }
  });

  const projectUser = await prisma.user.create({
    data: {
      username: 'artur.projekt',
      passwordHash: passwordGeneral,
      fullName: 'Ing. Artur Kastrati',
      email: 'artur.kastrati@kroneer-lifts.com',
      role: 'MENAXHER_PROJEKTI',
      phone: '+383 44 444 555',
      isActive: true
    }
  });

  const techUser = await prisma.user.create({
    data: {
      username: 'blerim.teknik',
      passwordHash: passwordGeneral,
      fullName: 'Blerim Shala (Kryeteknik)',
      email: 'blerim.shala@kroneer-lifts.com',
      role: 'TEKNIK',
      phone: '+383 49 555 666',
      isActive: true
    }
  });

  // 3. Klientët (10 Klientë)
  console.log('3. Krijimi i klientëve...');
  const customersData = [
    {
      code: 'KR-CUST-0001',
      type: 'Ndërtues',
      companyName: 'Albi Group & Construction Sh.p.k.',
      contactPerson: 'Sutki Aliu',
      taxNumber: '330198234',
      businessNumber: '81029384',
      phone: '+383 44 100 200',
      email: 'info@albigroup-ks.com',
      website: 'www.albigroup-ks.com',
      city: 'Prishtinë',
      address: 'Zona Industriale, Veternik',
      postalCode: '10000',
      buildingName: 'Albi Residence & Mall Tower',
      buildingAddress: 'Veternik, Prishtinë',
      floorsCount: 14,
      elevatorsCount: 4,
      architect: 'Studio Moderna Arch',
      builderCompany: 'Albi Construction',
      mainContractor: 'Albi Group'
    },
    {
      code: 'KR-CUST-0002',
      type: 'Kompani',
      companyName: 'Dukagjini Invest Sh.p.k.',
      contactPerson: 'Ermal Kelmendi',
      taxNumber: '330245678',
      businessNumber: '81039485',
      phone: '+383 49 300 400',
      email: 'invest@dukagjinigroup.com',
      website: 'www.dukagjiniinvest.com',
      city: 'Prishtinë',
      address: 'Rruga Nëna Terezë, Nr. 12',
      postalCode: '10000',
      buildingName: 'Dukagjini Center & Business Suites',
      buildingAddress: 'Lakrishtë, Prishtinë',
      floorsCount: 22,
      elevatorsCount: 6,
      architect: 'B&A Partners Wien',
      builderCompany: 'Dukagjini Ndërtim',
      mainContractor: 'Dukagjini Invest'
    },
    {
      code: 'KR-CUST-0003',
      type: 'Zhvillues',
      companyName: 'Kastrati Construction Albania',
      contactPerson: 'Gentian Rama',
      taxNumber: 'L81920384K',
      businessNumber: 'K81920384K',
      phone: '+355 69 400 5000',
      email: 'projects@kastratigroup.al',
      website: 'www.kastratigroup.al',
      country: 'Shqipëri',
      city: 'Tiranë',
      address: 'Bulevardi Dëshmorët e Kombit, Nr. 88',
      postalCode: '1001',
      buildingName: 'Tirana View Twin Towers',
      buildingAddress: 'Liqeni i Thatë, Tiranë',
      floorsCount: 18,
      elevatorsCount: 4,
      architect: 'Atelier 4 Tiranë',
      builderCompany: 'Kastrati Ndërtim',
      mainContractor: 'Kastrati Group'
    },
    {
      code: 'KR-CUST-0004',
      type: 'Institucion',
      companyName: 'Spitali Amerikan Prishtinë',
      contactPerson: 'Dr. Ilir Hoxha',
      taxNumber: '330998877',
      businessNumber: '81099887',
      phone: '+383 38 400 600',
      email: 'administrata@spitaliamerikan.com',
      website: 'www.spitaliamerikan.com',
      city: 'Prishtinë',
      address: 'Magjistralja Prishtinë - Shkup',
      postalCode: '10000',
      buildingName: 'Spitali Amerikan - Blloku B Kirurgjik',
      buildingAddress: 'Çagllavicë, Prishtinë',
      floorsCount: 6,
      elevatorsCount: 3,
      architect: 'HealthMed Engineering',
      builderCompany: 'Grand Bau',
      mainContractor: 'Spitali Amerikan'
    },
    {
      code: 'KR-CUST-0005',
      type: 'Kontraktor',
      companyName: 'Grand Ndërtimi Sh.p.k.',
      contactPerson: 'Lulzim Morina',
      taxNumber: '330456123',
      businessNumber: '81045612',
      phone: '+383 44 700 800',
      email: 'projekte@grandndertimi.com',
      city: 'Prizren',
      address: 'Rruga Wesley Clark, Nr. 5',
      postalCode: '20000',
      buildingName: 'Kompleksi Panorama Prizren',
      buildingAddress: 'Ortakoll, Prizren',
      floorsCount: 9,
      elevatorsCount: 2,
      architect: 'Ark-Studio Prizren',
      builderCompany: 'Grand Ndërtimi',
      mainContractor: 'Grand Ndërtimi'
    },
    {
      code: 'KR-CUST-0006',
      type: 'Kompani',
      companyName: 'Swiss Diamond Hotel Resort',
      contactPerson: 'Adriatik Veseli',
      taxNumber: '330554433',
      businessNumber: '81055443',
      phone: '+383 38 220 000',
      email: 'finance@sdhprishtina.com',
      website: 'www.sdhprishtina.com',
      city: 'Prishtinë',
      address: 'Sheshi Nënë Tereza',
      postalCode: '10000',
      buildingName: 'Swiss Diamond Hotel - Kulla VIP',
      buildingAddress: 'Qendër, Prishtinë',
      floorsCount: 8,
      elevatorsCount: 2,
      architect: 'Swiss Luxury Arch',
      builderCompany: 'Mabetex Group',
      mainContractor: 'Mabetex'
    },
    {
      code: 'KR-CUST-0007',
      type: 'Menaxher prone',
      companyName: 'Marigona Hill Management',
      contactPerson: 'Vigan Limani',
      taxNumber: '330776655',
      businessNumber: '81077665',
      phone: '+383 45 600 700',
      email: 'management@marigonahill.com',
      website: 'www.marigonahill.com',
      city: 'Prishtinë',
      address: 'Lagjja Marigona Hill',
      postalCode: '10500',
      buildingName: 'Marigona Hill Rezidenca B2',
      buildingAddress: 'Hajvali, Prishtinë',
      floorsCount: 4,
      elevatorsCount: 2,
      architect: 'Marigona Design Lab',
      builderCompany: 'Marigona Hill LLC',
      mainContractor: 'Marigona Hill'
    },
    {
      code: 'KR-CUST-0008',
      type: 'Arkitekt',
      companyName: 'Studio Arch-Design Tiranë',
      contactPerson: 'Erion Dervishi',
      taxNumber: 'M92019283L',
      businessNumber: 'N92019283L',
      phone: '+355 68 200 3000',
      email: 'erion@archdesign-al.com',
      country: 'Shqipëri',
      city: 'Durrës',
      address: 'Shëtitorja Taulantia, Nr. 15',
      postalCode: '2001',
      buildingName: 'Durrës Marina Palace Suites',
      buildingAddress: 'Plazh, Durrës',
      floorsCount: 11,
      elevatorsCount: 3,
      architect: 'Studio Arch-Design',
      builderCompany: 'Adriatik Bau',
      mainContractor: 'Durrës Marina Dev'
    },
    {
      code: 'KR-CUST-0009',
      type: 'Person fizik',
      firstName: 'Agim',
      lastName: 'Kryeziu',
      companyName: 'Rezidenca Familjare Kryeziu',
      contactPerson: 'Agim Kryeziu',
      taxNumber: '1002938475',
      phone: '+383 44 888 999',
      email: 'agim.kryeziu@gmail.com',
      city: 'Pejë',
      address: 'Rruga Mbretëresha Teutë, Nr. 40',
      postalCode: '30000',
      buildingName: 'Villa Rezidenciale Kryeziu',
      buildingAddress: 'Bellopojë, Pejë',
      floorsCount: 3,
      elevatorsCount: 1,
      architect: 'Studio Drenica',
      builderCompany: 'Vetë-investim',
      mainContractor: 'Agim Kryeziu'
    },
    {
      code: 'KR-CUST-0010',
      type: 'Ndërtues',
      companyName: 'Drenica Bau Sh.p.k.',
      contactPerson: 'Fatmir Thaçi',
      taxNumber: '330667788',
      businessNumber: '81066778',
      phone: '+383 49 112 233',
      email: 'kontakt@drenicabau.com',
      city: 'Ferizaj',
      address: 'Rruga Driton Islami, Nr. 99',
      postalCode: '70000',
      buildingName: 'Ferizaj Tower Plaza',
      buildingAddress: 'Qendër, Ferizaj',
      floorsCount: 12,
      elevatorsCount: 3,
      architect: 'Urban Vision Ferizaj',
      builderCompany: 'Drenica Bau',
      mainContractor: 'Drenica Bau'
    }
  ];

  const customers = [];
  for (const cData of customersData) {
    const cust = await prisma.customer.create({ data: cData });
    customers.push(cust);
  }

  // 4. Kontaktet (15 Kontakte)
  console.log('4. Krijimi i kontakteve...');
  const contactsData = [
    { customerId: customers[0].id, firstName: 'Sutki', lastName: 'Aliu', role: 'Drejtor Gjeneral', phone: '+383 44 100 200', email: 'sutki@albigroup-ks.com', isPrimary: true },
    { customerId: customers[0].id, firstName: 'Dardan', lastName: 'Kelmendi', role: 'Kryeinxhinier Ndërtimi', phone: '+383 44 100 201', email: 'dardan.k@albigroup-ks.com', isPrimary: false },
    { customerId: customers[1].id, firstName: 'Ermal', lastName: 'Kelmendi', role: 'Menaxher i Investimeve', phone: '+383 49 300 400', email: 'ermal.k@dukagjinigroup.com', isPrimary: true },
    { customerId: customers[1].id, firstName: 'Bora', lastName: 'Mustafa', role: 'Koordinatore e Projekteve', phone: '+383 49 300 401', email: 'bora.m@dukagjinigroup.com', isPrimary: false },
    { customerId: customers[2].id, firstName: 'Gentian', lastName: 'Rama', role: 'Drejtor Teknik', phone: '+355 69 400 5000', email: 'grama@kastratigroup.al', isPrimary: true },
    { customerId: customers[2].id, firstName: 'Anisa', lastName: 'Balla', role: 'Menaxhere e Blerjeve', phone: '+355 69 400 5001', email: 'aballa@kastratigroup.al', isPrimary: false },
    { customerId: customers[3].id, firstName: 'Dr. Ilir', lastName: 'Hoxha', role: 'Drejtues i Operacioneve', phone: '+383 38 400 600', email: 'ilir.hoxha@spitaliamerikan.com', isPrimary: true },
    { customerId: customers[3].id, firstName: 'Blerta', lastName: 'Zeka', role: 'Menaxhere e Infrastrukturës', phone: '+383 44 400 601', email: 'blerta.zeka@spitaliamerikan.com', isPrimary: false },
    { customerId: customers[4].id, firstName: 'Lulzim', lastName: 'Morina', role: 'Pronar & Administrator', phone: '+383 44 700 800', email: 'lulzim@grandndertimi.com', isPrimary: true },
    { customerId: customers[5].id, firstName: 'Adriatik', lastName: 'Veseli', role: 'Drejtor i Mirëmbajtjes', phone: '+383 38 220 000', email: 'adveseli@sdhprishtina.com', isPrimary: true },
    { customerId: customers[6].id, firstName: 'Vigan', lastName: 'Limani', role: 'Menaxher i Pronës', phone: '+383 45 600 700', email: 'vigan@marigonahill.com', isPrimary: true },
    { customerId: customers[7].id, firstName: 'Erion', lastName: 'Dervishi', role: 'Arkitekt Kryesor', phone: '+355 68 200 3000', email: 'erion@archdesign-al.com', isPrimary: true },
    { customerId: customers[8].id, firstName: 'Agim', lastName: 'Kryeziu', role: 'Pronar i Vilës', phone: '+383 44 888 999', email: 'agim.kryeziu@gmail.com', isPrimary: true },
    { customerId: customers[9].id, firstName: 'Fatmir', lastName: 'Thaçi', role: 'Drejtor Ekzekutiv', phone: '+383 49 112 233', email: 'fatmir@drenicabau.com', isPrimary: true },
    { customerId: customers[9].id, firstName: 'Gëzim', lastName: 'Gashi', role: 'Menaxher Kantieri', phone: '+383 49 112 234', email: 'gezim@drenicabau.com', isPrimary: false }
  ];

  for (const ct of contactsData) {
    await prisma.contact.create({ data: ct });
  }

  // 5. Mundësitë e Shitjes (15 Mundësi)
  console.log('5. Krijimi i mundësive të shitjes...');
  const opportunitiesData = [
    { customerId: customers[0].id, title: 'Instalimi i 4 Liftave Pasagjerësh - Albi Tower', value: 165000, stage: 'E Fituar', probability: 100, notes: 'Kontrata është nënshkruar me sukses' },
    { customerId: customers[0].id, title: 'Lift Panoramik për Qendrën Tregtare Albi Mall', value: 48000, stage: 'Negociatë', probability: 80, notes: 'Presim miratimin përfundimtar të buxhetit' },
    { customerId: customers[1].id, title: 'Paketa 6 Lifta Shpejtësi të Lartë - Dukagjini Center', value: 290000, stage: 'E Fituar', probability: 100, notes: 'Filluar faza e inxhinierimit' },
    { customerId: customers[1].id, title: 'Lift Shërbimi & Zjarri 1275kg Dukagjini', value: 38500, stage: 'Ofertë', probability: 60, notes: 'Dërguar specifikacioni teknik' },
    { customerId: customers[2].id, title: 'Tirana View Twin Towers - 4 Lifta Panoramikë', value: 210000, stage: 'E Fituar', probability: 100, notes: 'Profatura e parë e lëshuar' },
    { customerId: customers[2].id, title: 'Lift Mallrash 2000kg për Qendrën Logjistike Tiranë', value: 42000, stage: 'Negociatë', probability: 75, notes: 'Diskutime mbi afatet e dërgesës' },
    { customerId: customers[3].id, title: '3 Lifta Spitalorë me Shtrat 1600kg - Spitali Amerikan', value: 128000, stage: 'E Fituar', probability: 100, notes: 'Lifta me dyer automatike të gjera 1300mm dhe antibakterial' },
    { customerId: customers[4].id, title: '2 Lifta Pasagjerësh 630kg Kompleksi Panorama', value: 68000, stage: 'E Fituar', probability: 100, notes: 'Në proces instalimi' },
    { customerId: customers[4].id, title: 'Lift Panoramik Xham për Kullën e Vrojtimit', value: 35000, stage: 'Kualifikim', probability: 40, notes: 'Interesim paraprak nga investitori' },
    { customerId: customers[5].id, title: 'Modernizim i 2 Liftave VIP Swiss Diamond Hotel', value: 54000, stage: 'E Fituar', probability: 100, notes: 'Në fazën e testimit dhe vënies në punë' },
    { customerId: customers[6].id, title: '2 Lifta Shtëpiakë MRL për Marigona Hill Luxury', value: 58000, stage: 'E Fituar', probability: 100, notes: 'Kontrata aktive' },
    { customerId: customers[7].id, title: '3 Lifta Pasagjerësh 1000kg Durrës Marina Palace', value: 115000, stage: 'Ofertë', probability: 65, notes: 'Dizajn luksoz me pamje nga deti' },
    { customerId: customers[8].id, title: 'Lift Homelift Hidraulik/MRL për Vilën Pejë', value: 24500, stage: 'E Fituar', probability: 100, notes: 'Dorëzuar me sukses' },
    { customerId: customers[9].id, title: '3 Lifta Pasagjerësh MRL Ferizaj Tower Plaza', value: 102000, stage: 'E Fituar', probability: 100, notes: 'Instalimi ka përfunduar 80%' },
    { customerId: customers[9].id, title: 'Platformë Ngritëse për Garazh nëntokësor Ferizaj', value: 29000, stage: 'Kontakt', probability: 30, notes: 'Kërkesë fillestare për vlerësim' }
  ];

  for (const opp of opportunitiesData) {
    await prisma.opportunity.create({ data: opp });
  }

  // 6. Katalogu i Lifteve KRONEER (10 Modele)
  console.log('6. Krijimi i katalogut të lifteve...');
  const elevatorsData = [
    {
      code: 'KR-PASS-630',
      model: 'KRONEER Elegance 630',
      type: 'Lift pasagjerësh',
      description: 'Lift pasagjerësh modern MRL (pa dhomë makinerie), me motor gearless sinkron me magnete permanente. Efiçiencë e lartë energjetike A+++, zhurmë ultra e ulët dhe udhëtim i qetë.',
      capacityKg: 630,
      personsCount: 8,
      speed: 1.0,
      floorsCount: 8,
      stopsCount: 8,
      motorType: 'Gearless Sinkron Permanent Magnet',
      driveSystem: 'MRL',
      doorType: 'Automatike Teleskopike 2-kanatëshe 800mm',
      cabinDimensions: '1100 x 1400 x 2200 mm',
      shaftDimensions: '1650 x 1750 mm',
      pitDepth: 1200,
      headroomHeight: 3600,
      powerSupply: '380V / 3 Faza / 50Hz',
      motorPower: 4.8,
      cabinMaterial: 'Inox Saten AISI 304 me detaje pasqyre',
      lighting: 'Plafoniere LED Ultra-Slim me fikje automatike',
      controlSystem: 'Monarch NICE3000+ me VVVF Inverter',
      safetySystem: 'EN 81-20/50 e certifikuar me frenim emergjence',
      warrantyMonths: 36,
      basePrice: 22500,
      vatRate: 18,
      status: 'Aktiv'
    },
    {
      code: 'KR-PASS-1000',
      model: 'KRONEER Titanium 1000',
      type: 'Lift pasagjerësh',
      description: 'Lift premium me kapacitet të lartë për ndërtesa shumëkatëshe banimi dhe qendra biznesi. Shpejtësi 1.6 m/s me sistem të avancuar inteligjent dispatch.',
      capacityKg: 1000,
      personsCount: 13,
      speed: 1.6,
      floorsCount: 16,
      stopsCount: 16,
      motorType: 'Gearless Sinkron me Frekuencë të Ndryshueshme',
      driveSystem: 'MRL',
      doorType: 'Automatike Qendrore 4-kanatëshe 900mm',
      cabinDimensions: '1100 x 2100 x 2300 mm',
      shaftDimensions: '1850 x 2350 mm',
      pitDepth: 1400,
      headroomHeight: 3800,
      powerSupply: '380V / 3 Faza / 50Hz',
      motorPower: 8.5,
      cabinMaterial: 'Inox Titan i Zi & Xham Pasqyrë',
      lighting: 'Ndriçim Linear LED me ngjyrë të ngrohtë 3000K',
      controlSystem: 'Step F5021 me VVVF Inverter Yaskawa',
      safetySystem: 'Sistem EN 81-20/50 me sensorë optikë perde 2D',
      warrantyMonths: 36,
      basePrice: 31000,
      vatRate: 18,
      status: 'Aktiv'
    },
    {
      code: 'KR-HOME-450',
      model: 'KRONEER HomeVilla 450',
      type: 'Lift shtëpiak',
      description: 'Lift shtëpiak ultra-kompakt me konsum të ulët energjie 220V. Gropë minimale vetëm 200mm, ideale për vila private, shtëpi luksoze dhe ambiente rezidenciale.',
      capacityKg: 450,
      personsCount: 6,
      speed: 0.63,
      floorsCount: 4,
      stopsCount: 4,
      motorType: 'Gearless Eko-Silent 220V',
      driveSystem: 'MRL',
      doorType: 'Automatike Teleskopike 800mm',
      cabinDimensions: '950 x 1300 x 2150 mm',
      shaftDimensions: '1450 x 1550 mm',
      pitDepth: 250,
      headroomHeight: 2800,
      powerSupply: '220V Një-fazore / 50Hz',
      motorPower: 2.2,
      cabinMaterial: 'Druri Lisi Premium & Inox Rose-Gold',
      lighting: 'LED Ambient i Butë',
      controlSystem: 'Smart Micro Controller me lidhje WiFi',
      safetySystem: 'Autorescue me kthim në katin më të afërt me bateri',
      warrantyMonths: 48,
      basePrice: 18900,
      vatRate: 18,
      status: 'Aktiv'
    },
    {
      code: 'KR-PAN-1000',
      model: 'KRONEER Vista Panorama 1000',
      type: 'Lift panoramik',
      description: 'Lift panoramik rrethor me xham të sigurisë laminat të kalitur 360 shkallë. Pamje spektakolare për hotele luksoze, qendra tregtare dhe kulla vrojtimi.',
      capacityKg: 1000,
      personsCount: 13,
      speed: 1.6,
      floorsCount: 12,
      stopsCount: 12,
      motorType: 'Gearless High-Torque',
      driveSystem: 'MRL',
      doorType: 'Dyer Xhami Automatike Qendrore 900mm',
      cabinDimensions: '1400 x 1600 x 2400 mm (Gjysmë-hark)',
      shaftDimensions: '2100 x 2200 mm',
      pitDepth: 1500,
      headroomHeight: 4000,
      powerSupply: '380V / 3 Faza / 50Hz',
      motorPower: 9.2,
      cabinMaterial: 'Xham i Kalitur Tripleks & Inox Pasqyrë',
      lighting: 'Ndriçim Halo LED me efekt qiell me yje',
      controlSystem: 'Micro-Controller Gjerman me CAN-Bus',
      safetySystem: 'Sistem EN 81-20 me mbikëqyrje me mikroprocesor',
      warrantyMonths: 36,
      basePrice: 46000,
      vatRate: 18,
      status: 'Aktiv'
    },
    {
      code: 'KR-FREIGHT-2000',
      model: 'KRONEER CargoMax 2000',
      type: 'Lift mallrash',
      description: 'Lift industrial i rëndë për mallra dhe magazina me dysheme inoksi të riforcuar me llamarinë me damarë. Projektuar për punë intensive 24/7 me ngarkesa me pirun.',
      capacityKg: 2000,
      personsCount: 26,
      speed: 0.63,
      floorsCount: 6,
      stopsCount: 6,
      motorType: 'Heavy Duty Gearless',
      driveSystem: 'Me dhomë makinerie',
      doorType: 'Dyer Vertikale Bi-parting ose Teleskopike 1500mm',
      cabinDimensions: '1500 x 2500 x 2400 mm',
      shaftDimensions: '2400 x 2900 mm',
      pitDepth: 1400,
      headroomHeight: 3900,
      powerSupply: '380V / 3 Faza / 50Hz',
      motorPower: 15.0,
      cabinMaterial: 'Llamarinë Inoksi e Përforcuar me mbrojtëse gome',
      lighting: 'LED Industriale IP65 rezistente ndaj goditjeve',
      controlSystem: 'Mikroprocesor Industrial me mbrojtje termike',
      safetySystem: 'Frenim i dyfishtë sigurie me pyka me veprim gradual',
      warrantyMonths: 24,
      basePrice: 38000,
      vatRate: 18,
      status: 'Aktiv'
    },
    {
      code: 'KR-HOSP-1600',
      model: 'KRONEER MediCare 1600',
      type: 'Lift spitalor',
      description: 'Lift i specializuar spitalor për transport shtretërish dhe aparaturash mjekësore. Ndalim me saktësi milimetrike, nisje dhe ndalim ultra të butë pa lëkundje.',
      capacityKg: 1600,
      personsCount: 21,
      speed: 1.0,
      floorsCount: 8,
      stopsCount: 8,
      motorType: 'Gearless Ultra-Smooth',
      driveSystem: 'MRL',
      doorType: 'Automatike Teleskopike 1300mm me hapje anësore',
      cabinDimensions: '1400 x 2400 x 2300 mm',
      shaftDimensions: '2100 x 2800 mm',
      pitDepth: 1300,
      headroomHeight: 3700,
      powerSupply: '380V / 3 Faza / 50Hz',
      motorPower: 11.0,
      cabinMaterial: 'Inox Antibakterial AISI 316 me mbrojtëse druri/inoksi',
      lighting: 'Ndriçim Kirurgjik LED pa shkëlqim verbues',
      controlSystem: 'Sistem me prioritet për raste emergjente mjekësore',
      safetySystem: 'EN 81-70 për persona me aftësi të kufizuara & zjarri',
      warrantyMonths: 36,
      basePrice: 39500,
      vatRate: 18,
      status: 'Aktiv'
    },
    {
      code: 'KR-SERV-1000',
      model: 'KRONEER ProService 1000',
      type: 'Lift shërbimi',
      description: 'Lift i fortë shërbimi për hotele dhe spitale për shërbim dhome, karroca pastrimi dhe personelin e brendshëm.',
      capacityKg: 1000,
      personsCount: 13,
      speed: 1.0,
      floorsCount: 10,
      stopsCount: 10,
      motorType: 'Gearless MRL',
      driveSystem: 'MRL',
      doorType: 'Automatike 2-kanatëshe 900mm',
      cabinDimensions: '1100 x 1800 x 2200 mm',
      shaftDimensions: '1800 x 2100 mm',
      pitDepth: 1200,
      headroomHeight: 3600,
      powerSupply: '380V / 3 Faza / 50Hz',
      motorPower: 6.7,
      cabinMaterial: 'Inox Saten me shufra mbrojtëse',
      lighting: 'LED me efiçiencë të lartë',
      controlSystem: 'VVVF Inverter me kontroll hyrje me çip RFID',
      safetySystem: 'Standard EN 81-20',
      warrantyMonths: 24,
      basePrice: 27500,
      vatRate: 18,
      status: 'Aktiv'
    },
    {
      code: 'KR-CAR-2500',
      model: 'KRONEER AutoLift 2500',
      type: 'Lift automobilash',
      description: 'Lift hidraulik ose me tërheqje elektrike për transportin e veturave dhe automjeteve në parkingje nëntokësore.',
      capacityKg: 2500,
      personsCount: 33,
      speed: 0.5,
      floorsCount: 3,
      stopsCount: 3,
      motorType: 'Hidraulik me dy pistona / Gearless Heavy Duty',
      driveSystem: 'Me dhomë makinerie',
      doorType: 'Dyer Vertikale ose Teleskopike me gjerësi 2400mm',
      cabinDimensions: '2400 x 5200 x 2200 mm',
      shaftDimensions: '3100 x 5600 mm',
      pitDepth: 1300,
      headroomHeight: 3400,
      powerSupply: '380V / 3 Faza / 50Hz',
      motorPower: 22.0,
      cabinMaterial: 'Llamarinë çeliku me veshje elektrostatike & mbrojtëse rrotash',
      lighting: 'LED IP65 me sinjalistikë semaforike hyrje-dalje',
      controlSystem: 'PLC Industrial me telekomandë për shoferë',
      safetySystem: 'Sensorë fotoelektrikë të pozicionimit të automjetit',
      warrantyMonths: 24,
      basePrice: 52000,
      vatRate: 18,
      status: 'Aktiv'
    },
    {
      code: 'KR-PLAT-300',
      model: 'KRONEER EasyStep Platform',
      type: 'Platformë ngritëse',
      description: 'Platformë ngritëse vertikale për persona me nevoja të veçanta, për ambiente publike dhe shtëpiake.',
      capacityKg: 300,
      personsCount: 4,
      speed: 0.15,
      floorsCount: 2,
      stopsCount: 2,
      motorType: 'Motor Elektromekanik me Vidë ose Hidraulik',
      driveSystem: 'MRL',
      doorType: 'Dyer Manuale me Xham me mbyllje të butë',
      cabinDimensions: '900 x 1400 x 2000 mm',
      shaftDimensions: '1300 x 1500 mm',
      pitDepth: 100,
      headroomHeight: 2400,
      powerSupply: '220V / 50Hz',
      motorPower: 1.5,
      cabinMaterial: 'Alumini i eloksuar dhe xham i tejdukshëm',
      lighting: 'LED në shirit',
      controlSystem: 'Buton me mbajtje të vazhdueshme (Hold-to-run)',
      safetySystem: 'Bordurë e ndjeshme ndaj presionit anti-bllokim',
      warrantyMonths: 24,
      basePrice: 12500,
      vatRate: 18,
      status: 'Aktiv'
    },
    {
      code: 'KR-VILLA-300',
      model: 'KRONEER Compact Villa 300',
      type: 'Lift shtëpiak',
      description: 'Lift ultra-modern elegant me strukturë mbajtëse metalike dhe xham pa nevojë për bosht betoni.',
      capacityKg: 300,
      personsCount: 4,
      speed: 0.4,
      floorsCount: 3,
      stopsCount: 3,
      motorType: 'Gearless Eko-Silent 220V',
      driveSystem: 'MRL',
      doorType: 'Automatike me xham 750mm',
      cabinDimensions: '900 x 1100 x 2100 mm',
      shaftDimensions: '1250 x 1350 mm',
      pitDepth: 150,
      headroomHeight: 2600,
      powerSupply: '220V / 50Hz',
      motorPower: 1.8,
      cabinMaterial: 'Xham dhe Inox Matt Black',
      lighting: 'LED Ambient me dimmer',
      controlSystem: 'Smart Touch Panel',
      safetySystem: 'Bateri rezervë për evakuim automatik',
      warrantyMonths: 36,
      basePrice: 16800,
      vatRate: 18,
      status: 'Aktiv'
    }
  ];

  const elevators = [];
  for (const eData of elevatorsData) {
    const el = await prisma.elevator.create({ data: eData });
    elevators.push(el);
  }

  // 7. Opsionet e Lifteve (20 Opsione)
  console.log('7. Krijimi i opsioneve të lifteve...');
  const optionsData = [
    { name: 'Veshje Kabine me Inox Titan Ari (Gold Titanium)', category: 'Interier', code: 'OPT-INT-01', price: 1800, description: 'Veshje luksoze me çelik inoks të praruar me ar titan' },
    { name: 'Dysheme Mermeri Natyror i Zgjedhur', category: 'Interier', code: 'OPT-INT-02', price: 950, description: 'Dysheme elegante prej pllakash mermeri natyral të lehtësuar' },
    { name: 'Tavan me Efekt Qielli me Yje LED Fibër Optike', category: 'Drita', code: 'OPT-LGT-01', price: 850, description: 'Tavan i zi me mikro-pika LED vezulluese me telekomandë' },
    { name: 'Dyer me Rezistencë ndaj Zjarrit EI-120', category: 'Siguri', code: 'OPT-SAF-01', price: 2100, description: 'Dyer automatike të certifikuara kundër zjarrit për 120 minuta' },
    { name: 'Sistem Komunikimi GSM & Telefon Emergjence', category: 'Komunikim', code: 'OPT-COM-01', price: 650, description: 'Dialer automatik me kartë SIM për lidhje 24/7 me qendrën e servisit' },
    { name: 'Sistem Kontrolli Aksesi me Kartelë RFID / PIN', category: 'Siguri', code: 'OPT-SEC-01', price: 750, description: 'Lexues i integruar në tastierë për kufizim katesh sipas kartelave' },
    { name: 'Bateri Rezervë ARD (Evakuim Automatik në Rast Ndërprerje)', category: 'Siguri', code: 'OPT-SAF-02', price: 1200, description: 'Sistem me bateri që dërgon liftin në katin më të afërt dhe hap dyert' },
    { name: 'Kamera Sigurie me Kënd të Gjerë brenda Kabinës', category: 'Siguri', code: 'OPT-SEC-02', price: 450, description: 'Kamera IP me kabllo fleksibile përgatitur për lidhje në NVR' },
    { name: 'Ekran Multimedial LCD 10.1 inç në Kabinë', category: 'Interier', code: 'OPT-INT-03', price: 1100, description: 'Ekran me orë, mot, njoftime video dhe muzikë në sfond' },
    { name: 'Sistem Zanor i Njoftimit të Kateve në Shqip', category: 'Komunikim', code: 'OPT-COM-02', price: 350, description: 'Zë femëror i qartë në gjuhën shqipe për njoftimin e kateve dhe drejtimit' },
    { name: 'Perde me Rreze Infrakuqe 2D (Siguri Dyer)', category: 'Siguri', code: 'OPT-SAF-03', price: 400, description: 'Sensor me 128 rreze që parandalon mbylljen e dyerve gjatë kalimit' },
    { name: 'Sistem i Monitorimit në Distancë IoT KRONEER Cloud', category: 'Komunikim', code: 'OPT-COM-03', price: 950, description: 'Telemetri në kohë reale e parametrave të motorit dhe defekteve' },
    { name: 'Modalitet Zjarri me Buton të Dedikuar Zjarrfikësi', category: 'Siguri', code: 'OPT-SAF-04', price: 600, description: 'Aktivizim i menjëhershëm i kthimit në katin kryesor të daljes' },
    { name: 'Doreza të Dyfishta Inoksi Saten AISI 316', category: 'Interier', code: 'OPT-INT-04', price: 300, description: 'Doreza mbrojtëse ergonomike për personat e moshuar dhe me nevoja' },
    { name: 'Pasqyrë e Plotë me Xham Sigurie kundër Thyerjes', category: 'Interier', code: 'OPT-INT-05', price: 450, description: 'Pasqyrë e integruar në të gjithë lartësinë e murit të pasmë' },
    { name: 'Përgatitje dhe Ventilator me Filtër HEPA & Jonizues', category: 'Interier', code: 'OPT-INT-06', price: 550, description: 'Pastrim i vazhdueshëm i ajrit brenda kabinës kundër viruseve' },
    { name: 'Shpejtësi e Rritur në 1.6 m/s (nga 1.0 m/s)', category: 'Shpejtësi', code: 'OPT-SPD-01', price: 2400, description: 'Motor më i fuqishëm me inverter me performancë të lartë' },
    { name: 'Kondicioner i Posaçëm për Kabinë Lifti', category: 'Interier', code: 'OPT-INT-07', price: 1600, description: 'Njësi ftohjeje e montuar mbi kabinë me kontroll automatik të temperaturës' },
    { name: 'Strukturë Metalike Vetë-mbajtëse për Bosht Xhami', category: 'Instalim', code: 'OPT-INS-01', price: 6500, description: 'Kullë metalike me profile çeliku të lyera me pluhur elektrostatik' },
    { name: 'Paketë Garancie e Zgjatur në 5 Vite të Plota', category: 'Shërbim', code: 'OPT-SRV-01', price: 1500, description: 'Garanci gjithëpërfshirëse për të gjithë komponentët dhe punën' }
  ];

  for (const opt of optionsData) {
    await prisma.elevatorOption.create({ data: opt });
  }

  // 8. Ofertat (10 Oferta)
  console.log('8. Krijimi i ofertave...');
  const quotesData = [
    {
      number: 'KR-O-2026-0001',
      date: new Date('2026-08-10'),
      validUntil: new Date('2026-09-30'),
      customerId: customers[0].id,
      salesRepId: salesUser.id,
      currency: 'EUR',
      paymentTerms: '30% Parapagim, 40% Para Instalimit, 20% Gjatë Instalimit, 10% Pas Dorëzimit',
      deliveryWeeks: 6,
      installationWeeks: 3,
      warrantyMonths: 36,
      notes: 'Oferta për 4 lifta KRONEER Elegance 630 për Kullën Albi Residence.',
      subtotal: 90000,
      discount: 3000,
      vatRate: 18,
      vatAmount: 15660,
      total: 102660,
      status: 'Pranuar'
    },
    {
      number: 'KR-O-2026-0002',
      date: new Date('2026-08-15'),
      validUntil: new Date('2026-10-05'),
      customerId: customers[1].id,
      salesRepId: salesUser.id,
      currency: 'EUR',
      paymentTerms: '30% Parapagim, 40% Para Instalimit, 20% Gjatë Instalimit, 10% Pas Dorëzimit',
      deliveryWeeks: 8,
      installationWeeks: 4,
      warrantyMonths: 36,
      notes: 'Pako prej 6 lifteve Titanium 1000kg 1.6m/s për Dukagjini Center.',
      subtotal: 186000,
      discount: 6000,
      vatRate: 18,
      vatAmount: 32400,
      total: 212400,
      status: 'Pranuar'
    },
    {
      number: 'KR-O-2026-0003',
      date: new Date('2026-08-20'),
      validUntil: new Date('2026-09-25'),
      customerId: customers[2].id,
      salesRepId: salesUser.id,
      currency: 'EUR',
      paymentTerms: '30% Parapagim, 40% Para Instalimit, 20% Gjatë Instalimit, 10% Pas Dorëzimit',
      deliveryWeeks: 10,
      installationWeeks: 5,
      warrantyMonths: 36,
      notes: '4 Lifta Panoramikë Vista Panorama 1000kg për Tirana View Towers.',
      subtotal: 184000,
      discount: 5000,
      vatRate: 18,
      vatAmount: 32220,
      total: 211220,
      status: 'Pranuar'
    },
    {
      number: 'KR-O-2026-0004',
      date: new Date('2026-08-25'),
      validUntil: new Date('2026-10-15'),
      customerId: customers[3].id,
      salesRepId: salesUser.id,
      currency: 'EUR',
      paymentTerms: '30% Parapagim, 40% Para Instalimit, 20% Gjatë Instalimit, 10% Pas Dorëzimit',
      deliveryWeeks: 7,
      installationWeeks: 3,
      warrantyMonths: 36,
      notes: '3 Lifta Spitalorë MediCare 1600kg me dyer 1300mm dhe antibakterial.',
      subtotal: 118500,
      discount: 3500,
      vatRate: 18,
      vatAmount: 20700,
      total: 135700,
      status: 'Pranuar'
    },
    {
      number: 'KR-O-2026-0005',
      date: new Date('2026-08-28'),
      validUntil: new Date('2026-10-20'),
      customerId: customers[4].id,
      salesRepId: salesUser.id,
      currency: 'EUR',
      paymentTerms: '30% Parapagim, 40% Para Instalimit, 20% Gjatë Instalimit, 10% Pas Dorëzimit',
      deliveryWeeks: 6,
      installationWeeks: 2,
      warrantyMonths: 24,
      notes: '2 Lifta Elegance 630kg për Kompleksin Panorama Prizren.',
      subtotal: 45000,
      discount: 1500,
      vatRate: 18,
      vatAmount: 7830,
      total: 51330,
      status: 'Pranuar'
    },
    {
      number: 'KR-O-2026-0006',
      date: new Date('2026-09-01'),
      validUntil: new Date('2026-10-30'),
      customerId: customers[5].id,
      salesRepId: salesUser.id,
      currency: 'EUR',
      paymentTerms: '30% Parapagim, 40% Para Instalimit, 30% Pas Dorëzimit',
      deliveryWeeks: 5,
      installationWeeks: 2,
      warrantyMonths: 36,
      notes: 'Modernizim i dy lifteve ekzistues VIP në Swiss Diamond Hotel.',
      subtotal: 48000,
      discount: 2000,
      vatRate: 18,
      vatAmount: 8280,
      total: 54280,
      status: 'Në negociatë'
    },
    {
      number: 'KR-O-2026-0007',
      date: new Date('2026-09-05'),
      validUntil: new Date('2026-10-15'),
      customerId: customers[6].id,
      salesRepId: salesUser.id,
      currency: 'EUR',
      paymentTerms: '50% Parapagim, 50% Pas Dorëzimit',
      deliveryWeeks: 4,
      installationWeeks: 2,
      warrantyMonths: 48,
      notes: '2 Lifta Shtëpiakë HomeVilla 450 për Marigona Hill.',
      subtotal: 37800,
      discount: 1000,
      vatRate: 18,
      vatAmount: 6624,
      total: 43424,
      status: 'Dërguar'
    },
    {
      number: 'KR-O-2026-0008',
      date: new Date('2026-09-08'),
      validUntil: new Date('2026-10-25'),
      customerId: customers[7].id,
      salesRepId: salesUser.id,
      currency: 'EUR',
      paymentTerms: '30% Parapagim, 40% Para Instalimit, 20% Gjatë Instalimit, 10% Pas Dorëzimit',
      deliveryWeeks: 8,
      installationWeeks: 3,
      warrantyMonths: 36,
      notes: '3 Lifta Pasagjerësh Titanium 1000kg Durrës Marina Palace.',
      subtotal: 93000,
      discount: 3000,
      vatRate: 18,
      vatAmount: 16200,
      total: 106200,
      status: 'Shikuar'
    },
    {
      number: 'KR-O-2026-0009',
      date: new Date('2026-09-10'),
      validUntil: new Date('2026-10-10'),
      customerId: customers[8].id,
      salesRepId: salesUser.id,
      currency: 'EUR',
      paymentTerms: '50% Parapagim, 50% Pas Dorëzimit',
      deliveryWeeks: 4,
      installationWeeks: 1,
      warrantyMonths: 48,
      notes: '1 Lift Shtëpiak HomeVilla 450 për vilën në Pejë.',
      subtotal: 18900,
      discount: 500,
      vatRate: 18,
      vatAmount: 3312,
      total: 21712,
      status: 'Pranuar'
    },
    {
      number: 'KR-O-2026-0010',
      date: new Date('2026-09-12'),
      validUntil: new Date('2026-10-31'),
      customerId: customers[9].id,
      salesRepId: salesUser.id,
      currency: 'EUR',
      paymentTerms: '30% Parapagim, 40% Para Instalimit, 20% Gjatë Instalimit, 10% Pas Dorëzimit',
      deliveryWeeks: 6,
      installationWeeks: 3,
      warrantyMonths: 36,
      notes: '3 Lifta Elegance 630kg për Kullën Ferizaj Tower Plaza.',
      subtotal: 67500,
      discount: 2500,
      vatRate: 18,
      vatAmount: 11700,
      total: 76700,
      status: 'Draft'
    }
  ];

  const quotations = [];
  for (const qData of quotesData) {
    const q = await prisma.quotation.create({ data: qData });
    quotations.push(q);

    // Krijimi i artikujve të ofertës
    await prisma.quotationItem.create({
      data: {
        quotationId: q.id,
        itemType: 'Lift',
        name: 'Lift KRONEER - Sistemi Kryesor',
        description: 'Sistem i plotë lifti me motor gearless, kontrollor mikroprocesor, shina, kabinë inoksi dhe dyer automatike',
        quantity: 1,
        unit: 'set',
        unitPrice: q.subtotal * 0.8,
        discount: 0,
        vatRate: 18,
        total: q.subtotal * 0.8
      }
    });

    await prisma.quotationItem.create({
      data: {
        quotationId: q.id,
        itemType: 'Instalim',
        name: 'Instalimi, Montimi dhe Përgatitja Elektrike',
        description: 'Montimi profesional nga inxhinierët dhe teknikët e certifikuar të KRONEER',
        quantity: 1,
        unit: 'shërbim',
        unitPrice: q.subtotal * 0.15,
        discount: 0,
        vatRate: 18,
        total: q.subtotal * 0.15
      }
    });

    await prisma.quotationItem.create({
      data: {
        quotationId: q.id,
        itemType: 'Transport',
        name: 'Transporti i Sigurt në Kantier dhe Vënia në Punë',
        description: 'Transporti me kamionë me vinç dhe inspektimi fillestar teknik',
        quantity: 1,
        unit: 'shërbim',
        unitPrice: q.subtotal * 0.05,
        discount: 0,
        vatRate: 18,
        total: q.subtotal * 0.05
      }
    });
  }

  // 9. Kontratat (5 Kontrata)
  console.log('9. Krijimi i kontratave...');
  const contractsData = [
    {
      number: 'KR-K-2026-0001',
      quotationId: quotations[0].id,
      customerId: customers[0].id,
      elevatorId: elevators[0].id,
      value: quotations[0].total,
      paymentTerms: '30% me nënshkrim, 40% para dërgesës, 20% pas instalimit, 10% pas kolaudimit',
      deliveryDate: new Date('2026-10-15'),
      installationDate: new Date('2026-11-15'),
      warrantyMonths: 36,
      maintenanceTerms: 'Mirëmbajtje falas 24 muajt e parë me vizita mujore të rregullta',
      specialTerms: 'Garantim i kohës së reagimit në rast defekti brenda 60 minutave 24/7',
      status: 'Aktive'
    },
    {
      number: 'KR-K-2026-0002',
      quotationId: quotations[1].id,
      customerId: customers[1].id,
      elevatorId: elevators[1].id,
      value: quotations[1].total,
      paymentTerms: '30% Parapagim, 40% Para Instalimit, 20% Gjatë Instalimit, 10% Pas Dorëzimit',
      deliveryDate: new Date('2026-10-25'),
      installationDate: new Date('2026-12-01'),
      warrantyMonths: 36,
      maintenanceTerms: 'Kontratë mirëmbajtjeje e integruar VIP me monitorim IoT në distancë',
      status: 'Aktive'
    },
    {
      number: 'KR-K-2026-0003',
      quotationId: quotations[2].id,
      customerId: customers[2].id,
      elevatorId: elevators[3].id,
      value: quotations[2].total,
      paymentTerms: '30% Parapagim, 40% Para Instalimit, 20% Gjatë Instalimit, 10% Pas Dorëzimit',
      deliveryDate: new Date('2026-11-10'),
      installationDate: new Date('2026-12-20'),
      warrantyMonths: 36,
      maintenanceTerms: 'Inspektim dhe pastrim teknik i xhamave çdo muaj',
      status: 'Aktive'
    },
    {
      number: 'KR-K-2026-0004',
      quotationId: quotations[3].id,
      customerId: customers[3].id,
      elevatorId: elevators[5].id,
      value: quotations[3].total,
      paymentTerms: '30% Parapagim, 40% Para Instalimit, 20% Gjatë Instalimit, 10% Pas Dorëzimit',
      deliveryDate: new Date('2026-10-10'),
      installationDate: new Date('2026-11-05'),
      warrantyMonths: 36,
      maintenanceTerms: 'Servis me prioritet të lartë spitalor - gatishmëri 24 orë në ditë',
      status: 'Aktive'
    },
    {
      number: 'KR-K-2026-0005',
      quotationId: quotations[4].id,
      customerId: customers[4].id,
      elevatorId: elevators[0].id,
      value: quotations[4].total,
      paymentTerms: '30% Parapagim, 40% Para Instalimit, 20% Gjatë Instalimit, 10% Pas Dorëzimit',
      deliveryDate: new Date('2026-10-01'),
      installationDate: new Date('2026-10-25'),
      warrantyMonths: 24,
      maintenanceTerms: 'Mirëmbajtje mujore e standardizuar sipas rregullores EN 13015',
      status: 'Aktive'
    }
  ];

  const contracts = [];
  for (const cData of contractsData) {
    const cont = await prisma.contract.create({ data: cData });
    contracts.push(cont);
  }

  // 10. Profaturat (5 Profatura me ndarje etapash)
  console.log('10. Krijimi i profaturave...');
  for (let i = 0; i < 5; i++) {
    const q = quotations[i];
    const c = contracts[i];
    const pfNum = `KR-PF-2026-${String(i + 1).padStart(4, '0')}`;
    
    const pf = await prisma.proforma.create({
      data: {
        number: pfNum,
        quotationId: q.id,
        contractId: c.id,
        customerId: q.customerId,
        date: new Date('2026-08-25'),
        dueDate: new Date('2026-09-15'),
        subtotal: q.subtotal - q.discount,
        vatAmount: q.vatAmount,
        totalAmount: q.total,
        paidAmount: q.total * 0.3, // 30% e parapagimit është paguar
        status: 'Pjesërisht e paguar',
        notes: 'Profaturë e strukturuar sipas etapave kryesore të ekzekutimit të projektit.'
      }
    });

    // Krijimi i etapave të pagesës (30%, 40%, 20%, 10%)
    await prisma.proformaItem.create({
      data: {
        proformaId: pf.id,
        percentage: 30,
        description: '30% PARAPAGIM (Me nënshkrimin e kontratës)',
        amount: Math.round(q.total * 0.30 * 100) / 100,
        isPaid: true,
        paidAt: new Date('2026-08-28')
      }
    });

    await prisma.proformaItem.create({
      data: {
        proformaId: pf.id,
        percentage: 40,
        description: '40% PARA INSTALIMIT (Me mbërritjen e pajisjeve në kantier)',
        amount: Math.round(q.total * 0.40 * 100) / 100,
        isPaid: false
      }
    });

    await prisma.proformaItem.create({
      data: {
        proformaId: pf.id,
        percentage: 20,
        description: '20% GJATË INSTALIMIT (Me montimin e shinave dhe kabinës)',
        amount: Math.round(q.total * 0.20 * 100) / 100,
        isPaid: false
      }
    });

    await prisma.proformaItem.create({
      data: {
        proformaId: pf.id,
        percentage: 10,
        description: '10% PAS DORËZIMIT (Pas testimit dhe dorëzimit teknik)',
        amount: Math.round(q.total * 0.10 * 100) / 100,
        isPaid: false
      }
    });
  }

  // 11. Faturat (10 Fatura)
  console.log('11. Krijimi i faturave...');
  const invoicesData = [
    { number: 'KR-F-2026-0001', quotationId: quotations[0].id, contractId: contracts[0].id, customerId: customers[0].id, date: new Date('2026-08-28'), dueDate: new Date('2026-09-12'), subtotal: 87000, discount: 0, vatRate: 18, vatAmount: 15660, total: 102660, paidAmount: 30798, balanceDue: 71862, status: 'Pjesërisht e paguar', notes: 'Faturë për paradhënien 30% të projektit Albi Tower' },
    { number: 'KR-F-2026-0002', quotationId: quotations[1].id, contractId: contracts[1].id, customerId: customers[1].id, date: new Date('2026-08-29'), dueDate: new Date('2026-09-15'), subtotal: 180000, discount: 0, vatRate: 18, vatAmount: 32400, total: 212400, paidAmount: 63720, balanceDue: 148680, status: 'Pjesërisht e paguar', notes: 'Parapagim 30% Dukagjini Center' },
    { number: 'KR-F-2026-0003', quotationId: quotations[2].id, contractId: contracts[2].id, customerId: customers[2].id, date: new Date('2026-09-01'), dueDate: new Date('2026-09-20'), subtotal: 179000, discount: 0, vatRate: 18, vatAmount: 32220, total: 211220, paidAmount: 63366, balanceDue: 147854, status: 'Pjesërisht e paguar', notes: 'Parapagim 30% Tirana View Towers' },
    { number: 'KR-F-2026-0004', quotationId: quotations[3].id, contractId: contracts[3].id, customerId: customers[3].id, date: new Date('2026-09-02'), dueDate: new Date('2026-09-18'), subtotal: 115000, discount: 0, vatRate: 18, vatAmount: 20700, total: 135700, paidAmount: 40710, balanceDue: 94990, status: 'Pjesërisht e paguar', notes: 'Parapagim 30% Spitali Amerikan' },
    { number: 'KR-F-2026-0005', quotationId: quotations[4].id, contractId: contracts[4].id, customerId: customers[4].id, date: new Date('2026-09-03'), dueDate: new Date('2026-09-17'), subtotal: 43500, discount: 0, vatRate: 18, vatAmount: 7830, total: 51330, paidAmount: 51330, balanceDue: 0, status: 'Paguar', notes: 'Pagesë e plotë e likuiduar Panorama Prizren' },
    { number: 'KR-F-2026-0006', quotationId: null, contractId: null, customerId: customers[5].id, date: new Date('2026-08-01'), dueDate: new Date('2026-08-15'), subtotal: 3500, discount: 0, vatRate: 18, vatAmount: 630, total: 4130, paidAmount: 0, balanceDue: 4130, status: 'E vonuar', notes: 'Mirëmbajtje tremujore dhe ndërrim vaji makinerie VIP' },
    { number: 'KR-F-2026-0007', quotationId: null, contractId: null, customerId: customers[6].id, date: new Date('2026-09-04'), dueDate: new Date('2026-09-25'), subtotal: 2800, discount: 0, vatRate: 18, vatAmount: 504, total: 3304, paidAmount: 3304, balanceDue: 0, status: 'Paguar', notes: 'Servis vjetor preventiv dhe certifikim teknik' },
    { number: 'KR-F-2026-0008', quotationId: quotations[8].id, contractId: null, customerId: customers[8].id, date: new Date('2026-09-10'), dueDate: new Date('2026-09-24'), subtotal: 18400, discount: 0, vatRate: 18, vatAmount: 3312, total: 21712, paidAmount: 21712, balanceDue: 0, status: 'Paguar', notes: 'Pagesë e plotë për liftin e vilës Pejë' },
    { number: 'KR-F-2026-0009', quotationId: null, contractId: null, customerId: customers[9].id, date: new Date('2026-08-10'), dueDate: new Date('2026-08-25'), subtotal: 15000, discount: 0, vatRate: 18, vatAmount: 2700, total: 17700, paidAmount: 10000, balanceDue: 7700, status: 'E vonuar', notes: 'Kësti i dytë i punimeve të boshtit' },
    { number: 'KR-F-2026-0010', quotationId: null, contractId: null, customerId: customers[7].id, date: new Date('2026-09-11'), dueDate: new Date('2026-10-01'), subtotal: 1800, discount: 0, vatRate: 18, vatAmount: 324, total: 2124, paidAmount: 0, balanceDue: 2124, status: 'Dërguar', notes: 'Faturë konsulence inxhinierike për projektin e Durrësit' }
  ];

  const invoices = [];
  for (const invData of invoicesData) {
    const inv = await prisma.invoice.create({ data: invData });
    invoices.push(inv);

    await prisma.invoiceItem.create({
      data: {
        invoiceId: inv.id,
        name: 'Pajisje dhe Shërbime Inxhinierike të Lifteve KRONEER',
        description: inv.notes || 'Shërbim i certifikuar sipas standardeve evropiane',
        quantity: 1,
        unitPrice: inv.subtotal,
        discount: 0,
        vatRate: inv.vatRate,
        total: inv.subtotal
      }
    });
  }

  // 12. Pagesat (10 Pagesa)
  console.log('12. Krijimi i pagesave...');
  const paymentsData = [
    { number: 'KR-PAG-2026-0001', invoiceId: invoices[0].id, customerId: customers[0].id, amount: 30798, date: new Date('2026-08-28'), paymentMethod: 'Transfertë bankare', referenceNumber: 'BKT-TR-892019', notes: 'Parapagim 30% Albi Tower' },
    { number: 'KR-PAG-2026-0002', invoiceId: invoices[1].id, customerId: customers[1].id, amount: 63720, date: new Date('2026-08-30'), paymentMethod: 'Transfertë bankare', referenceNumber: 'NLB-TR-339102', notes: 'Parapagim 30% Dukagjini Center' },
    { number: 'KR-PAG-2026-0003', invoiceId: invoices[2].id, customerId: customers[2].id, amount: 63366, date: new Date('2026-09-02'), paymentMethod: 'Transfertë bankare', referenceNumber: 'BKT-AL-771920', notes: 'Parapagim 30% Tirana View' },
    { number: 'KR-PAG-2026-0004', invoiceId: invoices[3].id, customerId: customers[3].id, amount: 40710, date: new Date('2026-09-03'), paymentMethod: 'Transfertë bankare', referenceNumber: 'TEB-TR-990182', notes: 'Parapagim 30% Spitali Amerikan' },
    { number: 'KR-PAG-2026-0005', invoiceId: invoices[4].id, customerId: customers[4].id, amount: 51330, date: new Date('2026-09-04'), paymentMethod: 'Transfertë bankare', referenceNumber: 'RBKO-TR-448192', notes: 'Pagesë totale Panorama Prizren' },
    { number: 'KR-PAG-2026-0006', invoiceId: invoices[6].id, customerId: customers[6].id, amount: 3304, date: new Date('2026-09-05'), paymentMethod: 'Transfertë bankare', referenceNumber: 'BPB-TR-128490', notes: 'Shlyerje shërbimi vjetor Marigona Hill' },
    { number: 'KR-PAG-2026-0007', invoiceId: invoices[7].id, customerId: customers[8].id, amount: 21712, date: new Date('2026-09-10'), paymentMethod: 'Transfertë bankare', referenceNumber: 'BKT-TR-102934', notes: 'Pagesë finale Villa Pejë' },
    { number: 'KR-PAG-2026-0008', invoiceId: invoices[8].id, customerId: customers[9].id, amount: 10000, date: new Date('2026-08-15'), paymentMethod: 'Transfertë bankare', referenceNumber: 'NLB-TR-881920', notes: 'Këst i pjesshëm Drenica Bau' },
    { number: 'KR-PAG-2026-0009', invoiceId: null, customerId: customers[0].id, amount: 4500, date: new Date('2026-09-08'), paymentMethod: 'Para në dorë', referenceNumber: 'KASH-REC-0012', notes: 'Depozitë shtesë për ndriçim special LED' },
    { number: 'KR-PAG-2026-0010', invoiceId: null, customerId: customers[5].id, amount: 2500, date: new Date('2026-09-12'), paymentMethod: 'Kartelë', referenceNumber: 'POS-BKT-88419', notes: 'Pagesë emergjente e servisit të kabinës' }
  ];

  for (const pData of paymentsData) {
    await prisma.payment.create({ data: pData });
  }

  // 13. Projektet (8 Projekte)
  console.log('13. Krijimi i projekteve...');
  const projectsData = [
    {
      number: 'KR-PRJ-2026-0001',
      name: 'Albi Residence & Mall Tower — Prishtinë',
      customerId: customers[0].id,
      contractId: contracts[0].id,
      elevatorCount: 4,
      floorsCount: 14,
      value: 102660,
      stage: 'Instalim',
      startDate: new Date('2026-08-28'),
      targetCompletionDate: new Date('2026-11-20'),
      notes: 'Instalimi i 4 lifteve KRONEER Elegance 630. Boshti është kontrolluar me sukses.'
    },
    {
      number: 'KR-PRJ-2026-0002',
      name: 'Dukagjini Center & Business Suites — Prishtinë',
      customerId: customers[1].id,
      contractId: contracts[1].id,
      elevatorCount: 6,
      floorsCount: 22,
      value: 212400,
      stage: 'Inxhinieri',
      startDate: new Date('2026-08-30'),
      targetCompletionDate: new Date('2026-12-15'),
      notes: 'Përgatitja e vizatimeve teknike dhe konfigurimi i motorëve gearless 1.6m/s.'
    },
    {
      number: 'KR-PRJ-2026-0003',
      name: 'Tirana View Twin Towers — Tiranë',
      customerId: customers[2].id,
      contractId: contracts[2].id,
      elevatorCount: 4,
      floorsCount: 18,
      value: 211220,
      stage: 'Prodhim',
      startDate: new Date('2026-09-02'),
      targetCompletionDate: new Date('2026-12-30'),
      notes: 'Kabinat panoramike të xhamit janë në proces prodhimi në fabrikë.'
    },
    {
      number: 'KR-PRJ-2026-0004',
      name: 'Spitali Amerikan Blloku B Kirurgjik — Çagllavicë',
      customerId: customers[3].id,
      contractId: contracts[3].id,
      elevatorCount: 3,
      floorsCount: 6,
      value: 135700,
      stage: 'Transport',
      startDate: new Date('2026-09-03'),
      targetCompletionDate: new Date('2026-11-15'),
      notes: 'Makineritë dhe dyert antibakteriale janë në tranzit doganor.'
    },
    {
      number: 'KR-PRJ-2026-0005',
      name: 'Kompleksi Panorama Prizren — Prizren',
      customerId: customers[4].id,
      contractId: contracts[4].id,
      elevatorCount: 2,
      floorsCount: 9,
      value: 51330,
      stage: 'Testim',
      startDate: new Date('2026-08-15'),
      targetCompletionDate: new Date('2026-09-25'),
      notes: 'Testimi i frenave të emergjencës dhe balancimit të peshës.'
    },
    {
      number: 'KR-PRJ-2026-0006',
      name: 'Swiss Diamond VIP Suites Modernizim — Prishtinë',
      customerId: customers[5].id,
      contractId: null,
      elevatorCount: 2,
      floorsCount: 8,
      value: 54000,
      stage: 'Planifikim',
      startDate: new Date('2026-09-05'),
      targetCompletionDate: new Date('2026-10-30'),
      notes: 'Analiza e strukturës ekzistuese dhe përshtatja e kabinës me ar titan.'
    },
    {
      number: 'KR-PRJ-2026-0007',
      name: 'Marigona Hill Rezidenca B2 — Hajvali',
      customerId: customers[6].id,
      contractId: null,
      elevatorCount: 2,
      floorsCount: 4,
      value: 43424,
      stage: 'Instalim',
      startDate: new Date('2026-08-20'),
      targetCompletionDate: new Date('2026-10-05'),
      notes: 'Montimi i shinave udhëzuese dhe motorit silent 220V.'
    },
    {
      number: 'KR-PRJ-2026-0008',
      name: 'Villa Rezidenciale Kryeziu — Pejë',
      customerId: customers[8].id,
      contractId: null,
      elevatorCount: 1,
      floorsCount: 3,
      value: 21712,
      stage: 'Përfunduar',
      startDate: new Date('2026-07-10'),
      targetCompletionDate: new Date('2026-08-25'),
      completedDate: new Date('2026-08-24'),
      notes: 'Projekti ka përfunduar me sukses të plotë. Dorëzuar klientit me certifikatë.'
    }
  ];

  const projects = [];
  for (const prjData of projectsData) {
    const prj = await prisma.project.create({ data: prjData });
    projects.push(prj);
  }

  // 14. Instalimet (10 Instalime me Checklist 13-pikësh)
  console.log('14. Krijimi i instalimeve dhe listave të kontrollit...');
  const checklistTemplates = [
    { key: 'chk_shaft', title: 'Kontrolli i boshtit (dimensionet, vertikaliteti)' },
    { key: 'chk_pit', title: 'Kontrolli i gropës (thellësia, hidroizolimi, shkallët)' },
    { key: 'chk_rails', title: 'Montimi i shinave udhëzuese të kabinës dhe kundërpeshës' },
    { key: 'chk_machine', title: 'Montimi i motorit gearless dhe bazamentit mbajtës' },
    { key: 'chk_controller', title: 'Montimi i panelit kontrollor dhe inverterit VVVF' },
    { key: 'chk_doors', title: 'Montimi i dyerve të kateve dhe mekanizmave të mbylljes' },
    { key: 'chk_cabin', title: 'Montimi i skeletit të kabinës, dyshemesë dhe mureve' },
    { key: 'chk_electrical', title: 'Lidhja e instalimeve elektrike dhe kabllos fleksibile' },
    { key: 'chk_safety', title: 'Montimi dhe kalibrimi i sistemit të sigurisë dhe frenimit' },
    { key: 'chk_phone', title: 'Testimi i telefonit emergjent GSM dhe butonit të alarmit' },
    { key: 'chk_testing', title: 'Testimi statik dhe dinamik me ngarkesë të plotë' },
    { key: 'chk_inspection', title: 'Inspektimi teknik zyrtar dhe certifikimi' },
    { key: 'chk_handover', title: 'Dorëzimi teknik dhe trajnimi i stafit/klientit' }
  ];

  const installationsData = [
    { projectId: projects[0].id, elevatorModel: 'KRONEER Elegance 630', serialNumber: 'KR-SN-2026-00401', teamLead: 'Blerim Shala', technicianId: techUser.id, startDate: new Date('2026-09-01'), targetDate: new Date('2026-10-10'), progressPercent: 62, status: 'Në Instalim' },
    { projectId: projects[0].id, elevatorModel: 'KRONEER Elegance 630', serialNumber: 'KR-SN-2026-00402', teamLead: 'Blerim Shala', technicianId: techUser.id, startDate: new Date('2026-09-01'), targetDate: new Date('2026-10-10'), progressPercent: 54, status: 'Në Instalim' },
    { projectId: projects[0].id, elevatorModel: 'KRONEER Elegance 630', serialNumber: 'KR-SN-2026-00403', teamLead: 'Blerim Shala', technicianId: techUser.id, startDate: new Date('2026-09-05'), targetDate: new Date('2026-10-15'), progressPercent: 38, status: 'Në Instalim' },
    { projectId: projects[0].id, elevatorModel: 'KRONEER Elegance 630', serialNumber: 'KR-SN-2026-00404', teamLead: 'Blerim Shala', technicianId: techUser.id, startDate: new Date('2026-09-05'), targetDate: new Date('2026-10-15'), progressPercent: 31, status: 'Në Instalim' },
    { projectId: projects[4].id, elevatorModel: 'KRONEER Elegance 630', serialNumber: 'KR-SN-2026-00411', teamLead: 'Agron Berisha', technicianId: techUser.id, startDate: new Date('2026-08-20'), targetDate: new Date('2026-09-20'), progressPercent: 92, status: 'Në Testim' },
    { projectId: projects[4].id, elevatorModel: 'KRONEER Elegance 630', serialNumber: 'KR-SN-2026-00412', teamLead: 'Agron Berisha', technicianId: techUser.id, startDate: new Date('2026-08-20'), targetDate: new Date('2026-09-20'), progressPercent: 85, status: 'Në Testim' },
    { projectId: projects[6].id, elevatorModel: 'KRONEER HomeVilla 450', serialNumber: 'KR-SN-2026-00421', teamLead: 'Blerim Shala', technicianId: techUser.id, startDate: new Date('2026-08-25'), targetDate: new Date('2026-09-30'), progressPercent: 69, status: 'Në Instalim' },
    { projectId: projects[6].id, elevatorModel: 'KRONEER HomeVilla 450', serialNumber: 'KR-SN-2026-00422', teamLead: 'Blerim Shala', technicianId: techUser.id, startDate: new Date('2026-08-25'), targetDate: new Date('2026-09-30'), progressPercent: 69, status: 'Në Instalim' },
    { projectId: projects[7].id, elevatorModel: 'KRONEER HomeVilla 450', serialNumber: 'KR-SN-2026-00399', teamLead: 'Blerim Shala', technicianId: techUser.id, startDate: new Date('2026-07-20'), targetDate: new Date('2026-08-20'), completionDate: new Date('2026-08-24'), progressPercent: 100, status: 'Përfunduar' },
    { projectId: projects[1].id, elevatorModel: 'KRONEER Titanium 1000', serialNumber: 'KR-SN-2026-00431', teamLead: 'Agron Berisha', technicianId: techUser.id, startDate: new Date('2026-09-10'), targetDate: new Date('2026-11-20'), progressPercent: 15, status: 'Në Instalim' }
  ];

  for (const instData of installationsData) {
    const inst = await prisma.installation.create({ data: instData });

    // Krijimi i 13 artikujve të checklist-it
    const completedCount = Math.round((instData.progressPercent / 100) * 13);
    for (let j = 0; j < checklistTemplates.length; j++) {
      const isDone = j < completedCount;
      await prisma.installationChecklist.create({
        data: {
          installationId: inst.id,
          itemKey: checklistTemplates[j].key,
          itemTitle: checklistTemplates[j].title,
          isCompleted: isDone,
          completedAt: isDone ? new Date() : null,
          completedBy: isDone ? inst.teamLead : null
        }
      });
    }
  }

  // 15. Dorëzimi i Liftit (Handover me nënshkrim)
  console.log('15. Krijimi i procesverbalit të dorëzimit...');
  await prisma.handover.create({
    data: {
      projectId: projects[7].id,
      customerId: customers[8].id,
      elevatorModel: 'KRONEER HomeVilla 450',
      serialNumber: 'KR-SN-2026-00399',
      installationDate: new Date('2026-08-20'),
      handoverDate: new Date('2026-08-24'),
      technicalInspection: true,
      safetyCheck: true,
      documentationHanded: true,
      clientTrainingDone: true,
      keysHanded: true,
      accessActivated: true,
      warrantyStarted: true,
      clientSigneeName: 'Agim Kryeziu',
      clientSignatureData: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><path d="M10 40 Q50 10 90 40 T170 30" stroke="%230F172A" stroke-width="2" fill="none"/></svg>',
      repSigneeName: 'Ing. Artur Kastrati (KRONEER)',
      repSignatureData: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><path d="M10 30 Q60 50 120 20 T180 35" stroke="%230F172A" stroke-width="2" fill="none"/></svg>',
      notes: 'Lifti i dorëzuar në gjendje të shkëlqyer teknike dhe estetike. Klienti u pajis me manualin e përdorimit dhe 3 palë çelësa emergjence.',
      status: 'Dorëzuar me Sukses'
    }
  });

  // 16. Kontratat e Mirëmbajtjes (10 Kontrata)
  console.log('16. Krijimi i kontratave të mirëmbajtjes...');
  const maintenanceData = [
    { number: 'KR-MNT-2026-0001', customerId: customers[0].id, elevatorId: elevators[0].id, serialNumber: 'KR-SN-2025-00101', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), frequency: 'Mujore', priceAnnual: 1800, technicianId: techUser.id, status: 'Aktive', notes: 'Mirëmbajtje mujore e rregullt' },
    { number: 'KR-MNT-2026-0002', customerId: customers[1].id, elevatorId: elevators[1].id, serialNumber: 'KR-SN-2025-00102', startDate: new Date('2026-02-01'), endDate: new Date('2027-01-31'), frequency: 'Mujore', priceAnnual: 2400, technicianId: techUser.id, status: 'Aktive', notes: 'Shërbim me telemetri 24/7' },
    { number: 'KR-MNT-2026-0003', customerId: customers[3].id, elevatorId: elevators[5].id, serialNumber: 'KR-SN-2025-00103', startDate: new Date('2026-03-01'), endDate: new Date('2027-02-28'), frequency: 'Mujore', priceAnnual: 3200, technicianId: techUser.id, status: 'Aktive', notes: 'Kontratë spitalore me gatishmëri të menjëhershme' },
    { number: 'KR-MNT-2026-0004', customerId: customers[5].id, elevatorId: elevators[0].id, serialNumber: 'KR-SN-2024-00088', startDate: new Date('2025-10-01'), endDate: new Date('2026-09-30'), frequency: 'Mujore', priceAnnual: 2100, technicianId: techUser.id, status: 'Skadon së shpejti', notes: 'Kontrata skadon pas 16 ditësh - nevojitet ripërtëritje' },
    { number: 'KR-MNT-2026-0005', customerId: customers[6].id, elevatorId: elevators[2].id, serialNumber: 'KR-SN-2025-00115', startDate: new Date('2026-01-15'), endDate: new Date('2027-01-14'), frequency: 'Tremujore', priceAnnual: 1200, technicianId: techUser.id, status: 'Aktive', notes: 'Vizitë çdo 3 muaj' },
    { number: 'KR-MNT-2026-0006', customerId: customers[4].id, elevatorId: elevators[0].id, serialNumber: 'KR-SN-2025-00120', startDate: new Date('2026-04-01'), endDate: new Date('2027-03-31'), frequency: 'Mujore', priceAnnual: 1600, technicianId: techUser.id, status: 'Aktive', notes: 'Kompleksi Prizren' },
    { number: 'KR-MNT-2026-0007', customerId: customers[8].id, elevatorId: elevators[2].id, serialNumber: 'KR-SN-2026-00399', startDate: new Date('2026-08-25'), endDate: new Date('2028-08-24'), frequency: 'Gjashtëmujore', priceAnnual: 600, technicianId: techUser.id, status: 'Aktive', notes: 'Vila Pejë - 2 vite të përfshira në garanci' },
    { number: 'KR-MNT-2026-0008', customerId: customers[9].id, elevatorId: elevators[0].id, serialNumber: 'KR-SN-2024-00075', startDate: new Date('2025-08-01'), endDate: new Date('2026-07-31'), frequency: 'Mujore', priceAnnual: 1500, technicianId: techUser.id, status: 'E skaduar', notes: 'Kontrata ka skaduar - dërguar njoftim për ofertë të re' },
    { number: 'KR-MNT-2026-0009', customerId: customers[7].id, elevatorId: elevators[1].id, serialNumber: 'KR-SN-2025-00140', startDate: new Date('2026-05-01'), endDate: new Date('2027-04-30'), frequency: 'Mujore', priceAnnual: 2200, technicianId: techUser.id, status: 'Aktive', notes: 'Mirëmbajtje Durrës' },
    { number: 'KR-MNT-2026-0010', customerId: customers[2].id, elevatorId: elevators[3].id, serialNumber: 'KR-SN-2025-00150', startDate: new Date('2026-06-01'), endDate: new Date('2027-05-31'), frequency: 'Mujore', priceAnnual: 2900, technicianId: techUser.id, status: 'Aktive', notes: 'Kulla Tiranë' }
  ];

  for (const mData of maintenanceData) {
    const m = await prisma.maintenanceContract.create({ data: mData });

    // Krijimi i një vizite të mirëmbajtjes
    await prisma.maintenanceVisit.create({
      data: {
        contractId: m.id,
        technicianId: techUser.id,
        visitDate: new Date('2026-09-08'),
        completedDate: new Date('2026-09-08'),
        status: 'E Përfunduar',
        findings: 'Të gjitha parametrat e sigurisë, frenimit dhe vajit të makinës janë brenda normave optimale.',
        actionsTaken: 'Lubrifikim i shinave, pastrim i sensorëve optikë të derës dhe kontrolli i tensionit të kordonëve.',
        clientSigned: true,
        notes: 'Vizitë e suksesshme pa asnjë vërejtje teknike.'
      }
    });
  }

  // 17. Kërkesat për Servis (10 Tiketa)
  console.log('17. Krijimi i tiketave të servisit...');
  const serviceTicketsData = [
    { number: 'KR-SRV-2026-00451', customerId: customers[3].id, elevatorId: elevators[5].id, serialNumber: 'KR-SN-2025-00103', problemDescription: 'Dyert automatike të katit të dytë mbyllen me ngadalësim dhe shfaqin kodin E-42 në ekran.', priority: 'Kritik', technicianId: techUser.id, status: 'Në proces', reportedDate: new Date('2026-09-13'), scheduledDate: new Date('2026-09-14') },
    { number: 'KR-SRV-2026-00452', customerId: customers[1].id, elevatorId: elevators[1].id, serialNumber: 'KR-SN-2025-00102', problemDescription: 'Drita e butonit të thirrjes në katin 12 nuk ndizet gjatë shtypjes.', priority: 'Normal', technicianId: techUser.id, status: 'Caktuar', reportedDate: new Date('2026-09-12'), scheduledDate: new Date('2026-09-15') },
    { number: 'KR-SRV-2026-00453', customerId: customers[5].id, elevatorId: elevators[0].id, serialNumber: 'KR-SN-2024-00088', problemDescription: 'Zhurmë e lehtë fërkimi gjatë ngjitjes midis katit të 4-të dhe të 5-të.', priority: 'I lartë', technicianId: techUser.id, status: 'Hapur', reportedDate: new Date('2026-09-13'), scheduledDate: new Date('2026-09-14') },
    { number: 'KR-SRV-2026-00454', customerId: customers[0].id, elevatorId: elevators[0].id, serialNumber: 'KR-SN-2025-00101', problemDescription: 'Telefoni emergjent humbi sinjalin GSM për shkak të ndërrimit të kartelës nga klienti.', priority: 'Normal', technicianId: techUser.id, status: 'Zgjidhur', reportedDate: new Date('2026-09-08'), scheduledDate: new Date('2026-09-09'), resolvedDate: new Date('2026-09-09'), resolutionNotes: 'U ri-konfigurua moduli GSM me frekuencë të re dhe u testua me sukses me dispeçerin.' },
    { number: 'KR-SRV-2026-00455', customerId: customers[6].id, elevatorId: elevators[2].id, serialNumber: 'KR-SN-2025-00115', problemDescription: 'Kërkesë për rregullim të ndriçimit të brendshëm LED të kabinës.', priority: 'I ulët', technicianId: techUser.id, status: 'Mbyllur', reportedDate: new Date('2026-09-02'), scheduledDate: new Date('2026-09-03'), resolvedDate: new Date('2026-09-03'), resolutionNotes: 'U ndërrua drajveri LED 24V dhe ndriçimi funksionon perfekt.' },
    { number: 'KR-SRV-2026-00456', customerId: customers[4].id, elevatorId: elevators[0].id, serialNumber: 'KR-SN-2025-00120', problemDescription: 'Nivelizimi në katin përdhesë ka një diferencë prej 15mm.', priority: 'I lartë', technicianId: techUser.id, status: 'Në pritje', reportedDate: new Date('2026-09-11'), scheduledDate: new Date('2026-09-14') },
    { number: 'KR-SRV-2026-00457', customerId: customers[9].id, elevatorId: elevators[0].id, serialNumber: 'KR-SN-2024-00075', problemDescription: 'Butoni i hapjes së dyerve në kabinë është i liruar nga mekanizmi.', priority: 'Normal', technicianId: techUser.id, status: 'Caktuar', reportedDate: new Date('2026-09-10'), scheduledDate: new Date('2026-09-15') },
    { number: 'KR-SRV-2026-00458', customerId: customers[2].id, elevatorId: elevators[3].id, serialNumber: 'KR-SN-2025-00150', problemDescription: 'Pastrim i sensorit optik të derës panoramike pas punimeve të fasadës.', priority: 'Normal', technicianId: techUser.id, status: 'Zgjidhur', reportedDate: new Date('2026-09-05'), resolvedDate: new Date('2026-09-06'), resolutionNotes: 'Sensori u pastrua dhe u rikalibrua.' },
    { number: 'KR-SRV-2026-00459', customerId: customers[7].id, elevatorId: elevators[1].id, serialNumber: 'KR-SN-2025-00140', problemDescription: 'Testim i baterisë së evakuimit automatik ARD.', priority: 'Normal', technicianId: techUser.id, status: 'Mbyllur', reportedDate: new Date('2026-08-28'), resolvedDate: new Date('2026-08-29'), resolutionNotes: 'Bateritë në gjendje 100% optimale.' },
    { number: 'KR-SRV-2026-00460', customerId: customers[3].id, elevatorId: elevators[5].id, serialNumber: 'KR-SN-2025-00103', problemDescription: 'Kalibrimi i peshores elektronike të mbipeshes (Overload sensor).', priority: 'I lartë', technicianId: techUser.id, status: 'Zgjidhur', reportedDate: new Date('2026-08-20'), resolvedDate: new Date('2026-08-21'), resolutionNotes: 'U kalibrua me pesha provuese 1600kg.' }
  ];

  for (const srvData of serviceTicketsData) {
    await prisma.serviceTicket.create({ data: srvData });
  }

  // 18. Pjesët Rezervë (30 Artikuj Inventari)
  console.log('18. Krijimi i inventarit të pjesëve rezervë...');
  const sparePartsData = [
    { partNumber: 'KR-SP-001', name: 'Inverter VVVF Monarch NICE3000+ 7.5kW', category: 'Elektronike', compatibleElevators: 'KR-PASS-630, KR-PASS-1000', stockQty: 4, minStockQty: 2, purchasePrice: 850, sellingPrice: 1350, supplier: 'Monarch Control Systems', location: 'Magazina A, Rafti 1' },
    { partNumber: 'KR-SP-002', name: 'Inverter VVVF Yaskawa L1000A 11kW', category: 'Elektronike', compatibleElevators: 'KR-PASS-1000, KR-HOSP-1600', stockQty: 2, minStockQty: 2, purchasePrice: 1200, sellingPrice: 1900, supplier: 'Yaskawa Europe', location: 'Magazina A, Rafti 1' },
    { partNumber: 'KR-SP-003', name: 'Perde me Rreze Optike 2D WECO 128 Rreze', category: 'Siguri', compatibleElevators: 'Të gjithë modelet KRONEER', stockQty: 18, minStockQty: 5, purchasePrice: 110, sellingPrice: 220, supplier: 'WECO Sensors', location: 'Magazina B, Rafti 3' },
    { partNumber: 'KR-SP-004', name: 'Kabllo Fleksibile e Kabinës 24x0.75mm + 2xShield', category: 'Elektrike', compatibleElevators: 'Të gjithë modelet', stockQty: 450, minStockQty: 100, purchasePrice: 4.5, sellingPrice: 9.0, supplier: 'Draka Elevator Cables', location: 'Magazina C, Roli 4' },
    { partNumber: 'KR-SP-005', name: 'Kordon Tërheqës Çeliku Spezial Drako 10mm (6x19)', category: 'Mekanike', compatibleElevators: 'KR-PASS-630, KR-HOME-450', stockQty: 600, minStockQty: 150, purchasePrice: 3.8, sellingPrice: 7.5, supplier: 'Pfeifer Drako Gjermani', location: 'Magazina C, Roli 1' },
    { partNumber: 'KR-SP-006', name: 'Patina Udhëzuese Kabine me Rula (Roller Guide) 125mm', category: 'Mekanike', compatibleElevators: 'KR-PASS-1000, KR-PAN-1000', stockQty: 3, minStockQty: 6, purchasePrice: 65, sellingPrice: 130, supplier: 'ETP Elevator Tech', location: 'Magazina A, Rafti 4' }, // STOK I ULËT
    { partNumber: 'KR-SP-007', name: 'Patina Plastike Standarde për Shina T75/T89', category: 'Mekanike', compatibleElevators: 'KR-PASS-630, KR-HOME-450', stockQty: 48, minStockQty: 12, purchasePrice: 6, sellingPrice: 15, supplier: 'Acla-Werke', location: 'Magazina A, Rafti 4' },
    { partNumber: 'KR-SP-008', name: 'Bllok Sigurie Frenimi me Pyka (Safety Gear) 1600kg', category: 'Siguri', compatibleElevators: 'KR-PASS-1000, KR-HOSP-1600', stockQty: 4, minStockQty: 2, purchasePrice: 380, sellingPrice: 680, supplier: 'Wittur Group', location: 'Magazina A, Rafti 5' },
    { partNumber: 'KR-SP-009', name: 'Kufizues Shpejtësie Bidireksional (Overspeed Governor)', category: 'Siguri', compatibleElevators: 'KR-PASS-630, KR-PASS-1000', stockQty: 6, minStockQty: 3, purchasePrice: 240, sellingPrice: 450, supplier: 'Wittur Group', location: 'Magazina A, Rafti 5' },
    { partNumber: 'KR-SP-010', name: 'Mekanizëm Operatori i Dyerve Qendrore Selcom 900mm', category: 'Dyer', compatibleElevators: 'KR-PASS-1000, KR-PAN-1000', stockQty: 1, minStockQty: 3, purchasePrice: 650, sellingPrice: 1150, supplier: 'Wittur Selcom', location: 'Magazina D, Rafti 1' }, // STOK I ULËT
    { partNumber: 'KR-SP-011', name: 'Mekanizëm Operatori i Dyerve Teleskopike Fermator 800mm', category: 'Dyer', compatibleElevators: 'KR-PASS-630, KR-HOME-450', stockQty: 5, minStockQty: 2, purchasePrice: 520, sellingPrice: 950, supplier: 'Fermator Spanjë', location: 'Magazina D, Rafti 2' },
    { partNumber: 'KR-SP-012', name: 'Kyç Sigurie i Dyerve të Katit Selcom / Kronenberg', category: 'Dyer', compatibleElevators: 'Të gjithë modelet', stockQty: 24, minStockQty: 8, purchasePrice: 45, sellingPrice: 95, supplier: 'Kronenberg Gjermani', location: 'Magazina D, Rafti 3' },
    { partNumber: 'KR-SP-013', name: 'Rula dhe Karroca të Dyerve të Katit 56mm', category: 'Dyer', compatibleElevators: 'Fermator / Selcom', stockQty: 60, minStockQty: 15, purchasePrice: 8, sellingPrice: 20, supplier: 'Fermator Spanjë', location: 'Magazina D, Rafti 3' },
    { partNumber: 'KR-SP-014', name: 'Rrip Dhëmbëzor i Operatorit të Dyerve HTD 8M', category: 'Dyer', compatibleElevators: 'Fermator / Selcom', stockQty: 22, minStockQty: 5, purchasePrice: 15, sellingPrice: 38, supplier: 'Optibelt', location: 'Magazina D, Rafti 4' },
    { partNumber: 'KR-SP-015', name: 'Tastierë Kabine COP me Butona Inoksi me Ndriçim Blu', category: 'Interier', compatibleElevators: 'KR-PASS-630, KR-PASS-1000', stockQty: 5, minStockQty: 2, purchasePrice: 310, sellingPrice: 580, supplier: 'Vega Style Itali', location: 'Magazina B, Rafti 1' },
    { partNumber: 'KR-SP-016', name: 'Buton Thirrjeje Kati LOP me Shkrim Braille & LED', category: 'Elektrike', compatibleElevators: 'Të gjithë modelet', stockQty: 65, minStockQty: 20, purchasePrice: 12, sellingPrice: 28, supplier: 'Vega Style Itali', location: 'Magazina B, Rafti 1' },
    { partNumber: 'KR-SP-017', name: 'Ekran Pozicioni Dot-Matrix / LCD 4.3 inç', category: 'Elektrike', compatibleElevators: 'Të gjithë modelet', stockQty: 14, minStockQty: 4, purchasePrice: 65, sellingPrice: 140, supplier: 'Vega Style Itali', location: 'Magazina B, Rafti 2' },
    { partNumber: 'KR-SP-018', name: 'Modul Dialer GSM 4G Emergjence me Bateri', category: 'Elektronike', compatibleElevators: 'Të gjithë modelet', stockQty: 12, minStockQty: 4, purchasePrice: 140, sellingPrice: 290, supplier: '2N Telecommunications', location: 'Magazina B, Rafti 4' },
    { partNumber: 'KR-SP-019', name: 'Bateri me Xhel 12V 7.2Ah për Sistem Emergjence ARD', category: 'Elektrike', compatibleElevators: 'Të gjithë modelet', stockQty: 20, minStockQty: 8, purchasePrice: 18, sellingPrice: 42, supplier: 'Yuasa Battery', location: 'Magazina B, Rafti 5' },
    { partNumber: 'KR-SP-020', name: 'Amortizator Hidraulik i Gropës (Buffer) 1.6m/s', category: 'Siguri', compatibleElevators: 'KR-PASS-1000, KR-PAN-1000', stockQty: 0, minStockQty: 2, purchasePrice: 290, sellingPrice: 520, supplier: 'Oleo Buffers UK', location: 'Magazina A, Rafti 6' }, // PA STOK
    { partNumber: 'KR-SP-021', name: 'Amortizator Poliuretani për Gropë (Buffer) 1.0m/s', category: 'Siguri', compatibleElevators: 'KR-PASS-630, KR-HOME-450', stockQty: 16, minStockQty: 4, purchasePrice: 35, sellingPrice: 75, supplier: 'Acla-Werke', location: 'Magazina A, Rafti 6' },
    { partNumber: 'KR-SP-022', name: 'Peshore Elektronike Kabine me Sensor Nën-dysheme', category: 'Elektronike', compatibleElevators: 'Të gjithë modelet', stockQty: 7, minStockQty: 3, purchasePrice: 125, sellingPrice: 260, supplier: 'Dinacell Electrónica', location: 'Magazina B, Rafti 3' },
    { partNumber: 'KR-SP-023', name: 'Bobinë Frenash Elektromagnetike për Motor Gearless', category: 'Elektrike', compatibleElevators: 'KR-PASS-630, KR-PASS-1000', stockQty: 2, minStockQty: 2, purchasePrice: 280, sellingPrice: 540, supplier: 'Torin Drive', location: 'Magazina A, Rafti 2' },
    { partNumber: 'KR-SP-024', name: 'Pulsator dhe Ndërprerës Kufitar Fund-Udhe (Limit Switch)', category: 'Elektrike', compatibleElevators: 'Të gjithë modelet', stockQty: 35, minStockQty: 10, purchasePrice: 9, sellingPrice: 22, supplier: 'Schmersal Gjermani', location: 'Magazina B, Rafti 2' },
    { partNumber: 'KR-SP-025', name: 'Vaj Sintetik Special për Mekanizma Liftesh ISO VG 220 (20L)', category: 'Mekanike', compatibleElevators: 'KR-FREIGHT-2000, KR-CAR-2500', stockQty: 8, minStockQty: 3, purchasePrice: 95, sellingPrice: 180, supplier: 'Mobil Industrial Lubricants', location: 'Magazina C, Dysheme' },
    { partNumber: 'KR-SP-026', name: 'Ventilator Shfryrës me Qarkullim të Lartë për Kabinë', category: 'Interier', compatibleElevators: 'Të gjithë modelet', stockQty: 9, minStockQty: 3, purchasePrice: 42, sellingPrice: 90, supplier: 'EBM-Papst', location: 'Magazina B, Rafti 6' },
    { partNumber: 'KR-SP-027', name: 'Tastierë Inspektimi mbi Çati të Kabinës (Top of Car Box)', category: 'Siguri', compatibleElevators: 'Të gjithë modelet', stockQty: 11, minStockQty: 4, purchasePrice: 75, sellingPrice: 155, supplier: 'Giovenzana Itali', location: 'Magazina B, Rafti 6' },
    { partNumber: 'KR-SP-028', name: 'Transformator Izolues Rrjeti 380V/220V/110V/24V 500VA', category: 'Elektrike', compatibleElevators: 'Të gjithë modelet', stockQty: 6, minStockQty: 2, purchasePrice: 55, sellingPrice: 115, supplier: 'Elektrometal', location: 'Magazina B, Rafti 5' },
    { partNumber: 'KR-SP-029', name: 'Shirit Ndriçimi LED 24V IP67 për Bosht (Rul 50m)', category: 'Elektrike', compatibleElevators: 'Të gjithë modelet', stockQty: 4, minStockQty: 2, purchasePrice: 85, sellingPrice: 165, supplier: 'Osram Lighting', location: 'Magazina C, Roli 2' },
    { partNumber: 'KR-SP-030', name: 'Magnet dhe Sensorë Magnetikë Pozicionimi Katit', category: 'Elektrike', compatibleElevators: 'Të gjithë modelet', stockQty: 28, minStockQty: 10, purchasePrice: 14, sellingPrice: 32, supplier: 'Monarch Systems', location: 'Magazina B, Rafti 2' }
  ];

  for (const spData of sparePartsData) {
    await prisma.sparePart.create({ data: spData });
  }

  // 19. Historiku i Aktiviteteve (Audit Trail)
  console.log('19. Krijimi i aktiviteteve...');
  const activitiesData = [
    { userId: admin.id, userName: 'Krenar Berisha (Kryeadmin)', actionType: 'Krijuar', entityType: 'Klient', entityId: customers[0].id, description: 'U regjistrua klienti i ri "Albi Group & Construction Sh.p.k."' },
    { userId: salesUser.id, userName: 'Besnik Krasniqi', actionType: 'Krijuar', entityType: 'Ofertë', entityId: quotations[0].id, description: 'U krijua oferta zyrtare KR-O-2026-0001 me vlerë €102,660' },
    { userId: salesUser.id, userName: 'Besnik Krasniqi', actionType: 'Dërguar', entityType: 'Ofertë', entityId: quotations[0].id, description: 'Oferta KR-O-2026-0001 iu dërgua me email klientit Albi Group' },
    { userId: salesUser.id, userName: 'Besnik Krasniqi', actionType: 'Pranuar', entityType: 'Ofertë', entityId: quotations[0].id, description: 'Klienti pranoi ofertën KR-O-2026-0001' },
    { userId: admin.id, userName: 'Krenar Berisha (Kryeadmin)', actionType: 'Krijuar', entityType: 'Kontratë', entityId: contracts[0].id, description: 'U nënshkrua kontrata zyrtare KR-K-2026-0001' },
    { userId: financeUser.id, userName: 'Valbona Gashi', actionType: 'Krijuar', entityType: 'Profaturë', entityId: 1, description: 'U lëshua profatura KR-PF-2026-0001 me ndarje etapash' },
    { userId: financeUser.id, userName: 'Valbona Gashi', actionType: 'Paguar', entityType: 'Pagesë', entityId: 1, description: 'U regjistrua pagesa e paradhënies €30,798 nga Albi Group (Ref: BKT-TR-892019)' },
    { userId: projectUser.id, userName: 'Ing. Artur Kastrati', actionType: 'Krijuar', entityType: 'Projekt', entityId: projects[0].id, description: 'U hap projekti i ri i instalimit KR-PRJ-2026-0001' },
    { userId: techUser.id, userName: 'Blerim Shala (Kryeteknik)', actionType: 'Ndryshuar', entityType: 'Instalim', entityId: 1, description: 'U përfundua montimi i shinave dhe motorit për liftin KR-SN-2026-00401 (Progresi: 62%)' },
    { userId: projectUser.id, userName: 'Ing. Artur Kastrati', actionType: 'Dorëzuar', entityType: 'Projekt', entityId: projects[7].id, description: 'U nënshkrua procesverbali i dorëzimit teknik për projektin Villa Pejë' }
  ];

  for (const actData of activitiesData) {
    await prisma.activity.create({ data: actData });
  }

  // 20. Qendra e Njoftimeve
  console.log('20. Krijimi i njoftimeve...');
  const notificationsData = [
    { userId: admin.id, title: 'Kontratë e Re e Miratuar', message: 'Kontrata KR-K-2026-0001 për Albi Tower u miratua dhe u aktivizua.', type: 'success', isRead: false, linkUrl: '/kontratat' },
    { userId: financeUser.id, title: 'Faturë e Vonuar', message: 'Fatura KR-F-2026-0006 për Swiss Diamond ka kaluar afatin e pagesës prej 15 ditësh.', type: 'warning', isRead: false, linkUrl: '/faturat' },
    { userId: techUser.id, title: 'Tiketë Emergjente Servisi', message: 'Tiketa KR-SRV-2026-00451 (Spitali Amerikan) kërkon ndërhyrje me prioritet kritik.', type: 'error', isRead: false, linkUrl: '/servisi' },
    { userId: admin.id, title: 'Paralajmërim Stoku', message: 'Pjesa rezervë "Amortizator Hidraulik Oleo 1.6m/s" ka 0 copë në stok (Pa Stok).', type: 'error', isRead: false, linkUrl: '/pjeset-rezerve' },
    { userId: salesUser.id, title: 'Oferta Skadon Së Shpejti', message: 'Oferta KR-O-2026-0003 për Tirana View Towers skadon pas 11 ditësh.', type: 'info', isRead: true, linkUrl: '/ofertat' }
  ];

  for (const notifData of notificationsData) {
    await prisma.notification.create({ data: notifData });
  }

  console.log('--- Mbushja e bazës së të dhënave KRONEER përfundoi me sukses të plotë! ---');
}

main()
  .catch((e) => {
    console.error('Gabim gjatë mbushjes së të dhënave:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
