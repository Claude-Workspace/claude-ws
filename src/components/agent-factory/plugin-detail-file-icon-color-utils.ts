/**
 * Utility mapping file extensions to Tailwind text-color classes for file icons.
 * Used in the plugin detail file content modal and file tree views.
 */

const FILE_EXTENSION_ICON_COLORS: Record<string, string> = {
  js: 'text-yellow-500',
  jsx: 'text-yellow-500',
  ts: 'text-blue-500',
  tsx: 'text-blue-500',
  py: 'text-green-500',
  rb: 'text-red-500',
  go: 'text-cyan-500',
  rs: 'text-orange-500',
  java: 'text-orange-600',
  c: 'text-blue-600',
  cpp: 'text-blue-600',
  cs: 'text-purple-500',
  php: 'text-purple-600',
  swift: 'text-orange-500',
  kt: 'text-purple-600',
  sh: 'text-green-600',
  bash: 'text-green-600',
  sql: 'text-blue-400',
  json: 'text-yellow-400',
  yaml: 'text-pink-500',
  yml: 'text-pink-500',
  xml: 'text-orange-400',
  html: 'text-orange-500',
  htm: 'text-orange-500',
  css: 'text-blue-400',
  scss: 'text-pink-400',
  sass: 'text-pink-400',
  less: 'text-blue-300',
  md: 'text-blue-300',
  markdown: 'text-blue-300',
  txt: 'text-gray-400',
  dockerfile: 'text-blue-500',
  docker: 'text-blue-500',
};

/** Returns a Tailwind text-color class based on the file's extension */
export function getFileIconColorClass(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  return FILE_EXTENSION_ICON_COLORS[ext || ''] || 'text-gray-500';
}
