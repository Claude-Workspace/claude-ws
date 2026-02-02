'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle, Zap, Shield, GitBranch, MessageSquare, Layers, Smartphone } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="max-w-4xl mx-auto text-center">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img
              src="/logo-light.svg"
              alt="Claude Workspace"
              className="h-20 w-auto"
            />
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6">
            Visual Workspace for Claude Code
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-2xl mx-auto">
            Kanban board, real-time AI streaming, code editor, and Git integration — all in one beautiful, local-first workspace.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-8 py-4 bg-black text-white text-lg font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              Get Started
              <ArrowRight size={20} />
            </Link>
            <Link
              href="https://github.com/Claude-Workspace/claude-ws"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gray-100 text-gray-900 text-lg font-semibold rounded-lg hover:bg-gray-200 transition-colors"
            >
              View on GitHub
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-16">
            Everything You Need
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <FeatureCard key={index} {...feature} />
            ))}
          </div>
        </div>
      </section>

      {/* Screenshot Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-4">
            Beautiful. Powerful. Local.
          </h2>
          <p className="text-xl text-gray-600 text-center mb-12">
            See Claude Workspace in action
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="rounded-xl overflow-hidden shadow-2xl border border-gray-200">
              <img
                src="/desktop-review-0.jpeg"
                alt="Desktop View"
                className="w-full h-auto"
              />
            </div>
            <div className="rounded-xl overflow-hidden shadow-2xl border border-gray-200">
              <img
                src="/desktop-review-1.jpeg"
                alt="Kanban Board"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="container mx-auto px-4 py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-8">
            Built with Modern Tech
          </h2>
          <p className="text-xl text-gray-600 mb-12">
            Next.js 16 • React 19 • SQLite • Drizzle ORM • Socket.io • Tailwind CSS 4
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {techStack.map((tech) => (
              <span
                key={tech}
                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 font-medium"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Ready to Transform Your Workflow?
          </h2>
          <p className="text-xl text-gray-600 mb-12">
            Join thousands of developers using Claude Workspace to build faster and smarter.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-8 py-4 bg-black text-white text-lg font-semibold rounded-lg hover:bg-gray-800 transition-colors"
          >
            Start Building Now
            <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 border-t border-gray-200">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo-light.svg" alt="Claude Workspace" className="h-6 w-auto" />
            <span className="text-gray-600">© 2024 Claude Workspace</span>
          </div>
          <div className="flex gap-6 text-gray-600">
            <Link href="https://github.com/Claude-Workspace/claude-ws" target="_blank" rel="noopener noreferrer" className="hover:text-gray-900">
              GitHub
            </Link>
            <Link href="/docs/swagger" className="hover:text-gray-900">
              API Docs
            </Link>
          </div>
        </div>

        {/* Credits */}
        <div className="max-w-6xl mx-auto mt-6 pt-6 border-t border-gray-100 text-center">
          <p className="text-sm text-gray-500">
            Landing page created by{' '}
            <Link href="https://github.com/bnopen" target="_blank" rel="noopener noreferrer" className="hover:text-gray-900 font-medium">
              gh/bnopen
            </Link>
            {', AiSon of gh/techcomthanh'}
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
        <Icon size={24} className="text-gray-900" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

interface FeatureCardProps {
  icon: any;
  title: string;
  description: string;
}

const features: FeatureCardProps[] = [
  {
    icon: Layers,
    title: 'Kanban Board',
    description: 'Drag-and-drop task management with full conversation history and checkpoints.',
  },
  {
    icon: MessageSquare,
    title: 'Real-time Streaming',
    description: 'Live Claude responses via Socket.io with instant feedback and updates.',
  },
  {
    icon: Zap,
    title: 'Code Editor',
    description: 'Tabbed CodeMirror editor with syntax highlighting and AI-powered suggestions.',
  },
  {
    icon: GitBranch,
    title: 'Git Integration',
    description: 'Full Git workflow: status, stage, commit, diff, and visual history graph.',
  },
  {
    icon: Shield,
    title: 'Local-First',
    description: 'SQLite database keeps all your data local. Your conversations, your control.',
  },
  {
    icon: Smartphone,
    title: 'Agent Factory',
    description: 'Plugin system for custom skills, commands, and AI agents tailored to your workflow.',
  },
];

const techStack = [
  'Next.js 16',
  'React 19',
  'SQLite',
  'Drizzle ORM',
  'Socket.io',
  'Tailwind CSS 4',
  'Radix UI',
  'Zustand',
];
