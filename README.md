# Omni Flow 🌊

**Omni Flow** is an AI-powered project management platform designed for beautiful efficiency. Streamline workflows, foster collaboration, and achieve goals with intelligent precision. By blending intuitive project management tools with cutting-edge AI via Google Gemini, Omni Flow empowers teams of all sizes to do their best work.

---

## ✨ Features

- **Role-Based Access Control (RBAC):** Dedicated, tailored dashboards for Owners, Admins, Project Managers, Members, and Client Viewers.
- **Intelligent Task & Project Management:** Create projects, organize tasks on a dynamic Kanban board, and track progress effortlessly.
- **Organizations & Teaming:** Join or create joint workspaces. Manage team members and their access levels securely.
- **Real-time Notifications:** Never miss an update with live, real-time alerts powered by Supabase subscriptions.
- **AI-Powered Capabilities:** Supercharge your productivity with intelligent features driven by Google's GenAI (`@google/genai`).
- **Rich Analytics & Reporting:** Track team velocity and project health with immersive charts generated via Recharts.

---

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **Styling:** Tailwind CSS (with responsive, glassmorphism design elements)
- **Backend/Database:** Supabase (PostgreSQL, Auth, Realtime)
- **AI Integration:** Google Gemini API
- **Charts:** Recharts
- **Date Utilities:** date-fns

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your local machine:
- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. **Clone the repository** (if applicable) or download the source code.
2. **Install dependencies** by running:
   ```bash
   npm install
   ```

### Environment Configuration

Omni Flow relies on Supabase and the Google Gemini API. Configure your environment variables for these services. While some defaults are provided in the source code for demo purposes, you should supply your own for production:

Create a `.env` file in the root of your workspace:

```env
# Google Gemini setup
GEMINI_API_KEY=your_gemini_api_key_here

# Supabase setup (if overriding the default demo instance)
REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Running the App Locally

To start the Vite development server:

```bash
npm run dev
```

The application will be accessible at `http://localhost:3000` (or another port if 3000 is occupied).

### Building for Production

To create an optimized production build:

```bash
npm run build
```

You can preview the built bundle with:

```bash
npm run preview
```

---

## 📁 Project Structure

Here is a high-level overview of the project structure:

```
├── components/          # Reusable UI components
│   ├── auth/            # Authentication forms and modals
│   ├── dashboards/      # Role-specific dashboard views
│   ├── layout/          # Sidebar, Header, Global Layouts
│   ├── projects/        # Project creation and overview components
│   ├── tasks/           # Kanban board, modals, and task lists
│   └── team/            # Organization & Team management
├── hooks/               # Custom React hooks (e.g., useAppStore for global state)
├── services/            # API & external service integrations (Supabase, GenAI)
├── utils/               # Helper utilities and formatters
├── App.tsx              # Main application entry point and routing logic
├── constants.tsx        # Global constants and Icon mapping
├── types.ts             # TypeScript interfaces and enum definitions
└── index.css            # Global Tailwind CSS and styling configuration
```

---

## 🔒 Security & Roles

Omni Flow uses a robust RBAC model defined in Supabase and maintained in the client application:
- **Owner:** Full access to organization billing, administration, and team deletion.
- **Admin:** Can manage team members, roles, and oversee all projects.
- **Project Manager:** Can create and oversee projects, assign tasks, and track reports.
- **Member:** Can view assigned tasks, update statuses, and participate in projects.
- **Client Viewer:** Restricted read-only access to specific project statuses and overall progress.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the project.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📄 License

This project is licensed under the MIT License.
