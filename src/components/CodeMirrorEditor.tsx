import React, { useRef, useEffect } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { xml } from '@codemirror/lang-xml'
import { json } from '@codemirror/lang-json'

interface CodeMirrorEditorProps {
  value: string
  onChange?: (value: string) => void
  language?: 'xml' | 'json'
  readOnly?: boolean
  placeholder?: string
  className?: string
}

const CodeMirrorEditor: React.FC<CodeMirrorEditorProps> = ({
  value,
  onChange,
  language = 'xml',
  readOnly = false,
  placeholder = '',
  className = ''
}) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!editorRef.current) return

    const extensions = [
      basicSetup,
      language === 'xml' ? xml() : json(),
      EditorView.theme({
        '&': {
          fontSize: '14px',
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace'
        },
        '.cm-content': {
          padding: '12px',
          minHeight: '200px'
        },
        '.cm-focused': {
          outline: 'none'
        },
        '.cm-editor': {
          border: '1px solid #d1d5db',
          borderRadius: '6px'
        },
        '.cm-editor.cm-focused': {
          borderColor: '#3b82f6',
          boxShadow: '0 0 0 1px #3b82f6'
        }
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && onChange && !readOnly) {
          onChange(update.state.doc.toString())
        }
      }),
      EditorState.readOnly.of(readOnly)
    ]

    if (placeholder) {
      extensions.push(
        EditorView.theme({
          '.cm-placeholder': {
            color: '#9ca3af'
          }
        })
      )
    }

    const state = EditorState.create({
      doc: value,
      extensions
    })

    const view = new EditorView({
      state,
      parent: editorRef.current
    })

    viewRef.current = view

    return () => {
      view.destroy()
    }
  }, [language, readOnly, placeholder])

  useEffect(() => {
    if (viewRef.current && value !== viewRef.current.state.doc.toString()) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: value
        }
      })
    }
  }, [value])

  return <div ref={editorRef} className={className} />
}

export default CodeMirrorEditor

