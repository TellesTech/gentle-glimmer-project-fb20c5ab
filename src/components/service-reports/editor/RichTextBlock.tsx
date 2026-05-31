import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

// FontSize extension via TextStyle
const FontSize = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize || null,
        renderHTML: (attributes) => {
          if (!attributes.fontSize) return {};
          return { style: `font-size: ${attributes.fontSize}` };
        },
      },
    };
  },
  addCommands() {
    return {
      ...this.parent?.(),
      setFontSize: (fontSize: string) => ({ commands }: any) => {
        return commands.setMark('textStyle', { fontSize });
      },
    };
  },
});

interface RichTextBlockProps {
  content: string;
  /** Called continuously (debounced) when user edits — used for live preview only */
  onChange: (html: string) => void;
  /** Called when the editor loses focus — this is the COMMIT moment for parent state */
  onCommit?: (html: string) => void;
  onFocus?: (editor: Editor) => void;
  onBlur?: () => void;
  className?: string;
  placeholder?: string;
  editable?: boolean;
  variant?: 'heading' | 'paragraph' | 'title' | 'inline';
  /** When true, strips HTML tags on blur and returns plain text via onChange */
  plainTextOnBlur?: boolean;
}

const normalizeHtml = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .replace(/<p>\s*<\/p>/g, '')
    .trim();
};

/**
 * IMPORTANT — UNCONTROLLED behavior:
 * The `content` prop is used ONLY as the initial value when the component
 * mounts. After mount, the Tiptap editor owns the content. Parent state is
 * NOT pushed back into the editor on every keystroke / format. This is the
 * fundamental fix for the duplication-on-format bug: any external re-render
 * of the parent (e.g., pagination recompute) cannot reset the editor's
 * content while the user is typing or applying formatting.
 *
 * To force a refresh from the outside (e.g., AI fill, undo/redo), unmount &
 * remount the component by changing its `key`.
 */
export function RichTextBlock({
  content,
  onChange,
  onCommit,
  onFocus,
  onBlur,
  className,
  placeholder = 'Escreva aqui...',
  editable = true,
  variant = 'paragraph',
  plainTextOnBlur = false,
}: RichTextBlockProps) {
  const initialContentRef = useRef(content || '');
  const lastEmittedRef = useRef<string>(content || '');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-primary underline cursor-pointer' },
      }),
      Subscript,
      Superscript,
    ].filter((ext, index, arr) => {
      const name = (ext as any)?.name;
      if (!name) return true;
      return arr.findIndex((e) => (e as any)?.name === name) === index;
    }),
    content: initialContentRef.current,
    editable,
    editorProps: {
      attributes: {
        class: cn(
          'outline-none focus:outline-none prose prose-sm max-w-none',
          variant === 'title' && 'font-bold uppercase',
          variant === 'heading' && 'font-semibold',
          variant === 'paragraph' && 'leading-relaxed',
          variant === 'inline' && 'font-semibold',
          className
        ),
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastEmittedRef.current = html;
      // Live preview signal — parent should NOT use this to drive a re-render
      // that re-paginates the page (it would unmount the editor mid-edit).
      onChange(html);
    },
    onFocus: ({ editor }) => {
      onFocus?.(editor);
    },
    onBlur: ({ editor }) => {
      const html = plainTextOnBlur ? editor.getText() : editor.getHTML();
      lastEmittedRef.current = html;
      // COMMIT — this is when the parent should update its state.
      onCommit?.(html);
      onBlur?.();
    },
  });

  // Expose a way to force commit from the outside (Save / Export PDF) without
  // requiring the user to click out of the editor.
  useEffect(() => {
    if (!editor) return;
    (editor as any).__commitDraft = () => {
      const html = plainTextOnBlur ? editor.getText() : editor.getHTML();
      lastEmittedRef.current = html;
      onCommit?.(html);
    };
    return () => {
      try { delete (editor as any).__commitDraft; } catch { /* ignore */ }
    };
  }, [editor, onCommit, plainTextOnBlur]);

  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editable, editor]);

  if (!editor) return null;

  return (
    <div className={cn(
      'rounded transition-colors',
      editable && 'hover:bg-primary/5 cursor-text',
    )}>
      <EditorContent editor={editor} />
    </div>
  );
}
