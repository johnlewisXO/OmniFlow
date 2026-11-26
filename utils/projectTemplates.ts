import { TaskPriority, TaskStatus } from '../types';

export interface ProjectTemplateTask {
  title: string;
  description?: string;
  priority: TaskPriority;
  points: number;
  status: TaskStatus;
  checklist?: string[];
}

export interface ProjectTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  estimatedDays: number;
  tasks: ProjectTemplateTask[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'tpl-saas-launch',
    name: 'AI-First SaaS Product Launch',
    category: 'Product & Engineering',
    description:
      'End-to-end product launch with architecture, security compliance, load testing, and GTM readiness.',
    estimatedDays: 28,
    tasks: [
      {
        title: 'Define System Architecture & API Contracts',
        description: 'Finalize database schemas, RLS access boundaries, and service contracts.',
        priority: TaskPriority.CRITICAL,
        points: 8,
        status: TaskStatus.TODO,
        checklist: ['Draft RFC', 'Review API contracts', 'Approve DB schema'],
      },
      {
        title: 'Implement End-to-End Encryption & RBAC Policies',
        description: 'Enforce organization roles and workspace permission checks.',
        priority: TaskPriority.HIGH,
        points: 5,
        status: TaskStatus.TODO,
        checklist: ['Audit RBAC matrix', 'Verify session tokens'],
      },
      {
        title: 'Conduct Load Testing & Telemetry Verification',
        description: 'Validate response latency, error tracking, and production observability.',
        priority: TaskPriority.HIGH,
        points: 5,
        status: TaskStatus.TODO,
        checklist: ['Run load test suite', 'Check alerting rules'],
      },
      {
        title: 'Prepare Production Release Runbook & Stakeholder Brief',
        description: 'Publish rollout steps, rollback plan, and customer changelog.',
        priority: TaskPriority.MEDIUM,
        points: 3,
        status: TaskStatus.TODO,
        checklist: ['Write launch brief', 'Verify rollback steps'],
      },
    ],
  },
  {
    id: 'tpl-security-soc2',
    name: 'SOC2 Type II & Security Hardening',
    category: 'Security & Compliance',
    description:
      'Security audit workflow covering IAM, MFA enforcement, audit trail retention, and penetration testing.',
    estimatedDays: 42,
    tasks: [
      {
        title: 'Audit Organization RBAC Roles & Least-Privilege Access',
        description: 'Verify every workspace seat matches least-privilege permissions.',
        priority: TaskPriority.CRITICAL,
        points: 5,
        status: TaskStatus.TODO,
        checklist: ['Review admin roles', 'Remove stale service accounts'],
      },
      {
        title: 'Verify Immutable Audit Log Retention & SHA-256 Chain',
        description: 'Ensure audit records capture actor, action, and integrity signature.',
        priority: TaskPriority.HIGH,
        points: 5,
        status: TaskStatus.TODO,
        checklist: ['Export sample log chain', 'Validate checksums'],
      },
      {
        title: 'Rotate Organization API Keys & Webhook Secrets',
        description: 'Cycle production API tokens and validate zero-downtime key rollout.',
        priority: TaskPriority.HIGH,
        points: 3,
        status: TaskStatus.TODO,
        checklist: ['Issue new keys', 'Revoke deprecated tokens'],
      },
      {
        title: 'Complete External Vulnerability & Penetration Assessment',
        description: 'Coordinate external security scan and remediate any findings.',
        priority: TaskPriority.MEDIUM,
        points: 8,
        status: TaskStatus.TODO,
        checklist: ['Schedule assessment', 'Triage findings'],
      },
    ],
  },
  {
    id: 'tpl-agile-sprint',
    name: 'High-Velocity Agile Engineering Sprint',
    category: 'Agile Delivery',
    description:
      '2-week engineering sprint template with backlog grooming, QA verification gates, and retrospective.',
    estimatedDays: 14,
    tasks: [
      {
        title: 'Sprint Backlog Grooming & Fibonacci Estimation',
        description: 'Size candidate tickets and lock sprint commitment.',
        priority: TaskPriority.HIGH,
        points: 3,
        status: TaskStatus.TODO,
        checklist: ['Size top backlog items', 'Confirm sprint capacity'],
      },
      {
        title: 'Core Feature Implementation & Unit Test Coverage',
        description: 'Ship primary sprint deliverables with automated test suites.',
        priority: TaskPriority.CRITICAL,
        points: 8,
        status: TaskStatus.TODO,
        checklist: ['Implement feature logic', 'Write unit & integration tests'],
      },
      {
        title: 'End-to-End Regression & Cross-Browser QA',
        description: 'Verify desktop and mobile responsiveness before release.',
        priority: TaskPriority.HIGH,
        points: 5,
        status: TaskStatus.TODO,
        checklist: ['Verify desktop & mobile views', 'Sign off QA checklist'],
      },
      {
        title: 'Sprint Demo & Velocity Retrospective',
        description: 'Demo shipped deliverables and record team process improvements.',
        priority: TaskPriority.LOW,
        points: 2,
        status: TaskStatus.TODO,
        checklist: ['Host demo session', 'Log retro action items'],
      },
    ],
  },
  {
    id: 'tpl-gtm-rollout',
    name: 'Customer Onboarding & GTM Rollout',
    category: 'Go-To-Market',
    description:
      'Structured launch plan for customer enablement, documentation, portal setup, and adoption tracking.',
    estimatedDays: 21,
    tasks: [
      {
        title: 'Publish Customer Enablement Docs & Video Walkthroughs',
        description: 'Record async onboarding clips and create interactive wiki guides.',
        priority: TaskPriority.HIGH,
        points: 5,
        status: TaskStatus.TODO,
        checklist: ['Record onboarding clip', 'Publish quickstart guide'],
      },
      {
        title: 'Configure Client Portal & Stakeholder Changelog',
        description: 'Set up external portal visibility and release milestone feed.',
        priority: TaskPriority.MEDIUM,
        points: 3,
        status: TaskStatus.TODO,
        checklist: ['Verify portal permissions', 'Post initial release note'],
      },
      {
        title: 'Launch Customer Feedback Triage & SLA Rules',
        description: 'Connect intake triage queue with automated escalation rules.',
        priority: TaskPriority.HIGH,
        points: 5,
        status: TaskStatus.TODO,
        checklist: ['Configure intake form', 'Test escalation trigger'],
      },
    ],
  },
];
