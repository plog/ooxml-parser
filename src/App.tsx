import React, { useState, useEffect, useRef } from 'react'
import './App.css'
import { EditorView, basicSetup } from 'codemirror'
import { placeholder as cmPlaceholder } from '@codemirror/view'
import { xml } from '@codemirror/lang-xml'
import { json } from '@codemirror/lang-json'
import { OoxmlProcessor } from './lib/ooxml/ooxmlProcessor'

// Simple test component to verify React is working
const App: React.FC = () => {
  const [xmlContent, setXmlContent]     = useState<string>('')
  const [jsonData, setJsonData]         = useState<string>(`{}`)
  const [processedXml, setProcessedXml] = useState<string>('')
  const [error, setError]               = useState<string>('')
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [simplified, setSimplified]     = useState(false)
  const [originalXml, setOriginalXml]   = useState<string>('')
  const xmlEditorRef                    = useRef<EditorView | null>(null)
  const jsonEditorRef                   = useRef<EditorView | null>(null)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === 'text/xml') {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result
        if (typeof result === 'string') {
          setXmlContent(result)
          setError('')
          try {
            const processor = new OoxmlProcessor(result)
            const fieldsJson = processor.extractFieldsAsJson()
            setEditorValue(jsonEditorRef, JSON.stringify(fieldsJson, null, 2))
          } catch (err) {
            // ignore extraction errors
          }
        }
      }
      reader.readAsText(file)
    } else {
      setError('Please select a valid XML file')
    }
  }

  const processXml = () => {
    let xml  = xmlContent
    let json = jsonData
    if (xmlEditorRef.current) {
      xml = xmlEditorRef.current.state.doc.toString()
      setXmlContent(xml)
    }
    if (jsonEditorRef.current) {
      json = jsonEditorRef.current.state.doc.toString()
      setJsonData(json)
    }

    try {
      const processor = new OoxmlProcessor(xml)
      const fieldsJson = processor.extractFieldsAsJson()
      setEditorValue(jsonEditorRef, JSON.stringify(fieldsJson, null, 2))
    } catch (err) {
      // ignore extraction errors
    }

    if (!xml.trim()) {
      setError('Please provide XML content')
      return
    }

    setIsProcessing(true)
    setError('')

    try {
      let data: Record<string, any> = {}
      if (json.trim()) {
        data = JSON.parse(json)
      }
      setProcessedXml(xml)
    } catch (err) {
      const error = err as { message: string }
      setError(`Processing error: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSimplifiedToggle = () => {
    setSimplified((prev) => {
      const newVal = !prev
      if (newVal) {
        setOriginalXml(xmlContent)
        if (xmlContent.trim()) {
          const processor = new OoxmlProcessor(xmlContent)
          const simplifiedXml = processor.simplifyXml()
          setXmlContent(simplifiedXml)
        }
        if (processedXml.trim()) {
          const processor = new OoxmlProcessor(processedXml)
          const simplifiedProcessed = processor.simplifyXml()
          setProcessedXml(simplifiedProcessed)
        }
      } else {
        if (originalXml) setXmlContent(originalXml)
      }
      return newVal
    })
  }

  const CodeMirrorEditor = ({
    value,
    readOnly = false,
    language = 'xml',
    placeholder = '',
    editorRef,
  }: {
    value: string
    readOnly?: boolean
    language?: 'xml' | 'json'
    placeholder?: string
    editorRef?: React.MutableRefObject<EditorView | null>
  }) => {
    const localRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
      if (!localRef.current) return
      if (editorRef && editorRef.current) {
        editorRef.current.destroy()
      }
      const view = new EditorView({
        doc: value,
        extensions: [
          basicSetup,
          language === 'json' ? json() : xml(),
          EditorView.editable.of(!readOnly),
          cmPlaceholder(placeholder),
        ],
        parent: localRef.current,
      })

      if (editorRef) editorRef.current = view

      return () => {
        view.destroy()
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [readOnly, language, placeholder, value])

    return <div ref={localRef} />
  }

  // Add this helper function to set the value of a CodeMirror editor via its ref
  function setEditorValue(editorRef: React.MutableRefObject<EditorView | null>, value: string) {
    if (editorRef.current) {
      editorRef.current.dispatch({
        changes: {
          from: 0,
          to: editorRef.current.state.doc.length,
          insert: value,
        },
      })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">OOXML Field Processor</h1>
          <a href="https://www.datypic.com/sc/ooxml/searchres.html">ooxml reference</a>
          <p className="text-gray-600">
            Test MERGEFIELD and IF field processing in Word OOXML documents with TypeScript
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Input Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <h2 className="text-xl font-semibold">XML Input</h2>
              <label className="ml-4 flex items-center text-sm font-medium text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={simplified}
                  onChange={handleSimplifiedToggle}
                  className="mr-2"
                />
                Simplified view
              </label>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Upload XML File</label>
                <input
                  type="file"
                  accept=".xml"
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  XML Content
                </label>
                <CodeMirrorEditor
                  value={xmlContent}
                  language="xml"
                  placeholder="Paste your OOXML content here..."
                  editorRef={xmlEditorRef}
                />
              </div>
              <button
                onClick={processXml}
                disabled={isProcessing || !xmlContent.trim()}
                className="w-full py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Processing...' : 'Process OOXML'}
              </button>                

            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">JSON Data</h2>
            <p className="text-sm text-gray-600 mb-4">Data for IF field evaluation (optional)</p>
            <CodeMirrorEditor
              value={jsonData}
              language="json"
              placeholder="Enter JSON data for IF field processing..."
              editorRef={jsonEditorRef}
            />
          </div>

          {/* Output Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Processed Output</h2>
            <p className="text-sm text-gray-600 mb-4">
              Transformed OOXML with processed fields
            </p>
            <CodeMirrorEditor
              value={processedXml}
              readOnly
              language="xml"
              placeholder="Processed XML will appear here..."
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App

