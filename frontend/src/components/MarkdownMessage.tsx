import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownMessageProps {
  content: string;
}

/**
 * Renders an LLM/chat message as Markdown.
 *
 * - Bold, italics, ordered/unordered lists, headings, tables (GFM), links, and
 *   blockquotes are parsed and styled via the `.markdown-body` CSS.
 * - Fenced code blocks (```lang) are syntax highlighted by language using
 *   PrismJS via react-syntax-highlighter; inline `code` is rendered as a pill.
 * - Links open in a new tab with safe rel attributes.
 *
 * Note: react-markdown v9 removed the `inline` prop. We treat code as a block
 * when it carries a `language-*` class or spans multiple lines; otherwise it is
 * inline.
 */
export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content }) => {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeText = String(children).replace(/\n$/, '');
            const isBlock = Boolean(match) || codeText.includes('\n');

            if (isBlock) {
              return (
                <SyntaxHighlighter
                  style={oneDark}
                  language={match ? match[1] : 'text'}
                  PreTag="div"
                  customStyle={{
                    margin: '0.5em 0',
                    borderRadius: 8,
                    fontSize: 13,
                    background: 'rgba(0,0,0,0.4)',
                  }}
                >
                  {codeText}
                </SyntaxHighlighter>
              );
            }

            return (
              <code className="markdown-inline-code" {...props}>
                {children}
              </code>
            );
          },
          a({ children, ...props }) {
            return (
              <a target="_blank" rel="noopener noreferrer" {...props}>
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
