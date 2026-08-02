

import React from 'react';
import { TaskPriority, TaskStatus, UserRole, ActiveView } from './types'; 

// Manually define ALL_ACTIVE_VIEWS from the ActiveView type
export const ALL_ACTIVE_VIEWS: ActiveView[] = [
  'kanban',
  'overview',
  'admin_settings',
  'my_tasks',
  'user_management', 
  'project_list',    
  'projects_overview',
  'my_tasks_view',
  'inbox_view',
  'reports_view',
  'team_management',
  'user_logs_view',
  'task_automations'
];

export const APP_TITLE = "Omni Flow";
export const API_KEY_WARNING = "Gemini API key not configured. AI features will be unavailable. Please set REACT_APP_GEMINI_API_KEY in your environment.";


const createIcon = (path: React.ReactNode): React.FC<{ className?: string }> => ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    {path}
  </svg>
);

export const ICON_MAP = {
  ArrowLeftIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />),
  HomeIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.5 1.5 0 012.122 0l8.954 8.955M2.25 12v10.5a.75.75 0 00.75.75H21a.75.75 0 00.75-.75V12M12 21.75V16.5" />),
  FolderIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M2.25 9V7.5a2.25 2.25 0 012.25-2.25h5.379a2.25 2.25 0 011.697.708l.969 1.026a2.25 2.25 0 001.697.708h4.51a2.25 2.25 0 012.25 2.25V9m-16.5 4.5v1.5a2.25 2.25 0 002.25 2.25h12a2.25 2.25 0 002.25-2.25v-1.5" />),
  UserCircleIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />),
  SparklesIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L1.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09l2.846.813-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.25 12L15.404 12.813a4.5 4.5 0 00-3.09 3.09L9 18.75l2.846.813a4.5 4.5 0 003.09 3.09L15 21.75l.813-2.846a4.5 4.5 0 003.09-3.09L21.75 15l-2.846-.813a4.5 4.5 0 00-3.09-3.09L15 8.25z" />),
  SunIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-6.364-.386l1.591-1.591M3 12h2.25m.386-6.364l1.591 1.591M12 12a4.5 4.5 0 100-9 4.5 4.5 0 000 9z" />),
  MoonIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />),
  PlusIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />),
  LogoutIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />),
  ChevronDownIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />),
  ExclamationIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />),
  SpinnerIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />),
  CogIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93L15.65 8.1c.414.16.79.43.996.79l.715.955c.32.428.16.99-.296 1.29l-1.057.79c-.388.29-.547.764-.42 1.168l.253 1.008c.16.63.03 1.284-.348 1.758l-.37.478c-.206.26-.52.423-.846.47l-1.42.21c-.424.06-.79.32-.97.7L12 18.75c-.24.506-.85.506-1.09 0l-.71-.93c-.18-.38-.546-.64-.97-.7l-1.42-.21c-.328-.047-.64-.178-.846-.47l-.37-.482c-.378-.474-.508-1.128-.348-1.758l.253-1.008c.128-.404-.03-.878-.42-1.168l-1.056-.79c-.458-.3-.618-.862-.297-1.29l.716-.95c.206-.26.582-.47.996-.79L10.343 8c.396-.166.71-.506.78-.93l.149-.894zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" />),
  InboxIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M2.25 9V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121.75 7.5V9m-19.5 3.75h19.5M3 12.75l.405-1.125A2.25 2.25 0 015.653 10.5h12.694a2.25 2.25 0 012.248 1.125L21 12.75M3 12.75v6.75a2.25 2.25 0 002.25 2.25h13.5a2.25 2.25 0 002.25-2.25v-6.75m0 0H3m18 0h-1.575M3 12.75H1.425" />),
  ChartBarIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />),
  ClipboardListIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0cA3.375 3.375 0 017.5 2.25c1.657 0 3.007.674 4.026 1.764M12 9.75H6.75m4.026-3.006c-.482-.459-1.042-.85-1.637-1.171M12 9.75L11.25 7.5M12 9.75L12.75 7.5M12 9.75L11.25 12m1.5-2.25L12.75 12" />),
  UserGroupIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-3.741-3.741m0 0a9.097 9.097 0 00-5.334-2.482M15 15H9.75m5.25 0A3.75 3.75 0 0113.5 18.75v0c0 2.071 1.679 3.75 3.75 3.75S21 20.821 21 18.75v0a3.75 3.75 0 01-3.75-3.75M9.75 15a3.75 3.75 0 00-3.75 3.75v0c0 2.071 1.679 3.75 3.75 3.75s3.75-1.679 3.75-3.75v0A3.75 3.75 0 009.75 15M3 13.5a3.75 3.75 0 110-7.5 3.75 3.75 0 010 7.5z" />),
  TrashIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12.56 0c.342.052.682.107 1.022.166m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09.991-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />),
  DocumentTextIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />),
  UserLogsIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />), // Added UserLogsIcon, same as DocumentTextIcon
  // Add other icons as needed, for example:
  DevicePhoneMobileIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75A2.25 2.25 0 0015.75 1.5m-7.5 0P3.75 3v11.25A2.25 2.25 0 006 16.5h.095M10.5 1.5L11.409 3M10.5 1.5L9.591 3m0 0L8.25 5.25m2.341-2.25L10.5 5.25m0 0L11.409 3M15.75 1.5l-1.409 1.5M15.75 1.5L14.659 3M9.591 3l1.409 1.5M11.409 3l-1.409 1.5m0 9.75H13.5M13.5 12.75H10.5m0 0H9.75m2.063 2.063C11.536 15.029 11 15.536 11 16.25v.75m3-3.75v.75c0 .713-.536 1.221-1.25 1.438M10.5 12.75h2.25M10.5 12.75a2.25 2.25 0 00-2.25 2.25v.095c0 .544.225 1.041.604 1.401l.705.704M10.5 12.75L11.25 12" />),
  CodeBracketIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />),
  BellIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />),
  CheckIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />),
  PaperClipIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />),
  LinkIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />),
  EyeIcon: createIcon(<><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>),
  CheckCircleIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />),
  ClockIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />),
  PencilIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />),
  FilterIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />),
  XIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />),
  MailIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />),
  ShieldCheckIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751A11.959 11.959 0 0112 2.714z" />),
  ArrowPathIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />),
  MagnifyingGlassIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />),
  PrinterIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m11.32-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231a1.125 1.125 0 01-1.12-1.227L6.34 18m11.32 0h-11.32m13.78-7.5l-1.09-3.268A2.25 2.25 0 0016.903 5.75H7.097a2.25 2.25 0 00-2.137 1.482L3.87 10.5M20.25 10.5H3.75" />),
  BuildingOfficeIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5s0 0 0 0M9 9.75h1.5s0 0 0 0M9 12.75h1.5s0 0 0 0M9 15.75h1.5s0 0 0 0M13.5 6.75h1.5s0 0 0 0M13.5 9.75h1.5s0 0 0 0M13.5 12.75h1.5s0 0 0 0M13.5 15.75h1.5s0 0 0 0" />),
  CheckBadgeIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />),
  XMarkIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />),
  BoltIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />),
  Bars3Icon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />),
  GripVerticalIcon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5zM8.25 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM8.25 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM8.25 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />),
};

