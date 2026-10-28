import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Edit2,
  Check,
  X,
  ArrowUp,
  ArrowDown,
  DollarSign,
  Percent,
  Truck,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Layers,
  Settings2,
  Maximize2,
  Minimize2,
  Printer,
  ChevronDown,
  ChevronUp,
  User,
  Building,
  Phone,
  Mail,
  MapPin,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  ProFormaInvoice,
  InvoiceItem,
  InvoiceStatus,
  Customer,
  DocumentSettings,
  CustomField,
  AdditionalCharge,
  CustomSection,
  calculateInvoiceTotals,
  generateDocNumber,
} from '@/lib/documentStorage';

export interface CustomizableInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceToEdit?: ProFormaInvoice | null;
  customers: Customer[];
  settings: DocumentSettings;
  onSave: (invoice: ProFormaInvoice, saveAsCustomer?: boolean) => void;
}

const SERVICE_PRESETS = [
  { desc: 'Flatbed Emergency Towing (Accra Metropolitan)', price: 750 },
  { desc: 'Heavy Duty 30-Ton Low-Bed Haulage (Tema to Spintex)', price: 4500 },
  { desc: 'Inter-City Highway Towing (Accra to Kumasi Suame)', price: 6800 },
  { desc: 'Accident Scene Hydraulic Recovery & Winching', price: 1500 },
  { desc: 'Roadside Battery Jumpstart & Rapid Mobile Diagnostics', price: 350 },
  { desc: 'Forklift & Construction Machinery Transport', price: 3200 },
  { desc: 'Commercial Fleet Maintenance Inspection (Per Vehicle)', price: 500 },
];

const DEFAULT_SECTION_ORDER = [
  'meta',
  'customer',
  'items',
  'calculations',
  'payment',
  'terms',
  'notes',
];

const DEFAULT_SECTION_TITLES: Record<string, string> = {
  meta: 'Document Schedule & Identification',
  customer: 'Customer Details & Billing Information',
  items: 'Itemized Towing & Automotive Services',
  calculations: 'Financial Calculations, Tax & Adjustments',
  payment: 'Payment Instructions & Remittance',
  terms: 'Service Terms & Agreement Conditions',
  notes: 'Client & Operational Remarks',
};

const DEFAULT_FIELD_LABELS: Record<string, string> = {
  docNumber: 'Document Number',
  docTitle: 'Document Title Banner',
  issueDate: 'Date of Issue',
  validUntil: 'Payment / Validity Due Date',
  status: 'Document Status',
  customerName: 'Customer Full Name',
  customerCompany: 'Company Name',
  customerPhone: 'Phone Number',
  customerEmail: 'Email Address',
  customerAddress: 'Physical Location / Address',
  taxRate: 'Tax Rate (%)',
  taxLabel: 'Tax Name / Label',
  discount: 'Discount',
  discountLabel: 'Discount Name / Label',
  shipping: 'Shipping / Transport Fee',
  shippingLabel: 'Shipping Name / Label',
  paymentInstructions: 'Payment Instructions & Bank/MoMo Accounts',
  termsAndConditions: 'Terms & Conditions',
  notes: 'Internal / Client Remarks',
};

