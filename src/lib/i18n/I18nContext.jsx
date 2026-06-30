const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { createContext, useContext, useState, useEffect } from 'react';

const translations = {
  en: {
    common: {
      all: 'All', pending: 'Pending', sent: 'Sent', confirmed: 'Confirmed',
      rejected: 'Rejected', cancelled: 'Cancelled', active: 'Active', inactive: 'Inactive',
      save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', close: 'Close',
      loading: 'Loading...', error: 'Error', success: 'Success', back: 'Back',
      accessDenied: 'Access Denied', search: 'Search', status: 'Status', actions: 'Actions',
      yes: 'Yes', no: 'No', name: 'Name', email: 'Email', phone: 'Phone', notes: 'Notes',
      city: 'City', country: 'Country', address: 'Address',
    },
    nav: {
      dashboard: 'Dashboard', reservations: 'Reservations', suppliers: 'Suppliers',
      crm: 'CRM', invoices: 'Invoices', services: 'Services', revenue: 'Revenue',
      newProposal: 'New Proposal', newReservation: 'New Reservation', categories: 'Categories',
      bookings: 'Bookings', templates: 'Templates', users: 'Users', settings: 'Settings',
      importHub: 'Import Hub', supplierPortal: 'Supplier Portal',
    },
    dashboard: { title: 'Dashboard', subtitle: "Welcome back! Here's what's happening." },
    reservations: {
      title: 'Reservations', subtitle: 'Manage your travel reservations',
      newReservation: 'New Reservation', searchPlaceholder: 'Search reservations...',
      noReservations: 'No reservations found', createFirst: 'Create your first reservation',
      loadingReservations: 'Loading reservations...', past: 'Past',
    },
    suppliers: {
      title: 'Suppliers', subtitle: 'Manage your supplier network',
      newSupplier: 'New Supplier', searchPlaceholder: 'Search suppliers...',
      noSuppliers: 'No suppliers found',
    },
    crm: {
      title: 'CRM', subtitle: 'Manage your clients',
      newClient: 'New Client', searchPlaceholder: 'Search clients...',
    },
    invoices: {
      title: 'Invoices', subtitle: 'Manage your invoices',
      newInvoice: 'New Invoice', searchPlaceholder: 'Search invoices...',
      status: { draft: 'Draft', sent: 'Sent', paid: 'Paid', overdue: 'Overdue', cancelled: 'Cancelled' },
    },
    proposals: { title: 'Proposals', subtitle: 'Manage your proposals', newProposal: 'New Proposal' },
    settings: {
      title: 'App Settings', subtitle: 'Configure your application settings',
      branding: 'Branding', appName: 'App Name', logo: 'Logo',
      language: 'Language', defaultLanguage: 'Default Language', yourLanguage: 'Your Language',
      referenceFormat: 'Reference Number Format', prefix: 'Prefix',
      includeDepartment: 'Department', includeCategory: 'Category', includeYear: 'Year',
      sampleReference: 'Sample Reference',
      invoiceHeader: 'Invoice Header', invoiceHeaderHint: 'This information appears on all invoices',
      companyName: 'Company Name', taxId: 'Tax ID / VAT',
      addressLine1: 'Address Line 1', addressLine2: 'Address Line 2',
      postalCode: 'Postal Code', country: 'Country', city: 'City',
      invoiceLogo: 'Invoice Logo', bankDetails: 'Bank Details',
      bankDetailsPlaceholder: 'Bank name, IBAN, SWIFT, etc.',
      defaultInvoiceSettings: 'Default Invoice Settings',
      defaultPaymentTerms: 'Default Payment Terms',
      defaultNotes: 'Default Notes',
      defaultNotesPlaceholder: 'Notes that will appear on all invoices by default...',
      departments: 'Departments', newDepartment: 'New department name',
      saveSettings: 'Save Settings',
      accessDenied: 'You do not have permission to access app settings.',
    },
    supplierPortal: {
      title: 'Supplier Portal', welcome: 'Welcome, {name}',
      notLinked: 'Your account is not linked to a supplier. Please contact an administrator.',
      manageServices: 'Manage your services, bookings and invoices',
      pendingBookings: 'Pending Bookings', confirmed: 'Confirmed',
      totalBookings: 'Total Bookings', avgRating: 'Avg Rating',
      bookings: 'Bookings', bookingRequests: 'Booking Requests',
      quoteRequests: 'Quote Requests', myServices: 'My Services',
      services: 'Services', invoices: 'Invoices', myInvoices: 'My Invoices',
      ratings: 'Ratings', reviews: 'Reviews', analytics: 'Analytics',
    },
  },

  es: {
    common: {
      all: 'Todos', pending: 'Pendiente', sent: 'Enviado', confirmed: 'Confirmado',
      rejected: 'Rechazado', cancelled: 'Cancelado', active: 'Activo', inactive: 'Inactivo',
      save: 'Guardar', cancel: 'Cancelar', delete: 'Eliminar', edit: 'Editar', close: 'Cerrar',
      loading: 'Cargando...', error: 'Error', success: 'Éxito', back: 'Volver',
      accessDenied: 'Acceso denegado', search: 'Buscar', status: 'Estado', actions: 'Acciones',
      yes: 'Sí', no: 'No', name: 'Nombre', email: 'Correo', phone: 'Teléfono', notes: 'Notas',
      city: 'Ciudad', country: 'País', address: 'Dirección',
    },
    nav: {
      dashboard: 'Panel', reservations: 'Reservas', suppliers: 'Proveedores',
      crm: 'CRM', invoices: 'Facturas', services: 'Servicios', revenue: 'Ingresos',
      newProposal: 'Nueva Propuesta', newReservation: 'Nueva Reserva', categories: 'Categorías',
      bookings: 'Reservas', templates: 'Plantillas', users: 'Usuarios', settings: 'Ajustes',
      importHub: 'Centro de Importación', supplierPortal: 'Portal de Proveedores',
    },
    dashboard: { title: 'Panel', subtitle: '¡Bienvenido! Aquí está lo que está pasando.' },
    reservations: {
      title: 'Reservas', subtitle: 'Administra tus reservas de viaje',
      newReservation: 'Nueva Reserva', searchPlaceholder: 'Buscar reservas...',
      noReservations: 'No se encontraron reservas', createFirst: 'Crea tu primera reserva',
      loadingReservations: 'Cargando reservas...', past: 'Pasadas',
    },
    suppliers: {
      title: 'Proveedores', subtitle: 'Gestiona tu red de proveedores',
      newSupplier: 'Nuevo Proveedor', searchPlaceholder: 'Buscar proveedores...',
      noSuppliers: 'No se encontraron proveedores',
    },
    crm: { title: 'CRM', subtitle: 'Gestiona tus clientes', newClient: 'Nuevo Cliente', searchPlaceholder: 'Buscar clientes...' },
    invoices: {
      title: 'Facturas', subtitle: 'Gestiona tus facturas',
      newInvoice: 'Nueva Factura', searchPlaceholder: 'Buscar facturas...',
      status: { draft: 'Borrador', sent: 'Enviada', paid: 'Pagada', overdue: 'Vencida', cancelled: 'Cancelada' },
    },
    proposals: { title: 'Propuestas', subtitle: 'Gestiona tus propuestas', newProposal: 'Nueva Propuesta' },
    settings: {
      title: 'Configuración', subtitle: 'Configura tu aplicación',
      branding: 'Marca', appName: 'Nombre de la App', logo: 'Logo',
      language: 'Idioma', defaultLanguage: 'Idioma Predeterminado', yourLanguage: 'Tu Idioma',
      referenceFormat: 'Formato de Número de Referencia', prefix: 'Prefijo',
      includeDepartment: 'Departamento', includeCategory: 'Categoría', includeYear: 'Año',
      sampleReference: 'Referencia de Muestra', invoiceHeader: 'Encabezado de Factura',
      invoiceHeaderHint: 'Esta información aparece en todas las facturas',
      companyName: 'Nombre de la Empresa', taxId: 'NIF / IVA',
      addressLine1: 'Dirección Línea 1', addressLine2: 'Dirección Línea 2',
      postalCode: 'Código Postal', country: 'País', city: 'Ciudad',
      invoiceLogo: 'Logo de Factura', bankDetails: 'Datos Bancarios',
      bankDetailsPlaceholder: 'Banco, IBAN, SWIFT, etc.',
      defaultInvoiceSettings: 'Configuración de Factura Predeterminada',
      defaultPaymentTerms: 'Términos de Pago Predeterminados', defaultNotes: 'Notas Predeterminadas',
      defaultNotesPlaceholder: 'Notas que aparecerán en todas las facturas por defecto...',
      departments: 'Departamentos', newDepartment: 'Nombre del nuevo departamento',
      saveSettings: 'Guardar Configuración', accessDenied: 'No tienes permiso para acceder a la configuración.',
    },
    supplierPortal: {
      title: 'Portal de Proveedores', welcome: 'Bienvenido, {name}',
      notLinked: 'Tu cuenta no está vinculada a ningún proveedor. Contacta con un administrador.',
      manageServices: 'Gestiona tus servicios, reservas y facturas',
      pendingBookings: 'Reservas Pendientes', confirmed: 'Confirmadas',
      totalBookings: 'Total Reservas', avgRating: 'Valoración Media',
      bookings: 'Reservas', bookingRequests: 'Solicitudes de Reserva',
      quoteRequests: 'Solicitudes de Presupuesto', myServices: 'Mis Servicios',
      services: 'Servicios', invoices: 'Facturas', myInvoices: 'Mis Facturas',
      ratings: 'Valoraciones', reviews: 'Reseñas', analytics: 'Análisis',
    },
  },

  fr: {
    common: {
      all: 'Tous', pending: 'En attente', sent: 'Envoyé', confirmed: 'Confirmé',
      rejected: 'Rejeté', cancelled: 'Annulé', active: 'Actif', inactive: 'Inactif',
      save: 'Enregistrer', cancel: 'Annuler', delete: 'Supprimer', edit: 'Modifier', close: 'Fermer',
      loading: 'Chargement...', error: 'Erreur', success: 'Succès', back: 'Retour',
      accessDenied: 'Accès refusé', search: 'Rechercher', status: 'Statut', actions: 'Actions',
      yes: 'Oui', no: 'Non', name: 'Nom', email: 'Email', phone: 'Téléphone', notes: 'Notes',
      city: 'Ville', country: 'Pays', address: 'Adresse',
    },
    nav: {
      dashboard: 'Tableau de bord', reservations: 'Réservations', suppliers: 'Fournisseurs',
      crm: 'CRM', invoices: 'Factures', services: 'Services', revenue: 'Revenus',
      newProposal: 'Nouvelle Proposition', newReservation: 'Nouvelle Réservation', categories: 'Catégories',
      bookings: 'Réservations', templates: 'Modèles', users: 'Utilisateurs', settings: 'Paramètres',
      importHub: "Centre d'importation", supplierPortal: 'Portail Fournisseur',
    },
    dashboard: { title: 'Tableau de bord', subtitle: 'Bienvenue ! Voici ce qui se passe.' },
    reservations: {
      title: 'Réservations', subtitle: 'Gérez vos réservations de voyage',
      newReservation: 'Nouvelle Réservation', searchPlaceholder: 'Rechercher des réservations...',
      noReservations: 'Aucune réservation trouvée', createFirst: 'Créez votre première réservation',
      loadingReservations: 'Chargement des réservations...', past: 'Passées',
    },
    suppliers: {
      title: 'Fournisseurs', subtitle: 'Gérez votre réseau de fournisseurs',
      newSupplier: 'Nouveau Fournisseur', searchPlaceholder: 'Rechercher des fournisseurs...',
      noSuppliers: 'Aucun fournisseur trouvé',
    },
    crm: { title: 'CRM', subtitle: 'Gérez vos clients', newClient: 'Nouveau Client', searchPlaceholder: 'Rechercher des clients...' },
    invoices: {
      title: 'Factures', subtitle: 'Gérez vos factures',
      newInvoice: 'Nouvelle Facture', searchPlaceholder: 'Rechercher des factures...',
      status: { draft: 'Brouillon', sent: 'Envoyée', paid: 'Payée', overdue: 'En retard', cancelled: 'Annulée' },
    },
    proposals: { title: 'Propositions', subtitle: 'Gérez vos propositions', newProposal: 'Nouvelle Proposition' },
    settings: {
      title: 'Paramètres', subtitle: "Configurez votre application",
      branding: 'Marque', appName: "Nom de l'application", logo: 'Logo',
      language: 'Langue', defaultLanguage: 'Langue par défaut', yourLanguage: 'Votre langue',
      referenceFormat: 'Format du numéro de référence', prefix: 'Préfixe',
      includeDepartment: 'Département', includeCategory: 'Catégorie', includeYear: 'Année',
      sampleReference: 'Référence exemple', invoiceHeader: 'En-tête de facture',
      invoiceHeaderHint: 'Ces informations apparaissent sur toutes les factures',
      companyName: "Nom de l'entreprise", taxId: 'N° fiscal / TVA',
      addressLine1: 'Adresse ligne 1', addressLine2: 'Adresse ligne 2',
      postalCode: 'Code postal', country: 'Pays', city: 'Ville',
      invoiceLogo: 'Logo facture', bankDetails: 'Coordonnées bancaires',
      bankDetailsPlaceholder: 'Banque, IBAN, SWIFT, etc.',
      defaultInvoiceSettings: 'Paramètres de facture par défaut',
      defaultPaymentTerms: 'Conditions de paiement par défaut', defaultNotes: 'Notes par défaut',
      defaultNotesPlaceholder: 'Notes apparaissant sur toutes les factures par défaut...',
      departments: 'Départements', newDepartment: 'Nom du nouveau département',
      saveSettings: 'Enregistrer les paramètres', accessDenied: "Vous n'avez pas la permission d'accéder aux paramètres.",
    },
    supplierPortal: {
      title: 'Portail Fournisseur', welcome: 'Bienvenue, {name}',
      notLinked: "Votre compte n'est pas lié à un fournisseur. Contactez un administrateur.",
      manageServices: 'Gérez vos services, réservations et factures',
      pendingBookings: 'Réservations en attente', confirmed: 'Confirmées',
      totalBookings: 'Total réservations', avgRating: 'Note moyenne',
      bookings: 'Réservations', bookingRequests: 'Demandes de réservation',
      quoteRequests: 'Demandes de devis', myServices: 'Mes services',
      services: 'Services', invoices: 'Factures', myInvoices: 'Mes factures',
      ratings: 'Évaluations', reviews: 'Avis', analytics: 'Analyses',
    },
  },

  tr: {
    common: {
      all: 'Tümü', pending: 'Beklemede', sent: 'Gönderildi', confirmed: 'Onaylandı',
      rejected: 'Reddedildi', cancelled: 'İptal', active: 'Aktif', inactive: 'Pasif',
      save: 'Kaydet', cancel: 'İptal', delete: 'Sil', edit: 'Düzenle', close: 'Kapat',
      loading: 'Yükleniyor...', error: 'Hata', success: 'Başarılı', back: 'Geri',
      accessDenied: 'Erişim Reddedildi', search: 'Ara', status: 'Durum', actions: 'İşlemler',
      yes: 'Evet', no: 'Hayır', name: 'Ad', email: 'E-posta', phone: 'Telefon', notes: 'Notlar',
      city: 'Şehir', country: 'Ülke', address: 'Adres',
    },
    nav: {
      dashboard: 'Panel', reservations: 'Rezervasyonlar', suppliers: 'Tedarikçiler',
      crm: 'CRM', invoices: 'Faturalar', services: 'Hizmetler', revenue: 'Gelir',
      newProposal: 'Yeni Teklif', newReservation: 'Yeni Rezervasyon', categories: 'Kategoriler',
      bookings: 'Rezervasyonlar', templates: 'Şablonlar', users: 'Kullanıcılar', settings: 'Ayarlar',
      importHub: 'İçe Aktarma', supplierPortal: 'Tedarikçi Portalı',
    },
    dashboard: { title: 'Panel', subtitle: 'Hoş geldiniz! İşte neler oluyor.' },
    reservations: {
      title: 'Rezervasyonlar', subtitle: 'Seyahat rezervasyonlarınızı yönetin',
      newReservation: 'Yeni Rezervasyon', searchPlaceholder: 'Rezervasyon ara...',
      noReservations: 'Rezervasyon bulunamadı', createFirst: 'İlk rezervasyonunuzu oluşturun',
      loadingReservations: 'Rezervasyonlar yükleniyor...', past: 'Geçmiş',
    },
    suppliers: {
      title: 'Tedarikçiler', subtitle: 'Tedarikçi ağınızı yönetin',
      newSupplier: 'Yeni Tedarikçi', searchPlaceholder: 'Tedarikçi ara...',
      noSuppliers: 'Tedarikçi bulunamadı',
    },
    crm: { title: 'CRM', subtitle: 'Müşterilerinizi yönetin', newClient: 'Yeni Müşteri', searchPlaceholder: 'Müşteri ara...' },
    invoices: {
      title: 'Faturalar', subtitle: 'Faturalarınızı yönetin',
      newInvoice: 'Yeni Fatura', searchPlaceholder: 'Fatura ara...',
      status: { draft: 'Taslak', sent: 'Gönderildi', paid: 'Ödendi', overdue: 'Gecikmiş', cancelled: 'İptal' },
    },
    proposals: { title: 'Teklifler', subtitle: 'Tekliflerinizi yönetin', newProposal: 'Yeni Teklif' },
    settings: {
      title: 'Uygulama Ayarları', subtitle: 'Uygulama ayarlarınızı yapılandırın',
      branding: 'Marka', appName: 'Uygulama Adı', logo: 'Logo',
      language: 'Dil', defaultLanguage: 'Varsayılan Dil', yourLanguage: 'Diliniz',
      referenceFormat: 'Referans Numarası Formatı', prefix: 'Önek',
      includeDepartment: 'Departman', includeCategory: 'Kategori', includeYear: 'Yıl',
      sampleReference: 'Örnek Referans', invoiceHeader: 'Fatura Başlığı',
      invoiceHeaderHint: 'Bu bilgiler tüm faturalarda görünür',
      companyName: 'Şirket Adı', taxId: 'Vergi No / KDV',
      addressLine1: 'Adres Satırı 1', addressLine2: 'Adres Satırı 2',
      postalCode: 'Posta Kodu', country: 'Ülke', city: 'Şehir',
      invoiceLogo: 'Fatura Logosu', bankDetails: 'Banka Bilgileri',
      bankDetailsPlaceholder: 'Banka adı, IBAN, SWIFT, vb.',
      defaultInvoiceSettings: 'Varsayılan Fatura Ayarları',
      defaultPaymentTerms: 'Varsayılan Ödeme Koşulları', defaultNotes: 'Varsayılan Notlar',
      defaultNotesPlaceholder: 'Varsayılan olarak tüm faturalarda görünecek notlar...',
      departments: 'Departmanlar', newDepartment: 'Yeni departman adı',
      saveSettings: 'Ayarları Kaydet', accessDenied: 'Uygulama ayarlarına erişim izniniz yok.',
    },
    supplierPortal: {
      title: 'Tedarikçi Portalı', welcome: 'Hoş geldiniz, {name}',
      notLinked: 'Hesabınız bir tedarikçiye bağlı değil. Lütfen yönetici ile iletişime geçin.',
      manageServices: 'Hizmetlerinizi, rezervasyonlarınızı ve faturalarınızı yönetin',
      pendingBookings: 'Bekleyen Rezervasyonlar', confirmed: 'Onaylanan',
      totalBookings: 'Toplam Rezervasyon', avgRating: 'Ort. Puan',
      bookings: 'Rezervasyonlar', bookingRequests: 'Rezervasyon Talepleri',
      quoteRequests: 'Teklif Talepleri', myServices: 'Hizmetlerim',
      services: 'Hizmetler', invoices: 'Faturalar', myInvoices: 'Faturalarım',
      ratings: 'Değerlendirmeler', reviews: 'Yorumlar', analytics: 'Analizler',
    },
  },

  de: {
    common: {
      all: 'Alle', pending: 'Ausstehend', sent: 'Gesendet', confirmed: 'Bestätigt',
      rejected: 'Abgelehnt', cancelled: 'Storniert', active: 'Aktiv', inactive: 'Inaktiv',
      save: 'Speichern', cancel: 'Abbrechen', delete: 'Löschen', edit: 'Bearbeiten', close: 'Schließen',
      loading: 'Lädt...', error: 'Fehler', success: 'Erfolg', back: 'Zurück',
      accessDenied: 'Zugang verweigert', search: 'Suchen', status: 'Status', actions: 'Aktionen',
      yes: 'Ja', no: 'Nein', name: 'Name', email: 'E-Mail', phone: 'Telefon', notes: 'Notizen',
      city: 'Stadt', country: 'Land', address: 'Adresse',
    },
    nav: {
      dashboard: 'Dashboard', reservations: 'Reservierungen', suppliers: 'Lieferanten',
      crm: 'CRM', invoices: 'Rechnungen', services: 'Dienstleistungen', revenue: 'Einnahmen',
      newProposal: 'Neues Angebot', newReservation: 'Neue Reservierung', categories: 'Kategorien',
      bookings: 'Buchungen', templates: 'Vorlagen', users: 'Benutzer', settings: 'Einstellungen',
      importHub: 'Import-Hub', supplierPortal: 'Lieferantenportal',
    },
    dashboard: { title: 'Dashboard', subtitle: 'Willkommen! Hier ist, was passiert.' },
    reservations: {
      title: 'Reservierungen', subtitle: 'Verwalten Sie Ihre Reisereservierungen',
      newReservation: 'Neue Reservierung', searchPlaceholder: 'Reservierungen suchen...',
      noReservations: 'Keine Reservierungen gefunden', createFirst: 'Erstellen Sie Ihre erste Reservierung',
      loadingReservations: 'Reservierungen werden geladen...', past: 'Vergangene',
    },
    suppliers: {
      title: 'Lieferanten', subtitle: 'Verwalten Sie Ihr Lieferantennetzwerk',
      newSupplier: 'Neuer Lieferant', searchPlaceholder: 'Lieferanten suchen...',
      noSuppliers: 'Keine Lieferanten gefunden',
    },
    crm: { title: 'CRM', subtitle: 'Verwalten Sie Ihre Kunden', newClient: 'Neuer Kunde', searchPlaceholder: 'Kunden suchen...' },
    invoices: {
      title: 'Rechnungen', subtitle: 'Verwalten Sie Ihre Rechnungen',
      newInvoice: 'Neue Rechnung', searchPlaceholder: 'Rechnungen suchen...',
      status: { draft: 'Entwurf', sent: 'Gesendet', paid: 'Bezahlt', overdue: 'Überfällig', cancelled: 'Storniert' },
    },
    proposals: { title: 'Angebote', subtitle: 'Verwalten Sie Ihre Angebote', newProposal: 'Neues Angebot' },
    settings: {
      title: 'App-Einstellungen', subtitle: 'Konfigurieren Sie Ihre Anwendung',
      branding: 'Branding', appName: 'App-Name', logo: 'Logo',
      language: 'Sprache', defaultLanguage: 'Standardsprache', yourLanguage: 'Ihre Sprache',
      referenceFormat: 'Referenznummernformat', prefix: 'Präfix',
      includeDepartment: 'Abteilung', includeCategory: 'Kategorie', includeYear: 'Jahr',
      sampleReference: 'Beispielreferenz', invoiceHeader: 'Rechnungskopf',
      invoiceHeaderHint: 'Diese Informationen erscheinen auf allen Rechnungen',
      companyName: 'Firmenname', taxId: 'Steuer-ID / MwSt.',
      addressLine1: 'Adresszeile 1', addressLine2: 'Adresszeile 2',
      postalCode: 'Postleitzahl', country: 'Land', city: 'Stadt',
      invoiceLogo: 'Rechnungslogo', bankDetails: 'Bankverbindung',
      bankDetailsPlaceholder: 'Bankname, IBAN, SWIFT, usw.',
      defaultInvoiceSettings: 'Standard-Rechnungseinstellungen',
      defaultPaymentTerms: 'Standard-Zahlungsbedingungen', defaultNotes: 'Standardnotizen',
      defaultNotesPlaceholder: 'Notizen, die standardmäßig auf allen Rechnungen erscheinen...',
      departments: 'Abteilungen', newDepartment: 'Neuer Abteilungsname',
      saveSettings: 'Einstellungen speichern', accessDenied: 'Sie haben keine Berechtigung auf die Einstellungen zuzugreifen.',
    },
    supplierPortal: {
      title: 'Lieferantenportal', welcome: 'Willkommen, {name}',
      notLinked: 'Ihr Konto ist mit keinem Lieferanten verknüpft. Bitte wenden Sie sich an einen Administrator.',
      manageServices: 'Verwalten Sie Ihre Dienstleistungen, Buchungen und Rechnungen',
      pendingBookings: 'Ausstehende Buchungen', confirmed: 'Bestätigt',
      totalBookings: 'Buchungen gesamt', avgRating: 'Ø Bewertung',
      bookings: 'Buchungen', bookingRequests: 'Buchungsanfragen',
      quoteRequests: 'Angebotsanfragen', myServices: 'Meine Dienstleistungen',
      services: 'Dienstleistungen', invoices: 'Rechnungen', myInvoices: 'Meine Rechnungen',
      ratings: 'Bewertungen', reviews: 'Rezensionen', analytics: 'Analysen',
    },
  },

  it: {
    common: {
      all: 'Tutti', pending: 'In sospeso', sent: 'Inviato', confirmed: 'Confermato',
      rejected: 'Rifiutato', cancelled: 'Cancellato', active: 'Attivo', inactive: 'Inattivo',
      save: 'Salva', cancel: 'Annulla', delete: 'Elimina', edit: 'Modifica', close: 'Chiudi',
      loading: 'Caricamento...', error: 'Errore', success: 'Successo', back: 'Indietro',
      accessDenied: 'Accesso negato', search: 'Cerca', status: 'Stato', actions: 'Azioni',
      yes: 'Sì', no: 'No', name: 'Nome', email: 'Email', phone: 'Telefono', notes: 'Note',
      city: 'Città', country: 'Paese', address: 'Indirizzo',
    },
    nav: {
      dashboard: 'Dashboard', reservations: 'Prenotazioni', suppliers: 'Fornitori',
      crm: 'CRM', invoices: 'Fatture', services: 'Servizi', revenue: 'Entrate',
      newProposal: 'Nuova Proposta', newReservation: 'Nuova Prenotazione', categories: 'Categorie',
      bookings: 'Prenotazioni', templates: 'Modelli', users: 'Utenti', settings: 'Impostazioni',
      importHub: 'Hub Importazione', supplierPortal: 'Portale Fornitori',
    },
    dashboard: { title: 'Dashboard', subtitle: 'Benvenuto! Ecco cosa sta succedendo.' },
    reservations: {
      title: 'Prenotazioni', subtitle: 'Gestisci le tue prenotazioni di viaggio',
      newReservation: 'Nuova Prenotazione', searchPlaceholder: 'Cerca prenotazioni...',
      noReservations: 'Nessuna prenotazione trovata', createFirst: 'Crea la tua prima prenotazione',
      loadingReservations: 'Caricamento prenotazioni...', past: 'Passate',
    },
    suppliers: {
      title: 'Fornitori', subtitle: 'Gestisci la tua rete di fornitori',
      newSupplier: 'Nuovo Fornitore', searchPlaceholder: 'Cerca fornitori...',
      noSuppliers: 'Nessun fornitore trovato',
    },
    crm: { title: 'CRM', subtitle: 'Gestisci i tuoi clienti', newClient: 'Nuovo Cliente', searchPlaceholder: 'Cerca clienti...' },
    invoices: {
      title: 'Fatture', subtitle: 'Gestisci le tue fatture',
      newInvoice: 'Nuova Fattura', searchPlaceholder: 'Cerca fatture...',
      status: { draft: 'Bozza', sent: 'Inviata', paid: 'Pagata', overdue: 'Scaduta', cancelled: 'Cancellata' },
    },
    proposals: { title: 'Proposte', subtitle: 'Gestisci le tue proposte', newProposal: 'Nuova Proposta' },
    settings: {
      title: 'Impostazioni', subtitle: 'Configura la tua applicazione',
      branding: 'Branding', appName: 'Nome App', logo: 'Logo',
      language: 'Lingua', defaultLanguage: 'Lingua predefinita', yourLanguage: 'La tua lingua',
      referenceFormat: 'Formato numero di riferimento', prefix: 'Prefisso',
      includeDepartment: 'Dipartimento', includeCategory: 'Categoria', includeYear: 'Anno',
      sampleReference: 'Riferimento di esempio', invoiceHeader: 'Intestazione fattura',
      invoiceHeaderHint: 'Queste informazioni compaiono su tutte le fatture',
      companyName: 'Nome azienda', taxId: 'Codice fiscale / IVA',
      addressLine1: 'Indirizzo riga 1', addressLine2: 'Indirizzo riga 2',
      postalCode: 'Codice postale', country: 'Paese', city: 'Città',
      invoiceLogo: 'Logo fattura', bankDetails: 'Coordinate bancarie',
      bankDetailsPlaceholder: 'Banca, IBAN, SWIFT, ecc.',
      defaultInvoiceSettings: 'Impostazioni fattura predefinite',
      defaultPaymentTerms: 'Termini di pagamento predefiniti', defaultNotes: 'Note predefinite',
      defaultNotesPlaceholder: 'Note che appariranno di default su tutte le fatture...',
      departments: 'Dipartimenti', newDepartment: 'Nuovo nome dipartimento',
      saveSettings: 'Salva impostazioni', accessDenied: 'Non hai il permesso di accedere alle impostazioni.',
    },
    supplierPortal: {
      title: 'Portale Fornitori', welcome: 'Benvenuto, {name}',
      notLinked: "Il tuo account non è collegato a un fornitore. Contatta un amministratore.",
      manageServices: 'Gestisci i tuoi servizi, prenotazioni e fatture',
      pendingBookings: 'Prenotazioni in sospeso', confirmed: 'Confermato',
      totalBookings: 'Prenotazioni totali', avgRating: 'Valutazione media',
      bookings: 'Prenotazioni', bookingRequests: 'Richieste di prenotazione',
      quoteRequests: 'Richieste di preventivo', myServices: 'I miei servizi',
      services: 'Servizi', invoices: 'Fatture', myInvoices: 'Le mie fatture',
      ratings: 'Valutazioni', reviews: 'Recensioni', analytics: 'Analitiche',
    },
  },
};

const I18nContext = createContext({ t: (key, params) => key, language: 'en', setLanguage: (lang) => {} });

function getNestedValue(obj, keyPath) {
  return keyPath.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : null), obj);
}

export function I18nProvider({ children }) {
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    db.auth.me()
      .then(user => { if (user?.language) setLanguage(user.language); })
      .catch(() => {});
  }, []);

  const t = (key, params) => {
    const dict = translations[language] || translations['en'];
    let value = getNestedValue(dict, key);
    if (value === null) {
      value = getNestedValue(translations['en'], key) ?? key;
    }
    if (params && typeof value === 'string') {
      Object.entries(params).forEach(([k, v]) => {
        value = value.replace(`{${k}}`, v);
      });
    }
    return value || key;
  };

  return (
    <I18nContext.Provider value={{ t, language, setLanguage: (lang) => setLanguage(lang) }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  return useContext(I18nContext);
}