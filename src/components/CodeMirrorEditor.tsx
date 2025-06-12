import React, { useRef, useEffect } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { xml } from '@codemirror/lang-xml'
import { json } from '@codemirror/lang-json'

const CodeMirrorEditor: React.FC<{
  value: string
  onChange?: (value: string) => void
  language?: 'xml' | 'json'
  readOnly?: boolean
  placeholder?: string
  className?: string
  height?: string
}> = ({
  value,
  onChange,
  language = 'xml',
  readOnly = false,
  placeholder = '',
  className = '',
  height = '900px'
}) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!editorRef.current) return

    const extensions = [
      basicSetup,
      language === 'xml' ? xml() : json(),
      // EditorView.updateListener.of((update) => {
      //   if (update.docChanged && onChange && !readOnly) {
      //     onChange(update.state.doc.toString())
      //   }
      // }),
      EditorState.readOnly.of(readOnly)
    ]

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
  }, [language, readOnly, placeholder, height])

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

