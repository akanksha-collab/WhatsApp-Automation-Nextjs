'use client';

import { useState, useEffect } from 'react';
import { Save, AlertCircle, Clock, Settings, Zap, Plus, Trash2, Edit2, Check, X, Sparkles, Loader2 } from 'lucide-react';

interface TimeSlot {
  id: string;
  time: string;
  isActive: boolean;
  label?: string;
}

interface DaySettings {
  day: string;
  isActive: boolean;
  timeSlots: TimeSlot[];
}

interface ScheduleSettings {
  whatsappChannelId: string;
  maytapiProductId: string;
  maytapiPhoneId: string;
  weeklySchedule: DaySettings[];
  priorityThresholds: {
    highPriority: number;
    mediumPriority: number;
    lowPriority: number;
  };
  contentRotation: {
    imageWeight: number;
    videoWeight: number;
    textWeight: number;
    linkWeight: number;
  };
  autoScheduleEnabled: boolean;
  autoScheduleDaysBefore: number;
  timezone: string;
}

// Section edit modes
type SectionKey = 'whatsapp' | 'priority' | 'imageGen' | 'weeklySchedule';

export default function ScheduleSettingsPage() {
  const [settings, setSettings] = useState<ScheduleSettings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<ScheduleSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<SectionKey | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Separate edit modes for each section
  const [editModes, setEditModes] = useState<Record<SectionKey, boolean>>({
    whatsapp: false,
    priority: false,
    imageGen: false,
    weeklySchedule: false,
  });
  
  // Edit time slot state
  const [editingSlot, setEditingSlot] = useState<{ day: string; slotId: string } | null>(null);
  const [editingTime, setEditingTime] = useState('');
  
  // Add time slot state
  const [addingToDay, setAddingToDay] = useState<string | null>(null);
  const [newSlotTime, setNewSlotTime] = useState('');

  // AI Image Generation Settings state
  const [imageGuidelines, setImageGuidelines] = useState('');
  const [originalImageGuidelines, setOriginalImageGuidelines] = useState('');
  const [isLoadingGuidelines, setIsLoadingGuidelines] = useState(true);
  const [isSavingGuidelines, setIsSavingGuidelines] = useState(false);
  const [guidelinesSuccess, setGuidelinesSuccess] = useState('');
  const [guidelinesError, setGuidelinesError] = useState('');
  
  // Helper functions for section edit modes
  const toggleEditMode = (section: SectionKey) => {
    setEditModes(prev => ({ ...prev, [section]: !prev[section] }));
  };
  
  const cancelSectionEdit = (section: SectionKey) => {
    if (originalSettings && settings) {
      // Restore original values for specific section
      switch (section) {
        case 'whatsapp':
          setSettings({
            ...settings,
            whatsappChannelId: originalSettings.whatsappChannelId,
            maytapiProductId: originalSettings.maytapiProductId,
            maytapiPhoneId: originalSettings.maytapiPhoneId,
            timezone: originalSettings.timezone,
          });
          break;
        case 'priority':
          setSettings({
            ...settings,
            priorityThresholds: { ...originalSettings.priorityThresholds },
          });
          break;
        case 'weeklySchedule':
          setSettings({
            ...settings,
            weeklySchedule: originalSettings.weeklySchedule.map(d => ({
              ...d,
              timeSlots: d.timeSlots.map(s => ({ ...s })),
            })),
          });
          setEditingSlot(null);
          setAddingToDay(null);
          break;
      }
    }
    setEditModes(prev => ({ ...prev, [section]: false }));
  };

  useEffect(() => {
    fetchSettings();
    fetchImageGuidelines();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/schedule/settings');
      const data = await res.json();
      
      if (data.settings) {
        setSettings(data.settings);
        setOriginalSettings(data.settings);
        setIsEditMode(false); // Settings exist, start in view mode
      } else if (data.defaults) {
        const defaultSettings = {
          whatsappChannelId: '',
          maytapiProductId: '',
          maytapiPhoneId: '',
          ...data.defaults,
          autoScheduleEnabled: true,
          autoScheduleDaysBefore: 7,
        };
        setSettings(defaultSettings);
        setOriginalSettings(null);
        setIsEditMode(true); // No settings yet, start in edit mode
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchImageGuidelines = async () => {
    setIsLoadingGuidelines(true);
    try {
      const res = await fetch('/api/settings/image-generation');
      if (res.ok) {
        const data = await res.json();
        setImageGuidelines(data.guidelines || '');
        setOriginalImageGuidelines(data.guidelines || '');
      }
    } catch (error) {
      console.error('Failed to fetch image guidelines:', error);
    } finally {
      setIsLoadingGuidelines(false);
    }
  };

  const saveImageGuidelines = async () => {
    setIsSavingGuidelines(true);
    setGuidelinesError('');
    setGuidelinesSuccess('');

    try {
      const res = await fetch('/api/settings/image-generation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guidelines: imageGuidelines }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      setOriginalImageGuidelines(imageGuidelines);
      setGuidelinesSuccess('Image generation guidelines saved!');
      setTimeout(() => setGuidelinesSuccess(''), 3000);
    } catch (err) {
      setGuidelinesError(err instanceof Error ? err.message : 'Failed to save guidelines');
    } finally {
      setIsSavingGuidelines(false);
    }
  };

  const handleSaveSection = async (section: SectionKey) => {
    if (!settings) return;
    
    setError('');
    setSuccess('');
    setIsSaving(section);

    try {
      const res = await fetch('/api/schedule/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to save settings');
        return;
      }

      setOriginalSettings(JSON.parse(JSON.stringify(settings)));
      setEditModes(prev => ({ ...prev, [section]: false }));
      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Something went wrong');
    } finally {
      setIsSaving(null);
    }
  };

  const toggleDayActive = (day: string) => {
    if (!settings || !editModes.weeklySchedule) return;
    setSettings({
      ...settings,
      weeklySchedule: settings.weeklySchedule.map(d =>
        d.day === day ? { ...d, isActive: !d.isActive } : d
      ),
    });
  };

  const toggleTimeSlot = (day: string, slotId: string) => {
    if (!settings || !editModes.weeklySchedule) return;
    setSettings({
      ...settings,
      weeklySchedule: settings.weeklySchedule.map(d =>
        d.day === day
          ? {
              ...d,
              timeSlots: d.timeSlots.map(s =>
                s.id === slotId ? { ...s, isActive: !s.isActive } : s
              ),
            }
          : d
      ),
    });
  };

  const startEditingSlot = (day: string, slot: TimeSlot) => {
    if (!editModes.weeklySchedule) return;
    setEditingSlot({ day, slotId: slot.id });
    setEditingTime(slot.time);
  };

  const saveEditedSlot = () => {
    if (!settings || !editingSlot || !editingTime) return;
    
    setSettings({
      ...settings,
      weeklySchedule: settings.weeklySchedule.map(d =>
        d.day === editingSlot.day
          ? {
              ...d,
              timeSlots: d.timeSlots.map(s =>
                s.id === editingSlot.slotId ? { ...s, time: editingTime } : s
              ),
            }
          : d
      ),
    });
    setEditingSlot(null);
    setEditingTime('');
  };

  const cancelEditing = () => {
    setEditingSlot(null);
    setEditingTime('');
  };

  const addTimeSlot = (day: string) => {
    if (!settings || !newSlotTime) return;
    
    const newSlot: TimeSlot = {
      id: `${day}-${Date.now()}`,
      time: newSlotTime,
      isActive: true,
      label: '',
    };
    
    setSettings({
      ...settings,
      weeklySchedule: settings.weeklySchedule.map(d =>
        d.day === day
          ? {
              ...d,
              timeSlots: [...d.timeSlots, newSlot].sort((a, b) => a.time.localeCompare(b.time)),
            }
          : d
      ),
    });
    setAddingToDay(null);
    setNewSlotTime('');
  };

  const deleteTimeSlot = (day: string, slotId: string) => {
    if (!settings || !editModes.weeklySchedule) return;
    
    setSettings({
      ...settings,
      weeklySchedule: settings.weeklySchedule.map(d =>
        d.day === day
          ? {
              ...d,
              timeSlots: d.timeSlots.filter(s => s.id !== slotId),
            }
          : d
      ),
    });
  };

  const countActiveSlots = (daySettings: DaySettings) => {
    return daySettings.timeSlots.filter(s => s.isActive).length;
  };

  if (isLoading) {
    return <div className="text-center py-12 text-gray-500">Loading settings...</div>;
  }

  if (!settings) {
    return <div className="text-center py-12 text-gray-500">Failed to load settings</div>;
  }

  const getInputClassName = (isEditing: boolean) => `w-full px-4 py-2 border border-gray-200 rounded-lg transition-all ${
    isEditing 
      ? 'focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent bg-white' 
      : 'bg-gray-50 text-gray-600 cursor-not-allowed'
  }`;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-whatsapp-dark-teal">
            Schedule Settings
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Configure your posting schedule and WhatsApp integration
          </p>
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-600">
          <Save size={18} />
          <span>{success}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* WhatsApp Configuration */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Settings size={20} className="text-whatsapp-dark-teal" />
              <h2 className="text-sm font-semibold tracking-wide text-whatsapp-dark-teal uppercase">
                WhatsApp Configuration
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {!editModes.whatsapp ? (
                <button
                  onClick={() => toggleEditMode('whatsapp')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors"
                >
                  <Edit2 size={14} />
                  Edit
                </button>
              ) : (
                <>
                  <button
                    onClick={() => cancelSectionEdit('whatsapp')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    <X size={14} />
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveSection('whatsapp')}
                    disabled={isSaving === 'whatsapp'}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-whatsapp-green text-white rounded-lg font-medium hover:bg-whatsapp-teal transition-colors disabled:opacity-50"
                  >
                    <Save size={14} />
                    {isSaving === 'whatsapp' ? 'Saving...' : 'Save'}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                WhatsApp Channel ID
              </label>
              <input
                type="text"
                value={settings.whatsappChannelId}
                onChange={(e) => setSettings({ ...settings, whatsappChannelId: e.target.value })}
                disabled={!editModes.whatsapp}
                className={getInputClassName(editModes.whatsapp)}
                placeholder="e.g., 120363419056389937@newsletter"
              />
              <p className="text-xs text-gray-500 mt-1">For channels, use format: ID@newsletter</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maytapi Product ID
              </label>
              <input
                type="text"
                value={settings.maytapiProductId}
                onChange={(e) => setSettings({ ...settings, maytapiProductId: e.target.value })}
                disabled={!editModes.whatsapp}
                className={getInputClassName(editModes.whatsapp)}
                placeholder="Your Maytapi product ID"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maytapi Phone ID
              </label>
              <input
                type="text"
                value={settings.maytapiPhoneId}
                onChange={(e) => setSettings({ ...settings, maytapiPhoneId: e.target.value })}
                disabled={!editModes.whatsapp}
                className={getInputClassName(editModes.whatsapp)}
                placeholder="Your Maytapi phone ID"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Timezone
              </label>
              <select
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                disabled={!editModes.whatsapp}
                className={`${getInputClassName(editModes.whatsapp)} ${editModes.whatsapp ? 'bg-white' : 'bg-gray-50'}`}
              >
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>
        </div>

        {/* Priority Settings */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Zap size={20} className="text-whatsapp-dark-teal" />
              <h2 className="text-sm font-semibold tracking-wide text-whatsapp-dark-teal uppercase">
                Priority Thresholds (Days)
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {!editModes.priority ? (
                <button
                  onClick={() => toggleEditMode('priority')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors"
                >
                  <Edit2 size={14} />
                  Edit
                </button>
              ) : (
                <>
                  <button
                    onClick={() => cancelSectionEdit('priority')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    <X size={14} />
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveSection('priority')}
                    disabled={isSaving === 'priority'}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-whatsapp-green text-white rounded-lg font-medium hover:bg-whatsapp-teal transition-colors disabled:opacity-50"
                  >
                    <Save size={14} />
                    {isSaving === 'priority' ? 'Saving...' : 'Save'}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Critical (High)
                </label>
                <input
                  type="number"
                  value={settings.priorityThresholds.highPriority}
                  onChange={(e) => setSettings({
                    ...settings,
                    priorityThresholds: { ...settings.priorityThresholds, highPriority: parseInt(e.target.value) }
                  })}
                  disabled={!editModes.priority}
                  className={getInputClassName(editModes.priority)}
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Medium
                </label>
                <input
                  type="number"
                  value={settings.priorityThresholds.mediumPriority}
                  onChange={(e) => setSettings({
                    ...settings,
                    priorityThresholds: { ...settings.priorityThresholds, mediumPriority: parseInt(e.target.value) }
                  })}
                  disabled={!editModes.priority}
                  className={getInputClassName(editModes.priority)}
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Low
                </label>
                <input
                  type="number"
                  value={settings.priorityThresholds.lowPriority}
                  onChange={(e) => setSettings({
                    ...settings,
                    priorityThresholds: { ...settings.priorityThresholds, lowPriority: parseInt(e.target.value) }
                  })}
                  disabled={!editModes.priority}
                  className={getInputClassName(editModes.priority)}
                  min="1"
                />
              </div>
            </div>

          </div>
        </div>

        {/* Image Generation Settings */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Sparkles size={16} className="text-white" />
              </div>
              <h2 className="text-sm font-semibold tracking-wide text-whatsapp-dark-teal uppercase">
                Image Generation Settings
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {imageGuidelines !== originalImageGuidelines && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                  Unsaved changes
                </span>
              )}
              {!editModes.imageGen ? (
                <button
                  onClick={() => toggleEditMode('imageGen')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors"
                >
                  <Edit2 size={14} />
                  Edit
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setImageGuidelines(originalImageGuidelines);
                      setEditModes(prev => ({ ...prev, imageGen: false }));
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    <X size={14} />
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      saveImageGuidelines();
                      setEditModes(prev => ({ ...prev, imageGen: false }));
                    }}
                    disabled={isSavingGuidelines || imageGuidelines === originalImageGuidelines}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-colors disabled:opacity-50"
                  >
                    {isSavingGuidelines ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={14} />
                        Save
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {guidelinesError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-4">
              <AlertCircle size={16} />
              <span>{guidelinesError}</span>
            </div>
          )}

          {guidelinesSuccess && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm mb-4">
              <Check size={16} />
              <span>{guidelinesSuccess}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                General guidelines for image generation
              </label>
              {isLoadingGuidelines ? (
                <div className="h-32 bg-gray-50 rounded-lg flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : (
                <textarea
                  value={imageGuidelines}
                  onChange={(e) => setImageGuidelines(e.target.value)}
                  disabled={!editModes.imageGen}
                  rows={5}
                  className={`w-full px-4 py-3 border border-gray-200 rounded-lg resize-none transition-all ${
                    editModes.imageGen
                      ? 'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white'
                      : 'bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  placeholder="E.g., Use professional colors (blue, gray, white). Include stock market imagery. Maintain a serious, trustworthy tone. Avoid cartoon-style graphics..."
                />
              )}
              <p className="text-xs text-gray-500 mt-2">
                These guidelines will be combined with case details when generating AI images in the Content tab.
              </p>
            </div>
          </div>
        </div>

        {/* Weekly Schedule */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Clock size={20} className="text-whatsapp-dark-teal" />
              <h2 className="text-sm font-semibold tracking-wide text-whatsapp-dark-teal uppercase">
                Weekly Schedule
              </h2>
              {editModes.weeklySchedule && (
                <span className="text-xs text-gray-500 ml-2">
                  Click time to toggle • Double-click to edit
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!editModes.weeklySchedule ? (
                <button
                  onClick={() => toggleEditMode('weeklySchedule')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors"
                >
                  <Edit2 size={14} />
                  Edit
                </button>
              ) : (
                <>
                  <button
                    onClick={() => cancelSectionEdit('weeklySchedule')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    <X size={14} />
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveSection('weeklySchedule')}
                    disabled={isSaving === 'weeklySchedule'}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-whatsapp-green text-white rounded-lg font-medium hover:bg-whatsapp-teal transition-colors disabled:opacity-50"
                  >
                    <Save size={14} />
                    {isSaving === 'weeklySchedule' ? 'Saving...' : 'Save'}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {settings.weeklySchedule.map((daySettings) => (
              <div key={daySettings.day} className={`border rounded-lg p-4 ${editModes.weeklySchedule ? 'border-gray-200' : 'border-gray-100 bg-gray-50/50'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={daySettings.isActive}
                      onChange={() => toggleDayActive(daySettings.day)}
                      disabled={!editModes.weeklySchedule}
                      className={`w-4 h-4 text-whatsapp-green border-gray-300 rounded focus:ring-whatsapp-green ${!editModes.weeklySchedule ? 'cursor-not-allowed' : ''}`}
                    />
                    <span className="font-medium text-gray-900 capitalize">{daySettings.day}</span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      {countActiveSlots(daySettings)} posts/day
                    </span>
                  </div>
                  
                  {daySettings.isActive && editModes.weeklySchedule && (
                    <button
                      onClick={() => setAddingToDay(addingToDay === daySettings.day ? null : daySettings.day)}
                      className="flex items-center gap-1 text-sm text-whatsapp-teal hover:text-whatsapp-dark-teal transition-colors"
                    >
                      <Plus size={16} />
                      Add Time Slot
                    </button>
                  )}
                </div>
                
                {daySettings.isActive && (
                  <>
                    {/* Add new slot input */}
                    {addingToDay === daySettings.day && editModes.weeklySchedule && (
                      <div className="flex items-center gap-2 mb-3 ml-7">
                        <input
                          type="time"
                          value={newSlotTime}
                          onChange={(e) => setNewSlotTime(e.target.value)}
                          className="px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent text-sm"
                        />
                        <button
                          onClick={() => addTimeSlot(daySettings.day)}
                          disabled={!newSlotTime}
                          className="p-1.5 bg-whatsapp-green text-white rounded-lg hover:bg-whatsapp-teal transition-colors disabled:opacity-50"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => { setAddingToDay(null); setNewSlotTime(''); }}
                          className="p-1.5 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                    
                    {/* Time slots */}
                    <div className="flex flex-wrap gap-2 ml-7">
                      {daySettings.timeSlots.map((slot) => (
                        <div key={slot.id} className="group relative">
                          {editingSlot?.day === daySettings.day && editingSlot?.slotId === slot.id && editModes.weeklySchedule ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="time"
                                value={editingTime}
                                onChange={(e) => setEditingTime(e.target.value)}
                                className="px-2 py-1 border border-whatsapp-green rounded text-sm w-24"
                                autoFocus
                              />
                              <button
                                onClick={saveEditedSlot}
                                className="p-1 bg-whatsapp-green text-white rounded hover:bg-whatsapp-teal"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={cancelEditing}
                                className="p-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center">
                              <button
                                onClick={() => editModes.weeklySchedule && toggleTimeSlot(daySettings.day, slot.id)}
                                onDoubleClick={() => editModes.weeklySchedule && startEditingSlot(daySettings.day, slot)}
                                className={`px-3 py-1.5 text-sm font-medium transition-all ${
                                  editModes.weeklySchedule ? 'rounded-l-lg' : 'rounded-lg'
                                } ${
                                  slot.isActive
                                    ? 'bg-whatsapp-green text-white'
                                    : 'bg-gray-100 text-gray-600'
                                } ${!editModes.weeklySchedule ? 'cursor-default' : 'hover:opacity-90'}`}
                              >
                                {slot.time}
                              </button>
                              {editModes.weeklySchedule && (
                                <div className="hidden group-hover:flex">
                                  <button
                                    onClick={() => startEditingSlot(daySettings.day, slot)}
                                    className="p-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button
                                    onClick={() => deleteTimeSlot(daySettings.day, slot.id)}
                                    className="p-1.5 bg-red-100 text-red-600 hover:bg-red-200 transition-colors rounded-r-lg"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {daySettings.timeSlots.length === 0 && (
                        <span className="text-sm text-gray-400 italic">
                          {editModes.weeklySchedule ? 'No time slots - click "Add Time Slot" to create one' : 'No time slots configured'}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
