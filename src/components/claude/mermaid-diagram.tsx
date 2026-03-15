'use client';

import { memo, useMemo } from 'react';
import { renderMermaidSVG, THEMES } from 'beautiful-mermaid';
import { useTheme } from 'next-themes';

interface MermaidDiagramProps {
  code: string;
}

export const MermaidDiagram = memo(function MermaidDiagram({ code }: MermaidDiagramProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const { svg, error } = useMemo(() => {
    const colors = isDark ? THEMES['github-dark'] : THEMES['github-light'];
    try {
      return {
        svg: renderMermaidSVG(code, { ...colors, transparent: true, padding: 32 }),
        error: null,
      };
    } catch (err) {
      return { svg: null, error: err as Error };
    }
  }, [code, isDark]);

  if (error || !svg) {
    return (
      <pre className="my-2 w-full max-w-full overflow-x-auto rounded-xl bg-muted p-4 text-sm font-mono">
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <div
      className="my-3 flex items-center justify-center overflow-x-auto rounded-xl bg-muted/50 p-2 [&_svg]:max-w-full [&_svg]:h-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
});
