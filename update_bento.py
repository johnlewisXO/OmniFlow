with open('components/dashboards/TasklyBentoWorkspaceHub.tsx', 'r') as f:
    c = f.read()

# Replace widget backgrounds with ultra-sheer glass
c = c.replace(
    "? 'bg-slate-900/75 border-white/10'",
    "? 'bg-slate-900/35 border-white/10 backdrop-blur-2xl'"
)

c = c.replace(
    ": 'bg-white/88 border-white shadow-sm'",
    ": 'bg-white/25 border-white/40 backdrop-blur-2xl shadow-xs'"
)

# Replace 32px and 24px roundness with uniform 20px
c = c.replace('rounded-[32px]', 'rounded-[20px]')
c = c.replace('rounded-[24px]', 'rounded-[20px]')

# Replace inner task cards inside widgets
c = c.replace(
    "darkMode ? 'bg-slate-800/80 hover:bg-slate-800 border-white/10' : 'bg-slate-50/90 hover:bg-slate-100 border-slate-200/70'",
    "darkMode ? 'bg-slate-800/40 hover:bg-slate-800/60 border-white/10 backdrop-blur-md' : 'bg-white/30 hover:bg-white/50 border-white/40 backdrop-blur-md'"
)

# Replace inner metric cards
c = c.replace(
    "darkMode ? 'bg-slate-800/70 border-white/10' : 'bg-slate-50/90 border-slate-200/80'",
    "darkMode ? 'bg-slate-800/40 border-white/10 backdrop-blur-md' : 'bg-white/30 border-white/40 backdrop-blur-md'"
)

# Jargon / dev text simplifications
c = c.replace(
    "customSubtitle || 'Click any task card to open the Slide-Over Inspector'",
    "customSubtitle || 'Click any task to view details'"
)

c = c.replace(
    "Concentric Velocity",
    "Team Progress"
)

c = c.replace(
    "Stakeholder Portal",
    "Client View"
)

c = c.replace(
    "Click to inspect queue",
    "Your assigned tasks"
)

c = c.replace(
    "Live Sprint Boards",
    "Active Projects"
)

with open('components/dashboards/TasklyBentoWorkspaceHub.tsx', 'w') as f:
    f.write(c)

print('Updated TasklyBentoWorkspaceHub successfully!')
