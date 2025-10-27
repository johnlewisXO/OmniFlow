
import React from 'react';
// Fix: Corrected typo in useAppStore import path.
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { AdminDashboard } from './AdminDashboard'; 
import { Button } from '../shared/Button';

export const OwnerDashboard: React.FC = () => {
  const { currentUser, darkMode } = useAppStore();
  // Using more distinct icons for owner-specific sections
  const ShieldCheckIcon = ICON_MAP.SparklesIcon; // Placeholder, consider specific icons for each
  const CreditCardIcon = ICON_MAP.DevicePhoneMobileIcon; // Placeholder for billing
  const KeyIcon = ICON_MAP.CodeBracketIcon; // Placeholder for API/Security
  const ExclamationIcon = ICON_MAP.ExclamationIcon; // For danger zone

  return (
    <div className={`flex-1 p-0 md:p-0 overflow-y-auto scrollbar-thin ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
      <div className={`p-4 md:p-6 mb-0 border-b ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
        <div className="flex items-center">
            <ShieldCheckIcon className={`w-8 h-8 mr-3 ${darkMode ? 'text-amber-400' : 'text-amber-500'}`} />
            <div>
                <h1 className="text-2xl md:text-3xl font-bold">Owner's Dashboard</h1>
                <p className={`text-md ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Full organization control, billing, and advanced settings.</p>
            </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {/* Billing & Subscription Placeholder */}
            <div className={`p-4 rounded-xl ${darkMode ? 'bg-amber-900/20' : 'bg-amber-50/70'} border ${darkMode ? 'border-amber-700/50' : 'border-amber-200/70'}`}>
                <div className="flex items-center mb-2">
                    <CreditCardIcon className={`w-5 h-5 mr-2 ${darkMode ? 'text-amber-300' : 'text-amber-600'}`} />
                    <h3 className="text-md font-semibold">Subscription & Billing</h3>
                </div>
                <p className={`text-xs mb-3 ${darkMode ? 'text-amber-400' : 'text-amber-700'}`}>Manage your plan, view invoices, and update payment methods.</p>
                <Button variant="outline" size="sm" className={`w-full ${darkMode? 'border-amber-600 text-amber-300 hover:bg-amber-500/20' : 'border-amber-500 text-amber-700 hover:bg-amber-100'}`}>Manage Billing (Coming Soon)</Button>
            </div>

            {/* Advanced Security Placeholder */}
            <div className={`p-4 rounded-xl ${darkMode ? 'bg-sky-900/20' : 'bg-sky-50/70'} border ${darkMode ? 'border-sky-700/50' : 'border-sky-200/70'}`}>
                <div className="flex items-center mb-2">
                    <KeyIcon className={`w-5 h-5 mr-2 ${darkMode ? 'text-sky-300' : 'text-sky-600'}`} />
                    <h3 className="text-md font-semibold">Advanced Security & API</h3>
                </div>
                <p className={`text-xs mb-3 ${darkMode ? 'text-sky-400' : 'text-sky-700'}`}>Configure SSO, manage API keys, and view audit logs.</p>
                <Button variant="outline" size="sm" className={`w-full ${darkMode? 'border-sky-600 text-sky-300 hover:bg-sky-500/20' : 'border-sky-500 text-sky-700 hover:bg-sky-100'}`}>Security Settings (Coming Soon)</Button>
            </div>

            {/* Organization Danger Zone Placeholder */}
            <div className={`p-4 rounded-xl ${darkMode ? 'bg-red-900/20' : 'bg-red-50/70'} border ${darkMode ? 'border-red-700/50' : 'border-red-300/70'}`}>
                <div className="flex items-center mb-2">
                    <ExclamationIcon className={`w-5 h-5 mr-2 ${darkMode ? 'text-red-400' : 'text-red-500'}`} />
                    <h3 className="text-md font-semibold">Danger Zone</h3>
                </div>
                <p className={`text-xs mb-3 ${darkMode ? 'text-red-500' : 'text-red-600'}`}>Actions like transferring ownership or deleting the organization.</p>
                <Button variant="danger" size="sm" className="w-full opacity-70 hover:opacity-100">Org Actions (Coming Soon)</Button>
            </div>
        </div>
      </div>
      
      <AdminDashboard />
    </div>
  );
};