export default function CustomizableInvoiceModal({
  isOpen,
  onClose,
  invoiceToEdit,
  customers,
  settings,
  onSave,
}: CustomizableInvoiceModalProps) {
  // Mobile/Tablet View mode
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [previewScale, setPreviewScale] = useState<'fit' | '100%'>('fit');

  // Active section currently editing title inline
  const [editingTitleKey, setEditingTitleKey] = useState<string | null>(null);
  const [tempTitleVal, setTempTitleVal] = useState<string>('');

  // Active field currently editing label inline
  const [editingLabelKey, setEditingLabelKey] = useState<string | null>(null);
  const [tempLabelVal, setTempLabelVal] = useState<string>('');

  // New Custom Field creator form state
  const [showAddCustomField, setShowAddCustomField] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldVal, setNewFieldVal] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'number' | 'date' | 'select' | 'textarea'>('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');

  // New Custom Section creator form state
  const [showAddCustomSection, setShowAddCustomSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newSectionContent, setNewSectionContent] = useState('');

  // Primary invoice form state
  const [formData, setFormData] = useState<{
    docTitle: string;
    docNumber: string;
    issueDate: string;
    validUntil: string;
    status: InvoiceStatus;
    customerId: string;
    customerName: string;
    customerCompany: string;
    customerPhone: string;
    customerEmail: string;
    customerAddress: string;
    saveAsNewCustomer: boolean;
    items: InvoiceItem[];
    // Taxes
    taxEnabled: boolean;
    taxLabel: string;
    taxRate: number;
    // Discounts
    discountEnabled: boolean;
    discountLabel: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    // Shipping / Haulage charges
    shippingEnabled: boolean;
    shippingLabel: string;
    shippingAmount: number;
    // Additional charges list
    additionalCharges: AdditionalCharge[];
    // Text blocks
    paymentInstructions: string;
    termsAndConditions: string;
    notes: string;
    // Custom Fields & Custom Sections
    customFields: CustomField[];
    customSections: CustomSection[];
    // Section & Field Customization
    sectionOrder: string[];
    sectionTitles: Record<string, string>;
    sectionVisibility: Record<string, boolean>;
    fieldLabels: Record<string, string>;
    fieldVisibility: Record<string, boolean>;
  }>({
    docTitle: 'PRO FORMA INVOICE',
    docNumber: '',
    issueDate: '',
    validUntil: '',
    status: 'Draft',
    customerId: '',
    customerName: '',
    customerCompany: '',
    customerPhone: '',
    customerEmail: '',
    customerAddress: '',
    saveAsNewCustomer: false,
    items: [],
    taxEnabled: true,
    taxLabel: 'Ghana VAT / Statutory Levies',
    taxRate: settings.defaultTaxRate || 15,
    discountEnabled: false,
    discountLabel: 'Special Discount',
    discountType: 'percentage',
    discountValue: 0,
    shippingEnabled: false,
    shippingLabel: 'Haulage / Transport Fee',
    shippingAmount: 0,
    additionalCharges: [],
    paymentInstructions: settings.defaultPaymentInstructions,
    termsAndConditions: settings.defaultTerms,
    notes: settings.defaultNotes,
    customFields: [],
    customSections: [],
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    sectionTitles: { ...DEFAULT_SECTION_TITLES },
    sectionVisibility: {
      meta: true,
      customer: true,
      items: true,
      calculations: true,
      payment: true,
      terms: true,
      notes: true,
    },
    fieldLabels: { ...DEFAULT_FIELD_LABELS },
    fieldVisibility: {
      docNumber: true,
      docTitle: true,
      issueDate: true,
      validUntil: true,
      status: true,
      customerName: true,
      customerCompany: true,
      customerPhone: true,
      customerEmail: true,
      customerAddress: true,
      paymentInstructions: true,
      termsAndConditions: true,
      notes: true,
    },
  });

  // Initialize form state
  useEffect(() => {
    if (!isOpen) return;

    if (invoiceToEdit) {
      // Populate from existing invoice
      const initialFieldVisibility = {
        docNumber: true,
        docTitle: true,
        issueDate: true,
        validUntil: true,
        status: true,
        customerName: true,
        customerCompany: !invoiceToEdit.hiddenFields?.includes('customerCompany'),
        customerPhone: true,
        customerEmail: !invoiceToEdit.hiddenFields?.includes('customerEmail'),
        customerAddress: !invoiceToEdit.hiddenFields?.includes('customerAddress'),
        paymentInstructions: !invoiceToEdit.hiddenFields?.includes('paymentInstructions'),
        termsAndConditions: !invoiceToEdit.hiddenFields?.includes('termsAndConditions'),
        notes: !invoiceToEdit.hiddenFields?.includes('notes'),
      };

      setFormData({
        docTitle: invoiceToEdit.docTitle || 'PRO FORMA INVOICE',
        docNumber: invoiceToEdit.docNumber,
        issueDate: invoiceToEdit.issueDate,
        validUntil: invoiceToEdit.validUntil,
        status: invoiceToEdit.status,
        customerId: invoiceToEdit.customerId || '',
        customerName: invoiceToEdit.customerName,
        customerCompany: invoiceToEdit.customerCompany || '',
        customerPhone: invoiceToEdit.customerPhone,
        customerEmail: invoiceToEdit.customerEmail || '',
        customerAddress: invoiceToEdit.customerAddress || '',
        saveAsNewCustomer: false,
        items: invoiceToEdit.items.map((it) => ({ ...it })),
        taxEnabled: invoiceToEdit.taxEnabled !== false,
        taxLabel: invoiceToEdit.taxLabel || 'Ghana VAT / Statutory Levies',
        taxRate: invoiceToEdit.taxRate,
        discountEnabled: invoiceToEdit.discountEnabled ?? invoiceToEdit.discountAmount > 0,
        discountLabel: invoiceToEdit.discountLabel || 'Special Discount',
        discountType: invoiceToEdit.discountType,
        discountValue: invoiceToEdit.discountValue,
        shippingEnabled: invoiceToEdit.shippingEnabled ?? (invoiceToEdit.shippingAmount ? invoiceToEdit.shippingAmount > 0 : false),
        shippingLabel: invoiceToEdit.shippingLabel || 'Haulage / Transport Fee',
        shippingAmount: invoiceToEdit.shippingAmount || 0,
        additionalCharges: invoiceToEdit.additionalCharges ? invoiceToEdit.additionalCharges.map((c) => ({ ...c })) : [],
        paymentInstructions: invoiceToEdit.paymentInstructions || settings.defaultPaymentInstructions,
        termsAndConditions: invoiceToEdit.termsAndConditions || settings.defaultTerms,
        notes: invoiceToEdit.notes || '',
        customFields: invoiceToEdit.customFields ? invoiceToEdit.customFields.map((f) => ({ ...f })) : [],
        customSections: invoiceToEdit.customSections ? invoiceToEdit.customSections.map((s) => ({ ...s })) : [],
        sectionOrder: invoiceToEdit.sectionOrder || [...DEFAULT_SECTION_ORDER],
        sectionTitles: { ...DEFAULT_SECTION_TITLES, ...invoiceToEdit.sectionTitles },
        sectionVisibility: {
          meta: true,
          customer: true,
          items: true,
          calculations: true,
          payment: !invoiceToEdit.hiddenFields?.includes('paymentSection'),
          terms: !invoiceToEdit.hiddenFields?.includes('termsSection'),
          notes: !invoiceToEdit.hiddenFields?.includes('notesSection'),
        },
        fieldLabels: { ...DEFAULT_FIELD_LABELS, ...invoiceToEdit.fieldLabels },
        fieldVisibility: initialFieldVisibility,
      });
    } else {
      // New Invoice Defaults
      const today = new Date().toISOString().split('T')[0];
      const validity = new Date(Date.now() + (settings.defaultValidityDays || 14) * 86400000)
        .toISOString()
        .split('T')[0];

      setFormData({
        docTitle: 'PRO FORMA INVOICE',
        docNumber: generateDocNumber('PFI'),
        issueDate: today,
        validUntil: validity,
        status: 'Draft',
        customerId: '',
        customerName: '',
        customerCompany: '',
        customerPhone: '',
        customerEmail: '',
        customerAddress: '',
        saveAsNewCustomer: false,
        items: [
          {
            id: `item-${Date.now()}`,
            description: 'Flatbed Emergency Towing (Accra Metropolitan)',
            quantity: 1,
            unitPrice: 750,
            total: 750,
          },
        ],
        taxEnabled: true,
        taxLabel: 'Ghana VAT / Statutory Levies',
        taxRate: settings.defaultTaxRate || 15,
        discountEnabled: false,
        discountLabel: 'Special Discount',
        discountType: 'percentage',
        discountValue: 0,
        shippingEnabled: false,
        shippingLabel: 'Haulage / Transport Fee',
        shippingAmount: 0,
        additionalCharges: [],
        paymentInstructions: settings.defaultPaymentInstructions,
        termsAndConditions: settings.defaultTerms,
        notes: settings.defaultNotes,
        customFields: [],
        customSections: [],
        sectionOrder: [...DEFAULT_SECTION_ORDER],
        sectionTitles: { ...DEFAULT_SECTION_TITLES },
        sectionVisibility: {
          meta: true,
          customer: true,
          items: true,
          calculations: true,
          payment: true,
          terms: true,
          notes: true,
        },
        fieldLabels: { ...DEFAULT_FIELD_LABELS },
        fieldVisibility: {
          docNumber: true,
          docTitle: true,
          issueDate: true,
          validUntil: true,
          status: true,
          customerName: true,
          customerCompany: true,
          customerPhone: true,
          customerEmail: true,
          customerAddress: true,
          paymentInstructions: true,
          termsAndConditions: true,
          notes: true,
        },
      });
    }
    setActiveTab('editor');
  }, [isOpen, invoiceToEdit, settings]);

  // Real-time computed totals
  const formTotals = useMemo(() => {
    return calculateInvoiceTotals(
      formData.items,
      formData.discountType,
      formData.discountValue,
      formData.taxRate,
      formData.taxEnabled,
      formData.discountEnabled,
      formData.shippingEnabled ? formData.shippingAmount : 0,
      formData.additionalCharges.filter((c) => c.enabled !== false)
    );
  }, [
    formData.items,
    formData.discountType,
    formData.discountValue,
    formData.taxRate,
    formData.taxEnabled,
    formData.discountEnabled,
    formData.shippingEnabled,
    formData.shippingAmount,
    formData.additionalCharges,
  ]);

  if (!isOpen) return null;

  // --- REORDERING & SECTION MANAGEMENT ---
  const handleMoveSection = (sectionKey: string, direction: 'up' | 'down') => {
    const order = [...formData.sectionOrder];
    const idx = order.indexOf(sectionKey);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= order.length) return;
    const [moved] = order.splice(idx, 1);
    order.splice(targetIdx, 0, moved);
    setFormData((prev) => ({ ...prev, sectionOrder: order }));
  };

  const handleToggleSectionVisibility = (sectionKey: string) => {
    setFormData((prev) => ({
      ...prev,
      sectionVisibility: {
        ...prev.sectionVisibility,
        [sectionKey]: !prev.sectionVisibility[sectionKey],
      },
    }));
  };

  const handleStartRenameTitle = (sectionKey: string, currentTitle: string) => {
    setEditingTitleKey(sectionKey);
    setTempTitleVal(currentTitle);
  };

  const handleSaveRenameTitle = (sectionKey: string) => {
    if (tempTitleVal.trim()) {
      setFormData((prev) => ({
        ...prev,
        sectionTitles: {
          ...prev.sectionTitles,
          [sectionKey]: tempTitleVal.trim(),
        },
      }));
    }
    setEditingTitleKey(null);
  };

  const handleToggleFieldVisibility = (fieldKey: string) => {
    setFormData((prev) => ({
      ...prev,
      fieldVisibility: {
        ...prev.fieldVisibility,
        [fieldKey]: !prev.fieldVisibility[fieldKey],
      },
    }));
  };

  const handleStartRenameLabel = (fieldKey: string, currentLabel: string) => {
    setEditingLabelKey(fieldKey);
    setTempLabelVal(currentLabel);
  };

  const handleSaveRenameLabel = (fieldKey: string) => {
    if (tempLabelVal.trim()) {
      setFormData((prev) => ({
        ...prev,
        fieldLabels: {
          ...prev.fieldLabels,
          [fieldKey]: tempLabelVal.trim(),
        },
      }));
    }
    setEditingLabelKey(null);
  };

  // --- ITEM MANAGEMENT ---
  const handleItemChange = (index: number, field: keyof InvoiceItem, val: any) => {
    setFormData((prev) => {
      const items = [...prev.items];
      const item = { ...items[index], [field]: val };
      if (field === 'quantity' || field === 'unitPrice') {
        item.total = Math.round((Number(item.quantity) * Number(item.unitPrice) || 0) * 100) / 100;
      }
      items[index] = item;
      return { ...prev, items };
    });
  };

  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          description: '',
          quantity: 1,
          unitPrice: 0,
          total: 0,
        },
      ],
    }));
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    const items = [...formData.items];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    const [moved] = items.splice(index, 1);
    items.splice(targetIdx, 0, moved);
    setFormData((prev) => ({ ...prev, items }));
  };

  const handleRemoveItem = (index: number) => {
    if (formData.items.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  // --- CUSTOM FIELDS ---
  const handleAddCustomField = () => {
    if (!newFieldLabel.trim()) return;
    const field: CustomField = {
      id: `cf-${Date.now()}`,
      label: newFieldLabel.trim(),
      value: newFieldVal,
      type: newFieldType,
      options: newFieldType === 'select' ? newFieldOptions.split(',').map((s) => s.trim()) : undefined,
      visible: true,
    };
    setFormData((prev) => ({
      ...prev,
      customFields: [...prev.customFields, field],
    }));
    setNewFieldLabel('');
    setNewFieldVal('');
    setNewFieldOptions('');
    setShowAddCustomField(false);
  };

  const handleRemoveCustomField = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      customFields: prev.customFields.filter((f) => f.id !== id),
    }));
  };

  // --- CUSTOM SECTIONS ---
  const handleAddCustomSection = () => {
    if (!newSectionTitle.trim()) return;
    const section: CustomSection = {
      id: `cs-${Date.now()}`,
      title: newSectionTitle.trim(),
      content: newSectionContent.trim(),
      visible: true,
    };
    setFormData((prev) => ({
      ...prev,
      customSections: [...prev.customSections, section],
    }));
    setNewSectionTitle('');
    setNewSectionContent('');
    setShowAddCustomSection(false);
  };

  const handleRemoveCustomSection = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      customSections: prev.customSections.filter((s) => s.id !== id),
    }));
  };

  // --- ADDITIONAL CHARGES ---
  const handleAddAdditionalCharge = () => {
    const newCharge: AdditionalCharge = {
      id: `charge-${Date.now()}`,
      label: 'Hydraulic Recovery Surcharge',
      amount: 150,
      enabled: true,
    };
    setFormData((prev) => ({
      ...prev,
      additionalCharges: [...prev.additionalCharges, newCharge],
    }));
  };

  const handleRemoveAdditionalCharge = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      additionalCharges: prev.additionalCharges.filter((c) => c.id !== id),
    }));
  };

  // --- SUBMIT / SAVE ---
  const handleSaveInvoice = () => {
    if (!formData.customerName.trim()) {
      alert('Please enter a Customer Name.');
      return;
    }
    if (!formData.customerPhone.trim()) {
      alert('Please enter a Customer Phone Number.');
      return;
    }
    if (formData.items.length === 0 || !formData.items[0].description.trim()) {
      alert('Please enter a description for at least one service item.');
      return;
    }

    const hiddenFieldsList: string[] = [];
    Object.entries(formData.fieldVisibility).forEach(([k, visible]) => {
      if (!visible) hiddenFieldsList.push(k);
    });
    if (!formData.sectionVisibility.payment) hiddenFieldsList.push('paymentSection');
    if (!formData.sectionVisibility.terms) hiddenFieldsList.push('termsSection');
    if (!formData.sectionVisibility.notes) hiddenFieldsList.push('notesSection');

    const invoiceToSave: ProFormaInvoice = {
      id: invoiceToEdit?.id || `inv-${Date.now()}`,
      docNumber: formData.docNumber,
      docTitle: formData.docTitle,
      issueDate: formData.issueDate,
      validUntil: formData.validUntil,
      customerId: formData.customerId || undefined,
      customerName: formData.customerName.trim(),
      customerCompany: formData.customerCompany.trim() || undefined,
      customerPhone: formData.customerPhone.trim(),
      customerEmail: formData.customerEmail.trim() || undefined,
      customerAddress: formData.customerAddress.trim() || undefined,
      items: formData.items,
      subtotal: formTotals.subtotal,
      discountType: formData.discountType,
      discountValue: formData.discountValue,
      discountAmount: formTotals.discountAmount,
      taxRate: formData.taxRate,
      taxAmount: formTotals.taxAmount,
      grandTotal: formTotals.grandTotal,
      amountPaid: invoiceToEdit?.amountPaid || 0,
      balanceDue: formTotals.grandTotal - (invoiceToEdit?.amountPaid || 0),
      paymentInstructions: formData.paymentInstructions,
      termsAndConditions: formData.termsAndConditions,
      notes: formData.notes,
      status: formData.status,
      taxEnabled: formData.taxEnabled,
      taxLabel: formData.taxLabel,
      discountEnabled: formData.discountEnabled,
      discountLabel: formData.discountLabel,
      shippingEnabled: formData.shippingEnabled,
      shippingLabel: formData.shippingLabel,
      shippingAmount: formData.shippingAmount,
      additionalCharges: formData.additionalCharges,
      customFields: formData.customFields,
      customSections: formData.customSections,
      hiddenFields: hiddenFieldsList,
      fieldLabels: formData.fieldLabels,
      sectionTitles: formData.sectionTitles,
      sectionOrder: formData.sectionOrder,
      createdAt: invoiceToEdit?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(invoiceToSave, formData.saveAsNewCustomer);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="customizable-invoice-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/85 backdrop-blur-xs animate-in fade-in"
    >
      <div className="relative w-full max-w-7xl h-[96vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Top Modal Header */}
        <div className="h-16 px-4 sm:px-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#015557] flex items-center justify-center text-white shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 id="customizable-invoice-modal-title" className="text-sm sm:text-base font-bold tracking-tight">
                {invoiceToEdit ? `Edit & Customize: ${formData.docNumber}` : 'Create & Customize Pro Forma Invoice'}
              </h3>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Full field customization, reordering, tax &amp; charges toggles with real-time live A4 preview
              </p>
            </div>
          </div>

          {/* Mode Switchers & Actions */}
          <div className="flex items-center gap-2">
            {/* View Mode Switcher (Visible on mobile/tablet or anytime) */}
            <div className="flex items-center bg-slate-800 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  activeTab === 'editor'
                    ? 'bg-[#015557] text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Form Editor</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  activeTab === 'preview'
                    ? 'bg-[#015557] text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Live A4 Preview</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close invoice editor"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Content: Split Screen on Large Displays */}
        <div className="flex-1 flex overflow-hidden">
          {/* ================= LEFT PANEL: CUSTOMIZABLE FORM EDITOR ================= */}
          <div
            className={`w-full lg:w-1/2 flex flex-col bg-slate-50 border-r border-slate-200 overflow-hidden ${
              activeTab === 'preview' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Top Toolbar: Add Custom Elements */}
            <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0 flex-wrap">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#015557]" />
                Invoice Form Builder
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomField(!showAddCustomField)}
                  className="px-2.5 py-1 text-xs font-semibold text-[#015557] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Field</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddCustomSection(!showAddCustomSection)}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Section</span>
                </button>
              </div>
            </div>

            {/* Modal for Adding Custom Field */}
            {showAddCustomField && (
              <div className="p-4 bg-emerald-50/60 border-b border-emerald-200 space-y-3 animate-in fade-in text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#015557]">Add Custom Field to Invoice</span>
                  <button
                    type="button"
                    onClick={() => setShowAddCustomField(false)}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-slate-600 font-semibold">Field Label</label>
                    <input
                      type="text"
                      placeholder="e.g. Vehicle Reg Number / PO Number"
                      value={newFieldLabel}
                      onChange={(e) => setNewFieldLabel(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-600 font-semibold">Field Type</label>
                    <select
                      value={newFieldType}
                      onChange={(e) => setNewFieldType(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                    >
                      <option value="text">Single-line Text</option>
                      <option value="number">Numeric</option>
                      <option value="date">Date</option>
                      <option value="textarea">Multi-line Text</option>
                      <option value="select">Dropdown Menu</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold">Default / Current Value</label>
                  <input
                    type="text"
                    placeholder="e.g. GN-4820-24"
                    value={newFieldVal}
                    onChange={(e) => setNewFieldVal(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                  />
                </div>
                {newFieldType === 'select' && (
                  <div className="space-y-1">
                    <label className="text-slate-600 font-semibold">Dropdown Options (comma-separated)</label>
                    <input
                      type="text"
                      placeholder="Option 1, Option 2, Option 3"
                      value={newFieldOptions}
                      onChange={(e) => setNewFieldOptions(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                    />
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddCustomField(false)}
                    className="px-3 py-1 bg-white border border-slate-300 rounded text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCustomField}
                    className="px-3 py-1 bg-[#015557] text-white rounded font-bold"
                  >
                    Add Field
                  </button>
                </div>
              </div>
            )}

            {/* Modal for Adding Custom Section */}
            {showAddCustomSection && (
              <div className="p-4 bg-teal-50/60 border-b border-teal-200 space-y-3 animate-in fade-in text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#015557]">Add Custom Document Section</span>
                  <button
                    type="button"
                    onClick={() => setShowAddCustomSection(false)}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold">Section Title</label>
                  <input
                    type="text"
                    placeholder="e.g. 5. Pick-up &amp; Delivery Logistics"
                    value={newSectionTitle}
                    onChange={(e) => setNewSectionTitle(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold">Section Content</label>
                  <textarea
                    rows={2}
                    placeholder="Provide details, special instructions, or specifications..."
                    value={newSectionContent}
                    onChange={(e) => setNewSectionContent(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddCustomSection(false)}
                    className="px-3 py-1 bg-white border border-slate-300 rounded text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCustomSection}
                    className="px-3 py-1 bg-[#015557] text-white rounded font-bold"
                  >
                    Add Section
                  </button>
                </div>
              </div>
            )}

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 text-xs text-slate-800">
              {/* Document Banner Title Box */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Document Title Banner (A4 Header)</span>
                  <span className="text-[10px] text-slate-400 font-mono">Editable</span>
                </div>
                <input
                  type="text"
                  value={formData.docTitle}
                  onChange={(e) => setFormData({ ...formData, docTitle: e.target.value })}
                  placeholder="e.g. PRO FORMA INVOICE, COMMERCIAL QUOTATION, TAX INVOICE"
                  className="w-full px-3 py-1.5 text-xs font-bold text-[#015557] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#015557]"
                />
              </div>

              {/* RENDER DYNAMIC ORDERED SECTIONS */}
              {formData.sectionOrder.map((sectionKey, secIdx) => {
                const isFirst = secIdx === 0;
                const isLast = secIdx === formData.sectionOrder.length - 1;
                const isVisible = formData.sectionVisibility[sectionKey] !== false;
                const title = formData.sectionTitles[sectionKey] || DEFAULT_SECTION_TITLES[sectionKey];

                return (
                  <div
                    key={sectionKey}
                    className={`bg-white rounded-2xl border transition-all overflow-hidden shadow-2xs ${
                      isVisible ? 'border-slate-200' : 'border-slate-200 opacity-60 bg-slate-100/50'
                    }`}
                  >
                    {/* Section Header Strip: Reordering, Renaming, Visibility */}
                    <div className="px-4 py-3 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {editingTitleKey === sectionKey ? (
                          <div className="flex items-center gap-1.5 flex-1">
                            <input
                              type="text"
                              value={tempTitleVal}
                              onChange={(e) => setTempTitleVal(e.target.value)}
                              className="px-2 py-1 text-xs font-bold border border-[#015557] rounded bg-white text-slate-900 flex-1"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveRenameTitle(sectionKey)}
                              className="p-1 text-emerald-700 hover:bg-emerald-100 rounded"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingTitleKey(null)}
                              className="p-1 text-slate-400 hover:bg-slate-200 rounded"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 truncate">
                            <h4 className="font-bold text-slate-800 text-xs truncate">{title}</h4>
                            <button
                              type="button"
                              onClick={() => handleStartRenameTitle(sectionKey, title)}
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors"
                              title="Rename Section"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Header Actions: Up, Down, Eye Toggle */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={isFirst}
                          onClick={() => handleMoveSection(sectionKey, 'up')}
                          className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-25 rounded hover:bg-slate-200 transition-colors"
                          title="Move section up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={isLast}
                          onClick={() => handleMoveSection(sectionKey, 'down')}
                          className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-25 rounded hover:bg-slate-200 transition-colors"
                          title="Move section down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleSectionVisibility(sectionKey)}
                          className={`p-1 rounded transition-colors ${
                            isVisible
                              ? 'text-[#015557] hover:bg-emerald-50'
                              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'
                          }`}
                          title={isVisible ? 'Hide this section' : 'Show this section'}
                        >
                          {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Section Body */}
                    {isVisible && (
                      <div className="p-4 space-y-4">
                        {/* SECTION: META & SCHEDULE */}
                        {sectionKey === 'meta' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="font-semibold text-slate-700">
                                  {formData.fieldLabels.docNumber || 'Document Number'}{' '}
                                  <span className="text-[#d80000]">*</span>
                                </label>
                              </div>
                              <input
                                type="text"
                                value={formData.docNumber}
                                onChange={(e) => setFormData({ ...formData, docNumber: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-900 font-bold focus:ring-2 focus:ring-[#015557]"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="font-semibold text-slate-700">
                                {formData.fieldLabels.status || 'Status'}
                              </label>
                              <select
                                value={formData.status}
                                onChange={(e) =>
                                  setFormData({ ...formData, status: e.target.value as InvoiceStatus })
                                }
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-[#015557]"
                              >
                                <option value="Draft">Draft</option>
                                <option value="Issued">Issued</option>
                                <option value="Accepted">Accepted</option>
                                <option value="Cancelled">Cancelled</option>
                              </select>
                            </div>

                            {formData.fieldVisibility.issueDate && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <label className="font-semibold text-slate-700">
                                    {formData.fieldLabels.issueDate || 'Issue Date'}
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleFieldVisibility('issueDate')}
                                    className="text-slate-400 hover:text-slate-600 text-[10px]"
                                    title="Hide issue date"
                                  >
                                    Hide
                                  </button>
                                </div>
                                <input
                                  type="date"
                                  value={formData.issueDate}
                                  onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-[#015557]"
                                />
                              </div>
                            )}

                            {formData.fieldVisibility.validUntil && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <label className="font-semibold text-slate-700">
                                    {formData.fieldLabels.validUntil || 'Validity Deadline'}
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleFieldVisibility('validUntil')}
                                    className="text-slate-400 hover:text-slate-600 text-[10px]"
                                    title="Hide validity date"
                                  >
                                    Hide
                                  </button>
                                </div>
                                <input
                                  type="date"
                                  value={formData.validUntil}
                                  onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-[#015557]"
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* SECTION: CUSTOMER DETAILS */}
                        {sectionKey === 'customer' && (
                          <div className="space-y-3">
                            {customers.length > 0 && (
                              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                                <span className="text-[11px] text-slate-500 font-medium">Select existing client:</span>
                                <select
                                  value={formData.customerId}
                                  onChange={(e) => {
                                    const cid = e.target.value;
                                    const found = customers.find((c) => c.id === cid);
                                    if (found) {
                                      setFormData((prev) => ({
                                        ...prev,
                                        customerId: found.id,
                                        customerName: found.name,
                                        customerCompany: found.company || '',
                                        customerPhone: found.phone,
                                        customerEmail: found.email || '',
                                        customerAddress: found.address || '',
                                      }));
                                    } else {
                                      setFormData((prev) => ({ ...prev, customerId: '' }));
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-white border border-slate-300 rounded text-slate-800 text-xs"
                                >
                                  <option value="">Choose saved customer...</option>
                                  {customers.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name} {c.company ? `(${c.company})` : ''} - {c.phone}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {/* Customer Name */}
                              <div className="space-y-1">
                                <label className="font-semibold text-slate-700">
                                  {formData.fieldLabels.customerName || 'Customer Full Name'}{' '}
                                  <span className="text-[#d80000]">*</span>
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. Kwame Mensah"
                                  value={formData.customerName}
                                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-[#015557]"
                                />
                              </div>

                              {/* Customer Phone */}
                              <div className="space-y-1">
                                <label className="font-semibold text-slate-700">
                                  {formData.fieldLabels.customerPhone || 'Phone Number'}{' '}
                                  <span className="text-[#d80000]">*</span>
                                </label>
                                <input
                                  type="tel"
                                  placeholder="e.g. 0244123456"
                                  value={formData.customerPhone}
                                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-[#015557]"
                                />
                              </div>

                              {/* Company Name */}
                              {formData.fieldVisibility.customerCompany && (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <label className="font-semibold text-slate-700">
                                      {formData.fieldLabels.customerCompany || 'Company Name'}
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleFieldVisibility('customerCompany')}
                                      className="text-slate-400 hover:text-slate-600 text-[10px]"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                  <input
                                    type="text"
                                    placeholder="e.g. Golden Transport Logistics"
                                    value={formData.customerCompany}
                                    onChange={(e) =>
                                      setFormData({ ...formData, customerCompany: e.target.value })
                                    }
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-[#015557]"
                                  />
                                </div>
                              )}

                              {/* Email Address */}
                              {formData.fieldVisibility.customerEmail && (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <label className="font-semibold text-slate-700">
                                      {formData.fieldLabels.customerEmail || 'Email Address'}
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleFieldVisibility('customerEmail')}
                                      className="text-slate-400 hover:text-slate-600 text-[10px]"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                  <input
                                    type="email"
                                    placeholder="e.g. kwame@goldentransport.com.gh"
                                    value={formData.customerEmail}
                                    onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-[#015557]"
                                  />
                                </div>
                              )}

                              {/* Address */}
                              {formData.fieldVisibility.customerAddress && (
                                <div className="sm:col-span-2 space-y-1">
                                  <div className="flex items-center justify-between">
                                    <label className="font-semibold text-slate-700">
                                      {formData.fieldLabels.customerAddress || 'Physical Location / Address'}
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleFieldVisibility('customerAddress')}
                                      className="text-slate-400 hover:text-slate-600 text-[10px]"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                  <input
                                    type="text"
                                    placeholder="e.g. Spintex Road, Near Coca-Cola Roundabout, Accra"
                                    value={formData.customerAddress}
                                    onChange={(e) =>
                                      setFormData({ ...formData, customerAddress: e.target.value })
                                    }
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-[#015557]"
                                  />
                                </div>
                              )}
                            </div>

                            {/* Render Custom Fields in Customer Section */}
                            {formData.customFields.length > 0 && (
                              <div className="pt-2 border-t border-slate-100 space-y-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                  Custom Added Fields
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                  {formData.customFields.map((cf) => (
                                    <div key={cf.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-700">{cf.label}</span>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveCustomField(cf.id)}
                                          className="text-slate-400 hover:text-red-600 p-0.5"
                                          title="Remove field"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                      <input
                                        type="text"
                                        value={cf.value}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setFormData((prev) => ({
                                            ...prev,
                                            customFields: prev.customFields.map((f) =>
                                              f.id === cf.id ? { ...f, value: val } : f
                                            ),
                                          }));
                                        }}
                                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {!formData.customerId && (
                              <label className="flex items-center gap-2 cursor-pointer pt-1">
                                <input
                                  type="checkbox"
                                  checked={formData.saveAsNewCustomer}
                                  onChange={(e) =>
                                    setFormData({ ...formData, saveAsNewCustomer: e.target.checked })
                                  }
                                  className="rounded accent-[#015557]"
                                />
                                <span className="text-slate-600 font-medium">
                                  Save in customer directory for future billing
                                </span>
                              </label>
                            )}
                          </div>
                        )}

                        {/* SECTION: LINE ITEMS */}
                        {sectionKey === 'items' && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <select
                                onChange={(e) => {
                                  const preset = SERVICE_PRESETS.find((p) => p.desc === e.target.value);
                                  if (preset) {
                                    setFormData((prev) => ({
                                      ...prev,
                                      items: [
                                        ...prev.items,
                                        {
                                          id: `item-${Date.now()}`,
                                          description: preset.desc,
                                          quantity: 1,
                                          unitPrice: preset.price,
                                          total: preset.price,
                                        },
                                      ],
                                    }));
                                    e.target.value = '';
                                  }
                                }}
                                className="px-2.5 py-1 bg-slate-50 border border-slate-300 rounded text-slate-700 text-xs"
                              >
                                <option value="">Insert Santa Towing Service Preset...</option>
                                {SERVICE_PRESETS.map((p) => (
                                  <option key={p.desc} value={p.desc}>
                                    {p.desc} (GH₵ {p.price})
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                onClick={handleAddItem}
                                className="px-3 py-1 bg-[#015557] hover:bg-[#014345] text-white rounded-lg font-semibold text-xs flex items-center gap-1 transition-colors"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Custom Item</span>
                              </button>
                            </div>

                            <div className="space-y-2">
                              {formData.items.map((item, idx) => (
                                <div
                                  key={item.id || idx}
                                  className="grid grid-cols-12 gap-2 items-center bg-slate-50/70 p-2.5 rounded-xl border border-slate-200"
                                >
                                  {/* Item Description */}
                                  <div className="col-span-12 sm:col-span-5 space-y-1">
                                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold uppercase">
                                      <span>Service #{idx + 1}</span>
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          disabled={idx === 0}
                                          onClick={() => handleMoveItem(idx, 'up')}
                                          className="text-slate-400 hover:text-slate-800 disabled:opacity-20"
                                          title="Move item up"
                                        >
                                          <ArrowUp className="w-3 h-3" />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={idx === formData.items.length - 1}
                                          onClick={() => handleMoveItem(idx, 'down')}
                                          className="text-slate-400 hover:text-slate-800 disabled:opacity-20"
                                          title="Move item down"
                                        >
                                          <ArrowDown className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                    <input
                                      type="text"
                                      value={item.description}
                                      placeholder="e.g. Heavy Duty Winching & Haulage"
                                      onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-900 focus:ring-2 focus:ring-[#015557]"
                                    />
                                  </div>

                                  {/* Qty */}
                                  <div className="col-span-3 sm:col-span-2 space-y-1">
                                    <label className="text-[10px] font-semibold text-slate-500 uppercase block">
                                      Qty
                                    </label>
                                    <input
                                      type="number"
                                      min="1"
                                      value={item.quantity}
                                      onChange={(e) =>
                                        handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)
                                      }
                                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-slate-900 font-mono text-center focus:ring-2 focus:ring-[#015557]"
                                    />
                                  </div>

                                  {/* Unit Price */}
                                  <div className="col-span-4 sm:col-span-2 space-y-1">
                                    <label className="text-[10px] font-semibold text-slate-500 uppercase block">
                                      Rate (GH₵)
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.unitPrice}
                                      onChange={(e) =>
                                        handleItemChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)
                                      }
                                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-slate-900 font-mono text-right focus:ring-2 focus:ring-[#015557]"
                                    />
                                  </div>

                                  {/* Total */}
                                  <div className="col-span-4 sm:col-span-2 space-y-1 text-right">
                                    <label className="text-[10px] font-semibold text-slate-500 uppercase block">
                                      Total
                                    </label>
                                    <span className="font-mono font-bold text-slate-900 block py-1.5 text-xs truncate">
                                      GH₵ {Number(item.total).toFixed(2)}
                                    </span>
                                  </div>

                                  {/* Delete */}
                                  <div className="col-span-1 sm:col-span-1 flex justify-end">
                                    <button
                                      type="button"
                                      disabled={formData.items.length <= 1}
                                      onClick={() => handleRemoveItem(idx)}
                                      className="p-1.5 text-slate-400 hover:text-[#d80000] hover:bg-red-50 rounded disabled:opacity-20"
                                      title="Remove item"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* SECTION: FINANCIAL CALCULATIONS, TAX & CHARGES */}
                        {sectionKey === 'calculations' && (
                          <div className="space-y-4">
                            {/* 1. Tax Component (Add/Remove/Enable/Disable/Customize) */}
                            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={formData.taxEnabled}
                                    onChange={(e) => setFormData({ ...formData, taxEnabled: e.target.checked })}
                                    className="rounded accent-[#015557] w-4 h-4 cursor-pointer"
                                  />
                                  <span className="font-bold text-slate-800 text-xs">
                                    Enable Tax Functionality (VAT / Levies)
                                  </span>
                                </label>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  formData.taxEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                                }`}>
                                  {formData.taxEnabled ? 'Active' : 'Disabled / Tax-Free'}
                                </span>
                              </div>

                              {formData.taxEnabled && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                                  <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-slate-600">Tax Label</label>
                                    <input
                                      type="text"
                                      value={formData.taxLabel}
                                      onChange={(e) => setFormData({ ...formData, taxLabel: e.target.value })}
                                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-slate-600">Tax Rate (%)</label>
                                    <div className="flex gap-1">
                                      <select
                                        value={formData.taxRate}
                                        onChange={(e) =>
                                          setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })
                                        }
                                        className="px-2 py-1.5 bg-white border border-slate-300 rounded text-xs"
                                      >
                                        <option value="0">0%</option>
                                        <option value="15">15% (Std. VAT)</option>
                                        <option value="18.5">18.5% (Comprehensive)</option>
                                        <option value="21.9">21.9%</option>
                                      </select>
                                      <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="100"
                                        value={formData.taxRate}
                                        onChange={(e) =>
                                          setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })
                                        }
                                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono text-right"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* 2. Discount Component */}
                            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={formData.discountEnabled}
                                    onChange={(e) =>
                                      setFormData({ ...formData, discountEnabled: e.target.checked })
                                    }
                                    className="rounded accent-[#015557] w-4 h-4 cursor-pointer"
                                  />
                                  <span className="font-bold text-slate-800 text-xs">Enable Discount</span>
                                </label>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  formData.discountEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                                }`}>
                                  {formData.discountEnabled ? 'Active' : 'Off'}
                                </span>
                              </div>

                              {formData.discountEnabled && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                                  <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-slate-600">Discount Label</label>
                                    <input
                                      type="text"
                                      value={formData.discountLabel}
                                      onChange={(e) => setFormData({ ...formData, discountLabel: e.target.value })}
                                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-slate-600">Discount Value</label>
                                    <div className="flex gap-1">
                                      <select
                                        value={formData.discountType}
                                        onChange={(e) =>
                                          setFormData({
                                            ...formData,
                                            discountType: e.target.value as 'percentage' | 'fixed',
                                          })
                                        }
                                        className="px-2 py-1.5 bg-white border border-slate-300 rounded text-xs"
                                      >
                                        <option value="percentage">% Percent</option>
                                        <option value="fixed">GH₵ Fixed</option>
                                      </select>
                                      <input
                                        type="number"
                                        min="0"
                                        value={formData.discountValue}
                                        onChange={(e) =>
                                          setFormData({
                                            ...formData,
                                            discountValue: parseFloat(e.target.value) || 0,
                                          })
                                        }
                                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono text-right"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* 3. Shipping & Haulage Transport Charges */}
                            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={formData.shippingEnabled}
                                    onChange={(e) =>
                                      setFormData({ ...formData, shippingEnabled: e.target.checked })
                                    }
                                    className="rounded accent-[#015557] w-4 h-4 cursor-pointer"
                                  />
                                  <span className="font-bold text-slate-800 text-xs">
                                    Enable Shipping / Transport Surcharge
                                  </span>
                                </label>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  formData.shippingEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                                }`}>
                                  {formData.shippingEnabled ? 'Active' : 'Off'}
                                </span>
                              </div>

                              {formData.shippingEnabled && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                                  <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-slate-600">Transport Label</label>
                                    <input
                                      type="text"
                                      value={formData.shippingLabel}
                                      onChange={(e) => setFormData({ ...formData, shippingLabel: e.target.value })}
                                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-slate-600">Charge (GH₵)</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={formData.shippingAmount}
                                      onChange={(e) =>
                                        setFormData({
                                          ...formData,
                                          shippingAmount: parseFloat(e.target.value) || 0,
                                        })
                                      }
                                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono text-right"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* 4. Additional Charges Component */}
                            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-800 text-xs">Additional Surcharges &amp; Fees</span>
                                <button
                                  type="button"
                                  onClick={handleAddAdditionalCharge}
                                  className="px-2 py-1 text-xs font-semibold text-[#015557] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded flex items-center gap-1 transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Add Charge</span>
                                </button>
                              </div>

                              {formData.additionalCharges.length === 0 ? (
                                <p className="text-[11px] text-slate-400">No additional surcharges configured.</p>
                              ) : (
                                <div className="space-y-2">
                                  {formData.additionalCharges.map((chg) => (
                                    <div key={chg.id} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200">
                                      <input
                                        type="checkbox"
                                        checked={chg.enabled !== false}
                                        onChange={(e) => {
                                          const val = e.target.checked;
                                          setFormData((prev) => ({
                                            ...prev,
                                            additionalCharges: prev.additionalCharges.map((c) =>
                                              c.id === chg.id ? { ...c, enabled: val } : c
                                            ),
                                          }));
                                        }}
                                        className="rounded accent-[#015557]"
                                      />
                                      <input
                                        type="text"
                                        value={chg.label}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setFormData((prev) => ({
                                            ...prev,
                                            additionalCharges: prev.additionalCharges.map((c) =>
                                              c.id === chg.id ? { ...c, label: val } : c
                                            ),
                                          }));
                                        }}
                                        className="flex-1 px-2 py-1 border border-slate-200 rounded text-xs"
                                        placeholder="Charge label..."
                                      />
                                      <div className="flex items-center gap-1 w-28">
                                        <span className="text-[11px] text-slate-400">GH₵</span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          value={chg.amount}
                                          onChange={(e) => {
                                            const val = parseFloat(e.target.value) || 0;
                                            setFormData((prev) => ({
                                              ...prev,
                                              additionalCharges: prev.additionalCharges.map((c) =>
                                                c.id === chg.id ? { ...c, amount: val } : c
                                              ),
                                            }));
                                          }}
                                          className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-mono text-right"
                                        />
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveAdditionalCharge(chg.id)}
                                        className="p-1 text-slate-400 hover:text-red-600 rounded"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Summary Math Box */}
                            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5 font-mono text-xs">
                              <div className="flex justify-between text-slate-600">
                                <span>Subtotal:</span>
                                <span>GH₵ {formTotals.subtotal.toFixed(2)}</span>
                              </div>
                              {formData.discountEnabled && formTotals.discountAmount > 0 && (
                                <div className="flex justify-between text-emerald-700">
                                  <span>{formData.discountLabel}:</span>
                                  <span>- GH₵ {formTotals.discountAmount.toFixed(2)}</span>
                                </div>
                              )}
                              {formData.taxEnabled && formTotals.taxAmount > 0 && (
                                <div className="flex justify-between text-slate-600">
                                  <span>{formData.taxLabel} ({formData.taxRate}%):</span>
                                  <span>GH₵ {formTotals.taxAmount.toFixed(2)}</span>
                                </div>
                              )}
                              {formData.shippingEnabled && formTotals.shippingAmount > 0 && (
                                <div className="flex justify-between text-slate-600">
                                  <span>{formData.shippingLabel}:</span>
                                  <span>GH₵ {formTotals.shippingAmount.toFixed(2)}</span>
                                </div>
                              )}
                              {formTotals.additionalChargesTotal > 0 && (
                                <div className="flex justify-between text-slate-600">
                                  <span>Additional Surcharges:</span>
                                  <span>GH₵ {formTotals.additionalChargesTotal.toFixed(2)}</span>
                                </div>
                              )}
                              <div className="flex justify-between py-2 border-t-2 border-[#015557] text-sm font-black text-[#015557]">
                                <span>Calculated Grand Total:</span>
                                <span>GH₵ {formTotals.grandTotal.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* SECTION: PAYMENT INSTRUCTIONS */}
                        {sectionKey === 'payment' && (
                          <div className="space-y-2">
                            <textarea
                              rows={3}
                              value={formData.paymentInstructions}
                              onChange={(e) =>
                                setFormData({ ...formData, paymentInstructions: e.target.value })
                              }
                              placeholder="Bank accounts, MTN MoMo lines, Swift code..."
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-mono text-[11px]"
                            />
                          </div>
                        )}

                        {/* SECTION: TERMS & CONDITIONS */}
                        {sectionKey === 'terms' && (
                          <div className="space-y-2">
                            <textarea
                              rows={3}
                              value={formData.termsAndConditions}
                              onChange={(e) =>
                                setFormData({ ...formData, termsAndConditions: e.target.value })
                              }
                              placeholder="Payment terms, vehicle retention lien, validity period..."
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-[11px]"
                            />
                          </div>
                        )}

                        {/* SECTION: NOTES */}
                        {sectionKey === 'notes' && (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={formData.notes}
                              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                              placeholder="e.g. Special hydraulic crane assistance requested at accident scene..."
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* RENDER USER-DEFINED CUSTOM SECTIONS */}
              {formData.customSections.map((sec) => (
                <div key={sec.id} className="bg-white rounded-2xl border border-teal-200 overflow-hidden shadow-2xs">
                  <div className="px-4 py-3 bg-teal-50/70 border-b border-teal-100 flex items-center justify-between">
                    <span className="font-bold text-[#015557] text-xs">{sec.title}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomSection(sec.id)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="p-4 space-y-2">
                    <textarea
                      rows={2}
                      value={sec.content}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          customSections: prev.customSections.map((s) =>
                            s.id === sec.id ? { ...s, content: val } : s
                          ),
                        }));
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ================= RIGHT PANEL: LIVE INVOICE PREVIEW ================= */}
          <div
            className={`w-full lg:w-1/2 flex flex-col bg-slate-200/90 overflow-hidden ${
              activeTab === 'editor' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Live Preview Control Bar */}
            <div className="h-12 px-4 bg-slate-100 border-b border-slate-300 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-800 tracking-tight">Live A4 Document Preview</span>
                <span className="text-[10px] text-slate-500 hidden sm:inline">&bull; Updates in real-time</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewScale(previewScale === 'fit' ? '100%' : 'fit')}
                  className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {previewScale === 'fit' ? 'Zoom 100%' : 'Fit View'}
                </button>
              </div>
            </div>

            {/* Simulated A4 Document Container */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center bg-slate-300/60">
              <div
                className={`bg-white shadow-2xl rounded-sm border border-slate-300 p-6 sm:p-8 w-full max-w-[210mm] min-h-[280mm] flex flex-col justify-between text-slate-800 transition-all ${
                  previewScale === '100%' ? 'scale-100' : 'scale-[0.98]'
                }`}
                style={{ fontFamily: 'sans-serif' }}
              >
                {/* Document Sheet Content */}
                <div className="space-y-6">
                  {/* Accent Header Bar */}
                  <div className="h-2 w-full bg-[#015557] rounded-full" />

                  {/* Header: Company Info + Document Title */}
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-slate-200">
                    <div className="space-y-1 max-w-sm">
                      <h2 className="text-lg font-black text-[#015557] tracking-tight leading-tight">
                        {settings.companyName}
                      </h2>
                      <p className="text-[11px] text-slate-500 font-medium">{settings.tagline}</p>
                      <p className="text-[10px] text-slate-600 leading-relaxed">
                        {settings.address} • Tel: {settings.phone} {settings.phoneSecondary ? `/ ${settings.phoneSecondary}` : ''}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {settings.email} • {settings.website} • {settings.taxRegistrationNumber}
                      </p>
                    </div>

                    <div className="text-left sm:text-right space-y-1">
                      <h1 className="text-xl font-extrabold text-[#015557] tracking-tight">
                        {formData.docTitle || 'PRO FORMA INVOICE'}
                      </h1>
                      <div className="text-xs font-mono font-bold text-slate-900">
                        Doc #: {formData.docNumber}
                      </div>
                      {formData.fieldVisibility.issueDate && formData.issueDate && (
                        <div className="text-[11px] text-slate-600 font-mono">
                          Date: {formData.issueDate}
                        </div>
                      )}
                      {formData.fieldVisibility.validUntil && formData.validUntil && (
                        <div className="text-[11px] text-slate-600 font-mono">
                          Valid Until: {formData.validUntil}
                        </div>
                      )}
                      <div className="pt-0.5">
                        <span
                          className={`inline-block text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                            formData.status === 'Accepted'
                              ? 'bg-emerald-50 text-[#015557] border-emerald-300'
                              : formData.status === 'Issued'
                              ? 'bg-blue-50 text-blue-700 border-blue-300'
                              : formData.status === 'Draft'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-red-50 text-red-800 border-red-300'
                          }`}
                        >
                          {formData.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Customer / Bill-To Box */}
                  {formData.sectionVisibility.customer && (
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                      <span className="text-[10px] font-bold text-[#015557] uppercase tracking-wider block">
                        BILL TO / CLIENT DETAILS:
                      </span>
                      <div className="font-bold text-sm text-slate-900">
                        {formData.customerName || 'Customer Name'}
                      </div>
                      {formData.fieldVisibility.customerCompany && formData.customerCompany && (
                        <div className="text-[11px] font-semibold text-slate-700">
                          {formData.customerCompany}
                        </div>
                      )}
                      <div className="text-[11px] text-slate-600 font-mono">
                        Phone: {formData.customerPhone || 'N/A'}{' '}
                        {formData.fieldVisibility.customerEmail && formData.customerEmail && (
                          <span>&bull; Email: {formData.customerEmail}</span>
                        )}
                      </div>
                      {formData.fieldVisibility.customerAddress && formData.customerAddress && (
                        <div className="text-[11px] text-slate-500">
                          Location: {formData.customerAddress}
                        </div>
                      )}

                      {/* Render custom customer fields */}
                      {formData.customFields.length > 0 && (
                        <div className="pt-2 border-t border-slate-200/80 grid grid-cols-2 gap-2 text-[10px] font-mono">
                          {formData.customFields.map((cf) => (
                            <div key={cf.id}>
                              <span className="text-slate-500">{cf.label}:</span>{' '}
                              <strong className="text-slate-900">{cf.value || '—'}</strong>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Line Items Table */}
                  {formData.sectionVisibility.items && (
                    <div className="overflow-hidden border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#015557] text-white">
                            <th className="py-2.5 px-3 font-semibold">Towing &amp; Auto Services Itemized</th>
                            <th className="py-2.5 px-3 text-center font-semibold w-16">Qty</th>
                            <th className="py-2.5 px-3 text-right font-semibold w-28">Rate (GH₵)</th>
                            <th className="py-2.5 px-3 text-right font-semibold w-28">Total (GH₵)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {formData.items.map((it, idx) => (
                            <tr key={it.id || idx} className={idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}>
                              <td className="py-2.5 px-3 text-slate-900 font-medium">
                                {it.description || 'Service Description'}
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-600 font-mono">{it.quantity}</td>
                              <td className="py-2.5 px-3 text-right text-slate-600 font-mono">
                                {Number(it.unitPrice).toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-900 font-bold font-mono">
                                {Number(it.total).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Totals Breakdown */}
                  {formData.sectionVisibility.calculations && (
                    <div className="flex justify-end pt-1">
                      <div className="w-full sm:w-80 space-y-1.5 text-xs font-mono">
                        <div className="flex justify-between py-1 text-slate-600">
                          <span>Subtotal:</span>
                          <span>GH₵ {formTotals.subtotal.toFixed(2)}</span>
                        </div>

                        {formData.discountEnabled && formTotals.discountAmount > 0 && (
                          <div className="flex justify-between py-1 text-emerald-700 font-semibold">
                            <span>
                              {formData.discountLabel} ({formData.discountType === 'percentage' ? `${formData.discountValue}%` : 'Fixed'}):
                            </span>
                            <span>- GH₵ {formTotals.discountAmount.toFixed(2)}</span>
                          </div>
                        )}

                        {formData.taxEnabled && formTotals.taxAmount > 0 && (
                          <div className="flex justify-between py-1 text-slate-600">
                            <span>{formData.taxLabel} ({formData.taxRate}%):</span>
                            <span>GH₵ {formTotals.taxAmount.toFixed(2)}</span>
                          </div>
                        )}

                        {formData.shippingEnabled && formTotals.shippingAmount > 0 && (
                          <div className="flex justify-between py-1 text-slate-600">
                            <span>{formData.shippingLabel}:</span>
                            <span>GH₵ {formTotals.shippingAmount.toFixed(2)}</span>
                          </div>
                        )}

                        {formData.additionalCharges.length > 0 &&
                          formData.additionalCharges
                            .filter((c) => c.enabled !== false && c.amount > 0)
                            .map((c) => (
                              <div key={c.id} className="flex justify-between py-1 text-slate-600">
                                <span>{c.label}:</span>
                                <span>GH₵ {Number(c.amount).toFixed(2)}</span>
                              </div>
                            ))}

                        <div className="flex justify-between py-2 border-t-2 border-[#015557] text-sm font-extrabold text-[#015557]">
                          <span>Grand Total:</span>
                          <span>GH₵ {formTotals.grandTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* User-defined Custom Sections */}
                  {formData.customSections.map((sec) => (
                    <div key={sec.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                      <span className="font-bold text-[#015557] uppercase text-[10px] tracking-wider block">
                        {sec.title}
                      </span>
                      <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{sec.content}</p>
                    </div>
                  ))}

                  {/* Payment Instructions & Terms */}
                  {formData.sectionVisibility.payment && formData.paymentInstructions && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                      <span className="font-bold text-[#015557] uppercase text-[10px] tracking-wider block">
                        {formData.sectionTitles.payment || 'Payment Instructions & Remittance'}
                      </span>
                      <p className="text-slate-700 font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
                        {formData.paymentInstructions}
                      </p>
                    </div>
                  )}

                  {formData.sectionVisibility.terms && formData.termsAndConditions && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                      <span className="font-bold text-[#015557] uppercase text-[10px] tracking-wider block">
                        {formData.sectionTitles.terms || 'Service Terms & Agreement'}
                      </span>
                      <p className="text-slate-600 text-[10px] leading-relaxed whitespace-pre-wrap">
                        {formData.termsAndConditions}
                      </p>
                    </div>
                  )}

                  {formData.sectionVisibility.notes && formData.notes && (
                    <div className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-200 text-xs space-y-0.5">
                      <span className="font-bold text-amber-800 text-[10px] uppercase block">
                        {formData.sectionTitles.notes || 'Remarks / Notes'}
                      </span>
                      <p className="text-amber-900 text-[11px]">{formData.notes}</p>
                    </div>
                  )}
                </div>

                {/* Footer Stamp / Authorized Signature Block */}
                <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-end gap-4 text-xs text-slate-500">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-slate-700">Thank you for choosing Santa Towing &amp; Garage Services.</p>
                    <p className="text-[9px] text-slate-400">Official Computer-Generated Pro Forma Billing Document</p>
                  </div>
                  <div className="text-center sm:text-right">
                    <div className="w-36 border-b border-slate-400 mb-1" />
                    <span className="text-[10px] font-semibold text-slate-700">Authorized Signature &amp; Stamp</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Save Action Strip */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 hidden sm:inline">
              Calculated Grand Total:
            </span>
            <span className="text-base font-extrabold text-[#015557] font-mono">
              GH₵ {formTotals.grandTotal.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveInvoice}
              className="px-5 py-2 bg-[#015557] hover:bg-[#014345] text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#015557]"
            >
              <Check className="w-4 h-4" />
              <span>{invoiceToEdit ? 'Save Changes' : 'Create & Save Invoice'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
