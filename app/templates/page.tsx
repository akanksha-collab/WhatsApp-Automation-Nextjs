'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Trash2, Image, Video, FileText, Link as LinkIcon, Check, AlertCircle, ChevronDown, Zap, ArrowUp, Minus, ArrowDown } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

type TemplatePriority = 'urgent' | 'high' | 'medium' | 'low';
type TemplateContentType = 'image' | 'video' | 'text' | 'link';

interface Template {
  _id: string;
  name: string;
  contentType: TemplateContentType;
  priority: TemplatePriority;
  template: string;
  ctaText?: string;
  ctaUrl?: string;
  isDefault: boolean;
  isActive: boolean;
  usageCount: number;
}

const CONTENT_TYPES = [
  { value: 'image', label: 'Image', icon: Image },
  { value: 'video', label: 'Video', icon: Video },
  { value: 'text', label: 'Text', icon: FileText },
  { value: 'link', label: 'Link', icon: LinkIcon },
];

const PRIORITY_OPTIONS: { value: TemplatePriority; label: string; icon: React.ElementType; color: string; bgColor: string }[] = [
  { value: 'urgent', label: 'Urgent', icon: Zap, color: 'text-red-600', bgColor: 'bg-red-100' },
  { value: 'high', label: 'High', icon: ArrowUp, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  { value: 'medium', label: 'Medium', icon: Minus, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  { value: 'low', label: 'Low', icon: ArrowDown, color: 'text-gray-600', bgColor: 'bg-gray-100' },
];

const PLACEHOLDER_GROUPS = [
  {
    label: 'Basic Info',
    placeholders: [
      { tag: '[Company Name]', description: 'Company name' },
      { tag: '[Ticker]', description: 'Stock ticker symbol' },
    ],
  },
  {
    label: 'Dates',
    placeholders: [
      { tag: '[Lead Plaintiff Deadline]', description: 'Lead plaintiff deadline' },
      { tag: '[Days Remaining]', description: 'Days left until deadline (number only, e.g., "5", "0")' },
      { tag: '[Class Period Start]', description: 'Class period start' },
      { tag: '[Class Period End]', description: 'Class period end' },
      { tag: '[Class Action Period - Start Date]', description: 'Class period start (alternate)' },
      { tag: '[Class Action Period - End Date]', description: 'Class period end (alternate)' },
      { tag: '[Case Date]', description: 'Case filing date' },
    ],
  },
  {
    label: 'Case Details',
    placeholders: [
      { tag: '[Allegations]', description: 'Allegations summary' },
    ],
  },
  {
    label: 'Links',
    placeholders: [
      { tag: '[Join Link]', description: 'Join/submit link' },
      { tag: '[Blog Link]', description: 'Blog article link' },
      { tag: '[YouTube Link]', description: 'YouTube video link' },
      { tag: '[Podcast Link]', description: 'Podcast link' },
      { tag: '[Avatar Video]', description: 'Avatar video link' },
      { tag: '[AI Video]', description: 'AI video link' },
    ],
  },
];

export default function TemplatesPage() {
  const toast = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [error, setError] = useState('');
  const [showPlaceholderDropdown, setShowPlaceholderDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    contentType: 'text' as TemplateContentType,
    priority: 'medium' as TemplatePriority,
    template: '',
    ctaText: '',
    ctaUrl: '',
    isDefault: false,
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowPlaceholderDropdown(false);
      }
    }

    if (showPlaceholderDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPlaceholderDropdown]);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSaving(true);

    try {
      const isEditing = !!editingTemplate;
      const url = '/api/templates';
      const method = isEditing ? 'PUT' : 'POST';
      const body = isEditing 
        ? { ...formData, _id: editingTemplate._id }
        : formData;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to save template');
        toast.error('Save Failed', data.error || 'Failed to save template');
        return;
      }

      setShowModal(false);
      resetForm();
      fetchTemplates();
      toast.success(
        isEditing ? 'Template Updated' : 'Template Created',
        `Successfully ${isEditing ? 'updated' : 'created'} the template.`
      );
    } catch {
      setError('Something went wrong');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/templates?id=${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error('Delete Failed', data.error || 'Failed to delete template');
        return;
      }

      setShowDeleteConfirm(null);
      fetchTemplates();
      toast.success('Template Deleted', 'The template has been successfully deleted.');
    } catch (error) {
      console.error('Failed to delete template:', error);
      toast.error('Delete Failed', 'An unexpected error occurred');
    }
  };

  const openEditModal = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      contentType: template.contentType,
      priority: template.priority || 'medium',
      template: template.template,
      ctaText: template.ctaText || '',
      ctaUrl: template.ctaUrl || '',
      isDefault: template.isDefault,
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      contentType: 'text',
      priority: 'medium',
      template: '',
      ctaText: '',
      ctaUrl: '',
      isDefault: false,
    });
    setEditingTemplate(null);
    setShowPlaceholderDropdown(false);
  };

  const openNewTemplateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const insertPlaceholder = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      template: prev.template + tag,
    }));
    setShowPlaceholderDropdown(false);
  };

  const getContentIcon = (type: string) => {
    const found = CONTENT_TYPES.find(t => t.value === type);
    if (found) {
      const Icon = found.icon;
      return <Icon size={16} />;
    }
    return <FileText size={16} />;
  };

  const getPriorityBadge = (priority: TemplatePriority | undefined) => {
    const option = PRIORITY_OPTIONS.find(p => p.value === (priority || 'medium'));
    if (!option) return null;
    const Icon = option.icon;
    return (
      <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${option.bgColor} ${option.color}`}>
        <Icon size={12} />
        {option.label}
      </span>
    );
  };

  return (
    <div className="space-y-8">
      {/* Page header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-whatsapp-dark-teal">
            Message Templates
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Create and manage message templates for your scheduled posts
          </p>
        </div>
        <button
          onClick={openNewTemplateModal}
          className="flex items-center gap-2 px-4 py-2 bg-whatsapp-green text-white rounded-lg font-medium hover:bg-whatsapp-teal transition-colors shadow-sm"
        >
          <Plus size={20} />
          New Template
        </button>
      </header>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : templates.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <FileText size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No templates yet</h3>
          <p className="text-gray-600 mb-6">
            Create message templates organized by content type and priority
          </p>
          <button
            onClick={openNewTemplateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-whatsapp-green text-white rounded-lg font-medium hover:bg-whatsapp-teal transition-colors"
          >
            <Plus size={20} />
            Create Template
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <div
              key={template._id}
              className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-whatsapp-light-green rounded-lg text-whatsapp-dark-teal">
                    {getContentIcon(template.contentType)}
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-900">{template.name}</h3>
                    <span className="text-xs text-gray-500 capitalize">{template.contentType}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {getPriorityBadge(template.priority)}
                  {template.isDefault && (
                    <span className="flex items-center gap-1 px-2 py-1 bg-whatsapp-light-green rounded-full text-xs font-medium text-whatsapp-dark-teal">
                      <Check size={12} />
                      Default
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-sm text-gray-600 line-clamp-3 whitespace-pre-wrap">
                  {template.template}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Used {template.usageCount || 0} times
                </span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => openEditModal(template)}
                    className="p-2 hover:bg-whatsapp-beige rounded-lg transition-colors"
                  >
                    <Edit size={16} className="text-gray-600" />
                  </button>
                  <button 
                    onClick={() => setShowDeleteConfirm(template._id)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} className="text-red-600" />
                  </button>
                </div>
              </div>

              {/* Delete Confirmation */}
              {showDeleteConfirm === template._id && (
                <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm text-red-600 mb-2">Delete this template?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(template._id)}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(null)}
                      className="px-3 py-1 bg-white text-gray-600 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            // Close modal when clicking backdrop
            if (e.target === e.currentTarget) {
              setShowModal(false);
              setShowPlaceholderDropdown(false);
            }
          }}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-whatsapp-dark-teal mb-6">
              {editingTemplate ? 'Edit Template' : 'New Template'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent transition-all"
                  placeholder="e.g., Urgent Lead Plaintiff Alert"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Content Type
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {CONTENT_TYPES.map((type) => {
                      const Icon = type.icon;
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, contentType: type.value as TemplateContentType }))}
                          className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                            formData.contentType === type.value
                              ? 'border-whatsapp-green bg-whatsapp-light-green'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Icon size={20} className={formData.contentType === type.value ? 'text-whatsapp-dark-teal' : 'text-gray-500'} />
                          <span className={`text-xs font-medium ${formData.contentType === type.value ? 'text-whatsapp-dark-teal' : 'text-gray-600'}`}>
                            {type.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority Level
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PRIORITY_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, priority: option.value }))}
                          className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                            formData.priority === option.value
                              ? `border-current ${option.bgColor} ${option.color}`
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Icon size={16} className={formData.priority === option.value ? option.color : 'text-gray-500'} />
                          <span className={`text-sm font-medium ${formData.priority === option.value ? option.color : 'text-gray-600'}`}>
                            {option.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message Template
                </label>
                <textarea
                  value={formData.template}
                  onChange={(e) => setFormData(prev => ({ ...prev, template: e.target.value }))}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent transition-all resize-none font-mono text-sm"
                  placeholder="Enter your message template with placeholders like [Company Name], [Ticker]..."
                  required
                />
                
                {/* Placeholder Dropdown */}
                <div className="mt-2 relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowPlaceholderDropdown(!showPlaceholderDropdown)}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors"
                  >
                    <Plus size={16} />
                    Insert Placeholder
                    <ChevronDown size={16} className={`transition-transform ${showPlaceholderDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showPlaceholderDropdown && (
                    <div className="absolute left-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-64 overflow-y-auto">
                      {PLACEHOLDER_GROUPS.map((group) => (
                        <div key={group.label}>
                          <div className="px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide sticky top-0 border-b border-gray-100">
                            {group.label}
                          </div>
                          {group.placeholders.map((p) => (
                            <button
                              key={p.tag}
                              type="button"
                              onClick={() => insertPlaceholder(p.tag)}
                              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-whatsapp-beige transition-colors text-left border-b border-gray-50 last:border-0"
                            >
                              <span className="font-mono text-sm text-whatsapp-teal font-medium">{p.tag}</span>
                              <span className="text-xs text-gray-500">{p.description}</span>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                  className="w-4 h-4 text-whatsapp-green border-gray-300 rounded focus:ring-whatsapp-green"
                />
                <label htmlFor="isDefault" className="text-sm text-gray-700">
                  Set as default for this content type and priority
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setShowPlaceholderDropdown(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-whatsapp-green text-white rounded-lg font-medium hover:bg-whatsapp-teal transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : (editingTemplate ? 'Update Template' : 'Save Template')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
