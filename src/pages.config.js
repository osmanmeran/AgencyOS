import { lazy } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const TripDetails = lazy(() => import('./pages/TripDetails'));
const Categories = lazy(() => import('./pages/Categories'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const SupplierDetails = lazy(() => import('./pages/SupplierDetails'));
const Proposals = lazy(() => import('./pages/Proposals'));
const CreateProposal = lazy(() => import('./pages/CreateProposal'));
const ProposalDetails = lazy(() => import('./pages/ProposalDetails'));
const CreateReservation = lazy(() => import('./pages/CreateReservation'));
const ReservationDetails = lazy(() => import('./pages/ReservationDetails'));
const Revenue = lazy(() => import('./pages/Revenue'));
const AuditLogViewer = lazy(() => import('./pages/AuditLogViewer'));
const FAQ = lazy(() => import('./pages/FAQ'));
const CreateClient = lazy(() => import('./pages/CreateClient'));
const ClientDetails = lazy(() => import('./pages/ClientDetails'));
const ClientPortal = lazy(() => import('./pages/ClientPortal'));
const ClientHotelSearch = lazy(() => import('./pages/ClientHotelSearch'));
const ClientCarRentalSearch = lazy(() => import('./pages/ClientCarRentalSearch'));
const ClientProposals = lazy(() => import('./pages/ClientProposals'));
const ClientProposalDetails = lazy(() => import('./pages/ClientProposalDetails'));
const ClientTrips = lazy(() => import('./pages/ClientTrips'));
const ClientTripDetails = lazy(() => import('./pages/ClientTripDetails'));
const ClientQuoteBuilder = lazy(() => import('./pages/ClientQuoteBuilder'));
const ClientQuotes = lazy(() => import('./pages/ClientQuotes'));
const ClientQuoteDetails = lazy(() => import('./pages/ClientQuoteDetails'));
const QuoteRequests = lazy(() => import('./pages/QuoteRequests'));
const CreateInvoice = lazy(() => import('./pages/CreateInvoice'));
const InvoiceDetails = lazy(() => import('./pages/InvoiceDetails'));
const ClientInvoices = lazy(() => import('./pages/ClientInvoices'));
const ClientInvoiceDetails = lazy(() => import('./pages/ClientInvoiceDetails'));
const ServiceLibrary = lazy(() => import('./pages/ServiceLibrary'));
const SupplierPortal = lazy(() => import('./pages/SupplierPortal'));
const SupplierBookingDetails = lazy(() => import('./pages/SupplierBookingDetails'));
const AppSettings = lazy(() => import('./pages/AppSettings'));
const Profile = lazy(() => import('./pages/Profile'));
const BookingTemplates = lazy(() => import('./pages/BookingTemplates'));
const Reservations = lazy(() => import('./pages/Reservations'));
const ProposalBuilder = lazy(() => import('./pages/ProposalBuilder'));
const ClientCRM = lazy(() => import('./pages/ClientCRM'));
const Companies = lazy(() => import('./pages/Companies'));
const CompanyDetails = lazy(() => import('./pages/CompanyDetails'));
const TestingArea = lazy(() => import('./pages/TestingArea'));
const TaskBoard = lazy(() => import('./pages/TaskBoard'));
const RFPManager = lazy(() => import('./pages/RFPManager'));
const CommissionReport = lazy(() => import('./pages/CommissionReport'));
const SuggestionsManager = lazy(() => import('./pages/SuggestionsManager'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const TourContracts = lazy(() => import('./pages/TourContracts'));
const TourContractForm = lazy(() => import('./pages/TourContractForm'));
const GenerateFromContract = lazy(() => import('./pages/GenerateFromContract'));
import __Layout from './Layout.jsx';

export const PAGES = {
  TripDetails: TripDetails,
  Categories: Categories,
  Suppliers: Suppliers,
  SupplierDetails: SupplierDetails,
  Proposals: Proposals,
  CreateProposal: CreateProposal,
  ProposalDetails: ProposalDetails,
  CreateClient: CreateClient,
  ClientDetails: ClientDetails,
  ClientPortal: ClientPortal,
  ClientHotelSearch: ClientHotelSearch,
  ClientCarRentalSearch: ClientCarRentalSearch,
  ClientProposals: ClientProposals,
  ClientProposalDetails: ClientProposalDetails,
  ClientTrips: ClientTrips,
  ClientTripDetails: ClientTripDetails,
  ClientQuoteBuilder: ClientQuoteBuilder,
  ClientQuotes: ClientQuotes,
  ClientQuoteDetails: ClientQuoteDetails,
  QuoteRequests: QuoteRequests,
  CreateInvoice: CreateInvoice,
  InvoiceDetails: InvoiceDetails,
  Dashboard: Dashboard,
  ClientInvoices: ClientInvoices,
  ClientInvoiceDetails: ClientInvoiceDetails,
  ServiceLibrary: ServiceLibrary,
  SupplierPortal: SupplierPortal,
  SupplierBookingDetails: SupplierBookingDetails,
  AppSettings: AppSettings,
  Profile: Profile,
  BookingTemplates: BookingTemplates,
  Reservations: Reservations,
  ProposalBuilder: ProposalBuilder,
  ClientCRM: ClientCRM,
  Companies: Companies,
  CompanyDetails: CompanyDetails,
  CreateReservation: CreateReservation,
  ReservationDetails: ReservationDetails,
  Revenue: Revenue,
  AuditLogViewer: AuditLogViewer,
  FAQ: FAQ,
  TestingArea: TestingArea,
  TaskBoard: TaskBoard,
  RFPManager: RFPManager,
  CommissionReport: CommissionReport,
  SuggestionsManager: SuggestionsManager,
  UserManagement: UserManagement,
  TourContracts: TourContracts,
  TourContractForm: TourContractForm,
  GenerateFromContract: GenerateFromContract,
};

export const pagesConfig = {
  mainPage: 'Dashboard',
  Pages: PAGES,
  Layout: __Layout,
};
