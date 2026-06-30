import TripDetails from './pages/TripDetails';
import Categories from './pages/Categories';
import Suppliers from './pages/Suppliers';
import SupplierDetails from './pages/SupplierDetails';
import Proposals from './pages/Proposals';
import CreateProposal from './pages/CreateProposal';
import ProposalDetails from './pages/ProposalDetails';
import CreateReservation from './pages/CreateReservation';
import ReservationDetails from './pages/ReservationDetails';
import { lazy } from 'react';
const Revenue = lazy(() => import('./pages/Revenue'));
import AuditLogViewer from './pages/AuditLogViewer';
import FAQ from './pages/FAQ';
import Clients from './pages/Clients';
import CreateClient from './pages/CreateClient';
import ClientDetails from './pages/ClientDetails';
import ClientPortal from './pages/ClientPortal';
import ClientProposals from './pages/ClientProposals';
import ClientProposalDetails from './pages/ClientProposalDetails';
import ClientTrips from './pages/ClientTrips';
import ClientTripDetails from './pages/ClientTripDetails';
import CreateInvoice from './pages/CreateInvoice';
import InvoiceDetails from './pages/InvoiceDetails';
import Dashboard from './pages/Dashboard';
import ClientInvoices from './pages/ClientInvoices';
import ClientInvoiceDetails from './pages/ClientInvoiceDetails';
import ServiceLibrary from './pages/ServiceLibrary';
import SupplierPortal from './pages/SupplierPortal';
import SupplierBookingDetails from './pages/SupplierBookingDetails';
import AppSettings from './pages/AppSettings';
import Profile from './pages/Profile';
import BookingTemplates from './pages/BookingTemplates';
import Reservations from './pages/Reservations';
import ProposalBuilder from './pages/ProposalBuilder';
const ClientCRM = lazy(() => import('./pages/ClientCRM'));
import TestingArea from './pages/TestingArea';
import TaskBoard from './pages/TaskBoard';
import RFPManager from './pages/RFPManager';
import CommissionReport from './pages/CommissionReport';
import SuggestionsManager from './pages/SuggestionsManager';
import UserManagement from './pages/UserManagement';
import __Layout from './Layout.jsx';

export const PAGES = {
    "TripDetails": TripDetails,
    "Categories": Categories,
    "Suppliers": Suppliers,
    "SupplierDetails": SupplierDetails,
    "Proposals": Proposals,
    "CreateProposal": CreateProposal,
    "ProposalDetails": ProposalDetails,
    "Clients": Clients,
    "CreateClient": CreateClient,
    "ClientDetails": ClientDetails,
    "ClientPortal": ClientPortal,
    "ClientProposals": ClientProposals,
    "ClientProposalDetails": ClientProposalDetails,
    "ClientTrips": ClientTrips,
    "ClientTripDetails": ClientTripDetails,
    "CreateInvoice": CreateInvoice,
    "InvoiceDetails": InvoiceDetails,
    "Dashboard": Dashboard,
    "ClientInvoices": ClientInvoices,
    "ClientInvoiceDetails": ClientInvoiceDetails,
    "ServiceLibrary": ServiceLibrary,
    "SupplierPortal": SupplierPortal,
    "SupplierBookingDetails": SupplierBookingDetails,
    "AppSettings": AppSettings,
    "Profile": Profile,
    "BookingTemplates": BookingTemplates,
    "Reservations": Reservations,
    "ProposalBuilder": ProposalBuilder,
    "ClientCRM": ClientCRM,
    "CreateReservation": CreateReservation,
    "ReservationDetails": ReservationDetails,
    "Revenue": Revenue,
    "AuditLogViewer": AuditLogViewer,
    "FAQ": FAQ,
    "TestingArea": TestingArea,
    "TaskBoard": TaskBoard,
    "RFPManager": RFPManager,
    "CommissionReport": CommissionReport,
    "SuggestionsManager": SuggestionsManager,
    "UserManagement": UserManagement,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};