import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  Edit2,
  Copy,
  Trash2,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  FileSpreadsheet,
  AlertCircle,
  ChevronDown,
  User,
  Receipt as ReceiptIcon,
} from 'lucide-react';
import AdminScreenLayout from '../layout/AdminScreenLayout';
import AdminCard from '../components/AdminCard';
import ConfirmDialog from '../components/ConfirmDialog';
import DocumentPreviewModal from '../components/documents/DocumentPreviewModal';
import CustomizableInvoiceModal from '../components/documents/CustomizableInvoiceModal';
import {
  ProFormaInvoice,
  InvoiceStatus,
  Customer,
  getStoredInvoices,
  saveInvoice,
  deleteInvoice,
  duplicateInvoice,
  updateInvoiceStatus,
  getStoredCustomers,
  saveCustomer,
  getStoredSettings,
  exportInvoicesToCsv,
} from '@/lib/documentStorage';
import { useAdminToast } from '../context/AdminToastContext';

const STATUS_TABS: ('All' | InvoiceStatus)[] = ['All', 'Draft', 'Issued', 'Accepted', 'Cancelled'];


export default function AdminInvoices() {
  const toast = useAdminToast();
  const settings = getStoredSettings();

  const [invoices, setInvoices] = useState<ProFormaInvoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Search & Filter
  const [selectedStatus, setSelectedStatus] = useState<'All' | InvoiceStatus>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [previewItem, setPreviewItem] = useState<ProFormaInvoice | null>(null);
  const [deletePendingItem, setDeletePendingItem] = useState<ProFormaInvoice | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);



  const loadData = () => {
    setInvoices(getStoredInvoices());
    setCustomers(getStoredCustomers());
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesStatus = selectedStatus === 'All' || inv.status === selectedStatus;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        inv.docNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        (inv.customerCompany && inv.customerCompany.toLowerCase().includes(q)) ||
        inv.customerPhone.includes(q) ||
        inv.items.some((it) => it.description.toLowerCase().includes(q));

      return matchesStatus && matchesSearch;
    });
  }, [invoices, selectedStatus, searchQuery]);

  // Open Form for Create
  const handleOpenCreate = () => {
    setEditingInvoiceId(null);
    setIsEditorOpen(true);
  };

  // Open Form for Edit
  const handleOpenEdit = (inv: ProFormaInvoice) => {
    setEditingInvoiceId(inv.id);
    setIsEditorOpen(true);
  };

  // Save Customized Invoice
  const handleSaveCustomizedInvoice = (invoiceToSave: ProFormaInvoice, saveAsCustomer?: boolean) => {
    if (saveAsCustomer && invoiceToSave.customerName && !invoiceToSave.customerId) {
      const newCust = saveCustomer({
        name: invoiceToSave.customerName.trim(),
        company: invoiceToSave.customerCompany?.trim() || undefined,
        phone: invoiceToSave.customerPhone.trim(),
        email: invoiceToSave.customerEmail?.trim() || undefined,
        address: invoiceToSave.customerAddress?.trim() || undefined,
      });
      invoiceToSave.customerId = newCust.id;
    }

    saveInvoice(invoiceToSave);
    toast.success(
      editingInvoiceId
        ? `Updated invoice ${invoiceToSave.docNumber}.`
        : `Created Pro Forma Invoice ${invoiceToSave.docNumber}.`
    );
    setIsEditorOpen(false);
    setEditingInvoiceId(null);
    loadData();
  };

  // Duplicate Invoice
  const handleDuplicate = (id: string) => {
    const dup = duplicateInvoice(id);
    if (dup) {
      toast.success(`Duplicated invoice as ${dup.docNumber} in Draft status.`);
      loadData();
    }
  };

  // Delete Invoice
  const handleConfirmDelete = () => {
    if (!deletePendingItem) return;
    const res = deleteInvoice(deletePendingItem.id);
    if (res.success) {
      toast.success(`Deleted invoice ${deletePendingItem.docNumber}.`);
      setDeletePendingItem(null);
      loadData();
    } else {
      toast.error(res.message || 'Failed to delete invoice.');
    }
  };

  // Quick Status Change
  const handleStatusChange = (id: string, newStatus: InvoiceStatus) => {
    updateInvoiceStatus(id, newStatus);
    toast.info(`Invoice status updated to ${newStatus}.`);
    loadData();
  };

  return (
    <AdminScreenLayout
      title="Pro Forma Invoices"
      subtitle="Issue formal quotes, estimate heavy haulage & towing fees, track payment statuses, and print standard A4 billing documents."
      previewTitle="Financial Snapshot"
      preview={
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
              Invoice Analytics
            </span>
            <span className="text-[11px] font-semibold text-[#015557] bg-emerald-50 px-2 py-0.5 rounded">
              {invoices.length} Documents
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-slate-500 block text-[11px]">Total Invoiced</span>
              <span className="text-base font-extrabold text-slate-900 font-mono">
                GH₵{' '}
                {invoices
                  .reduce((sum, i) => sum + (i.status !== 'Cancelled' ? i.grandTotal : 0), 0)
                  .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-slate-500 block text-[11px]">Outstanding Due</span>
              <span className="text-base font-extrabold text-[#d80000] font-mono">
                GH₵{' '}
                {invoices
                  .reduce((sum, i) => sum + (i.status !== 'Cancelled' ? i.balanceDue : 0), 0)
                  .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Status Breakdown Pills */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <span className="font-semibold text-slate-700 block">Status Breakdown:</span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                <span className="text-emerald-700 font-medium">Accepted</span>
                <span className="font-mono font-bold">
                  {invoices.filter((i) => i.status === 'Accepted').length}
                </span>
              </div>
              <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                <span className="text-blue-700 font-medium">Issued</span>
                <span className="font-mono font-bold">
                  {invoices.filter((i) => i.status === 'Issued').length}
                </span>
              </div>
              <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                <span className="text-amber-700 font-medium">Draft</span>
                <span className="font-mono font-bold">
                  {invoices.filter((i) => i.status === 'Draft').length}
                </span>
              </div>
              <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                <span className="text-red-700 font-medium">Cancelled</span>
                <span className="font-mono font-bold">
                  {invoices.filter((i) => i.status === 'Cancelled').length}
                </span>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Top Control Bar: Search, Status Filters & Create Button */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by invoice number, customer name, phone, or service description..."
                className="w-full min-h-[44px] pl-10 pr-4 py-2 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#015557] focus-visible:bg-white"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportInvoicesToCsv}
                className="min-h-[44px] px-3.5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shrink-0"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={handleOpenCreate}
                className="min-h-[44px] px-4 py-2 bg-[#015557] hover:bg-[#014345] text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-xs transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Create Pro Forma Invoice</span>
              </button>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-t border-slate-100 pt-3 no-scrollbar">
            {STATUS_TABS.map((st) => {
              const count =
                st === 'All' ? invoices.length : invoices.filter((i) => i.status === st).length;
              const isActive = selectedStatus === st;

              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSelectedStatus(st)}
                  className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[#015557] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  <span>{st}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Invoices List / Table */}
        {filteredInvoices.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No pro forma invoices found</h3>
            <p className="text-xs text-slate-500 mt-1">
              Create a new invoice or adjust your search filter.
            </p>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-[#015557] hover:bg-[#014345] rounded-lg transition-colors"
            >
              Create New Invoice
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600">
                    <th className="py-3 px-4 font-semibold">Document #</th>
                    <th className="py-3 px-4 font-semibold">Date / Validity</th>
                    <th className="py-3 px-4 font-semibold">Customer</th>
                    <th className="py-3 px-4 font-semibold text-right">Grand Total</th>
                    <th className="py-3 px-4 font-semibold text-right">Balance Due</th>
                    <th className="py-3 px-4 font-semibold text-center">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {inv.docNumber}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono">
                        <div>{inv.issueDate}</div>
                        <div className="text-[10px] text-slate-400">Due: {inv.validUntil}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{inv.customerName}</div>
                        {inv.customerCompany && (
                          <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                            {inv.customerCompany}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400">{inv.customerPhone}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        GH₵ {inv.grandTotal.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono">
                        <span
                          className={`font-bold ${
                            inv.balanceDue > 0 ? 'text-[#d80000]' : 'text-emerald-700'
                          }`}
                        >
                          GH₵ {inv.balanceDue.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <select
                          value={inv.status}
                          onChange={(e) =>
                            handleStatusChange(inv.id, e.target.value as InvoiceStatus)
                          }
                          className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase border cursor-pointer focus:outline-none ${
                            inv.status === 'Accepted'
                              ? 'bg-emerald-50 text-[#015557] border-emerald-200'
                              : inv.status === 'Issued'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : inv.status === 'Draft'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-red-50 text-red-800 border-red-200'
                          }`}
                        >
                          <option value="Draft">Draft</option>
                          <option value="Issued">Issued</option>
                          <option value="Accepted">Accepted</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setPreviewItem(inv)}
                            className="p-1.5 text-slate-500 hover:text-[#015557] hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Preview / Print A4"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(inv)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit Invoice"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicate(inv.id)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Duplicate"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletePendingItem(inv)}
                            className="p-1.5 text-slate-400 hover:text-[#d80000] hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* CUSTOMIZABLE INVOICE CREATION / EDITING MODAL WITH LIVE PREVIEW */}
      {isEditorOpen && (
        <CustomizableInvoiceModal
          isOpen={isEditorOpen}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingInvoiceId(null);
          }}
          invoiceToEdit={editingInvoiceId ? invoices.find((i) => i.id === editingInvoiceId) : null}
          customers={customers}
          settings={settings}
          onSave={handleSaveCustomizedInvoice}
        />
      )}

      {/* DOCUMENT PREVIEW MODAL */}
      {previewItem && (
        <DocumentPreviewModal
          document={previewItem}
          type="invoice"
          isOpen={!!previewItem}
          onClose={() => setPreviewItem(null)}
        />
      )}

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={!!deletePendingItem}
        title={`Delete Invoice ${deletePendingItem?.docNumber}?`}
        description={`Are you sure you want to delete invoice ${deletePendingItem?.docNumber} for ${deletePendingItem?.customerName}? This will permanently remove this record.`}
        confirmLabel="Delete Invoice"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletePendingItem(null)}
      />
    </AdminScreenLayout>
  );
}