export const SIDENAV_ITEMS: {
  id: ActiveView;
  label: string;
  icon: keyof typeof ICON_MAP;
  path: string;
  roles?: UserRole[];
}[] = [
  { id: 'overview', label: 'Overview', icon: 'HomeIcon', path: '#', roles: Object.values(UserRole) },
  { id: 'projects_overview', label: 'Projects', icon: 'FolderIcon', path: '#', roles: Object.values(UserRole) },
  { id: 'my_tasks_view', label: 'My Tasks', icon: 'ClipboardListIcon', path: '#', roles: Object.values(UserRole) },
  { id: 'task_automations', label: 'Triggers & Rules', icon: 'BoltIcon', path: '#', roles: Object.values(UserRole) },
  { id: 'inbox_view', label: 'Inbox', icon: 'InboxIcon', path: '#', roles: Object.values(UserRole), },
  { id: 'reports_view', label: 'Reports', icon: 'ChartBarIcon', path: '#', roles: [UserRole.OWNER, UserRole.ADMIN, UserRole.PROJECT_MANAGER] },
  { id: 'team_management', label: 'Team Management', icon: 'UserGroupIcon', path: '#', roles: Object.values(UserRole) },
  { id: 'user_logs_view', label: 'User Logs', icon: 'UserLogsIcon', path: '#', roles: [UserRole.OWNER, UserRole.ADMIN] },
];


// Task Status Columns Configuration
export const TASK_STATUS_COLUMNS = [
  { id: TaskStatus.TODO, title: 'To Do', color: 'bg-slate-400 dark:bg-slate-500' },
  { id: TaskStatus.IN_PROGRESS, title: 'In Progress', color: 'bg-blue-500 dark:bg-blue-400' },
  { id: TaskStatus.REVIEW, title: 'Review', color: 'bg-amber-500 dark:bg-amber-400' },
  { id: TaskStatus.DONE, title: 'Done', color: 'bg-green-500 dark:bg-green-400' },
];

// Priority Styles
export const PRIORITY_STYLES: Record<TaskPriority, { icon: React.FC<{ className?: string }>, color: string }> = {
  [TaskPriority.LOW]: { icon: ICON_MAP.ChevronDownIcon, color: 'text-green-500 dark:text-green-400' },
  [TaskPriority.MEDIUM]: { icon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 0a1.5 1.5 0 01-1.5-1.5V6a1.5 1.5 0 011.5-1.5h16.5a1.5 1.5 0 011.5 1.5v1.5a1.5 1.5 0 01-1.5 1.5M3.75 9V3.75M3.75 9h16.5" />), color: 'text-yellow-500 dark:text-yellow-400' }, // Example custom equals-like icon for medium
  [TaskPriority.HIGH]: { icon: createIcon(<path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />) , color: 'text-orange-500 dark:text-orange-400' }, // Using ChevronUp for High
  [TaskPriority.CRITICAL]: { icon: ICON_MAP.ExclamationIcon, color: 'text-red-600 dark:text-red-500' },
};