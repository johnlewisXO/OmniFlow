
import React, { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { ICON_MAP } from '../../constants';
import { Task, TaskStatus, TaskPriority, Project, AppUserType } from '../../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { format, parseISO, subDays, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';

export const ReportsPage: React.FC = () => {
  const { 
    darkMode, tasks, projects, users, currentUser, 
    fetchAllTasksForAllProjects, isLoadingTasks 
  } = useAppStore();

  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'all' | '7days' | '30days'>('30days');

  useEffect(() => {
    fetchAllTasksForAllProjects();
  }, [fetchAllTasksForAllProjects]);

  const filteredTasks = useMemo(() => {
    let filtered = tasks;

    if (selectedProjectId !== 'all') {
      filtered = filtered.filter(t => t.projectId === selectedProjectId);
    }

    if (selectedAssigneeId !== 'all') {
      if (selectedAssigneeId === 'unassigned') {
        filtered = filtered.filter(t => !t.assignee_id);
      } else {
        filtered = filtered.filter(t => t.assignee_id === selectedAssigneeId);
      }
    }

    if (dateRange !== 'all') {
      const days = dateRange === '7days' ? 7 : 30;
      const cutoffDate = subDays(new Date(), days);
      filtered = filtered.filter(t => {
        if (!t.created_at) return true; // fallback
        return isAfter(new Date(t.created_at), cutoffDate);
      });
    }

    return filtered;
  }, [tasks, selectedProjectId, selectedAssigneeId, dateRange]);

  // 1. Workload by Assignee
  const workloadData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredTasks.forEach(task => {
      if (task.status !== TaskStatus.DONE) {
        const assigneeName = task.assignee_id 
          ? users.find(u => u.id === task.assignee_id)?.full_name || 'Unknown'
          : 'Unassigned';
        counts[assigneeName] = (counts[assigneeName] || 0) + 1;
      }
    });
    return Object.entries(counts).map(([name, count]) => ({ name, tasks: count })).sort((a, b) => b.tasks - a.tasks);
  }, [filteredTasks, users]);

  // 2. Task Status Breakdown
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {
      [TaskStatus.TODO]: 0,
      [TaskStatus.IN_PROGRESS]: 0,
      [TaskStatus.REVIEW]: 0,
      [TaskStatus.DONE]: 0,
    };
    filteredTasks.forEach(task => {
      counts[task.status] = (counts[task.status] || 0) + 1;
    });
    return [
      { name: 'To Do', value: counts[TaskStatus.TODO], color: '#94a3b8' },
      { name: 'In Progress', value: counts[TaskStatus.IN_PROGRESS], color: '#3b82f6' },
      { name: 'Review', value: counts[TaskStatus.REVIEW], color: '#a855f7' },
      { name: 'Done', value: counts[TaskStatus.DONE], color: '#22c55e' },
    ].filter(d => d.value > 0);
  }, [filteredTasks]);

  // 3. Tasks by Priority
  const priorityData = useMemo(() => {
    const counts: Record<string, number> = {
      [TaskPriority.CRITICAL]: 0,
      [TaskPriority.HIGH]: 0,
      [TaskPriority.MEDIUM]: 0,
      [TaskPriority.LOW]: 0,
    };
    filteredTasks.forEach(task => {
      counts[task.priority] = (counts[task.priority] || 0) + 1;
    });
    return [
      { name: 'Critical', count: counts[TaskPriority.CRITICAL], fill: '#ef4444' },
      { name: 'High', count: counts[TaskPriority.HIGH], fill: '#f97316' },
      { name: 'Medium', count: counts[TaskPriority.MEDIUM], fill: '#eab308' },
      { name: 'Low', count: counts[TaskPriority.LOW], fill: '#22c55e' },
    ];
  }, [filteredTasks]);

  // 4. Completion Trend (Tasks created vs completed over time)
  const trendData = useMemo(() => {
    const dateMap: Record<string, { created: number, completed: number }> = {};
    
    // Initialize last N days
    const days = dateRange === '7days' ? 7 : (dateRange === '30days' ? 30 : 14); // Default to 14 if 'all'
    for (let i = days; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'MMM dd');
      dateMap[d] = { created: 0, completed: 0 };
    }

    filteredTasks.forEach(task => {
      if (task.created_at) {
        const createdDate = format(new Date(task.created_at), 'MMM dd');
        if (dateMap[createdDate]) dateMap[createdDate].created += 1;
      }
      if (task.status === TaskStatus.DONE && task.updated_at) {
        const completedDate = format(new Date(task.updated_at), 'MMM dd');
        if (dateMap[completedDate]) dateMap[completedDate].completed += 1;
      }
    });

    return Object.entries(dateMap).map(([date, data]) => ({
      date,
      created: data.created,
      completed: data.completed
    }));
  }, [filteredTasks, dateRange]);

  const ChartBarIcon = ICON_MAP.ChartBarIcon;
  const FilterIcon = ICON_MAP.FilterIcon;

  const textColor = darkMode ? 'text-slate-200' : 'text-slate-800';
  const bgColor = darkMode ? 'bg-slate-800' : 'bg-white';
  const borderColor = darkMode ? 'border-slate-700' : 'border-slate-200';

  return (
    <div className={`flex-1 p-4 md:p-6 overflow-y-auto scrollbar-thin ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
      <div className="flex items-center mb-6">
        <ChartBarIcon className={`w-8 h-8 mr-3 ${darkMode ? 'text-primary-light' : 'text-primary'}`} />
        <h1 className="text-2xl md:text-3xl font-semibold">Reports & Analytics</h1>
      </div>

      {/* Filters */}
      <div className={`p-4 rounded-xl mb-6 border ${bgColor} ${borderColor} shadow-sm flex flex-wrap gap-4 items-center`}>
        <div className="flex items-center text-sm font-medium mr-2">
          <FilterIcon className="w-4 h-4 mr-2" /> Filters:
        </div>
        
        <select 
          className={`text-sm rounded-md p-2 border ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300'}`}
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
        >
          <option value="all">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <select 
          className={`text-sm rounded-md p-2 border ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300'}`}
          value={selectedAssigneeId}
          onChange={(e) => setSelectedAssigneeId(e.target.value)}
        >
          <option value="all">All Assignees</option>
          <option value="unassigned">Unassigned</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>

        <select 
          className={`text-sm rounded-md p-2 border ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300'}`}
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as any)}
        >
          <option value="all">All Time</option>
          <option value="30days">Last 30 Days</option>
          <option value="7days">Last 7 Days</option>
        </select>
      </div>

      {isLoadingTasks && tasks.length === 0 ? (
        <div className="flex items-center justify-center p-12">
          <ICON_MAP.SpinnerIcon className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Workload Chart */}
          <div className={`p-5 rounded-xl border shadow-sm ${bgColor} ${borderColor}`}>
            <h3 className={`text-lg font-medium mb-4 ${textColor}`}>Incomplete Tasks by Assignee</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workloadData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#e2e8f0'} vertical={false} />
                  <XAxis dataKey="name" stroke={darkMode ? '#94a3b8' : '#64748b'} fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke={darkMode ? '#94a3b8' : '#64748b'} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: darkMode ? '#1e293b' : '#fff', borderColor: darkMode ? '#334155' : '#e2e8f0', borderRadius: '8px' }}
                    itemStyle={{ color: darkMode ? '#f8fafc' : '#0f172a' }}
                  />
                  <Bar dataKey="tasks" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className={`p-5 rounded-xl border shadow-sm ${bgColor} ${borderColor}`}>
            <h3 className={`text-lg font-medium mb-4 ${textColor}`}>Task Status Distribution</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: darkMode ? '#1e293b' : '#fff', borderColor: darkMode ? '#334155' : '#e2e8f0', borderRadius: '8px' }}
                    itemStyle={{ color: darkMode ? '#f8fafc' : '#0f172a' }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Priority Chart */}
          <div className={`p-5 rounded-xl border shadow-sm ${bgColor} ${borderColor}`}>
            <h3 className={`text-lg font-medium mb-4 ${textColor}`}>Tasks by Priority</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityData} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#e2e8f0'} horizontal={false} />
                  <XAxis type="number" stroke={darkMode ? '#94a3b8' : '#64748b'} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" stroke={darkMode ? '#94a3b8' : '#64748b'} fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: darkMode ? '#1e293b' : '#fff', borderColor: darkMode ? '#334155' : '#e2e8f0', borderRadius: '8px' }}
                    itemStyle={{ color: darkMode ? '#f8fafc' : '#0f172a' }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trend Chart */}
          <div className={`p-5 rounded-xl border shadow-sm ${bgColor} ${borderColor}`}>
            <h3 className={`text-lg font-medium mb-4 ${textColor}`}>Task Activity Trend</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#e2e8f0'} vertical={false} />
                  <XAxis dataKey="date" stroke={darkMode ? '#94a3b8' : '#64748b'} fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke={darkMode ? '#94a3b8' : '#64748b'} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: darkMode ? '#1e293b' : '#fff', borderColor: darkMode ? '#334155' : '#e2e8f0', borderRadius: '8px' }}
                    itemStyle={{ color: darkMode ? '#f8fafc' : '#0f172a' }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                  <Line type="monotone" dataKey="created" name="Created" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="completed" name="Completed" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};