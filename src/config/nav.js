// Single source of truth for navigation (desktop mega-menu + mobile drawer). Role rules match the old sidebar.
function buildNav(user) {
  const role = (user && user.role) || '';
  const admin = role === 'ADMINISTRATOR';
  const sales = role === 'SHITJE';
  const finance = role === 'FINANCE';
  const manager = role === 'MENAXHER_PROJEKTI';
  const generalManager = role === 'MENAXHER';
  const tech = role === 'TEKNIK';
  const L = (href, label, icon, match) => ({ href, label, icon, match: match || [href] });

  const groups = [];

  if (admin || sales || finance || manager || generalManager) {
    const items = [
      L('/klientet', 'Klientët & Kontaktet', 'users'),
      L('/ofertat', 'Ofertat', 'file-text'),
      L('/kontratat', 'Kontratat', 'clipboard-check'),
    ];
    if (admin || finance || generalManager) {
      items.push(L('/faturat', 'Faturat', 'receipt'), L('/pagesat', 'Pagesat', 'credit-card'), L('/shpenzimet', 'Shpenzimet', 'wallet'));
    }
    if (admin || generalManager) items.push(L('/pjeset-rezerve', 'Produktet/Shërbimet', 'package'));
    if (admin || generalManager || manager || finance) items.push(L('/furnitoret', 'Furnitorët', 'truck'));
    groups.push({ key: 'furnizimi', title: 'Furnizimi', icon: 'layers', items });
  }

  if (admin || manager || generalManager || tech || sales || finance) {
    const items = [];
    if (admin || manager || generalManager || tech) {
      items.push(
        L('/instalimet', 'Qendra e Instalimeve', 'building-2', ['/instalimet', '/projektet', '/dorezimi']),
        L('/intervenimet', 'Intervenimet në Terren', 'wrench')
      );
    }
    items.push(L('/lifts/katalogu', 'Katalogu i Lifteve', 'layers', ['/lifts']));
    groups.push({
      key: 'instalimi', title: 'Instalimi', icon: 'hard-hat',
      items,
    });
  }

  groups.push({
    key: 'servisi', title: 'Servisi', icon: 'shield-check',
    items: [
      L('/servisi-mirembajtja', 'Qendra e Servisit', 'shield-check'),
      L('/servisi', 'Kërkesat për Servis', 'alert-triangle', ['/servisi/']),
      L('/mirembajtja', 'Kontratat e Mirëmbajtjes', 'calendar-check'),
    ],
  });

  const mod = [L('/modernizimi', 'Projektet e Modernizimit', 'refresh-cw')];
  if (!tech) mod.push(L('/projektet/krijo?line=Modernizim', 'Hap Modernizim të Ri', 'plus', ['/projektet/krijo']));
  groups.push({ key: 'modernizimi', title: 'Modernizimi', icon: 'refresh-cw', items: mod });

  const staff = [L('/prezenca', 'Orari & Prezenca (Live)', 'clock')];
  if (admin || manager || generalManager || finance) {
    staff.push(
      L('/puntoret', manager ? 'Ekipi Im & Puntorët' : 'Puntorët & Stafi', 'users', ['/puntoret']),
      L('/puntoret/financat/kesh-bonuse', manager ? 'Kesh & Bonuset e Ekipit' : 'Kesh & Bonuset e Stafit', 'banknote', ['/puntoret/financat'])
    );
  }
  staff.push(L('/dokumentet', 'Dokumentet', 'folder'));
  groups.push({ key: 'stafi', title: manager ? 'Ekipi' : 'Stafi', icon: 'users', items: staff });

  if (admin || finance || sales || generalManager) {
    const items = [L('/raportet', 'Raportet Analitike', 'bar-chart-3')];
    if (admin) items.push(L('/cilesimet', 'Cilësimet & Përdoruesit', 'settings'));
    else if (generalManager) items.push(L('/cilesimet', 'Cilësimet e mia', 'settings'));
    groups.push({ key: 'admin', title: 'Administrimi', icon: 'settings', items });
  } else if (manager || generalManager || tech) {
    groups.push({ key: 'admin', title: 'Llogaria', icon: 'settings', items: [L('/cilesimet', 'Cilësimet e mia', 'settings')] });
  }

  return groups;
}

module.exports = { buildNav };
