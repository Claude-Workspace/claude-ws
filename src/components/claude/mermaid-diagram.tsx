'use client';

import { memo, useMemo } from 'react';
import { renderMermaidSVG, THEMES } from 'beautiful-mermaid';
import { useTheme } from 'next-themes';
import DOMPurify from 'dompurify';

interface MermaidDiagramProps {
  code: string;
}

// Configure DOMPurify for SVG sanitization
const purifyConfig = {
  // Allow SVG elements and attributes needed for mermaid diagrams
  USE_PROFILES: { svg: true, svgFilters: true },
  // Allow specific attributes that mermaid uses
  ADD_ATTR: ['viewBox', 'preserveAspectRatio', 'xmlns'],
  // Allow data URIs for images if needed
  ADD_URI_SAFE_ATTR: ['xlink:href'],
};

export const MermaidDiagram = memo(function MermaidDiagram({ code }: MermaidDiagramProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const { svg, error } = useMemo(() => {
    const colors = isDark ? THEMES['github-dark'] : THEMES['github-light'];
    try {
      const renderedSvg = renderMermaidSVG(code, { ...colors, transparent: true, padding: 32 });
      // Sanitize SVG to prevent XSS attacks
      const sanitizedSvg = DOMPurify.sanitize(renderedSvg, purifyConfig);
      return {
        svg: sanitizedSvg,
        error: null,
      };
    } catch (err) {
      return { svg: null, error: err instanceof Error ? err : new Error(String(err)) };
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
